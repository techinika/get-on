-- Reporting snapshots. Reports are built from metadata only and stored so the
-- console never runs a heavy query on a page load.

create table if not exists public.report_snapshots (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  generated_at timestamptz not null default now(),
  data jsonb not null default '{}'::jsonb,
  unique (kind, period_start, period_end),
  constraint report_snapshots_kind_check check (
    kind in ('overview', 'growth', 'revenue', 'support', 'email', 'ai', 'domains', 'health')
  )
);

create index if not exists report_snapshots_kind_generated_idx
  on public.report_snapshots (kind, generated_at desc);

create table if not exists public.finance_months (
  month date primary key,
  status text not null default 'open',
  closed_by uuid references auth.users(id) on delete set null,
  closed_at timestamptz,
  totals jsonb not null default '{}'::jsonb,
  notes text,
  constraint finance_months_status_check check (status in ('open', 'closed'))
);

create table if not exists public.finance_snapshots (
  id uuid primary key default gen_random_uuid(),
  month date not null,
  generated_at timestamptz not null default now(),
  data jsonb not null default '{}'::jsonb
);

create index if not exists finance_snapshots_month_idx
  on public.finance_snapshots (month, generated_at desc);

create table if not exists public.weekly_reports (
  week_start date primary key,
  data jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now(),
  emailed_at timestamptz
);

create table if not exists public.system_health_snapshots (
  id uuid primary key default gen_random_uuid(),
  captured_at timestamptz not null default now(),
  data jsonb not null default '{}'::jsonb
);

create index if not exists system_health_snapshots_captured_idx
  on public.system_health_snapshots (captured_at desc);

alter table public.report_snapshots enable row level security;
alter table public.finance_months enable row level security;
alter table public.finance_snapshots enable row level security;
alter table public.weekly_reports enable row level security;
alter table public.system_health_snapshots enable row level security;

drop policy if exists "staff read report snapshots" on public.report_snapshots;
create policy "staff read report snapshots"
  on public.report_snapshots
  for select to authenticated
  using (public.staff_can('reports.view'::text));

drop policy if exists "staff read finance months" on public.finance_months;
create policy "staff read finance months"
  on public.finance_months
  for select to authenticated
  using (public.staff_can('finance.view'::text));

drop policy if exists "staff read finance snapshots" on public.finance_snapshots;
create policy "staff read finance snapshots"
  on public.finance_snapshots
  for select to authenticated
  using (public.staff_can('finance.view'::text));

drop policy if exists "staff read weekly reports" on public.weekly_reports;
create policy "staff read weekly reports"
  on public.weekly_reports
  for select to authenticated
  using (public.staff_can('reports.view'::text));

drop policy if exists "staff read health snapshots" on public.system_health_snapshots;
create policy "staff read health snapshots"
  on public.system_health_snapshots
  for select to authenticated
  using (public.staff_can('reports.view'::text));

revoke all on public.report_snapshots from anon;
revoke all on public.finance_months from anon;
revoke all on public.finance_snapshots from anon;
revoke all on public.weekly_reports from anon;
revoke all on public.system_health_snapshots from anon;

grant select on public.report_snapshots to authenticated;
grant select on public.finance_months to authenticated;
grant select on public.finance_snapshots to authenticated;
grant select on public.weekly_reports to authenticated;
grant select on public.system_health_snapshots to authenticated;

grant all on public.report_snapshots to service_role;
grant all on public.finance_months to service_role;
grant all on public.finance_snapshots to service_role;
grant all on public.weekly_reports to service_role;
grant all on public.system_health_snapshots to service_role;
