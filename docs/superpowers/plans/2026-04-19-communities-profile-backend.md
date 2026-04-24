# Communities + Profile Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Communities CRUD + membership/RBAC + Socket.io real-time messaging + profile read/update API.

**Architecture:** Gateway module owns all Socket.io logic and attaches to the same HTTP server as Express. REST modules handle CRUD; the gateway reuses service functions for message persistence and membership checks. `server.ts` is refactored to `http.createServer(app)` so Socket.io can attach.

**Tech Stack:** Express 5, Socket.io 4, Supabase (supabaseAdmin), Zod, Jest (ts-jest), TypeScript (Node16)

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `database/schema.sql` | Modify | Add communities, community_members, messages tables |
| `src/server.ts` | Modify | Wrap with `http.createServer`, call `createGateway` |
| `src/app.ts` | Modify | Mount profile, communities, messages routers |
| `src/modules/profile/profile.types.ts` | Create | Zod schema + ProfileResponse |
| `src/modules/profile/profile.service.ts` | Create | getProfile, updateProfile |
| `src/modules/profile/profile.controller.ts` | Create | Request handlers |
| `src/modules/profile/profile.router.ts` | Create | GET /, PATCH / |
| `src/modules/communities/communities.types.ts` | Create | Zod schemas + CommunityResponse + CommunityRole |
| `src/modules/communities/communities.service.ts` | Create | CRUD, join/leave, kick, role update, getMemberRole |
| `src/modules/communities/communities.controller.ts` | Create | Request handlers |
| `src/modules/communities/communities.router.ts` | Create | All community + membership routes |
| `src/modules/messages/messages.types.ts` | Create | Zod schema + MessageResponse |
| `src/modules/messages/messages.service.ts` | Create | saveMessage, getHistory (cursor) |
| `src/modules/messages/messages.router.ts` | Create | GET /communities/:id/messages |
| `src/modules/gateway/gateway.auth.ts` | Create | Socket.io JWT auth middleware |
| `src/modules/gateway/gateway.handlers.ts` | Create | join_room, leave_room, send_message, typing |
| `src/modules/gateway/gateway.ts` | Create | createGateway(httpServer) |
| `src/__tests__/communities.service.test.ts` | Create | RBAC + cap enforcement tests |
| `src/__tests__/messages.service.test.ts` | Create | Cursor pagination tests |
| `src/__tests__/gateway.auth.test.ts` | Create | Auth middleware tests |

---

## Task 1: Schema Migration

**Files:**
- Modify: `database/schema.sql`

- [ ] **Append communities tables to `database/schema.sql`**

```sql
-- ============================================
-- Communities Migration
-- ============================================

create table if not exists communities (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  description  text,
  category     text not null check (category in ('Technical', 'Cultural', 'Sports')),
  is_global    boolean not null default false,
  campus_id    uuid not null references campuses(id) on delete cascade,
  created_by   uuid not null references profiles(id),
  member_count int not null default 1,
  created_at   timestamptz not null default now()
);

create index if not exists communities_campus_idx on communities(campus_id, member_count desc);
create index if not exists communities_global_idx on communities(is_global, member_count desc);

create table if not exists community_members (
  community_id uuid not null references communities(id) on delete cascade,
  user_id      uuid not null references profiles(id) on delete cascade,
  role         text not null check (role in ('owner', 'admin', 'moderator', 'member')) default 'member',
  joined_at    timestamptz not null default now(),
  primary key  (community_id, user_id)
);

create table if not exists messages (
  id           uuid primary key default gen_random_uuid(),
  community_id uuid not null references communities(id) on delete cascade,
  sender_id    uuid not null references profiles(id),
  content      text not null,
  image_url    text,
  created_at   timestamptz not null default now()
);

create index if not exists messages_community_created_idx on messages(community_id, created_at desc);
```

- [ ] **Run in Supabase SQL Editor** — paste the new block and execute. Verify three new tables appear in Table Editor.

- [ ] **Commit**
```bash
git add database/schema.sql
git commit -m "feat: add communities, community_members, messages schema"
```

---

## Task 2: Install Socket.io + Refactor server.ts

**Files:**
- Modify: `src/server.ts`

- [ ] **Install socket.io**
```bash
cd peerly-backend
npm install socket.io
```

