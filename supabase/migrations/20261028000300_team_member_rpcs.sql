-- Member, invitation, ownership and plan RPCs.

create or replace function public.team_actor_name(p_user uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(nullif(full_name, ''), email, 'Former member')
  from public.profiles where id = p_user;
$$;

revoke all on function public.team_actor_name(uuid) from public;
grant execute on function public.team_actor_name(uuid) to service_role;

create or replace function public.change_member_role(p_team uuid, p_user uuid, p_role text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_target_role text;
  v_actor_name text;
  v_target_name text;
begin
  if p_role not in ('admin','editor','viewer') then
    raise exception 'ROLE_NOT_ALLOWED';
  end if;
  if p_user = v_actor then
    raise exception 'ROLE_NOT_ALLOWED';
  end if;

  select role into v_actor_role from public.team_members
    where team_id = p_team and user_id = v_actor and status = 'active';
  select role into v_target_role from public.team_members
    where team_id = p_team and user_id = p_user and status = 'active';

  if v_actor_role is null or v_target_role is null then
    raise exception 'NOT_ALLOWED';
  end if;
  if v_target_role = 'owner' then
    raise exception 'OWNER_PROTECTED';
  end if;

  if v_target_role = 'admin' and not public.team_can(p_team, 'team.role.admin') then
    raise exception 'ROLE_NOT_ALLOWED';
  end if;
  if p_role = 'admin' then
    if not public.team_can(p_team, 'team.role.admin') then
      raise exception 'ROLE_NOT_ALLOWED';
    end if;
  elsif not public.team_can(p_team, 'team.role.member') then
    raise exception 'ROLE_NOT_ALLOWED';
  end if;

  update public.team_members set role = p_role
    where team_id = p_team and user_id = p_user;

  v_actor_name := public.team_actor_name(v_actor);
  v_target_name := public.team_actor_name(p_user);
  perform public.log_team_activity(
    p_team, v_actor, v_actor_name, v_actor_role, 'user', 'member', 'member_role_changed',
    format('%s made %s an %s', v_actor_name, v_target_name,
      case p_role when 'admin' then 'Admin' when 'editor' then 'Editor' else 'Viewer' end),
    null, null, 'member', p_user, v_target_name, null,
    jsonb_build_object('from', v_target_role, 'to', p_role)
  );
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.remove_member(p_team uuid, p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_target_role text;
  v_actor_name text;
  v_target_name text;
begin
  select role into v_actor_role from public.team_members
    where team_id = p_team and user_id = v_actor and status = 'active';
  select role into v_target_role from public.team_members
    where team_id = p_team and user_id = p_user and status = 'active';

  if v_actor_role is null or v_target_role is null then
    raise exception 'NOT_ALLOWED';
  end if;
  if v_target_role = 'owner' then
    raise exception 'OWNER_PROTECTED';
  end if;
  if v_target_role = 'admin' then
    if not public.team_can(p_team, 'team.remove.admin') then
      raise exception 'NOT_ALLOWED';
    end if;
  elsif not public.team_can(p_team, 'team.remove.member') then
    raise exception 'NOT_ALLOWED';
  end if;

  delete from public.team_members where team_id = p_team and user_id = p_user;
  v_actor_name := public.team_actor_name(v_actor);
  v_target_name := public.team_actor_name(p_user);
  perform public.log_team_activity(
    p_team, v_actor, v_actor_name, v_actor_role, 'user', 'member', 'member_removed',
    format('%s removed %s from the team', v_actor_name, v_target_name),
    null, null, 'member', p_user, v_target_name, null,
    jsonb_build_object('role', v_target_role)
  );
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.leave_team(p_team uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_role text;
  v_name text;
begin
  select role into v_role from public.team_members
    where team_id = p_team and user_id = v_actor and status = 'active';
  if v_role is null then
    raise exception 'NOT_ALLOWED';
  end if;
  if not public.team_can(p_team, 'team.leave') then
    raise exception 'OWNER_PROTECTED';
  end if;
  delete from public.team_members where team_id = p_team and user_id = v_actor;
  v_name := public.team_actor_name(v_actor);
  perform public.log_team_activity(
    p_team, v_actor, v_name, v_role, 'user', 'member', 'member_left',
    format('%s left the team', v_name), null, null, 'member', v_actor, v_name
  );
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.transfer_team_ownership(p_team uuid, p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_team record;
  v_actor_name text;
  v_target_name text;
begin
  select * into v_team from public.teams where id = p_team;
  if v_team.id is null then
    raise exception 'NOT_ALLOWED';
  end if;
  if v_team.is_personal then
    raise exception 'OWNER_PROTECTED';
  end if;
  if not public.team_can(p_team, 'team.transfer') then
    raise exception 'NOT_ALLOWED';
  end if;
  if not exists (
    select 1 from public.team_members
    where team_id = p_team and user_id = p_user and status = 'active'
  ) then
    raise exception 'NOT_ALLOWED';
  end if;

  perform set_config('app.owner_transfer', 'on', true);
  update public.team_members set role = 'admin' where team_id = p_team and user_id = v_actor;
  update public.team_members set role = 'owner' where team_id = p_team and user_id = p_user;
  update public.teams set owner_id = p_user, owner_changed_at = now() where id = p_team;
  perform set_config('app.owner_transfer', 'off', true);

  v_actor_name := public.team_actor_name(v_actor);
  v_target_name := public.team_actor_name(p_user);
  perform public.log_team_activity(
    p_team, v_actor, v_actor_name, 'owner', 'user', 'member', 'team_ownership_transferred',
    format('%s made %s the owner', v_actor_name, v_target_name),
    null, null, 'member', p_user, v_target_name, null,
    jsonb_build_object('from', v_actor, 'to', p_user)
  );
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.enforce_seat_plan(p_team uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit int;
  v_active int;
  v_paused int := 0;
  v_revoked int := 0;
  v_member record;
  v_remaining int;
begin
  select max_members into v_limit from public.plans p
    join public.teams t on t.plan_id = p.id where t.id = p_team;
  if v_limit is null then
    return jsonb_build_object('paused', 0, 'revoked', 0);
  end if;

  select count(*) into v_active from public.team_members
    where team_id = p_team and status = 'active';

  for v_member in
    select user_id from public.team_members
    where team_id = p_team and status = 'active' and role <> 'owner'
    order by joined_at desc, user_id
  loop
    exit when v_active <= v_limit;
    update public.team_members
      set status = 'paused', paused_at = now(), paused_reason = 'plan'
      where team_id = p_team and user_id = v_member.user_id;
    v_active := v_active - 1;
    v_paused := v_paused + 1;
  end loop;

  select v_limit - count(*) into v_remaining from public.team_members
    where team_id = p_team and status = 'active';
  if v_remaining < 0 then v_remaining := 0; end if;

  update public.team_invitations
    set status = 'revoked', resolved_at = now()
    where id in (
      select id from public.team_invitations
      where team_id = p_team and status = 'pending'
      order by created_at desc
      offset v_remaining
    );
  get diagnostics v_revoked = row_count;

  return jsonb_build_object('paused', v_paused, 'revoked', v_revoked);
end;
$$;

create or replace function public.restore_seat_plan(p_team uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit int;
  v_active int;
  v_member record;
  v_restored int := 0;
begin
  select max_members into v_limit from public.plans p
    join public.teams t on t.plan_id = p.id where t.id = p_team;
  if v_limit is null then
    v_limit := 2147483647;
  end if;

  select count(*) into v_active from public.team_members
    where team_id = p_team and status = 'active';

  for v_member in
    select user_id from public.team_members
    where team_id = p_team and status = 'paused'
    order by paused_at asc nulls first, joined_at asc
  loop
    exit when v_active >= v_limit;
    update public.team_members
      set status = 'active', paused_at = null, paused_reason = null
      where team_id = p_team and user_id = v_member.user_id;
    v_active := v_active + 1;
    v_restored := v_restored + 1;
  end loop;

  return jsonb_build_object('restored', v_restored);
end;
$$;

create or replace function public.set_team_plan_manual(
  p_team uuid,
  p_plan text,
  p_note text,
  p_admin_email text default 'support'
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
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'NOT_ALLOWED';
  end if;
  if p_note is null or length(trim(p_note)) < 3 then
    raise exception 'NOTE_REQUIRED';
  end if;
  if not exists (select 1 from public.plans where id = p_plan) then
    raise exception 'NOT_ALLOWED';
  end if;

  select plan_id, name into v_old, v_name from public.teams where id = p_team;
  if v_old is null then
    raise exception 'NOT_ALLOWED';
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

  insert into public.admin_audit_log (admin_email, action, reason, metadata)
  values (p_admin_email, 'team.plan_changed', p_note,
    jsonb_build_object('team_id', p_team, 'from', v_old, 'to', p_plan));

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.accept_invitation(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_email text;
  v_verified timestamptz;
  v_invite record;
  v_usage jsonb;
  v_name text;
  v_inviter text;
begin
  if v_user is null then
    raise exception 'NOT_ALLOWED';
  end if;

  select lower(email), email_confirmed_at into v_email, v_verified
    from auth.users where id = v_user;

  select * into v_invite from public.team_invitations
    where token_hash = p_token_hash;
  if v_invite.id is null then
    raise exception 'INVITE_EXPIRED';
  end if;
  if v_invite.status = 'accepted' and v_invite.accepted_by = v_user then
    return jsonb_build_object('ok', true, 'team_id', v_invite.team_id);
  end if;
  if v_invite.status <> 'pending' or v_invite.expires_at < now() then
    raise exception 'INVITE_EXPIRED';
  end if;
  if v_verified is null then
    raise exception 'INVITE_EMAIL_UNVERIFIED';
  end if;
  if lower(v_invite.email) <> v_email then
    raise exception 'INVITE_EMAIL_MISMATCH';
  end if;

  v_usage := public.team_seat_usage(v_invite.team_id);
  if (v_usage->>'seats_limit') is not null
     and (v_usage->>'active_members')::int >= (v_usage->>'seats_limit')::int then
    raise exception 'SEATS_FULL';
  end if;

  insert into public.team_members (team_id, user_id, role, invited_by, joined_at, status)
  values (v_invite.team_id, v_user, v_invite.role, v_invite.invited_by, now(), 'active')
  on conflict (team_id, user_id) do update
    set role = excluded.role, status = 'active', paused_at = null, paused_reason = null;

  update public.team_invitations
    set status = 'accepted', accepted_by = v_user, accepted_at = now(), resolved_at = now()
    where id = v_invite.id;

  v_name := public.team_actor_name(v_user);
  v_inviter := public.team_actor_name(v_invite.invited_by);
  perform public.log_team_activity(
    v_invite.team_id, v_user, v_name, v_invite.role, 'user', 'member', 'member_joined',
    format('%s joined the team as %s', v_name,
      case v_invite.role when 'admin' then 'Admin' when 'editor' then 'Editor' else 'Viewer' end),
    null, null, 'member', v_user, v_name, null,
    jsonb_build_object('invited_by', v_inviter)
  );
  perform public.log_team_activity(
    v_invite.team_id, v_user, v_name, v_invite.role, 'user', 'invitation', 'invite_accepted',
    format('%s accepted the invitation', v_name),
    null, null, 'invitation', v_invite.id, v_invite.email
  );

  return jsonb_build_object('ok', true, 'team_id', v_invite.team_id);
end;
$$;

revoke all on function public.change_member_role(uuid, uuid, text) from public;
revoke all on function public.remove_member(uuid, uuid) from public;
revoke all on function public.leave_team(uuid) from public;
revoke all on function public.transfer_team_ownership(uuid, uuid) from public;
revoke all on function public.enforce_seat_plan(uuid) from public;
revoke all on function public.restore_seat_plan(uuid) from public;
revoke all on function public.set_team_plan_manual(uuid, text, text, text) from public;
revoke all on function public.accept_invitation(text) from public;

grant execute on function public.change_member_role(uuid, uuid, text) to authenticated, service_role;
grant execute on function public.remove_member(uuid, uuid) to authenticated, service_role;
grant execute on function public.leave_team(uuid) to authenticated, service_role;
grant execute on function public.transfer_team_ownership(uuid, uuid) to authenticated, service_role;
grant execute on function public.enforce_seat_plan(uuid) to service_role;
grant execute on function public.restore_seat_plan(uuid) to service_role;
grant execute on function public.set_team_plan_manual(uuid, text, text, text) to service_role;
grant execute on function public.accept_invitation(text) to authenticated, service_role;
