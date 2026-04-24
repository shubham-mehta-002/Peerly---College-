# Feed + Posts Backend — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Express 5 + TypeScript backend for post CRUD, campus/global feed, voting, heat score, and threaded comments.

**Architecture:** Two modules under `src/modules/` — `posts/` (CRUD + voting + feed queries) and `comments/` (threaded comments). Vote logic lives in `posts.service.ts` since it mutates post counters and heat score. Anonymous masking and heat score computation are pure functions, unit-tested without DB mocks.

**Tech Stack:** Express 5, TypeScript 6, Supabase JS v2 (supabaseAdmin), zod, bcryptjs (existing), jest + ts-jest (existing).

---

## File Map

```
peerly-backend/
  database/
    schema.sql                         — MODIFY: append posts/post_votes/comments tables
  src/
    modules/
      posts/
        posts.types.ts                 — CREATE: Zod schemas, PostResponse interface
        posts.service.ts               — CREATE: computeHeatScore, maskAuthor, CRUD, feed, castVote
        posts.controller.ts            — CREATE: req/res handlers
        posts.router.ts                — CREATE: routes wired with authenticate + validateBody
      comments/
        comments.types.ts              — CREATE: Zod schemas
        comments.service.ts            — CREATE: addComment, getComments, deleteComment
        comments.controller.ts         — CREATE: req/res handlers
        comments.router.ts             — CREATE: routes wired with authenticate + validateBody
    app.ts                             — MODIFY: mount posts + comments routers
    __tests__/
      posts.service.test.ts            — CREATE: unit tests
      comments.service.test.ts         — CREATE: unit tests
```

---

## Task 1: Database Schema Migration

**Files:**
- Modify: `peerly-backend/database/schema.sql`

- [ ] **Step 1: Append migration block to schema.sql**

Open `peerly-backend/database/schema.sql` and append at the end:

```sql
-- ============================================
-- Feed + Posts Migration
-- ============================================

create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references profiles(id) on delete cascade,
  campus_id uuid not null references campuses(id) on delete cascade,
  college_id uuid not null references colleges(id),
  content text not null,
  image_urls text[] not null default '{}',
  is_global boolean not null default false,
  is_anonymous boolean not null default false,
  upvotes int not null default 0,
  downvotes int not null default 0,
  comment_count int not null default 0,
  heat_score float not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists posts_campus_id_idx on posts(campus_id, created_at desc);
create index if not exists posts_global_idx on posts(is_global, created_at desc);
create index if not exists posts_heat_score_idx on posts(heat_score desc);

create table if not exists post_votes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  vote_type text not null check (vote_type in ('up', 'down')),
  created_at timestamptz not null default now(),
  unique(post_id, user_id)
);

create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  author_id uuid not null references profiles(id) on delete cascade,
  parent_id uuid references comments(id) on delete cascade,
  depth int not null default 0,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists comments_post_id_idx on comments(post_id, created_at asc);
```

- [ ] **Step 2: Run migration in Supabase**

Supabase dashboard → SQL Editor → paste the appended block → Run.

Expected: `posts`, `post_votes`, `comments` tables created, indexes created. No errors.

- [ ] **Step 3: Commit**

```bash
cd peerly-backend
git add database/schema.sql
git commit -m "feat: add posts, post_votes, comments schema"
```

---

## Task 2: Posts Types

**Files:**
- Create: `peerly-backend/src/modules/posts/posts.types.ts`

- [ ] **Step 1: Create posts.types.ts**

```typescript
import { z } from 'zod';

export const createPostSchema = z.object({
  content: z.string().min(1, 'Content is required').max(2000),
  image_urls: z.array(z.string().url('Invalid image URL')).max(4, 'Maximum 4 images').default([]),
  is_global: z.boolean().default(false),
  is_anonymous: z.boolean().default(false),
});

export const feedQuerySchema = z.object({
  sort: z.enum(['latest', 'oldest', 'upvoted', 'trending']).default('latest'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const voteSchema = z.object({
  vote_type: z.enum(['up', 'down']).nullable(),
});

export type CreatePostBody = z.infer<typeof createPostSchema>;
export type FeedQuery = z.infer<typeof feedQuerySchema>;
export type VoteBody = z.infer<typeof voteSchema>;

export interface DisplayAuthor {
  username: string;
  avatar_url: string | null;
}

export interface PostResponse {
  id: string;
  content: string;
  image_urls: string[];
  is_global: boolean;
  is_anonymous: boolean;
  upvotes: number;
  comment_count: number;
  heat_score: number;
  created_at: string;
  campus_id: string;
  display_author: DisplayAuthor;
  user_vote: 'up' | 'down' | null;
}
```

- [ ] **Step 2: Compile check**

