-- Billing functions: effective plan, refresh, invoice numbering, invoice
-- creation, payment settlement and append-only guards.

create or replace function public.billing_plan_limits(p_plan text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_plan text := p_plan;
  v_limits jsonb;
begin
  if v_plan is null or not exists (select 1 from public.plans where id = v_plan) then
    v_plan := 'free';
  end if;
  select jsonb_build_object(
    'maxWebsites', p.max_websites,
    'maxPagesPerSite', p.max_pages_per_site,
    'maxMembers', p.max_members,
    'maxPlugins', p.max_plugins,
    'maxTemplates', p.max_templates,
    'maxCustomDomainsPerSite', p.custom_domains_per_site,
    'maxRedirects', p.max_redirects,
    'maxPreviewLinks', p.max_preview_links,
    'maxDeletedPending', p.max_deleted_pending,
    'storageMb', p.storage_mb,
    'monthlyEmails', p.monthly_emails,
    'aiMonthlyCredits', p.ai_monthly_credits,
    'aiDailyActions', p.ai_daily_actions,
    'formsMonthly', p.forms_monthly,
    'backups', jsonb_build_object(
      'autoFrequency', p.backup_auto_frequency,
      'autoKeep', p.backup_auto_keep,
      'manualMax', p.backup_manual_max,
      'storageMb', p.backup_storage_mb
    ),
    'exportsPerDay', p.exports_per_day,
    'support', p.support_priority,
    'watermark', p.watermark_required
  ) into v_limits
  from public.plans p
  where p.id = v_plan;
  return coalesce(v_limits, '{}'::jsonb);
end;
$$;

create or replace function public.billing_plan_features(p_plan text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_plan text := p_plan;
  v_rank int;
  v_domains int;
  v_watermark boolean;
  v_members int;
  v_plugins int;
  v_support text;
  v_preview int;
  v_exports int;
begin
  if v_plan is null or not exists (select 1 from public.plans where id = v_plan) then
    v_plan := 'free';
  end if;
  select p.rank, p.custom_domains_per_site, p.watermark_required,
         p.max_members, p.max_plugins, p.support_priority, p.max_preview_links,
         p.exports_per_day
    into v_rank, v_domains, v_watermark,
         v_members, v_plugins, v_support, v_preview, v_exports
    from public.plans p where p.id = v_plan;

  return jsonb_build_object(
    'customDomain', coalesce(v_domains, 0) > 0,
    'removeBadge', not coalesce(v_watermark, true),
    'customCode', coalesce(v_rank, 0) >= 2,
    'analytics', coalesce(v_rank, 0) >= 1,
    'teamMembers', v_members is null or v_members > 1,
    'plugins', v_plugins is null or v_plugins > 1,
    'prioritySupport', coalesce(v_support, 'standard') <> 'standard',
    'previewLinks', coalesce(v_preview, 0) > 0,
    'exports', coalesce(v_exports, 0) > 0
  );
end;
$$;

create or replace function public.billing_resolve_team(
  p_team uuid,
  p_at timestamptz default now()
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_team_plan text;
  v_plan_source text;
  v_grace_days int := 7;
  v_debt bigint := 0;
  v_term_id uuid;
  v_term_plan text;
  v_term_start timestamptz;
  v_term_end timestamptz;
  v_grant_id uuid;
  v_grant_plan text;
  v_grant_start timestamptz;
  v_grant_end timestamptz;
  v_paid_through timestamptz;
  v_last_end timestamptz;
  v_last_plan text;
  v_grace_end timestamptz;
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and not public.user_is_team_member(p_team) then
    raise exception 'NOT_ALLOWED';
  end if;

  select plan_id, plan_source into v_team_plan, v_plan_source
  from public.teams where id = p_team;
  if v_team_plan is null then
    raise exception 'NOT_FOUND';
  end if;

  v_grace_days := coalesce((select grace_days from public.billing_settings where id = 1), 7);
  v_debt := coalesce((select debt_cents from public.team_billing where team_id = p_team), 0);

  -- Support overrides remain visible until support removes them.
  if v_plan_source = 'manual' and v_team_plan <> 'free' then
    return jsonb_build_object(
      'plan_id', v_team_plan,
      'source', 'grant',
      'status', 'active',
      'paid_through', null,
      'grace_ends_at', null,
      'current_term_id', null,
      'grant_id', null,
      'debt_cents', v_debt,
      'limits', public.billing_plan_limits(v_team_plan),
      'features', public.billing_plan_features(v_team_plan)
    );
  end if;

  select max(st.ends_at) into v_paid_through
  from public.subscription_terms st
  where st.team_id = p_team and st.status <> 'cancelled';

  select st.id, st.plan_id, st.starts_at, st.ends_at
    into v_term_id, v_term_plan, v_term_start, v_term_end
  from public.subscription_terms st
  join public.plans p on p.id = st.plan_id
  where st.team_id = p_team
    and st.status <> 'cancelled'
    and st.starts_at <= p_at
    and st.ends_at > p_at
  order by p.rank desc, st.starts_at desc
  limit 1;

  if v_term_id is not null then
    v_grace_end := case when v_paid_through is null then null
      else v_paid_through + make_interval(days => v_grace_days) end;
    return jsonb_build_object(
      'plan_id', v_term_plan,
      'source', 'paid',
      'status', 'active',
      'paid_through', v_paid_through,
      'grace_ends_at', v_grace_end,
      'current_term_id', v_term_id,
      'grant_id', null,
      'debt_cents', v_debt,
      'limits', public.billing_plan_limits(v_term_plan),
      'features', public.billing_plan_features(v_term_plan)
    );
  end if;

  select g.id, g.plan_id, g.starts_at, g.ends_at
    into v_grant_id, v_grant_plan, v_grant_start, v_grant_end
  from public.access_grants g
  join public.plans p on p.id = g.plan_id
  where g.team_id = p_team
    and g.revoked_at is null
    and g.starts_at <= p_at
    and (g.ends_at is null or g.ends_at > p_at)
    -- A migration grant preserves access until the team makes its first
    -- payment. After that, paid terms and new grants decide access.
    and (
      g.source <> 'migration'
      or not exists (
        select 1 from public.subscription_terms st
        where st.team_id = p_team and st.status <> 'cancelled'
      )
    )
  order by p.rank desc, g.starts_at desc
  limit 1;

  if v_grant_id is not null then
    return jsonb_build_object(
      'plan_id', v_grant_plan,
      'source', 'grant',
      'status', 'active',
      'paid_through', v_paid_through,
      'grace_ends_at', null,
      'current_term_id', null,
      'grant_id', v_grant_id,
      'debt_cents', v_debt,
      'limits', public.billing_plan_limits(v_grant_plan),
      'features', public.billing_plan_features(v_grant_plan)
    );
  end if;

  select max(st.ends_at) into v_last_end
  from public.subscription_terms st
  where st.team_id = p_team and st.status <> 'cancelled';

  select st.plan_id into v_last_plan
  from public.subscription_terms st
  where st.team_id = p_team and st.status <> 'cancelled'
  order by st.ends_at desc
  limit 1;

  -- A paid term that has not started yet does not create grace. It becomes
  -- active on its start date; until then the team is on the free plan.
  if v_last_end is not null and v_last_end > p_at then
    return jsonb_build_object(
      'plan_id', 'free',
      'source', 'free',
      'status', 'free',
      'paid_through', v_paid_through,
      'grace_ends_at', null,
      'current_term_id', null,
      'grant_id', null,
      'debt_cents', v_debt,
      'limits', public.billing_plan_limits('free'),
      'features', public.billing_plan_features('free')
    );
  end if;

  if v_last_end is not null then
    v_grace_end := v_last_end + make_interval(days => v_grace_days);
    if p_at < v_grace_end then
      return jsonb_build_object(
        'plan_id', coalesce(v_last_plan, 'free'),
        'source', 'grace',
        'status', 'grace',
        'paid_through', v_last_end,
        'grace_ends_at', v_grace_end,
        'current_term_id', null,
        'grant_id', null,
        'debt_cents', v_debt,
        'limits', public.billing_plan_limits(coalesce(v_last_plan, 'free')),
        'features', public.billing_plan_features(coalesce(v_last_plan, 'free'))
      );
    end if;

    return jsonb_build_object(
      'plan_id', 'free',
      'source', 'lapsed',
      'status', 'lapsed',
      'paid_through', v_last_end,
      'grace_ends_at', v_grace_end,
      'current_term_id', null,
      'grant_id', null,
      'debt_cents', v_debt,
      'limits', public.billing_plan_limits('free'),
      'features', public.billing_plan_features('free')
    );
  end if;

  return jsonb_build_object(
    'plan_id', 'free',
    'source', 'free',
    'status', 'free',
    'paid_through', null,
    'grace_ends_at', null,
    'current_term_id', null,
    'grant_id', null,
    'debt_cents', v_debt,
    'limits', public.billing_plan_limits('free'),
    'features', public.billing_plan_features('free')
  );
end;
$$;

revoke all on function public.billing_resolve_team(uuid, timestamptz) from public;
grant execute on function public.billing_resolve_team(uuid, timestamptz) to authenticated, service_role;

create or replace function public.billing_refresh_team(p_team uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_plan text;
  v_plan_source text;
  v_access jsonb;
  v_last_end timestamptz;
  v_last_plan text;
  v_monthly numeric;
  v_months int := 0;
  v_debt bigint := 0;
  v_debt_paid bigint := 0;
  v_status text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'NOT_ALLOWED';
  end if;

  select plan_id, plan_source into v_team_plan, v_plan_source
  from public.teams where id = p_team for update;
  if v_team_plan is null then
    raise exception 'NOT_FOUND';
  end if;

  insert into public.team_billing (team_id, effective_plan_id, status)
  values (p_team, v_team_plan, case when v_team_plan = 'free' then 'free' else 'active' end)
  on conflict (team_id) do nothing;

  if v_plan_source = 'manual' then
    update public.team_billing
    set effective_plan_id = v_team_plan,
        status = case when v_team_plan = 'free' then 'free' else 'active' end,
        lapsed_at = null,
        debt_cents = 0,
        debt_paid_cents = 0,
        updated_at = now()
    where team_id = p_team;
    return public.billing_resolve_team(p_team, now());
  end if;

  v_access := public.billing_resolve_team(p_team, now());
  v_status := v_access->>'status';

  select max(st.ends_at) into v_last_end
  from public.subscription_terms st
  where st.team_id = p_team and st.status <> 'cancelled';

  select coalesce(debt_paid_cents, 0) into v_debt_paid
  from public.team_billing where team_id = p_team;

  if v_last_end is not null and v_last_end < now() then
    select st.plan_id into v_last_plan
    from public.subscription_terms st
    where st.team_id = p_team and st.status <> 'cancelled'
    order by st.ends_at desc
    limit 1;

    select price_usd_monthly into v_monthly from public.plans where id = v_last_plan;
    v_months := greatest(0, ceil(extract(epoch from age(now(), v_last_end)) / 2592000.0)::int);
    v_debt := v_months * coalesce(round(v_monthly * 100)::bigint, 0);
    v_debt := greatest(0, v_debt - v_debt_paid);
  end if;

  update public.team_billing
  set status = v_status,
      effective_plan_id = v_access->>'plan_id',
      paid_through = nullif(v_access->>'paid_through', '')::timestamptz,
      grace_ends_at = nullif(v_access->>'grace_ends_at', '')::timestamptz,
      lapsed_at = case when v_status = 'lapsed' then coalesce(lapsed_at, now()) else null end,
      debt_cents = v_debt,
      updated_at = now()
  where team_id = p_team;

  update public.teams
  set plan_id = v_access->>'plan_id',
      plan_source = case when v_access->>'source' = 'paid' then 'billing' else 'default' end
  where id = p_team and plan_source <> 'manual';

  return public.billing_resolve_team(p_team, now());
end;
$$;

revoke all on function public.billing_refresh_team(uuid) from public;
grant execute on function public.billing_refresh_team(uuid) to service_role;

create or replace function public.billing_next_invoice_number(p_year int default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year int := coalesce(p_year, extract(year from now())::int);
  v_number int;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'NOT_ALLOWED';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('billing-invoice:' || v_year::text, 0));
  insert into public.invoice_counters (year, last_number)
  values (v_year, 1)
  on conflict (year) do update set last_number = public.invoice_counters.last_number + 1
  returning last_number into v_number;
  return 'GO-' || v_year::text || '-' || lpad(v_number::text, 6, '0');
end;
$$;

revoke all on function public.billing_next_invoice_number(int) from public;
grant execute on function public.billing_next_invoice_number(int) to service_role;

create or replace function public.billing_create_invoice(
  p_team uuid,
  p_kind text,
  p_plan text,
  p_months int,
  p_currency text,
  p_exchange_rate numeric,
  p_subtotal_cents bigint,
  p_discount_cents bigint,
  p_tax_cents bigint,
  p_total_cents bigint,
  p_coverage_start timestamptz,
  p_coverage_end timestamptz,
  p_due_at timestamptz,
  p_expires_at timestamptz,
  p_coupon_code text default null,
  p_description text default 'Plan payment',
  p_notes text default null,
  p_created_by uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice public.invoices%rowtype;
  v_number text;
  v_coupon public.coupons%rowtype;
  v_team public.teams%rowtype;
  v_billing public.team_billing%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'NOT_ALLOWED';
  end if;
  if p_kind not in ('subscription','renewal','upgrade','debt','manual') then
    raise exception 'BAD_KIND';
  end if;
  if p_total_cents <> p_subtotal_cents - p_discount_cents + p_tax_cents then
    raise exception 'BAD_TOTAL';
  end if;
  if p_total_cents < 0 or p_discount_cents < 0 or p_tax_cents < 0 or p_subtotal_cents < 0 then
    raise exception 'BAD_TOTAL';
  end if;

  select * into v_team from public.teams where id = p_team;
  if v_team.id is null then
    raise exception 'NOT_FOUND';
  end if;
  if p_plan is not null and not exists (select 1 from public.plans where id = p_plan) then
    raise exception 'BAD_PLAN';
  end if;
  if p_months is not null and p_months not in (1, 6, 12, 24, 36, 48, 60) then
    raise exception 'BAD_TERM';
  end if;

  select * into v_billing from public.team_billing where team_id = p_team;

  if p_coupon_code is not null and length(trim(p_coupon_code)) > 0 then
    select * into v_coupon from public.coupons
    where code = upper(trim(p_coupon_code)) and active = true;
    if v_coupon.id is null then
      raise exception 'COUPON_INVALID';
    end if;
  end if;

  v_number := public.billing_next_invoice_number(extract(year from now())::int);

  insert into public.invoices (
    team_id, number, status, kind, plan_id, months, currency, exchange_rate,
    subtotal_cents, discount_cents, tax_cents, total_cents,
    coverage_start, coverage_end, due_at, expires_at, coupon_code,
    billing_email, billing_name, country_code, notes, metadata, created_by
  ) values (
    p_team, v_number, 'open', p_kind, p_plan, p_months, upper(coalesce(p_currency, 'USD')), coalesce(p_exchange_rate, 1),
    p_subtotal_cents, p_discount_cents, p_tax_cents, p_total_cents,
    p_coverage_start, p_coverage_end,
    coalesce(p_due_at, now()), coalesce(p_expires_at, now() + make_interval(days => 14)),
    case when v_coupon.id is null then null else v_coupon.code end,
    v_billing.billing_email, v_billing.billing_name, v_billing.country_code,
    p_notes, coalesce(p_metadata, '{}'::jsonb), p_created_by
  ) returning * into v_invoice;

  insert into public.invoice_lines (invoice_id, description, quantity, unit_amount_cents, amount_cents, sort)
  values (v_invoice.id, coalesce(p_description, 'Plan payment'), 1, p_subtotal_cents, p_subtotal_cents, 1);

  if v_coupon.id is not null then
    insert into public.coupon_redemptions (coupon_id, team_id, invoice_id, status)
    values (v_coupon.id, p_team, v_invoice.id, 'reserved')
    on conflict (invoice_id) do nothing;
  end if;

  insert into public.billing_ledger (team_id, invoice_id, kind, amount_cents, currency, description, metadata, created_by)
  values (p_team, v_invoice.id, 'invoice_created', 0, upper(coalesce(p_currency, 'USD')), 'Invoice created', '{}'::jsonb, p_created_by);

  return jsonb_build_object(
    'id', v_invoice.id,
    'number', v_invoice.number,
    'status', v_invoice.status,
    'total_cents', v_invoice.total_cents,
    'currency', v_invoice.currency
  );
end;
$$;

revoke all on function public.billing_create_invoice(uuid, text, text, int, text, numeric, bigint, bigint, bigint, bigint, timestamptz, timestamptz, timestamptz, timestamptz, text, text, text, uuid, jsonb) from public;
grant execute on function public.billing_create_invoice(uuid, text, text, int, text, numeric, bigint, bigint, bigint, bigint, timestamptz, timestamptz, timestamptz, timestamptz, text, text, text, uuid, jsonb) to service_role;

create or replace function public.billing_confirm_payment(
  p_provider text,
  p_provider_reference text,
  p_merchant_reference text,
  p_amount_cents bigint,
  p_currency text,
  p_method text default null,
  p_confirmation_code text default null,
  p_paid_at timestamptz default now(),
  p_event_key text default null,
  p_event_type text default 'IPNCHANGE',
  p_summary jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt public.payment_attempts%rowtype;
  v_invoice public.invoices%rowtype;
  v_payment public.payments%rowtype;
  v_term public.subscription_terms%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'NOT_ALLOWED';
  end if;

  select * into v_attempt from public.payment_attempts
  where merchant_reference = p_merchant_reference
  for update;
  if v_attempt.id is null then
    if p_event_key is not null then
      insert into public.payment_events (provider, event_key, event_type, order_tracking_id, merchant_reference, status_received, payload_summary, processed_at, error)
      values (p_provider, p_event_key, p_event_type, p_provider_reference, p_merchant_reference, 'unknown_attempt', coalesce(p_summary, '{}'::jsonb), now(), 'No matching payment attempt')
      on conflict (provider, event_key) do nothing;
    end if;
    return jsonb_build_object('status', 'ignored', 'reason', 'unknown_attempt');
  end if;

  select * into v_payment from public.payments
  where provider_reference = p_provider_reference;
  if v_payment.id is not null then
    return jsonb_build_object('status', 'duplicate', 'payment_id', v_payment.id, 'invoice_id', v_payment.invoice_id);
  end if;

  select * into v_invoice from public.invoices where id = v_attempt.invoice_id for update;
  if v_invoice.id is null then
    return jsonb_build_object('status', 'ignored', 'reason', 'invoice_missing');
  end if;
  if v_invoice.status = 'paid' then
    return jsonb_build_object('status', 'duplicate', 'invoice_id', v_invoice.id);
  end if;
  if v_invoice.status not in ('open','payment_pending') then
    return jsonb_build_object('status', 'ignored', 'reason', 'invoice_' || v_invoice.status);
  end if;

  if p_amount_cents <> v_invoice.total_cents
     or upper(p_currency) <> v_invoice.currency then
    insert into public.billing_review_items (team_id, invoice_id, kind, details)
    values (
      v_invoice.team_id, v_invoice.id, 'amount_mismatch',
      jsonb_build_object(
        'expected_amount_cents', v_invoice.total_cents,
        'received_amount_cents', p_amount_cents,
        'expected_currency', v_invoice.currency,
        'received_currency', upper(p_currency),
        'provider_reference', p_provider_reference,
        'merchant_reference', p_merchant_reference
      )
    );
    if p_event_key is not null then
      insert into public.payment_events (provider, event_key, event_type, order_tracking_id, merchant_reference, status_received, payload_summary, processed_at, error)
      values (p_provider, p_event_key, p_event_type, p_provider_reference, p_merchant_reference, 'review', coalesce(p_summary, '{}'::jsonb), now(), 'Amount or currency mismatch')
      on conflict (provider, event_key) do nothing;
    end if;
    return jsonb_build_object('status', 'review', 'invoice_id', v_invoice.id);
  end if;

  insert into public.payments (
    team_id, invoice_id, attempt_id, provider, provider_reference,
    merchant_reference, amount_cents, currency, status, method,
    confirmation_code, paid_at, summary
  ) values (
    v_invoice.team_id, v_invoice.id, v_attempt.id, p_provider, p_provider_reference,
    p_merchant_reference, p_amount_cents, upper(p_currency), 'confirmed', p_method,
    p_confirmation_code, coalesce(p_paid_at, now()), coalesce(p_summary, '{}'::jsonb)
  ) returning * into v_payment;

  update public.payment_attempts
  set status = 'confirmed', provider_reference = p_provider_reference, updated_at = now()
  where id = v_attempt.id;

  update public.invoices
  set status = 'paid', amount_paid_cents = total_cents, paid_at = coalesce(p_paid_at, now()), updated_at = now()
  where id = v_invoice.id
  returning * into v_invoice;

  if v_invoice.kind in ('subscription','renewal','upgrade')
     and v_invoice.coverage_start is not null
     and v_invoice.coverage_end is not null
     and v_invoice.plan_id is not null
     and v_invoice.months is not null then
    insert into public.subscription_terms (team_id, invoice_id, plan_id, months, starts_at, ends_at, status)
    values (
      v_invoice.team_id, v_invoice.id, v_invoice.plan_id, v_invoice.months,
      v_invoice.coverage_start, v_invoice.coverage_end,
      case when v_invoice.coverage_start > now() then 'upcoming' else 'active' end
    )
    on conflict (invoice_id) do nothing
    returning * into v_term;
  end if;

  update public.coupon_redemptions
  set status = 'redeemed', redeemed_at = now()
  where invoice_id = v_invoice.id and status = 'reserved';

  insert into public.billing_ledger (team_id, invoice_id, payment_id, kind, amount_cents, currency, description, metadata)
  values (
    v_invoice.team_id, v_invoice.id, v_payment.id, 'payment_confirmed',
    v_payment.amount_cents, v_payment.currency, 'Payment received',
    jsonb_build_object('provider', p_provider, 'provider_reference', p_provider_reference)
  );

  if p_event_key is not null then
    insert into public.payment_events (provider, event_key, event_type, order_tracking_id, merchant_reference, status_received, payload_summary, processed_at)
    values (p_provider, p_event_key, p_event_type, p_provider_reference, p_merchant_reference, 'confirmed', coalesce(p_summary, '{}'::jsonb), now())
    on conflict (provider, event_key) do nothing;
  end if;

  if v_invoice.kind = 'debt' then
    update public.team_billing
    set debt_paid_cents = debt_paid_cents + v_invoice.total_cents,
        updated_at = now()
    where team_id = v_invoice.team_id;
  end if;

  if v_term.id is not null then
    update public.team_billing
    set debt_paid_cents = 0, updated_at = now()
    where team_id = v_invoice.team_id;
  end if;

  update public.team_billing
  set last_payment_at = coalesce(p_paid_at, now()), updated_at = now()
  where team_id = v_invoice.team_id;

  perform public.billing_refresh_team(v_invoice.team_id);

  perform public.log_team_activity(
    v_invoice.team_id, null, 'Get-On Billing', null, 'system', 'billing', 'payment_confirmed',
    format('Payment of %s %s received', v_invoice.currency, to_char(v_invoice.total_cents / 100.0, 'FM999999990.00')),
    null, null, 'invoice', v_invoice.id, v_invoice.number, null,
    jsonb_build_object('provider', p_provider, 'invoice_number', v_invoice.number, 'amount_cents', v_invoice.total_cents),
    null, 0
  );

  return jsonb_build_object(
    'status', 'confirmed',
    'payment_id', v_payment.id,
    'invoice_id', v_invoice.id,
    'invoice_number', v_invoice.number,
    'term_id', v_term.id
  );
end;
$$;

revoke all on function public.billing_confirm_payment(text, text, text, bigint, text, text, text, timestamptz, text, text, jsonb) from public;
grant execute on function public.billing_confirm_payment(text, text, text, bigint, text, text, text, timestamptz, text, text, jsonb) to service_role;

create or replace function public.billing_void_invoice(
  p_invoice uuid,
  p_reason text,
  p_actor uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice public.invoices%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'NOT_ALLOWED';
  end if;
  if p_reason is null or length(trim(p_reason)) < 3 then
    raise exception 'REASON_REQUIRED';
  end if;
  select * into v_invoice from public.invoices where id = p_invoice for update;
  if v_invoice.id is null then raise exception 'NOT_FOUND'; end if;
  if v_invoice.status = 'paid' then raise exception 'PAID_INVOICE_IMMUTABLE'; end if;
  if v_invoice.status = 'void' then
    return jsonb_build_object('ok', true, 'status', 'void');
  end if;

  update public.invoices
  set status = 'void', voided_at = now(), void_reason = p_reason, updated_at = now()
  where id = p_invoice;

  update public.coupon_redemptions
  set status = 'released', released_at = now()
  where invoice_id = p_invoice and status = 'reserved';

  insert into public.billing_ledger (team_id, invoice_id, kind, amount_cents, currency, description, metadata, created_by)
  values (v_invoice.team_id, v_invoice.id, 'invoice_voided', 0, v_invoice.currency, 'Invoice cancelled', jsonb_build_object('reason', p_reason), p_actor);

  perform public.log_team_activity(
    v_invoice.team_id, p_actor, 'Get-On support', null, 'support', 'billing', 'invoice_voided',
    format('Invoice %s was cancelled', v_invoice.number),
    null, null, 'invoice', v_invoice.id, v_invoice.number, null,
    jsonb_build_object('reason', p_reason), null, 0
  );

  return jsonb_build_object('ok', true, 'status', 'void');
end;
$$;

revoke all on function public.billing_void_invoice(uuid, text, uuid) from public;
grant execute on function public.billing_void_invoice(uuid, text, uuid) to service_role;

-- 8. Guards and bootstrap ---------------------------------------------------

create or replace function public.billing_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists billing_settings_updated_at on public.billing_settings;
create trigger billing_settings_updated_at
  before update on public.billing_settings
  for each row execute function public.billing_set_updated_at();

drop trigger if exists team_billing_updated_at on public.team_billing;
create trigger team_billing_updated_at
  before update on public.team_billing
  for each row execute function public.billing_set_updated_at();

drop trigger if exists invoices_updated_at on public.invoices;
create trigger invoices_updated_at
  before update on public.invoices
  for each row execute function public.billing_set_updated_at();

drop trigger if exists payment_attempts_updated_at on public.payment_attempts;
create trigger payment_attempts_updated_at
  before update on public.payment_attempts
  for each row execute function public.billing_set_updated_at();

create or replace function public.billing_invoice_guard()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'paid' then
      raise exception 'PAID_INVOICE_IMMUTABLE';
    end if;
    return old;
  end if;
  if old.status in ('paid', 'refunded', 'partly_refunded') then
    -- A settled invoice can only move between paid and refund states. Every
    -- money field stays exactly as it was; the refund itself is recorded in
    -- payments, refunds and the ledger.
    if new.status in ('paid', 'refunded', 'partly_refunded')
       and (to_jsonb(new) - 'status' - 'updated_at')
         = (to_jsonb(old) - 'status' - 'updated_at') then
      return new;
    end if;
    raise exception 'PAID_INVOICE_IMMUTABLE';
  end if;
  return new;
end;
$$;

drop trigger if exists invoices_paid_guard on public.invoices;
create trigger invoices_paid_guard
  before update or delete on public.invoices
  for each row execute function public.billing_invoice_guard();

create or replace function public.billing_ledger_guard()
returns trigger
language plpgsql
as $$
begin
  raise exception 'LEDGER_APPEND_ONLY';
end;
$$;

drop trigger if exists billing_ledger_append_only on public.billing_ledger;
create trigger billing_ledger_append_only
  before update or delete on public.billing_ledger
  for each row execute function public.billing_ledger_guard();

create or replace function public.billing_bootstrap_team()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.team_billing (team_id, effective_plan_id, status)
  values (new.id, new.plan_id, case when new.plan_id = 'free' then 'free' else 'active' end)
  on conflict (team_id) do nothing;
  return new;
end;
$$;

drop trigger if exists teams_billing_bootstrap on public.teams;
create trigger teams_billing_bootstrap
  after insert on public.teams
  for each row execute function public.billing_bootstrap_team();

create or replace function public.billing_sync_manual_plan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.plan_source = 'manual' and (old.plan_id is distinct from new.plan_id or old.plan_source is distinct from new.plan_source) then
    insert into public.team_billing (team_id, effective_plan_id, status)
    values (new.id, new.plan_id, case when new.plan_id = 'free' then 'free' else 'active' end)
    on conflict (team_id) do update
      set effective_plan_id = excluded.effective_plan_id,
          status = excluded.status,
          lapsed_at = null,
          debt_cents = 0,
          updated_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists teams_billing_manual_sync on public.teams;
create trigger teams_billing_manual_sync
  after update of plan_id, plan_source on public.teams
  for each row execute function public.billing_sync_manual_plan();

-- 9. Backfill ---------------------------------------------------------------

insert into public.team_billing (team_id, effective_plan_id, status)
select t.id, t.plan_id, case when t.plan_id = 'free' then 'free' else 'active' end
from public.teams t
on conflict (team_id) do nothing;

insert into public.access_grants (team_id, plan_id, starts_at, ends_at, source, note)
select t.id, t.plan_id, now(), null, 'migration', 'Plan preserved when billing was introduced'
from public.teams t
where t.plan_id <> 'free'
  and not exists (
    select 1 from public.access_grants g
    where g.team_id = t.id and g.revoked_at is null
  )
  and not exists (
    select 1 from public.subscription_terms st where st.team_id = t.id
  );

