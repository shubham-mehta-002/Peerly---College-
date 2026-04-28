# Report Post Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users report posts with a fixed reason + optional custom text, show a "Reported" badge after reporting, and give admins a Reports tab to review and hide flagged posts.

**Architecture:** New `post_reports` table stores individual reports; `posts.report_count` and `posts.is_hidden` are denormalized for fast admin queries. A new `reports` backend module handles user reporting and admin moderation. Frontend adds a shared `ReportModal` component used on both the post card and detail page.

**Tech Stack:** Express 5 + TypeScript, Supabase (PostgreSQL), Zod validation, Next.js 16 + React 19, TanStack Query

---

## File Map

**Create:**
- `peerly-backend/supabase/migrations/20260428_post_reports.sql`
- `peerly-backend/src/modules/reports/reports.types.ts`
- `peerly-backend/src/modules/reports/reports.service.ts`
- `peerly-backend/src/modules/reports/reports.controller.ts`
- `peerly-backend/src/modules/reports/reports.router.ts`
- `peerly-backend/src/__tests__/reports.service.test.ts`
- `peerly-frontend/components/ui/report-modal.tsx`
- `peerly-frontend/lib/hooks/useReports.ts`

**Modify:**
- `peerly-backend/src/modules/posts/posts.types.ts` — add `is_hidden`, `user_has_reported` to `PostResponse`
- `peerly-backend/src/modules/posts/posts.service.ts` — update `POST_SELECT`, `buildPostResponse`, `getFeed`, `getPost`
- `peerly-backend/src/modules/admin/admin.router.ts` — add reports + hide-post routes
- `peerly-backend/src/app.ts` — mount reports router
- `peerly-frontend/lib/hooks/useFeed.ts` — add `is_hidden`, `user_has_reported` to `PostResponse`
- `peerly-frontend/components/post-card.tsx` — add ⋯ menu, Reported badge
- `peerly-frontend/app/posts/[id]/page.tsx` — report button, "Removed by admin" state, Reported badge
- `peerly-frontend/app/admin/page.tsx` — add Reports tab

---

### Task 1: DB Migration

**Files:**
- Create: `peerly-backend/supabase/migrations/20260428_post_reports.sql`

- [ ] **Step 1: Create migration file**

```sql
-- peerly-backend/supabase/migrations/20260428_post_reports.sql
ALTER TABLE posts ADD COLUMN is_hidden BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE posts ADD COLUMN report_count INT NOT NULL DEFAULT 0;

CREATE TABLE post_reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason      TEXT NOT NULL CHECK (reason IN ('spam','harassment','misinformation','inappropriate','other')),
  custom_text TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, reporter_id)
);
```

- [ ] **Step 2: Run migration in Supabase SQL Editor**

Open Supabase dashboard → SQL Editor → paste the entire file content and run.

Expected: no errors, `ALTER TABLE` and `CREATE TABLE` succeed.

- [ ] **Step 3: Verify**

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'posts' AND column_name IN ('is_hidden', 'report_count');

SELECT table_name FROM information_schema.tables WHERE table_name = 'post_reports';
```

Expected: 2 rows from first query, 1 row from second.

- [ ] **Step 4: Commit**

```bash
git add peerly-backend/supabase/migrations/20260428_post_reports.sql
git commit -m "db: add post_reports table and is_hidden/report_count to posts"
```

---

### Task 2: Backend types

**Files:**
- Create: `peerly-backend/src/modules/reports/reports.types.ts`
- Modify: `peerly-backend/src/modules/posts/posts.types.ts`

- [ ] **Step 1: Create `reports.types.ts`**

```ts
import { z } from 'zod';

export const REPORT_REASONS = ['spam', 'harassment', 'misinformation', 'inappropriate', 'other'] as const;
export type ReportReason = typeof REPORT_REASONS[number];

export const ReportPostSchema = z.object({
  reason: z.enum(REPORT_REASONS),
  custom_text: z.string().min(1).max(500).optional(),
}).refine(
  data => data.reason !== 'other' || (data.custom_text && data.custom_text.trim().length > 0),
  { message: 'custom_text is required when reason is "other"', path: ['custom_text'] }
);

