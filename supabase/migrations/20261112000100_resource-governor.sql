-- Resource governor: pools, capacity, leases, tickets, metrics

-- Resource pools table: defines capacity per class and per-team caps
create table if not exists public.resource_pools (
  name text primary key,
  capacity int not null default 100,
  per_team_caps jsonb not null default '{"free": 1, "basic": 1, "pro": 2, "enterprise": 5}',
  class_shares jsonb not null default '{"free": 0.20, "basic": 0.25, "pro": 0.30, "enterprise": 0.25}',
  max_wait_seconds jsonb not null default '{"free": 180, "basic": 120, "pro": 60, "enterprise": 30}',
  aging_seconds int not null default 90,
  enabled boolean not null default true,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

-- Capacity settings: global governor state
create table if not exists public.capacity_settings (
  id uuid primary key default gen_random_uuid(),
  busy_mode text not null default 'auto'
    check (busy_mode in ('auto','forced_on','forced_off')),
  forced_until timestamptz,
  forced_reason text,
  enter_load numeric not null default 0.70,
  exit_load numeric not null default 0.50,
  enter_checks int not null default 2,
  exit_checks int not null default 5,
  busy boolean not null default false,
  busy_since timestamptz,
  scheduled_peaks jsonb not null default '[]'::jsonb,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

-- Resource leases: in-flight acquisitions
create table if not exists public.resource_leases (
  id uuid primary key default gen_random_uuid(),
  pool text not null references public.resource_pools(name) on delete cascade,
  team_id uuid not null,
  user_id uuid references auth.users(id) on delete set null,
  request_ref text not null,
  class text not null check (class in ('free','basic','pro','enterprise')),
  acquired_at timestamptz not null default now(),
  heartbeat_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint resource_leases_heartbeat_check check (heartbeat_at <= expires_at)
);

create index if not exists resource_leases_pool_idx on public.resource_leases (pool);
create index if not exists resource_leases_team_idx on public.resource_leases (team_id);
create index if not exists resource_leases_expires_idx on public.resource_leases (expires_at);

-- Resource tickets: waiting queue
create table if not exists public.resource_tickets (
  id uuid primary key default gen_random_uuid(),
  pool text not null references public.resource_pools(name) on delete cascade,
  team_id uuid not null,
  user_id uuid references auth.users(id) on delete set null,
  request_ref text not null,
  class text not null check (class in ('free','basic','pro','enterprise')),
  weight int not null default 1,
  status text not null default 'waiting'
    check (status in ('waiting','granted','expired','cancelled')),
  granted_at timestamptz,
  lease_id uuid references public.resource_leases(id) on delete set null,
  created_at timestamptz not null default now(),
  max_wait_until timestamptz
);

create index if not exists resource_tickets_pool_idx on public.resource_tickets (pool);
create index if not exists resource_tickets_team_idx on public.resource_tickets (team_id);
create index if not exists resource_tickets_status_idx on public.resource_tickets (status);

-- Resource metrics: minute-level metrics for SLO tracking
create table if not exists public.resource_metrics_minute (
  minute timestamptz not null,
  pool text not null references public.resource_pools(name) on delete cascade,
  class text not null check (class in ('free','basic','pro','enterprise')),
  inflight_avg numeric not null default 0,
  queue_depth_max int not null default 0,
  granted int not null default 0,
  timeouts int not null default 0,
  wait_p50_ms int not null default 0,
  wait_p95_ms int not null default 0,
  provider_429 int not null default 0,
  primary key (minute, pool, class)
);

create index if not exists resource_metrics_minute_pool_idx on public.resource_metrics_minute (pool, class);
create index if not exists resource_metrics_minute_minute_idx on public.resource_metrics_minute (minute desc);

-- Seed initial resource pools with proposed capacities
-- AI text: 12 slots, AI vision: 4, AI image: 2, publish: 5, export: 3, import: 3, backup: 3, email_send: rate budget
insert into public.resource_pools (name, capacity, per_team_caps, class_shares, max_wait_seconds, aging_seconds, enabled, updated_by)
values
  ('ai_text', 12, '{"free": 1, "basic": 2, "pro": 3, "enterprise": 5}', '{"free": 0.20, "basic": 0.25, "pro": 0.30, "enterprise": 0.25}', '{"free": 180, "basic": 120, "pro": 60, "enterprise": 30}', 90, true, null),
  ('ai_vision', 4, '{"free": 1, "basic": 1, "pro": 2, "enterprise": 5}', '{"free": 0.20, "basic": 0.25, "pro": 0.30, "enterprise": 0.25}', '{"free": 180, "basic": 120, "pro": 60, "enterprise": 30}', 90, true, null),
  ('ai_image', 2, '{"free": 1, "basic": 1, "pro": 2, "enterprise": 3}', '{"free": 0.20, "basic": 0.25, "pro": 0.30, "enterprise": 0.25}', '{"free": 180, "basic": 120, "pro": 60, "enterprise": 30}', 90, true, null),
  ('publish', 5, '{"free": 1, "basic": 1, "pro": 2, "enterprise": 3}', '{"free": 0.20, "basic": 0.25, "pro": 0.30, "enterprise": 0.25}', '{"free": 180, "basic": 120, "pro": 60, "enterprise": 30}', 90, true, null),
  ('export', 3, '{"free": 1, "basic": 1, "pro": 2, "enterprise": 3}', '{"free": 0.20, "basic": 0.25, "pro": 0.30, "enterprise": 0.25}', '{"free": 180, "basic": 120, "pro": 60, "enterprise": 30}', 90, true, null),
  ('import', 3, '{"free": 1, "basic": 1, "pro": 2, "enterprise": 3}', '{"free": 0.20, "basic": 0.25, "pro": 0.30, "enterprise": 0.25}', '{"free": 180, "basic": 120, "pro": 60, "enterprise": 30}', 90, true, null),
  ('backup', 3, '{"free": 1, "basic": 1, "pro": 2, "enterprise": 3}', '{"free": 0.20, "basic": 0.25, "pro": 0.30, "enterprise": 0.25}', '{"free": 180, "basic": 120, "pro": 60, "enterprise": 30}', 90, true, null),
  ('email_send', 100, '{"free": 1, "basic": 1, "pro": 2, "enterprise": 3}', '{"free": 0.20, "basic": 0.25, "pro": 0.30, "enterprise": 0.25}', '{"free": 180, "basic": 120, "pro": 60, "enterprise": 30}', 90, true, null)
on conflict (name) do update set
  capacity = excluded.capacity,
  per_team_caps = excluded.per_team_caps,
  class_shares = excluded.class_shares,
  max_wait_seconds = excluded.max_wait_seconds,
  aging_seconds = excluded.aging_seconds;

-- Seed capacity settings: auto mode by default
insert into public.capacity_settings (busy_mode, enter_load, exit_load, enter_checks, exit_checks)
values ('auto', 0.70, 0.50, 2, 5)
on conflict do nothing;

-- Comments
comment on table public.resource_pools is 'Pool definitions for resource governor: capacity, per-team caps, class shares, max waits, aging';
comment on table public.capacity_settings is 'Global capacity settings: busy mode, thresholds, scheduled peaks';
comment on table public.resource_leases is 'In-flight lease acquisitions, one per pool';
comment on table public.resource_tickets is 'Waiting queue tickets';
comment on table public.resource_metrics_minute is 'Minute-level metrics for SLO monitoring';