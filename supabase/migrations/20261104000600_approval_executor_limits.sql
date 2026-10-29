-- Approval executors for member AI limits and plan-lapse domain pauses.
--
-- Both are staff-checked RPCs called with the approving Super admin's session.
-- The executor re-checks the live member and domain before calling them.

create or replace function public.admin_ai_set_member_limit(
  p_team uuid,
  p_member uuid,
  p_monthly_credits integer,
  p_note text,
  p_approval uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old integer;
  v_name text;
begin
  perform public.staff_assert('ai.limits.approve');
  if p_note is null or length(trim(p_note)) < 10 then
    raise exception 'NOTE_REQUIRED';
  end if;
  if p_monthly_credits is null or p_monthly_credits < 0 or p_monthly_credits > 1000000 then
    raise exception 'BAD_LIMIT';
  end if;

  select coalesce(nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''), u.email, 'A team member')
    into v_name
    from auth.users u
    join public.team_members m
      on m.user_id = u.id
     and m.team_id = p_team
     and m.status = 'active'
    where u.id = p_member;
  if v_name is null then
    raise exception 'MEMBER_NOT_FOUND';
  end if;

  select monthly_credits into v_old
    from public.credit_member_caps
    where team_id = p_team and user_id = p_member
    for update;

  insert into public.credit_member_caps (team_id, user_id, monthly_credits, updated_by, updated_at)
  values (p_team, p_member, p_monthly_credits, auth.uid(), now())
  on conflict (team_id, user_id) do update
    set monthly_credits = excluded.monthly_credits,
        updated_by = excluded.updated_by,
        updated_at = now();

  perform public.log_team_activity(
    p_team, null, 'Get-On support', null, 'support', 'ai', 'ai_limit_set',
    format('Get-On support set the monthly AI limit for %s to %s', v_name, p_monthly_credits),
    null, null, 'ai', p_member, v_name, null,
    jsonb_build_object('from', v_old, 'to', p_monthly_credits, 'note', p_note),
    null, 0
  );

  perform public.staff_audit(
    'ai.limit_set', 'ai', p_member::text, null, p_note, p_approval,
    jsonb_build_object('team_id', p_team, 'from', v_old, 'to', p_monthly_credits),
    null, null
  );

  return jsonb_build_object('ok', true, 'from', v_old, 'to', p_monthly_credits);
end;
$$;

revoke all on function public.admin_ai_set_member_limit(uuid, uuid, integer, text, uuid) from public;
grant execute on function public.admin_ai_set_member_limit(uuid, uuid, integer, text, uuid) to authenticated, service_role;
