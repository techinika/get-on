-- Metadata reads and staff-callable writes for the remaining console screens:
-- domains, billing, AI, referrals and the website record. Every function
-- checks a staff permission and writes to staff_audit_log for changes.
-- Customer content is never selected.

-- These screens audit the record types they change, so the shared target list
-- has to know about them. `not valid` keeps any pre-existing audit rows intact.
alter table public.staff_audit_log
  drop constraint if exists staff_audit_log_target_check;
alter table public.staff_audit_log
  add constraint staff_audit_log_target_check check (
    target_type in (
      'staff', 'team', 'project', 'page', 'website', 'domain', 'billing',
      'invoice', 'payment', 'ai', 'email', 'marketing', 'consent', 'approval',
      'support_case', 'abuse', 'demo', 'setting', 'report', 'job',
      'coupon', 'billing_review', 'ai_model', 'referral'
    )
  ) not valid;

-- Domains -------------------------------------------------------------------

create or replace function public.admin_domains()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.staff_assert('domain.view');
  return jsonb_build_object(
    'domains', coalesce((
      select jsonb_agg(
        to_jsonb(d) || jsonb_build_object(
          'team_name', d.team_name,
          'owner_email', d.owner_email,
          'project_name', d.project_name,
          'project_subdomain', d.project_subdomain
        )
      )
      from (
        select
          d0.*,
          t.name as team_name,
          public.mask_email(o.email) as owner_email,
          p.name as project_name,
          p.subdomain as project_subdomain
        from public.domains d0
        left join public.teams t on t.id = d0.team_id
        left join public.profiles o on o.id = t.owner_id
        left join public.projects p on p.id = d0.project_id
        where d0.status <> 'removed'
        order by d0.created_at desc
      ) d
    ), '[]'::jsonb),
    'hostnames', coalesce((
      select jsonb_agg(to_jsonb(h))
      from (
        select *
        from public.domain_hostnames
        where status <> 'removed'
        order by created_at asc
      ) h
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.admin_domain(p_domain_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_row jsonb;
begin
  perform public.staff_assert('domain.view');

  select to_jsonb(d) || jsonb_build_object(
    'team_name', d.team_name,
    'owner_email', d.owner_email,
    'project_name', d.project_name,
    'project_subdomain', d.project_subdomain
  )
  into v_row
  from (
    select
      d0.*,
      t.name as team_name,
      public.mask_email(o.email) as owner_email,
      p.name as project_name,
      p.subdomain as project_subdomain
    from public.domains d0
    left join public.teams t on t.id = d0.team_id
    left join public.profiles o on o.id = t.owner_id
    left join public.projects p on p.id = d0.project_id
    where d0.id = p_domain_id
  ) d;

  if v_row is null then
    return null;
  end if;

  return jsonb_build_object(
    'domain', v_row,
    'hostnames', coalesce((
      select jsonb_agg(to_jsonb(h) order by h.created_at asc)
      from public.domain_hostnames h
      where h.domain_id = p_domain_id
        and h.status <> 'removed'
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(to_jsonb(e) order by e.created_at desc)
      from (
        select id, hostname_id, event, summary, created_at
        from public.domain_events
        where domain_id = p_domain_id
        order by created_at desc
        limit 200
      ) e
    ), '[]'::jsonb),
    'targets', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', t.id, 'name', t.name, 'teamName', t.team_name)
        order by t.name
      )
      from (
        select p.id, p.name, coalesce(tm.name, 'Team') as team_name
        from public.projects p
        left join public.teams tm on tm.id = p.team_id
        join public.domains d on d.id = p_domain_id
        where p.deleted_at is null
          and p.team_id <> d.team_id
        order by p.name
        limit 500
      ) t
    ), '[]'::jsonb)
  );
end;
$$;

-- Billing -------------------------------------------------------------------

create or replace function public.admin_billing_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.staff_assert('billing.view');
  return jsonb_build_object(
    'settings', (select to_jsonb(s) from public.billing_settings s where s.id = 1),
    'terms', coalesce((
      select jsonb_agg(to_jsonb(t) order by t.sort)
      from public.billing_terms t
    ), '[]'::jsonb),
    'coupons', coalesce((
      select jsonb_agg(to_jsonb(c) order by c.created_at desc)
      from (
        select *
        from public.coupons
        order by created_at desc
        limit 100
      ) c
    ), '[]'::jsonb),
    'grants', coalesce((
      select jsonb_agg(to_jsonb(g) order by g.created_at desc)
      from (
        select id, team_id, plan_id, starts_at, ends_at, source, note, created_at
        from public.access_grants
        where revoked_at is null
        order by created_at desc
        limit 100
      ) g
    ), '[]'::jsonb),
    'teams', coalesce((
      select jsonb_agg(to_jsonb(t) order by t.name)
      from (
        select id, name, plan_id
        from public.teams
        order by name
        limit 500
      ) t
    ), '[]'::jsonb),
    'plans', coalesce((
      select jsonb_agg(to_jsonb(p) order by p.plan_rank)
      from (
        select id, name, "rank" as plan_rank
        from public.plans
        order by "rank"
      ) p
    ), '[]'::jsonb),
    'reviews', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.created_at)
      from (
        select id, team_id, invoice_id, kind, details, created_at
        from public.billing_review_items
        where status = 'open'
        order by created_at
        limit 50
      ) r
    ), '[]'::jsonb),
    'invoices', coalesce((
      select jsonb_agg(to_jsonb(i) order by i.created_at desc)
      from (
        select id, team_id, number, status, total_cents, currency, created_at, expires_at
        from public.invoices
        order by created_at desc
        limit 30
      ) i
    ), '[]'::jsonb),
    'payments', coalesce((
      select jsonb_agg(to_jsonb(p) order by p.paid_at desc nulls last)
      from (
        select id, team_id, invoice_id, amount_cents, currency, status, method, paid_at
        from public.payments
        order by paid_at desc nulls last
        limit 30
      ) p
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.admin_billing_set_settings(
  p_currency text,
  p_grace_days int,
  p_reminder_days int[],
  p_invoice_expiry_days int,
  p_max_unpaid_invoices int,
  p_tax_rate_bps int,
  p_pesapal_ipn_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_currency text := upper(trim(coalesce(p_currency, 'USD')));
  v_reminders int[] := p_reminder_days;
begin
  perform public.staff_assert('billing.price.manage');
  if v_currency !~ '^[A-Z]{3}$' then
    raise exception 'INVALID_CURRENCY';
  end if;
  if v_reminders is null or cardinality(v_reminders) = 0 then
    v_reminders := array[30, 7, 1];
  end if;

  update public.billing_settings
  set default_currency = v_currency,
      grace_days = greatest(0, least(coalesce(p_grace_days, 7), 365)),
      reminder_days = v_reminders,
      invoice_expiry_days = greatest(1, least(coalesce(p_invoice_expiry_days, 14), 365)),
      max_unpaid_invoices = greatest(1, least(coalesce(p_max_unpaid_invoices, 3), 50)),
      tax_rate_bps = greatest(0, least(coalesce(p_tax_rate_bps, 0), 10000)),
      pesapal_ipn_id = nullif(trim(coalesce(p_pesapal_ipn_id, '')), ''),
      updated_at = now()
  where id = 1;

  perform public.staff_audit(
    'billing.settings_changed', 'billing', 'settings', null, null, null,
    jsonb_build_object('currency', v_currency, 'grace_days', p_grace_days)
  );
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.admin_billing_set_term(
  p_months int,
  p_discount_bps int,
  p_label text,
  p_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.staff_assert('billing.price.manage');
  if p_months not in (1, 6, 12, 24, 36, 48, 60) then
    raise exception 'INVALID_TERM';
  end if;

  update public.billing_terms
  set discount_bps = greatest(0, least(coalesce(p_discount_bps, 0), 10000)),
      label = coalesce(nullif(trim(p_label), ''), p_months || ' months'),
      active = coalesce(p_active, true)
  where months = p_months;

  perform public.staff_audit(
    'billing.term_changed', 'billing', p_months::text, null, null, null,
    jsonb_build_object('months', p_months, 'discount_bps', p_discount_bps, 'active', p_active)
  );
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.admin_billing_create_coupon(
  p_code text,
  p_percent_off_bps int,
  p_amount_off_cents bigint,
  p_plan_ids text[],
  p_min_months int,
  p_first_purchase_only boolean,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_max_redemptions int,
  p_per_team_limit int
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := upper(trim(coalesce(p_code, '')));
  v_id uuid;
begin
  perform public.staff_assert('billing.coupon.create');
  if v_code !~ '^[A-Z0-9_-]{2,40}$' then
    raise exception 'INVALID_CODE';
  end if;
  if (coalesce(p_percent_off_bps, 0) > 0) = (coalesce(p_amount_off_cents, 0) > 0) then
    raise exception 'CHOOSE_ONE_DISCOUNT';
  end if;

  insert into public.coupons (
    code, active, percent_off_bps, amount_off_cents, plan_ids, min_months,
    first_purchase_only, starts_at, ends_at, max_redemptions, per_team_limit,
    created_by
  ) values (
    v_code,
    true,
    nullif(greatest(0, least(coalesce(p_percent_off_bps, 0), 10000)), 0),
    nullif(greatest(0, coalesce(p_amount_off_cents, 0)), 0),
    case when p_plan_ids is null or cardinality(p_plan_ids) = 0 then null else p_plan_ids end,
    nullif(p_min_months, 0),
    coalesce(p_first_purchase_only, false),
    p_starts_at,
    p_ends_at,
    nullif(p_max_redemptions, 0),
    nullif(p_per_team_limit, 0),
    auth.uid()
  )
  returning id into v_id;

  perform public.staff_audit(
    'billing.coupon_created', 'coupon', v_id::text, null, null, null,
    jsonb_build_object('code', v_code)
  );
  return jsonb_build_object('ok', true, 'id', v_id);
exception
  when unique_violation then
    raise exception 'COUPON_EXISTS';
end;
$$;

create or replace function public.admin_billing_toggle_coupon(
  p_id uuid,
  p_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.staff_assert('billing.coupon.create');
  update public.coupons set active = coalesce(p_active, false) where id = p_id;
  if not found then
    raise exception 'COUPON_NOT_FOUND';
  end if;
  perform public.staff_audit(
    'billing.coupon_status', 'coupon', p_id::text, null, null, null,
    jsonb_build_object('active', p_active)
  );
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.admin_billing_create_grant(
  p_team uuid,
  p_plan text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  perform public.staff_assert('access.free.direct');
  if p_note is null or length(trim(p_note)) < 3 then
    raise exception 'NOTE_REQUIRED';
  end if;
  if not exists (select 1 from public.teams where id = p_team) then
    raise exception 'TEAM_NOT_FOUND';
  end if;
  if not exists (select 1 from public.plans where id = p_plan) then
    raise exception 'PLAN_NOT_FOUND';
  end if;

  insert into public.access_grants (
    team_id, plan_id, starts_at, ends_at, source, note, created_by
  ) values (
    p_team, p_plan, coalesce(p_starts_at, now()), p_ends_at,
    'support', trim(p_note), auth.uid()
  )
  returning id into v_id;

  perform public.staff_audit(
    'billing.grant_created', 'team', p_team::text, null, trim(p_note), null,
    jsonb_build_object('grant', v_id, 'plan', p_plan)
  );
  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

create or replace function public.admin_billing_revoke_grant(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team uuid;
begin
  perform public.staff_assert('access.free.direct');
  update public.access_grants
  set revoked_at = now(), revoked_by = auth.uid()
  where id = p_id and revoked_at is null
  returning team_id into v_team;
  if v_team is null then
    raise exception 'GRANT_NOT_FOUND';
  end if;
  perform public.staff_audit(
    'billing.grant_revoked', 'team', v_team::text, null, null, null,
    jsonb_build_object('grant', p_id)
  );
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.admin_billing_void_invoice(
  p_invoice uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice public.invoices%rowtype;
begin
  perform public.staff_assert('billing.invoice.void.direct');
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
  set status = 'void', voided_at = now(), void_reason = trim(p_reason), updated_at = now()
  where id = p_invoice;

  update public.coupon_redemptions
  set status = 'released', released_at = now()
  where invoice_id = p_invoice and status = 'reserved';

  insert into public.billing_ledger (
    team_id, invoice_id, kind, amount_cents, currency, description, metadata, created_by
  ) values (
    v_invoice.team_id, v_invoice.id, 'invoice_voided', 0, v_invoice.currency,
    'Invoice cancelled', jsonb_build_object('reason', trim(p_reason)), auth.uid()
  );

  perform public.log_team_activity(
    v_invoice.team_id, auth.uid(), 'Get-On support', null, 'support', 'billing',
    'invoice_voided',
    format('Invoice %s was cancelled', v_invoice.number),
    null, null, 'invoice', v_invoice.id, v_invoice.number, null,
    jsonb_build_object('reason', trim(p_reason)), null, 0
  );

  perform public.staff_audit(
    'billing.invoice_voided', 'invoice', p_invoice::text, null, trim(p_reason)
  );
  return jsonb_build_object('ok', true, 'status', 'void');
end;
$$;

create or replace function public.admin_billing_resolve_review(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.staff_assert('billing.payment_status');
  update public.billing_review_items
  set status = 'resolved', resolved_at = now(), resolved_by = auth.uid()
  where id = p_id and status = 'open';
  if not found then
    raise exception 'REVIEW_NOT_FOUND';
  end if;
  perform public.staff_audit(
    'billing.review_resolved', 'billing_review', p_id::text
  );
  return jsonb_build_object('ok', true);
end;
$$;

-- AI ------------------------------------------------------------------------

create or replace function public.admin_ai_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.staff_assert('ai.view');
  return jsonb_build_object(
    'settings', (select to_jsonb(s) from public.ai_settings s where s.id = true),
    'models', coalesce((
      select jsonb_agg(to_jsonb(m) order by m.id)
      from public.ai_models m
    ), '[]'::jsonb),
    'daily', coalesce((
      select jsonb_agg(to_jsonb(d) order by d.day desc)
      from (
        select day, credits, neurons, requests
        from public.ai_usage_platform_daily
        where day >= (current_date - interval '6 days')
        order by day desc
      ) d
    ), '[]'::jsonb),
    'failures', (
      select count(*)
      from public.ai_requests
      where status in ('failed', 'refused')
        and created_at >= now() - interval '7 days'
    ),
    'requests_7d', (
      select count(*)
      from public.ai_requests
      where created_at >= now() - interval '7 days'
    )
  );
end;
$$;

create or replace function public.admin_ai_save_settings(
  p_enabled boolean,
  p_images_enabled boolean,
  p_moderation_enabled boolean,
  p_credit_neurons int,
  p_daily_cap_credits int,
  p_free_grant_credits int,
  p_max_prompt_chars int,
  p_payload_retention_days int,
  p_gateway_id text,
  p_default_language text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_language text := lower(trim(coalesce(p_default_language, 'en')));
begin
  perform public.staff_assert('ai.settings');
  if p_credit_neurons not between 1 and 100000 then raise exception 'CREDIT_NEURONS'; end if;
  if p_daily_cap_credits not between 0 and 1000000 then raise exception 'DAILY_CAP'; end if;
  if p_free_grant_credits not between 0 and 10000 then raise exception 'FREE_GRANT'; end if;
  if p_max_prompt_chars not between 100 and 200000 then raise exception 'PROMPT_CHARS'; end if;
  if p_payload_retention_days not between 1 and 365 then raise exception 'RETENTION'; end if;
  if length(coalesce(p_gateway_id, '')) > 120 then raise exception 'GATEWAY'; end if;
  if v_language !~ '^[a-z]{2}(-[a-z]{2})?$' then raise exception 'LANGUAGE'; end if;

  update public.ai_settings
  set enabled = coalesce(p_enabled, false),
      images_enabled = coalesce(p_images_enabled, false),
      moderation_enabled = coalesce(p_moderation_enabled, true),
      credit_neurons = p_credit_neurons,
      daily_cap_credits = p_daily_cap_credits,
      free_grant_credits = p_free_grant_credits,
      max_prompt_chars = p_max_prompt_chars,
      payload_retention_days = p_payload_retention_days,
      gateway_id = nullif(trim(coalesce(p_gateway_id, '')), ''),
      default_language = v_language,
      updated_by = auth.uid(),
      updated_at = now()
  where id = true;

  perform public.staff_audit(
    'ai.settings_changed', 'ai', 'settings', null, null, null,
    jsonb_build_object(
      'enabled', p_enabled,
      'images_enabled', p_images_enabled,
      'moderation_enabled', p_moderation_enabled,
      'daily_cap_credits', p_daily_cap_credits,
      'free_grant_credits', p_free_grant_credits
    )
  );
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.admin_ai_toggle_model(
  p_model text,
  p_enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.staff_assert('ai.settings');
  update public.ai_models
  set enabled = coalesce(p_enabled, false), updated_at = now()
  where id = p_model;
  if not found then
    raise exception 'MODEL_NOT_FOUND';
  end if;
  perform public.staff_audit(
    case when p_enabled then 'ai.model_enabled' else 'ai.model_disabled' end,
    'ai_model', p_model, null, null, null,
    jsonb_build_object('model', p_model)
  );
  return jsonb_build_object('ok', true);
end;
$$;

-- Only aggregate accuracy is exposed. Request text and AI output stay out of
-- the console.
create or replace function public.admin_ai_design_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_since timestamptz := now() - interval '30 days';
begin
  perform public.staff_assert('ai.view');
  return (
    select jsonb_build_object(
      'checks', count(*),
      'average', coalesce(avg(r.accuracy), 0),
      'unmet', coalesce(sum(
        case when jsonb_typeof(r.unmet) = 'array' then jsonb_array_length(r.unmet) else 0 end
      ), 0),
      'unsupported', coalesce(sum(
        case when jsonb_typeof(r.unsupported) = 'array' then jsonb_array_length(r.unsupported) else 0 end
      ), 0),
      'applied', (
        select count(*)
        from public.ai_design_history h
        where h.applied_at is not null and h.created_at >= v_since
      ),
      'archetypes', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'name', a.archetype,
            'total', a.total,
            'accuracy', a.accuracy
          ) order by a.total desc
        )
        from (
          select coalesce(archetype, 'unknown') as archetype,
                 count(*) as total,
                 avg(accuracy) as accuracy
          from public.ai_design_reports
          where created_at >= v_since
          group by coalesce(archetype, 'unknown')
        ) a
      ), '[]'::jsonb)
    )
    from public.ai_design_reports r
    where r.created_at >= v_since
  );
end;
$$;

-- Referrals -----------------------------------------------------------------

create or replace function public.admin_referrals()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.staff_assert('marketing.view');
  return jsonb_build_object(
    'settings', (select to_jsonb(s) from public.referral_settings s where s.id = 1),
    'referrals', coalesce((
      select jsonb_agg(
        to_jsonb(r) || jsonb_build_object(
          'referrer_email', r.referrer_email,
          'referee_email', r.referee_email
        )
        order by r.created_at desc
      )
      from (
        select
          r0.*,
          public.mask_email(rp.email) as referrer_email,
          public.mask_email(fp.email) as referee_email
        from public.referrals r0
        left join public.profiles rp on rp.id = r0.referrer_user_id
        left join public.profiles fp on fp.id = r0.referee_user_id
        order by r0.created_at desc
        limit 200
      ) r
    ), '[]'::jsonb),
    'rewards', coalesce((
      select jsonb_agg(
        to_jsonb(rw) || jsonb_build_object('user_email', rw.user_email)
        order by rw.created_at desc
      )
      from (
        select r0.*, public.mask_email(p.email) as user_email
        from public.referral_rewards r0
        left join public.profiles p on p.id = r0.user_id
        order by r0.created_at desc
        limit 200
      ) rw
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.admin_referral_settings_update(
  p_enabled boolean,
  p_qualify_hours int,
  p_monthly_cap int,
  p_bonus_credits int,
  p_velocity_hold_per_day int
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.staff_assert('marketing.settings');
  insert into public.referral_settings (
    id, enabled, qualify_hours, monthly_cap, referred_bonus_credits,
    velocity_hold_per_day
  ) values (
    1, coalesce(p_enabled, true),
    greatest(1, least(coalesce(p_qualify_hours, 24), 720)),
    greatest(1, least(coalesce(p_monthly_cap, 50), 10000)),
    greatest(0, least(coalesce(p_bonus_credits, 10), 1000)),
    greatest(1, least(coalesce(p_velocity_hold_per_day, 5), 1000))
  )
  on conflict (id) do update
  set enabled = excluded.enabled,
      qualify_hours = excluded.qualify_hours,
      monthly_cap = excluded.monthly_cap,
      referred_bonus_credits = excluded.referred_bonus_credits,
      velocity_hold_per_day = excluded.velocity_hold_per_day;

  perform public.staff_audit(
    'referral.settings_changed', 'referral', 'settings', null, null, null,
    jsonb_build_object(
      'enabled', p_enabled,
      'qualify_hours', p_qualify_hours,
      'monthly_cap', p_monthly_cap,
      'bonus_credits', p_bonus_credits,
      'velocity_hold_per_day', p_velocity_hold_per_day
    )
  );
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.admin_referral_set_status(
  p_referral uuid,
  p_status text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  perform public.staff_assert('marketing.settings');
  if p_status not in ('signed_up', 'verified', 'published', 'held', 'rejected', 'revoked') then
    raise exception 'INVALID_STATUS';
  end if;
  if p_status in ('held', 'rejected', 'revoked')
     and (v_reason is null or length(v_reason) < 3) then
    raise exception 'REASON_REQUIRED';
  end if;

  update public.referrals
  set status = p_status,
      reason = v_reason,
      reviewed_by = auth.uid(),
      published_at = case
        when p_status = 'published' then coalesce(published_at, now())
        else published_at
      end
  where id = p_referral;
  if not found then
    raise exception 'REFERRAL_NOT_FOUND';
  end if;

  perform public.staff_audit(
    'referral.status_changed', 'referral', p_referral::text, null, v_reason,
    null, jsonb_build_object('status', p_status)
  );
  return jsonb_build_object('ok', true);
end;
$$;

-- Website record -------------------------------------------------------------

create or replace function public.admin_site_detail(p_project uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_project public.projects;
  v_team public.teams;
  v_plan text;
begin
  perform public.staff_assert('website.view');
  select * into v_project from public.projects where id = p_project;
  if v_project.id is null then
    return null;
  end if;
  select * into v_team from public.teams where id = v_project.team_id;

  select coalesce((public.billing_resolve_team(v_project.team_id) ->> 'plan_id'), 'free')
  into v_plan;

  return jsonb_build_object(
    'id', v_project.id,
    'name', v_project.name,
    'subdomain', v_project.subdomain,
    'status', v_project.status,
    'review_state', v_project.review_state,
    'review_requested_at', v_project.review_requested_at,
    'suspended_at', v_project.suspended_at,
    'suspended_reason', v_project.suspended_reason,
    'created_at', v_project.created_at,
    'team_id', v_project.team_id,
    'team_name', v_team.name,
    'owner_email', (
      select public.mask_email(p.email)
      from public.profiles p
      where p.id = v_team.owner_id
    ),
    'plan_id', v_plan,
    'pages', (select count(*) from public.pages pg where pg.project_id = p_project),
    'publishes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pb.id, 'status', pb.status, 'pages_count', pb.pages_count,
        'error_code', pb.error_code, 'created_at', pb.created_at, 'live_at', pb.live_at
      ) order by pb.created_at desc)
      from (
        select id, status, pages_count, error_code, created_at, live_at
        from public.publishes
        where project_id = p_project
        order by created_at desc
        limit 20
      ) pb
    ), '[]'::jsonb),
    'reports', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'reason', r.reason, 'status', r.status,
        'details', r.details, 'reporter_email', public.mask_email(r.reporter_email),
        'created_at', r.created_at, 'handled_at', r.handled_at
      ) order by r.created_at desc)
      from (
        select *
        from public.abuse_reports
        where project_id = p_project
        order by created_at desc
        limit 50
      ) r
    ), '[]'::jsonb),
    'flags', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', f.id, 'kind', f.kind, 'reason', f.reason, 'notes', f.notes,
        'created_at', f.created_at, 'resolved_at', f.resolved_at
      ) order by f.created_at desc)
      from public.site_flags f
      where f.project_id = p_project
    ), '[]'::jsonb),
    'audit', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'action', a.action, 'reason', a.reason,
        'created_at', a.occurred_at,
        'staff_name', coalesce(p.full_name, 'Get-On support')
      ) order by a.occurred_at desc)
      from (
        select *
        from public.staff_audit_log
        where target_type = 'project'
          and target_id = p_project::text
        order by occurred_at desc
        limit 50
      ) a
      left join public.profiles p on p.id = a.staff_user_id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.admin_site_request_review(
  p_project uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.staff_assert('website.flag');
  if not exists (select 1 from public.projects where id = p_project) then
    raise exception 'PROJECT_NOT_FOUND';
  end if;
  if p_reason is null or length(trim(p_reason)) < 10 then
    raise exception 'REASON_REQUIRED';
  end if;

  update public.projects
  set review_state = 'pending', review_requested_at = now()
  where id = p_project;

  insert into public.site_flags (project_id, kind, reason)
  values (p_project, 'review', trim(p_reason));

  perform public.staff_audit(
    'website.review_requested', 'project', p_project::text, null, trim(p_reason)
  );
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.admin_site_remove_report(p_report uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project uuid;
begin
  perform public.staff_assert('abuse.decide');
  update public.abuse_reports
  set status = 'handled', handled_at = now(), handled_by = auth.uid()
  where id = p_report
  returning project_id into v_project;
  if v_project is null then
    raise exception 'REPORT_NOT_FOUND';
  end if;
  perform public.staff_audit(
    'abuse.report_handled', 'project', v_project::text, null, null, null,
    jsonb_build_object('report', p_report)
  );
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.admin_domains() from public;
revoke all on function public.admin_domain(uuid) from public;
revoke all on function public.admin_billing_overview() from public;
revoke all on function public.admin_billing_set_settings(text, int, int[], int, int, int, text) from public;
revoke all on function public.admin_billing_set_term(int, int, text, boolean) from public;
revoke all on function public.admin_billing_create_coupon(text, int, bigint, text[], int, boolean, timestamptz, timestamptz, int, int) from public;
revoke all on function public.admin_billing_toggle_coupon(uuid, boolean) from public;
revoke all on function public.admin_billing_create_grant(uuid, text, timestamptz, timestamptz, text) from public;
revoke all on function public.admin_billing_revoke_grant(uuid) from public;
revoke all on function public.admin_billing_void_invoice(uuid, text) from public;
revoke all on function public.admin_billing_resolve_review(uuid) from public;
revoke all on function public.admin_ai_overview() from public;
revoke all on function public.admin_ai_save_settings(boolean, boolean, boolean, int, int, int, int, int, text, text) from public;
revoke all on function public.admin_ai_toggle_model(text, boolean) from public;
revoke all on function public.admin_ai_design_overview() from public;
revoke all on function public.admin_referrals() from public;
revoke all on function public.admin_referral_settings_update(boolean, int, int, int, int) from public;
revoke all on function public.admin_referral_set_status(uuid, text, text) from public;
revoke all on function public.admin_site_detail(uuid) from public;
revoke all on function public.admin_site_request_review(uuid, text) from public;
revoke all on function public.admin_site_remove_report(uuid) from public;

grant execute on function public.admin_domains() to authenticated, service_role;
grant execute on function public.admin_domain(uuid) to authenticated, service_role;
grant execute on function public.admin_billing_overview() to authenticated, service_role;
grant execute on function public.admin_billing_set_settings(text, int, int[], int, int, int, text) to authenticated, service_role;
grant execute on function public.admin_billing_set_term(int, int, text, boolean) to authenticated, service_role;
grant execute on function public.admin_billing_create_coupon(text, int, bigint, text[], int, boolean, timestamptz, timestamptz, int, int) to authenticated, service_role;
grant execute on function public.admin_billing_toggle_coupon(uuid, boolean) to authenticated, service_role;
grant execute on function public.admin_billing_create_grant(uuid, text, timestamptz, timestamptz, text) to authenticated, service_role;
grant execute on function public.admin_billing_revoke_grant(uuid) to authenticated, service_role;
grant execute on function public.admin_billing_void_invoice(uuid, text) to authenticated, service_role;
grant execute on function public.admin_billing_resolve_review(uuid) to authenticated, service_role;
grant execute on function public.admin_ai_overview() to authenticated, service_role;
grant execute on function public.admin_ai_save_settings(boolean, boolean, boolean, int, int, int, int, int, text, text) to authenticated, service_role;
grant execute on function public.admin_ai_toggle_model(text, boolean) to authenticated, service_role;
grant execute on function public.admin_ai_design_overview() to authenticated, service_role;
grant execute on function public.admin_referrals() to authenticated, service_role;
grant execute on function public.admin_referral_settings_update(boolean, int, int, int, int) to authenticated, service_role;
grant execute on function public.admin_referral_set_status(uuid, text, text) to authenticated, service_role;
grant execute on function public.admin_site_detail(uuid) to authenticated, service_role;
grant execute on function public.admin_site_request_review(uuid, text) to authenticated, service_role;
grant execute on function public.admin_site_remove_report(uuid) to authenticated, service_role;
