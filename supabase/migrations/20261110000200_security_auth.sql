-- Security hardening: second factor challenges, sessions, devices, tokens.

create table if not exists public.auth_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  email_hash text,
  purpose text not null check (purpose in ('signup_verify','login','step_up','email_change_old','email_change_new','recovery')),
  code_hash text not null,
  pepper_version int not null default 1,
  expires_at timestamptz not null,
  attempts int not null default 0,
  max_attempts int not null default 5,
  consumed_at timestamptz,
  invalidated_at timestamptz,
  session_id uuid,
  browser_binding_hash text,
  ip_hash text,
  ua_family text,
  created_at timestamptz not null default now(),
  constraint auth_challenges_subject_check check (user_id is not null or email_hash is not null)
);

create unique index if not exists auth_challenges_one_open
  on public.auth_challenges (coalesce(user_id::text, email_hash), purpose)
  where consumed_at is null and invalidated_at is null;

create table if not exists public.session_security (
  session_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  verified_at timestamptz,
  verified_method text check (verified_method in ('email_otp')),
  verified_challenge_id uuid references public.auth_challenges(id),
  expires_at timestamptz not null,
  idle_expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  step_up_until timestamptz,
  elevated_until timestamptz,
  device_id_hash text,
  ip_hash text,
  ua_family text,
  country text,
  revoked_at timestamptz,
  revoked_reason text
);

create index if not exists session_security_user_idx on public.session_security (user_id);
create index if not exists session_security_revoked_idx on public.session_security (revoked_at) where revoked_at is null;

create table if not exists public.user_devices (
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id_hash text not null,
  label text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (user_id, device_id_hash)
);

create table if not exists public.auth_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  purpose text not null check (purpose in ('password_reset','email_change_undo','not_me','account_recovery','unlock')),
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists auth_tokens_user_idx on public.auth_tokens (user_id, purpose);
