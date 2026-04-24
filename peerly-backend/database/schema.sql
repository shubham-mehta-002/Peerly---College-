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
-- insert into users (email, password_hash, is_admin)
-- values (
--   'admin@peerly.app',
--   '$2b$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.',
--   true
-- )
-- on conflict (email) do nothing;

-- insert into profiles (id)
-- select id from users where email = 'admin@peerly.app'
-- on conflict (id) do nothing;

-- ============================================
-- Feed + Posts Migration
-- ============================================

create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references profiles(id) on delete cascade,
  campus_id uuid not null references campuses(id) on delete cascade,
  college_id uuid not null references colleges(id),
  content text not null,
  image_urls text[] not null default '{}',
  is_global boolean not null default false,
  is_anonymous boolean not null default false,
  upvotes int not null default 0,
  downvotes int not null default 0,
  comment_count int not null default 0,
  heat_score float not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists posts_campus_id_idx on posts(campus_id, created_at desc);
create index if not exists posts_global_idx on posts(is_global, created_at desc);
create index if not exists posts_heat_score_idx on posts(heat_score desc);

create table if not exists post_votes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  vote_type text not null check (vote_type in ('up', 'down')),
  created_at timestamptz not null default now(),
  unique(post_id, user_id)
);

create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  author_id uuid not null references profiles(id) on delete cascade,
  parent_id uuid references comments(id) on delete cascade,
  depth int not null default 0,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists comments_post_id_idx on comments(post_id, created_at asc);

-- ============================================
-- Communities Migration
-- ============================================

create table if not exists communities (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  description  text,
  category     text not null check (category in ('Technical', 'Cultural', 'Sports')),
  is_global    boolean not null default false,
  campus_id    uuid not null references campuses(id) on delete cascade,
  created_by   uuid not null references profiles(id),
  member_count int not null default 1,
  created_at   timestamptz not null default now()
);

create index if not exists communities_campus_idx on communities(campus_id, member_count desc);
create index if not exists communities_global_idx on communities(is_global, member_count desc);

create table if not exists community_members (
  community_id uuid not null references communities(id) on delete cascade,
  user_id      uuid not null references profiles(id) on delete cascade,
  role         text not null check (role in ('admin', 'moderator', 'member')) default 'member',
  joined_at    timestamptz not null default now(),
  primary key  (community_id, user_id)
);

create table if not exists messages (
  id           uuid primary key default gen_random_uuid(),
  community_id uuid not null references communities(id) on delete cascade,
  sender_id    uuid not null references profiles(id),
  content      text not null,
  image_url    text,
  created_at   timestamptz not null default now()
);

create index if not exists messages_community_created_idx on messages(community_id, created_at desc);

-- ============================================
-- Auth Extensions Migration
-- ============================================

-- Add email verification flag to users
alter table users add column if not exists is_email_verified boolean not null default false;

create table if not exists password_reset_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used       boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists prt_user_id_idx on password_reset_tokens(user_id, used);

-- create table if not exists email_otps (
--   id         uuid primary key default gen_random_uuid(),
--   user_id    uuid not null references users(id) on delete cascade,
--   otp_hash   text not null,
--   expires_at timestamptz not null,
--   used       boolean not null default false,
--   created_at timestamptz not null default now()
-- );

-- create index if not exists eotp_user_id_idx on email_otps(user_id, used);
