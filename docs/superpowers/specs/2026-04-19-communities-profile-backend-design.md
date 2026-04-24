# Communities + Profile Backend — Design Spec

**Date:** 2026-04-19
**Phase:** 3 (Communities) + Profile route
**Scope:** Communities CRUD, membership/RBAC, Socket.io real-time messaging, profile read/update

---

## 1. Database Schema

```sql
-- Communities
communities (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text,
  category    text CHECK (category IN ('Technical', 'Cultural', 'Sports')),
  is_global   boolean DEFAULT false,
  campus_id   uuid REFERENCES campuses(id) NOT NULL,
  created_by  uuid REFERENCES profiles(id) NOT NULL,
  member_count int DEFAULT 1,
  created_at  timestamptz DEFAULT now()
)

-- Membership + RBAC
community_members (
  community_id uuid REFERENCES communities(id) ON DELETE CASCADE,
  user_id      uuid REFERENCES profiles(id) ON DELETE CASCADE,
  role         text CHECK (role IN ('owner', 'admin', 'moderator', 'member')) DEFAULT 'member',
  joined_at    timestamptz DEFAULT now(),
  PRIMARY KEY  (community_id, user_id)
)

-- Messages
messages (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid REFERENCES communities(id) ON DELETE CASCADE,
  sender_id    uuid REFERENCES profiles(id) NOT NULL,
  content      text NOT NULL,
  image_url    text,
  created_at   timestamptz DEFAULT now()
)
```

`member_count` is denormalized on `communities` — incremented on join, decremented on leave. Avoids COUNT query on every list fetch.

---

## 2. Module Structure

```
src/modules/
├── communities/
│   ├── communities.types.ts       Zod schemas + CommunityResponse interface
│   ├── communities.service.ts     CRUD, join/leave, RBAC checks, member_count management
│   ├── communities.controller.ts
│   └── communities.router.ts
├── messages/
│   ├── messages.types.ts          Zod schemas + MessageResponse interface
│   ├── messages.service.ts        saveMessage, getHistory (cursor-based)
│   └── messages.router.ts         GET history only — writes go through Socket.io only
├── profile/
│   ├── profile.types.ts
│   ├── profile.service.ts         getProfile, updateProfile
│   ├── profile.controller.ts
│   └── profile.router.ts
└── gateway/
    ├── gateway.ts                 createGateway(httpServer) — attaches Socket.io server
    ├── gateway.auth.ts            JWT verify middleware for WS handshake
    └── gateway.handlers.ts        join_room, leave_room, send_message, typing handlers
```

`server.ts` refactored: `http.createServer(app)` → passed to `createGateway()` → `server.listen()`.

Messages are sent **exclusively** via Socket.io — no `POST /messages` REST endpoint. History is fetched via REST only.

---

## 3. REST API Routes

All routes behind `authenticate` middleware. RBAC enforced in service layer.

### Communities

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/communities` | List campus + global communities. Sort: `member_count DESC`. Query: `?search=` |
| POST | `/api/communities` | Create community. Creator becomes owner. |
| GET | `/api/communities/:id` | Single community + user's role in it |
| PATCH | `/api/communities/:id` | Update name/description/category. Owner or admin only. |
| DELETE | `/api/communities/:id` | Delete community. Owner only. |

### Membership

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/communities/:id/join` | Join. Enforces 200-member cap. |
| POST | `/api/communities/:id/leave` | Leave. Owner must transfer ownership first. |
| PATCH | `/api/communities/:id/members/:userId` | Update role. Owner can assign admin; admin can assign moderator/member. |
| DELETE | `/api/communities/:id/members/:userId` | Kick member. Admin+ can kick members; owner can kick anyone. |

### Messages (history)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/communities/:id/messages` | Cursor-based history. `?before=<message_id>&limit=50`. Max 50. |

### Profile

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/profile` | Own profile |
| PATCH | `/api/profile` | Update name, bio, avatar_url, course |

---

## 4. Socket.io Gateway

**Namespace:** `/communities`

### Client → Server Events

| Event | Payload | Behaviour |
|-------|---------|-----------|
| `join_room` | `{ communityId }` | Verify membership → `socket.join(communityId)` |
| `leave_room` | `{ communityId }` | `socket.leave(communityId)` |
| `send_message` | `{ communityId, content, image_url? }` | Verify membership → `messages.service.saveMessage()` → emit `new_message` to room |
| `typing` | `{ communityId }` | Broadcast `typing_indicator` to room (excluding sender) |

### Server → Client Events

| Event | Payload |
|-------|---------|
| `new_message` | `{ id, communityId, sender: { username, avatar_url }, content, image_url, created_at }` |
| `typing_indicator` | `{ communityId, username }` |
| `error` | `{ message }` |

### Auth Flow

1. Client sends JWT in `socket.handshake.auth.token`
2. `gateway.auth.ts` middleware verifies JWT and fetches profile from Supabase
3. `socket.data.user` attached (same shape as `req.user`: `{ userId, campusId, isAdmin }`)
4. Connection rejected with `error` event (not disconnect) if JWT invalid or missing

### Room Isolation

Each `communityId` is its own Socket.io room. `send_message` emits only to that room. Non-members receive an `error` event on `send_message` or `join_room` — not a disconnect.

---

## 5. RBAC Rules

| Action | Required role |
|--------|--------------|
| View community | Any authenticated user |
| Create community | Any authenticated user |
| Update community settings | owner, admin |
| Delete community | owner only |
| Join community | Any authenticated user (under 200-member cap) |
| Leave community | Any member (owner must transfer first) |
| Kick member | admin+ (can kick member/moderator); owner (can kick anyone) |
| Promote to admin | owner only |
| Promote to moderator | owner, admin |
| Send message | member of community |

---

## 6. Key Behaviours

### Ownership transfer on leave
Owner calling `/leave` without transferring returns `403: Transfer ownership before leaving`. No auto-transfer in MVP.

### 200-member cap
`join` checks `member_count >= 200` and returns `403: Community is full`.

### Cursor-based message history
`GET /communities/:id/messages?before=<uuid>&limit=50`
Query: `WHERE community_id = :id AND created_at < (SELECT created_at FROM messages WHERE id = :before) ORDER BY created_at DESC LIMIT 50`
First page omits `before`. Client prepends results to message list.

### Campus + global scoping
List endpoint returns communities where `campus_id = req.user.campusId OR is_global = true`.

### No anonymity in communities
All messages expose real `sender.username` and `sender.avatar_url`. No masking.

---

## 7. Response Shapes

```typescript
interface CommunityResponse {
  id: string;
  name: string;
  description: string | null;
  category: 'Technical' | 'Cultural' | 'Sports';
  is_global: boolean;
  campus_id: string;
  member_count: number;
  created_at: string;
  user_role: 'owner' | 'admin' | 'moderator' | 'member' | null; // null if not a member
}

interface MessageResponse {
  id: string;
  community_id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  sender: {
    username: string;
    avatar_url: string | null;
  };
}
```
