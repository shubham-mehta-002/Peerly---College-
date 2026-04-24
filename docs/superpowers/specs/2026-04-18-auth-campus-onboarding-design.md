# Auth + Campus Onboarding — Backend API Design

**Date:** 2026-04-18  
**Scope:** `peerly-backend` — auth, admin college/domain/campus management, user onboarding

---

## 1. Architecture

Domain-driven module structure (Option B):

```
src/
  modules/
    auth/
      auth.router.ts
      auth.controller.ts
      auth.service.ts
      auth.types.ts
    admin/
      admin.router.ts
      admin.controller.ts
      admin.service.ts
      admin.types.ts
    onboarding/
      onboarding.router.ts
      onboarding.controller.ts
      onboarding.service.ts
      onboarding.types.ts
  middleware/
    authenticate.ts      — verifies JWT, fetches profile, attaches req.user
    requireAdmin.ts      — checks req.user.isAdmin, returns 403 if false
  lib/
    supabase.ts          — exports supabaseAdmin (service role) + supabaseAnon (anon key)
    jwt.ts               — sign + verify helpers
  app.ts                 — express app setup, routes, middleware
  server.ts              — http server entry point
```

---

## 2. Database Schema

### `colleges`
| column | type | notes |
|--------|------|-------|
| id | uuid PK | default gen_random_uuid() |
| name | text | e.g. "IIT Bombay" |
| is_active | boolean | default true |
| created_at | timestamptz | default now() |

### `college_domains`
| column | type | notes |
|--------|------|-------|
| id | uuid PK | |
| college_id | uuid FK → colleges | |
| domain | text unique | e.g. "iitb.ac.in" |
| is_active | boolean | default true |

### `campuses`
| column | type | notes |
|--------|------|-------|
| id | uuid PK | |
| college_id | uuid FK → colleges | |
| name | text | e.g. "Main Campus" |
| is_active | boolean | default true |
| created_at | timestamptz | default now() |

### `users`
| column | type | notes |
|--------|------|-------|
| id | uuid PK | default gen_random_uuid() |
| email | text unique | |
| password_hash | text | bcrypt |
| is_admin | boolean | default false |
| created_at | timestamptz | default now() |

### `profiles`
| column | type | notes |
|--------|------|-------|
| id | uuid PK FK → users | 1:1 with users |
| name | text | set during onboarding |
| username | text unique | set during onboarding |
| bio | text nullable | optional |
| campus_id | uuid FK → campuses, nullable | null until onboarding complete |
| onboarding_completed | boolean | default false |
| avatar_url | text nullable | Cloudinary URL, set later |
| updated_at | timestamptz | default now() |

---

## 3. API Endpoints

### Auth — `/api/auth`

#### `POST /api/auth/register`
**Body:** `{ email, password }`  
**Logic:**
1. Extract domain from email
2. Find `college_domains` row: `domain = extracted AND is_active = true`
3. Verify parent `colleges` row: `is_active = true`
4. Verify at least one `campuses` row for that college: `is_active = true`
5. Hash password with bcrypt
6. Insert into `users`, insert empty `profiles` row (`onboarding_completed = false`)
7. Return JWT + `{ onboarding_completed: false }`

**Errors:**
- `403` Domain not recognized
- `403` Your institution is not currently active
- `403` No active campus available for your institution
- `409` Email already registered

#### `POST /api/auth/login`
**Body:** `{ email, password }`  
**Logic:** Verify password, fetch profile, return JWT + `{ onboarding_completed }`  
**Errors:** `401` Invalid credentials

#### `GET /api/auth/me`
**Auth required.**  
Returns current `users` + `profiles` row merged.

---

### Admin — `/api/admin`
All endpoints require `[authenticate + requireAdmin]`.

#### Colleges
| Method | Path | Body | Description |
|--------|------|------|-------------|
| POST | `/colleges` | `{ name }` | Create college |
| GET | `/colleges` | — | List all colleges (with domain + campus counts) |
| PATCH | `/colleges/:id` | `{ name?, is_active? }` | Rename or toggle active |

#### Domains
| Method | Path | Body | Description |
|--------|------|------|-------------|
| POST | `/colleges/:id/domains` | `{ domain }` | Add domain to college |
| PATCH | `/colleges/:id/domains/:domainId` | `{ is_active }` | Toggle domain active |

#### Campuses
| Method | Path | Body | Description |
|--------|------|------|-------------|
| POST | `/colleges/:id/campuses` | `{ name }` | Add campus |
| GET | `/colleges/:id/campuses` | — | List campuses for college |
| PATCH | `/colleges/:id/campuses/:campusId` | `{ name?, is_active? }` | Update campus |

---

### Onboarding — `/api/onboarding`
All endpoints require `[authenticate]`.

#### `GET /api/onboarding/campuses`
Returns active campuses filtered by user's college domain.  
**Logic:** Look up user's email domain → find college → return campuses where `is_active = true`.

#### `POST /api/onboarding/complete`
**Body:** `{ name, username, bio? (optional), campus_id }`  
**Logic:**
1. Validate `campus_id` belongs to user's college and is active
2. Check `username` is unique
3. Update `profiles` row
4. Set `onboarding_completed = true`
5. Issue new JWT with `campusId` populated

**Errors:**
- `400` Invalid campus for your institution
- `409` Username already taken
- `400` Onboarding already completed

---

## 4. JWT

**Payload:** `{ userId, email, isAdmin, campusId }`  
- `campusId` is `null` until onboarding completes  
- After `POST /onboarding/complete` → new JWT issued with `campusId` set  
- `authenticate` middleware verifies token, fetches fresh profile, attaches full `req.user`

**Signing:** `JWT_SECRET` env var, expires per `JWT_EXPIRES_IN` (default `7d`)

---

## 5. Middleware

### `authenticate.ts`
1. Extract Bearer token from `Authorization` header
2. Verify with `jwt.verify`
3. Fetch profile from Supabase using `userId`
4. Attach `req.user = { userId, email, isAdmin, campusId, onboardingCompleted }` 
5. `401` if missing/invalid token

### `requireAdmin.ts`
Runs after `authenticate`. Checks `req.user.isAdmin`. Returns `403` if false.

---

## 6. Rate Limiting

`express-rate-limit` applied to `/api/auth/*` only:
- Window: 15 minutes
- Max: 20 requests per IP

---

## 7. Seeded Admin

One user pre-seeded directly in the `users` table with `is_admin = true`. They never go through `POST /register` — they use `POST /login` directly. No domain validation applies at login, only at registration. No special-casing needed in code.
