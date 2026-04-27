# Peerly

A campus-scoped social platform for college communities. Students share posts, vote, discuss in nested comments, and chat in real-time community rooms — all within their own campus.

## Tech Stack

**Backend** — Express 5 · TypeScript · Supabase (PostgreSQL) · Socket.io · Upstash Redis · Nodemailer · Zod · Winston

**Frontend** — Next.js 16 · React 19 · Tailwind CSS v4 · TanStack Query · Axios · Cloudinary

## Features

- **Multi-tenant auth** — Campus-scoped accounts with email OTP verification and Google OAuth. Custom JWT, password reset via email.
- **Feed** — Personal campus feed and a global cross-campus feed. Infinite scroll, skeleton loading states.
- **Posts** — Rich posts with image carousels (Cloudinary), upvote/downvote, nested comments up to 4 levels deep with collapsible threads.
- **Communities** — Campus communities with real-time chat via Socket.io. Join-gated message history, infinite scroll with date separators, live typing indicators.
- **Profiles** — Public user profiles, editable profile pages, avatar uploads.
- **Admin panel** — Domain/campus management, college administration.

## Project Structure

```
peerly-backend/    Express 5 API + Socket.io server
peerly-frontend/   Next.js 16 app
```

## Getting Started

### Prerequisites

- Node.js 20+
- A Supabase project
- Upstash Redis instance
- Cloudinary account
- Gmail account (for transactional email)

### Backend

```bash
cd peerly-backend
cp .env.example .env   # fill in your values
npm install
npm run dev
```

Required env vars:

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (bypasses RLS) |
| `JWT_SECRET` | Secret for signing JWTs (min 32 chars) |
| `FRONTEND_URL` | Frontend origin (for CORS) |
| `PORT` | Server port (default 5000) |
| `GMAIL_USER` | Gmail address for sending email |
| `GMAIL_APP_PASSWORD` | Gmail app password |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `REDIS_URL` | Redis connection URL (default `redis://localhost:6379`) |

### Frontend

```bash
cd peerly-frontend
cp .env.example .env.local   # fill in your values
npm install
npm run dev
```

Required env vars:

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `NEXT_PUBLIC_API_URL` | Backend base URL |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google OAuth client ID (optional — disables Google button if absent) |

## Architecture Notes

**Auth** — JWT stored in `localStorage` as `peerly_token`. The Axios instance in `lib/api.ts` attaches it on every request. On 401 it clears the token and redirects to `/auth/login`.

**Multi-tenancy** — Every content table is scoped by `campus_id`. The auth middleware verifies the JWT, fetches the user profile, and attaches `req.user` (including `campusId`) to every request.

**Supabase clients** — The backend uses two clients: `supabaseAdmin` (service role, bypasses RLS) for privileged ops and `supabaseAnon` (anon key) for user-scoped queries. Never use `supabaseAdmin` where `supabaseAnon` is sufficient.

**Real-time** — Community chat runs over Socket.io WebSockets, not Supabase Realtime.

**Images** — Compressed to under 1 MB on the frontend before upload to Cloudinary. Only the returned URL is stored in Supabase.

## Scripts

```bash
# Backend
npm run dev      # ts-node-dev hot reload
npm run build    # tsc → dist/
npm start        # run compiled output
npm test         # jest
npm run seed     # seed database

# Frontend
npm run dev      # Next.js dev server
npm run build    # production build
npm run lint     # eslint
```
