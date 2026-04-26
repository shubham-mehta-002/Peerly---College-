# Primer — Session Handoff

Read this file at the start of every session. Then read `PROJECT.md` for full design details and `CLAUDE.md` for dev commands and architecture decisions.

## What We've Done So Far

We've been in a brainstorming session designing Peerly from scratch before writing any code. No features have been implemented yet — the codebase is a skeleton (routes wired up, middleware in place, Supabase config done, database types defined).

## What Has Been Designed (Approved)

### Auth & Onboarding ✅
- Email domain gating against `whitelisted_domains` table
- Email/password + Google OAuth (both validated against domain whitelist — personal Gmail rejected)
- All emails via Resend (verification + password reset)
- Onboarding wizard: campus selection → profile details (name, username, bio, course) → lock campus
- `is_profile_completed` flag gates the onboarding redirect
- Campus is MVP-locked (no switching until post-launch)

### Feed ✅
- Instagram-style posts with `is_global` + `is_anonymous` toggles (both can be true)
- Up to 4 images per post via Cloudinary (compressed <1MB on frontend)
- Nested comments (self-referencing `parent_id`, levels 1–3 indented, 4+ flattened)
- Hidden downvotes, visible upvotes
- Heat score: `(upvotes × 2 + comments × 1.5 - downvotes) / (hours_since_posted + 2)^1.8`
- Sorting: Latest, Oldest, Most Upvoted, Trending — single UI, separate API per feed
- TanStack Query with optimistic updates + rollback

### Communities ✅
- WhatsApp-style real-time chat via Socket.io WebSockets
- RBAC: Owner → Admin → Member (200 member cap)
- No anonymity — all messages show real username
- Visibility: campus-specific or global
- Discovery page sorted by member count + search bar
- Messages: text (Markdown) + 1 image max, no video/docs
- Ownership must be transferred before leaving

## What We Haven't Discussed Yet

- Notifications
- User profile page (view/edit)
- Admin dashboard
- Reporting/moderation flow (table exists, UI not designed)
- Global feed community visibility details
- DMs

## Where We Left Off

The user interrupted mid-session to ask for this Primer and the PROJECT.md/CLAUDE.md files. The brainstorming session is **not complete** — communities were just approved but the full spec doc hasn't been written yet and the writing-plans skill hasn't been invoked.

## Next Steps When Resuming

1. Ask the user if they want to continue brainstorming remaining features (notifications, profile page, admin, etc.) or move straight to writing the implementation plan
2. If moving to implementation, invoke the `writing-plans` skill
3. The recommended implementation order is: Auth → Onboarding → Feed → Communities

## Key Decisions to Remember

- WebSockets (Socket.io) for communities — not Supabase Realtime (user was explicit)
- Globally unique usernames (cross-college global feed feature planned)
- Communities and Feed are separate content systems (not the same post object)
- No account deletion in MVP
- Resend for all emails, Cloudinary for all images
