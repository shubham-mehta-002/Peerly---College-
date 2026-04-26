# Frontend Optimizations Backlog

## Critical Bugs

### 1. Rename `middleware.ts` → `proxy.ts`
Next.js 16 deprecated `middleware` file convention. Build warns on every compile.
- File: `peerly-frontend/middleware.ts` → `peerly-frontend/proxy.ts`

### 2. Delete dead `/auth/onboarding` route
`useLogin`/`useRegister` redirect to `/onboarding`, not `/auth/onboarding`. Dead route wastes bundle.
- Delete: `peerly-frontend/app/auth/onboarding/page.tsx`

---

## State Management Gaps

### 3. Community chat "mine" detection broken
`communities/[id]/page.tsx` has `const mine = false` hardcoded. Own messages never appear on right side.
- Fix: compare `msg.sender.username === me?.profile?.username` (already fetching `useMe` in that page)
- Note: `useMe` already imported — just wire it

### 4. Vote optimistic update doesn't reflect on feed cards
`useVote` patches `['post', id]` cache (single post). Feed reads from `['feed', ...]` cache (array).
Cards show stale count until `onSettled` invalidates feed.
- Fix option A: also patch the matching post inside the feed cache array in `useVote`'s `onMutate`
- Fix option B: accept eventual consistency (current behavior) — simple, low risk

### 5. Other users' profiles not fetchable
`/profile/[username]` always renders own profile regardless of param.
- Needs: `GET /api/profile/:username` backend endpoint
- Needs: `useProfile(username)` hook
- Needs: page reads param and conditionally calls own vs other profile hook

---

## Missing Features / UX

### 6. No loading skeletons
All pages show plain "Loading…" text. Low priority but improves perceived performance.
- Add skeleton components for PostCard, CommunityRow, CommentItem

### 7. No error boundaries
Unhandled React Query errors crash page silently (no UI shown).
- Add `error.tsx` per route segment or a root `error.tsx`

### 8. Cloudinary env var fallback
If `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` or `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` not set,
`uploadImage()` throws but `/posts/new` shows no user-facing error for this specific case.
- Add env check on page mount, disable image dropzone with warning if vars missing

### 9. Post images on detail page
`/posts/[id]` shows images stacked full-width. Should respect aspect ratio, allow lightbox/expand.

### 10. Reply (threaded comment) UI
`useAddComment` supports `parent_id` but `/posts/[id]` has no Reply button wired up.
- Add Reply button per comment → inline composer → pass `parent_id` to mutation

### 11. Create Community flow
`/communities` has `+ New` button with no action. `useCreateCommunity` hook exists.
- Wire button to modal/page with name, description, category fields

### 12. Profile edit page
`/profile/[username]` has "Edit profile" button → navigates to `/profile/edit` which doesn't exist.
- Create `app/profile/edit/page.tsx` wired to `useMyProfile` + `useUpdateProfile`

### 13. AppNav active state for `/posts/new`
AppNav marks `/posts/*` as active under Feed tab. Creating a post feels like it's in Feed section.
- Minor UX: either separate nav state or accept current behavior

---

## Admin Panel (Not Started)

### 16. Build frontend admin panel
Backend fully built at `/api/admin/*` — colleges, domains, campuses CRUD + active/inactive toggling.
Zero frontend pages exist. All behind `authenticate + requireAdmin`.
- Need: `/admin` route (guard: `is_admin` check)
- Need: Colleges list + create + rename + toggle active
- Need: Per-college: domains list + add + toggle active
- Need: Per-college: campuses list + add + toggle active

---

## Performance

### 14. QueryClient created inside component
`const queryClient = new QueryClient()` is at module level in `context.tsx` — this is fine for Next.js
but means a single shared instance across all renders. Consider `useState(() => new QueryClient())`
to get a fresh instance per React tree (matters for SSR/testing).

### 15. Socket not disconnected on logout
`useLogout` clears token + cache + redirects but never calls `disconnectSocket()`.
Socket stays open until page reload.
- Fix: call `disconnectSocket()` inside `useLogout`
