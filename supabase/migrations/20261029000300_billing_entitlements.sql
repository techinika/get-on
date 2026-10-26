-- Transfers use the effective plan resolver, not the teams.plan_id cache.

create or replace function public.accept_ownership_transfer(p_token_hash text, p_team uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_email text;
  v_transfer public.ownership_transfers;
  v_project public.projects;
  v_role text;
  v_access jsonb;
  v_max_sites int;
  v_max_pages int;
  v_sites int;
  v_pages int;
  v_from_team_name text;
  v_to_team_name text;
begin
  if v_user is null then
    raise exception 'NOT_ALLOWED';
  end if;
  if p_token_hash is null or length(p_token_hash) < 32 or p_team is null then
    raise exception 'TRANSFER_NOT_FOUND';
  end if;

  select email into v_email from auth.users where id = v_user;

  select * into v_transfer
  from public.ownership_transfers
  where token_hash = p_token_hash
  for update;

  if v_transfer.id is null then
    raise exception 'TRANSFER_NOT_FOUND';
  end if;
  if v_transfer.status <> 'pending' then
    raise exception 'TRANSFER_NOT_PENDING';
  end if;
  if v_transfer.expires_at <= now() then
    update public.ownership_transfers
    set status = 'expired', resolved_at = now()
    where id = v_transfer.id and status = 'pending';
    raise exception 'TRANSFER_EXPIRED';
  end if;
  if lower(coalesce(v_transfer.to_email, '')) <> lower(coalesce(v_email, '')) then
    raise exception 'TRANSFER_EMAIL_MISMATCH';
  end if;

  select * into v_project from public.projects where id = v_transfer.project_id for update;
  if v_project.id is null or v_project.team_id <> v_transfer.from_team_id then
    raise exception 'TRANSFER_STALE';
  end if;
  if v_project.deleted_at is not null then
    raise exception 'TRANSFER_DELETED';
  end if;
  if p_team = v_transfer.from_team_id then
    raise exception 'TRANSFER_SAME_TEAM';
  end if;

  select tm.role into v_role
  from public.team_members tm
  where tm.team_id = p_team and tm.user_id = v_user and tm.status = 'active';
  if v_role is null or v_role not in ('owner','admin') then
    raise exception 'TRANSFER_FORBIDDEN';
  end if;

  v_access := public.billing_resolve_team(p_team, now());
  v_max_sites := nullif(v_access->'limits'->>'maxWebsites', '')::int;
  v_max_pages := nullif(v_access->'limits'->>'maxPagesPerSite', '')::int;

  if v_max_sites is not null then
    select count(*) into v_sites
    from public.projects
    where team_id = p_team and deleted_at is null;
    if v_sites >= v_max_sites then
      raise exception 'TRANSFER_SITE_LIMIT';
    end if;
  end if;

  if v_max_pages is not null then
    select count(*) into v_pages from public.pages where project_id = v_project.id;
    if v_pages > v_max_pages then
      raise exception 'TRANSFER_PAGE_LIMIT';
    end if;
  end if;

  if exists (
    select 1 from public.project_operations
    where project_id = v_project.id and heavy and status in ('queued','running')
  ) then
    raise exception 'PROJECT_BUSY';
  end if;

  select name into v_from_team_name from public.teams where id = v_transfer.from_team_id;
  select name into v_to_team_name from public.teams where id = p_team;

  update public.projects
  set team_id = p_team, updated_at = now()
  where id = v_project.id;

  update public.ownership_transfers
  set status = 'accepted',
      to_team_id = p_team,
      resolved_at = now(),
      resolved_by = v_user,
      result = jsonb_build_object(
        'team_id', p_team,
        'team_name', v_to_team_name,
        'project_name', v_project.name
      )
  where id = v_transfer.id;

  return jsonb_build_object(
    'project_id', v_project.id,
    'project_name', v_project.name,
    'from_team_id', v_transfer.from_team_id,
    'from_team_name', v_from_team_name,
    'to_team_id', p_team,
    'to_team_name', v_to_team_name
  );
end;
$$;

revoke all on function public.accept_ownership_transfer(text, uuid) from public;
grant execute on function public.accept_ownership_transfer(text, uuid) to authenticated;
