-- Team platform functions: permissions, seats, quotas, activity, members.

-- Seat limits recorded in the product decision (Basic 1, Pro 5).
update public.plans set max_members = 1 where id = 'basic';
update public.plans set max_members = 5 where id = 'pro';
update public.plans set max_members = null where id = 'enterprise';

create table if not exists public.permission_matrix (
  action text primary key,
  owner boolean not null,
  admin boolean not null,
  editor boolean not null,
  viewer boolean not null
);

insert into public.permission_matrix (action, owner, admin, editor, viewer) values
  ('site.view', true, true, true, true),
  ('site.create', true, true, false, false),
  ('site.delete', true, true, false, false),
  ('site.restore', true, true, false, false),
  ('site.purge', true, false, false, false),
  ('site.transfer', true, true, false, false),
  ('page.edit', true, true, true, false),
  ('page.publish', true, true, true, false),
  ('site.settings', true, true, false, false),
  ('site.domains', true, true, false, false),
  ('site.plugins', true, true, false, false),
  ('site.backups', true, true, true, false),
  ('messages.read', true, true, true, false),
  ('template.use', true, true, true, false),
  ('template.manage', true, true, true, false),
  ('template.delete', true, true, false, false),
  ('ai.use', true, true, true, false),
  ('ai.limits', true, true, false, false),
  ('ai.ledger.all', true, true, false, false),
  ('team.view', true, true, true, true),
  ('team.invite.admin', true, false, false, false),
  ('team.invite.member', true, true, false, false),
  ('team.role.admin', true, false, false, false),
  ('team.role.member', true, true, false, false),
  ('team.remove.admin', true, false, false, false),
  ('team.remove.member', true, true, false, false),
  ('team.rename', true, true, false, false),
  ('team.transfer', true, false, false, false),
  ('team.leave', false, true, true, true),
  ('team.activity', true, true, false, false),
  ('site.activity', true, true, true, false),
  ('plan.view', true, true, false, false),
  ('plan.manage', true, false, false, false),
  ('referral.use', true, true, true, true)
on conflict (action) do update set
  owner = excluded.owner,
  admin = excluded.admin,
  editor = excluded.editor,
  viewer = excluded.viewer;

create or replace function public.team_can(p_team uuid, p_action text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select case tm.role
      when 'owner' then pm.owner
      when 'admin' then pm.admin
      when 'editor' then pm.editor
      when 'viewer' then pm.viewer
      else false
    end
    from public.team_members tm
    join public.permission_matrix pm on pm.action = p_action
    where tm.team_id = p_team
      and tm.user_id = auth.uid()
      and tm.status = 'active'
    limit 1
  ), false);
$$;

revoke all on function public.team_can(uuid, text) from public;
grant execute on function public.team_can(uuid, text) to authenticated, service_role;

create or replace function public.team_seat_usage(p_team uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_active int;
  v_pending int;
  v_limit int;
begin
  if auth.role() <> 'service_role'
     and not public.team_can(p_team, 'team.view')
     and not exists (
       select 1 from public.team_invitations
       where team_id = p_team and status = 'pending' and lower(email) = lower(coalesce(auth.email(), ''))
     ) then
    raise exception 'NOT_ALLOWED';
  end if;
  select count(*) into v_active from public.team_members where team_id = p_team and status = 'active';
  select count(*) into v_pending from public.team_invitations where team_id = p_team and status = 'pending';
  select max_members into v_limit from public.plans p join public.teams t on t.plan_id = p.id where t.id = p_team;
  return jsonb_build_object(
    'active_members', v_active,
    'pending_invitations', v_pending,
    'seats_used', v_active + v_pending,
    'seats_limit', v_limit,
    'seats_free', case when v_limit is null then null else v_limit - (v_active + v_pending) end
  );
end;
$$;

revoke all on function public.team_seat_usage(uuid) from public;
grant execute on function public.team_seat_usage(uuid) to authenticated, service_role;

create or replace function public.team_invitations_seat_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usage jsonb;
begin
  if new.status <> 'pending' then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(new.team_id::text, 0));
  v_usage := public.team_seat_usage(new.team_id);
  if (v_usage->>'seats_limit') is not null
     and (v_usage->>'seats_used')::int >= (v_usage->>'seats_limit')::int then
    raise exception 'SEATS_FULL';
  end if;
  return new;
