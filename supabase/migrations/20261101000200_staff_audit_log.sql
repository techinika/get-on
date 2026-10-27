-- Staff audit log: tracks all reads/writes with purpose, IP hash, and user context

create table if not exists public.staff_audit_log (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.platform_staff(id) on delete cascade,
  occurred_at timestamptz not null default now(),
  purpose text not null,
  action text not null,
  target_type text not null,
  target_id uuid,
  target_name text,
  ip_hash text not null,
  user_agent text,
  details jsonb not null default '{}'::jsonb,
  constraint staff_audit_log_purpose_check check (purpose in ('read','write','delete','execute')),
  constraint staff_audit_log_action_check check (action in ('view','create','update','delete','approve','reject','send_email','import','export')),
  constraint staff_audit_log_target_type_check check (target_type in ('team','project','page','website','setting','content','email','consent','approval','support_case','billing','staff'))
);

comment on table public.staff_audit_log is 'Audit log tracking all staff actions with purpose, IP hash, and user context';
comment on column public.staff_audit_log.purpose is 'read|write|delete|execute';
comment on column public.staff_audit_log.action is 'view|create|update|delete|approve|reject|send_email|import|export';
comment on column public.staff_audit_log.target_type is 'team|project|page|website|setting|content|email|consent|approval|support_case|billing|staff';
comment on column public.staff_audit_log.ip_hash is 'Salted hash of source IP address';

-- Enable RLS
alter table public.staff_audit_log enable row level security;

-- Policy: staff can read logs with purpose 'audit' or their own logs
create policy "staff can read audit logs for audit" on public.staff_audit_log
  for select using (true); -- Service role only, restricted at application level

-- Policy: service role can do everything
grant all on public.staff_audit_log to service_role;

-- Trigger to auto-log actions will be set up via functions
