# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Structure

Two packages at the root:
- `peerly-backend/` — Express 5 + TypeScript API
- `peerly-frontend/` — Next.js 16 + React 19 + Tailwind CSS v4

Full project design and architecture: see `PROJECT.md`.

## Commands

**Backend**
```bash
cd peerly-backend
npm run dev       # ts-node-dev with hot reload
npm run build     # tsc compile to dist/
npm start         # run compiled output
```

**Frontend**
```bash
cd peerly-frontend
npm run dev       # Next.js dev server
npm run build     # production build
npm run lint      # eslint
```

## Critical: Next.js 16

Next.js 16 has breaking changes from what most training data covers. Before touching routing, middleware, or data-fetching patterns, read the relevant guide in `peerly-frontend/node_modules/next/dist/docs/`.

## Key Architecture Decisions

**Auth:** Custom JWT stored in `localStorage` as `peerly_token`. The axios instance in `lib/api.ts` attaches it automatically. On 401, it clears the token and redirects to `/auth/login`.

**Dual Supabase clients (backend):**
- `supabaseAdmin` (service role) — bypasses RLS, used for privileged operations
- `supabaseAnon` (anon key) — respects RLS, used for user-scoped queries
Never use `supabaseAdmin` where `supabaseAnon` is sufficient.

**Multi-tenancy:** All content is scoped to `campus_id`. The auth middleware attaches `req.user` (with `campusId`) after verifying the JWT and fetching the profile from Supabase.

**Database types:** Kept in `peerly-frontend/types/database.ts` and imported by both frontend and backend config. This is the source of truth for table shapes.

**Real-time:** Communities use Socket.io WebSockets (not Supabase Realtime).

**Images:** Always compress to <1MB on the frontend before uploading to Cloudinary. Save returned URLs to Supabase, never raw files.

## Environment Variables

Backend needs: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `JWT_SECRET`, `FRONTEND_URL`, `PORT`

Frontend needs: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_URL`

## Hard Rules

**NEVER read `.env` or `.env.*` files.** These contain live credentials. Reference `.env.example` files only for variable names. Do not read, display, or suggest content from actual env files under any circumstances.
