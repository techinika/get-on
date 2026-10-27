-- Support cases: case management with SLA timers

create table if not exists public.support_cases (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  title text not null,
  status text not null default 'open',
  priority text not null default 'medium',
  kind text not null default 'general',
  source text not null default 'customer',
  assigned_to uuid references public.platform_staff(id),
  created_by uuid not null references auth.users(id),
  resolved_at timestamptz,
  closed_at timestamptz,
  sla_deadline timestamptz,
  sla_met boolean not null default false,
  evidence text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint support_cases_status_check check (status in ('open','in_progress','resolved','closed')),
  constraint support_cases_priority_check check (priority in ('low','medium','high','urgent')),
  constraint support_cases_kind_check check (kind in ('general','billing','technical','feature','account'))
);

comment on table public.support_cases is 'Support case management with SLA tracking';
comment on column public.support_cases.status is 'open|in_progress|resolved|closed';
comment on column public.support_cases.priority is 'low|medium|high|urgent';
comment on column public.support_cases.kind is 'general|billing|technical|feature|account';
comment on column public.support_cases.sla_met is 'Whether SLA was met';

-- Enable RLS
alter table public.support_cases enable row level security;

-- Policy: team members can read their own cases
create policy "team members can read own cases" on public.support_cases
  for select using (
    exists (select 1 from public.team_members tm where tm.team_id = support_cases.team_id and tm.user_id = auth.uid() and tm.status = 'active')
  );

-- Policy: staff can read/write all cases
grant all on public.support_cases to service_role;

create index if not exists support_cases_team_idx on public.support_cases (team_id, status);
create index if not exists support_cases_assigned_idx on public.support_cases (assigned_to, status);
