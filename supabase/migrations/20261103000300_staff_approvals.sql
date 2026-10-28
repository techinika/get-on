-- Four-eyes approvals. Customer success requests; a super admin decides, and a
-- second super admin decides too when the policy requires dual control.
--
-- Requests are state-checked again when they execute. If the underlying state
-- changed, the request must be re-made (APPROVAL_STALE).

create table if not exists public.approval_policies (
  kind text primary key,
  label text not null,
  description text,
  request_permission text not null,
  approve_permission text not null,
  requires_second boolean not null default false,
  threshold_usd numeric(10, 2),
  threshold_credits integer,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Compatibility with the first draft policy table.
alter table public.approval_policies
  add column if not exists kind text,
  add column if not exists label text,
  add column if not exists request_permission text,
  add column if not exists approve_permission text,
  add column if not exists requires_second boolean default false,
  add column if not exists threshold_usd numeric(10, 2),
  add column if not exists threshold_credits integer,
  add column if not exists active boolean default true,
  add column if not exists description text,
  add column if not exists created_at timestamptz default now();

alter table public.approval_policies alter column created_at set default now();

do $$
declare
  v_col record;
begin
  for v_col in
    select c.column_name
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'approval_policies'
      and c.is_nullable = 'NO'
      and c.column_default is null
      and c.is_identity = 'NO'
      and c.is_generated <> 'ALWAYS'
      and c.column_name not in ('label', 'request_permission', 'approve_permission')
      and not exists (
        select 1 from pg_index i
        join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any (i.indkey)
        where i.indrelid = 'public.approval_policies'::regclass
          and i.indisprimary and a.attname = c.column_name
      )
  loop
    execute format('alter table public.approval_policies alter column %I drop not null', v_col.column_name);
  end loop;

  for v_col in
    select conname from pg_constraint
    where conrelid = 'public.approval_policies'::regclass and contype = 'c'
  loop
    execute format('alter table public.approval_policies drop constraint %I', v_col.conname);
  end loop;
end $$;

delete from public.approval_policies a
using public.approval_policies b
where a.ctid < b.ctid
  and a.kind is not null
  and a.kind = b.kind;


-- Make sure a legacy id column can fill itself when inserts omit it.
do $$
declare
  v_type text;
  v_default text;
  v_identity text;
  v_seq text;
begin
  select data_type, column_default, is_identity
    into v_type, v_default, v_identity
  from information_schema.columns
  where table_schema = 'public' and table_name = 'approval_policies' and column_name = 'id';

  if v_type is null or v_identity = 'YES' or v_default is not null then
    return;
  end if;

  if v_type = 'uuid' then
    execute 'alter table public.approval_policies alter column id set default gen_random_uuid()';
  elsif v_type in ('bigint', 'integer', 'smallint') then
    v_seq := 'approval_policies_id_seq';
    execute format('create sequence if not exists public.%I', v_seq);
    execute format(
      'alter table public.approval_policies alter column id set default nextval(%L::regclass)',
      'public.' || v_seq
    );
    execute format(
      'select setval(%L::regclass, greatest(coalesce((select max(id) from public.approval_policies), 0), 1), true)',
      'public.' || v_seq
    );
  end if;
end $$;

create unique index if not exists approval_policies_kind_key
  on public.approval_policies (kind);

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'approval_policies' and column_name = 'name') then
    alter table public.approval_policies alter column name drop not null;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'approval_policies' and column_name = 'target_type') then
    alter table public.approval_policies alter column target_type drop not null;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'approval_policies' and column_name = 'action') then
    alter table public.approval_policies alter column action drop not null;
  end if;
end $$;

