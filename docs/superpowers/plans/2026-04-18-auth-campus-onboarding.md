# Auth + Campus Onboarding — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Express 5 + TypeScript backend for auth (register/login), admin college/domain/campus management, and user onboarding.

**Architecture:** Domain-driven modules under `src/modules/`. Each module owns its router, controller, service, and types. Shared middleware in `src/middleware/`, shared libs in `src/lib/`.

**Tech Stack:** Express 5, TypeScript 6, Supabase JS v2 (supabaseAdmin for all DB ops), bcryptjs, jsonwebtoken, zod (env + request validation), winston (logging), morgan (HTTP request logging), jest + ts-jest + supertest for tests.

---

## File Map

```
peerly-backend/
  src/
    config/
      index.ts            — Zod-validated env config, process.exit(1) on missing vars
    lib/
      errors.ts           — AppError class
      logger.ts           — Winston logger (JSON in prod, colorized in dev)
      supabase.ts         — supabaseAdmin + supabaseAnon exports
      jwt.ts              — signToken + verifyToken helpers
      validate.ts         — validateBody(schema) Express middleware using Zod
    middleware/
      authenticate.ts     — JWT verify + profile fetch → req.user
      requireAdmin.ts     — checks req.user.isAdmin
    modules/
      auth/
        auth.types.ts
        auth.service.ts
        auth.controller.ts
        auth.router.ts
      admin/
        admin.types.ts
        admin.service.ts
        admin.controller.ts
        admin.router.ts
      onboarding/
        onboarding.types.ts
        onboarding.service.ts
        onboarding.controller.ts
        onboarding.router.ts
    app.ts                — express app, routes wired
    server.ts             — http listen entry point
  database/
    schema.sql            — full Supabase schema + admin seed
  jest.config.ts
  src/__tests__/
    auth.service.test.ts
    admin.service.test.ts
    onboarding.service.test.ts
```

---

## Task 1: Install test dependencies + configure Jest

**Files:**
- Modify: `peerly-backend/package.json`
- Create: `peerly-backend/jest.config.ts`

- [ ] **Step 1: Install all runtime + dev dependencies**

```bash
cd peerly-backend
npm install zod winston morgan
npm install --save-dev jest ts-jest @types/jest supertest @types/supertest @types/morgan @types/winston
```

Expected: `zod`, `winston`, `morgan` in `dependencies`; jest + type packages in `devDependencies`.

- [ ] **Step 2: Add test script to package.json**

Open `peerly-backend/package.json`, add `"test": "jest"` to the `scripts` block:

```json
{
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "test": "jest"
  }
}
```

- [ ] **Step 3: Create jest.config.ts**

Create `peerly-backend/jest.config.ts`:

```typescript
import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  clearMocks: true,
};

export default config;
```

- [ ] **Step 4: Verify jest runs**

```bash
cd peerly-backend
npx jest --passWithNoTests
```

Expected: `Test Suites: 0 passed` (no tests yet, exits 0).

- [ ] **Step 5: Commit**

```bash
cd peerly-backend
git add package.json package-lock.json jest.config.ts
git commit -m "chore: add jest + ts-jest test setup"
```

---

## Task 2: Database schema + seed SQL

**Files:**
- Create: `peerly-backend/database/schema.sql`

- [ ] **Step 1: Create the schema file**

Create `peerly-backend/database/schema.sql`:

```sql
-- ============================================
-- Peerly Database Schema
-- Run in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================

create table if not exists colleges (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists college_domains (
  id uuid primary key default gen_random_uuid(),
  college_id uuid not null references colleges(id) on delete cascade,
  domain text unique not null,
  is_active boolean not null default true
);

create table if not exists campuses (
  id uuid primary key default gen_random_uuid(),
  college_id uuid not null references colleges(id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists profiles (
  id uuid primary key references users(id) on delete cascade,
  name text,
  username text unique,
  bio text,
  campus_id uuid references campuses(id),
  onboarding_completed boolean not null default false,
  avatar_url text,
  updated_at timestamptz not null default now()
);

-- ============================================
-- Seed: Admin user
-- Default password: Admin@123456
-- IMPORTANT: Change this password after first login
-- ============================================
insert into users (email, password_hash, is_admin)
values (
  'admin@peerly.app',
  '$2b$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.',
  true
)
on conflict (email) do nothing;

insert into profiles (id)
select id from users where email = 'admin@peerly.app'
on conflict (id) do nothing;
```

> **Note on password hash:** The hash above is bcrypt for `Admin@123456`. To generate a different hash, run:
> ```bash
> node -e "const b = require('bcryptjs'); b.hash('YourPassword', 12).then(h => console.log(h))"
> ```
> Replace the hash in the insert statement.

- [ ] **Step 2: Run schema in Supabase**

Go to your Supabase project dashboard → SQL Editor → paste the contents of `schema.sql` → Run.

Expected: All 5 tables created, admin user + profile row seeded. No errors.

- [ ] **Step 3: Verify in Table Editor**

In Supabase dashboard → Table Editor: confirm `colleges`, `college_domains`, `campuses`, `users`, `profiles` tables exist. Confirm `users` has one row with `is_admin = true`.

- [ ] **Step 4: Commit**

```bash
cd peerly-backend
git add database/schema.sql
git commit -m "feat: add database schema and admin seed SQL"
```

---

## Task 3: Config + Core libs

**Files:**
- Create: `src/config/index.ts`
- Create: `src/lib/errors.ts`
- Create: `src/lib/logger.ts`
- Create: `src/lib/supabase.ts`
- Create: `src/lib/jwt.ts`
- Create: `src/lib/validate.ts`

- [ ] **Step 1: Create src/config/index.ts**

