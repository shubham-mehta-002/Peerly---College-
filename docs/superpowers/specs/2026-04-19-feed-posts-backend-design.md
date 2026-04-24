# Feed + Posts Backend — Design Spec

**Date:** 2026-04-19
**Scope:** `peerly-backend` — posts CRUD, voting, heat score, threaded comments

---

## 1. Architecture

Two new modules added to the existing domain-driven structure:

```
src/modules/
  posts/
    posts.types.ts        — Zod schemas + PostResponse interface
    posts.service.ts      — CRUD, feed queries, voting, computeHeatScore, maskAuthor
    posts.controller.ts   — req/res handlers
    posts.router.ts       — route + middleware wiring
  comments/
    comments.types.ts     — Zod schemas
    comments.service.ts   — addComment, getComments, deleteComment
    comments.controller.ts
    comments.router.ts
src/__tests__/
  posts.service.test.ts   — unit tests for pure functions + mocked service calls
  comments.service.test.ts
```

Vote logic lives in `posts.service.ts` (tightly coupled to post counters + heat score).

---

## 2. Database Schema (migration appended to schema.sql)

### `posts`
| column | type | notes |
|---|---|---|
| id | uuid PK | gen_random_uuid() |
| author_id | uuid FK → profiles(id) | cascade delete |
| campus_id | uuid FK → campuses(id) | cascade delete |
| college_id | uuid FK → colleges(id) | denormalized — set at creation for masking |
| content | text | required |
| image_urls | text[] | default '{}', max 4 (enforced in service) |
| is_global | boolean | default false |
| is_anonymous | boolean | default false |
| upvotes | int | default 0 |
| downvotes | int | default 0 |
| comment_count | int | default 0 |
| heat_score | float | default 0, recomputed on every vote/comment |
| created_at | timestamptz | default now() |

Indexes: `(campus_id, created_at desc)`, `(is_global, created_at desc)`, `(heat_score desc)`

**Note:** `author_id` references `profiles(id)` (not `users(id)`) so Supabase can join profile data in a single query.

### `post_votes`
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| post_id | uuid FK → posts(id) | cascade delete |
| user_id | uuid FK → users(id) | cascade delete |
| vote_type | text | CHECK IN ('up', 'down') |
| created_at | timestamptz | default now() |
| UNIQUE | (post_id, user_id) | one vote per user per post |

### `comments`
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| post_id | uuid FK → posts(id) | cascade delete |
| author_id | uuid FK → profiles(id) | cascade delete |
| parent_id | uuid FK → comments(id) | nullable; cascade delete |
| depth | int | 0 = top-level; child = parent.depth + 1 (no cap) |
| content | text | required |
| created_at | timestamptz | default now() |

Index: `(post_id, created_at asc)`

---

## 3. API Routes

All require `authenticate` middleware.

### Posts
| Method | Path | Description |
|---|---|---|
| GET | `/api/posts/campus` | Campus feed (scoped to req.user.campusId) |
| GET | `/api/posts/global` | Global feed (is_global = true) |
| GET | `/api/posts/:id` | Single post |
| POST | `/api/posts` | Create post |
| DELETE | `/api/posts/:id` | Delete post (own or admin) |
| POST | `/api/posts/:id/vote` | Cast / change / remove vote |

### Comments
| Method | Path | Description |
|---|---|---|
| GET | `/api/posts/:id/comments` | Flat list, ordered by created_at ASC |
| POST | `/api/posts/:id/comments` | Add comment (top-level or reply) |
| DELETE | `/api/posts/:postId/comments/:commentId` | Delete comment (own or admin) |

### Feed query params
- `?sort=latest` (default) — `created_at DESC`
- `?sort=oldest` — `created_at ASC`
- `?sort=upvoted` — `upvotes DESC`
- `?sort=trending` — `heat_score DESC`
- `?page=1&limit=20` — offset pagination, max 50

### Vote body
```json
{ "vote_type": "up" | "down" | null }
```
`null` removes the existing vote.

---

## 4. Key Behaviors

### Anonymous masking
Handled in service layer. `author_id` never leaked in response.

| Condition | display_author |
|---|---|
| `is_anonymous = false` | `{ username, avatar_url }` from profile |
| `is_anonymous = true`, campus feed | `{ username: "Anonymous Peer", avatar_url: null }` |
| `is_anonymous = true`, global feed | `{ username: "Anonymous @ <college_name>", avatar_url: null }` |
| Viewer is the author | Always shows real username (own post recognition) |

`college_name` sourced from `colleges.name` joined via `posts.college_id`.

### Heat score
Recomputed and stored on every vote and every comment event:
```
heat_score = max(0, (upvotes × 2 + comment_count × 1.5 - downvotes) / (hours_since_posted + 2)^1.8)
```

### Vote idempotency
- Same `vote_type` as existing vote → no-op (200)
- Different `vote_type` → update vote row, adjust counters, recompute heat
- `null` with no existing vote → no-op (200)
- `null` with existing vote → delete row, decrement counter, recompute heat

### Comment depth
Backend stores actual depth: `depth = parent.depth + 1` for replies, `0` for top-level. No ceiling. Frontend owns the flatten-at-3 visual rule.

### Ownership / deletion
Post or comment delete: `author_id === req.user.userId` OR `req.user.isAdmin`. Returns 403 otherwise.

---

## 5. PostResponse Shape

```typescript
interface PostResponse {
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
  display_author: { username: string; avatar_url: string | null };
  user_vote: 'up' | 'down' | null;
}
```

`downvotes` is never returned to clients (affects heat score only).