```bash
cd peerly-backend
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd peerly-backend
git add src/modules/posts/posts.types.ts
git commit -m "feat: add posts types and Zod schemas"
```

---

## Task 3: Posts Service (TDD)

**Files:**
- Create: `peerly-backend/src/__tests__/posts.service.test.ts`
- Create: `peerly-backend/src/modules/posts/posts.service.ts`

- [ ] **Step 1: Write failing tests**

Create `peerly-backend/src/__tests__/posts.service.test.ts`:

```typescript
import { computeHeatScore, maskAuthor } from '../modules/posts/posts.service';
import { supabaseAdmin } from '../lib/supabase';

jest.mock('../lib/supabase', () => ({
  supabaseAdmin: { from: jest.fn() },
}));

jest.mock('../lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

const mockFrom = supabaseAdmin.from as jest.Mock;

function chain(overrides: Record<string, any> = {}): any {
  const c: any = {
    select: () => c,
    eq: () => c,
    in: () => c,
    single: () => Promise.resolve({ data: null, error: null }),
    insert: () => c,
    update: () => c,
    delete: () => c,
    order: () => c,
    range: () => Promise.resolve({ data: [], error: null }),
    ...overrides,
  };
  return c;
}

describe('computeHeatScore', () => {
  it('returns 0 when all inputs are 0', () => {
    expect(computeHeatScore(0, 0, 0, new Date().toISOString())).toBe(0);
  });

  it('increases with more upvotes', () => {
    const now = new Date().toISOString();
    expect(computeHeatScore(10, 0, 0, now)).toBeGreaterThan(computeHeatScore(1, 0, 0, now));
  });

  it('decreases for older posts', () => {
    const recent = new Date().toISOString();
    const old = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    expect(computeHeatScore(5, 0, 0, recent)).toBeGreaterThan(computeHeatScore(5, 0, 0, old));
  });

  it('never returns negative', () => {
    expect(computeHeatScore(0, 100, 0, new Date().toISOString())).toBeGreaterThanOrEqual(0);
  });
});

describe('maskAuthor', () => {
  const authorId = 'user-1';
  const viewerId = 'user-2';

  it('returns real username when not anonymous', () => {
    const result = maskAuthor(authorId, false, viewerId, 'campus', 'IIT Bombay', 'alice', 'avatar.jpg');
    expect(result).toEqual({ username: 'alice', avatar_url: 'avatar.jpg' });
  });

  it('returns "Anonymous Peer" on campus feed', () => {
    const result = maskAuthor(authorId, true, viewerId, 'campus', 'IIT Bombay', 'alice', null);
    expect(result).toEqual({ username: 'Anonymous Peer', avatar_url: null });
  });

  it('returns college name on global feed', () => {
    const result = maskAuthor(authorId, true, viewerId, 'global', 'IIT Bombay', 'alice', null);
    expect(result).toEqual({ username: 'Anonymous @ IIT Bombay', avatar_url: null });
  });

  it('returns real username when viewer is the author even if anonymous', () => {
    const result = maskAuthor(authorId, true, authorId, 'global', 'IIT Bombay', 'alice', null);
    expect(result).toEqual({ username: 'alice', avatar_url: null });
  });
});

describe('castVote', () => {
  beforeEach(() => mockFrom.mockReset());

  it('throws 404 if post not found', async () => {
    const { castVote } = await import('../modules/posts/posts.service');
    mockFrom.mockReturnValue(chain({ single: () => Promise.resolve({ data: null, error: null }) }));
    await expect(castVote('p1', 'u1', 'up')).rejects.toMatchObject({ status: 404 });
  });

  it('no-ops when removing a vote that does not exist', async () => {
    const { castVote } = await import('../modules/posts/posts.service');
    const postData = { id: 'p1', upvotes: 5, downvotes: 1, comment_count: 2, created_at: new Date().toISOString() };
    let updateCalled = false;

    mockFrom
      .mockReturnValueOnce(chain({ single: () => Promise.resolve({ data: postData, error: null }) }))
      .mockReturnValueOnce(chain({ single: () => Promise.resolve({ data: null, error: null }) }))
      .mockReturnValue({ ...chain(), update: () => { updateCalled = true; return chain(); } });

    await castVote('p1', 'u1', null);
    expect(updateCalled).toBe(false);
  });

  it('no-ops when casting same vote type', async () => {
    const { castVote } = await import('../modules/posts/posts.service');
    const postData = { id: 'p1', upvotes: 5, downvotes: 1, comment_count: 2, created_at: new Date().toISOString() };
    let updateCalled = false;

    mockFrom
      .mockReturnValueOnce(chain({ single: () => Promise.resolve({ data: postData, error: null }) }))
      .mockReturnValueOnce(chain({ single: () => Promise.resolve({ data: { vote_type: 'up' }, error: null }) }))
      .mockReturnValue({ ...chain(), update: () => { updateCalled = true; return chain(); } });

    await castVote('p1', 'u1', 'up');
    expect(updateCalled).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd peerly-backend
npx jest src/__tests__/posts.service.test.ts
```

