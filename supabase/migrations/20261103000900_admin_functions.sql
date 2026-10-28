-- Staff read metadata through these SECURITY DEFINER functions. Each one
-- selects explicit metadata columns and calls staff_assert. Customer content
-- tables are never touched.

create or replace function public.mask_email(p_email text)
returns text
language sql
immutable
as $$
  select case
    when p_email is null or position('@' in p_email) = 0 then null
    else left(split_part(p_email, '@', 1), 1) || '***@' || split_part(p_email, '@', 2)
  end
$$;

create or replace function public.staff_has_team_access(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.role() = 'service_role'
    or exists (
      select 1
      from public.staff_access_sessions s
      where s.staff_user_id = auth.uid()
        and s.team_id = p_team_id
        and s.closed_at is null
        and s.expires_at > now()
    )
$$;

create or replace function public.admin_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.staff_assert('account.search');
  return jsonb_build_object(
    'teams', (select count(*) from public.teams),
    'websites', (select count(*) from public.projects where deleted_at is null),
    'published', (select count(*) from public.projects where status = 'published' and deleted_at is null),
    'paid_teams', (select count(*) from public.team_billing where status = 'active'),
    'open_cases', (select count(*) from public.support_cases where status in ('open', 'waiting_customer', 'waiting_staff')),
    'cases_late', (
      select count(*) from public.support_cases
      where status in ('open', 'waiting_customer', 'waiting_staff')
        and first_response_at is null
        and due_at <= now()
    ),
    'pending_approvals', (select count(*) from public.approval_requests where status = 'pending'),
    'abuse_pending', (select count(*) from public.abuse_reports where status = 'new'),
    'email_failed_24h', (
      select count(*) from public.notification_outbox
      where status = 'failed' and created_at >= now() - interval '24 hours'
    ),
    'marketing_paused', (select paused from public.marketing_settings where id)
  );
end;
$$;

create or replace function public.admin_search(p_query text, p_limit int default 20)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_q text := '%' || lower(trim(coalesce(p_query, ''))) || '%';
  v_limit int := greatest(1, least(coalesce(p_limit, 20), 50));
begin
  perform public.staff_assert('account.search');
  if length(trim(coalesce(p_query, ''))) < 2 then
    return jsonb_build_object('teams', '[]'::jsonb, 'websites', '[]'::jsonb, 'people', '[]'::jsonb, 'cases', '[]'::jsonb);
  end if;

  return jsonb_build_object(
    'teams', coalesce((
      select jsonb_agg(row)
      from (
        select jsonb_build_object(
          'id', t.id, 'name', t.name, 'plan_id', t.plan_id,
          'created_at', t.created_at
        ) as row
        from public.teams t
        where lower(t.name) like v_q
           or exists (
             select 1 from public.profiles p
             join public.team_members m on m.user_id = p.id
             where m.team_id = t.id and lower(coalesce(p.email, '')) like v_q
           )
        order by t.created_at desc
        limit v_limit
      ) s
    ), '[]'::jsonb),
    'websites', coalesce((
      select jsonb_agg(row)
      from (
        select jsonb_build_object(
          'id', pr.id, 'name', pr.name, 'subdomain', pr.subdomain,
          'status', pr.status, 'team_id', pr.team_id, 'created_at', pr.created_at
        ) as row
        from public.projects pr
        where pr.deleted_at is null
          and (lower(pr.name) like v_q or lower(pr.subdomain) like v_q)
        order by pr.created_at desc
        limit v_limit
      ) s
    ), '[]'::jsonb),
    'people', coalesce((
      select jsonb_agg(row)
      from (
        select jsonb_build_object(
          'id', p.id, 'name', p.full_name,
          'email', public.mask_email(p.email),
          'created_at', p.created_at
        ) as row
        from public.profiles p
        where lower(coalesce(p.email, '')) like v_q
           or lower(coalesce(p.full_name, '')) like v_q
        order by p.created_at desc
        limit v_limit
      ) s
    ), '[]'::jsonb),
    'cases', coalesce((
      select jsonb_agg(row)
      from (
        select jsonb_build_object(
          'id', c.id, 'number', c.number, 'subject', c.subject,
          'status', c.status, 'team_id', c.team_id, 'created_at', c.created_at
        ) as row
        from public.support_cases c
        where lower(c.subject) like v_q or c.number::text = trim(coalesce(p_query, ''))
        order by c.created_at desc
        limit v_limit
      ) s
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.admin_list_teams(p_limit int default 100)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.staff_assert('account.search');
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', t.id,
      'name', t.name,
      'plan_id', t.plan_id,
      'plan_source', t.plan_source,
      'is_personal', t.is_personal,
      'created_at', t.created_at,
      'members', (select count(*) from public.team_members m where m.team_id = t.id and m.status = 'active'),
      'websites', (select count(*) from public.projects p where p.team_id = t.id and p.deleted_at is null),
      'billing_status', (select b.status from public.team_billing b where b.team_id = t.id),
      'open_cases', (select count(*) from public.support_cases c where c.team_id = t.id and c.status in ('open', 'waiting_customer', 'waiting_staff'))
    ) order by t.created_at desc)
    from (
      select * from public.teams order by created_at desc limit greatest(1, least(coalesce(p_limit, 100), 500))
    ) t
  ), '[]'::jsonb);
