-- Plugins, the Contact plugin, and the email layer.

-- ---------------------------------------------------------------------------
-- Plugin catalog and installs
-- ---------------------------------------------------------------------------

create table if not exists public.plugin_catalog (
  id text primary key,
  status text not null check (status in ('available','planned')),
  free_ok boolean not null default false,
  sort int not null default 0
);

insert into public.plugin_catalog (id, status, free_ok, sort) values
  ('contact', 'available', true, 1),
  ('subscribers', 'planned', false, 2),
  ('blog', 'planned', false, 3),
  ('languages', 'planned', false, 4),
  ('dark-mode', 'planned', false, 5),
  ('byok-ai', 'planned', false, 6)
on conflict (id) do update set status = excluded.status, free_ok = excluded.free_ok, sort = excluded.sort;

alter table public.plugin_catalog enable row level security;
drop policy if exists "plugin_catalog readable" on public.plugin_catalog;
create policy "plugin_catalog readable"
  on public.plugin_catalog for select
  using (true);

create table if not exists public.plugin_installs (
  project_id uuid not null references public.projects(id) on delete cascade,
  plugin_id text not null references public.plugin_catalog(id),
  state text not null check (state in ('active','disabled','locked')),
  config jsonb not null default '{}'::jsonb,
  enabled_at timestamptz,
  disabled_at timestamptz,
  enabled_by uuid,
  primary key (project_id, plugin_id)
);

create index if not exists plugin_installs_project_idx
  on public.plugin_installs (project_id);

alter table public.plugin_installs enable row level security;
drop policy if exists "plugin_installs_read_team_members" on public.plugin_installs;
create policy "plugin_installs_read_team_members"
  on public.plugin_installs for select
  using (public.user_can_access_project(project_id));

-- Writes only through the RPCs below.

