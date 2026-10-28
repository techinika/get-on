-- Background jobs for email, marketing, reports and staff sessions.
--
-- Jobs are service-role only. Marketing is re-checked at send time so a pause
-- or an opt-out always wins over a campaign that was queued earlier.

create or replace function public.email_defer(p_id uuid, p_retry_at timestamptz)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'NOT_ALLOWED';
  end if;
  update public.notification_outbox
    set status = 'queued',
        attempts = greatest(attempts - 1, 0),
        next_attempt_at = coalesce(p_retry_at, now() + interval '30 minutes')
    where id = p_id;
end;
$$;

-- Do not claim marketing rows while marketing is paused. Those rows keep
-- their queue position instead of burning retry attempts.
create or replace function public.email_claim(p_limit int default 50)
returns setof public.notification_outbox
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'NOT_ALLOWED';
  end if;
  return query
    with due as (
      select o.id
      from public.notification_outbox o
      where o.status = 'queued'
        and o.scheduled_for <= now()
        and (o.next_attempt_at is null or o.next_attempt_at <= now())
        and (o.expires_at is null or o.expires_at > now())
        and not (
          o.stream = 'marketing'
          and (
            coalesce((select paused from public.marketing_settings where id), false)
            or coalesce((select marketing_paused from public.email_settings where id), false)
          )
        )
      order by o.scheduled_for
      limit greatest(1, least(coalesce(p_limit, 50), 200))
      for update skip locked
    )
    update public.notification_outbox o
      set status = 'sending', attempts = o.attempts + 1
      from due
      where o.id = due.id
      returning o.*;
end;
$$;

create or replace function public.marketing_campaign_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sent int := 0;
  v_failed int := 0;
  v_suppressed int := 0;
begin
  if auth.role() <> 'service_role' then
    raise exception 'NOT_ALLOWED';
  end if;

  with updated as (
    update public.marketing_campaign_recipients r
      set status = case o.status
            when 'sent' then 'sent'
            when 'failed' then 'failed'
            when 'suppressed' then 'suppressed'
            when 'cancelled' then 'skipped'
            else r.status
          end,
          sent_at = o.sent_at,
          error = left(o.last_error, 500)
      from public.notification_outbox o
      where r.outbox_id = o.id
        and r.status = 'queued'
        and o.status in ('sent', 'failed', 'suppressed', 'cancelled')
      returning r.status
  )
  select
    count(*) filter (where status = 'sent'),
    count(*) filter (where status = 'failed'),
    count(*) filter (where status = 'suppressed')
    into v_sent, v_failed, v_suppressed
  from updated;

  update public.marketing_campaigns c
    set status = case when agg.queued = 0 and c.status = 'sending' then 'sent' else c.status end,
        sent_at = case
          when agg.queued = 0 and c.status = 'sending' then coalesce(c.sent_at, now())
          else c.sent_at
        end,
        updated_at = now()
    from (
      select campaign_id,
        count(*) filter (where status = 'queued') as queued
      from public.marketing_campaign_recipients
      group by campaign_id
    ) agg
    where c.id = agg.campaign_id
      and c.status in ('sending', 'sent');

  return jsonb_build_object(
    'updated_sent', v_sent,
    'updated_failed', v_failed,
    'updated_suppressed', v_suppressed
  );
end;
$$;

create or replace function public.consent_audit()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mismatched int := 0;
  v_disabled int := 0;
begin
  if auth.role() <> 'service_role' then
    raise exception 'NOT_ALLOWED';
  end if;

  with mismatch as (
    select p.user_id
    from public.email_preferences p
    where p.marketing_opt_in
      and exists (
        select 1
        from public.consent_records c
        where c.user_id = p.user_id
          and c.kind = 'marketing'
          and c.granted = false
          and c.created_at = (
            select max(c2.created_at) from public.consent_records c2
            where c2.user_id = p.user_id and c2.kind = 'marketing'
          )
      )
  ),
  disabled as (
    update public.email_preferences p
      set marketing_opt_in = false,
          marketing_opt_in_at = null,
          marketing_source = 'consent_audit',
          updated_at = now()
      where p.user_id in (select user_id from mismatch)
      returning 1
  )
  select (select count(*) from mismatch), (select count(*) from disabled)
    into v_mismatched, v_disabled;
  return jsonb_build_object('mismatched', v_mismatched, 'disabled', v_disabled);
end;
$$;

create or replace function public.email_tracking_purge()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_links int := 0;
  v_opens int := 0;