Validates all required env vars at startup. If any are missing or malformed, the process exits with a clear error — fail fast before the server binds to a port.

```typescript
import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.string().default('5000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),
  SUPABASE_ANON_KEY: z.string().min(1, 'SUPABASE_ANON_KEY is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error('❌ Invalid environment configuration:');
  result.error.errors.forEach((e) => {
    console.error(`  ${e.path.join('.')}: ${e.message}`);
  });
  process.exit(1);
}

export const config = result.data;
```

- [ ] **Step 2: Create src/lib/errors.ts**

```typescript
export class AppError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}
```

- [ ] **Step 3: Create src/lib/logger.ts**

```typescript
import { createLogger, format, transports } from 'winston';
import { config } from '../config';

const isProd = config.NODE_ENV === 'production';

export const logger = createLogger({
  level: isProd ? 'info' : 'debug',
  format: isProd
    ? format.combine(format.timestamp(), format.json())
    : format.combine(
        format.colorize(),
        format.timestamp({ format: 'HH:mm:ss' }),
        format.printf(({ timestamp, level, message, ...meta }) => {
          const extras = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
          return `${timestamp} ${level}: ${message}${extras}`;
        })
      ),
  transports: [new transports.Console()],
});
```

- [ ] **Step 4: Create src/lib/supabase.ts**

```typescript
import { createClient } from '@supabase/supabase-js';
import { config } from '../config';

export const supabaseAdmin = createClient(
  config.SUPABASE_URL,
  config.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

export const supabaseAnon = createClient(
  config.SUPABASE_URL,
  config.SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
);
```

- [ ] **Step 5: Create src/lib/jwt.ts**

```typescript
import jwt from 'jsonwebtoken';
import { config } from '../config';

export interface JWTPayload {
  userId: string;
  email: string;
  isAdmin: boolean;
  campusId: string | null;
}

export function signToken(payload: JWTPayload): string {
  return jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN,
  } as jwt.SignOptions);
}

export function verifyToken(token: string): JWTPayload {
  return jwt.verify(token, config.JWT_SECRET) as JWTPayload;
}
```

- [ ] **Step 6: Create src/lib/validate.ts**

```typescript
import { ZodSchema } from 'zod';
import { Request, Response, NextFunction } from 'express';

export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      res.status(400).json({ error: 'Validation failed', errors });
      return;
    }
    req.body = result.data;
    next();
  };
}
```

- [ ] **Step 7: Compile check**

```bash
cd peerly-backend
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 8: Commit**

```bash
cd peerly-backend
git add src/config/ src/lib/
git commit -m "feat: add config validation, logger, supabase clients, jwt, zod validate"
```

---

## Task 4: Middleware — authenticate + requireAdmin

**Files:**
- Create: `src/middleware/authenticate.ts`
- Create: `src/middleware/requireAdmin.ts`

- [ ] **Step 1: Create src/middleware/authenticate.ts**

```typescript
import { Request, Response, NextFunction } from 'express';
import { verifyToken, JWTPayload } from '../lib/jwt';
import { supabaseAdmin } from '../lib/supabase';
import { logger } from '../lib/logger';

declare global {
  namespace Express {
    interface Request {
      user: JWTPayload & {
        onboardingCompleted: boolean;
      };
    }
  }
}

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = verifyToken(token);

    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('onboarding_completed, campus_id')
      .eq('id', payload.userId)
      .single();

    if (error) {
      logger.warn('Profile fetch failed in authenticate middleware', {
        userId: payload.userId,
        error: error.message,
      });
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    req.user = {
      ...payload,
      campusId: profile?.campus_id ?? null,
      onboardingCompleted: profile?.onboarding_completed ?? false,
    };

    next();
  } catch (err) {
    logger.debug('Token verification failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
```

- [ ] **Step 2: Create src/middleware/requireAdmin.ts**

```typescript
import { Request, Response, NextFunction } from 'express';

export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user?.isAdmin) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}
```

- [ ] **Step 3: Compile check**

```bash
cd peerly-backend
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
cd peerly-backend
git add src/middleware/authenticate.ts src/middleware/requireAdmin.ts
git commit -m "feat: add authenticate and requireAdmin middleware"
```

---

## Task 5: Auth module

**Files:**
- Create: `src/modules/auth/auth.types.ts`
- Create: `src/modules/auth/auth.service.ts`
- Create: `src/modules/auth/auth.controller.ts`
- Create: `src/modules/auth/auth.router.ts`
- Create: `src/__tests__/auth.service.test.ts`

- [ ] **Step 1: Write failing tests for auth service**

Create `src/__tests__/auth.service.test.ts`:

```typescript
import { extractDomain, validateDomain } from '../modules/auth/auth.service';
import { supabaseAdmin } from '../lib/supabase';

jest.mock('../lib/supabase', () => ({
  supabaseAdmin: {
    from: jest.fn(),
  },
}));

const mockFrom = supabaseAdmin.from as jest.Mock;

function mockChain(result: any) {
  const chain: any = {
    select: () => chain,
    eq: () => chain,
    single: () => Promise.resolve(result),
    insert: () => chain,
    limit: () => chain,
  };
  return chain;
}

describe('extractDomain', () => {
  it('extracts domain from email', () => {
    expect(extractDomain('user@iitb.ac.in')).toBe('iitb.ac.in');
  });

  it('lowercases the domain', () => {
    expect(extractDomain('user@IITB.AC.IN')).toBe('iitb.ac.in');
  });
});

