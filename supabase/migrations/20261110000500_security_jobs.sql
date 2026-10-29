-- Security hardening: scheduler registry, runs, locks.

create table if not exists public.job_definitions (
  name text primary key,
  schedule text not null,
  enabled boolean not null default true,
  priority int not null default 100,
  timeout_seconds int not null default 60,
  max_attempts int not null default 3,
  catch_up text not null default 'skip' check (catch_up in ('skip','latest','all')),
  critical boolean not null default false,
  expected_interval_seconds int not null default 3600,
  next_run_at timestamptz,
  last_started_at timestamptz,
  last_finished_at timestamptz,
  last_status text,
  consecutive_failures int not null default 0,
  cursor jsonb,
  notes text
);

create table if not exists public.job_runs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null references public.job_definitions(name) on delete cascade,
  scheduled_for timestamptz not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null check (status in ('running','ok','failed','timeout','skipped')),
  attempt int not null default 1,
  processed int not null default 0,
  more boolean not null default false,
  duration_ms int,
  error text,
  trigger text not null default 'tick' check (trigger in ('tick','manual','retry'))
);

create index if not exists job_runs_job_idx on public.job_runs (job_name, started_at desc);

create table if not exists public.job_locks (
  name text primary key,
  locked_by text not null,
  locked_until timestamptz not null
);
