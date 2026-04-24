# Handoff: Peerly — Full Frontend Design Reference

## Overview
Peerly is a multi-tenant college social app with two core pillars: a **Feed** (Instagram-style posts) and **Communities** (WhatsApp-style real-time group chat). This handoff covers all 11 screens of the MVP frontend.

## About the Design Files
The file `Peerly Design Reference.html` in this bundle is a **high-fidelity interactive design prototype** built in HTML/React/Babel. It is a design reference — **not production code to ship directly**.

Your task is to **recreate these designs in the existing codebase**: Next.js 16 + React 19 + Tailwind CSS v4. Use the established patterns, routing conventions, and libraries already in the project. The HTML prototype is the visual and interaction source of truth.

## Fidelity
**High-fidelity.** Pixel-accurate colors, typography, spacing, and interactions are specified. Recreate the UI exactly using Tailwind utilities and existing component patterns.

---

## Design Tokens

### Colors (CSS variables — map to Tailwind config)
```
--background: #FAFAF8   (dark: #141412)
--foreground: #1A1917   (dark: #F0EEE8)
--muted:      #706E69   (dark: #9E9B95)
--accent:     #2D6A4F   (dark: #4CAF7D)   ← sage green (default)
--border:     #E2E0DA   (dark: #2E2D2A)
--card:       #F4F3EF   (dark: #1E1D1B)
```
Accent color variants (user-selectable):
- Sage:  light `#2D6A4F` / dark `#4CAF7D`
- Navy:  light `#1E3A5F` / dark `#5B8FCC`
- Terra: light `#8B4513` / dark `#D4845A`

### Typography
- **Font**: Inter (already standard)
- **Base size**: 15px
- **Scale**: 11px (labels) → 12px (meta) → 13px (secondary) → 14px (body/UI) → 15px (base) → 16px (large body) → 17px (post detail) → 20px (subheadings) → 22px (page titles) → 28px (auth wordmark)
- **Weights**: 400 (body), 500 (medium), 600 (semibold/headings), 700 (nav brand)

### Spacing
- Content max-width: 660px (feed/profile), 600px (create post), 700px (chat)
- Content padding: `32px 24px`
- Nav height: 58px, padding: `3px 24px`
- Card padding (bordered/filled): `18px 20px`
- Gap between posts (non-open layout): 10px

### Border Radius
- Buttons: 8px (md), 7px (nav CTA)
- Cards: 10px
- Inputs: 8px
- Avatar: 50%
- Community icons: 10px
- Chat bubbles: 14px (self-referencing corners for mine/theirs)
- Toggle: 999px (pill)

### Shadows
None used — depth via borders and background color differences only.

---

## Screens

### 1. Login / Sign Up — `/auth/login`, `/auth/signup`
**Purpose**: Email/password auth + Google OAuth. Domain-gated — only whitelisted college emails allowed.

**Layout**: Full-page centered column. Max-width 400px card.

**Components**:
- Wordmark "Peerly" — 28px, weight 700, letter-spacing -0.5px, centered
- Tagline — 14px, `--muted`
- Tab bar (Sign in / Create account) — borderBottom active indicator `2px solid --accent`
- Email input, Password input — 14px, border `--border`, radius 8px, padding `10px 12px`
- "Forgot password?" — 13px, `--accent` color, right-aligned
- Primary CTA button — full width, `--accent` bg, white text, radius 8px, padding `10px 18px`
- Divider with "or" label
- Google OAuth button — secondary variant with Google SVG icon
- Sign Up: additional notice box (`--card` bg, `--border` border, 13px `--muted`) + Confirm password field
- Footer legal text — 12px `--muted`, max-width 320px

**Interactions**:
- Tab switches between Sign in / Create account views
- "Forgot password?" → navigates to `/auth/forgot-password`
- Sign in CTA → navigates to campus feed (after JWT stored)
- Create account CTA → navigates to `/onboarding`

---

### 2. Forgot Password — `/auth/forgot-password`
**Purpose**: Trigger password reset email via Resend.

**Layout**: Full-page centered, max-width 400px. Two states: form / sent confirmation.

**State 1 (form)**:
- Back link "← Back to sign in" — 13px `--muted`
- H1 "Reset your password" — 22px, weight 600
- Body copy — 14px `--muted`, line-height 1.6
- Email input
- "Send reset link" button — disabled until email non-empty

**State 2 (sent)**:
- Envelope icon in circle (`--card` bg, `--border` border, 56px)
- H1 "Check your inbox" — 20px, weight 600
- Body with bolded email address
- "Resend email" secondary button
- "Back to sign in" text link

---