describe('validateDomain', () => {
  it('throws 403 if domain not found', async () => {
    mockFrom.mockReturnValue(mockChain({ data: null, error: null }));

    await expect(validateDomain('unknown.ac.in')).rejects.toMatchObject({
      status: 403,
      message: 'Domain not recognized',
    });
  });

  it('throws 403 if domain is inactive', async () => {
    mockFrom.mockReturnValue(
      mockChain({
        data: {
          id: '1',
          college_id: 'c1',
          is_active: false,
          colleges: { is_active: true },
        },
        error: null,
      })
    );

    await expect(validateDomain('inactive.ac.in')).rejects.toMatchObject({
      status: 403,
      message: 'Your institution is not currently active',
    });
  });

  it('throws 403 if college is inactive', async () => {
    mockFrom
      .mockReturnValueOnce(
        mockChain({
          data: {
            id: '1',
            college_id: 'c1',
            is_active: true,
            colleges: { is_active: false },
          },
          error: null,
        })
      );

    await expect(validateDomain('inactive-college.ac.in')).rejects.toMatchObject({
      status: 403,
      message: 'Your institution is not currently active',
    });
  });

  it('throws 403 if no active campus', async () => {
    mockFrom
      .mockReturnValueOnce(
        mockChain({
          data: {
            id: '1',
            college_id: 'c1',
            is_active: true,
            colleges: { is_active: true },
          },
          error: null,
        })
      )
      .mockReturnValueOnce(mockChain({ data: null, error: null }));

    await expect(validateDomain('nocampus.ac.in')).rejects.toMatchObject({
      status: 403,
      message: 'No active campus available for your institution',
    });
  });

  it('returns collegeId when all checks pass', async () => {
    mockFrom
      .mockReturnValueOnce(
        mockChain({
          data: {
            id: '1',
            college_id: 'c1',
            is_active: true,
            colleges: { is_active: true },
          },
          error: null,
        })
      )
      .mockReturnValueOnce(mockChain({ data: { id: 'campus1' }, error: null }));

    const result = await validateDomain('valid.ac.in');
    expect(result).toEqual({ collegeId: 'c1' });
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd peerly-backend
npx jest src/__tests__/auth.service.test.ts
```

Expected: FAIL — `Cannot find module '../modules/auth/auth.service'`

- [ ] **Step 3: Create src/modules/auth/auth.types.ts**

```typescript
import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export type RegisterBody = z.infer<typeof registerSchema>;
export type LoginBody = z.infer<typeof loginSchema>;
```

- [ ] **Step 4: Create src/modules/auth/auth.service.ts**

```typescript
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '../../lib/supabase';
import { signToken } from '../../lib/jwt';
import { AppError } from '../../lib/errors';
import { logger } from '../../lib/logger';

export function extractDomain(email: string): string {
  return email.split('@')[1]?.toLowerCase();
}

export async function validateDomain(domain: string): Promise<{ collegeId: string }> {
  const { data: domainRow } = await supabaseAdmin
    .from('college_domains')
    .select('id, college_id, is_active, colleges(is_active)')
    .eq('domain', domain)
    .single();

  if (!domainRow) throw new AppError(403, 'Domain not recognized');
  if (!domainRow.is_active) throw new AppError(403, 'Your institution is not currently active');

  const college = domainRow.colleges as { is_active: boolean } | null;
  if (!college?.is_active) throw new AppError(403, 'Your institution is not currently active');

  const { data: campus } = await supabaseAdmin
    .from('campuses')
    .select('id')
    .eq('college_id', domainRow.college_id)
    .eq('is_active', true)
    .limit(1)
    .single();

  if (!campus) throw new AppError(403, 'No active campus available for your institution');

  return { collegeId: domainRow.college_id };
}

export async function register(email: string, password: string) {
  const normalizedEmail = email.toLowerCase().trim();
  const domain = extractDomain(normalizedEmail);
  await validateDomain(domain);

  const { data: existing } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('email', normalizedEmail)
    .single();

  if (existing) throw new AppError(409, 'Email already registered');

  const passwordHash = await bcrypt.hash(password, 12);

  const { data: user, error } = await supabaseAdmin
    .from('users')
    .insert({ email: normalizedEmail, password_hash: passwordHash })
    .select('id, email, is_admin')
    .single();

  if (error || !user) {
    logger.error('Failed to insert user during register', { error: error?.message });
    throw new AppError(500, 'Failed to create user');
  }

  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .insert({ id: user.id });

  if (profileError) {
    logger.error('Failed to insert profile after user create', {
      userId: user.id,
      error: profileError.message,
    });
    throw new AppError(500, 'Failed to create user profile');
  }

  logger.info('User registered', { userId: user.id, domain });

  const token = signToken({
    userId: user.id,
    email: user.email,
    isAdmin: false,
    campusId: null,
  });

  return { token, onboarding_completed: false };
}

export async function login(email: string, password: string) {
  const normalizedEmail = email.toLowerCase().trim();

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id, email, password_hash, is_admin')
    .eq('email', normalizedEmail)
    .single();

  if (!user) throw new AppError(401, 'Invalid credentials');

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) throw new AppError(401, 'Invalid credentials');

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('campus_id, onboarding_completed')
    .eq('id', user.id)
    .single();

  const token = signToken({
    userId: user.id,
    email: user.email,
    isAdmin: user.is_admin,
    campusId: profile?.campus_id ?? null,
  });

  logger.info('User logged in', { userId: user.id });

  return {
    token,
    onboarding_completed: profile?.onboarding_completed ?? false,
  };
}
```

- [ ] **Step 5: Run tests — verify they pass**

```bash
cd peerly-backend
npx jest src/__tests__/auth.service.test.ts
```

Expected: All tests PASS.

- [ ] **Step 6: Create src/modules/auth/auth.controller.ts**

```typescript
import { Request, Response } from 'express';
import * as authService from './auth.service';
import { supabaseAdmin } from '../../lib/supabase';

export async function register(req: Request, res: Response): Promise<void> {
  // req.body already validated by registerSchema via validateBody middleware
  const { email, password } = req.body;
  const result = await authService.register(email, password);
  res.status(201).json(result);
}

export async function login(req: Request, res: Response): Promise<void> {
  // req.body already validated by loginSchema via validateBody middleware
  const { email, password } = req.body;
  const result = await authService.login(email, password);
  res.json(result);
}

export async function me(req: Request, res: Response): Promise<void> {
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id, email, is_admin, created_at')
    .eq('id', req.user.userId)
    .single();

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('name, username, bio, campus_id, onboarding_completed, avatar_url, updated_at')
    .eq('id', req.user.userId)
    .single();

  res.json({ ...user, profile });
}
```

- [ ] **Step 7: Create src/modules/auth/auth.router.ts**

```typescript
import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { validateBody } from '../../lib/validate';
import { registerSchema, loginSchema } from './auth.types';
import * as controller from './auth.controller';

const router = Router();

router.post('/register', validateBody(registerSchema), controller.register);
router.post('/login', validateBody(loginSchema), controller.login);
router.get('/me', authenticate, controller.me);

export default router;
```

- [ ] **Step 8: Compile check**

```bash
cd peerly-backend
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 9: Commit**

```bash
cd peerly-backend
git add src/modules/auth/ src/__tests__/auth.service.test.ts
git commit -m "feat: add auth module (register, login, me)"
```

---

## Task 6: App scaffold — app.ts + server.ts

**Files:**
- Create: `src/app.ts`
- Create: `src/server.ts`

- [ ] **Step 1: Create src/app.ts**

```typescript
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { rateLimit } from 'express-rate-limit';
import { config } from './config';
import { logger } from './lib/logger';
import { AppError } from './lib/errors';
import authRouter from './modules/auth/auth.router';
import adminRouter from './modules/admin/admin.router';
import onboardingRouter from './modules/onboarding/onboarding.router';

const app = express();

// Trust proxy — required for accurate IP rate limiting behind nginx/load balancer
app.set('trust proxy', 1);

// Security headers
app.use(helmet());

// CORS
app.use(
  cors({
    origin: config.FRONTEND_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// HTTP request logging
app.use(
  morgan(config.NODE_ENV === 'production' ? 'combined' : 'dev', {
    stream: { write: (msg) => logger.http(msg.trim()) },
  })
);

// Body parsing
app.use(express.json({ limit: '10kb' }));

// Rate limiting on auth routes only
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});

// Routes
app.use('/api/auth', authLimiter, authRouter);
app.use('/api/admin', adminRouter);
app.use('/api/onboarding', onboardingRouter);

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', env: config.NODE_ENV });
});

// 404 handler — catches any route not matched above
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler — Express 5 propagates async errors automatically
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: err.message });
    return;
  }

  logger.error('Unhandled error', {
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });

  res.status(500).json({ error: 'Internal server error' });
});

export default app;
```

- [ ] **Step 2: Create src/server.ts**

```typescript
import { config } from './config';
import { logger } from './lib/logger';
import app from './app';

const server = app.listen(config.PORT, () => {
  logger.info(`Server started`, { port: config.PORT, env: config.NODE_ENV });
});

// Graceful shutdown — allows in-flight requests to finish before exiting
function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down gracefully`);
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });

  // Force exit after 10s if server doesn't close cleanly
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10_000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason });
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { error: err.message, stack: err.stack });
  process.exit(1);
});
```

> **Note:** `app.ts` imports `adminRouter` and `onboardingRouter` which don't exist yet. The compile will fail until Tasks 7 and 8 are done. Create stub files first (Step 3).

- [ ] **Step 3: Create stub admin + onboarding routers (temporary)**

Create `src/modules/admin/admin.router.ts`:

```typescript
import { Router } from 'express';
const router = Router();
export default router;
```

Create `src/modules/onboarding/onboarding.router.ts`:

```typescript
import { Router } from 'express';
const router = Router();
export default router;
```

- [ ] **Step 4: Compile check**

```bash
cd peerly-backend
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 5: Start dev server**