end;
$$;

drop trigger if exists team_invitations_seat_guard on public.team_invitations;
create trigger team_invitations_seat_guard
  before insert on public.team_invitations
  for each row execute function public.team_invitations_seat_guard();

create or replace function public.team_members_owner_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.role = 'owner' and coalesce(current_setting('app.owner_transfer', true), '') <> 'on' then
      raise exception 'OWNER_PROTECTED';
    end if;
    return old;
  end if;

  if old.role = 'owner' and (
    new.role <> 'owner'
    or new.user_id <> old.user_id
    or new.team_id <> old.team_id
    or new.status <> 'active'
  ) and coalesce(current_setting('app.owner_transfer', true), '') <> 'on' then
    raise exception 'OWNER_PROTECTED';
  end if;

  return new;
end;
$$;

drop trigger if exists team_members_owner_guard on public.team_members;
create trigger team_members_owner_guard
  before update or delete on public.team_members
  for each row execute function public.team_members_owner_guard();

create or replace function public.team_quota_usage(p_team uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when auth.role() <> 'service_role' and not public.team_can(p_team, 'site.view') then
      null
    else jsonb_build_object(
    'active_sites', (select count(*) from public.projects where team_id = p_team and deleted_at is null),
    'deleted_pending', (select count(*) from public.projects where team_id = p_team and deleted_at is not null),
    'active_pages', (
      select count(*) from public.pages pg
      join public.projects p on p.id = pg.project_id
      where p.team_id = p_team and p.deleted_at is null
    ),
    'active_plugins', (
      select count(*) from public.plugin_installs pi
      join public.projects p on p.id = pi.project_id
      where p.team_id = p_team and p.deleted_at is null and pi.state = 'active'
    ),
    'active_domains', (
      select count(*) from public.domains d
      join public.projects p on p.id = d.project_id
      where p.team_id = p_team and p.deleted_at is null and d.removed_at is null
    ),
    'storage_bytes', (
      select coalesce(sum(m.size_bytes), 0) from public.media m
      join public.projects p on p.id = m.project_id
      where p.team_id = p_team and p.deleted_at is null
    ),
    'active_members', (select count(*) from public.team_members where team_id = p_team and status = 'active'),
    'pending_invitations', (select count(*) from public.team_invitations where team_id = p_team and status = 'pending'),
    'personal_templates', (
      select count(*) from public.templates where team_id = p_team and kind = 'team' and deleted_at is null
    ),
    'max_websites', (select max_websites from public.plans p join public.teams t on t.plan_id = p.id where t.id = p_team),
    'max_pages_per_site', (select max_pages_per_site from public.plans p join public.teams t on t.plan_id = p.id where t.id = p_team),
    'max_plugins', (select max_plugins from public.plans p join public.teams t on t.plan_id = p.id where t.id = p_team),
    'max_members', (select max_members from public.plans p join public.teams t on t.plan_id = p.id where t.id = p_team),
    'max_deleted_pending', (select max_deleted_pending from public.plans p join public.teams t on t.plan_id = p.id where t.id = p_team),
    'max_templates', (select max_templates from public.plans p join public.teams t on t.plan_id = p.id where t.id = p_team),
    'storage_mb', (select storage_mb from public.plans p join public.teams t on t.plan_id = p.id where t.id = p_team),
    'plan_id', (select plan_id from public.teams where id = p_team),
    'plan_source', (select plan_source from public.teams where id = p_team)
  ) end;
$$;

revoke all on function public.team_quota_usage(uuid) from public;
grant execute on function public.team_quota_usage(uuid) to authenticated, service_role;

create or replace function public.check_restore_website(p_project uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_project record;
  v_quota jsonb;
  v_pages int;
  v_blockers jsonb := '[]'::jsonb;
  v_adaptations jsonb := '[]'::jsonb;
begin
  select * into v_project from public.projects where id = p_project;
  if v_project.id is null or v_project.deleted_at is null then
    return jsonb_build_object('ok', false, 'blockers', jsonb_build_array(jsonb_build_object('code','RESTORE_BLOCKED')), 'adaptations', '[]'::jsonb);
  end if;

  if auth.role() <> 'service_role' and not public.team_can(v_project.team_id, 'site.restore') then
    raise exception 'NOT_ALLOWED';
  end if;

  v_quota := public.team_quota_usage(v_project.team_id);

  if v_project.purge_after is not null and v_project.purge_after < now() then
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object('code','RESTORE_EXPIRED'));
  end if;

  if (v_quota->>'max_websites') is not null
     and (v_quota->>'active_sites')::int >= (v_quota->>'max_websites')::int then
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code','RESTORE_QUOTA',
      'limit',(v_quota->>'max_websites')::int,
      'used',(v_quota->>'active_sites')::int
    ));
  end if;

  select count(*) into v_pages from public.pages where project_id = p_project;
  if (v_quota->>'max_pages_per_site') is not null
     and v_pages > (v_quota->>'max_pages_per_site')::int then
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code','RESTORE_PAGES',
      'pages',v_pages,
      'limit',(v_quota->>'max_pages_per_site')::int
    ));
  end if;

  return jsonb_build_object(
    'ok', jsonb_array_length(v_blockers) = 0,
    'blockers', v_blockers,
    'adaptations', v_adaptations
  );