export const AdminReportsQuerySchema = z.object({
  reason: z.enum(REPORT_REASONS).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type ReportPostBody = z.infer<typeof ReportPostSchema>;
export type AdminReportsQuery = z.infer<typeof AdminReportsQuerySchema>;

export interface PostReportSummary {
  id: string;
  content: string;
  author: { username: string; name: string | null; avatar_url: string | null };
  created_at: string;
  report_count: number;
  is_hidden: boolean;
  reason_breakdown: Record<string, number>;
}
```

- [ ] **Step 2: Update `PostResponse` in `posts.types.ts`**

Find:
```ts
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

Replace with:
```ts
export interface PostResponse {
  id: string;
  content: string;
  image_urls: string[];
  is_global: boolean;
  is_anonymous: boolean;
  is_hidden: boolean;
  upvotes: number;
  comment_count: number;
  heat_score: number;
  created_at: string;
  campus_id: string;
  display_author: DisplayAuthor;
  user_vote: 'up' | 'down' | null;
  user_has_reported: boolean;
}
```

- [ ] **Step 3: Verify build**

```bash
cd peerly-backend && npm run build 2>&1 | tail -10
```

Expected: TypeScript errors about `buildPostResponse` missing the new fields — these will be fixed in Task 5. For now just confirm the types file itself compiles (ignore downstream errors).

- [ ] **Step 4: Commit**

```bash
git add peerly-backend/src/modules/reports/reports.types.ts \
        peerly-backend/src/modules/posts/posts.types.ts
git commit -m "feat(reports): add report types and extend PostResponse with is_hidden/user_has_reported"
```

---

### Task 3: Backend `reports.service.ts` + tests

**Files:**
- Create: `peerly-backend/src/modules/reports/reports.service.ts`
- Create: `peerly-backend/src/__tests__/reports.service.test.ts`

- [ ] **Step 1: Write failing tests**

Create `peerly-backend/src/__tests__/reports.service.test.ts`:

```ts
import { supabaseAdmin } from '../lib/supabase';

jest.mock('../lib/supabase', () => ({
  supabaseAdmin: { from: jest.fn() },
}));
jest.mock('../lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

const mockFrom = supabaseAdmin.from as jest.Mock;

function chain(overrides: Record<string, unknown> = {}): unknown {
  const c: Record<string, unknown> = {
    select: () => c, eq: () => c, in: () => c, gt: () => c, order: () => c,
    single: () => Promise.resolve({ data: null, error: null }),
    insert: () => c, update: () => c, delete: () => c,
    range: () => Promise.resolve({ data: [], error: null }),
    ...overrides,
  };
  return c;
}

describe('createReport', () => {
  it('throws 404 when post not found', async () => {
    const { createReport } = await import('../modules/reports/reports.service.js');
    mockFrom.mockImplementation(() =>
      chain({ single: () => Promise.resolve({ data: null, error: { code: 'PGRST116' } }) })
    );
    await expect(createReport('post-1', 'user-1', 'spam')).rejects.toMatchObject({ status: 404 });
  });

  it('throws 409 when already reported', async () => {
    jest.resetModules();
    const { createReport } = await import('../modules/reports/reports.service.js');
    mockFrom.mockImplementation((table: string) => {
      if (table === 'posts') return chain({ single: () => Promise.resolve({ data: { id: 'post-1', report_count: 2 }, error: null }) });
      if (table === 'post_reports') return chain({ insert: () => Promise.resolve({ error: { code: '23505' } }) });
      return chain();
    });
    await expect(createReport('post-1', 'user-1', 'spam')).rejects.toMatchObject({ status: 409 });
  });

  it('inserts report and increments report_count', async () => {
    jest.resetModules();
    const { createReport } = await import('../modules/reports/reports.service.js');
    let updateCalled = false;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'posts') return chain({
        single: () => Promise.resolve({ data: { id: 'post-1', report_count: 0 }, error: null }),
        update: () => chain({ eq: () => { updateCalled = true; return Promise.resolve({ error: null }); } }),
      });
      if (table === 'post_reports') return chain({ insert: () => Promise.resolve({ error: null }) });
      return chain();
    });
    await createReport('post-1', 'user-1', 'spam');
    expect(updateCalled).toBe(true);
  });
});

describe('hidePost', () => {
  it('throws 404 when post not found', async () => {
    jest.resetModules();
    const { hidePost } = await import('../modules/reports/reports.service.js');
    mockFrom.mockImplementation(() =>
      chain({ single: () => Promise.resolve({ data: null, error: { message: 'not found' } }) })
    );
    await expect(hidePost('post-1')).rejects.toMatchObject({ status: 404 });
  });

  it('sets is_hidden to true', async () => {
    jest.resetModules();
    const { hidePost } = await import('../modules/reports/reports.service.js');
    let hideCalled = false;
    mockFrom.mockImplementation(() =>
      chain({
        single: () => { hideCalled = true; return Promise.resolve({ data: { id: 'post-1' }, error: null }); }
      })
    );
    await hidePost('post-1');
    expect(hideCalled).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd peerly-backend && npx jest reports.service --no-coverage 2>&1 | tail -10
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `reports.service.ts`**

Create `peerly-backend/src/modules/reports/reports.service.ts`:

```ts
import { supabaseAdmin } from '../../lib/supabase';
import { AppError } from '../../lib/errors';
import type { ReportReason, PostReportSummary, AdminReportsQuery } from './reports.types';

export async function createReport(
  postId: string,
  reporterId: string,
  reason: ReportReason,
  customText?: string
): Promise<void> {
  const { data: post, error: postErr } = await supabaseAdmin
    .from('posts')
    .select('id, report_count')
    .eq('id', postId)
    .single();

  if (postErr || !post) throw new AppError(404, 'Post not found');

  const { error: insertError } = await supabaseAdmin
    .from('post_reports')
    .insert({ post_id: postId, reporter_id: reporterId, reason, custom_text: customText ?? null });

  if (insertError) {
    if (insertError.code === '23505') throw new AppError(409, 'You have already reported this post');
    throw new AppError(500, 'Failed to submit report');
  }

  await supabaseAdmin
    .from('posts')
    .update({ report_count: (post as { report_count: number }).report_count + 1 })
    .eq('id', postId);
}

export async function getAdminReports(options: AdminReportsQuery): Promise<PostReportSummary[]> {
  const { reason, page, limit } = options;
  const offset = (page - 1) * limit;

  let postIds: string[] | null = null;

  if (reason) {
    const { data: reported } = await supabaseAdmin
      .from('post_reports')
      .select('post_id')
      .eq('reason', reason);
    postIds = [...new Set((reported ?? []).map((r: { post_id: string }) => r.post_id))];
    if (postIds.length === 0) return [];
  }

  let query = supabaseAdmin
    .from('posts')
    .select('id, content, report_count, is_hidden, created_at, author:profiles!author_id(username, name, avatar_url)')
    .gt('report_count', 0)
    .order('report_count', { ascending: false });

  if (postIds) query = (query as any).in('id', postIds);

  const { data: posts, error } = await (query as any).range(offset, offset + limit - 1);
  if (error) throw new AppError(500, 'Failed to fetch reports');
  if (!posts || posts.length === 0) return [];

  const ids = (posts as { id: string }[]).map(p => p.id);
  const { data: reasons } = await supabaseAdmin
    .from('post_reports')
    .select('post_id, reason')
    .in('post_id', ids);

  const breakdownMap = new Map<string, Record<string, number>>();
  for (const r of (reasons ?? []) as { post_id: string; reason: string }[]) {
    if (!breakdownMap.has(r.post_id)) breakdownMap.set(r.post_id, {});
    const bd = breakdownMap.get(r.post_id)!;
    bd[r.reason] = (bd[r.reason] ?? 0) + 1;
  }

  return (posts as any[]).map(p => {
    const author = p.author as { username: string; name: string | null; avatar_url: string | null } | null;
    return {
      id: p.id,
      content: p.content,
      author: { username: author?.username ?? 'Unknown', name: author?.name ?? null, avatar_url: author?.avatar_url ?? null },
      created_at: p.created_at,
      report_count: p.report_count,
      is_hidden: p.is_hidden,
      reason_breakdown: breakdownMap.get(p.id) ?? {},
    };
  });
}

export async function hidePost(postId: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from('posts')
    .update({ is_hidden: true })
    .eq('id', postId)
    .select('id')
    .single();

  if (error || !data) throw new AppError(404, 'Post not found');
}
```

- [ ] **Step 4: Run tests — all should pass**

```bash
cd peerly-backend && npx jest reports.service --no-coverage 2>&1 | tail -15
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add peerly-backend/src/modules/reports/reports.service.ts \
        peerly-backend/src/__tests__/reports.service.test.ts
git commit -m "feat(reports): reports service with createReport, getAdminReports, hidePost"
```

---

### Task 4: Backend `reports.controller.ts` + `reports.router.ts`

**Files:**
- Create: `peerly-backend/src/modules/reports/reports.controller.ts`
- Create: `peerly-backend/src/modules/reports/reports.router.ts`

- [ ] **Step 1: Create `reports.controller.ts`**

```ts
import type { Request, Response } from 'express';
import { createReport, getAdminReports, hidePost } from './reports.service';
import { ReportPostSchema, AdminReportsQuerySchema } from './reports.types';

export async function reportPostHandler(req: Request, res: Response): Promise<void> {
  const parsed = ReportPostSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', errors: parsed.error.issues });
    return;
  }
  await createReport(req.params.id as string, req.user.userId, parsed.data.reason, parsed.data.custom_text);
  res.json({ success: true });
}

export async function getAdminReportsHandler(req: Request, res: Response): Promise<void> {
  const parsed = AdminReportsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid query params', errors: parsed.error.issues });
    return;
  }
  const reports = await getAdminReports(parsed.data);
  res.json(reports);
}

