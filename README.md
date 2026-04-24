# Peerly — Manual Testing Guide

Peerly is a multi-tenant college social platform. Each college is isolated — students only see content from their own campus. Two core pillars: **Feed** (Instagram-style posts with voting/comments) and **Communities** (WhatsApp-style real-time group chat).

---

## Running the Project

### Prerequisites

- Node.js 18+
- npm 9+

### 1. Backend

```bash
cd peerly-backend
npm install
npm run dev
```

Backend runs at: `http://localhost:5000`  
Health check: `http://localhost:5000/health`

### 2. Frontend

Open a **new terminal**:

```bash
cd peerly-frontend
npm install
npm run dev
```

Frontend runs at: `http://localhost:3000`

> Both must be running simultaneously for the app to work.

---

## Core Functionalities

| Area | What It Does |
|------|-------------|
| **Auth** | Email/password signup + login, Google OAuth, email domain gating (one domain = one college), OTP verification, password reset |
| **Onboarding** | First-time campus selection and profile setup wizard |
| **Feed** | Campus-scoped post feed with hot/new/top sorting, upvote/downvote, image support |
| **Global Feed** | Cross-college post discovery (read-only) |
| **Posts** | Create, view, delete posts with images; threaded comments up to 4 levels deep |
| **Comments** | Nested replies, timestamps, collapsible threads |
| **Communities** | Create/join/leave chat groups; member cap 200; role-based access (owner/mod/member) |
| **Community Chat** | Real-time messaging via WebSocket, image sharing, typing indicators, infinite scroll message history |
| **Profile** | View/edit display name, bio, avatar; view any user's public profile |
| **Admin** | Manage colleges, view platform-wide data (admin-only) |

---

## Pages & What to Test

### `/` — Home / Landing

- [ ] Loads without errors
- [ ] Redirects logged-in users to `/feed`
- [ ] Redirects unauthenticated users to `/auth/login`

---

### `/auth/login` — Login

- [ ] Login with valid email + password → redirected to `/feed`
- [ ] Login with wrong password → error message shown, page does **not** reload
- [ ] Login with unregistered email → appropriate error shown
- [ ] "Forgot password?" link navigates to `/auth/forgot-password`
- [ ] Google OAuth button initiates OAuth flow

---

### `/auth/forgot-password` — Forgot Password

- [ ] Submit registered email → success message shown
- [ ] Submit unregistered email → appropriate error shown
- [ ] Reset email is received with a working link

---

### `/auth/reset-password` — Reset Password

- [ ] Accessible only via the link in the reset email
- [ ] Submit new password → success, redirected to login
- [ ] Submit mismatched passwords → validation error
- [ ] Expired/invalid token → error message shown

---

### `/onboarding` — Onboarding Wizard

- [ ] Shown only to users who haven't completed setup
- [ ] Campus selection works — dropdown/search populated
- [ ] Submitting incomplete form shows validation errors
- [ ] Completing onboarding redirects to `/feed`
- [ ] Already-onboarded users are redirected away from this page

---

### `/feed` — Campus Feed

- [ ] Posts load for the user's campus only
- [ ] Skeleton loading state shown while fetching
- [ ] Sorting: Hot / New / Top tabs all work and show different ordering
- [ ] Upvote / downvote on a post updates the count
- [ ] Voting state persists on page refresh
- [ ] Empty state shown when no posts exist
- [ ] Clicking a post navigates to `/posts/[id]`
- [ ] "+ Post" button navigates to post creation

---

### `/global-feed` — Global Feed

- [ ] Posts from multiple colleges visible
- [ ] Campus badge/label shows which college each post is from
- [ ] Voting and interaction same as campus feed
- [ ] Empty state shown if no global posts

---

### `/posts/new` or `/create-post` — Create Post

- [ ] Text-only post can be created
- [ ] Post with image: image uploads, preview shown before submit
- [ ] Image > 1MB is compressed automatically before upload
- [ ] Submitting empty form shows validation error
- [ ] Successful post creation redirects to feed or post detail
- [ ] Newly created post appears in feed

---

### `/posts/[id]` — Post Detail + Comments

- [ ] Post content (text + image if any) displays correctly
- [ ] Upvote/downvote works
- [ ] Comments load with correct nesting (up to 4 levels deep)
- [ ] Deeply nested replies (level 4+) are flattened, not indented further
- [ ] Comment threads are collapsible
- [ ] Reply to a comment works → reply appears nested under parent
- [ ] Timestamps shown on comments
- [ ] Author name shown on post and each comment
- [ ] Post author can delete their own post
- [ ] Skeleton shown while post/comments load

---

### `/communities` — Community List

- [ ] All campus communities listed
- [ ] Joined communities visually distinguished from non-joined
- [ ] "Create community" option available
- [ ] Clicking a community navigates to `/communities/[id]`
- [ ] Skeleton shown while loading

---

### `/communities/[id]` — Community Chat

- [ ] Non-members see a **join gate** (lock screen with join button)
- [ ] Joining a community unlocks the chat
- [ ] Empty state shown when no messages yet
- [ ] Messages load (latest 30 first), older messages load on scroll up
- [ ] Scroll position preserved when older messages load (no jump to top)
- [ ] Date separators (Today / Yesterday / full date) shown between days
- [ ] Each message shows HH:MM timestamp
- [ ] Sending a message appears instantly in chat
- [ ] Typing indicator appears when another user is typing
- [ ] Typing indicator disappears after user stops typing (~2 seconds)
- [ ] Image can be sent in chat
- [ ] Leaving a community removes access

---

### `/profile` — Own Profile

- [ ] Displays current user's name, bio, avatar, and posts
- [ ] Skeleton shown while loading
- [ ] Edit button navigates to `/profile/edit`

---

### `/profile/edit` — Edit Profile

- [ ] Current values pre-filled in form
- [ ] Change display name → saved correctly
- [ ] Change bio → saved correctly
- [ ] Upload new avatar → preview shown, saved on submit
- [ ] Submitting unchanged form works without error
- [ ] Cancel/back returns to profile without saving

---

### `/profile/[username]` — Public Profile

- [ ] Displays another user's name, bio, avatar, and posts
- [ ] No edit button shown
- [ ] Posts listed belong to that user only

---

### `/admin` — Admin Dashboard *(admin accounts only)*

- [ ] Inaccessible to non-admin users (403 or redirect)
- [ ] Admin can view all colleges
- [ ] Admin can navigate to `/admin/colleges/[id]` for details

---

### `/admin/colleges/[id]` — College Detail *(admin only)*

- [ ] College info displayed correctly
- [ ] Admin can update college name/domain

---

## Cross-Cutting Checks

- [ ] **Dark mode toggle** — applies globally, persists on refresh
- [ ] **Auth guard** — all protected pages redirect to `/auth/login` when logged out
- [ ] **Token expiry** — after token expires, user is logged out and redirected to login
- [ ] **Multi-tenancy isolation** — users from College A cannot see posts or communities from College B
- [ ] **Responsive layout** — pages usable on mobile screen widths
- [ ] **No console errors** — browser console clean on each page load
