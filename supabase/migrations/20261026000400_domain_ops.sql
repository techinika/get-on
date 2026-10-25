create table if not exists public.domain_job_runs (
  id uuid primary key default gen_random_uuid(),
  job text not null,
  status text not null check (status in ('ok','error')),
  started_at timestamptz not null,
  finished_at timestamptz not null,
  duration_ms integer not null default 0,
  count integer not null default 0,
  error text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists domain_job_runs_job_idx
  on public.domain_job_runs (job, started_at desc);

create index if not exists domain_job_runs_started_idx
  on public.domain_job_runs (started_at desc);

alter table public.domain_job_runs enable row level security;

create table if not exists public.domain_provider_health (
  id text primary key default 'default',
  provider text not null,
  total_requests bigint not null default 0,
  total_failures bigint not null default 0,
  consecutive_failures integer not null default 0,
  circuit_open_until timestamptz,
  last_failure_at timestamptz,
  last_success_at timestamptz,
  checked_at timestamptz not null default now()
);

alter table public.domain_provider_health enable row level security;

create or replace function public.admin_reassign_hostname(
  p_hostname_id uuid,
  p_project_id uuid,
  p_admin_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_host public.domain_hostnames%rowtype;
  v_source public.domains%rowtype;
  v_project public.projects%rowtype;
  v_target public.domains%rowtype;
  v_target_status text;
  v_target_id uuid;
  v_limit int;
  v_count int;
begin
  select * into v_host
  from public.domain_hostnames
  where id = p_hostname_id
  for update;
  if not found or v_host.status = 'removed' then
    raise exception 'HOSTNAME_NOT_FOUND';
  end if;

  select * into v_source
  from public.domains
  where id = v_host.domain_id
  for update;
  if not found then
    raise exception 'DOMAIN_INVALID';
  end if;

  select * into v_project
  from public.projects
  where id = p_project_id
    and deleted_at is null;
  if not found then
    raise exception 'PROJECT_NOT_FOUND';
  end if;
  if v_project.team_id = v_source.team_id then
    raise exception 'SAME_TEAM';
  end if;
  if v_host.role = 'main'
     and v_host.status = 'live'
     and v_project.primary_host is not null
     and v_project.primary_host <> v_host.hostname then
    raise exception 'PROJECT_HAS_MAIN';
  end if;

  select * into v_target
  from public.domains
  where team_id = v_project.team_id
    and registrable = v_source.registrable
    and status not in ('removed','failed')
  for update;

  if found then
    if v_target.project_id is not null and v_target.project_id <> p_project_id then
      raise exception 'DOMAIN_ALREADY_CONNECTED';
    end if;
    v_target_id := v_target.id;
    if v_target.project_id is null then
      v_limit := public.domain_plan_limit(v_project.team_id);
      select count(*) into v_count
      from public.domains
      where project_id = p_project_id
        and status not in ('draft','removed','failed','plan_lapsed');
      if v_count >= v_limit then
        raise exception 'DOMAIN_LIMIT_REACHED';
      end if;
      update public.domains
      set project_id = p_project_id,
          status = case when v_host.status = 'live' and v_host.role = 'main' then 'live' else 'connecting' end,
          status_reason = null
      where id = v_target.id;
    end if;
  else
    v_target_status := case
      when v_host.status = 'live' and v_host.role = 'main' then 'live'
      else 'connecting'
    end;
    insert into public.domains (
      team_id, project_id, registrable, display_name, role, status,
      verification_value, verification_started_at, verification_expires_at,
      verified_at, review_state, registrar, dns_provider_hint,
      last_checked_at, created_by
    ) values (
      v_project.team_id, p_project_id, v_source.registrable,
      v_source.display_name, 'primary', v_target_status,
      v_source.verification_value, v_source.verification_started_at,
      greatest(v_source.verification_expires_at, now() + interval '1 day'),
      coalesce(v_source.verified_at, now()), 'approved', v_source.registrar,
      v_source.dns_provider_hint, now(), p_admin_id
    )
    returning id into v_target_id;
  end if;

  update public.domain_hostnames
  set domain_id = v_target_id,
      project_id = p_project_id
  where id = p_hostname_id;

  if v_host.role = 'main' and v_host.status = 'live' then
    update public.projects
    set primary_host = v_host.hostname
    where id = p_project_id;
  end if;

  if v_host.role = 'main' and v_source.project_id is not null then
    update public.projects
    set primary_host = null
    where id = v_source.project_id
      and primary_host = v_host.hostname;
  end if;

  if not exists (
    select 1 from public.domain_hostnames
    where domain_id = v_source.id and status <> 'removed'
  ) then
    update public.domains
    set status = 'removed', removed_at = now(), project_id = null
    where id = v_source.id;
  elsif v_host.role = 'main' then
    update public.domains
    set status = 'connecting', status_reason = null
    where id = v_source.id;
  end if;

  insert into public.domain_events (domain_id, hostname_id, event, summary)
  values (
    v_source.id, p_hostname_id, 'hostname_reassigned',
    'Address moved to another team by support'
  );

  insert into public.domain_events (domain_id, hostname_id, event, summary)
  values (
    v_target_id, p_hostname_id, 'hostname_reassigned',
    'Address moved from another team by support'
  );

  return v_target_id;
end;
$$;

revoke all on function public.admin_reassign_hostname(uuid,uuid,uuid) from public;
grant execute on function public.admin_reassign_hostname(uuid,uuid,uuid) to service_role;
