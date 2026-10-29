-- Security hardening: in-app notices and reminders.

create table if not exists public.user_notices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  team_id uuid references public.teams(id) on delete cascade,
  kind text not null,
  severity text not null check (severity in ('info','notice','warning','critical')),
  title text not null,
  body text not null,
  action_label text,
  action_url text,
  sticky boolean not null default false,
  dedupe_key text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  dismissed_at timestamptz,
  resolved_at timestamptz,
  expires_at timestamptz,
  unique (user_id, dedupe_key)
);

create index if not exists user_notices_user_idx on public.user_notices (user_id, created_at desc);

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  subject_type text not null,
  subject_id text not null,
  user_id uuid references auth.users(id) on delete cascade,
  team_id uuid references public.teams(id) on delete cascade,
  due_at timestamptz not null,
  send_after timestamptz not null,
  dedupe_key text not null unique,
  state text not null default 'pending' check (state in ('pending','sent','skipped','cancelled','failed')),
  skip_reason text,
  sent_at timestamptz,
  lateness_seconds int,
  created_at timestamptz not null default now()
);

create index if not exists reminders_due_idx on public.reminders (state, send_after);