- [ ] **Replace `src/server.ts` entirely**
```typescript
import http from 'http';
import { config } from './config';
import { logger } from './lib/logger';
import app from './app';
import { createGateway } from './modules/gateway/gateway';

const httpServer = http.createServer(app);
createGateway(httpServer);

httpServer.listen(config.PORT, () => {
  logger.info('Server started', { port: config.PORT, env: config.NODE_ENV });
});

function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down gracefully`);
  httpServer.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10_000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason });
});
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { error: err.message, stack: err.stack });
  process.exit(1);
});
```

- [ ] **Run `npx tsc --noEmit`** — will fail because gateway module doesn't exist yet. That's expected — proceed.

- [ ] **Commit**
```bash
git add src/server.ts package.json package-lock.json
git commit -m "feat: install socket.io, refactor server.ts to http.createServer"
```

---

## Task 3: Profile Module

**Files:**
- Create: `src/modules/profile/profile.types.ts`
- Create: `src/modules/profile/profile.service.ts`
- Create: `src/modules/profile/profile.controller.ts`
- Create: `src/modules/profile/profile.router.ts`
- Modify: `src/app.ts`

- [ ] **Create `src/modules/profile/profile.types.ts`**
```typescript
import { z } from 'zod';

export const UpdateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  bio: z.string().max(500).optional(),
  avatar_url: z.string().url().optional(),
});

export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;

export interface ProfileResponse {
  id: string;
  username: string | null;
  name: string | null;
  bio: string | null;
  avatar_url: string | null;
  campus_id: string | null;
  updated_at: string;
}
```

- [ ] **Create `src/modules/profile/profile.service.ts`**
```typescript
import { supabaseAdmin } from '../../lib/supabase';
import { AppError } from '../../lib/errors';
import type { UpdateProfileInput, ProfileResponse } from './profile.types';

export async function getProfile(userId: string): Promise<ProfileResponse> {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, username, name, bio, avatar_url, campus_id, updated_at')
    .eq('id', userId)
    .single();

  if (error || !data) throw new AppError(404, 'Profile not found');
  return data as ProfileResponse;
}

export async function updateProfile(userId: string, input: UpdateProfileInput): Promise<ProfileResponse> {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select('id, username, name, bio, avatar_url, campus_id, updated_at')
    .single();

  if (error || !data) throw new AppError(500, 'Failed to update profile');
  return data as ProfileResponse;
}
```

- [ ] **Create `src/modules/profile/profile.controller.ts`**
```typescript
import type { Request, Response } from 'express';
import { getProfile, updateProfile } from './profile.service';
import { UpdateProfileSchema } from './profile.types';

export async function getProfileHandler(req: Request, res: Response) {
  const profile = await getProfile(req.user.userId);
  res.json(profile);
}

export async function updateProfileHandler(req: Request, res: Response) {
  const parsed = UpdateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', errors: parsed.error.issues });
    return;
  }
  const profile = await updateProfile(req.user.userId, parsed.data);
  res.json(profile);
}
```

- [ ] **Create `src/modules/profile/profile.router.ts`**
```typescript
import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { getProfileHandler, updateProfileHandler } from './profile.controller';

const router = Router();
router.use(authenticate);
router.get('/', getProfileHandler);
router.patch('/', updateProfileHandler);

export default router;
```

- [ ] **Mount in `src/app.ts`** — add after existing imports and route mounts:
```typescript
// add import at top
import profileRouter from './modules/profile/profile.router';

// add route (after existing routes, before 404 handler)
app.use('/api/profile', profileRouter);
```

- [ ] **Run `npx tsc --noEmit`** — expect only gateway-related errors (gateway not built yet).

- [ ] **Commit**
```bash
git add src/modules/profile src/app.ts
git commit -m "feat: add profile read/update module"
```

---

## Task 4: Communities Module

**Files:**
- Create: `src/modules/communities/communities.types.ts`
- Create: `src/modules/communities/communities.service.ts`
- Create: `src/modules/communities/communities.controller.ts`
- Create: `src/modules/communities/communities.router.ts`
- Create: `src/__tests__/communities.service.test.ts`
- Modify: `src/app.ts`

- [ ] **Create `src/modules/communities/communities.types.ts`**
```typescript
import { z } from 'zod';

export const CreateCommunitySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  category: z.enum(['Technical', 'Cultural', 'Sports']),
  is_global: z.boolean().default(false),
});

export const UpdateCommunitySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  category: z.enum(['Technical', 'Cultural', 'Sports']).optional(),
});

