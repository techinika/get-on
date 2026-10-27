-- Approval policies: defines four-eyes approval rules

create table if not exists public.approval_policies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  target_type text not null,
  action text not null,
  requires_approval boolean not null default true,
  min_roles text[] not null default '{}',
  allowed_roles text[] not null default '{}',
  staleness_hours int not null default 24,
  created_at timestamptz not null default now(),
  constraint approval_policies_target_type_check check (target_type in ('team','project','page','setting','content','email','consent','support_case','billing')),
  constraint approval_policies_action_check check (action in (
    'site.create','site.delete','site.restore','site.purge','site.transfer',
    'page.edit','page.publish','site.settings','site.domains',
    'links.manage','links.delete','export.content','export.backup','export.site_zip',
    'import.content','template.manage','template.delete',
    'ai.use','ai.limits','ai.ledger.all',
    'billing.pay','billing.invoices','billing.notices',
    'team.invite.admin','team.invite.member','team.role.admin','team.role.member',
    'team.remove.admin','team.remove.member','team.rename','team.transfer',
    'support_case.create','support_case.resolve'
  ))
);

comment on table public.approval_policies is 'Four-eyes approval policies for staff actions';
comment on column public.approval_policies.target_type is 'The type of target the policy applies to';
comment on column public.approval_policies.action is 'The specific action requiring approval';
comment on column public.approval_policies.min_roles is 'Minimum roles required (e.g. ["owner","admin"])' ;
comment on column public.approval_policies.allowed_roles is 'Roles allowed to participate in approval (e.g. ["super_admin","customer_success"])';
comment on column public.approval_policies.staleness_hours is 'Maximum age of approval in hours before it expires';

-- Enable RLS
alter table public.approval_policies enable row level security;

-- Policy: service role can do everything
grant all on public.approval_policies to service_role;

-- Policy: staff with appropriate role can read
create policy "staff can read approval policies" on public.approval_policies
  for select using (
    exists (select 1 from public.platform_staff ps where ps.email = current_setting('app.current_staff_email', true))
  );