export async function hidePostHandler(req: Request, res: Response): Promise<void> {
  await hidePost(req.params.id as string);
  res.json({ success: true });
}
```

- [ ] **Step 2: Create `reports.router.ts`**

```ts
import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { reportPostHandler } from './reports.controller';

const router = Router();
router.use(authenticate);
router.post('/:id/report', reportPostHandler);

export default router;
```

- [ ] **Step 3: Verify build**

```bash
cd peerly-backend && npm run build 2>&1 | tail -10
```

Expected: no errors in the reports module files (posts.service.ts errors still present — fixed in Task 5).

- [ ] **Step 4: Commit**

```bash
git add peerly-backend/src/modules/reports/reports.controller.ts \
        peerly-backend/src/modules/reports/reports.router.ts
git commit -m "feat(reports): reports controller and router"
```

---

### Task 5: Update `posts.service.ts`

**Files:**
- Modify: `peerly-backend/src/modules/posts/posts.service.ts`

- [ ] **Step 1: Update `POST_SELECT` to include `is_hidden`**

Find:
```ts
const POST_SELECT = `
  id, author_id, content, image_urls, is_global, is_anonymous,
  upvotes, downvotes, comment_count, heat_score, created_at, campus_id,
  author:profiles!author_id(username, name, avatar_url),
  college:colleges!college_id(name)
`;
```

Replace with:
```ts
const POST_SELECT = `
  id, author_id, content, image_urls, is_global, is_anonymous, is_hidden,
  upvotes, downvotes, comment_count, heat_score, created_at, campus_id,
  author:profiles!author_id(username, name, avatar_url),
  college:colleges!college_id(name)
`;
```

- [ ] **Step 2: Update `buildPostResponse` signature to accept `userHasReported`**

Find:
```ts
function buildPostResponse(
  post: any,
  feedType: 'campus' | 'global',
  viewerUserId: string,
  userVote: 'up' | 'down' | null
): PostResponse {
  const author = post.author as { username: string; name: string | null; avatar_url: string | null } | null;
  const collegeName = (post.college as { name: string } | null)?.name ?? 'Unknown';
  const display_author = maskAuthor(
    post.author_id,
    post.is_anonymous,
    viewerUserId,
    feedType,
    collegeName,
    author?.username ?? 'Unknown',
    author?.name ?? null,
    author?.avatar_url ?? null
  );
  const { author_id: _aid, author: _a, college: _c, downvotes: _d, ...rest } = post;
  return { ...rest, display_author, user_vote: userVote };
}
```

Replace with:
```ts
function buildPostResponse(
  post: any,
  feedType: 'campus' | 'global',
  viewerUserId: string,
  userVote: 'up' | 'down' | null,
  userHasReported: boolean
): PostResponse {
  const author = post.author as { username: string; name: string | null; avatar_url: string | null } | null;
  const collegeName = (post.college as { name: string } | null)?.name ?? 'Unknown';
  const display_author = maskAuthor(
    post.author_id,
    post.is_anonymous,
    viewerUserId,
    feedType,
    collegeName,
    author?.username ?? 'Unknown',
    author?.name ?? null,
    author?.avatar_url ?? null
  );
  const { author_id: _aid, author: _a, college: _c, downvotes: _d, ...rest } = post;
  return { ...rest, display_author, user_vote: userVote, user_has_reported: userHasReported };
}
```

- [ ] **Step 3: Update `getFeed` — filter hidden posts + batch-fetch user reports**

In `getFeed`, find the two lines that set up the feedType filter:
```ts
  if (feedType === 'campus') {
    query = query.eq('campus_id', campusId) as any;
  } else {
    query = query.eq('is_global', true) as any;
  }