export const UpdateMemberRoleSchema = z.object({
  role: z.enum(['admin', 'moderator', 'member']),
});

export type CreateCommunityInput = z.infer<typeof CreateCommunitySchema>;
export type UpdateCommunityInput = z.infer<typeof UpdateCommunitySchema>;
export type UpdateMemberRoleInput = z.infer<typeof UpdateMemberRoleSchema>;
export type CommunityRole = 'owner' | 'admin' | 'moderator' | 'member';

export interface CommunityResponse {
  id: string;
  name: string;
  description: string | null;
  category: 'Technical' | 'Cultural' | 'Sports';
  is_global: boolean;
  campus_id: string;
  member_count: number;
  created_at: string;
  user_role: CommunityRole | null;
}
```

- [ ] **Create `src/modules/communities/communities.service.ts`**
```typescript
import { supabaseAdmin } from '../../lib/supabase';
import { AppError } from '../../lib/errors';
import type {
  CreateCommunityInput,
  UpdateCommunityInput,
  UpdateMemberRoleInput,
  CommunityRole,
  CommunityResponse,
} from './communities.types';

export const ROLE_RANK: Record<CommunityRole, number> = {
  owner: 4, admin: 3, moderator: 2, member: 1,
};

export async function getMemberRole(communityId: string, userId: string): Promise<CommunityRole | null> {
  const { data } = await supabaseAdmin
    .from('community_members')
    .select('role')
    .eq('community_id', communityId)
    .eq('user_id', userId)
    .single();
  return (data?.role as CommunityRole) ?? null;
}

export async function getCommunities(campusId: string, search?: string): Promise<CommunityResponse[]> {
  let query = supabaseAdmin
    .from('communities')
    .select('id, name, description, category, is_global, campus_id, member_count, created_at')
    .or(`campus_id.eq.${campusId},is_global.eq.true`)
    .order('member_count', { ascending: false });

  if (search) query = query.ilike('name', `%${search}%`);

  const { data, error } = await query;
  if (error) throw new AppError(500, 'Failed to fetch communities');
  return (data ?? []).map((c) => ({ ...c, user_role: null }));
}

export async function getCommunity(communityId: string, userId: string): Promise<CommunityResponse> {
  const { data, error } = await supabaseAdmin
    .from('communities')
    .select('id, name, description, category, is_global, campus_id, member_count, created_at')
    .eq('id', communityId)
    .single();

  if (error || !data) throw new AppError(404, 'Community not found');
  const role = await getMemberRole(communityId, userId);
  return { ...data, user_role: role } as CommunityResponse;
}

export async function createCommunity(input: CreateCommunityInput, userId: string, campusId: string): Promise<CommunityResponse> {
  const { data: community, error } = await supabaseAdmin
    .from('communities')
    .insert({ ...input, campus_id: campusId, created_by: userId, member_count: 1 })
    .select('id, name, description, category, is_global, campus_id, member_count, created_at')
    .single();

  if (error || !community) throw new AppError(500, 'Failed to create community');

  await supabaseAdmin.from('community_members').insert({
    community_id: community.id,
    user_id: userId,
    role: 'owner',
  });

  return { ...community, user_role: 'owner' } as CommunityResponse;
}

export async function updateCommunity(communityId: string, input: UpdateCommunityInput, userId: string): Promise<CommunityResponse> {
  const role = await getMemberRole(communityId, userId);
  if (!role || ROLE_RANK[role] < ROLE_RANK.admin) throw new AppError(403, 'Insufficient permissions');

  const { data, error } = await supabaseAdmin
    .from('communities')
    .update(input)
    .eq('id', communityId)
    .select('id, name, description, category, is_global, campus_id, member_count, created_at')
    .single();

  if (error || !data) throw new AppError(500, 'Failed to update community');
  return { ...data, user_role: role } as CommunityResponse;
}

export async function deleteCommunity(communityId: string, userId: string): Promise<void> {
  const role = await getMemberRole(communityId, userId);
  if (role !== 'owner') throw new AppError(403, 'Only owner can delete community');

  const { error } = await supabaseAdmin.from('communities').delete().eq('id', communityId);
  if (error) throw new AppError(500, 'Failed to delete community');
}