```bash
cd peerly-backend
npm run dev
```

Expected: `[server] Running on port 5000 (development)`

- [ ] **Step 6: Health check**

```bash
curl http://localhost:5000/health
```

Expected: `{"status":"ok"}`

- [ ] **Step 7: Commit**

```bash
cd peerly-backend
git add src/app.ts src/server.ts src/modules/admin/admin.router.ts src/modules/onboarding/onboarding.router.ts
git commit -m "feat: add express app scaffold with health endpoint"
```

---

## Task 7: Admin module

**Files:**
- Create: `src/modules/admin/admin.types.ts`
- Create: `src/modules/admin/admin.service.ts`
- Create: `src/modules/admin/admin.controller.ts`
- Modify: `src/modules/admin/admin.router.ts` (replace stub)
- Create: `src/__tests__/admin.service.test.ts`

- [ ] **Step 1: Write failing tests for admin service**

Create `src/__tests__/admin.service.test.ts`:

```typescript
import { createCollege, createDomain, updateDomain, createCampus } from '../modules/admin/admin.service';
import { supabaseAdmin } from '../lib/supabase';

jest.mock('../lib/supabase', () => ({
  supabaseAdmin: { from: jest.fn() },
}));

const mockFrom = supabaseAdmin.from as jest.Mock;

function mockChain(overrides: Partial<Record<string, any>> = {}) {
  const chain: any = {
    select: () => chain,
    eq: () => chain,
    single: () => Promise.resolve({ data: null, error: null }),
    insert: () => chain,
    update: () => chain,
    order: () => Promise.resolve({ data: [], error: null }),
    ...overrides,
  };
  return chain;
}

describe('createCollege', () => {
  it('returns created college', async () => {
    const fakeCollege = { id: 'c1', name: 'IIT Bombay', is_active: true };
    mockFrom.mockReturnValue({
      ...mockChain(),
      insert: () => ({
        select: () => ({ single: () => Promise.resolve({ data: fakeCollege, error: null }) }),
      }),
    });

    const result = await createCollege('IIT Bombay');
    expect(result).toEqual(fakeCollege);
  });

  it('throws 500 on DB error', async () => {
    mockFrom.mockReturnValue({
      ...mockChain(),
      insert: () => ({
        select: () => ({ single: () => Promise.resolve({ data: null, error: new Error('db error') }) }),
      }),
    });

    await expect(createCollege('IIT Bombay')).rejects.toMatchObject({ status: 500 });
  });
});

describe('createDomain', () => {
  it('throws 409 if domain already exists', async () => {
    mockFrom.mockReturnValue(
      mockChain({ single: () => Promise.resolve({ data: { id: 'd1' }, error: null }) })
    );

    await expect(createDomain('c1', 'iitb.ac.in')).rejects.toMatchObject({
      status: 409,
      message: 'Domain already registered',
    });
  });

  it('normalizes domain to lowercase', async () => {
    let insertedDomain = '';
    mockFrom
      .mockReturnValueOnce(mockChain({ single: () => Promise.resolve({ data: null, error: null }) }))
      .mockReturnValueOnce({
        insert: (data: any) => {
          insertedDomain = data.domain;
          return {
            select: () => ({ single: () => Promise.resolve({ data: { id: 'd1', domain: data.domain }, error: null }) }),
          };
        },
      });

    await createDomain('c1', 'IITB.AC.IN');
    expect(insertedDomain).toBe('iitb.ac.in');
  });
});

describe('updateDomain', () => {
  it('throws 404 if domain not found for this college', async () => {
    mockFrom.mockReturnValue(
      mockChain({ single: () => Promise.resolve({ data: null, error: new Error('not found') }) })
    );

    await expect(updateDomain('c1', 'd1', false)).rejects.toMatchObject({ status: 404 });
  });
});

describe('createCampus', () => {
  it('returns created campus', async () => {
    const fakeCampus = { id: 'camp1', college_id: 'c1', name: 'Main Campus', is_active: true };
    mockFrom.mockReturnValue({
      insert: () => ({
        select: () => ({ single: () => Promise.resolve({ data: fakeCampus, error: null }) }),
      }),
    });

    const result = await createCampus('c1', 'Main Campus');
    expect(result).toEqual(fakeCampus);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd peerly-backend
npx jest src/__tests__/admin.service.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create src/modules/admin/admin.types.ts**

```typescript
import { z } from 'zod';

