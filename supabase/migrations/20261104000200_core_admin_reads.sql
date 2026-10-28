-- Metadata reads for the core staff screens. These replace the direct
-- service-role queries that the first console version used.

create or replace function public.admin_list_projects(p_limit int default 200)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.staff_assert('website.search');
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.id,
      'name', p.name,
      'subdomain', p.subdomain,
      'status', p.status,
      'review_state', p.review_state,
      'suspended_at', p.suspended_at,
      'suspended_reason', p.suspended_reason,
      'created_at', p.created_at,
      'team_id', p.team_id,
      'team_name', t.name,
      'owner_email', public.mask_email(o.email),
      'last_published_at', (
        select max(coalesce(pb.live_at, pb.created_at))
        from public.publishes pb
        where pb.project_id = p.id
          and pb.status in ('live', 'offline', 'superseded', 'ready')
      ),
      'report_count', (
        select count(*) from public.abuse_reports r where r.project_id = p.id
      ),
      'new_report_count', (
        select count(*) from public.abuse_reports r
        where r.project_id = p.id and r.status = 'new'
      )
    ) order by p.created_at desc)
    from (
      select * from public.projects
      where deleted_at is null
      order by created_at desc
      limit greatest(1, least(coalesce(p_limit, 200), 500))
    ) p
    left join public.teams t on t.id = p.team_id
    left join public.profiles o on o.id = t.owner_id
  ), '[]'::jsonb);
end;
$$;

create or replace function public.admin_email_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.staff_assert('email.view');
  return jsonb_build_object(
    'queued', (select count(*) from public.notification_outbox where status = 'queued'),
    'sent_24h', (
      select count(*) from public.notification_outbox
      where status = 'sent' and created_at >= now() - interval '24 hours'
    ),
    'failed_24h', (
      select count(*) from public.notification_outbox
      where status = 'failed' and created_at >= now() - interval '24 hours'
    ),
    'suppressed_24h', (
      select count(*) from public.notification_outbox
      where status = 'suppressed' and created_at >= now() - interval '24 hours'
    ),
    'suppressions', (select count(*) from public.email_suppressions)
  );
end;
$$;

create or replace function public.admin_email_suppressions(p_limit int default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.staff_assert('email.view');
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'email', public.mask_email(s.email),
      'reason', s.reason,
      'detail', s.detail,
      'created_at', s.created_at
    ) order by s.created_at desc)
    from (
      select * from public.email_suppressions
      order by created_at desc
      limit greatest(1, least(coalesce(p_limit, 50), 200))
    ) s
  ), '[]'::jsonb);
end;
$$;

create or replace function public.admin_domain_ops()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_health jsonb;
begin
  perform public.staff_assert('domain.view');

  select to_jsonb(h) into v_health
  from (
    select
      dph.provider,
      dph.total_requests as total_requests,
      dph.total_failures as total_failures,
      dph.consecutive_failures as consecutive_failures,
      dph.circuit_open_until as circuit_open_until,
      dph.last_failure_at as last_failure_at,
      dph.last_success_at as last_success_at,
      dph.checked_at as checked_at,
      dph.circuit_open_until is not null and dph.circuit_open_until > now() as circuit_open
    from public.domain_provider_health dph
    where dph.id = 'default'
  ) h;

  return jsonb_build_object(
    'counts', jsonb_build_object(
      'domains', (select count(*) from public.domains where status <> 'removed'),
      'hostnames', (select count(*) from public.domain_hostnames where status <> 'removed'),
      'pending', (
        select count(*) from public.domain_hostnames
        where status in ('pending', 'preparing', 'active')
      ),
      'attention', (select count(*) from public.domains where status in ('attention', 'stalled', 'failed')),
      'review', (select count(*) from public.domains where review_state = 'pending')
    ),
    'runs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'job', r.job, 'status', r.status,
        'started_at', r.started_at, 'finished_at', r.finished_at,
        'duration_ms', r.duration_ms, 'count', r.count, 'error', r.error,
        'created_at', r.created_at
      ) order by r.started_at desc)
      from (
        select distinct on (job) *
        from public.domain_job_runs
        order by job, started_at desc
      ) r
    ), '[]'::jsonb),
    'health', v_health
  );
end;
$$;

-- A staff-callable plan change. The old version was service-role only and
-- wrote to the removed admin_audit_log table.
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
  perform public.staff_assert('account.entitlements.rebuild');
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

revoke all on function public.admin_list_projects(int) from public;
revoke all on function public.admin_email_summary() from public;
revoke all on function public.admin_email_suppressions(int) from public;
revoke all on function public.admin_domain_ops() from public;
revoke all on function public.admin_set_team_plan(uuid, text, text) from public;

grant execute on function public.admin_list_projects(int) to authenticated, service_role;
grant execute on function public.admin_email_summary() to authenticated, service_role;
grant execute on function public.admin_email_suppressions(int) to authenticated, service_role;
grant execute on function public.admin_domain_ops() to authenticated, service_role;
grant execute on function public.admin_set_team_plan(uuid, text, text) to authenticated, service_role;