export async function joinCommunity(communityId: string, userId: string): Promise<void> {
  const { data: community, error: fetchErr } = await supabaseAdmin
    .from('communities')
    .select('member_count')
    .eq('id', communityId)
    .single();

  if (fetchErr || !community) throw new AppError(404, 'Community not found');
  if (community.member_count >= 200) throw new AppError(403, 'Community is full');

  const existing = await getMemberRole(communityId, userId);
  if (existing) throw new AppError(409, 'Already a member');

  await supabaseAdmin.from('community_members').insert({ community_id: communityId, user_id: userId, role: 'member' });
  await supabaseAdmin.from('communities').update({ member_count: community.member_count + 1 }).eq('id', communityId);
}

export async function leaveCommunity(communityId: string, userId: string): Promise<void> {
  const role = await getMemberRole(communityId, userId);
  if (!role) throw new AppError(404, 'Not a member');
  if (role === 'owner') throw new AppError(403, 'Transfer ownership before leaving');

  const { data: community } = await supabaseAdmin
    .from('communities')
    .select('member_count')
    .eq('id', communityId)
    .single();

  await supabaseAdmin
    .from('community_members')
    .delete()
    .eq('community_id', communityId)
    .eq('user_id', userId);

  await supabaseAdmin
    .from('communities')
    .update({ member_count: Math.max(0, (community?.member_count ?? 1) - 1) })
    .eq('id', communityId);
}

export async function kickMember(communityId: string, kickerId: string, targetId: string): Promise<void> {
  const kickerRole = await getMemberRole(communityId, kickerId);
  const targetRole = await getMemberRole(communityId, targetId);

  if (!kickerRole || !targetRole) throw new AppError(404, 'Member not found');
  if (ROLE_RANK[kickerRole] <= ROLE_RANK[targetRole]) throw new AppError(403, 'Cannot kick member with equal or higher role');

  const { data: community } = await supabaseAdmin
    .from('communities')
    .select('member_count')
    .eq('id', communityId)
    .single();

  await supabaseAdmin
    .from('community_members')
    .delete()
    .eq('community_id', communityId)
    .eq('user_id', targetId);

  await supabaseAdmin
    .from('communities')
    .update({ member_count: Math.max(0, (community?.member_count ?? 1) - 1) })
    .eq('id', communityId);
}

export async function updateMemberRole(communityId: string, updaterId: string, targetId: string, input: UpdateMemberRoleInput): Promise<void> {
  const updaterRole = await getMemberRole(communityId, updaterId);
  const targetRole = await getMemberRole(communityId, targetId);

  if (!updaterRole || !targetRole) throw new AppError(404, 'Member not found');

  // Only owner can assign admin; admin+ can assign moderator/member
  if (input.role === 'admin' && updaterRole !== 'owner') throw new AppError(403, 'Only owner can assign admin');
  if (ROLE_RANK[updaterRole] <= ROLE_RANK[targetRole]) throw new AppError(403, 'Cannot update role of member with equal or higher rank');

  await supabaseAdmin
    .from('community_members')
    .update({ role: input.role })
    .eq('community_id', communityId)
    .eq('user_id', targetId);
}
```

- [ ] **Create `src/modules/communities/communities.controller.ts`**
```typescript
import type { Request, Response } from 'express';
import {
  getCommunities, getCommunity, createCommunity,
  updateCommunity, deleteCommunity, joinCommunity,
  leaveCommunity, kickMember, updateMemberRole,
} from './communities.service';
import { CreateCommunitySchema, UpdateCommunitySchema, UpdateMemberRoleSchema } from './communities.types';

export async function listHandler(req: Request, res: Response) {
  const communities = await getCommunities(req.user.campusId as string, req.query.search as string | undefined);
  res.json(communities);
}

export async function getHandler(req: Request, res: Response) {
  const community = await getCommunity(req.params.id as string, req.user.userId);
  res.json(community);
}

export async function createHandler(req: Request, res: Response) {
  const parsed = CreateCommunitySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Validation failed', errors: parsed.error.issues }); return; }
  const community = await createCommunity(parsed.data, req.user.userId, req.user.campusId as string);
  res.status(201).json(community);
}

export async function updateHandler(req: Request, res: Response) {
  const parsed = UpdateCommunitySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Validation failed', errors: parsed.error.issues }); return; }
  const community = await updateCommunity(req.params.id as string, parsed.data, req.user.userId);
  res.json(community);
}

export async function deleteHandler(req: Request, res: Response) {
  await deleteCommunity(req.params.id as string, req.user.userId);
  res.status(204).send();
}