Expected: FAIL — `Cannot find module '../modules/posts/posts.service'`

- [ ] **Step 3: Create src/modules/posts/posts.service.ts**

```typescript
import { supabaseAdmin } from '../../lib/supabase';
import { AppError } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { CreatePostBody, FeedQuery, PostResponse, DisplayAuthor } from './posts.types';

export function computeHeatScore(
  upvotes: number,
  downvotes: number,
  commentCount: number,
  createdAt: string
): number {
  const hoursSincePosted = (Date.now() - new Date(createdAt).getTime()) / 3_600_000;
  const raw = (upvotes * 2 + commentCount * 1.5 - downvotes) / Math.pow(hoursSincePosted + 2, 1.8);
  return Math.max(0, parseFloat(raw.toFixed(6)));
}

export function maskAuthor(
  authorId: string,
  isAnonymous: boolean,
  viewerUserId: string,
  feedType: 'campus' | 'global',
  collegeName: string,
  username: string,
  avatarUrl: string | null
): DisplayAuthor {
  if (!isAnonymous || authorId === viewerUserId) {
    return { username, avatar_url: avatarUrl };
  }
  return {
    username: feedType === 'global' ? `Anonymous @ ${collegeName}` : 'Anonymous Peer',
    avatar_url: null,
  };
}

export async function createPost(
  userId: string,
  campusId: string,
  body: CreatePostBody
): Promise<Omit<PostResponse, 'display_author' | 'user_vote'>> {
  const { data: campus } = await supabaseAdmin
    .from('campuses')
    .select('college_id')
    .eq('id', campusId)
    .single();

  if (!campus) throw new AppError(400, 'Invalid campus');

  const { data: post, error } = await supabaseAdmin
    .from('posts')
    .insert({
      author_id: userId,
      campus_id: campusId,
      college_id: campus.college_id,
      content: body.content,
      image_urls: body.image_urls,
      is_global: body.is_global,
      is_anonymous: body.is_anonymous,
    })
    .select('id, content, image_urls, is_global, is_anonymous, upvotes, comment_count, heat_score, created_at, campus_id')
    .single();

  if (error || !post) {
    logger.error('Failed to create post', { error: error?.message, userId });
    throw new AppError(500, 'Failed to create post');
  }

  logger.info('Post created', { postId: post.id, userId, campusId });
  return post;
}

const POST_SELECT = `
  id, author_id, content, image_urls, is_global, is_anonymous,
  upvotes, downvotes, comment_count, heat_score, created_at, campus_id,
  author:profiles!author_id(username, avatar_url),
  college:colleges!college_id(name)
