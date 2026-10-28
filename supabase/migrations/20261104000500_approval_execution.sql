-- Approval execution support: a failed request can be retried safely, and a
-- refund remembers which approval created it so a retry cannot refund twice.

alter table public.refunds
  add column if not exists approval_id uuid references public.approval_requests(id) on delete set null;

create index if not exists refunds_approval_idx
  on public.refunds (approval_id)
  where approval_id is not null;

create or replace function public.approval_retry(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.approval_requests;
  v_policy public.approval_policies;
begin
  select * into v_req from public.approval_requests where id = p_request_id for update;
  if v_req.id is null then
    raise exception 'APPROVAL_NOT_FOUND';
  end if;
  select * into v_policy from public.approval_policies where kind = v_req.kind;
  perform public.staff_assert(v_policy.approve_permission);

  if v_req.status <> 'failed' then
    raise exception 'APPROVAL_NOT_FAILED';
  end if;
  if v_req.expires_at <= now() then
    update public.approval_requests set status = 'expired' where id = p_request_id;
    raise exception 'APPROVAL_EXPIRED';
  end if;

  update public.approval_requests
  set status = 'approved',
      executed_at = null,
      execution_error = null
  where id = p_request_id;

  perform public.staff_audit(
    'retry', 'approval', p_request_id::text, 'write',
    null, p_request_id, jsonb_build_object('previous_error', v_req.execution_error)
  );
end;
$$;

revoke all on function public.approval_retry(uuid) from public;
grant execute on function public.approval_retry(uuid) to authenticated, service_role;

-- Only a member who can approve this kind may execute it. Before this, any
-- staff member could call begin/finish directly and mark a request done.
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
  v_policy public.approval_policies;
begin
  if auth.role() <> 'service_role' then
    perform public.staff_assert('staff.view');
  end if;
  select * into v_req from public.approval_requests where id = p_request_id for update;
  if v_req.id is null then
    raise exception 'APPROVAL_NOT_FOUND';
  end if;
  if auth.role() <> 'service_role' then
    select * into v_policy from public.approval_policies where kind = v_req.kind;
    perform public.staff_assert(v_policy.approve_permission);
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
declare
  v_req public.approval_requests;
  v_policy public.approval_policies;
begin
  select * into v_req from public.approval_requests where id = p_request_id for update;
  if v_req.id is null then
    raise exception 'APPROVAL_NOT_FOUND';
  end if;
  if auth.role() <> 'service_role' then
    select * into v_policy from public.approval_policies where kind = v_req.kind;
    perform public.staff_assert(v_policy.approve_permission);
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

revoke all on function public.approval_begin_execute(uuid, text) from public;
revoke all on function public.approval_finish_execute(uuid, boolean, text) from public;
grant execute on function public.approval_begin_execute(uuid, text) to authenticated, service_role;
grant execute on function public.approval_finish_execute(uuid, boolean, text) to authenticated, service_role;

-- Plan changes use the same direct permission as free access. The rebuild
-- permission is available to customer success, so it must not be a shortcut
-- around the plan-change policy.
create or replace function public.admin_set_team_plan(
  p_team uuid,
  p_plan text,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old text;
  v_name text;
begin
  perform public.staff_assert('access.free.direct');
  if p_note is null or length(trim(p_note)) < 3 then
    raise exception 'NOTE_REQUIRED';
  end if;
  if not exists (select 1 from public.plans where id = p_plan) then
    raise exception 'PLAN_NOT_FOUND';
  end if;

  select plan_id, name into v_old, v_name from public.teams where id = p_team;
  if v_old is null then
    raise exception 'TEAM_NOT_FOUND';
  end if;

  update public.teams set plan_id = p_plan, plan_source = 'manual' where id = p_team;
  perform public.enforce_seat_plan(p_team);
  perform public.restore_seat_plan(p_team);

  perform public.log_team_activity(
    p_team, null, 'Get-On support', null, 'support', 'team', 'plan_changed',
    format('Get-On support changed the plan to %s', initcap(p_plan)),
    null, null, 'team', p_team, v_name, null,
    jsonb_build_object('from', v_old, 'to', p_plan, 'note', p_note)
  );

  perform public.staff_audit(
    'team.plan_changed', 'team', p_team::text, null, p_note, null,
    jsonb_build_object('from', v_old, 'to', p_plan), null, null
  );

  return jsonb_build_object('ok', true, 'from', v_old, 'to', p_plan);
end;
$$;

revoke all on function public.admin_set_team_plan(uuid, text, text) from public;
grant execute on function public.admin_set_team_plan(uuid, text, text) to authenticated, service_role;