export const createCollegeSchema = z.object({
  name: z.string().min(1, 'Name is required'),
});

export const updateCollegeSchema = z.object({
  name: z.string().min(1).optional(),
  is_active: z.boolean().optional(),
}).refine((d) => d.name !== undefined || d.is_active !== undefined, {
  message: 'At least one field (name or is_active) required',
});

export const createDomainSchema = z.object({
  domain: z.string().min(3, 'Domain is required').regex(/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, 'Invalid domain format'),
});

export const updateDomainSchema = z.object({
  is_active: z.boolean(),
});

export const createCampusSchema = z.object({
  name: z.string().min(1, 'Name is required'),
});

export const updateCampusSchema = z.object({
  name: z.string().min(1).optional(),
  is_active: z.boolean().optional(),
}).refine((d) => d.name !== undefined || d.is_active !== undefined, {
  message: 'At least one field (name or is_active) required',
});

export type CreateCollegeBody = z.infer<typeof createCollegeSchema>;
export type UpdateCollegeBody = z.infer<typeof updateCollegeSchema>;
export type CreateDomainBody = z.infer<typeof createDomainSchema>;
export type UpdateDomainBody = z.infer<typeof updateDomainSchema>;
export type CreateCampusBody = z.infer<typeof createCampusSchema>;
export type UpdateCampusBody = z.infer<typeof updateCampusSchema>;
```

- [ ] **Step 4: Create src/modules/admin/admin.service.ts**

```typescript
import { supabaseAdmin } from '../../lib/supabase';
import { AppError } from '../../lib/errors';
import { logger } from '../../lib/logger';

export async function createCollege(name: string) {
  const { data, error } = await supabaseAdmin
    .from('colleges')
    .insert({ name: name.trim() })
    .select()
    .single();

  if (error || !data) {
    logger.error('Failed to create college', { error: error?.message });
    throw new AppError(500, 'Failed to create college');
  }

  logger.info('College created', { collegeId: data.id, name: data.name });
  return data;
}

export async function listColleges() {
  const { data, error } = await supabaseAdmin
    .from('colleges')
    .select('*, college_domains(count), campuses(count)')
    .order('name');

  if (error) {
    logger.error('Failed to list colleges', { error: error.message });
    throw new AppError(500, 'Failed to fetch colleges');
  }

  return data ?? [];
}

export async function updateCollege(id: string, updates: { name?: string; is_active?: boolean }) {
  const { data, error } = await supabaseAdmin
    .from('colleges')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error || !data) throw new AppError(404, 'College not found');
  return data;
}

export async function createDomain(collegeId: string, domain: string) {
  const normalized = domain.toLowerCase().trim();

  const { data: existing } = await supabaseAdmin
    .from('college_domains')
    .select('id')
    .eq('domain', normalized)
    .single();

  if (existing) throw new AppError(409, 'Domain already registered');

  const { data, error } = await supabaseAdmin
    .from('college_domains')
    .insert({ college_id: collegeId, domain: normalized })
    .select()
    .single();

  if (error || !data) {
    logger.error('Failed to add domain', { error: error?.message, collegeId });
    throw new AppError(500, 'Failed to add domain');
  }

  logger.info('Domain added', { domainId: data.id, domain: normalized, collegeId });
  return data;
}