### 3. Reset Password — `/auth/reset-password` (consumes token from URL)
**Purpose**: Set new password after clicking email link.

**Layout**: Full-page centered, max-width 400px. Two states: form / success.

**State 1 (form)**:
- H1 "Choose a new password" — 22px, weight 600
- New password input + live strength meter:
  - 3-segment bar, height 3px, radius 99px
  - Weak: `#C0392B`, Good: `#E67E22`, Strong: `--accent`
  - Label text alongside bar
- Confirm password input — error state "Passwords don't match"
- CTA disabled until: password ≥ 8 chars, confirm matches

**State 2 (success)**:
- Accent circle with ✓ (56px, `--accent` bg, white text)
- "Password updated" heading, body copy, "Back to sign in" button

---

### 4. Onboarding Wizard — `/onboarding`
**Purpose**: 3-step wizard: Campus → Profile Details → Done. Guarded by `is_profile_completed = false`.

**Layout**: Full-page centered, max-width 480px card.

**Step indicator**: 3 nodes connected by lines. Active/completed = `--accent` bg + white text. Inactive = `--border` bg. Labels in 11px uppercase below each node.

**Step 1 — Campus Selection**:
- H2 "Select your campus" + body copy
- Campus options as large tappable buttons — selected state: `--accent` border + `rgba(45,106,79,.07)` bg + weight 600
- "Continue →" button right-aligned, disabled until selection

**Step 2 — Profile Details**:
- Full name, Username (with debounced availability check — hint text changes: "Checking…" → "✓ Username is available" / error "This username is taken")
- Bio (multiline, 2 rows), Course (optional)
- Back / Save & Continue buttons

**Step 3 — Done**:
- 64px accent circle with ✓
- "You're in." heading, body copy with campus name
- "Go to my feed →" button (large)

---

### 5. Campus Feed — `/feed` (campus scope)
### 6. Global Feed — `/feed?scope=global`
**Purpose**: Scrollable post feed with filter tabs.

**Layout**: `ContentShell` — sticky 58px nav + scrollable content, max-width 660px centered.

**Nav (AppNav)**:
- Height: 58px, padding: `3px 24px`
- Left: "Peerly" wordmark 15px weight 700
- Center: Feed / Communities / Profile links — 14px, active weight 600 foreground, inactive muted
- Right: "+ Post" button — 30px height, `0 18px` padding, 12px font, 7px radius, `--accent` bg

**Feed tabs**: Campus Feed / Global Feed — 14px, active `2px solid --foreground` bottom border

**Filter pills**: Trending / Latest / Oldest / Most Upvoted — active: `--accent` bg + white, inactive: transparent + `--border` border

**PostCard** (3 layout variants, toggled via Tweaks):
- **Open**: no bg/border, `1px solid --border` bottom, `20px 0` padding
- **Bordered**: `--background` bg, `1px solid --border` border, `10px` radius, `18px 20px` padding
- **Filled**: `--card` bg, no border, `10px` radius, `18px 20px` padding

**PostCard internals**:
- Header: Avatar (34px) + author name (13px weight 600) or AnonLabel + time (12px `--muted`) + optional "Global" badge (12px `--accent`)
- Body: 15px, line-height 1.6
- Image placeholder: `--border` bg, 180px height, 8px radius
- Footer: ↑ upvotes (colored `--accent` when voted), ↓ (hidden count), 💬 comment count, "Trending" badge (11px uppercase `--accent`)

**Anonymous display** (3 style variants):
- **Badge**: pill with `◯` prefix, `--card` bg, `--border` border, 12px `--muted`
- **Ghost**: italic `--muted` text only
- **Inline**: plain `--muted` text

---

### 7. Post Detail — `/posts/[id]`
**Purpose**: Full post + threaded comments + comment composer.

**Layout**: Same ContentShell. Back link → feed.

**Post section**: Full post at 17px, actions bar (↑ count, ↓, comment count, Trending), bordered bottom.

**Comment composer**: Avatar (32px) + expanding textarea. Cancel/Post buttons appear when textarea has content.

**Comment thread**: Self-referencing depth indent — `depth * 28px` left padding. Levels 0–3 visible. Avatar (30px), author/AnonLabel, time, text (14px line-height 1.6), ↑ count + Reply actions.

---

### 8. Create Post — `/posts/new`
**Purpose**: Compose a new post with optional image, anonymous toggle, global toggle.

**Layout**: ContentShell max-width 600px.

**Author preview**: Updates live as toggles change — shows AnonLabel when anonymous, shows "Visible globally" sub-label when global.

**Textarea**: Full-width, transparent bg, no border, `1px solid --border` bottom only. 16px, line-height 1.65. Character counter (500 limit) right-aligned, turns `#C0392B` at 85% usage.