insert into public.approval_policies (
  kind, label, description, request_permission, approve_permission,
  requires_second, threshold_usd, threshold_credits
) values
  ('refund', 'Refund a payment', 'Money back to a customer.', 'billing.refund.request', 'billing.refund.approve', true, 200.00, null),
  ('manual_payment', 'Record a manual payment', 'Mark an invoice paid outside the provider.', 'billing.manual_payment.request', 'billing.manual_payment.approve', true, 500.00, null),
  ('credit_adjust', 'Adjust a credit balance', 'Add or remove account credit.', 'billing.credit_adjust.request', 'billing.credit_adjust.approve', true, 100.00, null),
  ('ai_credits', 'Add AI credits', 'Top up a team AI balance.', 'ai.credits.request', 'ai.credits.approve', true, null, 1000),
  ('access_grant', 'Give free access', 'Let a team use a paid plan without payment.', 'access.free.request', 'access.free.approve', true, null, null),
  ('free_access', 'Give free access', 'Let a team use a paid plan without payment.', 'access.free.request', 'access.free.approve', true, null, null),
  ('invoice_void', 'Void an invoice', 'Cancel an invoice before payment.', 'billing.invoice.void.request', 'billing.invoice.void.approve', true, null, null),
  ('grace_extend', 'Extend grace time', 'Keep a website online beyond the normal grace.', 'billing.grace_extend.request', 'billing.grace_extend.approve', false, null, null),
  ('billing_hold', 'Place a billing hold', 'Stop billing reminders while a case is open.', 'billing.hold.request', 'billing.hold.approve', true, null, null),
  ('plan_change', 'Change a plan', 'Move a team to another plan by hand.', 'access.free.request', 'access.free.approve', true, null, null),
  ('credits_limit', 'Change an AI limit', 'Raise or lower a member AI limit.', 'ai.limits.request', 'ai.limits.approve', false, null, null),
  ('website_takedown', 'Take a website down', 'Suspend a published website.', 'website.takedown.request', 'website.takedown.approve', false, null, null),
  ('website_reinstate', 'Bring a website back', 'Restore a suspended website.', 'website.reinstate.request', 'website.reinstate.approve', false, null, null),
  ('website_plan_pause', 'Pause a website for a plan', 'Set the plan-lapsed pause state.', 'website.plan_pause.request', 'website.plan_pause.approve', false, null, null),
  ('domain_review', 'Decide a domain review', 'Approve or reject a domain under review.', 'domain.review.request', 'domain.review.approve', false, null, null),
  ('domain_plan_lapse', 'Pause a domain for a plan', 'Set a custom address to paused.', 'domain.plan_lapse.request', 'domain.plan_lapse.approve', false, null, null),
  ('domain_remove', 'Remove a custom address', 'Remove an address from a website.', 'domain.remove.request', 'domain.remove.approve', false, null, null),
  ('account_delete', 'Delete an account', 'Delete a customer account.', 'account.delete.request', 'account.delete.approve', true, null, null),
  ('template_publish', 'Publish a system template', 'Change the default templates.', 'template.system.manage', 'template.system.manage', false, null, null)
on conflict (kind) do update set
  label = excluded.label,
  description = excluded.description,
  request_permission = excluded.request_permission,
  approve_permission = excluded.approve_permission,
  requires_second = excluded.requires_second,
  threshold_usd = excluded.threshold_usd,
  threshold_credits = excluded.threshold_credits;

create table if not exists public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  kind text not null references public.approval_policies(kind),
  target_type text not null,
  target_id text not null,
  requested_by uuid not null references auth.users(id) on delete cascade,
  requested_at timestamptz not null default now(),
  reason text not null,
  payload jsonb not null default '{}'::jsonb,
  state_hash text,
  status text not null default 'pending',
  requires_second boolean not null default false,
  single_operator boolean not null default false,
  first_approved_by uuid references auth.users(id) on delete set null,
  first_approved_at timestamptz,
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  decision_reason text,
  executed_at timestamptz,
  execution_error text,
  expires_at timestamptz not null default (now() + interval '72 hours'),
  constraint approval_requests_status_check check (
    status in ('pending', 'approved', 'rejected', 'cancelled', 'executed', 'failed', 'expired')
  ),
  constraint approval_requests_reason_check check (char_length(trim(reason)) >= 10),
  constraint approval_requests_target_check check (
    target_type in ('team', 'project', 'website', 'domain', 'invoice', 'payment', 'ai', 'staff', 'account')
  )
);