export async function updateDomain(collegeId: string, domainId: string, is_active: boolean) {
  const { data, error } = await supabaseAdmin
    .from('college_domains')
    .update({ is_active })
    .eq('id', domainId)
    .eq('college_id', collegeId)
    .select()
    .single();

  if (error || !data) throw new AppError(404, 'Domain not found');
  return data;
}

export async function createCampus(collegeId: string, name: string) {
  const { data, error } = await supabaseAdmin
    .from('campuses')
    .insert({ college_id: collegeId, name: name.trim() })
    .select()
    .single();

  if (error || !data) {
    logger.error('Failed to create campus', { error: error?.message, collegeId });
    throw new AppError(500, 'Failed to create campus');
  }

  logger.info('Campus created', { campusId: data.id, name: data.name, collegeId });
  return data;
}

export async function listCampuses(collegeId: string) {
  const { data, error } = await supabaseAdmin
    .from('campuses')
    .select('*')
    .eq('college_id', collegeId)
    .order('name');

  if (error) {
    logger.error('Failed to list campuses', { error: error.message, collegeId });
    throw new AppError(500, 'Failed to fetch campuses');
  }

  return data ?? [];
}

export async function updateCampus(
  collegeId: string,
  campusId: string,
  updates: { name?: string; is_active?: boolean }
) {
  const { data, error } = await supabaseAdmin
    .from('campuses')
    .update(updates)
    .eq('id', campusId)
    .eq('college_id', collegeId)
    .select()
    .single();

  if (error || !data) throw new AppError(404, 'Campus not found');
  return data;
}
```

- [ ] **Step 5: Run tests — verify they pass**

```bash
cd peerly-backend
npx jest src/__tests__/admin.service.test.ts
```

Expected: All tests PASS.

- [ ] **Step 6: Create src/modules/admin/admin.controller.ts**

```typescript
import { Request, Response } from 'express';
import * as adminService from './admin.service';

// All req.body fields pre-validated by Zod schemas via validateBody middleware

export async function createCollege(req: Request, res: Response): Promise<void> {
  const data = await adminService.createCollege(req.body.name);
  res.status(201).json(data);
}

export async function listColleges(_req: Request, res: Response): Promise<void> {
  const data = await adminService.listColleges();
  res.json(data);
}

export async function updateCollege(req: Request, res: Response): Promise<void> {
  const data = await adminService.updateCollege(req.params.id, req.body);
  res.json(data);
}

export async function createDomain(req: Request, res: Response): Promise<void> {
  const data = await adminService.createDomain(req.params.id, req.body.domain);
  res.status(201).json(data);
}

export async function updateDomain(req: Request, res: Response): Promise<void> {
  const data = await adminService.updateDomain(req.params.id, req.params.domainId, req.body.is_active);
  res.json(data);
}

export async function createCampus(req: Request, res: Response): Promise<void> {
  const data = await adminService.createCampus(req.params.id, req.body.name);
  res.status(201).json(data);
}

export async function listCampuses(req: Request, res: Response): Promise<void> {
  const data = await adminService.listCampuses(req.params.id);
  res.json(data);
}

export async function updateCampus(req: Request, res: Response): Promise<void> {
  const data = await adminService.updateCampus(req.params.id, req.params.campusId, req.body);
  res.json(data);
}
```

- [ ] **Step 7: Replace stub with full src/modules/admin/admin.router.ts**

```typescript
import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireAdmin } from '../../middleware/requireAdmin';
import { validateBody } from '../../lib/validate';
import {
  createCollegeSchema, updateCollegeSchema,
  createDomainSchema, updateDomainSchema,
  createCampusSchema, updateCampusSchema,
} from './admin.types';
import * as controller from './admin.controller';

const router = Router();
router.use(authenticate, requireAdmin);

router.post('/colleges', validateBody(createCollegeSchema), controller.createCollege);
router.get('/colleges', controller.listColleges);
router.patch('/colleges/:id', validateBody(updateCollegeSchema), controller.updateCollege);

router.post('/colleges/:id/domains', validateBody(createDomainSchema), controller.createDomain);
router.patch('/colleges/:id/domains/:domainId', validateBody(updateDomainSchema), controller.updateDomain);

router.post('/colleges/:id/campuses', validateBody(createCampusSchema), controller.createCampus);
router.get('/colleges/:id/campuses', controller.listCampuses);
router.patch('/colleges/:id/campuses/:campusId', validateBody(updateCampusSchema), controller.updateCampus);

export default router;
```

- [ ] **Step 8: Compile check**

```bash
cd peerly-backend
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 9: Commit**

```bash
cd peerly-backend
git add src/modules/admin/ src/__tests__/admin.service.test.ts
git commit -m "feat: add admin module (colleges, domains, campuses CRUD)"
```

---

## Task 8: Onboarding module

**Files:**
- Create: `src/modules/onboarding/onboarding.types.ts`
- Create: `src/modules/onboarding/onboarding.service.ts`
- Create: `src/modules/onboarding/onboarding.controller.ts`
- Modify: `src/modules/onboarding/onboarding.router.ts` (replace stub)
- Create: `src/__tests__/onboarding.service.test.ts`

- [ ] **Step 1: Write failing tests for onboarding service**

Create `src/__tests__/onboarding.service.test.ts`:

```typescript
import { getCampusesForUser, completeOnboarding } from '../modules/onboarding/onboarding.service';
import { supabaseAdmin } from '../lib/supabase';

jest.mock('../lib/supabase', () => ({
  supabaseAdmin: { from: jest.fn() },
}));

jest.mock('../lib/jwt', () => ({
  signToken: jest.fn(() => 'mock.jwt.token'),
}));

const mockFrom = supabaseAdmin.from as jest.Mock;

function single(data: any) {
  return { single: () => Promise.resolve({ data, error: data ? null : new Error('not found') }) };
}

function orderResult(data: any[]) {
  return { order: () => Promise.resolve({ data, error: null }) };
}

describe('getCampusesForUser', () => {
  it('throws 403 if domain not recognized', async () => {
    mockFrom.mockReturnValue({
      select: () => ({ eq: () => ({ eq: () => single(null) }) }),
    });

    await expect(getCampusesForUser('user@unknown.ac.in')).rejects.toMatchObject({
      status: 403,
      message: 'Domain not recognized',
    });
  });

  it('returns active campuses for valid domain', async () => {
    const fakeCampuses = [
      { id: 'camp1', name: 'Main Campus', college_id: 'c1' },
    ];

    mockFrom
      .mockReturnValueOnce({
        select: () => ({ eq: () => ({ eq: () => single({ college_id: 'c1' }) }) }),
      })
      .mockReturnValueOnce({
        select: () => ({
          eq: () => ({ eq: () => orderResult(fakeCampuses) }),
        }),
      });

    const result = await getCampusesForUser('user@valid.ac.in');
    expect(result).toEqual(fakeCampuses);
  });
});

describe('completeOnboarding', () => {
  it('throws 400 if onboarding already completed', async () => {
    mockFrom.mockReturnValue({
      select: () => ({ eq: () => single({ onboarding_completed: true }) }),
    });

    await expect(
      completeOnboarding('u1', 'user@valid.ac.in', false, {
        name: 'Alice',
        username: 'alice',
        campus_id: 'camp1',
      })
    ).rejects.toMatchObject({ status: 400, message: 'Onboarding already completed' });
  });

  it('returns token and profile on success', async () => {
    const updatedProfile = {
      id: 'u1', name: 'Alice', username: 'alice', campus_id: 'camp1', onboarding_completed: true,
    };

    mockFrom
      .mockReturnValueOnce({ select: () => ({ eq: () => single({ onboarding_completed: false }) }) })
      .mockReturnValueOnce({ select: () => ({ eq: () => ({ eq: () => single({ college_id: 'c1' }) }) }) })
      .mockReturnValueOnce({ select: () => ({ eq: () => ({ eq: () => ({ eq: () => single({ id: 'camp1' }) }) }) }) })
      .mockReturnValueOnce({ select: () => ({ eq: () => single(null) }) })
      .mockReturnValueOnce({
        update: () => ({ eq: () => ({ select: () => ({ single: () => Promise.resolve({ data: updatedProfile, error: null }) }) }) }),
      });

    const result = await completeOnboarding('u1', 'user@valid.ac.in', false, {
      name: 'Alice',
      username: 'alice',
      campus_id: 'camp1',
    });

    expect(result.token).toBe('mock.jwt.token');
    expect(result.profile).toEqual(updatedProfile);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd peerly-backend
npx jest src/__tests__/onboarding.service.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create src/modules/onboarding/onboarding.types.ts**

```typescript
import { z } from 'zod';

export const completeOnboardingSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  bio: z.string().max(500).optional(),
  campus_id: z.string().uuid('campus_id must be a valid UUID'),
});

export type CompleteOnboardingBody = z.infer<typeof completeOnboardingSchema>;
```

- [ ] **Step 4: Create src/modules/onboarding/onboarding.service.ts**

```typescript
import { supabaseAdmin } from '../../lib/supabase';
import { AppError } from '../../lib/errors';
import { signToken } from '../../lib/jwt';
import { logger } from '../../lib/logger';
import { extractDomain } from '../auth/auth.service';
import { CompleteOnboardingBody } from './onboarding.types';

export async function getCampusesForUser(email: string) {
  const domain = extractDomain(email);

  const { data: domainRow } = await supabaseAdmin
    .from('college_domains')
    .select('college_id')
    .eq('domain', domain)
    .eq('is_active', true)
    .single();

  if (!domainRow) throw new AppError(403, 'Domain not recognized');

  const { data: campuses, error } = await supabaseAdmin
    .from('campuses')
    .select('id, name, college_id')
    .eq('college_id', domainRow.college_id)
    .eq('is_active', true)
    .order('name');

  if (error) {
    logger.error('Failed to fetch campuses for onboarding', {
      error: error.message,
      collegeId: domainRow.college_id,
    });
    throw new AppError(500, 'Failed to fetch campuses');
  }

  return campuses ?? [];
}