```

Replace with:
```ts
  if (feedType === 'campus') {
    query = query.eq('campus_id', campusId) as any;
  } else {
    query = query.eq('is_global', true) as any;
  }
  query = query.eq('is_hidden', false) as any;
```

Then find the voteMap creation and the `return posts.map` line:
```ts
  const voteMap = new Map(votes?.map((v: any) => [v.post_id, v.vote_type as 'up' | 'down']));

  return posts.map((p: any) =>
    buildPostResponse(p, feedType, viewerUserId, voteMap.get(p.id) ?? null)
  );
```

Replace with:
```ts
  const voteMap = new Map(votes?.map((v: any) => [v.post_id, v.vote_type as 'up' | 'down']));

  const { data: reportedRows } = await supabaseAdmin
    .from('post_reports')
    .select('post_id')
    .eq('reporter_id', viewerUserId)
    .in('post_id', postIds);

  const reportedSet = new Set((reportedRows ?? []).map((r: any) => r.post_id as string));

  return posts.map((p: any) =>
    buildPostResponse(p, feedType, viewerUserId, voteMap.get(p.id) ?? null, reportedSet.has(p.id))
  );
```

- [ ] **Step 4: Update `getPost` — add `user_has_reported` query**

Find the block inside `getPost` after the voteRow query:
```ts
  const feedType = post.is_global ? 'global' as const : 'campus' as const;
  return buildPostResponse(post, feedType, viewerUserId, voteRow?.vote_type as 'up' | 'down' | null ?? null);
```

Replace with:
```ts
  const { data: reportRow } = await supabaseAdmin
    .from('post_reports')
    .select('post_id')
    .eq('post_id', postId)
    .eq('reporter_id', viewerUserId)
    .single();

  const feedType = post.is_global ? 'global' as const : 'campus' as const;
  return buildPostResponse(post, feedType, viewerUserId, voteRow?.vote_type as 'up' | 'down' | null ?? null, !!reportRow);
```

- [ ] **Step 5: Verify build passes cleanly**

```bash
cd peerly-backend && npm run build 2>&1 | tail -10
```

Expected: no TypeScript errors.

- [ ] **Step 6: Run all backend tests**

```bash
cd peerly-backend && npx jest --no-coverage 2>&1 | tail -15
```

Expected: reports.service tests pass, no new failures in posts.service tests.

- [ ] **Step 7: Commit**

```bash
git add peerly-backend/src/modules/posts/posts.service.ts
git commit -m "feat(reports): filter hidden posts from feeds, add user_has_reported to PostResponse"
```

---

### Task 6: Wire routes in `app.ts` and `admin.router.ts`

**Files:**
- Modify: `peerly-backend/src/app.ts`
- Modify: `peerly-backend/src/modules/admin/admin.router.ts`

- [ ] **Step 1: Mount reports router in `app.ts`**

In `peerly-backend/src/app.ts`, add import after existing router imports:
```ts
import reportsRouter from './modules/reports/reports.router';
```

Then add mount after `app.use('/api/posts', postsRouter)` (line 59):
```ts
app.use('/api/posts', reportsRouter);
```

- [ ] **Step 2: Add admin report routes to `admin.router.ts`**

In `peerly-backend/src/modules/admin/admin.router.ts`, add import:
```ts
import { getAdminReportsHandler, hidePostHandler } from '../reports/reports.controller';
```

Then add these two routes before `export default router`:
```ts
router.get('/reports', getAdminReportsHandler);
router.patch('/posts/:id/hide', hidePostHandler);
```

The full file should look like:
```ts
import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireAdmin } from '../../middleware/requireAdmin';
import { validateBody } from '../../lib/validate';
import {
  createCollegeSchema, updateCollegeSchema,
  createDomainSchema, updateDomainSchema,
  createCampusSchema, updateCampusSchema,
} from './admin.types';
import * as controller from './admin.controller';
import { getAdminReportsHandler, hidePostHandler } from '../reports/reports.controller';