-- Compatibility with the first draft request table.
alter table public.approval_requests
  add column if not exists kind text,
  add column if not exists requested_by uuid references auth.users(id) on delete cascade,
  add column if not exists requested_at timestamptz default now(),
  add column if not exists reason text,
  add column if not exists payload jsonb default '{}'::jsonb,
  add column if not exists state_hash text,
  add column if not exists requires_second boolean default false,
  add column if not exists single_operator boolean default false,
  add column if not exists first_approved_by uuid references auth.users(id) on delete set null,
  add column if not exists first_approved_at timestamptz,
  add column if not exists decided_by uuid references auth.users(id) on delete set null,
  add column if not exists decided_at timestamptz,
  add column if not exists decision_reason text,
  add column if not exists executed_at timestamptz,
  add column if not exists execution_error text,
  add column if not exists expires_at timestamptz default (now() + interval '72 hours'),
  add column if not exists target_type text,
  add column if not exists target_id text,
  add column if not exists status text default 'pending';

alter table public.approval_requests alter column requested_at set default now();
alter table public.approval_requests alter column payload set default '{}'::jsonb;

do $$
declare
  v_col record;
begin
  for v_col in
    select c.column_name
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'approval_requests'
      and c.is_nullable = 'NO'
      and c.column_default is null
      and c.is_identity = 'NO'
      and c.is_generated <> 'ALWAYS'
      and c.column_name not in ('kind', 'target_type', 'target_id', 'requested_by', 'reason')
      and not exists (
        select 1 from pg_index i
        join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any (i.indkey)
        where i.indrelid = 'public.approval_requests'::regclass
          and i.indisprimary and a.attname = c.column_name
      )
  loop
    execute format('alter table public.approval_requests alter column %I drop not null', v_col.column_name);
  end loop;
end $$;

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'approval_requests' and column_name = 'policy_id') then
    alter table public.approval_requests alter column policy_id drop not null;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'approval_requests' and column_name = 'requester_id') then
    alter table public.approval_requests alter column requester_id drop not null;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'approval_requests'
      and column_name = 'target_id' and data_type = 'uuid'
  ) then
    alter table public.approval_requests alter column target_id type text using target_id::text;
  end if;
end $$;

do $$
declare
  v_con text;
begin
  for v_con in
    select conname from pg_constraint
    where conrelid = 'public.approval_requests'::regclass and contype = 'c'
  loop
    execute format('alter table public.approval_requests drop constraint %I', v_con);
  end loop;
end $$;

alter table public.approval_requests
  add constraint approval_requests_status_check check (
    status in ('pending', 'approved', 'rejected', 'executed', 'failed', 'cancelled', 'expired')
  ) not valid;


-- Make sure a legacy id column can fill itself when inserts omit it.
do $$
declare
  v_type text;
  v_default text;
  v_identity text;
  v_seq text;
begin
  select data_type, column_default, is_identity
    into v_type, v_default, v_identity
  from information_schema.columns
  where table_schema = 'public' and table_name = 'approval_requests' and column_name = 'id';

  if v_type is null or v_identity = 'YES' or v_default is not null then
    return;
  end if;

  if v_type = 'uuid' then
    execute 'alter table public.approval_requests alter column id set default gen_random_uuid()';
  elsif v_type in ('bigint', 'integer', 'smallint') then
    v_seq := 'approval_requests_id_seq';
    execute format('create sequence if not exists public.%I', v_seq);
    execute format(
      'alter table public.approval_requests alter column id set default nextval(%L::regclass)',
      'public.' || v_seq
    );
    execute format(
      'select setval(%L::regclass, greatest(coalesce((select max(id) from public.approval_requests), 0), 1), true)',
      'public.' || v_seq
    );
  end if;
end $$;

create index if not exists approval_requests_open_idx
  on public.approval_requests (status, expires_at)
  where status = 'pending';
create index if not exists approval_requests_requester_idx
  on public.approval_requests (requested_by, requested_at desc);
create index if not exists approval_requests_target_idx
  on public.approval_requests (target_type, target_id, requested_at desc);
delete from public.approval_requests a
using public.approval_requests b
where a.ctid < b.ctid
  and a.status = 'pending'
  and b.status = 'pending'
  and a.kind is not distinct from b.kind
  and a.target_type is not distinct from b.target_type
  and a.target_id is not distinct from b.target_id
  and a.requested_by is not distinct from b.requested_by;

create unique index if not exists approval_requests_one_open_idx
  on public.approval_requests (kind, target_type, target_id, requested_by)
  where status = 'pending';

-- Request ----------------------------------------------------------------