export async function joinHandler(req: Request, res: Response) {
  await joinCommunity(req.params.id as string, req.user.userId);
  res.status(204).send();
}

export async function leaveHandler(req: Request, res: Response) {
  await leaveCommunity(req.params.id as string, req.user.userId);
  res.status(204).send();
}

export async function kickHandler(req: Request, res: Response) {
  await kickMember(req.params.id as string, req.user.userId, req.params.userId as string);
  res.status(204).send();
}

export async function updateRoleHandler(req: Request, res: Response) {
  const parsed = UpdateMemberRoleSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Validation failed', errors: parsed.error.issues }); return; }
  await updateMemberRole(req.params.id as string, req.user.userId, req.params.userId as string, parsed.data);
  res.status(204).send();
}
```

- [ ] **Create `src/modules/communities/communities.router.ts`**
```typescript
import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import {
  listHandler, getHandler, createHandler, updateHandler,
  deleteHandler, joinHandler, leaveHandler, kickHandler, updateRoleHandler,
} from './communities.controller';

const router = Router();
router.use(authenticate);

router.get('/', listHandler);
router.post('/', createHandler);
router.get('/:id', getHandler);
router.patch('/:id', updateHandler);
router.delete('/:id', deleteHandler);

router.post('/:id/join', joinHandler);
router.post('/:id/leave', leaveHandler);
router.delete('/:id/members/:userId', kickHandler);
router.patch('/:id/members/:userId', updateRoleHandler);

export default router;
```

- [ ] **Write failing test — `src/__tests__/communities.service.test.ts`**
```typescript
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
    select: () => c, eq: () => c, or: () => c, ilike: () => c,
    order: () => c, single: () => Promise.resolve({ data: null, error: null }),
    insert: () => c, update: () => c, delete: () => c,
    ...overrides,
  };
  return c;
}

describe('joinCommunity', () => {
  it('throws 403 when member_count >= 200', async () => {
    const { joinCommunity } = await import('../modules/communities/communities.service.js');
    mockFrom.mockImplementation((table: string) => {
      if (table === 'communities') return chain({ single: () => Promise.resolve({ data: { member_count: 200 }, error: null }) });
      if (table === 'community_members') return chain({ single: () => Promise.resolve({ data: null, error: null }) });
      return chain();
    });

    await expect(joinCommunity('comm-1', 'user-1')).rejects.toMatchObject({ status: 403, message: 'Community is full' });
  });

  it('throws 409 when already a member', async () => {
    const { joinCommunity } = await import('../modules/communities/communities.service.js');
    mockFrom.mockImplementation((table: string) => {
      if (table === 'communities') return chain({ single: () => Promise.resolve({ data: { member_count: 5 }, error: null }) });
      if (table === 'community_members') return chain({ single: () => Promise.resolve({ data: { role: 'member' }, error: null }) });
      return chain();
    });

    await expect(joinCommunity('comm-1', 'user-1')).rejects.toMatchObject({ status: 409 });
  });
});

describe('leaveCommunity', () => {
  it('throws 403 when user is owner', async () => {
    const { leaveCommunity } = await import('../modules/communities/communities.service.js');
    mockFrom.mockImplementation(() =>
      chain({ single: () => Promise.resolve({ data: { role: 'owner' }, error: null }) })
    );

    await expect(leaveCommunity('comm-1', 'user-1')).rejects.toMatchObject({ status: 403, message: 'Transfer ownership before leaving' });
  });
});

describe('kickMember', () => {
  it('throws 403 when kicker rank <= target rank', async () => {
    const { kickMember } = await import('../modules/communities/communities.service.js');
    let call = 0;
    mockFrom.mockImplementation(() =>
      chain({
        single: () => {
          call++;
          // First call = kicker (admin=3), second call = target (admin=3)
          return Promise.resolve({ data: { role: 'admin' }, error: null });
        },
      })
    );

    await expect(kickMember('comm-1', 'kicker', 'target')).rejects.toMatchObject({ status: 403 });
  });
});

