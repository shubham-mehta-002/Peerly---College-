# Global Communities — Design Spec

**Date:** 2026-04-28  
**Status:** Approved

## Problem

Communities are currently scoped to a single campus (`campus_id`). Users from different colleges cannot share a community. Global communities (cross-campus) exist as a half-implemented concept (`is_global` column present) but creation always stamps the creator's `campus_id`, and the member cap is uniform at 200 for all communities.

## Goals

- Allow any authenticated user to create a global community not tied to any campus
- Global communities have a higher member cap (500) vs campus communities (200)
- Frontend surfaces global communities in a dedicated tab

## Out of Scope

- Per-community custom caps
- Admin approval flow for global community creation
- Global communities with different chat behavior

---

## Database

**Migration:**
```sql
ALTER TABLE communities ALTER COLUMN campus_id DROP NOT NULL;
```

No new columns. `is_global` already exists.

**Invariants:**
- Campus community: `campus_id = <uuid>`, `is_global = false`
- Global community: `campus_id = NULL`, `is_global = true`

---

## Backend

### `communities.service.ts`

Add constants at top of file:
```ts
const CAMPUS_CAP = 200;
const GLOBAL_CAP = 500;
```

**`createCommunity()`** — when `input.is_global === true`, pass `campus_id: null` instead of the caller's `campusId`.

**`joinCommunity()`** — fetch `is_global` alongside `member_count`. Pick cap based on flag:
```ts
const cap = community.is_global ? GLOBAL_CAP : CAMPUS_CAP;
if (community.member_count >= cap) throw new AppError(403, 'Community is full');
```

### `communities.types.ts`

`CommunityResponse.campus_id` changes from `string` to `string | null`.

### No changes to:
- Router
- Controller
- Gateway / WebSocket layer
- Messages module

---

## Frontend

### `app/communities/page.tsx`

Add tab bar with three options: **My College** | **Global** | **All**

- **My College** — filter `is_global === false` from the existing response
- **Global** — filter `is_global === true`
- **All** — no filter (show everything, current behavior)

Filtering is client-side. The API already returns both campus and global communities in one call — no new endpoint needed.

### Create community form

Add a checkbox: "Make this a global community". When checked, sets `is_global: true` in the payload. Already accepted by the existing `CreateCommunitySchema`.

### Type update

`CommunityResponse.campus_id: string | null` — matches backend change.

### No changes to:
- Chat page (`app/communities/[id]/page.tsx`)
- `useMessages` hook
- Socket singleton
- Any other page

---

## Member Cap Summary

| Type | Cap |
|------|-----|
| Campus community | 200 |
| Global community | 500 |

---

## Error Messages

- Joining full campus community: `"Community is full"` (unchanged)
- Joining full global community: `"Community is full"` (same message, different threshold)
