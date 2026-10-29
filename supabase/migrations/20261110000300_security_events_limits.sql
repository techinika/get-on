-- Security hardening: detection, limits, settings.

create table if not exists public.security_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  team_id uuid references public.teams(id) on delete set null,
  occurred_at timestamptz not null default now(),
  category text not null check (category in ('auth','second_factor','password','email','session','account','abuse')),
  event text not null,
  severity text not null check (severity in ('info','notice','warning','critical')),
  summary text not null check (length(summary) <= 200),
  ip_hash text,
  ua_family text,
  country text,
  meta jsonb not null default '{}'::jsonb,
  visible_to_user boolean not null default false
);

create index if not exists security_events_user_idx on public.security_events (user_id, occurred_at desc);
create index if not exists security_events_occurred_idx on public.security_events (occurred_at desc);

create table if not exists public.rate_limits (
  key text primary key,
  window_start timestamptz not null,
  count int not null default 0,
  blocked_until timestamptz
);

create table if not exists public.auth_lockouts (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('account','ip','email')),
  key_hash text not null,
  reason text not null,
  until timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists auth_lockouts_key_idx on public.auth_lockouts (scope, key_hash, until);

create table if not exists public.blocked_ips (
  ip_hash text primary key,
  until timestamptz,
  reason text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.signup_attempts (
  id uuid primary key default gen_random_uuid(),
  email_hash text not null,
  canonical_hash text not null,
  ip_hash text not null,
  result text not null,
  created_at timestamptz not null default now()
);

create index if not exists signup_attempts_created_idx on public.signup_attempts (created_at);

create table if not exists public.security_settings (
  id boolean primary key default true,
  two_factor_policy text not null default 'required' check (two_factor_policy in ('required','recommended')),
  otp_length int not null default 6,
  login_code_minutes int not null default 10,
  signup_code_minutes int not null default 30,
  step_up_minutes int not null default 10,
  session_days int not null default 30,
  session_idle_days int not null default 7,
  staff_session_hours int not null default 8,
  staff_idle_minutes int not null default 30,
  staff_elevation_minutes int not null default 30,
  min_password_length int not null default 10,
  hibp_enabled boolean not null default true,
  max_login_failures int not null default 10,
  lockout_minutes int not null default 15,
  register_per_ip_hour int not null default 5,
  register_per_ip_day int not null default 20,
  unverified_delete_days int not null default 7,
  disposable_block boolean not null default true,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.security_settings (id) values (true) on conflict (id) do nothing;

create table if not exists public.disposable_email_domains (
  domain text primary key
);

create table if not exists public.blocked_email_domains (
  domain text primary key,
  reason text
);