describe('updateMemberRole', () => {
  it('throws 403 when non-owner tries to assign admin', async () => {
    const { updateMemberRole } = await import('../modules/communities/communities.service.js');
    let call = 0;
    mockFrom.mockImplementation(() =>
      chain({
        single: () => {
          call++;
          const role = call === 1 ? 'admin' : 'member';
          return Promise.resolve({ data: { role }, error: null });
        },
      })
    );

    await expect(updateMemberRole('comm-1', 'updater', 'target', { role: 'admin' })).rejects.toMatchObject({ status: 403, message: 'Only owner can assign admin' });
  });
});
```

- [ ] **Run test to verify it fails** (expected — service not imported yet via correct path):
```bash
cd peerly-backend && npx jest communities.service.test --no-coverage 2>&1 | tail -20
```

- [ ] **Mount communities router in `src/app.ts`**
```typescript
// add import at top
import communitiesRouter from './modules/communities/communities.router';

// add route
app.use('/api/communities', communitiesRouter);
```

- [ ] **Run tests**
```bash
npx jest communities.service.test --no-coverage 2>&1 | tail -20
```
Expected: all 4 tests pass.

- [ ] **Run `npx tsc --noEmit`** — expect only gateway errors.

- [ ] **Commit**
```bash
git add src/modules/communities src/__tests__/communities.service.test.ts src/app.ts
git commit -m "feat: add communities module with RBAC"
```

---

## Task 5: Messages Module

**Files:**
- Create: `src/modules/messages/messages.types.ts`
- Create: `src/modules/messages/messages.service.ts`
- Create: `src/modules/messages/messages.router.ts`
- Create: `src/__tests__/messages.service.test.ts`
- Modify: `src/app.ts`

- [ ] **Create `src/modules/messages/messages.types.ts`**
```typescript
import { z } from 'zod';

export const SendMessageSchema = z.object({
  communityId: z.string().uuid(),
  content: z.string().min(1).max(2000),
  image_url: z.string().url().optional(),
});

export type SendMessageInput = z.infer<typeof SendMessageSchema>;

export interface MessageResponse {
  id: string;
  community_id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  sender: { username: string; avatar_url: string | null };
}
```

- [ ] **Create `src/modules/messages/messages.service.ts`**
```typescript
import { supabaseAdmin } from '../../lib/supabase';
import { AppError } from '../../lib/errors';
import type { MessageResponse } from './messages.types';

const MESSAGE_SELECT = 'id, community_id, content, image_url, created_at, profiles!sender_id(username, avatar_url)';

function toResponse(row: Record<string, unknown>): MessageResponse {
  const profile = row.profiles as { username: string; avatar_url: string | null };
  return {
    id: row.id as string,
    community_id: row.community_id as string,
    content: row.content as string,
    image_url: row.image_url as string | null,
    created_at: row.created_at as string,
    sender: { username: profile.username, avatar_url: profile.avatar_url },
  };
}

export async function saveMessage(input: {
  communityId: string;
  senderId: string;
  content: string;
  image_url?: string;
}): Promise<MessageResponse> {
  const { data, error } = await supabaseAdmin
    .from('messages')
    .insert({
      community_id: input.communityId,
      sender_id: input.senderId,
      content: input.content,
      image_url: input.image_url ?? null,
    })
    .select(MESSAGE_SELECT)
    .single();

  if (error || !data) throw new AppError(500, 'Failed to save message');
  return toResponse(data as Record<string, unknown>);
}

export async function getHistory(communityId: string, before?: string, limit = 50): Promise<MessageResponse[]> {
  const cap = Math.min(limit, 50);

  let cursorTime: string | null = null;
  if (before) {
    const { data: cursor } = await supabaseAdmin
      .from('messages')
      .select('created_at')
      .eq('id', before)
      .single();
    cursorTime = cursor?.created_at ?? null;
  }

  let query = supabaseAdmin
    .from('messages')
    .select(MESSAGE_SELECT)
    .eq('community_id', communityId)
    .order('created_at', { ascending: false })
    .limit(cap);

  if (cursorTime) query = query.lt('created_at', cursorTime);

  const { data, error } = await query;
  if (error) throw new AppError(500, 'Failed to fetch messages');

  return (data ?? []).map((row) => toResponse(row as Record<string, unknown>));
}
```

- [ ] **Create `src/modules/messages/messages.router.ts`**
```typescript
import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { getHistory } from './messages.service';

const router = Router({ mergeParams: true });
router.use(authenticate);

router.get('/', async (req, res) => {
  const communityId = req.params.id as string;
  const before = req.query.before as string | undefined;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
  const messages = await getHistory(communityId, before, limit);
  res.json(messages);
});

