-- Custom domains: TXT ownership proof plus CNAME connection.
-- Customers keep their DNS. No zone, nameserver or record hosting.

-- Plans ---------------------------------------------------------------------

alter table public.plans
  add column if not exists custom_domains_per_site int not null default 0;

update public.plans set
  custom_domains_per_site = case id
    when 'free' then 0
    when 'basic' then 1
    when 'pro' then 3
    when 'enterprise' then 10
    else 0
  end
where id in ('free', 'basic', 'pro', 'enterprise');

update public.plans
set custom_domain_allowed = (custom_domains_per_site > 0)
where id in ('free', 'basic', 'pro', 'enterprise');

-- Projects and settings -----------------------------------------------------

alter table public.projects
  add column if not exists primary_host text,
  add column if not exists redirect_free_address boolean not null default true;

alter table public.project_settings
  add column if not exists auto_publish_on_domain boolean not null default true;

-- Operations ----------------------------------------------------------------

alter table public.project_operations
  drop constraint if exists project_operations_kind_check;

alter table public.project_operations
  add constraint project_operations_kind_check
  check (kind in ('publish','apply','import','restore','export','backup','transfer','delete','domain'));

-- Tables --------------------------------------------------------------------

create table if not exists public.blocked_domains (
  hostname_pattern text primary key,
  reason text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.domains (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  registrable text not null,
  display_name text not null,
  role text not null default 'primary' check (role in ('primary','alias')),
  status text not null default 'draft' check (status in (
    'draft','awaiting_txt','verified','connecting','live','attention','stalled',
    'plan_lapsed','unassigned','removing','removed','failed'
  )),
  status_reason text,
  plan_previous_status text,
  verification_value text not null,
  verification_started_at timestamptz not null default now(),
  verification_expires_at timestamptz not null,
  verified_at timestamptz,
  reverify_after timestamptz,
  review_state text not null default 'none' check (review_state in ('none','pending','approved','rejected')),
  registrar jsonb not null default '{}'::jsonb,
  dns_provider_hint text,
  last_checked_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  removed_at timestamptz,
  constraint domains_registrable_lower check (registrable = lower(registrable)),
  constraint domains_verification_value_format check (verification_value ~ '^geton-verify=[0-9a-f]{32}$')
);

create unique index if not exists domains_team_registrable_unique
  on public.domains (team_id, registrable)
  where status not in ('removed','failed');

create index if not exists domains_project_idx on public.domains (project_id, created_at desc);
create index if not exists domains_team_status_idx on public.domains (team_id, status);

create table if not exists public.domain_hostnames (
  id uuid primary key default gen_random_uuid(),
  domain_id uuid not null references public.domains(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  hostname text not null,
  label text not null,
  role text not null check (role in ('main','extra')),
  mode text not null default 'switch_now' check (mode in ('switch_now','prepare_first')),
  status text not null default 'pending' check (status in (
    'pending','preparing','ready_to_switch','active','live','moved','blocked','error','removing','removed'
  )),
  status_reason text,
  provider_id text,
  provider_status text,
  ssl_status text,
  verification_errors jsonb not null default '[]'::jsonb,
  ownership_txt jsonb,
  validation_txt jsonb,
  cname_target text not null default '',
  cname_seen boolean not null default false,
  cname_checked_at timestamptz,
  waiting_since timestamptz not null default now(),
  next_poll_at timestamptz,
  poll_attempts int not null default 0,
  live_at timestamptz,
  attention_since timestamptz,
  health_failures int not null default 0,
  last_health_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  removed_at timestamptz,
  constraint domain_hostnames_lower check (hostname = lower(hostname)),
  constraint domain_hostnames_label check (char_length(label) between 1 and 63)
);

create unique index if not exists domain_hostnames_hostname_unique
  on public.domain_hostnames (hostname)
  where status <> 'removed';

create index if not exists domain_hostnames_domain_idx
  on public.domain_hostnames (domain_id, created_at);

create index if not exists domain_hostnames_due_idx
  on public.domain_hostnames (next_poll_at)
  where status not in ('live','removed','blocked');

create index if not exists domain_hostnames_project_idx
  on public.domain_hostnames (project_id, status);

create table if not exists public.domain_events (
  id uuid primary key default gen_random_uuid(),
  domain_id uuid not null references public.domains(id) on delete cascade,
  hostname_id uuid references public.domain_hostnames(id) on delete set null,
  event text not null,
  summary text not null,
  meta jsonb not null default '{}'::jsonb,
  actor_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint domain_events_summary_length check (char_length(summary) <= 200)
);

create index if not exists domain_events_domain_idx
  on public.domain_events (domain_id, created_at desc);

create table if not exists public.released_hostnames (
  provider_id text primary key,
  hostname text not null,
  delete_after timestamptz not null,
  reason text not null default '',
  created_at timestamptz not null default now()
);

-- Helper functions ----------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists domains_touch_updated_at on public.domains;
create trigger domains_touch_updated_at
  before update on public.domains
  for each row execute function public.touch_updated_at();

drop trigger if exists domain_hostnames_touch_updated_at on public.domain_hostnames;
create trigger domain_hostnames_touch_updated_at
  before update on public.domain_hostnames
  for each row execute function public.touch_updated_at();

create or replace function public.domain_is_blocked(target text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.blocked_domains b
    where b.hostname_pattern = lower(target)
      or (b.hostname_pattern like '*.%' and lower(target) like '%' || substr(b.hostname_pattern, 2))
      or lower(target) = 'get-on.tech'
      or lower(target) like '%.get-on.tech'
  );
$$;

revoke all on function public.domain_is_blocked(text) from public;
grant execute on function public.domain_is_blocked(text) to authenticated, service_role;

create or replace function public.domain_plan_limit(target_team_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(p.custom_domains_per_site, 0)
  from public.teams t
  join public.plans p on p.id = t.plan_id
  where t.id = target_team_id;
$$;

revoke all on function public.domain_plan_limit(uuid) from public;
grant execute on function public.domain_plan_limit(uuid) to authenticated, service_role;

create or replace function public.domain_can_manage(target_domain_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.domains d
    join public.team_members tm on tm.team_id = d.team_id
    where d.id = target_domain_id
      and tm.user_id = auth.uid()
      and tm.role in ('owner','admin')
  );
$$;

revoke all on function public.domain_can_manage(uuid) from public;
grant execute on function public.domain_can_manage(uuid) to authenticated, service_role;

-- Triggers ------------------------------------------------------------------

create or replace function public.domains_check_limits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit int;
  v_count int;
begin
  if public.domain_is_blocked(new.registrable) then
    raise exception 'DOMAIN_BLOCKED';
  end if;

  if tg_op = 'UPDATE'
     and (old.status = 'plan_lapsed' or new.status = 'plan_lapsed') then
    return new;
  end if;

  if new.project_id is not null
     and new.status not in ('draft','removed','failed','plan_lapsed') then
    if tg_op = 'INSERT' or old.status is distinct from new.status then
      v_limit := public.domain_plan_limit(new.team_id);
      select count(*) into v_count
      from public.domains d
      where d.project_id = new.project_id
        and d.id <> new.id
        and d.status not in ('draft','removed','failed','plan_lapsed');
      if v_count >= v_limit then
        raise exception 'DOMAIN_LIMIT_REACHED';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists domains_check_limits on public.domains;
create trigger domains_check_limits
  before insert or update on public.domains
  for each row execute function public.domains_check_limits();

create or replace function public.domain_hostnames_check_limits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
  v_main public.domain_hostnames%rowtype;
begin
  if new.status = 'removed' then
    return new;
  end if;

  select count(*) into v_count
  from public.domain_hostnames h
  where h.domain_id = new.domain_id
    and h.id <> new.id
    and h.status <> 'removed';
  if v_count >= 2 then
    raise exception 'HOSTNAME_LIMIT';
  end if;

  if new.role = 'main' then
    select * into v_main
    from public.domain_hostnames h
    where h.domain_id = new.domain_id
      and h.id <> new.id
      and h.status <> 'removed'
      and h.role = 'main'
    limit 1;
    if found then
      raise exception 'HOSTNAME_LIMIT';
    end if;
  elsif tg_op = 'INSERT' then
    select * into v_main
    from public.domain_hostnames h
    where h.domain_id = new.domain_id
      and h.id <> new.id
      and h.status <> 'removed'
      and h.role = 'main'
    limit 1;
    if not found then
      raise exception 'HOSTNAME_LIMIT';
    end if;
    if v_main.label not in ('www','@') or new.label not in ('www','@') or new.label = v_main.label then
      raise exception 'HOSTNAME_LIMIT';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists domain_hostnames_check_limits on public.domain_hostnames;
create trigger domain_hostnames_check_limits
  before insert or update on public.domain_hostnames
  for each row execute function public.domain_hostnames_check_limits();

create or replace function public.domain_events_trim()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.domain_events
  where id in (
    select id from public.domain_events
    where domain_id = new.domain_id
    order by created_at desc
    offset 1000
  );
  return new;
end;
$$;

drop trigger if exists domain_events_trim on public.domain_events;
create trigger domain_events_trim
  after insert on public.domain_events
  for each row execute function public.domain_events_trim();

-- RLS -----------------------------------------------------------------------

alter table public.domains enable row level security;
alter table public.domain_hostnames enable row level security;
alter table public.domain_events enable row level security;
alter table public.blocked_domains enable row level security;
alter table public.released_hostnames enable row level security;

drop policy if exists "team members read domains" on public.domains;
create policy "team members read domains"
  on public.domains for select
  using (public.user_is_team_member(team_id));

drop policy if exists "owners and admins manage domains" on public.domains;
create policy "owners and admins manage domains"
  on public.domains for all
  using (public.user_has_team_role(team_id, array['owner','admin']))
  with check (public.user_has_team_role(team_id, array['owner','admin']));

drop policy if exists "team members read domain hostnames" on public.domain_hostnames;
create policy "team members read domain hostnames"
  on public.domain_hostnames for select
  using (
    exists (
      select 1 from public.domains d
      where d.id = domain_hostnames.domain_id
        and public.user_is_team_member(d.team_id)
    )
  );

drop policy if exists "owners and admins manage domain hostnames" on public.domain_hostnames;
create policy "owners and admins manage domain hostnames"
  on public.domain_hostnames for all
  using (
    exists (
      select 1 from public.domains d
      where d.id = domain_hostnames.domain_id
        and public.user_has_team_role(d.team_id, array['owner','admin'])
    )
  )
  with check (
    exists (
      select 1 from public.domains d
      where d.id = domain_hostnames.domain_id
        and public.user_has_team_role(d.team_id, array['owner','admin'])
    )
  );

drop policy if exists "team members read domain events" on public.domain_events;
create policy "team members read domain events"
  on public.domain_events for select
  using (
    exists (
      select 1 from public.domains d
      where d.id = domain_events.domain_id
        and public.user_is_team_member(d.team_id)
    )
  );

drop policy if exists "owners and admins write domain events" on public.domain_events;
create policy "owners and admins write domain events"
  on public.domain_events for insert
  with check (
    exists (
      select 1 from public.domains d
      where d.id = domain_events.domain_id
        and public.user_has_team_role(d.team_id, array['owner','admin'])
    )
  );

drop policy if exists "editors write activity" on public.project_activity;
create policy "editors write activity"
  on public.project_activity for insert
  with check (
    public.user_can_access_project(
      project_activity.project_id,
      array['owner','admin','editor']
    )
  );

-- Start, verify, addresses --------------------------------------------------

create or replace function public.start_domain(
  p_project_id uuid,
  p_registrable text,
  p_display text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_team_id uuid;
  v_limit int;
  v_count int;
  v_today int;
  v_id uuid;
  v_existing_project uuid;
  v_value text;
  v_reg text := lower(trim(p_registrable));
begin
  select team_id into v_team_id
  from public.projects
  where id = p_project_id and deleted_at is null;

  if v_team_id is null then
    raise exception 'DOMAIN_INVALID';
  end if;

  if not public.user_has_team_role(v_team_id, array['owner','admin']) then
    raise exception 'DOMAIN_INVALID';
  end if;

  if exists (
    select 1 from public.project_operations
    where project_id = p_project_id and heavy and status in ('queued','running')
  ) then
    raise exception 'PROJECT_BUSY';
  end if;

  if v_reg !~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$'
     or char_length(v_reg) > 253 then
    raise exception 'DOMAIN_INVALID';
  end if;

  if public.domain_is_blocked(v_reg) then
    raise exception 'DOMAIN_BLOCKED';
  end if;

  v_limit := public.domain_plan_limit(v_team_id);
  if v_limit <= 0 then
    raise exception 'DOMAIN_PLAN';
  end if;

  select id, project_id into v_id, v_existing_project
  from public.domains
  where team_id = v_team_id
    and registrable = v_reg
    and status not in ('removed','failed')
  limit 1;
  if v_id is not null then
    if v_existing_project is not null and v_existing_project <> p_project_id then
      raise exception 'DOMAIN_ALREADY_CONNECTED';
    end if;
    if v_existing_project is null then
      update public.domains
      set project_id = p_project_id,
          status = case when status = 'unassigned' then 'verified' else status end,
          status_reason = null
      where id = v_id;
    end if;
    return v_id;
  end if;

  select count(*) into v_count
  from public.domains
  where project_id = p_project_id
    and status not in ('draft','removed','failed','plan_lapsed');
  if v_count >= v_limit then
    raise exception 'DOMAIN_LIMIT_REACHED';
  end if;

  select count(*) into v_today
  from public.domains
  where team_id = v_team_id
    and created_at > now() - interval '1 day';
  if v_today >= 5 then
    raise exception 'DOMAIN_STARTS_TODAY';
  end if;

  v_value := 'geton-verify=' || encode(gen_random_bytes(16), 'hex');

  insert into public.domains (
    team_id, project_id, registrable, display_name, verification_value,
    verification_started_at, verification_expires_at, created_by
  ) values (
    v_team_id, p_project_id, v_reg, coalesce(nullif(trim(p_display), ''), v_reg), v_value,
    now(), now() + interval '14 days', auth.uid()
  ) returning id into v_id;

  insert into public.domain_events (domain_id, event, summary, actor_user_id)
  values (v_id, 'started', 'Domain setup started', auth.uid());

  return v_id;
end;
$$;

create or replace function public.mark_domain_verified(p_domain_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_domain public.domains%rowtype;
begin
  select * into v_domain from public.domains where id = p_domain_id for update;
  if not found or not public.domain_can_manage(p_domain_id) then
    raise exception 'DOMAIN_INVALID';
  end if;

  update public.domains
  set status = 'verified',
      verified_at = coalesce(verified_at, now()),
      reverify_after = coalesce(verified_at, now()) + interval '90 days',
      verification_expires_at = now() + interval '14 days',
      status_reason = null
  where id = p_domain_id;

  insert into public.domain_events (domain_id, event, summary, actor_user_id)
  values (p_domain_id, 'txt_verified', 'Ownership record found', auth.uid());
end;
$$;

create or replace function public.add_hostname(
  p_domain_id uuid,
  p_label text,
  p_role text,
  p_mode text,
  p_max_pending integer default 200
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_domain public.domains%rowtype;
  v_label text := lower(trim(p_label));
  v_hostname text;
  v_id uuid;
  v_main public.domain_hostnames%rowtype;
begin
  select * into v_domain from public.domains where id = p_domain_id for update;
  if not found or not public.domain_can_manage(p_domain_id) then
    raise exception 'DOMAIN_INVALID';
  end if;

  if v_domain.status not in ('verified','connecting','live','attention','stalled') then
    raise exception 'DOMAIN_NOT_VERIFIED';
  end if;
  if v_domain.reverify_after is not null and v_domain.reverify_after < now() then
    raise exception 'DOMAIN_VERIFICATION_EXPIRED';
  end if;
  if v_domain.review_state = 'pending' then
    raise exception 'DOMAIN_BLOCKED';
  end if;
  if p_role not in ('main','extra') or p_mode not in ('switch_now','prepare_first') then
    raise exception 'HOSTNAME_LIMIT';
  end if;

  if (
    select count(*) from public.domain_hostnames
    where status not in ('live','removed')
  ) >= greatest(coalesce(p_max_pending, 200), 1) then
    raise exception 'HOSTNAME_LIMIT';
  end if;

  if v_label = '@' then
    v_hostname := v_domain.registrable;
  else
    if v_label !~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$' then
      raise exception 'HOSTNAME_LIMIT';
    end if;
    if v_label in ('_geton-verify','autodiscover','mail','smtp','imap','pop','webmail','ftp') then
      raise exception 'HOSTNAME_LIMIT';
    end if;
    v_hostname := v_label || '.' || v_domain.registrable;
  end if;

  if exists (
    select 1 from public.domain_hostnames
    where hostname = v_hostname and status <> 'removed'
  ) then
    raise exception 'HOSTNAME_TAKEN';
  end if;

  if p_role = 'main' then
    if exists (
      select 1 from public.domain_hostnames
      where domain_id = p_domain_id and role = 'main' and status <> 'removed'
    ) then
      raise exception 'HOSTNAME_LIMIT';
    end if;
  else
    select * into v_main
    from public.domain_hostnames
    where domain_id = p_domain_id and role = 'main' and status <> 'removed'
    limit 1;
    if not found then
      raise exception 'HOSTNAME_LIMIT';
    end if;
    if v_main.label not in ('www','@') or v_label not in ('www','@') or v_main.label = v_label then
      raise exception 'HOSTNAME_LIMIT';
    end if;
  end if;

  insert into public.domain_hostnames (
    domain_id, project_id, hostname, label, role, mode, status
  ) values (
    p_domain_id, v_domain.project_id, v_hostname, v_label, p_role, p_mode, 'pending'
  ) returning id into v_id;

  update public.domains
  set status = case when status = 'verified' then 'connecting' else status end
  where id = p_domain_id;

  insert into public.domain_events (domain_id, hostname_id, event, summary, actor_user_id)
  values (p_domain_id, v_id, 'hostname_created', 'Address added', auth.uid());

  return v_id;
end;
$$;

create or replace function public.set_main_hostname(p_hostname_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_host public.domain_hostnames%rowtype;
  v_domain public.domains%rowtype;
begin
  select * into v_host from public.domain_hostnames where id = p_hostname_id for update;
  if not found or not public.domain_can_manage(v_host.domain_id) then
    raise exception 'DOMAIN_INVALID';
  end if;
  select * into v_domain from public.domains where id = v_host.domain_id;
  if v_host.status <> 'live' then
    raise exception 'DOMAIN_NOT_VERIFIED';
  end if;

  update public.domain_hostnames
  set role = 'extra'
  where domain_id = v_host.domain_id and role = 'main' and id <> p_hostname_id;

  update public.domain_hostnames
  set role = 'main'
  where id = p_hostname_id;

  update public.projects
  set primary_host = v_host.hostname
  where id = v_domain.project_id;

  insert into public.domain_events (domain_id, hostname_id, event, summary, actor_user_id)
  values (v_host.domain_id, p_hostname_id, 'main_changed', 'Main address changed', auth.uid());
end;
$$;

create or replace function public.detach_domain(p_domain_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_domain public.domains%rowtype;
begin
  select * into v_domain from public.domains where id = p_domain_id for update;
  if not found or not public.domain_can_manage(p_domain_id) then
    raise exception 'DOMAIN_INVALID';
  end if;

  update public.projects
  set primary_host = null
  where id = v_domain.project_id
    and primary_host in (select hostname from public.domain_hostnames where domain_id = p_domain_id);

  update public.domain_hostnames set project_id = null where domain_id = p_domain_id;
  update public.domains
  set project_id = null, status = 'unassigned', status_reason = null
  where id = p_domain_id;

  insert into public.domain_events (domain_id, event, summary, actor_user_id)
  values (p_domain_id, 'detached', 'Disconnected from website', auth.uid());
end;
$$;

create or replace function public.reassign_domain(p_domain_id uuid, p_project_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_domain public.domains%rowtype;
  v_team_id uuid;
  v_limit int;
  v_count int;
begin
  select * into v_domain from public.domains where id = p_domain_id for update;
  if not found or not public.domain_can_manage(p_domain_id) then
    raise exception 'DOMAIN_INVALID';
  end if;
  select team_id into v_team_id from public.projects where id = p_project_id and deleted_at is null;
  if v_team_id is null or v_team_id <> v_domain.team_id then
    raise exception 'DOMAIN_INVALID';
  end if;
  v_limit := public.domain_plan_limit(v_team_id);
  select count(*) into v_count
  from public.domains
  where project_id = p_project_id
    and id <> p_domain_id
    and status not in ('draft','removed','failed','plan_lapsed');
  if v_count >= v_limit then
    raise exception 'DOMAIN_LIMIT_REACHED';
  end if;

  update public.projects
  set primary_host = null
  where id = v_domain.project_id
    and primary_host in (select hostname from public.domain_hostnames where domain_id = p_domain_id);

  update public.domains
  set project_id = p_project_id, status = 'connecting', status_reason = null
  where id = p_domain_id;
  update public.domain_hostnames set project_id = p_project_id where domain_id = p_domain_id;

  insert into public.domain_events (domain_id, event, summary, actor_user_id)
  values (p_domain_id, 'attached', 'Moved to another website', auth.uid());
end;
$$;

create or replace function public.begin_domain_removal(p_domain_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not public.domain_can_manage(p_domain_id) then
    raise exception 'DOMAIN_INVALID';
  end if;
  update public.domains set status = 'removing', status_reason = null where id = p_domain_id;
  update public.domain_hostnames set status = 'removing' where domain_id = p_domain_id and status <> 'removed';
  insert into public.domain_events (domain_id, event, summary, actor_user_id)
  values (p_domain_id, 'removal_started', 'Domain removal started', auth.uid());
end;
$$;

create or replace function public.finish_domain_removal(p_domain_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_project uuid;
begin
  if not public.domain_can_manage(p_domain_id) then
    raise exception 'DOMAIN_INVALID';
  end if;
  select project_id into v_project from public.domains where id = p_domain_id;
  update public.projects
  set primary_host = null
  where id = v_project
    and primary_host in (select hostname from public.domain_hostnames where domain_id = p_domain_id);
  update public.domain_hostnames set status = 'removed', removed_at = now() where domain_id = p_domain_id;
  update public.domains
  set status = 'removed', removed_at = now(), project_id = null
  where id = p_domain_id;
  insert into public.domain_events (domain_id, event, summary, actor_user_id)
  values (p_domain_id, 'removed', 'Domain removed', auth.uid());
end;
$$;

create or replace function public.enforce_domain_plan(p_team_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_limit int;
  v_keep int;
  v_restored int;
begin
  if auth.role() <> 'service_role'
     and not public.user_has_team_role(p_team_id, array['owner','admin']) then
    raise exception 'DOMAIN_INVALID';
  end if;
  v_limit := public.domain_plan_limit(p_team_id);
  v_keep := greatest(v_limit, 0);

  with restored as (
    update public.domains
    set status = coalesce(plan_previous_status, 'connecting'),
        plan_previous_status = null,
        status_reason = null
    where team_id = p_team_id and status = 'plan_lapsed'
    returning id
  )
  select count(*) into v_restored from restored;

  with ranked as (
    select id,
           row_number() over (
             partition by project_id
             order by created_at asc, id asc
           ) as position
    from public.domains
    where team_id = p_team_id
      and project_id is not null
      and status in ('live','attention','connecting','stalled','verified')
  ),
  lapsed as (
    update public.domains d
    set plan_previous_status = d.status,
        status = 'plan_lapsed',
        status_reason = 'plan'
    where d.id in (select id from ranked where position > v_keep)
    returning d.id
  )
  insert into public.domain_events (domain_id, event, summary)
  select id, 'plan_lapsed', 'Domain paused because of the plan' from lapsed;
end;
$$;

create or replace function public.restore_domain_plan(p_team_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.role() <> 'service_role'
     and not public.user_has_team_role(p_team_id, array['owner','admin']) then
    raise exception 'DOMAIN_INVALID';
  end if;

  with restored as (
    update public.domains
    set status = coalesce(plan_previous_status, 'connecting'),
        plan_previous_status = null,
        status_reason = null
    where team_id = p_team_id and status = 'plan_lapsed'
    returning id
  )
  insert into public.domain_events (domain_id, event, summary)
  select id, 'plan_restored', 'Domain restored after the plan changed' from restored;
end;
$$;

revoke all on function public.start_domain(uuid,text,text) from public;
revoke all on function public.mark_domain_verified(uuid) from public;
revoke all on function public.add_hostname(uuid,text,text,text,integer) from public;
revoke all on function public.set_main_hostname(uuid) from public;
revoke all on function public.detach_domain(uuid) from public;
revoke all on function public.reassign_domain(uuid,uuid) from public;
revoke all on function public.begin_domain_removal(uuid) from public;
revoke all on function public.finish_domain_removal(uuid) from public;
revoke all on function public.enforce_domain_plan(uuid) from public;
revoke all on function public.restore_domain_plan(uuid) from public;

grant execute on function public.start_domain(uuid,text,text) to authenticated, service_role;
grant execute on function public.mark_domain_verified(uuid) to authenticated, service_role;
grant execute on function public.add_hostname(uuid,text,text,text,integer) to authenticated, service_role;
grant execute on function public.set_main_hostname(uuid) to authenticated, service_role;
grant execute on function public.detach_domain(uuid) to authenticated, service_role;
grant execute on function public.reassign_domain(uuid,uuid) to authenticated, service_role;
grant execute on function public.begin_domain_removal(uuid) to authenticated, service_role;
grant execute on function public.finish_domain_removal(uuid) to authenticated, service_role;
grant execute on function public.enforce_domain_plan(uuid) to service_role;
grant execute on function public.restore_domain_plan(uuid) to service_role;

-- Blocked domains -----------------------------------------------------------

insert into public.blocked_domains (hostname_pattern, reason) values
  ('get-on.tech', 'Platform domain'),
  ('*.get-on.tech', 'Platform domain'),
  ('localhost', 'Reserved suffix'),
  ('*.localhost', 'Reserved suffix'),
  ('local', 'Reserved suffix'),
  ('*.local', 'Reserved suffix'),
  ('internal', 'Reserved suffix'),
  ('*.internal', 'Reserved suffix'),
  ('test', 'Reserved suffix'),
  ('*.test', 'Reserved suffix'),
  ('example', 'Reserved suffix'),
  ('*.example', 'Reserved suffix'),
  ('invalid', 'Reserved suffix'),
  ('*.invalid', 'Reserved suffix'),
  ('onion', 'Reserved suffix'),
  ('*.onion', 'Reserved suffix'),
  ('lan', 'Reserved suffix'),
  ('*.lan', 'Reserved suffix'),
  ('home.arpa', 'Reserved suffix'),
  ('*.home.arpa', 'Reserved suffix')
on conflict (hostname_pattern) do nothing;