`;

function buildPostResponse(
  post: any,
  feedType: 'campus' | 'global',
  viewerUserId: string,
  userVote: 'up' | 'down' | null
): PostResponse {
  const author = post.author as { username: string; avatar_url: string | null } | null;
  const collegeName = (post.college as { name: string } | null)?.name ?? 'Unknown';
  const display_author = maskAuthor(
    post.author_id,
    post.is_anonymous,
    viewerUserId,
    feedType,
    collegeName,
    author?.username ?? 'Unknown',
    author?.avatar_url ?? null
  );
  const { author_id: _aid, author: _a, college: _c, downvotes: _d, ...rest } = post;
  return { ...rest, display_author, user_vote: userVote };
}

export async function getFeed(
  options: FeedQuery & { feedType: 'campus' | 'global'; campusId: string; viewerUserId: string }
): Promise<PostResponse[]> {
  const { feedType, campusId, sort, page, limit, viewerUserId } = options;
  const offset = (page - 1) * limit;

  let query = supabaseAdmin.from('posts').select(POST_SELECT);

  if (feedType === 'campus') {
    query = query.eq('campus_id', campusId) as any;
  } else {
    query = query.eq('is_global', true) as any;
  }

  switch (sort) {
    case 'oldest':  query = query.order('created_at', { ascending: true }) as any; break;
    case 'upvoted': query = query.order('upvotes', { ascending: false }) as any; break;
    case 'trending':query = query.order('heat_score', { ascending: false }) as any; break;
    default:        query = query.order('created_at', { ascending: false }) as any; break;
  }

  const { data: posts, error } = await (query as any).range(offset, offset + limit - 1);

  if (error) {
    logger.error('Failed to fetch feed', { error: error.message, feedType });
    throw new AppError(500, 'Failed to fetch feed');
  }
  if (!posts || posts.length === 0) return [];

  const postIds = posts.map((p: any) => p.id);
  const { data: votes } = await supabaseAdmin
    .from('post_votes')
    .select('post_id, vote_type')
    .eq('user_id', viewerUserId)
    .in('post_id', postIds);

  const voteMap = new Map(votes?.map((v: any) => [v.post_id, v.vote_type as 'up' | 'down']));

  return posts.map((p: any) =>
    buildPostResponse(p, feedType, viewerUserId, voteMap.get(p.id) ?? null)
  );
}

export async function getPost(postId: string, viewerUserId: string): Promise<PostResponse> {
  const { data: post, error } = await supabaseAdmin
    .from('posts')
    .select(POST_SELECT)
    .eq('id', postId)
    .single();

  if (error || !post) throw new AppError(404, 'Post not found');

  const { data: voteRow } = await supabaseAdmin
    .from('post_votes')
    .select('vote_type')
    .eq('post_id', postId)
    .eq('user_id', viewerUserId)
    .single();

  const feedType = post.is_global ? 'global' as const : 'campus' as const;
  return buildPostResponse(post, feedType, viewerUserId, voteRow?.vote_type as 'up' | 'down' | null ?? null);
}

export async function deletePost(postId: string, userId: string, isAdmin: boolean): Promise<void> {
  const { data: post } = await supabaseAdmin
    .from('posts')
    .select('author_id')
    .eq('id', postId)
    .single();

  if (!post) throw new AppError(404, 'Post not found');
  if (post.author_id !== userId && !isAdmin) throw new AppError(403, 'Not authorized');

  await supabaseAdmin.from('posts').delete().eq('id', postId);
  logger.info('Post deleted', { postId, userId });
}

export async function castVote(
  postId: string,
  userId: string,
  voteType: 'up' | 'down' | null
): Promise<void> {
  const { data: post } = await supabaseAdmin
    .from('posts')
    .select('id, upvotes, downvotes, comment_count, created_at')
    .eq('id', postId)
    .single();

  if (!post) throw new AppError(404, 'Post not found');

  const { data: existing } = await supabaseAdmin
    .from('post_votes')
    .select('vote_type')
    .eq('post_id', postId)
    .eq('user_id', userId)
    .single();

  let { upvotes, downvotes } = post;

  if (voteType === null) {
    if (!existing) return;
    if (existing.vote_type === 'up') upvotes = Math.max(0, upvotes - 1);
    else downvotes = Math.max(0, downvotes - 1);
    await supabaseAdmin.from('post_votes').delete().eq('post_id', postId).eq('user_id', userId);
  } else if (!existing) {
    if (voteType === 'up') upvotes++;
    else downvotes++;
    await supabaseAdmin.from('post_votes').insert({ post_id: postId, user_id: userId, vote_type: voteType });
  } else if (existing.vote_type === voteType) {
    return;
  } else {
    if (voteType === 'up') { upvotes++; downvotes = Math.max(0, downvotes - 1); }
    else { downvotes++; upvotes = Math.max(0, upvotes - 1); }
    await supabaseAdmin.from('post_votes').update({ vote_type: voteType }).eq('post_id', postId).eq('user_id', userId);
  }

  const heat_score = computeHeatScore(upvotes, downvotes, post.comment_count, post.created_at);
  await supabaseAdmin.from('posts').update({ upvotes, downvotes, heat_score }).eq('id', postId);
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd peerly-backend
npx jest src/__tests__/posts.service.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Compile check**

```bash
cd peerly-backend
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
cd peerly-backend
git add src/modules/posts/posts.service.ts src/__tests__/posts.service.test.ts
git commit -m "feat: add posts service (CRUD, feed, voting, heat score)"
```

---

## Task 4: Posts Controller + Router

**Files:**
- Create: `peerly-backend/src/modules/posts/posts.controller.ts`
- Create: `peerly-backend/src/modules/posts/posts.router.ts`

- [ ] **Step 1: Create src/modules/posts/posts.controller.ts**

```typescript
import { Request, Response } from 'express';
import * as postsService from './posts.service';
import { feedQuerySchema } from './posts.types';

export async function createPost(req: Request, res: Response): Promise<void> {
  const post = await postsService.createPost(req.user.userId, req.user.campusId!, req.body);
  res.status(201).json(post);
}

export async function getCampusFeed(req: Request, res: Response): Promise<void> {
  const query = feedQuerySchema.parse(req.query);
  const posts = await postsService.getFeed({
    ...query,
    feedType: 'campus',
    campusId: req.user.campusId!,
    viewerUserId: req.user.userId,
  });
  res.json(posts);
}

export async function getGlobalFeed(req: Request, res: Response): Promise<void> {
  const query = feedQuerySchema.parse(req.query);
  const posts = await postsService.getFeed({
    ...query,
    feedType: 'global',
    campusId: req.user.campusId!,
    viewerUserId: req.user.userId,
  });
  res.json(posts);
}