end;
$$;

create or replace function public.admin_team(p_team_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_team public.teams;
begin
  perform public.staff_assert('account.view');
  if not public.staff_has_team_access(p_team_id) then
    raise exception 'STAFF_ACCESS_REQUIRED';
  end if;
  select * into v_team from public.teams where id = p_team_id;
  if v_team.id is null then
    raise exception 'TEAM_NOT_FOUND';
  end if;

  return jsonb_build_object(
    'id', v_team.id,
    'name', v_team.name,
    'plan_id', v_team.plan_id,
    'plan_source', v_team.plan_source,
    'is_personal', v_team.is_personal,
    'created_at', v_team.created_at,
    'owner', (
      select jsonb_build_object('id', p.id, 'name', p.full_name, 'email', public.mask_email(p.email))
      from public.profiles p where p.id = v_team.owner_id
    ),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', p.full_name, 'email', public.mask_email(p.email),
        'role', m.role, 'status', m.status, 'joined_at', m.joined_at
      ) order by m.role, p.full_name)
      from public.team_members m
      join public.profiles p on p.id = m.user_id
      where m.team_id = p_team_id
    ), '[]'::jsonb),
    'websites', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pr.id, 'name', pr.name, 'subdomain', pr.subdomain,
        'status', pr.status, 'review_state', pr.review_state,
        'suspended_at', pr.suspended_at, 'created_at', pr.created_at,
        'pages', (select count(*) from public.pages pg where pg.project_id = pr.id)
      ) order by pr.created_at desc)
      from public.projects pr
      where pr.team_id = p_team_id and pr.deleted_at is null
    ), '[]'::jsonb),
    'billing', public.admin_billing_summary(p_team_id),
    'ai', public.admin_ai_summary(p_team_id),
    'cases', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'number', c.number, 'subject', c.subject,
        'status', c.status, 'priority', c.priority, 'due_at', c.due_at,
        'created_at', c.created_at
      ) order by c.created_at desc)
      from public.support_cases c
      where c.team_id = p_team_id
      limit 20
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.admin_billing_summary(p_team_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_billing public.team_billing;
begin
  perform public.staff_assert('billing.view');
  select * into v_billing from public.team_billing where team_id = p_team_id;
  return jsonb_build_object(
    'status', coalesce(v_billing.status, 'free'),
    'effective_plan_id', v_billing.effective_plan_id,
    'paid_through', v_billing.paid_through,
    'grace_ends_at', v_billing.grace_ends_at,
    'debt_cents', coalesce(v_billing.debt_cents, 0),
    'currency', coalesce(v_billing.currency, 'USD'),
    'last_payment_at', v_billing.last_payment_at,
    'invoices', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'number', i.number, 'status', i.status,
        'total_cents', i.total_cents, 'currency', i.currency,
        'created_at', i.created_at, 'paid_at', i.paid_at
      ) order by i.created_at desc)
      from (
        select * from public.invoices
        where team_id = p_team_id
        order by created_at desc
        limit 10
      ) i
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.admin_ai_summary(p_team_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.staff_assert('ai.view');
  return jsonb_build_object(
    'credits', coalesce((
      select sum(b.amount_remaining)
      from public.credit_buckets b
      where b.team_id = p_team_id and (b.expires_at is null or b.expires_at > now())
    ), 0),
    'requests_30d', (
      select count(*) from public.ai_requests r
      where r.team_id = p_team_id and r.created_at >= now() - interval '30 days'
    ),
    'blocked_30d', (
      select count(*) from public.ai_requests r
      where r.team_id = p_team_id
        and r.created_at >= now() - interval '30 days'
        and r.status in ('refused', 'failed')
    )
  );
end;
$$;

create or replace function public.admin_project(p_project_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_project public.projects;
begin
  perform public.staff_assert('website.view');
  select * into v_project from public.projects where id = p_project_id;
  if v_project.id is null then
    raise exception 'PROJECT_NOT_FOUND';
  end if;
  if not public.staff_has_team_access(v_project.team_id) then
    raise exception 'STAFF_ACCESS_REQUIRED';
  end if;

  return jsonb_build_object(
    'id', v_project.id,
    'team_id', v_project.team_id,
    'name', v_project.name,
    'subdomain', v_project.subdomain,
    'status', v_project.status,
    'review_state', v_project.review_state,
    'suspended_at', v_project.suspended_at,
    'suspended_reason', v_project.suspended_reason,
    'deleted_at', v_project.deleted_at,
    'created_at', v_project.created_at,
    'updated_at', v_project.updated_at,
    'pages', (select count(*) from public.pages pg where pg.project_id = p_project_id),
    'publishes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pb.id, 'status', pb.status, 'pages_count', pb.pages_count,
        'error_code', pb.error_code, 'created_at', pb.created_at, 'live_at', pb.live_at
      ) order by pb.created_at desc)
      from (
        select id, status, pages_count, error_code, created_at, live_at
        from public.publishes
        where project_id = p_project_id
        order by created_at desc
        limit 10
      ) pb
    ), '[]'::jsonb),
    'domains', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id, 'hostname', d.hostname, 'status', d.status,
        'review_state', d.review_state, 'created_at', d.created_at
      ) order by d.created_at desc)
      from public.domains d
      where d.project_id = p_project_id
    ), '[]'::jsonb),
    'flags', coalesce((
      select jsonb_agg(jsonb_build_object('kind', f.kind, 'created_at', f.created_at))
      from public.site_flags f
      where f.project_id = p_project_id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.admin_abuse_reports(p_project_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.staff_assert('abuse.view');
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', r.id, 'reason', r.reason, 'status', r.status,
      'details', r.details, 'reporter_email', public.mask_email(r.reporter_email),
      'created_at', r.created_at, 'handled_at', r.handled_at
    ) order by r.created_at desc)
    from public.abuse_reports r
    where r.project_id = p_project_id
    limit 100
  ), '[]'::jsonb);