**Image dropzone**: Dashed `--border` border, `--card` bg, 10px radius. Hint: "Up to 4 images · max 1 MB each (auto-compressed)". Integrate with react-dropzone + browser-image-compression + Cloudinary.

**Toggle group**: Bordered container (10px radius, overflow hidden). Two rows: "Post anonymously" + "Share globally". Each row: label + description + pill toggle. Toggle: 40×22px, `--accent` when on.

**CTA**: "Publish post" large button, right-aligned, disabled until content non-empty.

---

### 9. Communities — `/communities`
**Purpose**: Discover and search campus communities.

**Layout**: ContentShell, max-width 660px.

**Header**: H1 + campus name sub-label + "+ New" button right.

**Tabs**: Discover / Joined (count). Active: `2px solid --foreground` bottom.

**Search**: Input with `⌕` icon, `--card` bg.

**Category pills**: All / Technical / Cultural / Sports — same active/inactive style as feed filters.

**Community row**: 44px icon square (10px radius, `--card` bg, emoji) + name (14px weight 600) + category badge (11px, `--card` bg, `--border` border, 4px radius) + description (13px `--muted`, ellipsis) + member count (right-aligned, 13px weight 600).

---

### 10. Community Chat — `/communities/[id]`
**Purpose**: Real-time group chat via Socket.io.

**Layout**: Full height flex column (no ContentShell). No scroll on outer container — messages area scrolls internally.

**Chat nav**: 52px, back arrow + community name (14px weight 600) + member count (12px `--muted`) + ⋯ options.

**Pinned announcement**: `--card` bg strip, "PINNED" label in 11px uppercase `--accent` + message text (13px `--muted`, ellipsis).

**Messages area**: `flex: 1`, overflow-y auto, 20px padding, 16px gap. Auto-scroll to bottom on new message.

**Message bubble**:
- Mine: right-aligned, `--accent` bg, white text, radius `14px 14px 4px 14px`
- Theirs: left-aligned, `--card` bg, `--border` border, radius `14px 14px 14px 4px`
- Font: 14px, line-height 1.5
- Sender name (theirs only, first in group): 12px weight 600 `--muted`
- Timestamp: 11px `--muted`, below bubble, aligned to message side

**Composer**: `--card` bg textarea (radius 22px, border `--border`), send button (38px circle, `--accent` when input non-empty). Enter sends, Shift+Enter newline.

---

### 11. Profile — `/profile/[username]`
**Purpose**: View own profile — stats, posts, communities.

**Layout**: ContentShell.

**Header**: Avatar (68px) + name (20px weight 600) + @handle (13px `--muted`) + bio (14px `--muted`) + stats row (Posts / Upvotes / Communities — 16px weight 600 value + 12px `--muted` label) + "Edit profile" secondary button.

**Tabs**: Posts / Anonymous — same tab style. Anonymous tab shows privacy message only.

**Communities section**: Section label 11px uppercase `--muted`. Rows: 36px icon (8px radius) + name + member count.

**Footer**: "Account settings" / "Privacy" / "Sign out" — text links, Sign out in `#C0392B`.

---

## Interactions & Behavior

| Interaction | Behavior |
|---|---|
| Vote (↑/↓) | Optimistic update via TanStack Query, rollback on server error |
| Username check | Debounced 600ms API call to `/api/auth` username check endpoint |
| Anonymous toggle | Live updates author preview in Create Post |
| Chat send | Enter key or send button; appends to messages, clears input |
| Dark mode | CSS class toggle on `<html>`, persisted to localStorage |
| Post → Post Detail | Client-side navigation, back link returns to feed |

---

## Anonymous Display Rules (implement exactly)
- **Global Feed**: "Anonymous @ {University Name}"
- **Campus Feed**: "Anonymous Peer"
- **Communities**: No anonymity — always show real username

---

## Tech Notes for Implementation
- Auth: JWT in `localStorage` as `peerly_token`, Axios interceptor auto-attaches
- Routing: Next.js App Router. Guard `/onboarding` via middleware on `is_profile_completed`
- Real-time: Socket.io, subscribe per `community_id` on mount, unsubscribe on unmount
- Images: react-dropzone → browser-image-compression (<1MB) → Cloudinary → save URLs
- Votes: TanStack Query `useMutation` with `onMutate` optimistic update + `onError` rollback
- Feed sorting: separate API call per filter (`/api/posts?sort=trending|latest|oldest|upvotes`)

---

## Files in This Package
| File | Description |
|---|---|
| `Peerly Design Reference.html` | Full interactive prototype — open in browser to review all screens |
| `README.md` | This handoff document |
