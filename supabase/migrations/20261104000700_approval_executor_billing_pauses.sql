-- Approval executors for grace extensions, billing holds and site plan pauses.
--
-- Extensions are per team and overlay the global grace window. Holds stop
-- reminder emails only. A plan pause keeps the live version in place but sets
-- the pointer pause flag and blocks new publishes until support removes it.

create table if not exists public.billing_grace_extensions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  days int not null,
  grace_ends_at timestamptz not null,
  previous_grace_ends_at timestamptz,
  reason text not null,
  approval_id uuid unique references public.approval_requests(id) on delete set null,
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint billing_grace_extensions_days_check check (days between 1 and 365)
);

create index if not exists billing_grace_extensions_team_idx
  on public.billing_grace_extensions (team_id, grace_ends_at desc);

alter table public.billing_grace_extensions enable row level security;

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
  v_extension_end timestamptz;
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

  select max(e.grace_ends_at) into v_extension_end
  from public.billing_grace_extensions e
  where e.team_id = p_team;

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
    if v_extension_end is not null
       and (v_grace_end is null or v_extension_end > v_grace_end) then
      v_grace_end := v_extension_end;
    end if;
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
    if v_extension_end is not null and v_extension_end > v_grace_end then
      v_grace_end := v_extension_end;
    end if;
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