end;
$$;

create or replace function public.admin_email_log(p_limit int default 100)
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
      'id', o.id, 'kind', o.kind, 'stream', o.stream,
      'to_email', public.mask_email(coalesce(o.to_email, u.email)),
      'status', o.status, 'attempts', o.attempts,
      'last_error', o.last_error, 'created_at', o.created_at, 'sent_at', o.sent_at
    ) order by o.created_at desc)
    from (
      select * from public.notification_outbox
      order by created_at desc
      limit greatest(1, least(coalesce(p_limit, 100), 500))
    ) o
    left join auth.users u on u.id = o.user_id
  ), '[]'::jsonb);
end;
$$;

create or replace function public.admin_support_cases(p_status text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.staff_assert('support.case.view');
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', c.id, 'number', c.number, 'team_id', c.team_id, 'subject', c.subject,
      'kind', c.kind, 'status', c.status, 'priority', c.priority,
      'assigned_to', c.assigned_to, 'due_at', c.due_at,
      'first_response_at', c.first_response_at, 'created_at', c.created_at
    ) order by c.created_at desc)
    from public.support_cases c
    where p_status is null or c.status = p_status
    limit 200
  ), '[]'::jsonb);
end;
$$;

create or replace function public.admin_audit_list(p_limit int default 100)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.staff_assert('staff.audit.view');
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', a.id, 'staff_user_id', a.staff_user_id,
      'action', a.action, 'target_type', a.target_type, 'target_id', a.target_id,
      'purpose', a.purpose, 'reason', a.reason, 'approval_id', a.approval_id,
      'occurred_at', a.occurred_at
    ) order by a.occurred_at desc)
    from (
      select * from public.staff_audit_log
      order by occurred_at desc
      limit greatest(1, least(coalesce(p_limit, 100), 500))
    ) a
  ), '[]'::jsonb);
end;
$$;

create or replace function public.admin_staff_list()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.staff_assert('staff.view');
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'user_id', s.user_id, 'name', p.full_name, 'email', p.email,
      'role', s.role, 'status', s.status, 'created_at', s.created_at,
      'last_staff_login_at', s.last_staff_login_at
    ) order by s.role, p.full_name)
    from public.platform_staff s
    left join public.profiles p on p.id = s.user_id
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.mask_email(text) from public;
revoke all on function public.staff_has_team_access(uuid) from public;
revoke all on function public.admin_dashboard() from public;
revoke all on function public.admin_search(text, int) from public;
revoke all on function public.admin_list_teams(int) from public;
revoke all on function public.admin_team(uuid) from public;
revoke all on function public.admin_billing_summary(uuid) from public;
revoke all on function public.admin_ai_summary(uuid) from public;
revoke all on function public.admin_project(uuid) from public;
revoke all on function public.admin_abuse_reports(uuid) from public;
revoke all on function public.admin_email_log(int) from public;
revoke all on function public.admin_support_cases(text) from public;
revoke all on function public.admin_audit_list(int) from public;
revoke all on function public.admin_staff_list() from public;

grant execute on function public.mask_email(text) to authenticated, service_role;
grant execute on function public.staff_has_team_access(uuid) to authenticated, service_role;
grant execute on function public.admin_dashboard() to authenticated, service_role;
grant execute on function public.admin_search(text, int) to authenticated, service_role;
grant execute on function public.admin_list_teams(int) to authenticated, service_role;
grant execute on function public.admin_team(uuid) to authenticated, service_role;
grant execute on function public.admin_billing_summary(uuid) to authenticated, service_role;
grant execute on function public.admin_ai_summary(uuid) to authenticated, service_role;
grant execute on function public.admin_project(uuid) to authenticated, service_role;
grant execute on function public.admin_abuse_reports(uuid) to authenticated, service_role;
grant execute on function public.admin_email_log(int) to authenticated, service_role;
grant execute on function public.admin_support_cases(text) to authenticated, service_role;
grant execute on function public.admin_audit_list(int) to authenticated, service_role;
grant execute on function public.admin_staff_list() to authenticated, service_role;