const router = Router();
router.use(authenticate, requireAdmin);

router.post('/colleges', validateBody(createCollegeSchema), controller.createCollege);
router.get('/colleges', controller.listColleges);
router.patch('/colleges/:id', validateBody(updateCollegeSchema), controller.updateCollege);

router.get('/colleges/:id/domains', controller.listDomains);
router.post('/colleges/:id/domains', validateBody(createDomainSchema), controller.createDomain);
router.patch('/colleges/:id/domains/:domainId', validateBody(updateDomainSchema), controller.updateDomain);

router.post('/colleges/:id/campuses', validateBody(createCampusSchema), controller.createCampus);
router.get('/colleges/:id/campuses', controller.listCampuses);
router.patch('/colleges/:id/campuses/:campusId', validateBody(updateCampusSchema), controller.updateCampus);

router.get('/reports', getAdminReportsHandler);
router.patch('/posts/:id/hide', hidePostHandler);

export default router;
```

- [ ] **Step 3: Verify build**

```bash
cd peerly-backend && npm run build 2>&1 | tail -5
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add peerly-backend/src/app.ts \
        peerly-backend/src/modules/admin/admin.router.ts
git commit -m "feat(reports): mount report routes and admin report/hide endpoints"
```

---

### Task 7: Frontend types + `useReports.ts` hook

**Files:**
- Modify: `peerly-frontend/lib/hooks/useFeed.ts`
- Create: `peerly-frontend/lib/hooks/useReports.ts`

- [ ] **Step 1: Update `PostResponse` in `useFeed.ts`**

Find:
```ts
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
  display_author: { username: string; name: string | null; avatar_url: string | null };
  user_vote: 'up' | 'down' | null;
}
```

Replace with:
```ts
export interface PostResponse {
  id: string;
  content: string;
  image_urls: string[];
  is_global: boolean;
  is_anonymous: boolean;
  is_hidden: boolean;
  upvotes: number;
  comment_count: number;
  heat_score: number;
  created_at: string;
  campus_id: string;
  display_author: { username: string; name: string | null; avatar_url: string | null };
  user_vote: 'up' | 'down' | null;
  user_has_reported: boolean;
}
```

- [ ] **Step 2: Create `useReports.ts`**

```ts
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export interface PostReportSummary {
  id: string;
  content: string;
  author: { username: string; name: string | null; avatar_url: string | null };
  created_at: string;
  report_count: number;
  is_hidden: boolean;
  reason_breakdown: Record<string, number>;
}

export function useReportPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, reason, customText }: { postId: string; reason: string; customText?: string }) =>
      api.post(`/api/posts/${postId}/report`, { reason, custom_text: customText }),
    onSuccess: (_data, { postId }) => {
      qc.invalidateQueries({ queryKey: ['post', postId] });
      qc.invalidateQueries({ queryKey: ['feed'] });
    },
  });
}

export function useAdminReports(reason?: string, page = 1) {
  return useQuery<PostReportSummary[]>({
    queryKey: ['admin-reports', reason ?? 'all', page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (reason) params.set('reason', reason);
      return api.get(`/api/admin/reports?${params}`).then(r => r.data);
    },
  });
}

export function useHidePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (postId: string) => api.patch(`/api/admin/posts/${postId}/hide`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-reports'] }),
  });
}
```

- [ ] **Step 3: Verify lint**

```bash
cd peerly-frontend && npm run lint 2>&1 | grep -E "useReports|useFeed" | head -10
```

Expected: no errors in these files.

- [ ] **Step 4: Commit**

```bash
git add peerly-frontend/lib/hooks/useFeed.ts \
        peerly-frontend/lib/hooks/useReports.ts
git commit -m "feat(reports): frontend PostResponse types and useReports hook"
```

---

### Task 8: Frontend `report-modal.tsx`

**Files:**
- Create: `peerly-frontend/components/ui/report-modal.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client';

import { useState } from 'react';
import { useReportPost } from '@/lib/hooks/useReports';

const REASONS = [
  { value: 'spam',          label: 'Spam' },
  { value: 'harassment',    label: 'Harassment' },
  { value: 'misinformation',label: 'Misinformation' },
  { value: 'inappropriate', label: 'Inappropriate content' },
  { value: 'other',         label: 'Other' },
] as const;

type Reason = typeof REASONS[number]['value'];

interface ReportModalProps {
  postId: string;
  onClose: () => void;
}