export async function completeOnboarding(
  userId: string,
  email: string,
  isAdmin: boolean,
  body: CompleteOnboardingBody
) {
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('onboarding_completed')
    .eq('id', userId)
    .single();

  if (profile?.onboarding_completed) {
    throw new AppError(400, 'Onboarding already completed');
  }

  const domain = extractDomain(email);

  const { data: domainRow } = await supabaseAdmin
    .from('college_domains')
    .select('college_id')
    .eq('domain', domain)
    .eq('is_active', true)
    .single();

  if (!domainRow) throw new AppError(403, 'Domain not recognized');

  const { data: campus } = await supabaseAdmin
    .from('campuses')
    .select('id')
    .eq('id', body.campus_id)
    .eq('college_id', domainRow.college_id)
    .eq('is_active', true)
    .single();

  if (!campus) throw new AppError(400, 'Invalid campus for your institution');

  const { data: existingUsername } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('username', body.username)
    .single();

  if (existingUsername) throw new AppError(409, 'Username already taken');

  const { data: updatedProfile, error } = await supabaseAdmin
    .from('profiles')
    .update({
      name: body.name.trim(),
      username: body.username.toLowerCase().trim(),
      bio: body.bio?.trim() ?? null,
      campus_id: body.campus_id,
      onboarding_completed: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .select()
    .single();

  if (error || !updatedProfile) {
    logger.error('Failed to complete onboarding', { userId, error: error?.message });
    throw new AppError(500, 'Failed to complete onboarding');
  }

  logger.info('Onboarding completed', { userId, campusId: body.campus_id });

  const token = signToken({ userId, email, isAdmin, campusId: body.campus_id });

  return { token, profile: updatedProfile };
}
```

- [ ] **Step 5: Run tests — verify they pass**

```bash
cd peerly-backend
npx jest src/__tests__/onboarding.service.test.ts
```

Expected: All tests PASS.

- [ ] **Step 6: Create src/modules/onboarding/onboarding.controller.ts**

```typescript
import { Request, Response } from 'express';
import * as onboardingService from './onboarding.service';

export async function getCampuses(req: Request, res: Response): Promise<void> {
  const campuses = await onboardingService.getCampusesForUser(req.user.email);
  res.json(campuses);
}

export async function completeOnboarding(req: Request, res: Response): Promise<void> {
  // req.body pre-validated by completeOnboardingSchema
  const result = await onboardingService.completeOnboarding(
    req.user.userId,
    req.user.email,
    req.user.isAdmin,
    req.body
  );
  res.json(result);
}
```

- [ ] **Step 7: Replace stub with full src/modules/onboarding/onboarding.router.ts**

```typescript
import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { validateBody } from '../../lib/validate';
import { completeOnboardingSchema } from './onboarding.types';
import * as controller from './onboarding.controller';

const router = Router();
router.use(authenticate);

router.get('/campuses', controller.getCampuses);
router.post('/complete', validateBody(completeOnboardingSchema), controller.completeOnboarding);

export default router;
```

- [ ] **Step 8: Run all tests**

```bash
cd peerly-backend
npx jest
```

Expected: All test suites PASS.

- [ ] **Step 9: Final compile check**

```bash
cd peerly-backend
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 10: Commit**

```bash
cd peerly-backend
git add src/modules/onboarding/ src/__tests__/onboarding.service.test.ts
git commit -m "feat: add onboarding module (campus list, complete profile)"
```

---

## Task 9: End-to-end smoke test

- [ ] **Step 1: Set JWT_SECRET in .env**

Open `peerly-backend/.env`, replace `JWT_SECRET` value. Must be **at least 32 characters** — config/index.ts will `process.exit(1)` on startup if it's shorter:

```
JWT_SECRET=peerly_super_secret_jwt_key_change_in_production_32chars
```

- [ ] **Step 2: Start dev server**

```bash
cd peerly-backend
npm run dev
```

Expected: `[server] Running on port 5000 (development)`

- [ ] **Step 3: Admin login**

```bash
curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@peerly.app","password":"Admin@123456"}' | jq .
```

Expected:
```json
{
  "token": "<jwt>",
  "onboarding_completed": false
}
```
Copy the token value — you need it for admin requests below.

- [ ] **Step 4: Create a college (as admin)**

```bash
curl -s -X POST http://localhost:5000/api/admin/colleges \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token-from-step-3>" \
  -d '{"name":"IIT Bombay"}' | jq .
```

Expected: `{ "id": "<uuid>", "name": "IIT Bombay", "is_active": true, ... }`  
Copy the `id` — you need it for domain + campus steps.

- [ ] **Step 5: Add a domain to the college**

```bash
curl -s -X POST http://localhost:5000/api/admin/colleges/<college-id>/domains \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"domain":"iitb.ac.in"}' | jq .
```

Expected: `{ "id": "<uuid>", "college_id": "<college-id>", "domain": "iitb.ac.in", "is_active": true }`

- [ ] **Step 6: Add a campus to the college**

```bash
curl -s -X POST http://localhost:5000/api/admin/colleges/<college-id>/campuses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"name":"Main Campus"}' | jq .
```

Expected: `{ "id": "<uuid>", "name": "Main Campus", "is_active": true, ... }`

- [ ] **Step 7: Register a new user**

```bash
curl -s -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"student@iitb.ac.in","password":"Student@123456"}' | jq .
```

Expected: `{ "token": "<jwt>", "onboarding_completed": false }`  
Copy the token.

- [ ] **Step 8: Fetch campuses for onboarding**

```bash
curl -s http://localhost:5000/api/onboarding/campuses \
  -H "Authorization: Bearer <student-token>" | jq .
```

Expected: `[{ "id": "<uuid>", "name": "Main Campus", "college_id": "<uuid>" }]`

- [ ] **Step 9: Complete onboarding**

```bash
curl -s -X POST http://localhost:5000/api/onboarding/complete \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <student-token>" \
  -d '{"name":"Alice","username":"alice_iitb","campus_id":"<campus-id-from-step-6>"}' | jq .
```

Expected: `{ "token": "<new-jwt-with-campusId>", "profile": { "onboarding_completed": true, ... } }`

- [ ] **Step 10: Final commit**

```bash
cd peerly-backend
git add -A
git commit -m "chore: complete auth + campus onboarding backend implementation"
```

---

## Self-Review Notes

- All spec endpoints covered: register, login, me, admin CRUD (colleges/domains/campuses), onboarding campuses + complete.
- JWT reissued with `campusId` after onboarding complete ✓
- Rate limiting on `/api/auth/*` only ✓
- Admin seeded in SQL (no registration path needed) ✓
- `extractDomain` exported from `auth.service.ts` and reused in `onboarding.service.ts` ✓
- Error handler in `app.ts` catches all `AppError` instances thrown from async routes (Express 5 auto-propagates) ✓