create table if not exists public.billing_holds (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  case_id uuid references public.support_cases(id) on delete set null,
  reason text not null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  released_at timestamptz,
  approval_id uuid unique references public.approval_requests(id) on delete set null,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists billing_holds_team_idx
  on public.billing_holds (team_id, starts_at desc);

alter table public.billing_holds enable row level security;

create or replace function public.admin_billing_extend_grace(
  p_team uuid,
  p_days integer,
  p_reason text,
  p_approval uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_paid timestamptz;
  v_plan text;
  v_grace_days int;
  v_previous timestamptz;
  v_base timestamptz;
  v_new timestamptz;
  v_status text;
  v_inserted uuid;
begin
  perform public.staff_assert('billing.grace_extend.approve');
  if p_reason is null or length(trim(p_reason)) < 10 then
    raise exception 'NOTE_REQUIRED';
  end if;
  if p_days is null or p_days < 1 or p_days > 365 then
    raise exception 'BAD_DAYS';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('billing-grace:' || p_team::text, 0));

  if p_approval is not null and exists (
    select 1 from public.billing_grace_extensions where approval_id = p_approval
  ) then
    return jsonb_build_object('ok', true, 'duplicate', true);
  end if;

  select max(st.ends_at) into v_paid
  from public.subscription_terms st
  where st.team_id = p_team and st.status <> 'cancelled';
  if v_paid is null then
    raise exception 'NO_PAID_TERM';
  end if;

  select st.plan_id into v_plan
  from public.subscription_terms st
  where st.team_id = p_team and st.status <> 'cancelled'
  order by st.ends_at desc
  limit 1;

  select grace_days into v_grace_days
  from public.billing_settings where id = 1;
  v_grace_days := coalesce(v_grace_days, 7);

  select max(e.grace_ends_at) into v_previous
  from public.billing_grace_extensions e
  where e.team_id = p_team;

  v_base := greatest(
    v_paid + make_interval(days => v_grace_days),
    now(),
    coalesce(v_previous, '-infinity'::timestamptz)
  );
  v_new := v_base + make_interval(days => p_days);
  v_status := case when v_paid > now() then 'active' else 'grace' end;

  insert into public.billing_grace_extensions (
    team_id, days, grace_ends_at, previous_grace_ends_at, reason,
    approval_id, created_by
  ) values (
    p_team, p_days, v_new, v_previous, p_reason, p_approval, auth.uid()
  )
  on conflict (approval_id) do nothing
  returning id into v_inserted;

  if v_inserted is null then
    return jsonb_build_object('ok', true, 'duplicate', true);
  end if;

  insert into public.team_billing (
    team_id, effective_plan_id, status, grace_ends_at, lapsed_at
  ) values (
    p_team, coalesce(v_plan, 'free'), v_status, v_new, null
  )
  on conflict (team_id) do update
    set effective_plan_id = excluded.effective_plan_id,
        status = excluded.status,
        grace_ends_at = greatest(
          coalesce(public.team_billing.grace_ends_at, excluded.grace_ends_at),
          excluded.grace_ends_at
        ),
        lapsed_at = null,
        updated_at = now();

  update public.teams
  set plan_id = coalesce(v_plan, plan_id),
      plan_source = case when plan_source = 'manual' then plan_source else 'billing' end
  where id = p_team;

  perform public.log_team_activity(
    p_team, null, 'Get-On support', null, 'support', 'team', 'billing_grace_extended',
    format('Get-On support extended billing grace by %s days', p_days),
    null, null, null, null, null, null,
    jsonb_build_object('days', p_days, 'grace_ends_at', v_new,
      'previous_grace_ends_at', v_previous, 'note', p_reason),
    null, 0
  );

  perform public.staff_audit(
    'billing.grace_extended', 'team', p_team::text, null, p_reason, p_approval,
    jsonb_build_object('days', p_days, 'grace_ends_at', v_new,
      'previous_grace_ends_at', v_previous),
    null, null
  );

  return jsonb_build_object('ok', true, 'grace_ends_at', v_new,
    'status', v_status, 'plan_id', coalesce(v_plan, 'free'));
end;
$$;

revoke all on function public.admin_billing_extend_grace(uuid, integer, text, uuid) from public;
grant execute on function public.admin_billing_extend_grace(uuid, integer, text, uuid) to authenticated, service_role;

create or replace function public.admin_billing_set_hold(
  p_team uuid,
  p_action text,
  p_reason text,
  p_case_id uuid default null,
  p_days integer default null,
  p_approval uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hold public.billing_holds;
  v_ends timestamptz;
begin
  perform public.staff_assert('billing.hold.approve');
  if p_action not in ('place', 'release') then
    raise exception 'BAD_ACTION';
  end if;
  if p_reason is null or length(trim(p_reason)) < 10 then
    raise exception 'NOTE_REQUIRED';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('billing-hold:' || p_team::text, 0));

  if p_approval is not null and exists (
    select 1 from public.billing_holds where approval_id = p_approval
  ) then
    return jsonb_build_object('ok', true, 'duplicate', true);
  end if;

  if p_action = 'place' then
    if p_case_id is not null and not exists (
      select 1 from public.support_cases where id = p_case_id and team_id = p_team
    ) then
      raise exception 'CASE_NOT_FOUND';
    end if;
    if p_days is not null and (p_days < 1 or p_days > 365) then
      raise exception 'BAD_DAYS';
    end if;
    if exists (
      select 1 from public.billing_holds
      where team_id = p_team
        and released_at is null
        and (ends_at is null or ends_at > now())
    ) then
      raise exception 'HOLD_EXISTS';
    end if;
    v_ends := case when p_days is null then null
      else now() + make_interval(days => p_days) end;
    insert into public.billing_holds (
      team_id, case_id, reason, ends_at, approval_id, created_by
    ) values (
      p_team, p_case_id, p_reason, v_ends, p_approval, auth.uid()
    ) returning * into v_hold;

    perform public.log_team_activity(
      p_team, null, 'Get-On support', null, 'support', 'team', 'billing_hold_placed',
      'Get-On support placed a billing hold',
      null, null, null, null, null, null,
      jsonb_build_object('ends_at', v_ends, 'case_id', p_case_id, 'note', p_reason),
      null, 0
    );
    perform public.staff_audit(
      'billing.hold_placed', 'team', p_team::text, null, p_reason, p_approval,
      jsonb_build_object('hold_id', v_hold.id, 'ends_at', v_ends, 'case_id', p_case_id),
      null, null
    );
    return jsonb_build_object('ok', true, 'hold_id', v_hold.id, 'ends_at', v_ends);
  end if;

  select * into v_hold
  from public.billing_holds
  where team_id = p_team
    and released_at is null
    and (ends_at is null or ends_at > now())
  order by starts_at desc
  limit 1
  for update;
  if v_hold.id is null then
    raise exception 'HOLD_NOT_FOUND';
  end if;

  update public.billing_holds
  set released_at = now()
  where id = v_hold.id;

  perform public.log_team_activity(
    p_team, null, 'Get-On support', null, 'support', 'team', 'billing_hold_released',
    'Get-On support released a billing hold',
    null, null, null, null, null, null,
    jsonb_build_object('hold_id', v_hold.id, 'note', p_reason),
    null, 0
  );
  perform public.staff_audit(
    'billing.hold_released', 'team', p_team::text, null, p_reason, p_approval,
    jsonb_build_object('hold_id', v_hold.id), null, null
  );

  return jsonb_build_object('ok', true, 'hold_id', v_hold.id, 'released', true);
end;
$$;

revoke all on function public.admin_billing_set_hold(uuid, text, text, uuid, integer, uuid) from public;
grant execute on function public.admin_billing_set_hold(uuid, text, text, uuid, integer, uuid) to authenticated, service_role;

alter table public.projects
  add column if not exists plan_paused_at timestamptz,
  add column if not exists plan_paused_reason text;

create or replace function public.protect_project_moderation_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    if new.review_state is distinct from old.review_state
       or new.review_requested_at is distinct from old.review_requested_at
       or new.suspended_reason is distinct from old.suspended_reason
       or new.suspended_at is distinct from old.suspended_at
       or new.plan_paused_at is distinct from old.plan_paused_at
       or new.plan_paused_reason is distinct from old.plan_paused_reason then
      raise exception 'not_authorized';
    end if;
  end if;
  return new;
end;
$$;