export default router;
```

- [ ] **Write failing test — `src/__tests__/messages.service.test.ts`**
```typescript
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
    select: () => c, eq: () => c, lt: () => c,
    order: () => c, limit: () => Promise.resolve({ data: [], error: null }),
    single: () => Promise.resolve({ data: null, error: null }),
    insert: () => c,
    ...overrides,
  };
  return c;
}

describe('getHistory', () => {
  it('fetches without cursor when before is undefined', async () => {
    const { getHistory } = await import('../modules/messages/messages.service.js');

    const limitMock = jest.fn().mockResolvedValue({ data: [], error: null });
    mockFrom.mockReturnValue(chain({ limit: limitMock }));

    await getHistory('comm-1');

    expect(limitMock).toHaveBeenCalledWith(50);
  });

  it('fetches cursor timestamp then filters with lt when before is provided', async () => {
    const { getHistory } = await import('../modules/messages/messages.service.js');

    const ltMock = jest.fn().mockReturnValue(chain({ limit: jest.fn().mockResolvedValue({ data: [], error: null }) }));
    let call = 0;
    mockFrom.mockImplementation(() => {
      call++;
      if (call === 1) {
        // cursor fetch
        return chain({ single: () => Promise.resolve({ data: { created_at: '2026-04-19T10:00:00Z' }, error: null }) });
      }
      return chain({ lt: ltMock });
    });

    await getHistory('comm-1', 'msg-uuid-before');

    expect(ltMock).toHaveBeenCalledWith('created_at', '2026-04-19T10:00:00Z');
  });
});
```

- [ ] **Run test to verify it fails**
```bash
npx jest messages.service.test --no-coverage 2>&1 | tail -15
```

- [ ] **Mount messages router in `src/app.ts`**
```typescript
// add import at top
import messagesRouter from './modules/messages/messages.router';

// add route (after communities route)
app.use('/api/communities/:id/messages', messagesRouter);
```

- [ ] **Run tests**
```bash
npx jest messages.service.test --no-coverage 2>&1 | tail -15
```
Expected: both tests pass.

- [ ] **Run all tests**
```bash
npx jest --no-coverage 2>&1 | tail -10
```
Expected: all suites pass.

- [ ] **Commit**
```bash
git add src/modules/messages src/__tests__/messages.service.test.ts src/app.ts
git commit -m "feat: add messages module with cursor-based history"
```

---

## Task 6: Gateway Module

**Files:**
- Create: `src/modules/gateway/gateway.auth.ts`
- Create: `src/modules/gateway/gateway.handlers.ts`
- Create: `src/modules/gateway/gateway.ts`
- Create: `src/__tests__/gateway.auth.test.ts`

- [ ] **Create `src/modules/gateway/gateway.auth.ts`**
```typescript
import type { Socket } from 'socket.io';
import { verifyToken } from '../../lib/jwt';
import { supabaseAdmin } from '../../lib/supabase';
import { logger } from '../../lib/logger';

export async function gatewayAuth(socket: Socket, next: (err?: Error) => void): Promise<void> {
  try {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) { next(new Error('Unauthorized')); return; }

    const payload = verifyToken(token);

    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('id, username, campus_id')
      .eq('id', payload.userId)
      .single();

    if (error || !profile) { next(new Error('Unauthorized')); return; }

    socket.data.user = {
      userId: profile.id as string,
      campusId: profile.campus_id as string,
      isAdmin: payload.isAdmin,
      username: profile.username as string,
    };
    next();
  } catch (err) {
    logger.debug('Gateway auth failed', { error: err instanceof Error ? err.message : String(err) });
    next(new Error('Unauthorized'));
  }
}
```

- [ ] **Create `src/modules/gateway/gateway.handlers.ts`**
```typescript
import type { Socket, Namespace } from 'socket.io';
import { saveMessage } from '../messages/messages.service';
import { getMemberRole } from '../communities/communities.service';
import { SendMessageSchema } from '../messages/messages.types';
import { logger } from '../../lib/logger';