export async function getPost(req: Request, res: Response): Promise<void> {
  const post = await postsService.getPost(req.params.id, req.user.userId);
  res.json(post);
}

export async function deletePost(req: Request, res: Response): Promise<void> {
  await postsService.deletePost(req.params.id, req.user.userId, req.user.isAdmin);
  res.status(204).send();
}

export async function vote(req: Request, res: Response): Promise<void> {
  await postsService.castVote(req.params.id, req.user.userId, req.body.vote_type);
  res.status(200).json({ ok: true });
}
```

- [ ] **Step 2: Create src/modules/posts/posts.router.ts**

```typescript
import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { validateBody } from '../../lib/validate';
import { createPostSchema, voteSchema } from './posts.types';
import * as controller from './posts.controller';

const router = Router();
router.use(authenticate);

router.get('/campus', controller.getCampusFeed);
router.get('/global', controller.getGlobalFeed);
router.get('/:id', controller.getPost);
router.post('/', validateBody(createPostSchema), controller.createPost);
router.delete('/:id', controller.deletePost);
router.post('/:id/vote', validateBody(voteSchema), controller.vote);

export default router;
```

- [ ] **Step 3: Compile check**

```bash
cd peerly-backend
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
cd peerly-backend
git add src/modules/posts/posts.controller.ts src/modules/posts/posts.router.ts
git commit -m "feat: add posts controller and router"
```

---

## Task 5: Comments Types

**Files:**
- Create: `peerly-backend/src/modules/comments/comments.types.ts`

- [ ] **Step 1: Create comments.types.ts**

```typescript
import { z } from 'zod';

export const addCommentSchema = z.object({
  content: z.string().min(1, 'Content is required').max(1000),
  parent_id: z.string().uuid('parent_id must be a valid UUID').optional(),
});

export type AddCommentBody = z.infer<typeof addCommentSchema>;

export interface CommentResponse {
  id: string;
  parent_id: string | null;
  depth: number;
  content: string;
  created_at: string;
  author: { username: string; avatar_url: string | null };
}
```

- [ ] **Step 2: Compile check**

```bash
cd peerly-backend
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd peerly-backend
git add src/modules/comments/comments.types.ts
git commit -m "feat: add comments types"
```

---

## Task 6: Comments Service (TDD)

**Files:**
- Create: `peerly-backend/src/__tests__/comments.service.test.ts`
- Create: `peerly-backend/src/modules/comments/comments.service.ts`

- [ ] **Step 1: Write failing tests**

Create `peerly-backend/src/__tests__/comments.service.test.ts`:

```typescript
import { supabaseAdmin } from '../lib/supabase';

jest.mock('../lib/supabase', () => ({
  supabaseAdmin: { from: jest.fn() },
}));

