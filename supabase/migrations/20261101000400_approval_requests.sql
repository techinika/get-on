-- Approval requests: tracks four-eyes approval workflow

create table if not exists public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references public.approval_policies(id) on delete cascade,
  requester_id uuid not null references public.platform_staff(id),
  target_type text not null,
  target_id uuid not null,
  status text not null default 'pending',
  required_roles text[] not null default '{}',
  approved_by uuid references public.platform_staff(id),
  approved_at timestamptz,
  rejected_by uuid references public.platform_staff(id),
  rejected_at timestamptz,
  stamped_at timestamptz not null default now(),
  expires_at timestamptz not null,
  reason text,
  constraint approval_requests_status_check check (status in ('pending','approved','rejected','expired')),
  constraint approval_requests_target_type_check check (target_type in ('team','project','page','setting','content','email','consent','support_case','billing'))
);

comment on table public.approval_requests is 'Tracks four-eyes approval requests workflow';
comment on column public.approval_requests.status is 'pending|approved|rejected|expired';
comment on column public.approval_requests.required_roles is 'Roles that must approve';
comment on column public.approval_requests.approved_by is 'Staff member who approved';
comment on column public.approval_requests.approved_at is 'When it was approved';
comment on column public.approval_requests.rejected_by is 'Staff member who rejected';
comment on column public.approval_requests.rejected_at is 'When it was rejected';
comment on column public.approval_requests.expires_at is 'When the approval expires (staleness)';

-- Enable RLS
alter table public.approval_requests enable row level security;

-- Policy: service role can do everything
grant all on public.approval_requests to service_role;

-- Policy: staff can read requests
create policy "staff can read approval requests" on public.approval_requests
  for select using (
    exists (select 1 from public.platform_staff ps where ps.email = current_setting('app.current_staff_email', true))
  );