export function registerHandlers(socket: Socket, ns: Namespace): void {
  socket.on('join_room', async ({ communityId }: { communityId: string }) => {
    try {
      const role = await getMemberRole(communityId, socket.data.user.userId);
      if (!role) { socket.emit('error', { message: 'Not a member' }); return; }
      socket.join(communityId);
    } catch (err) {
      logger.error('join_room error', { error: err });
      socket.emit('error', { message: 'Failed to join room' });
    }
  });

  socket.on('leave_room', ({ communityId }: { communityId: string }) => {
    socket.leave(communityId);
  });

  socket.on('send_message', async (payload: unknown) => {
    try {
      const parsed = SendMessageSchema.safeParse(payload);
      if (!parsed.success) { socket.emit('error', { message: 'Invalid payload' }); return; }

      const { communityId, content, image_url } = parsed.data;
      const role = await getMemberRole(communityId, socket.data.user.userId);
      if (!role) { socket.emit('error', { message: 'Not a member' }); return; }

      const message = await saveMessage({
        communityId,
        senderId: socket.data.user.userId,
        content,
        image_url,
      });
      ns.to(communityId).emit('new_message', message);
    } catch (err) {
      logger.error('send_message error', { error: err });
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  socket.on('typing', ({ communityId }: { communityId: string }) => {
    socket.to(communityId).emit('typing_indicator', {
      communityId,
      username: socket.data.user.username,
    });
  });
}
```

- [ ] **Create `src/modules/gateway/gateway.ts`**
```typescript
import type { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { config } from '../../config';
import { logger } from '../../lib/logger';
import { gatewayAuth } from './gateway.auth';
import { registerHandlers } from './gateway.handlers';

export function createGateway(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: { origin: config.FRONTEND_URL, credentials: true },
  });

  const ns = io.of('/communities');
  ns.use(gatewayAuth);

  ns.on('connection', (socket) => {
    logger.info('Socket connected', { userId: socket.data.user.userId });
    registerHandlers(socket, ns);
    socket.on('disconnect', () => {
      logger.info('Socket disconnected', { userId: socket.data.user.userId });
    });
  });

  return io;
}
```

- [ ] **Write failing test — `src/__tests__/gateway.auth.test.ts`**
```typescript
import { supabaseAdmin } from '../lib/supabase';
import { verifyToken } from '../lib/jwt';

jest.mock('../lib/supabase', () => ({
  supabaseAdmin: { from: jest.fn() },
}));
jest.mock('../lib/jwt', () => ({
  verifyToken: jest.fn(),
}));
jest.mock('../lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

const mockFrom = supabaseAdmin.from as jest.Mock;
const mockVerify = verifyToken as jest.Mock;

function chain(overrides: Record<string, unknown> = {}): unknown {
  const c: Record<string, unknown> = {
    select: () => c, eq: () => c,
    single: () => Promise.resolve({ data: null, error: null }),
    ...overrides,
  };
  return c;
}

function makeSocket(token?: string) {
  return { handshake: { auth: { token } }, data: {} } as unknown as import('socket.io').Socket;
}

describe('gatewayAuth', () => {
  it('calls next(Error) when token is missing', async () => {
    const { gatewayAuth } = await import('../modules/gateway/gateway.auth.js');
    const next = jest.fn();
    await gatewayAuth(makeSocket(undefined), next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].message).toBe('Unauthorized');
  });

  it('calls next(Error) when verifyToken throws', async () => {
    const { gatewayAuth } = await import('../modules/gateway/gateway.auth.js');
    mockVerify.mockImplementation(() => { throw new Error('invalid sig'); });
    const next = jest.fn();
    await gatewayAuth(makeSocket('bad-token'), next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  it('sets socket.data.user and calls next() on valid token', async () => {
    const { gatewayAuth } = await import('../modules/gateway/gateway.auth.js');
    mockVerify.mockReturnValue({ userId: 'u1', isAdmin: false });
    mockFrom.mockReturnValue(chain({
      single: () => Promise.resolve({ data: { id: 'u1', username: 'alice', campus_id: 'c1' }, error: null }),
    }));
    const socket = makeSocket('valid-token');
    const next = jest.fn();
    await gatewayAuth(socket, next);
    expect(socket.data.user).toMatchObject({ userId: 'u1', username: 'alice' });
    expect(next).toHaveBeenCalledWith();
  });
});
```

- [ ] **Run test to verify it fails**
```bash
npx jest gateway.auth.test --no-coverage 2>&1 | tail -15
```

- [ ] **Run all tests**
```bash
npx jest --no-coverage 2>&1 | tail -10
```
Expected: all suites pass including gateway.auth.

- [ ] **Run `npx tsc --noEmit`** — zero errors expected.

- [ ] **Commit**
```bash
git add src/modules/gateway src/__tests__/gateway.auth.test.ts
git commit -m "feat: add Socket.io gateway with JWT auth and room handlers"
```