export function ReportModal({ postId, onClose }: ReportModalProps) {
  const [reason, setReason] = useState<Reason | null>(null);
  const [customText, setCustomText] = useState('');
  const [error, setError] = useState('');
  const report = useReportPost();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) { setError('Select a reason'); return; }
    if (reason === 'other' && !customText.trim()) { setError('Please describe the issue'); return; }
    setError('');
    try {
      await report.mutateAsync({ postId, reason, customText: reason === 'other' ? customText.trim() : undefined });
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'Failed to submit report');
    }
  };

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, maxWidth: 380, width: '100%' }}
      >
        <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600, color: 'var(--foreground)' }}>Report post</h3>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            {REASONS.map(r => (
              <label key={r.value} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14, color: 'var(--foreground)' }}>
                <input
                  type="radio"
                  name="reason"
                  value={r.value}
                  checked={reason === r.value}
                  onChange={() => setReason(r.value)}
                  style={{ cursor: 'pointer' }}
                />
                {r.label}
              </label>
            ))}
          </div>
          {reason === 'other' && (
            <textarea
              value={customText}
              onChange={e => setCustomText(e.target.value)}
              placeholder="Describe the issue…"
              maxLength={500}
              style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 7, fontSize: 14, color: 'var(--foreground)', fontFamily: 'inherit', resize: 'vertical', minHeight: 80, marginBottom: 12, outline: 'none' }}
            />
          )}
          {error && <div style={{ fontSize: 13, color: '#C0392B', marginBottom: 10 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{ padding: '8px 16px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
              Cancel
            </button>
            <button type="submit" disabled={report.isPending} style={{ padding: '8px 16px', borderRadius: 7, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: report.isPending ? 0.6 : 1 }}>
              {report.isPending ? 'Submitting…' : 'Submit report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify lint**

```bash
cd peerly-frontend && npm run lint 2>&1 | grep "report-modal" | head -5
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add peerly-frontend/components/ui/report-modal.tsx
git commit -m "feat(reports): ReportModal component with reason radios and custom text"
```

---

### Task 9: Frontend `post-card.tsx` — ⋯ menu + Reported badge

**Files:**
- Modify: `peerly-frontend/components/post-card.tsx`

The current post-card has no ⋯ menu. We add one with a "Report" option and a "Reported" badge.

- [ ] **Step 1: Add import for `ReportModal` and `useState`**

Find the imports at the top of `peerly-frontend/components/post-card.tsx`:
```ts
'use client';

import { useTweaks } from '@/lib/context';
import { Avatar } from './ui/avatar';
import { AnonLabel } from './ui/anon-label';
import { ImageCarousel } from './ui/image-carousel';
import { formatRelativeTime } from '@/lib/time';
import { usePostVote, type PostResponse } from '@/lib/hooks/useFeed';
```

Replace with:
```ts
'use client';

import { useState } from 'react';
import { useTweaks } from '@/lib/context';
import { Avatar } from './ui/avatar';
import { AnonLabel } from './ui/anon-label';
import { ImageCarousel } from './ui/image-carousel';
import { formatRelativeTime } from '@/lib/time';
import { usePostVote, type PostResponse } from '@/lib/hooks/useFeed';
import { ReportModal } from './ui/report-modal';
```

- [ ] **Step 2: Add `showMenu` and `showReport` state inside `PostCard`**

Find inside `PostCard`:
```ts
  const { cardLayout } = useTweaks();
  const { localVote, localUpvotes, handleVote } = usePostVote(post);
```

Replace with:
```ts
  const { cardLayout } = useTweaks();
  const { localVote, localUpvotes, handleVote } = usePostVote(post);
  const [showMenu, setShowMenu] = useState(false);
  const [showReport, setShowReport] = useState(false);
```

- [ ] **Step 3: Add ⋯ menu button + Reported badge to the action bar**

Find the action bar at the bottom of the card JSX:
```tsx
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <button
          onClick={e => { e.stopPropagation(); handleVote('up'); }}
          style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', color: localVote === 'up' ? 'var(--accent)' : 'var(--muted)', fontSize: 13, padding: 0, fontFamily: 'inherit', fontWeight: localVote === 'up' ? 600 : 400 }}
        >↑ {localUpvotes}</button>
        <button
          onClick={e => { e.stopPropagation(); handleVote('down'); }}
          style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', color: localVote === 'down' ? '#C0392B' : 'var(--muted)', fontSize: 13, padding: 0, fontFamily: 'inherit' }}
        >↓</button>
        <span style={{ color: 'var(--muted)', fontSize: 13 }}>💬 {post.comment_count}</span>
        {trending && <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Trending</span>}
      </div>
```

Replace with:
```tsx
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <button
          onClick={e => { e.stopPropagation(); handleVote('up'); }}
          style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', color: localVote === 'up' ? 'var(--accent)' : 'var(--muted)', fontSize: 13, padding: 0, fontFamily: 'inherit', fontWeight: localVote === 'up' ? 600 : 400 }}
        >↑ {localUpvotes}</button>
        <button
          onClick={e => { e.stopPropagation(); handleVote('down'); }}
          style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', color: localVote === 'down' ? '#C0392B' : 'var(--muted)', fontSize: 13, padding: 0, fontFamily: 'inherit' }}
        >↓</button>
        <span style={{ color: 'var(--muted)', fontSize: 13 }}>💬 {post.comment_count}</span>
        {trending && <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Trending</span>}
        <div style={{ marginLeft: 'auto', position: 'relative' }}>
          {post.user_has_reported && (
            <span style={{ fontSize: 11, color: 'var(--muted)', marginRight: 8, fontWeight: 500 }}>Reported</span>
          )}
          <button
            onClick={e => { e.stopPropagation(); setShowMenu(v => !v); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 16, padding: '0 4px', lineHeight: 1 }}
          >⋯</button>
          {showMenu && (
            <>
              <div onClick={e => { e.stopPropagation(); setShowMenu(false); }} style={{ position: 'fixed', inset: 0, zIndex: 20 }} />
              <div style={{ position: 'absolute', right: 0, top: '100%', zIndex: 30, marginTop: 4, background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', minWidth: 130, overflow: 'hidden' }}>
                <button
                  onClick={e => { e.stopPropagation(); setShowMenu(false); if (!post.user_has_reported) setShowReport(true); }}
                  disabled={post.user_has_reported}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', background: 'none', border: 'none', cursor: post.user_has_reported ? 'default' : 'pointer', fontSize: 13, color: post.user_has_reported ? 'var(--muted)' : 'var(--foreground)', fontFamily: 'inherit' }}
                >
                  {post.user_has_reported ? 'Reported' : 'Report post'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      {showReport && <ReportModal postId={post.id} onClose={() => setShowReport(false)} />}
```

- [ ] **Step 4: Verify lint**

```bash
cd peerly-frontend && npm run lint 2>&1 | grep "post-card" | head -5
```

Expected: no errors in post-card.tsx.

- [ ] **Step 5: Commit**

```bash
git add peerly-frontend/components/post-card.tsx
git commit -m "feat(reports): add report menu and Reported badge to PostCard"
```

---

### Task 10: Frontend `posts/[id]/page.tsx` — report button + removed state + badge

**Files:**
- Modify: `peerly-frontend/app/posts/[id]/page.tsx`

- [ ] **Step 1: Add ReportModal import**

In `peerly-frontend/app/posts/[id]/page.tsx`, find the existing imports:
```ts
import { usePost, usePostVote, type PostResponse } from '@/lib/hooks/useFeed';
```

Add after it:
```ts
import { ReportModal } from '@/components/ui/report-modal';
```

- [ ] **Step 2: Add `showReport` state in the main page component**

Find the `PostDetailPage` component (it contains `useParams`, `usePost`, etc.). Add inside it:
```ts
const [showReport, setShowReport] = useState(false);
```

- [ ] **Step 3: Add "Removed by admin" early-return**

In the main page component, after the loading/not-found checks and before the main return, find where `post` is confirmed to exist. Add:

```tsx
if (post?.is_hidden) {
  return (
    <ContentShell>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 200, textAlign: 'center', gap: 12 }}>
        <span style={{ fontSize: 32 }}>🚫</span>
        <p style={{ margin: 0, fontSize: 15, color: 'var(--muted)' }}>This post has been removed by an admin.</p>
      </div>
    </ContentShell>
  );
}
```

Place this check after `if (isLoading) return <PostDetailSkeleton />` and after `if (!post) return ...`.

- [ ] **Step 4: Add report button + Reported badge to the post action area**

In the post detail JSX, find the vote/action buttons row (contains upvote/downvote buttons). Add report button and badge after the existing actions:

```tsx
<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
  {post.user_has_reported && (
    <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>Reported</span>
  )}
  <button
    onClick={() => { if (!post.user_has_reported) setShowReport(true); }}
    disabled={post.user_has_reported}
    style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, cursor: post.user_has_reported ? 'default' : 'pointer', color: 'var(--muted)', fontSize: 12, padding: '4px 10px', fontFamily: 'inherit', opacity: post.user_has_reported ? 0.6 : 1 }}
  >
    {post.user_has_reported ? 'Reported' : 'Report'}
  </button>
</div>
{showReport && <ReportModal postId={post.id} onClose={() => setShowReport(false)} />}
```

To find the right location: look for the `usePostVote` result usage in the page (the vote buttons). Add the report section after the vote buttons div.

- [ ] **Step 5: Verify lint**

```bash
cd peerly-frontend && npm run lint 2>&1 | grep "posts/\[id\]" | head -5
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add peerly-frontend/app/posts/\[id\]/page.tsx
git commit -m "feat(reports): add report button and removed-by-admin state to post detail"
```

---

### Task 11: Frontend Admin Reports tab

**Files:**
- Modify: `peerly-frontend/app/admin/page.tsx`

- [ ] **Step 1: Add imports**

In `peerly-frontend/app/admin/page.tsx`, add imports at the top:
```ts
import { useAdminReports, useHidePost, type PostReportSummary } from '@/lib/hooks/useReports';
import { formatRelativeTime } from '@/lib/time';
```

- [ ] **Step 2: Add tab state and filter state in `AdminPage`**

Inside `AdminPage`, after existing state declarations, add:
```ts
const [adminTab, setAdminTab] = useState<'colleges' | 'reports'>('colleges');
const [reportFilter, setReportFilter] = useState<string>('');
const [reportPage, setReportPage] = useState(1);
const { data: reports = [], isLoading: reportsLoading } = useAdminReports(reportFilter || undefined, reportPage);
const hidePost = useHidePost();
```

- [ ] **Step 3: Add tab bar to the page JSX**

Find the `<ContentShell>` opening and the first content inside `AdminPage`. Add a tab bar at the very top (before the `<h1>` or existing content):

```tsx
<div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 24 }}>
  {([['colleges', 'Colleges'], ['reports', 'Reports']] as const).map(([id, label]) => (
    <button key={id} onClick={() => setAdminTab(id)} style={{
      padding: '10px 0', marginRight: 24, background: 'none', border: 'none', cursor: 'pointer',
      fontFamily: 'inherit', fontSize: 14, fontWeight: adminTab === id ? 600 : 400,
      color: adminTab === id ? 'var(--foreground)' : 'var(--muted)',
      borderBottom: adminTab === id ? '2px solid var(--foreground)' : '2px solid transparent', marginBottom: -1,
    }}>
      {label}
    </button>
  ))}
</div>
```

- [ ] **Step 4: Wrap existing college content in `adminTab === 'colleges'` guard**

Find the existing college management JSX (the heading + create form + college list). Wrap it:
```tsx
{adminTab === 'colleges' && (
  <>
    {/* existing college JSX here */}
  </>
)}
```

- [ ] **Step 5: Add Reports tab content**

After the colleges guard, add:
```tsx
{adminTab === 'reports' && (
  <div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--foreground)' }}>Reported Posts</h2>
      <select
        value={reportFilter}
        onChange={e => { setReportFilter(e.target.value); setReportPage(1); }}
        style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--foreground)', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}
      >
        <option value="">All reasons</option>
        <option value="spam">Spam</option>
        <option value="harassment">Harassment</option>
        <option value="misinformation">Misinformation</option>
        <option value="inappropriate">Inappropriate content</option>
        <option value="other">Other</option>
      </select>
    </div>

    {reportsLoading && <div style={{ color: 'var(--muted)', fontSize: 14 }}>Loading reports…</div>}

    {!reportsLoading && reports.length === 0 && (
      <div style={{ color: 'var(--muted)', fontSize: 14, padding: '32px 0', textAlign: 'center' }}>No reported posts.</div>
    )}

    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {reports.map((r: PostReportSummary, i: number) => (
        <div key={r.id} style={{ padding: '16px 0', borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>
                  {r.author.name || r.author.username}
                </span>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>{formatRelativeTime(r.created_at)}</span>
                {r.is_hidden && (
                  <span style={{ fontSize: 11, color: '#C0392B', border: '1px solid rgba(192,57,43,.4)', borderRadius: 4, padding: '1px 6px', fontWeight: 500 }}>Hidden</span>
                )}
              </div>
              <p style={{ margin: '0 0 8px', fontSize: 14, color: 'var(--foreground)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                {r.content}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground)' }}>
                  {r.report_count} report{r.report_count !== 1 ? 's' : ''}
                </span>
                {Object.entries(r.reason_breakdown).map(([reason, count]) => (
                  <span key={reason} style={{ fontSize: 11, color: 'var(--muted)', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 6px' }}>
                    {reason}: {count}
                  </span>
                ))}
              </div>
            </div>
            <button
              onClick={() => hidePost.mutate(r.id)}
              disabled={r.is_hidden || hidePost.isPending}
              style={{
                flexShrink: 0, padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                fontFamily: 'inherit', cursor: r.is_hidden ? 'default' : 'pointer',
                border: r.is_hidden ? '1px solid var(--border)' : '1px solid rgba(192,57,43,.4)',
                background: 'transparent',
                color: r.is_hidden ? 'var(--muted)' : '#C0392B',
                opacity: hidePost.isPending ? 0.6 : 1,
              }}
            >
              {r.is_hidden ? 'Hidden' : 'Hide post'}
            </button>
          </div>
        </div>
      ))}
    </div>

    {reports.length === 20 && (
      <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 20 }}>
        <button
          onClick={() => setReportPage(p => Math.max(1, p - 1))}
          disabled={reportPage === 1}
          style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', fontSize: 13, cursor: reportPage === 1 ? 'default' : 'pointer', fontFamily: 'inherit' }}
        >← Prev</button>
        <span style={{ fontSize: 13, color: 'var(--muted)', lineHeight: '30px' }}>Page {reportPage}</span>
        <button
          onClick={() => setReportPage(p => p + 1)}
          style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
        >Next →</button>
      </div>
    )}
  </div>
)}
```

- [ ] **Step 6: Verify lint**

```bash
cd peerly-frontend && npm run lint 2>&1 | grep "admin/page" | head -5
```

Expected: no errors in admin/page.tsx.

- [ ] **Step 7: Commit**

```bash
git add peerly-frontend/app/admin/page.tsx
git commit -m "feat(reports): add Reports tab to admin panel with hide post action"
```

---

### Task 12: Final build + test verification

- [ ] **Step 1: Backend build**

```bash
cd peerly-backend && npm run build 2>&1 | tail -5
```

Expected: no TypeScript errors.

- [ ] **Step 2: Run full backend test suite**

```bash
cd peerly-backend && npx jest --no-coverage 2>&1 | tail -15
```

Expected: 5 new reports.service tests pass. All other passing tests remain passing.

- [ ] **Step 3: Frontend build**

```bash
cd peerly-frontend && npm run build 2>&1 | tail -10
```

Expected: no errors.
