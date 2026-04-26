# Peerly — Project Overview

Multi-tenant college chat app where students interact strictly within their college ecosystem. Two core pillars: a **Feed** (Instagram-style posts) and **Communities** (WhatsApp-style real-time group chat).

---

## Architecture

**Backend:** Express 5 + TypeScript, running on port 5000. Deployed on Render.
**Frontend:** Next.js 16 + React 19 + Tailwind CSS v4. **Note: Next.js 16 has breaking changes — read `node_modules/next/dist/docs/` before touching routing or data-fetching.**
**Database:** Supabase (PostgreSQL). Two clients in use:
- `supabaseAdmin` — service role key, bypasses RLS, used in backend for privileged ops
- `supabaseAnon` — anon key, respects RLS, used for user-scoped queries

**Auth flow:** Custom JWT (stored in `localStorage` as `peerly_token`) + Supabase Auth for session management. The backend middleware verifies the JWT, then fetches the profile from Supabase to attach `user`, `campusId`, and `role` to `req`.

**Email provider:** Resend — handles all transactional emails (verification, password reset).
**Image storage:** Cloudinary. Frontend compresses images to <1MB before upload.
**Real-time (Communities):** Socket.io WebSockets.
**Frontend data fetching:** Axios with interceptors (auto-attach token, redirect on 401). TanStack Query for caching and optimistic updates.

---

## Multi-Tenancy Model

Every piece of content is scoped to a `campus_id`. A college can have multiple campuses (e.g., Thapar has Patiala and Derabassi). The email domain maps to the college; the student picks their specific campus during onboarding.

Key rule: **college is locked by email domain forever; campus is locked at onboarding (MVP)**.

---

## Database Tables (current schema in `peerly-frontend/types/database.ts`)

| Table | Purpose |
|---|---|
| `whitelisted_domains` | Admin-managed list of allowed email domains mapped to campuses |
| `profiles` | Student profiles with `campus_id`, `role`, `is_profile_completed` flag |
| `posts` | Feed posts with `is_global`, `is_anonymous`, `heat_score`, `upvotes`, `downvotes` |
| `post_votes` | Per-user vote records (`up`/`down`) |
| `communities` | Community metadata, tied to a `campus_id` |
| `community_members` | RBAC join table: roles are `member`, `moderator`, `admin`, `owner` |
| `messages` | Community chat messages |
| `announcements` | Pinned announcements within communities |
| `reports` | User-reported content with status (`pending`, `reviewed`, `resolved`) |

---

## API Routes

All routes prefixed with `/api`:

| Prefix | Responsibility |
|---|---|
| `/auth` | Email verify, OTP, onboarding, username check |
| `/posts` | Feed CRUD, voting |
| `/communities` | Community CRUD, membership |
| `/profile` | Profile read/update |
| `/admin` | Admin-only operations |

---

## Phase 1 — Auth & Onboarding

### Domain Gating
On signup, the backend extracts the email domain and checks it against `whitelisted_domains`. If `is_active = false`, return error: "college not allowed by admin." Both email/password and **Google OAuth** are supported — Google OAuth emails go through the same domain check and are rejected with "only college email IDs are allowed" if using a personal Gmail.

### Auth Pages
- `/auth/login` — email/password + Google OAuth
- `/auth/signup` — with domain validation
- `/auth/forgot-password` — triggers Resend email
- `/auth/reset-password` — consumes access token from URL

### Onboarding Wizard (`/onboarding`)
Guards: `is_profile_completed = false` on the profile triggers a middleware redirect to `/onboarding`.

Built with **React Hook Form + Zod**.

**Step 1 — Campus Selection:** Fetches campuses where `email_domain` matches AND `is_active = true`. Displayed as a dropdown.

**Step 2 — Profile Details:**
- Full Name (required)
- Username (required, globally unique — debounced availability check)
- Bio (optional)
- Course (optional)

**Step 3 — Save:** Writes `campus_id` to profile, sets `is_profile_completed = true`, redirects to Campus Feed.

---

## Phase 2 — Feed (Instagram-style)

### Post Object
- `is_global` (Boolean) — student-chosen at creation. If true, post appears in Global Feed (all colleges); if false, campus-only.
- `is_anonymous` (Boolean) — student-chosen. Both flags can be true simultaneously.
- `image_urls` (string array) — up to 4 images via Cloudinary
- `heat_score` (float) — recomputed on every vote/comment event

### Anonymous Display Rules
- Global Feed: "Anonymous @ Thapar University"
- Campus Feed: "Anonymous Peer"
- Public: full username + avatar

### Images
react-dropzone → browser-image-compression (<1MB) → Cloudinary → save URLs in Supabase

### Comments
Self-referencing table (`parent_id`). Levels 1–3 visually indented. Level 4+ flattened vertically with "View more replies" breadcrumb.

### Voting
- Upvote count: visible
- Downvote count: hidden from UI, only affects heat score

**Heat score formula:**
```
heat_score = (upvotes × 2 + comments × 1.5 - downvotes) / (hours_since_posted + 2)^1.8
```
Recomputed and stored on every interaction.

### Sorting Filters
Single filter UI applies to whichever feed is active (Campus or Global). Separate API call per filter:
- Latest
- Oldest
- Most Upvoted
- Trending (heat score)

### TanStack Query
Optimistic updates on votes with automatic rollback on server failure.

---

## Phase 3 — Communities (WhatsApp-style)

### Creation
Any student can create a community. Tied to creator's `campus_id`.

Metadata: Name, Description, Category (Technical, Cultural, Sports)

Visibility: Campus-specific or Global (visible across all whitelisted universities)

**No anonymity in communities.** All messages show real username.

### RBAC Roles
| Role | Permissions |
|---|---|
| Owner | Full control, can delete community, assign Admins, must transfer before leaving |
| Admin | Delete messages, kick members, change settings |
| Member | Read and send messages |

200 member cap per community (MVP limit).

Ownership transfer: must be explicit before leaving. On account scenarios (no deletion in MVP), auto-transfer to oldest member.

### Discovery
Dedicated communities page/tab, sorted by member count by default, with name search bar.

### Real-Time
Socket.io WebSockets. Frontend subscribes per `community_id`.

### Messages
- Text (Markdown supported)
- Images: max 1 per message, compressed → Cloudinary → URL as message content
- No video or documents (MVP)

---

## Not Built Yet (Post-MVP)
- Campus switching
- Account deletion
- DMs / notifications
- Admin dashboard UI
- Global feed community visibility controls