begin
  if auth.role() <> 'service_role' then
    raise exception 'NOT_ALLOWED';
  end if;

  delete from public.email_tracking_links l
  using public.notification_outbox o
  where l.outbox_id = o.id
    and o.created_at < now() - interval '24 months';
  get diagnostics v_links = row_count;

  delete from public.email_tracking_opens p
  using public.notification_outbox o
  where p.outbox_id = o.id
    and o.created_at < now() - interval '24 months';
  get diagnostics v_opens = row_count;

  return jsonb_build_object('links', v_links, 'opens', v_opens);
end;
$$;

create or replace function public.staff_sessions_sweep()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sessions int := 0;
  v_events int := 0;
begin
  if auth.role() <> 'service_role' then
    raise exception 'NOT_ALLOWED';
  end if;

  update public.staff_access_sessions
    set closed_at = now()
    where closed_at is null and expires_at <= now();
  get diagnostics v_sessions = row_count;

  delete from public.staff_login_events
    where created_at < now() - interval '24 months';
  get diagnostics v_events = row_count;

  return jsonb_build_object('sessions_closed', v_sessions, 'events_purged', v_events);
end;
$$;

create or replace function public.report_refresh(p_kind text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start timestamptz := date_trunc('day', now() - interval '29 days');
  v_end timestamptz := date_trunc('hour', now());
  v_kinds text[];
  k text;
  v_data jsonb;
  v_count int := 0;
begin
  if auth.role() <> 'service_role' and not public.staff_can('reports.view') then
    raise exception 'NOT_ALLOWED';
  end if;

  if p_kind is null or p_kind = 'all' then
    v_kinds := array['overview', 'growth', 'revenue', 'support', 'email', 'ai', 'domains', 'health'];
  else
    v_kinds := array[p_kind];
  end if;

  foreach k in array v_kinds loop
    if k = 'overview' then
      v_data := jsonb_build_object(
        'users', (select count(*) from auth.users),
        'teams', (select count(*) from public.teams),
        'new_teams_30d', (select count(*) from public.teams where created_at >= v_start),
        'websites', (select count(*) from public.projects where deleted_at is null),
        'published', (select count(*) from public.projects where deleted_at is null and status = 'published'),
        'domains_live', (select count(*) from public.domains where status = 'live' and removed_at is null),
        'open_support', (select count(*) from public.support_cases where status in ('open', 'in_progress', 'waiting_customer', 'waiting_staff')),
        'revenue_30d_cents', (select coalesce(sum(amount_cents), 0) from public.payments where status = 'confirmed' and paid_at >= v_start)
      );
    elsif k = 'growth' then
      v_data := jsonb_build_object(
        'series', coalesce((
          select jsonb_agg(jsonb_build_object(
            'day', to_char(d, 'YYYY-MM-DD'),
            'signups', (select count(*) from auth.users u where u.created_at >= d and u.created_at < d + interval '1 day'),
            'teams', (select count(*) from public.teams t where t.created_at >= d and t.created_at < d + interval '1 day'),
            'websites', (select count(*) from public.projects p where p.created_at >= d and p.created_at < d + interval '1 day')
          ) order by d)
          from generate_series(v_start, date_trunc('day', now()), interval '1 day') d
        ), '[]'::jsonb)
      );
    elsif k = 'revenue' then
      v_data := jsonb_build_object(
        'series', coalesce((
          select jsonb_agg(jsonb_build_object(
            'month', to_char(m, 'YYYY-MM'),
            'currency', currency,
            'cents', cents
          ) order by m)
          from (
            select date_trunc('month', paid_at) m, currency, sum(amount_cents)::bigint cents
            from public.payments
            where status = 'confirmed'
              and paid_at >= date_trunc('month', now()) - interval '11 months'
            group by 1, 2
          ) x
        ), '[]'::jsonb),
        'refunds_cents', (
          select coalesce(sum(amount_cents), 0)
          from public.refunds
          where status = 'processed' and processed_at >= date_trunc('month', now()) - interval '11 months'
        ),
        'open_debt_cents', (
          select coalesce(sum(total_cents - amount_paid_cents), 0)
          from public.invoices
          where status in ('open', 'payment_pending', 'expired')
        )
      );
    elsif k = 'support' then
      v_data := jsonb_build_object(
        'open', (select count(*) from public.support_cases where status in ('open', 'in_progress', 'waiting_customer', 'waiting_staff')),
        'breached', (
          select count(*) from public.support_cases
          where status in ('open', 'in_progress', 'waiting_customer', 'waiting_staff')
            and first_response_at is null and due_at <= now()
        ),
        'by_priority', coalesce((
          select jsonb_object_agg(priority, cnt)
          from (
            select priority, count(*) cnt
            from public.support_cases
            where status in ('open', 'in_progress', 'waiting_customer', 'waiting_staff')
            group by 1
          ) x
        ), '{}'::jsonb),
        'first_response_hours_avg', (
          select round(avg(extract(epoch from (first_response_at - created_at)) / 3600)::numeric, 2)
          from public.support_cases
          where first_response_at is not null and created_at >= v_start
        ),
        'csat_avg', (select round(avg(csat)::numeric, 2) from public.support_cases where csat is not null)
      );
    elsif k = 'email' then
      v_data := jsonb_build_object(
        'sent_30d', (select count(*) from public.notification_outbox where status = 'sent' and created_at >= v_start),
        'failed_30d', (select count(*) from public.notification_outbox where status = 'failed' and created_at >= v_start),
        'suppressed_30d', (select count(*) from public.notification_outbox where status = 'suppressed' and created_at >= v_start),
        'by_stream', coalesce((
          select jsonb_object_agg(stream, cnt)
          from (
            select stream, count(*) cnt
            from public.notification_outbox
            where created_at >= v_start
            group by 1
          ) x
        ), '{}'::jsonb),
        'opted_in', (select count(*) from public.email_preferences where marketing_opt_in),
        'suppressions', (select count(*) from public.email_suppressions)
      );
    elsif k = 'ai' then
      v_data := jsonb_build_object(
        'requests_30d', (select count(*) from public.ai_requests where created_at >= v_start),
        'failed_30d', (select count(*) from public.ai_requests where status = 'failed' and created_at >= v_start),
        'charged_credits_30d', (select coalesce(sum(charged_credits), 0) from public.ai_requests where created_at >= v_start),
        'by_feature', coalesce((
          select jsonb_object_agg(feature, cnt)
          from (
            select coalesce(feature, 'other') feature, count(*) cnt
            from public.ai_requests
            where created_at >= v_start
            group by 1
          ) x
        ), '{}'::jsonb)
      );
    elsif k = 'domains' then
      v_data := jsonb_build_object(
        'by_status', coalesce((
          select jsonb_object_agg(status, cnt)
          from (
            select status, count(*) cnt
            from public.domains
            where removed_at is null
            group by 1
          ) x
        ), '{}'::jsonb),
        'hostnames_live', (select count(*) from public.domain_hostnames where status = 'live' and removed_at is null),
        'hostnames_attention', (select count(*) from public.domain_hostnames where status = 'attention' and removed_at is null),
        'health_failures', (select count(*) from public.domain_hostnames where health_failures > 0 and removed_at is null)
      );
    elsif k = 'health' then
      v_data := jsonb_build_object(
        'outbox_failed', (select count(*) from public.notification_outbox where status = 'failed'),
        'outbox_stuck_sending', (
          select count(*) from public.notification_outbox
          where status = 'sending' and created_at < now() - interval '15 minutes'
        ),
        'approvals_pending', (select count(*) from public.approval_requests where status = 'pending'),
        'approvals_expired', (select count(*) from public.approval_requests where status = 'expired'),
        'sla_breached_open', (
          select count(*) from public.support_cases
          where status in ('open', 'in_progress', 'waiting_customer', 'waiting_staff')
            and first_response_at is null and due_at <= now()
        ),
        'staff_sessions_expired_open', (
          select count(*) from public.staff_access_sessions
          where closed_at is null and expires_at <= now()
        ),
        'domains_attention', (select count(*) from public.domains where status = 'attention' and removed_at is null)
      );
    else
      raise exception 'UNKNOWN_REPORT_KIND';
    end if;

    insert into public.report_snapshots (kind, period_start, period_end, data, generated_at)
    values (k, v_start, v_end, v_data, now())
    on conflict (kind, period_start, period_end)
    do update set data = excluded.data, generated_at = excluded.generated_at;

    v_count := v_count + 1;
  end loop;

  return jsonb_build_object(
    'refreshed', v_count,
    'period_start', v_start,
    'period_end', v_end
  );
end;
$$;

create or replace function public.finance_snapshot(p_month date default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month date := date_trunc('month', coalesce(p_month, current_date))::date;
  v_start timestamptz := date_trunc('month', coalesce(p_month, current_date));
  v_end timestamptz := date_trunc('month', coalesce(p_month, current_date)) + interval '1 month';
  v_data jsonb;
begin
  if auth.role() <> 'service_role' and not public.staff_can('finance.view') then
    raise exception 'NOT_ALLOWED';
  end if;

  v_data := jsonb_build_object(
    'month', to_char(v_month, 'YYYY-MM'),
    'payments_cents', (
      select coalesce(sum(amount_cents), 0) from public.payments
      where status = 'confirmed' and paid_at >= v_start and paid_at < v_end
    ),
    'payments_by_currency', coalesce((
      select jsonb_object_agg(currency, cents)
      from (
        select currency, sum(amount_cents)::bigint cents
        from public.payments
        where status = 'confirmed' and paid_at >= v_start and paid_at < v_end
        group by 1
      ) x
    ), '{}'::jsonb),
    'refunds_cents', (
      select coalesce(sum(amount_cents), 0) from public.refunds
      where status = 'processed' and processed_at >= v_start and processed_at < v_end
    ),
    'invoices_created', (select count(*) from public.invoices where created_at >= v_start and created_at < v_end),
    'invoices_paid', (
      select count(*) from public.invoices
      where status = 'paid' and paid_at >= v_start and paid_at < v_end
    ),
    'invoices_void', (
      select count(*) from public.invoices
      where voided_at >= v_start and voided_at < v_end
    ),
    'open_debt_cents', (
      select coalesce(sum(total_cents - amount_paid_cents), 0) from public.invoices
      where status in ('open', 'payment_pending', 'expired')
    )
  );

  delete from public.finance_snapshots
    where month = v_month and generated_at::date = current_date;
  insert into public.finance_snapshots (month, data, generated_at)
    values (v_month, v_data, now());

  update public.finance_months
    set totals = v_data
    where month = v_month and status = 'open';

  return v_data;
end;
$$;

create or replace function public.weekly_report()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_week date := date_trunc('week', now())::date;
  v_start timestamptz := date_trunc('week', now());
  v_data jsonb;
begin
  if auth.role() <> 'service_role' and not public.staff_can('reports.view') then
    raise exception 'NOT_ALLOWED';
  end if;

  v_data := jsonb_build_object(
    'week_start', to_char(v_week, 'YYYY-MM-DD'),
    'new_teams', (select count(*) from public.teams where created_at >= v_start),
    'new_websites', (select count(*) from public.projects where created_at >= v_start),
    'published', (
      select count(*) from public.projects
      where status = 'published' and updated_at >= v_start
    ),
    'revenue_cents', (
      select coalesce(sum(amount_cents), 0) from public.payments
      where status = 'confirmed' and paid_at >= v_start
    ),
    'support_opened', (select count(*) from public.support_cases where created_at >= v_start),
    'support_closed', (
      select count(*) from public.support_cases
      where closed_at >= v_start or resolved_at >= v_start
    ),
    'marketing_sent', (
      select count(*) from public.notification_outbox
      where stream = 'marketing' and status = 'sent' and created_at >= v_start
    ),
    'email_failed', (
      select count(*) from public.notification_outbox
      where status = 'failed' and created_at >= v_start
    )
  );

  insert into public.weekly_reports (week_start, data, generated_at)
  values (v_week, v_data, now())
  on conflict (week_start)
  do update set data = excluded.data, generated_at = excluded.generated_at;

  return v_data;
end;
$$;

revoke all on function public.email_defer(uuid, timestamptz) from public;
revoke all on function public.marketing_campaign_stats() from public;
revoke all on function public.consent_audit() from public;
revoke all on function public.email_tracking_purge() from public;
revoke all on function public.staff_sessions_sweep() from public;
revoke all on function public.report_refresh(text) from public;
revoke all on function public.finance_snapshot(date) from public;
revoke all on function public.weekly_report() from public;

grant execute on function public.email_defer(uuid, timestamptz) to service_role;
grant execute on function public.marketing_campaign_stats() to service_role;
grant execute on function public.consent_audit() to service_role;
grant execute on function public.email_tracking_purge() to service_role;
grant execute on function public.staff_sessions_sweep() to service_role;
grant execute on function public.report_refresh(text) to authenticated, service_role;
grant execute on function public.finance_snapshot(date) to authenticated, service_role;
grant execute on function public.weekly_report() to authenticated, service_role;