end;
$$;

revoke all on function public.check_restore_website(uuid) from public;
grant execute on function public.check_restore_website(uuid) to authenticated, service_role;

create or replace function public.log_team_activity(
  p_team uuid,
  p_actor_user_id uuid,
  p_actor_name text,
  p_actor_role text,
  p_actor_kind text,
  p_category text,
  p_event text,
  p_summary text,
  p_project_id uuid default null,
  p_project_name text default null,
  p_target_type text default null,
  p_target_id uuid default null,
  p_target_name text default null,
  p_coalesce_key text default null,
  p_meta jsonb default '{}'::jsonb,
  p_client text default null,
  p_window_seconds int default 0
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_coalesce_key is not null and p_window_seconds > 0 then
    update public.team_activity
    set count = count + 1,
        last_at = now(),
        occurred_at = now(),
        meta = coalesce(p_meta, '{}'::jsonb) || meta
    where team_id = p_team
      and coalesce_key = p_coalesce_key
      and event = p_event
      and last_at > now() - make_interval(secs => p_window_seconds)
    returning id into v_id;
    if v_id is not null then
      return v_id;
    end if;
  end if;

  insert into public.team_activity (
    team_id, actor_user_id, actor_name, actor_role, actor_kind,
    category, event, summary, project_id, project_name,
    target_type, target_id, target_name, coalesce_key, meta, client
  ) values (
    p_team, p_actor_user_id, p_actor_name, p_actor_role, p_actor_kind,
    p_category, p_event, left(p_summary, 240), p_project_id, p_project_name,
    p_target_type, p_target_id, p_target_name, p_coalesce_key, coalesce(p_meta, '{}'::jsonb), p_client
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.log_team_activity(uuid, uuid, text, text, text, text, text, text, uuid, text, text, uuid, text, text, jsonb, text, int) from public;
grant execute on function public.log_team_activity(uuid, uuid, text, text, text, text, text, text, uuid, text, text, uuid, text, text, jsonb, text, int) to service_role;

create or replace function public.team_activity_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if coalesce(current_setting('app.activity_trim', true), '') <> 'on' then
      raise exception 'ACTIVITY_READ_ONLY';
    end if;
    return old;
  end if;

  if coalesce(current_setting('app.activity_trim', true), '') = 'on'
     or coalesce(current_setting('app.activity_anonymise', true), '') = 'on' then
    return new;
  end if;

  if new.id <> old.id
     or new.team_id <> old.team_id
     or new.actor_user_id is distinct from old.actor_user_id
     or new.actor_name <> old.actor_name
     or new.category <> old.category
     or new.event <> old.event
     or new.summary <> old.summary
     or new.project_id is distinct from old.project_id
     or new.target_id is distinct from old.target_id then
    raise exception 'ACTIVITY_READ_ONLY';
  end if;

  return new;
end;
$$;

drop trigger if exists team_activity_guard on public.team_activity;
create trigger team_activity_guard
  before update or delete on public.team_activity
  for each row execute function public.team_activity_guard();

-- One log for the team. The old per-project table becomes a read-only view.
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'project_activity') then
    insert into public.team_activity (
      team_id, occurred_at, first_at, last_at, actor_user_id, actor_name, actor_role,
      actor_kind, category, event, summary, project_id, project_name, meta
    )
    select p.team_id, pa.created_at, pa.created_at, pa.created_at, pa.actor_user_id,
      coalesce(pr.full_name, pr.email, 'Former member'), null, 'user',
      case
        when pa.event like 'domain%' then 'domain'
        when pa.event like 'plugin%' then 'plugin'
        when pa.event like 'ai%' then 'ai'
        when pa.event like 'backup%' or pa.event like 'import%' or pa.event like 'export%' then 'backup'
        when pa.event like 'publish%' then 'website'
        when pa.event like 'settings%' or pa.event like 'redirect%' then 'settings'
        when pa.event like 'template%' then 'template'
        when pa.event like 'page%' then 'page'
        else 'website'
      end,
      pa.event, pa.summary, p.id, p.name, pa.meta
    from public.project_activity pa
    join public.projects p on p.id = pa.project_id
    left join public.profiles pr on pr.id = pa.actor_user_id;

    alter table public.project_activity rename to project_activity_legacy;
  end if;
end $$;

create or replace view public.project_activity as
  select id, project_id, actor_user_id, event, summary, meta, occurred_at as created_at
  from public.team_activity
  where project_id is not null;

-- RLS: team activity is readable by owners/admins, and per website by editors.
alter table public.team_activity enable row level security;
drop policy if exists "owners and admins read team activity" on public.team_activity;
create policy "owners and admins read team activity"
  on public.team_activity for select
  using (public.team_can(team_id, 'team.activity'));

drop policy if exists "editors read project activity" on public.team_activity;
create policy "editors read project activity"
  on public.team_activity for select
  using (
    project_id is not null
    and public.team_can(team_id, 'site.activity')
    and public.user_can_access_project(project_id, array['owner','admin','editor']::text[])
  );

alter table public.team_invitations enable row level security;
drop policy if exists "owners and admins read invitations" on public.team_invitations;
create policy "owners and admins read invitations"
  on public.team_invitations for select
  using (public.team_can(team_id, 'team.invite.member'));

alter table public.referrals enable row level security;
drop policy if exists "users read own referrals" on public.referrals;
create policy "users read own referrals"
  on public.referrals for select
  using (auth.uid() = referrer_user_id or auth.uid() = referee_user_id);

alter table public.referral_rewards enable row level security;
drop policy if exists "users read own rewards" on public.referral_rewards;
create policy "users read own rewards"
  on public.referral_rewards for select
  using (auth.uid() = user_id);

alter table public.referral_ladder enable row level security;
drop policy if exists "active ladder readable" on public.referral_ladder;
create policy "active ladder readable"
  on public.referral_ladder for select
  using (active = true);

-- Referral settings and disposable domains are server-only (no policies).

-- Coalescing is enforced inside log_team_activity, so the key is not unique.
drop index if exists public.team_activity_coalesce_idx;
create index if not exists team_activity_coalesce_lookup_idx
  on public.team_activity (team_id, coalesce_key, last_at desc)
  where coalesce_key is not null;