jest.mock('../lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

const mockFrom = supabaseAdmin.from as jest.Mock;

function chain(overrides: Record<string, any> = {}): any {
  const c: any = {
    select: () => c,
    eq: () => c,
    single: () => Promise.resolve({ data: null, error: null }),
    insert: () => c,
    update: () => c,
    delete: () => c,
    order: () => Promise.resolve({ data: [], error: null }),
    ...overrides,
  };
  return c;
}

const now = new Date().toISOString();

describe('addComment', () => {
  beforeEach(() => mockFrom.mockReset());

  it('throws 404 if post not found', async () => {
    const { addComment } = await import('../modules/comments/comments.service');
    mockFrom.mockReturnValue(chain());
    await expect(addComment('p1', 'u1', { content: 'hello' })).rejects.toMatchObject({ status: 404 });
  });

  it('throws 400 if parent_id does not belong to post', async () => {
    const { addComment } = await import('../modules/comments/comments.service');
    mockFrom
      .mockReturnValueOnce(chain({ single: () => Promise.resolve({ data: { id: 'p1', upvotes: 0, downvotes: 0, comment_count: 0, created_at: now }, error: null }) }))
      .mockReturnValueOnce(chain({ single: () => Promise.resolve({ data: { depth: 0, post_id: 'other-post' }, error: null }) }));

    await expect(addComment('p1', 'u1', { content: 'reply', parent_id: 'c1' })).rejects.toMatchObject({ status: 400, message: 'Invalid parent comment' });
  });

  it('sets depth = parent.depth + 1 for replies', async () => {
    const { addComment } = await import('../modules/comments/comments.service');
    let capturedDepth = -1;
    const fakeComment = { id: 'c2', parent_id: 'c1', depth: 2, content: 'reply', created_at: now, author: { username: 'alice', avatar_url: null } };

    mockFrom
      .mockReturnValueOnce(chain({ single: () => Promise.resolve({ data: { id: 'p1', upvotes: 0, downvotes: 0, comment_count: 0, created_at: now }, error: null }) }))
      .mockReturnValueOnce(chain({ single: () => Promise.resolve({ data: { depth: 1, post_id: 'p1' }, error: null }) }))
      .mockReturnValueOnce({
        insert: (data: any) => {
          capturedDepth = data.depth;
          return { select: () => ({ single: () => Promise.resolve({ data: fakeComment, error: null }) }) };
        },
      })
      .mockReturnValue(chain({ update: () => chain() }));

    await addComment('p1', 'u1', { content: 'reply', parent_id: 'c1' });
    expect(capturedDepth).toBe(2);
  });

  it('sets depth = 0 for top-level comments', async () => {
    const { addComment } = await import('../modules/comments/comments.service');
    let capturedDepth = -1;
    const fakeComment = { id: 'c1', parent_id: null, depth: 0, content: 'hello', created_at: now, author: { username: 'alice', avatar_url: null } };

    mockFrom
      .mockReturnValueOnce(chain({ single: () => Promise.resolve({ data: { id: 'p1', upvotes: 0, downvotes: 0, comment_count: 0, created_at: now }, error: null }) }))
      .mockReturnValueOnce({
        insert: (data: any) => {
          capturedDepth = data.depth;
          return { select: () => ({ single: () => Promise.resolve({ data: fakeComment, error: null }) }) };
        },
      })
      .mockReturnValue(chain({ update: () => chain() }));

    await addComment('p1', 'u1', { content: 'hello' });
    expect(capturedDepth).toBe(0);
  });
});

describe('deleteComment', () => {
  beforeEach(() => mockFrom.mockReset());

  it('throws 404 if comment not found', async () => {
    const { deleteComment } = await import('../modules/comments/comments.service');
    mockFrom.mockReturnValue(chain());
    await expect(deleteComment('c1', 'p1', 'u1', false)).rejects.toMatchObject({ status: 404 });
  });

  it('throws 403 if not owner and not admin', async () => {
    const { deleteComment } = await import('../modules/comments/comments.service');
    mockFrom.mockReturnValue(chain({ single: () => Promise.resolve({ data: { author_id: 'other', post_id: 'p1' }, error: null }) }));
    await expect(deleteComment('c1', 'p1', 'u1', false)).rejects.toMatchObject({ status: 403 });
  });

  it('allows admin to delete any comment', async () => {
    const { deleteComment } = await import('../modules/comments/comments.service');
    const postData = { upvotes: 0, downvotes: 0, comment_count: 2, created_at: now };

    mockFrom
      .mockReturnValueOnce(chain({ single: () => Promise.resolve({ data: { author_id: 'other', post_id: 'p1' }, error: null }) }))
      .mockReturnValueOnce(chain({ delete: () => chain() }))
      .mockReturnValue(chain({
        single: () => Promise.resolve({ data: postData, error: null }),
        update: () => chain(),
      }));

    await expect(deleteComment('c1', 'p1', 'admin', true)).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd peerly-backend
npx jest src/__tests__/comments.service.test.ts
```

Expected: FAIL — `Cannot find module '../modules/comments/comments.service'`

- [ ] **Step 3: Create src/modules/comments/comments.service.ts**

```typescript
import { supabaseAdmin } from '../../lib/supabase';
import { AppError } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { computeHeatScore } from '../posts/posts.service';
import { AddCommentBody, CommentResponse } from './comments.types';

export async function addComment(
  postId: string,
  userId: string,
  body: AddCommentBody
): Promise<CommentResponse> {
  const { data: post } = await supabaseAdmin
    .from('posts')
    .select('id, upvotes, downvotes, comment_count, created_at')
    .eq('id', postId)
    .single();

  if (!post) throw new AppError(404, 'Post not found');

  let depth = 0;
  if (body.parent_id) {
    const { data: parent } = await supabaseAdmin
      .from('comments')
      .select('depth, post_id')
      .eq('id', body.parent_id)
      .single();

    if (!parent || parent.post_id !== postId) {
      throw new AppError(400, 'Invalid parent comment');
    }
    depth = parent.depth + 1;
  }

  const { data: comment, error } = await supabaseAdmin
    .from('comments')
    .insert({
      post_id: postId,
      author_id: userId,
      parent_id: body.parent_id ?? null,
      content: body.content,
      depth,
    })
    .select(`id, parent_id, depth, content, created_at, author:profiles!author_id(username, avatar_url)`)
    .single();

  if (error || !comment) {
    logger.error('Failed to add comment', { error: error?.message, postId, userId });
    throw new AppError(500, 'Failed to add comment');
  }

  const newCount = post.comment_count + 1;
  const heat_score = computeHeatScore(post.upvotes, post.downvotes, newCount, post.created_at);
  await supabaseAdmin.from('posts').update({ comment_count: newCount, heat_score }).eq('id', postId);

  logger.info('Comment added', { commentId: comment.id, postId, userId });
  return comment as CommentResponse;
}

export async function getComments(postId: string): Promise<CommentResponse[]> {
  const { data, error } = await supabaseAdmin
    .from('comments')
    .select(`id, parent_id, depth, content, created_at, author:profiles!author_id(username, avatar_url)`)
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  if (error) {
    logger.error('Failed to fetch comments', { error: error.message, postId });
    throw new AppError(500, 'Failed to fetch comments');
  }

  return (data ?? []) as CommentResponse[];
}

export async function deleteComment(
  commentId: string,
  postId: string,
  userId: string,
  isAdmin: boolean
): Promise<void> {
  const { data: comment } = await supabaseAdmin
    .from('comments')
    .select('author_id, post_id')
    .eq('id', commentId)
    .single();

  if (!comment || comment.post_id !== postId) throw new AppError(404, 'Comment not found');
  if (comment.author_id !== userId && !isAdmin) throw new AppError(403, 'Not authorized');

  await supabaseAdmin.from('comments').delete().eq('id', commentId);

  const { data: post } = await supabaseAdmin
    .from('posts')
    .select('upvotes, downvotes, comment_count, created_at')
    .eq('id', postId)
    .single();

  if (post) {
    const newCount = Math.max(0, post.comment_count - 1);
    const heat_score = computeHeatScore(post.upvotes, post.downvotes, newCount, post.created_at);
    await supabaseAdmin.from('posts').update({ comment_count: newCount, heat_score }).eq('id', postId);
  }

  logger.info('Comment deleted', { commentId, postId, userId });
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd peerly-backend
npx jest src/__tests__/comments.service.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
cd peerly-backend
git add src/modules/comments/comments.service.ts src/__tests__/comments.service.test.ts
git commit -m "feat: add comments service (add, list, delete, depth tracking)"
```

---

## Task 7: Comments Controller + Router

**Files:**
- Create: `peerly-backend/src/modules/comments/comments.controller.ts`
- Create: `peerly-backend/src/modules/comments/comments.router.ts`

- [ ] **Step 1: Create src/modules/comments/comments.controller.ts**

```typescript
import { Request, Response } from 'express';
import * as commentsService from './comments.service';

export async function addComment(req: Request, res: Response): Promise<void> {
  const comment = await commentsService.addComment(req.params.postId, req.user.userId, req.body);
  res.status(201).json(comment);
}

export async function getComments(req: Request, res: Response): Promise<void> {
  const comments = await commentsService.getComments(req.params.postId);
  res.json(comments);
}

export async function deleteComment(req: Request, res: Response): Promise<void> {
  await commentsService.deleteComment(
    req.params.commentId,
    req.params.postId,
    req.user.userId,
    req.user.isAdmin
  );
  res.status(204).send();
}
```

- [ ] **Step 2: Create src/modules/comments/comments.router.ts**

```typescript
import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { validateBody } from '../../lib/validate';
import { addCommentSchema } from './comments.types';
import * as controller from './comments.controller';

const router = Router({ mergeParams: true });
router.use(authenticate);

router.get('/', controller.getComments);
router.post('/', validateBody(addCommentSchema), controller.addComment);
router.delete('/:commentId', controller.deleteComment);

export default router;
```

- [ ] **Step 3: Compile check**

```bash
cd peerly-backend
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
cd peerly-backend
git add src/modules/comments/comments.controller.ts src/modules/comments/comments.router.ts
git commit -m "feat: add comments controller and router"
```

---

## Task 8: Wire into app.ts + Run All Tests

**Files:**
- Modify: `peerly-backend/src/app.ts`

- [ ] **Step 1: Import and mount routers in app.ts**

Open `peerly-backend/src/app.ts`. Add these imports after the existing router imports:

```typescript
import postsRouter from './modules/posts/posts.router';
import commentsRouter from './modules/comments/comments.router';
```

Add these route mounts after the existing `app.use('/api/onboarding', onboardingRouter);` line:

```typescript
app.use('/api/posts', postsRouter);
app.use('/api/posts/:postId/comments', commentsRouter);
```

- [ ] **Step 2: Run all tests**

```bash
cd peerly-backend
npx jest
```

Expected: All test suites PASS (5 total: auth, admin, onboarding, posts, comments).

- [ ] **Step 3: Final compile check**

```bash
cd peerly-backend
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
cd peerly-backend
git add src/app.ts
git commit -m "feat: mount posts and comments routes in app"
```

---

## Task 9: End-to-End Smoke Test

> **Note:** Requires a running dev server connected to Supabase with the schema migration applied (Task 1 Step 2).

- [ ] **Step 1: Start dev server**

```bash
cd peerly-backend
npm run dev
```

Expected: `Server started { port: '5000', env: 'development' }`

- [ ] **Step 2: Login as admin and create college + domain + campus**

If not already done from auth smoke test:
```bash
# Login
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@peerly.app","password":"Admin@123456"}' | jq -r '.token')

# Create college
COLLEGE_ID=$(curl -s -X POST http://localhost:5000/api/admin/colleges \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"IIT Bombay"}' | jq -r '.id')

# Add domain
curl -s -X POST http://localhost:5000/api/admin/colleges/$COLLEGE_ID/domains \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"domain":"iitb.ac.in"}' | jq .

# Add campus
CAMPUS_ID=$(curl -s -X POST http://localhost:5000/api/admin/colleges/$COLLEGE_ID/campuses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Main Campus"}' | jq -r '.id')
```

- [ ] **Step 3: Register student and complete onboarding**

```bash
# Register
STUDENT_TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@iitb.ac.in","password":"Alice@123456"}' | jq -r '.token')

# Complete onboarding
STUDENT_TOKEN=$(curl -s -X POST http://localhost:5000/api/onboarding/complete \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  -d "{\"name\":\"Alice\",\"username\":\"alice_iitb\",\"campus_id\":\"$CAMPUS_ID\"}" | jq -r '.token')
```

- [ ] **Step 4: Create a post**

```bash
POST_ID=$(curl -s -X POST http://localhost:5000/api/posts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  -d '{"content":"Hello Peerly!","is_global":false,"is_anonymous":false,"image_urls":[]}' | jq -r '.id')

echo "Post ID: $POST_ID"
```

Expected: JSON with `id`, `content`, `upvotes: 0`, `comment_count: 0`.

- [ ] **Step 5: Fetch campus feed**

```bash
curl -s "http://localhost:5000/api/posts/campus?sort=latest" \
  -H "Authorization: Bearer $STUDENT_TOKEN" | jq .
```

Expected: Array with the post. `display_author.username` = `"alice_iitb"`.

- [ ] **Step 6: Upvote the post**

```bash
curl -s -X POST http://localhost:5000/api/posts/$POST_ID/vote \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  -d '{"vote_type":"up"}' | jq .
```

Expected: `{"ok":true}`. Post's `upvotes` should now be 1.

- [ ] **Step 7: Add a comment**

```bash
COMMENT_ID=$(curl -s -X POST http://localhost:5000/api/posts/$POST_ID/comments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  -d '{"content":"Great post!"}' | jq -r '.id')
```

Expected: JSON with `depth: 0`, `parent_id: null`, `author.username: "alice_iitb"`.

- [ ] **Step 8: Add a reply**

```bash
curl -s -X POST http://localhost:5000/api/posts/$POST_ID/comments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  -d "{\"content\":\"Thanks!\",\"parent_id\":\"$COMMENT_ID\"}" | jq .
```

Expected: JSON with `depth: 1`, `parent_id: "<COMMENT_ID>"`.

- [ ] **Step 9: Fetch all comments**

```bash
curl -s http://localhost:5000/api/posts/$POST_ID/comments \
  -H "Authorization: Bearer $STUDENT_TOKEN" | jq .
```

Expected: Array of 2 comments ordered by `created_at`.

- [ ] **Step 10: Create anonymous global post and verify masking**

```bash
ANON_POST_ID=$(curl -s -X POST http://localhost:5000/api/posts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  -d '{"content":"Anonymous thought","is_global":true,"is_anonymous":true,"image_urls":[]}' | jq -r '.id')

curl -s "http://localhost:5000/api/posts/global?sort=latest" \
  -H "Authorization: Bearer $STUDENT_TOKEN" | jq '.[0].display_author'
```

Expected: `{ "username": "Anonymous @ IIT Bombay", "avatar_url": null }`

- [ ] **Step 11: Final commit**

```bash
cd peerly-backend
git add -A
git commit -m "chore: complete feed + posts + comments backend implementation"
```

---

## Self-Review Notes

- All spec endpoints covered: campus feed, global feed, get post, create post, delete post, vote, get comments, add comment, delete comment ✓
- `downvotes` never returned to client ✓
- `author_id` stripped from PostResponse ✓
- Heat score recomputed on vote + comment events ✓
- Anonymous masking: campus = "Anonymous Peer", global = "Anonymous @ college" ✓
- Own posts always unmasked ✓
- Comment depth: actual depth stored, no cap on backend ✓
- Vote idempotency: same type = no-op, null with no vote = no-op ✓
- Ownership checks on delete (403 if not owner and not admin) ✓
- `college_id` denormalized on post for efficient masking join ✓
- `posts.author_id` references `profiles(id)` for Supabase join ✓