create or replace function public.project_team_id(p_project_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select team_id from public.projects where id = p_project_id;
$$;

create or replace function public.enable_plugin(p_project_id uuid, p_plugin_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id uuid;
  v_catalog record;
  v_plan text;
  v_max_plugins int;
  v_active_count int;
  v_existing record;
begin
  select team_id into v_team_id from public.projects where id = p_project_id;
  if v_team_id is null then
    raise exception 'NOT_ALLOWED';
  end if;

  if not public.user_has_team_role(v_team_id, array['owner','admin']) then
    raise exception 'NOT_ALLOWED';
  end if;

  select * into v_catalog from public.plugin_catalog where id = p_plugin_id;
  if not found or v_catalog.status <> 'available' then
    raise exception 'PLUGIN_NOT_AVAILABLE';
  end if;

  select plan_id into v_plan from public.teams where id = v_team_id;
  v_plan := coalesce(v_plan, 'free');

  if v_plan = 'free' and not v_catalog.free_ok then
    raise exception 'PLUGIN_NOT_ON_PLAN';
  end if;

  select * into v_existing
  from public.plugin_installs
  where project_id = p_project_id and plugin_id = p_plugin_id;

  if found and v_existing.state = 'active' then
    raise exception 'PLUGIN_ALREADY_ENABLED';
  end if;

  select max_plugins into v_max_plugins from public.plans where id = v_plan;
  if v_max_plugins is not null then
    select count(*) into v_active_count
    from public.plugin_installs
    where project_id = p_project_id
      and state = 'active'
      and plugin_id <> p_plugin_id;
    if v_active_count >= v_max_plugins then
      raise exception 'PLUGIN_LIMIT_REACHED';
    end if;
  end if;

  insert into public.plugin_installs
    (project_id, plugin_id, state, enabled_at, disabled_at, enabled_by)
  values
    (p_project_id, p_plugin_id, 'active', now(), null, auth.uid())
  on conflict (project_id, plugin_id) do update
    set state = 'active',
        enabled_at = now(),
        disabled_at = null,
        enabled_by = auth.uid();

  return jsonb_build_object('ok', true, 'state', 'active');
end;
$$;

create or replace function public.disable_plugin(p_project_id uuid, p_plugin_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id uuid;
begin
  select team_id into v_team_id from public.projects where id = p_project_id;
  if v_team_id is null then
    raise exception 'NOT_ALLOWED';
  end if;
  if not public.user_has_team_role(v_team_id, array['owner','admin']) then
    raise exception 'NOT_ALLOWED';
  end if;

  update public.plugin_installs
  set state = 'disabled', disabled_at = now()
  where project_id = p_project_id and plugin_id = p_plugin_id;

  return jsonb_build_object('ok', true, 'state', 'disabled');
end;
$$;

create or replace function public.lock_excess_plugins(p_project_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id uuid;
  v_plan text;
  v_max_plugins int;
  v_row record;
  v_count int := 0;
begin
  select team_id into v_team_id from public.projects where id = p_project_id;
  if v_team_id is null then
    return jsonb_build_object('ok', true);
  end if;

  select plan_id into v_plan from public.teams where id = v_team_id;
  v_plan := coalesce(v_plan, 'free');
  select max_plugins into v_max_plugins from public.plans where id = v_plan;
  if v_max_plugins is null then
    return jsonb_build_object('ok', true);
  end if;

  for v_row in
    select plugin_id from public.plugin_installs
    where project_id = p_project_id and state = 'active'
    order by enabled_at asc nulls last, plugin_id asc
  loop
    v_count := v_count + 1;
    if v_count > v_max_plugins then
      update public.plugin_installs
      set state = 'locked'
      where project_id = p_project_id and plugin_id = v_row.plugin_id;
    end if;
  end loop;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.project_team_id(uuid) from public;
revoke all on function public.enable_plugin(uuid,text) from public;
revoke all on function public.disable_plugin(uuid,text) from public;
revoke all on function public.lock_excess_plugins(uuid) from public;
grant execute on function public.enable_plugin(uuid,text) to authenticated;
grant execute on function public.disable_plugin(uuid,text) to authenticated;
grant execute on function public.lock_excess_plugins(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Contact messages and recipients
-- ---------------------------------------------------------------------------

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  form_id text not null,
  page_path text,
  name text not null default '',
  email text not null,
  phone text,
  message text not null,
  status text not null default 'new' check (status in ('new','read','archived','spam')),
  replied boolean not null default false,
  spam_score int not null default 0,
  spam_reasons text[] not null default '{}'::text[],
  ip_hash text not null,
  user_agent text,
  notified_at timestamptz,
  notify_state text not null default 'none' check (notify_state in ('none','sent','digest','failed','suppressed')),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists contact_messages_project_status_created_idx
  on public.contact_messages (project_id, status, created_at desc);
create index if not exists contact_messages_project_created_idx
  on public.contact_messages (project_id, created_at desc);
create index if not exists contact_messages_ip_hash_created_idx
  on public.contact_messages (ip_hash, created_at desc);

alter table public.contact_messages enable row level security;

drop policy if exists "contact_messages_read_team" on public.contact_messages;
create policy "contact_messages_read_team"
  on public.contact_messages for select
  using (public.user_can_access_project(project_id, array['owner','admin','editor']));

drop policy if exists "contact_messages_update_team" on public.contact_messages;
create policy "contact_messages_update_team"
  on public.contact_messages for update
  using (public.user_can_access_project(project_id, array['owner','admin','editor']))
  with check (public.user_can_access_project(project_id, array['owner','admin','editor']));

drop policy if exists "contact_messages_delete_owners_admins" on public.contact_messages;
create policy "contact_messages_delete_owners_admins"
  on public.contact_messages for delete
  using (public.user_can_access_project(project_id, array['owner','admin']));

-- Only the server role inserts contact messages.

create table if not exists public.contact_recipients (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  email text not null,
  token_hash text,
  token_expires_at timestamptz,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (project_id, email)
);

alter table public.contact_recipients enable row level security;

drop policy if exists "contact_recipients_owners_admins" on public.contact_recipients;
create policy "contact_recipients_owners_admins"
  on public.contact_recipients for all
  using (public.user_can_access_project(project_id, array['owner','admin']))
  with check (public.user_can_access_project(project_id, array['owner','admin']));

create or replace function public.limit_contact_recipients()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.contact_recipients where project_id = new.project_id) >= 3 then
    raise exception 'TOO_MANY_RECIPIENTS';
  end if;
  return new;
end;
$$;

drop trigger if exists limit_contact_recipients_trigger on public.contact_recipients;
create trigger limit_contact_recipients_trigger
  before insert on public.contact_recipients
  for each row execute function public.limit_contact_recipients();

revoke all on function public.limit_contact_recipients() from public;

-- ---------------------------------------------------------------------------
-- Email log, suppressions and events
-- ---------------------------------------------------------------------------

create table if not exists public.email_log (
  id uuid primary key default gen_random_uuid(),
  kind text,
  to_email text,
  subject text,
  status text not null default 'queued' check (status in ('queued','sent','failed','suppressed')),
  attempts int not null default 0,
  next_attempt_at timestamptz,
  ses_message_id text,
  error text,
  payload jsonb not null default '{}'::jsonb,
  related_type text,
  related_id uuid,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists email_log_status_next_attempt_idx
  on public.email_log (status, next_attempt_at);
create index if not exists email_log_created_idx
  on public.email_log (created_at desc);

alter table public.email_log enable row level security;

create table if not exists public.email_suppressions (
  email text primary key,
  reason text not null check (reason in ('bounce','complaint','manual')),
  detail text,
  created_at timestamptz not null default now()
);

alter table public.email_suppressions enable row level security;

create table if not exists public.email_events (
  id uuid primary key default gen_random_uuid(),
  ses_message_id text not null,
  type text not null check (type in ('delivery','bounce','complaint','reject','other')),
  email text,
  detail jsonb,
  created_at timestamptz not null default now(),
  unique (ses_message_id, type)
);

create index if not exists email_events_ses_message_id_idx
  on public.email_events (ses_message_id);

alter table public.email_events enable row level security;

-- These tables are only used by the server role, which bypasses RLS.

-- ---------------------------------------------------------------------------
-- Updates to existing tables
-- ---------------------------------------------------------------------------

alter table public.publishes add column if not exists forms jsonb not null default '[]'::jsonb;
alter table public.publishes add column if not exists plugins jsonb not null default '[]'::jsonb;
alter table public.project_settings add column if not exists contact_settings jsonb not null default '{}'::jsonb;
alter table public.projects add column if not exists form_limit_hit_at timestamptz;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.unread_message_count(p_project_id uuid)
returns bigint
language sql
stable
security invoker
set search_path = public
as $$
  select count(*) from public.contact_messages
  where project_id = p_project_id and status = 'new';
$$;

create or replace function public.contact_daily_count(p_project_id uuid)
returns bigint
language sql
stable
security invoker
set search_path = public
as $$
  select count(*) from public.contact_messages
  where project_id = p_project_id
    and status <> 'spam'
    and created_at >= now() - interval '24 hours';
$$;

revoke all on function public.unread_message_count(uuid) from public;
revoke all on function public.contact_daily_count(uuid) from public;
grant execute on function public.unread_message_count(uuid) to authenticated;
grant execute on function public.contact_daily_count(uuid) to authenticated;