create or replace function public.approval_request(
  p_kind text,
  p_target_type text,
  p_target_id text,
  p_reason text,
  p_payload jsonb default '{}'::jsonb,
  p_state_hash text default null,
  p_amount_usd numeric default null,
  p_amount_credits integer default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_policy public.approval_policies;
  v_id uuid;
  v_open int;
  v_super_count int;
  v_requires_second boolean;
  v_single boolean := false;
begin
  select * into v_policy from public.approval_policies where kind = p_kind and active;
  if v_policy.kind is null then
    raise exception 'APPROVAL_UNKNOWN';
  end if;
  perform public.staff_assert(v_policy.request_permission);

  if char_length(trim(coalesce(p_reason, ''))) < 10 then
    raise exception 'APPROVAL_REASON';
  end if;

  select count(*) into v_open
  from public.approval_requests
  where requested_by = auth.uid() and status = 'pending';
  if v_open >= 20 then
    raise exception 'APPROVAL_TOO_MANY_OPEN';
  end if;

  select count(*) into v_super_count
  from public.platform_staff
  where role = 'super_admin' and status = 'active';

  v_requires_second := v_policy.requires_second
    and (
      (v_policy.threshold_usd is not null and coalesce(p_amount_usd, 0) > v_policy.threshold_usd)
      or (v_policy.threshold_credits is not null and coalesce(p_amount_credits, 0) > v_policy.threshold_credits)
      or (v_policy.threshold_usd is null and v_policy.threshold_credits is null)
    )
    and not (
      p_kind = 'grace_extend'
      and coalesce(p_payload->>'days', '') ~ '^[0-9]+$'
      and (p_payload->>'days')::int <= 90
    );

  if v_requires_second and v_super_count < 2 then
    v_single := true;
    v_requires_second := false;
  end if;

  insert into public.approval_requests (
    kind, target_type, target_id, requested_by, reason, payload,
    state_hash, requires_second, single_operator
  ) values (
    p_kind, p_target_type, p_target_id, auth.uid(), trim(p_reason),
    coalesce(p_payload, '{}'::jsonb), p_state_hash, v_requires_second, v_single
  )
  returning id into v_id;

  perform public.staff_audit(
    'request', 'approval', v_id::text, 'write', trim(p_reason), v_id,
    jsonb_build_object(
      'kind', p_kind,
      'target_type', p_target_type,
      'target_id', p_target_id,
      'requires_second', v_requires_second,
      'single_operator', v_single
    )
  );

  return v_id;
end;
$$;

-- Decide -----------------------------------------------------------------

create or replace function public.approval_decide(
  p_request_id uuid,
  p_decision text,
  p_reason text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.approval_requests;
  v_policy public.approval_policies;
  v_status text;
begin
  select * into v_req from public.approval_requests where id = p_request_id for update;
  if v_req.id is null then
    raise exception 'APPROVAL_NOT_FOUND';
  end if;
  select * into v_policy from public.approval_policies where kind = v_req.kind;
  perform public.staff_assert(v_policy.approve_permission);

  if v_req.status <> 'pending' then
    raise exception 'APPROVAL_NOT_PENDING';
  end if;
  if v_req.expires_at <= now() then
    update public.approval_requests set status = 'expired' where id = p_request_id;
    raise exception 'APPROVAL_EXPIRED';
  end if;
  if v_req.requested_by = auth.uid() then
    raise exception 'APPROVAL_FOUR_EYES';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception 'APPROVAL_INVALID_DECISION';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) < 10 then
    raise exception 'APPROVAL_REASON';
  end if;

  if p_decision = 'rejected' then
    update public.approval_requests
      set status = 'rejected',
          decided_by = auth.uid(),
          decided_at = now(),
          decision_reason = trim(p_reason)
      where id = p_request_id;
    v_status := 'rejected';
  elsif v_req.requires_second and v_req.first_approved_by is null then
    update public.approval_requests
      set first_approved_by = auth.uid(),
          first_approved_at = now(),
          decision_reason = trim(p_reason)
      where id = p_request_id;
    v_status := 'awaiting_second';
  elsif v_req.requires_second
        and v_req.first_approved_by is not null
        and v_req.first_approved_by = auth.uid() then
    raise exception 'APPROVAL_FOUR_EYES';
  else
    update public.approval_requests
      set status = 'approved',
          decided_by = auth.uid(),
          decided_at = now(),
          decision_reason = trim(p_reason)
      where id = p_request_id;
    v_status := 'approved';
  end if;

  perform public.staff_audit(
    case when v_status = 'rejected' then 'reject' else 'approve' end,
    'approval', p_request_id::text, 'write', trim(p_reason), p_request_id,
    jsonb_build_object('decision', p_decision, 'result', v_status)
  );

  return v_status;
end;
$$;

-- Execute ----------------------------------------------------------------

create or replace function public.approval_begin_execute(
  p_request_id uuid,
  p_state_hash text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.approval_requests;
begin
  if auth.role() <> 'service_role' then
    perform public.staff_assert('staff.view');
  end if;
  select * into v_req from public.approval_requests where id = p_request_id for update;
  if v_req.id is null then
    raise exception 'APPROVAL_NOT_FOUND';
  end if;
  if v_req.status <> 'approved' then
    raise exception 'APPROVAL_NOT_APPROVED';
  end if;
  if v_req.expires_at <= now() then
    update public.approval_requests set status = 'expired' where id = p_request_id;
    raise exception 'APPROVAL_EXPIRED';
  end if;
  if p_state_hash is not null and v_req.state_hash is not null
     and p_state_hash <> v_req.state_hash then
    raise exception 'APPROVAL_STALE';
  end if;
  return jsonb_build_object(
    'id', v_req.id,
    'kind', v_req.kind,
    'target_type', v_req.target_type,
    'target_id', v_req.target_id,
    'payload', v_req.payload
  );
end;
$$;

create or replace function public.approval_finish_execute(
  p_request_id uuid,
  p_ok boolean,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' and public.staff_role() is null then
    raise exception 'NOT_STAFF';
  end if;
  update public.approval_requests
    set status = case when p_ok then 'executed' else 'failed' end,
        executed_at = now(),
        execution_error = case when p_ok then null else left(p_error, 500) end
    where id = p_request_id
      and status = 'approved';
  perform public.staff_audit(
    'execute', 'approval', p_request_id::text, 'write',
    null, p_request_id, jsonb_build_object('ok', p_ok, 'error', p_error)
  );
end;
$$;

create or replace function public.approval_cancel(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.approval_requests
    set status = 'cancelled'
    where id = p_request_id
      and requested_by = auth.uid()
      and status = 'pending';
  if not found then
    raise exception 'APPROVAL_NOT_PENDING';
  end if;
end;
$$;

create or replace function public.approval_expire()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if auth.role() <> 'service_role' then
    raise exception 'NOT_ALLOWED';
  end if;
  update public.approval_requests
    set status = 'expired'
    where status in ('pending', 'approved')
      and expires_at <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

alter table public.approval_policies enable row level security;
alter table public.approval_requests enable row level security;

drop policy if exists "staff read approval policies" on public.approval_policies;
create policy "staff read approval policies"
  on public.approval_policies
  for select to authenticated
  using (public.is_staff());

drop policy if exists "staff read approval requests" on public.approval_requests;
create policy "staff read approval requests"
  on public.approval_requests
  for select to authenticated
  using (
    public.is_staff()
    and (
      requested_by = auth.uid()
      or public.staff_role() = 'super_admin'
    )
  );

revoke all on public.approval_policies from anon;
revoke all on public.approval_requests from anon;
grant select on public.approval_policies to authenticated;
grant select on public.approval_requests to authenticated;
grant all on public.approval_policies to service_role;
grant all on public.approval_requests to service_role;

revoke all on function public.approval_request(text, text, text, text, jsonb, text, numeric, integer) from public;
revoke all on function public.approval_decide(uuid, text, text) from public;
revoke all on function public.approval_begin_execute(uuid, text) from public;
revoke all on function public.approval_finish_execute(uuid, boolean, text) from public;
revoke all on function public.approval_cancel(uuid) from public;
revoke all on function public.approval_expire() from public;

grant execute on function public.approval_request(text, text, text, text, jsonb, text, numeric, integer) to authenticated, service_role;
grant execute on function public.approval_decide(uuid, text, text) to authenticated, service_role;
grant execute on function public.approval_begin_execute(uuid, text) to authenticated, service_role;
grant execute on function public.approval_finish_execute(uuid, boolean, text) to authenticated, service_role;
grant execute on function public.approval_cancel(uuid) to authenticated, service_role;
grant execute on function public.approval_expire() to service_role;
