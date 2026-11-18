-- SaathSetu starter schema for Supabase PostgreSQL.
-- Review with a security-minded developer before production deployment.
create extension if not exists pgcrypto;

create type public.relationship_intent as enum ('marriage','long_term');
create type public.like_status as enum ('pending','matched','passed');
create type public.report_status as enum ('open','reviewing','resolved','dismissed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 60),
  date_of_birth date not null,
  gender text not null,
  city text,
  state text,
  country text not null default 'India',
  bio text check (char_length(bio) <= 1000),
  relationship_intent public.relationship_intent not null,
  education text,
  profession text,
  interests text[] not null default '{}',
  values_tags text[] not null default '{}',
  photo_path text,
  is_verified boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (date_of_birth <= current_date - interval '18 years')
);

create table public.preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  min_age int not null default 21 check (min_age >= 18),
  max_age int not null default 40,
  preferred_cities text[] not null default '{}',
  intents public.relationship_intent[] not null default array['marriage','long_term']::public.relationship_intent[],
  dealbreakers text[] not null default '{}',
  check (max_age >= min_age)
);

create table public.likes (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references public.profiles(id) on delete cascade,
  to_user uuid not null references public.profiles(id) on delete cascade,
  status public.like_status not null default 'pending',
  created_at timestamptz not null default now(),
  unique(from_user,to_user),
  check(from_user <> to_user)
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  user_one uuid not null references public.profiles(id) on delete cascade,
  user_two uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_one,user_two),
  check(user_one < user_two)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 3000),
  created_at timestamptz not null default now(),
  is_read boolean not null default false
);

create table public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(blocker_id,blocked_id),
  check(blocker_id <> blocked_id)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_user_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  details text check(char_length(details) <= 2000),
  status public.report_status not null default 'open',
  created_at timestamptz not null default now(),
  check(reporter_id <> reported_user_id)
);

create index profiles_discovery_idx on public.profiles(is_active,country,relationship_intent);
create index likes_to_user_idx on public.likes(to_user,status);
create index messages_match_created_idx on public.messages(match_id,created_at);

alter table public.profiles enable row level security;
alter table public.preferences enable row level security;
alter table public.likes enable row level security;
alter table public.matches enable row level security;
alter table public.messages enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;

-- Users can read active profiles; production discovery should use a restricted
-- view/RPC so DOB, photo storage paths and hidden fields are never exposed.
create policy "active profiles readable by signed-in users"
on public.profiles for select to authenticated
using (is_active = true);

create policy "users insert own profile"
on public.profiles for insert to authenticated
with check (auth.uid() = id);

create policy "users update own profile"
on public.profiles for update to authenticated
using (auth.uid() = id) with check (auth.uid() = id);

create policy "users manage own preferences"
on public.preferences for all to authenticated
using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users read likes they sent or received"
on public.likes for select to authenticated
using (auth.uid() = from_user or auth.uid() = to_user);

create policy "users send likes as themselves"
on public.likes for insert to authenticated
with check (auth.uid() = from_user);

create policy "users update outgoing likes"
on public.likes for update to authenticated
using (auth.uid() = from_user) with check (auth.uid() = from_user);

create policy "match participants read matches"
on public.matches for select to authenticated
using (auth.uid() = user_one or auth.uid() = user_two);

create policy "match participants read messages"
on public.messages for select to authenticated
using (exists(select 1 from public.matches m where m.id=match_id and auth.uid() in (m.user_one,m.user_two)));

create policy "match participants send messages"
on public.messages for insert to authenticated
with check (auth.uid() = sender_id and exists(select 1 from public.matches m where m.id=match_id and auth.uid() in (m.user_one,m.user_two)));

create policy "users manage blocks they create"
on public.blocks for all to authenticated
using (auth.uid() = blocker_id) with check (auth.uid() = blocker_id);

create policy "users create reports"
on public.reports for insert to authenticated
with check (auth.uid() = reporter_id);

create policy "reporters read own reports"
on public.reports for select to authenticated
using (auth.uid() = reporter_id);

-- IMPORTANT:
-- 1) Do not expose service_role keys in browser code.
-- 2) Do not enable public signup until age/consent, email/phone verification,
--    abuse controls and moderation workflows are implemented.
-- 3) Add a SECURITY DEFINER RPC/Edge Function to create a match only when
--    reciprocal likes exist. Do not let clients insert arbitrary matches.
-- 4) Replace broad profile SELECT with a safe discovery view/RPC that returns
--    only fields intended for discovery; never expose DOB or private data.
-- 5) Add rate limits, image moderation, account deletion and retention controls.
