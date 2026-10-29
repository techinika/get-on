-- Model administration: extend ai_models, add prices, assignments, canary metrics

-- Add role column to profiles table for RLS policy helpers
alter table public.profiles
  add column if not exists role text check (role in ('super_admin', 'admin', 'owner', 'customer_success'));

-- Helper functions for RLS policies (ensure they exist)
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'super_admin'
  );
$$;

create or replace function public.is_customer_success()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'owner', 'customer_success')
  );
$$;

-- Extend ai_models table with status tracking and catalogue reference
alter table public.ai_models
  add column if not exists status text not null default 'active'
    check (status in ('active','deprecated','removed','candidate'));

alter table public.ai_models
  add column if not exists status_checked_at timestamptz;

alter table public.ai_models
  add column if not exists catalog_ref jsonb;

alter table public.ai_models
  add column if not exists discovered_at timestamptz;

-- Update RLS policies for the extended table
alter table public.ai_models enable row level security;

-- Drop and recreate policies for broader access (customer success read-only, super admin write)
drop policy if exists "super admin read ai_models" on public.ai_models;
create policy "super admin read ai_models"
  on public.ai_models
  for select to authenticated
  using (public.is_super_admin());

drop policy if exists "super admin manage ai_models" on public.ai_models;
create policy "super admin manage ai_models"
  on public.ai_models
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- AI model prices: append-only price history per model
create table if not exists public.ai_model_prices (
  id uuid primary key default gen_random_uuid(),
  model_id text not null references public.ai_models(id) on delete cascade,
  effective_from timestamptz not null default now(),
  neurons_per_m_input numeric not null check (neurons_per_m_input >= 0),
  neurons_per_m_output numeric not null check (neurons_per_m_output >= 0),
  neurons_per_image numeric not null check (neurons_per_image >= 0),
  note text,
  created_by uuid references auth.users(id),
  constraint ai_model_prices_effective_from_ck check (effective_from >= now())
);

create index if not exists ai_model_prices_model_id_idx on public.ai_model_prices (model_id);
create index if not exists ai_model_prices_effective_from_idx on public.ai_model_prices (effective_from desc);

-- AI model assignments: primary/fallback/candidate with canary rollout
create table if not exists public.ai_model_assignments (
  id uuid primary key default gen_random_uuid(),
  purpose text not null check (purpose in ('brief','writer','judge','vision','image','guard')),
  primary_model_id text not null references public.ai_models(id) on delete restrict,
  fallback_model_id text references public.ai_models(id) on delete set null,
  candidate_model_id text references public.ai_models(id) on delete set null,
  canary_percent int not null default 0 check (canary_percent between 0 and 100),
  state text not null default 'active'
    check (state in ('active','testing','canary','rolled_back')),
  effective_from timestamptz not null default now(),
  created_by uuid references auth.users(id),
  reason text,
  test_run_id text,
  ended_at timestamptz
);

create index if not exists ai_model_assignments_purpose_idx on public.ai_model_assignments (purpose);
create index if not exists ai_model_assignments_primary_idx on public.ai_model_assignments (primary_model_id);

-- AI canary metrics: monitoring canary performance vs primary
create table if not exists public.ai_canary_metrics (
  assignment_id uuid not null references public.ai_model_assignments(id) on delete cascade,
  hour timestamptz not null,
  variant text not null check (variant in ('primary','candidate')),
  requests int not null default 0,
  failures int not null default 0,
  repairs int not null default 0,
  latency_p50_ms int not null default 0,
  latency_p95_ms int not null default 0,
  avg_credits numeric not null default 0,
  thumbs_down int not null default 0,
  primary key (assignment_id, hour, variant)
);

create index if not exists ai_canary_metrics_assignment_idx on public.ai_canary_metrics (assignment_id);
create index if not exists ai_canary_metrics_hour_idx on public.ai_canary_metrics (hour desc);

-- Update ai_models RLS to also allow customer success read access
drop policy if exists "customer success read ai_models" on public.ai_models;
create policy "customer success read ai_models"
  on public.ai_models
  for select to authenticated
  using (public.is_customer_success());

-- Comments
comment on table public.ai_models is 'Cloudflare Workers AI model catalogue entries. Status: active/deprecated/removed/candidate. Super admin editable.';
comment on column public.ai_models.status is 'Model status: active, deprecated, removed, or candidate for assignment';
comment on column public.ai_models.status_checked_at is 'When the status was last checked against the catalogue';
comment on column public.ai_models.catalog_ref is 'Redacted raw catalogue entry from Cloudflare';
comment on column public.ai_models.discovered_at is 'When the model was discovered/imported';
comment on table public.ai_model_prices is 'Append-only price history per model. Current price is the latest row not in the future.';
comment on column public.ai_model_prices.effective_from is 'When this price takes effect';
comment on table public.ai_model_assignments is 'Primary/fallback/candidate model assignments per purpose. Supports canary rollout.';
comment on column public.ai_model_assignments.canary_percent is 'Percentage of requests routed to candidate model (0-100)';
comment on column public.ai_model_assignments.state is 'Current rollout state: active, testing, canary, or rolled_back';
comment on table public.ai_canary_metrics is 'Hourly metrics for canary comparison between primary and candidate models';
comment on column public.ai_canary_metrics.thumbs_down is 'User dissatisfaction rate for candidate model';

-- Seed initial status values for existing models
update public.ai_models
set status = case
  when enabled then 'active'
  else 'removed'
end,
status_checked_at = now()
where status is null;