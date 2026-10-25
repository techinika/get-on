do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'plans'
      and column_name = 'ai_credits_monthly'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'plans'
      and column_name = 'ai_monthly_credits'
  ) then
    alter table public.plans rename column ai_credits_monthly to ai_monthly_credits;
  end if;
end $$;

alter table public.plans
  add column if not exists ai_monthly_credits integer not null default 0,
  add column if not exists ai_daily_actions integer not null default 0;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'plans'
      and column_name = 'ai_credits_monthly'
  ) then
    update public.plans
    set ai_monthly_credits = ai_credits_monthly
    where ai_monthly_credits = 0;
  end if;
end $$;

update public.plans
set
  ai_monthly_credits = case id
    when 'free' then 0
    when 'basic' then 100
    when 'pro' then 400
    when 'enterprise' then 1500
    else ai_monthly_credits
  end,
  ai_daily_actions = case id
    when 'free' then 30
    when 'basic' then 100
    when 'pro' then 300
    when 'enterprise' then 1000
    else ai_daily_actions
  end
where id in ('free', 'basic', 'pro', 'enterprise');

create table if not exists public.ai_settings (
  id boolean primary key default true check (id = true),
  enabled boolean not null default true,
  credit_neurons integer not null default 100 check (credit_neurons > 0),
  daily_cap_credits integer not null default 5000 check (daily_cap_credits >= 0),
  free_grant_credits integer not null default 25 check (free_grant_credits >= 0),
  max_prompt_chars integer not null default 20000 check (max_prompt_chars > 0),
  moderation_enabled boolean not null default true,
  images_enabled boolean not null default false,
  payload_retention_days integer not null default 30 check (payload_retention_days > 0),
  gateway_id text,
  default_language text not null default 'en',
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.ai_settings (id)
values (true)
on conflict (id) do nothing;

create table if not exists public.ai_models (
  id text primary key,
  provider text not null,
  model_id text not null,
  purposes text[] not null check (cardinality(purposes) > 0),
  neurons_per_m_input numeric check (neurons_per_m_input >= 0),
  neurons_per_m_output numeric check (neurons_per_m_output >= 0),
  neurons_per_image numeric check (neurons_per_image >= 0),
  context_tokens integer not null check (context_tokens > 0),
  max_output_tokens integer not null default 0 check (max_output_tokens >= 0),
  supports_json boolean not null default false,
  supports_vision boolean not null default false,
  enabled boolean not null default true,
  fallback_id text references public.ai_models(id) on delete set null,
  notes text,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.skill_packs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  scope text not null check (scope in ('global', 'business_type', 'template', 'task', 'language')),
  scope_value text,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  active_version_id uuid,
  priority integer not null default 100,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.skill_pack_versions (
  id uuid primary key default gen_random_uuid(),
  pack_id uuid not null references public.skill_packs(id) on delete cascade,
  version integer not null check (version > 0),
  content text not null check (char_length(content) <= 20000),
  notes text,
  size_tokens integer check (size_tokens >= 0),
  eval_result jsonb,
  eval_passed boolean,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  unique (pack_id, version)
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'skill_packs_active_version_fk'
      and conrelid = 'public.skill_packs'::regclass
  ) then
    alter table public.skill_packs
      add constraint skill_packs_active_version_fk
      foreign key (active_version_id)
      references public.skill_pack_versions(id)
      on delete set null;
  end if;
end $$;

create table if not exists public.credit_buckets (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  kind text not null check (kind in ('free_grant', 'monthly', 'referral', 'bonus', 'purchase', 'admin')),
  amount_initial integer not null check (amount_initial >= 0),
  amount_remaining integer not null check (amount_remaining >= 0),
  amount_reserved integer not null default 0 check (amount_reserved >= 0),
  expires_at timestamptz,
  source text,
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (amount_reserved <= amount_remaining)
);

create unique index if not exists credit_buckets_source_unique
  on public.credit_buckets (team_id, kind, source)
  where source is not null;

create index if not exists credit_buckets_team_idx
  on public.credit_buckets (team_id, expires_at, created_at);

create table if not exists public.ai_requests (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  task text not null,
  feature text not null,
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'partial', 'failed', 'refused', 'cancelled')),
  source text not null default 'platform' check (source in ('platform', 'byok')),
  estimate_credits integer not null default 0 check (estimate_credits >= 0),
  reserved_credits integer not null default 0 check (reserved_credits >= 0),
  charged_credits integer not null default 0 check (charged_credits >= 0),
  cap_credits integer not null default 0 check (cap_credits >= 0),
  steps jsonb not null default '[]'::jsonb,
  model_ids text[] not null default '{}'::text[],
  usage jsonb not null default '{}'::jsonb,
  moderation jsonb not null default '{}'::jsonb,
  flags jsonb not null default '{}'::jsonb,
  prompt_version text,
  skill_versions jsonb not null default '[]'::jsonb,
  input_hash text,
  idempotency_key text,
  error_code text,
  latency_ms integer check (latency_ms >= 0),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  unique (team_id, idempotency_key)
);

create index if not exists ai_requests_team_created_idx
  on public.ai_requests (team_id, created_at desc);

create index if not exists ai_requests_project_created_idx
  on public.ai_requests (project_id, created_at desc);

create index if not exists ai_requests_status_idx
  on public.ai_requests (status, created_at);

create index if not exists ai_requests_user_created_idx
  on public.ai_requests (user_id, created_at desc);

create table if not exists public.credit_reservations (
  request_id uuid not null references public.ai_requests(id) on delete cascade,
  bucket_id uuid not null references public.credit_buckets(id) on delete cascade,
  credits integer not null check (credits > 0),
  primary key (request_id, bucket_id)
);

create index if not exists credit_reservations_bucket_idx
  on public.credit_reservations (bucket_id);

create table if not exists public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  request_id uuid references public.ai_requests(id) on delete set null,
  bucket_id uuid references public.credit_buckets(id) on delete set null,
  kind text not null check (kind in ('grant', 'reserve', 'settle', 'release', 'expire', 'adjust')),
  credits integer not null,
  balance_after integer not null check (balance_after >= 0),
  summary text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists credit_ledger_team_created_idx
  on public.credit_ledger (team_id, created_at desc);

create table if not exists public.credit_member_caps (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  monthly_credits integer not null check (monthly_credits >= 0),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

create table if not exists public.ai_payloads (
  request_id uuid primary key references public.ai_requests(id) on delete cascade,
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists ai_payloads_expires_idx
  on public.ai_payloads (expires_at);

create table if not exists public.ai_feedback (
  request_id uuid not null references public.ai_requests(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating text not null check (rating in ('up', 'down')),
  reason text,
  note text check (char_length(note) <= 300),
  created_at timestamptz not null default now(),
  primary key (request_id, user_id)
);

create index if not exists ai_feedback_request_idx
  on public.ai_feedback (request_id);

create table if not exists public.ai_usage_daily (
  day date not null,
  team_id uuid not null references public.teams(id) on delete cascade,
  credits integer not null default 0 check (credits >= 0),
  neurons bigint not null default 0 check (neurons >= 0),
  requests integer not null default 0 check (requests >= 0),
  primary key (day, team_id)
);

create index if not exists ai_usage_daily_day_idx
  on public.ai_usage_daily (day);

create or replace view public.ai_usage_platform_daily
with (security_invoker = true)
as
select
  day,
  sum(credits)::bigint as credits,
  sum(neurons)::bigint as neurons,
  sum(requests)::bigint as requests
from public.ai_usage_daily
group by day;

alter table public.project_settings
  add column if not exists brand_voice jsonb not null default '{}'::jsonb check (jsonb_typeof(brand_voice) = 'object'),
  add column if not exists business_facts jsonb not null default '[]'::jsonb check (jsonb_typeof(business_facts) = 'array' and jsonb_array_length(business_facts) <= 20);

alter table public.media
  add column if not exists ai_generated boolean not null default false,
  add column if not exists ai_request_id uuid references public.ai_requests(id) on delete set null;

alter table public.profiles
  add column if not exists free_ai_grant_at timestamptz;

alter table public.ai_settings enable row level security;
alter table public.ai_models enable row level security;
alter table public.skill_packs enable row level security;
alter table public.skill_pack_versions enable row level security;
alter table public.credit_buckets enable row level security;
alter table public.credit_reservations enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.credit_member_caps enable row level security;
alter table public.ai_requests enable row level security;
alter table public.ai_payloads enable row level security;
alter table public.ai_feedback enable row level security;
alter table public.ai_usage_daily enable row level security;

create or replace function public.ai_available(p_team uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(amount_remaining - amount_reserved), 0)::integer
  from public.credit_buckets
  where team_id = p_team;
$$;

revoke all on function public.ai_available(uuid) from public;

create or replace function public.ai_balance(p_team uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if auth.role() <> 'service_role'
     and not public.user_is_team_member(p_team) then
    raise exception 'AI_FORBIDDEN';
  end if;

  select jsonb_build_object(
    'total', coalesce(sum(amount_remaining - amount_reserved), 0),
    'buckets', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'kind', kind,
          'available', amount_remaining - amount_reserved,
          'expiresAt', expires_at,
          'source', source
        )
        order by
          case when expires_at is null then 1 else 0 end,
          expires_at,
          created_at
      ) filter (where amount_remaining - amount_reserved > 0),
      '[]'::jsonb
    )
  )
  into v_result
  from public.credit_buckets
  where team_id = p_team;

  return v_result;
end;
$$;

revoke all on function public.ai_balance(uuid) from public;
grant execute on function public.ai_balance(uuid) to authenticated, service_role;

create or replace function public.credits_used_in_cycle(p_team uuid, p_user uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_used integer;
begin
  if auth.role() <> 'service_role'
     and not public.user_is_team_member(p_team) then
    raise exception 'AI_FORBIDDEN';
  end if;

  select coalesce(sum(charged_credits), 0)::integer
  into v_used
  from public.ai_requests
  where team_id = p_team
    and user_id = p_user
    and status in ('succeeded', 'partial')
    and created_at >= (date_trunc('month', now() at time zone 'utc') at time zone 'utc')
    and created_at < (date_trunc('month', now() at time zone 'utc') at time zone 'utc') + interval '1 month';

  return v_used;
end;
$$;

revoke all on function public.credits_used_in_cycle(uuid, uuid) from public;
grant execute on function public.credits_used_in_cycle(uuid, uuid) to authenticated, service_role;

create or replace function public.grant_credits(
  p_team uuid,
  p_kind text,
  p_amount integer,
  p_expires timestamptz,
  p_source text,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bucket_id uuid;
  v_balance integer;
begin
  if auth.role() <> 'service_role' then
    raise exception 'AI_FORBIDDEN';
  end if;
  if p_amount <= 0 then
    raise exception 'INVALID_AMOUNT';
  end if;
  if p_kind not in ('free_grant', 'monthly', 'referral', 'bonus', 'purchase', 'admin') then
    raise exception 'INVALID_CREDIT_KIND';
  end if;
  if not exists (select 1 from public.teams where id = p_team) then
    raise exception 'TEAM_NOT_FOUND';
  end if;

  insert into public.credit_buckets (
    team_id, kind, amount_initial, amount_remaining, amount_reserved,
    expires_at, source, note, created_by
  ) values (
    p_team, p_kind, p_amount, p_amount, 0,
    p_expires, p_source, p_note, auth.uid()
  )
  on conflict (team_id, kind, source) where source is not null do nothing
  returning id into v_bucket_id;

  if v_bucket_id is null then
    select id into v_bucket_id
    from public.credit_buckets
    where team_id = p_team
      and kind = p_kind
      and source is not distinct from p_source
    limit 1;
  else
    v_balance := public.ai_available(p_team);
    insert into public.credit_ledger (
      team_id, user_id, bucket_id, kind, credits, balance_after, summary, meta
    ) values (
      p_team, auth.uid(), v_bucket_id, 'grant', p_amount, v_balance,
      'AI credits added',
      jsonb_build_object('kind', p_kind, 'source', p_source, 'expiresAt', p_expires)
    );
  end if;

  if v_bucket_id is null then
    raise exception 'GRANT_FAILED';
  end if;

  return v_bucket_id;
end;
$$;

revoke all on function public.grant_credits(uuid, text, integer, timestamptz, text, text) from public;
grant execute on function public.grant_credits(uuid, text, integer, timestamptz, text, text) to service_role;

create or replace function public.ai_reserve(
  p_team uuid,
  p_user uuid,
  p_request uuid,
  p_amount integer,
  p_idempotency text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.ai_requests%rowtype;
  v_bucket public.credit_buckets%rowtype;
  v_existing integer;
  v_available integer;
  v_needed integer;
  v_take integer;
  v_cap integer;
  v_used integer;
  v_user uuid;
begin
  v_user := coalesce(p_user, auth.uid());

  if v_user is null then
    raise exception 'AI_NOT_AUTHENTICATED';
  end if;
  if auth.role() <> 'service_role' then
    if v_user <> auth.uid() then
      raise exception 'AI_FORBIDDEN';
    end if;
    if not public.user_has_team_role(p_team, array['owner', 'admin', 'editor']) then
      raise exception 'AI_FORBIDDEN';
    end if;
  end if;
  if p_amount < 0 then
    raise exception 'INVALID_AMOUNT';
  end if;

  select * into v_request
  from public.ai_requests
  where id = p_request
  for update;

  if not found then
    raise exception 'AI_REQUEST_NOT_FOUND';
  end if;
  if v_request.team_id <> p_team or v_request.user_id <> v_user then
    raise exception 'AI_FORBIDDEN';
  end if;
  if p_idempotency is not null
     and v_request.idempotency_key is not null
     and v_request.idempotency_key <> p_idempotency then
    raise exception 'AI_IDEMPOTENCY_MISMATCH';
  end if;

  select coalesce(sum(credits), 0)::integer into v_existing
  from public.credit_reservations
  where request_id = p_request;

  if v_existing > 0 then
    return v_existing;
  end if;
  if p_amount = 0 then
    return 0;
  end if;

  select monthly_credits into v_cap
  from public.credit_member_caps
  where team_id = p_team and user_id = v_user;

  if found and v_cap is not null then
    v_used := public.credits_used_in_cycle(p_team, v_user);
    if v_used + p_amount > v_cap then
      raise exception 'AI_MEMBER_CAP';
    end if;
  end if;

  v_available := public.ai_available(p_team);
  if v_available < p_amount then
    raise exception 'AI_NO_CREDITS: need %, available %', p_amount, v_available;
  end if;

  v_needed := p_amount;

  for v_bucket in
    select *
    from public.credit_buckets
    where team_id = p_team
      and amount_remaining - amount_reserved > 0
    order by
      case when expires_at is null then 1 else 0 end,
      expires_at,
      case kind
        when 'monthly' then 1
        when 'referral' then 2
        when 'bonus' then 3
        when 'purchase' then 4
        when 'admin' then 5
        when 'free_grant' then 6
        else 7
      end,
      created_at
    for update
  loop
    exit when v_needed <= 0;

    v_take := least(v_needed, v_bucket.amount_remaining - v_bucket.amount_reserved);
    if v_take <= 0 then
      continue;
    end if;

    update public.credit_buckets
    set amount_reserved = amount_reserved + v_take
    where id = v_bucket.id;

    insert into public.credit_reservations (request_id, bucket_id, credits)
    values (p_request, v_bucket.id, v_take);

    insert into public.credit_ledger (
      team_id, user_id, request_id, bucket_id, kind, credits, balance_after, summary, meta
    ) values (
      p_team, v_user, p_request, v_bucket.id, 'reserve', 0,
      public.ai_available(p_team),
      'AI credits held for this action',
      jsonb_build_object('held', v_take)
    );

    v_needed := v_needed - v_take;
  end loop;

  if v_needed > 0 then
    raise exception 'AI_NO_CREDITS: need %, available %', p_amount, v_available;
  end if;

  update public.ai_requests
  set reserved_credits = p_amount
  where id = p_request;

  return p_amount;
end;
$$;

revoke all on function public.ai_reserve(uuid, uuid, uuid, integer, text) from public;
grant execute on function public.ai_reserve(uuid, uuid, uuid, integer, text) to authenticated, service_role;

create or replace function public.ai_settle(p_request uuid, p_actual integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.ai_requests%rowtype;
  v_res public.credit_reservations%rowtype;
  v_reserved integer;
  v_actual integer;
  v_left integer;
  v_take integer;
  v_release integer;
begin
  select * into v_request
  from public.ai_requests
  where id = p_request
  for update;

  if not found then
    raise exception 'AI_REQUEST_NOT_FOUND';
  end if;
  if auth.role() <> 'service_role' then
    if auth.uid() is null
       or not public.user_is_team_member(v_request.team_id)
       or (
         v_request.user_id <> auth.uid()
         and not public.user_has_team_role(v_request.team_id, array['owner', 'admin'])
       ) then
      raise exception 'AI_FORBIDDEN';
    end if;
  end if;

  select coalesce(sum(credits), 0)::integer into v_reserved
  from public.credit_reservations
  where request_id = p_request;

  if v_reserved = 0 then
    return 0;
  end if;

  v_actual := greatest(0, least(coalesce(p_actual, 0), v_reserved));
  v_left := v_actual;

  for v_res in
    select r.*
    from public.credit_reservations r
    join public.credit_buckets b on b.id = r.bucket_id
    where r.request_id = p_request
    order by
      case when b.expires_at is null then 1 else 0 end,
      b.expires_at,
      case b.kind
        when 'monthly' then 1
        when 'referral' then 2
        when 'bonus' then 3
        when 'purchase' then 4
        when 'admin' then 5
        when 'free_grant' then 6
        else 7
      end,
      b.created_at
    for update of b
  loop
    v_take := least(v_left, v_res.credits);
    v_release := v_res.credits - v_take;

    update public.credit_buckets
    set amount_remaining = amount_remaining - v_take,
        amount_reserved = amount_reserved - v_res.credits
    where id = v_res.bucket_id;

    if v_take > 0 then
      insert into public.credit_ledger (
        team_id, user_id, request_id, bucket_id, kind, credits, balance_after, summary, meta
      ) values (
        v_request.team_id, v_request.user_id, p_request, v_res.bucket_id,
        'settle', -v_take, public.ai_available(v_request.team_id),
        'AI credits used',
        jsonb_build_object('reserved', v_res.credits)
      );
    end if;

    if v_release > 0 then
      insert into public.credit_ledger (
        team_id, user_id, request_id, bucket_id, kind, credits, balance_after, summary, meta
      ) values (
        v_request.team_id, v_request.user_id, p_request, v_res.bucket_id,
        'release', v_release, public.ai_available(v_request.team_id),
        'Unused AI credits returned',
        jsonb_build_object('reserved', v_res.credits)
      );
    end if;

    v_left := v_left - v_take;
  end loop;

  delete from public.credit_reservations where request_id = p_request;

  update public.ai_requests
  set charged_credits = v_actual
  where id = p_request;

  return v_actual;
end;
$$;

revoke all on function public.ai_settle(uuid, integer) from public;
grant execute on function public.ai_settle(uuid, integer) to authenticated, service_role;

create or replace function public.ai_release(p_request uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.ai_requests%rowtype;
  v_res public.credit_reservations%rowtype;
  v_released integer := 0;
begin
  select * into v_request
  from public.ai_requests
  where id = p_request
  for update;

  if not found then
    raise exception 'AI_REQUEST_NOT_FOUND';
  end if;
  if auth.role() <> 'service_role' then
    if auth.uid() is null
       or not public.user_is_team_member(v_request.team_id)
       or (
         v_request.user_id <> auth.uid()
         and not public.user_has_team_role(v_request.team_id, array['owner', 'admin'])
       ) then
      raise exception 'AI_FORBIDDEN';
    end if;
  end if;

  for v_res in
    select r.*
    from public.credit_reservations r
    join public.credit_buckets b on b.id = r.bucket_id
    where r.request_id = p_request
    order by b.created_at
    for update of b
  loop
    update public.credit_buckets
    set amount_reserved = amount_reserved - v_res.credits
    where id = v_res.bucket_id;

    v_released := v_released + v_res.credits;

    insert into public.credit_ledger (
      team_id, user_id, request_id, bucket_id, kind, credits, balance_after, summary, meta
    ) values (
      v_request.team_id, v_request.user_id, p_request, v_res.bucket_id,
      'release', v_res.credits, public.ai_available(v_request.team_id),
      'AI credits returned',
      jsonb_build_object('released', v_res.credits)
    );
  end loop;

  delete from public.credit_reservations where request_id = p_request;

  update public.ai_requests
  set charged_credits = 0
  where id = p_request;

  return v_released;
end;
$$;

revoke all on function public.ai_release(uuid) from public;
grant execute on function public.ai_release(uuid) to authenticated, service_role;

create or replace function public.expire_credits()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bucket public.credit_buckets%rowtype;
  v_available integer;
  v_count integer := 0;
begin
  if auth.role() <> 'service_role' then
    raise exception 'AI_FORBIDDEN';
  end if;

  for v_bucket in
    select *
    from public.credit_buckets
    where expires_at is not null
      and expires_at <= now()
      and amount_remaining - amount_reserved > 0
    for update
  loop
    v_available := v_bucket.amount_remaining - v_bucket.amount_reserved;

    update public.credit_buckets
    set amount_remaining = amount_reserved
    where id = v_bucket.id;

    insert into public.credit_ledger (
      team_id, user_id, bucket_id, kind, credits, balance_after, summary, meta
    ) values (
      v_bucket.team_id, null, v_bucket.id, 'expire', -v_available,
      public.ai_available(v_bucket.team_id),
      'Unused AI credits expired',
      jsonb_build_object('expired', v_available, 'expiresAt', v_bucket.expires_at)
    );

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.expire_credits() from public;
grant execute on function public.expire_credits() to service_role;

create or replace function public.prevent_credit_ledger_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'CREDIT_LEDGER_IMMUTABLE';
end;
$$;

drop trigger if exists credit_ledger_immutable on public.credit_ledger;
create trigger credit_ledger_immutable
  before update or delete on public.credit_ledger
  for each row
  execute function public.prevent_credit_ledger_change();

create or replace function public.prevent_skill_version_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'SKILL_VERSION_IMMUTABLE';
end;
$$;

drop trigger if exists skill_pack_versions_immutable on public.skill_pack_versions;
create trigger skill_pack_versions_immutable
  before update or delete on public.skill_pack_versions
  for each row
  execute function public.prevent_skill_version_change();

drop trigger if exists ai_settings_touch_updated_at on public.ai_settings;
create trigger ai_settings_touch_updated_at
  before update on public.ai_settings
  for each row
  execute function public.touch_updated_at();

drop trigger if exists ai_models_touch_updated_at on public.ai_models;
create trigger ai_models_touch_updated_at
  before update on public.ai_models
  for each row
  execute function public.touch_updated_at();

drop trigger if exists skill_packs_touch_updated_at on public.skill_packs;
create trigger skill_packs_touch_updated_at
  before update on public.skill_packs
  for each row
  execute function public.touch_updated_at();

create policy "team members read credit buckets"
  on public.credit_buckets
  for select
  using (public.user_is_team_member(team_id));

create policy "team members read credit ledger"
  on public.credit_ledger
  for select
  using (public.user_is_team_member(team_id));

create policy "team members read member caps"
  on public.credit_member_caps
  for select
  using (public.user_is_team_member(team_id));

create policy "owners admins manage member caps"
  on public.credit_member_caps
  for all
  using (public.user_has_team_role(team_id, array['owner', 'admin']))
  with check (public.user_has_team_role(team_id, array['owner', 'admin']));

create policy "team members read ai requests"
  on public.ai_requests
  for select
  using (public.user_is_team_member(team_id));

create policy "team members read ai feedback"
  on public.ai_feedback
  for select
  using (
    exists (
      select 1
      from public.ai_requests r
      where r.id = ai_feedback.request_id
        and public.user_is_team_member(r.team_id)
    )
  );

create policy "requesters insert ai feedback"
  on public.ai_feedback
  for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.ai_requests r
      where r.id = ai_feedback.request_id
        and public.user_is_team_member(r.team_id)
    )
  );

create policy "team members read ai usage"
  on public.ai_usage_daily
  for select
  using (public.user_is_team_member(team_id));

revoke all on public.ai_settings from anon, authenticated;
revoke all on public.ai_models from anon, authenticated;
revoke all on public.skill_packs from anon, authenticated;
revoke all on public.skill_pack_versions from anon, authenticated;
revoke all on public.credit_reservations from anon, authenticated;
revoke all on public.ai_payloads from anon, authenticated;
revoke all on public.credit_buckets from anon, authenticated;
revoke all on public.credit_ledger from anon, authenticated;
revoke all on public.credit_member_caps from anon, authenticated;
revoke all on public.ai_requests from anon, authenticated;
revoke all on public.ai_feedback from anon, authenticated;
revoke all on public.ai_usage_daily from anon, authenticated;
revoke all on public.ai_usage_platform_daily from anon, authenticated;

grant select on public.credit_buckets to authenticated;
grant select on public.credit_ledger to authenticated;
grant select, insert, update, delete on public.credit_member_caps to authenticated;
grant select on public.ai_requests to authenticated;
grant select, insert on public.ai_feedback to authenticated;
grant select on public.ai_usage_daily to authenticated;

grant all on public.ai_settings to service_role;
grant all on public.ai_models to service_role;
grant all on public.skill_packs to service_role;
grant all on public.skill_pack_versions to service_role;
grant all on public.credit_buckets to service_role;
grant all on public.credit_reservations to service_role;
grant all on public.credit_ledger to service_role;
grant all on public.credit_member_caps to service_role;
grant all on public.ai_requests to service_role;
grant all on public.ai_payloads to service_role;
grant all on public.ai_feedback to service_role;
grant all on public.ai_usage_daily to service_role;
grant select on public.ai_usage_platform_daily to service_role;

insert into public.ai_models (
  id, provider, model_id, purposes,
  neurons_per_m_input, neurons_per_m_output, neurons_per_image,
  context_tokens, max_output_tokens, supports_json, supports_vision,
  enabled, fallback_id, notes, verified_at
) values
  (
    'llama-3.3-70b', 'workers-ai', '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    array['brief', 'writer', 'judge'],
    26668, 204805, null,
    24000, 4096, true, false,
    true, null,
    'Primary structured model. Docs verified 2026-10-25; live JSON smoke test pending.',
    null
  ),
  (
    'llama-3.2-3b', 'workers-ai', '@cf/meta/llama-3.2-3b-instruct',
    array['writer'],
    4625, 30475, null,
    80000, 2048, false, false,
    true, null,
    'Cheap plain-text model. Not on the JSON Mode list.',
    null
  ),
  (
    'gemma-4-26b', 'workers-ai', '@cf/google/gemma-4-26b-a4b-it',
    array['vision', 'writer'],
    9091, 27273, null,
    256000, 4096, false, true,
    true, null,
    'Vision and plain text. Preferred vision model.',
    null
  ),
  (
    'llama-3.2-11b-vision', 'workers-ai', '@cf/meta/llama-3.2-11b-vision-instruct',
    array['vision'],
    4410, 61493, null,
    128000, 2048, false, true,
    true, null,
    'Vision alternative. Requires accepting the Meta licence.',
    null
  ),
  (
    'llama-guard-3-8b', 'workers-ai', '@cf/meta/llama-guard-3-8b',
    array['guard'],
    44003, 2730, null,
    131072, 1024, false, false,
    true, null,
    'Moderation. Output can be a string or {safe,categories}; categories S1-S14.',
    null
  ),
  (
    'flux-1-schnell', 'workers-ai', '@cf/black-forest-labs/flux-1-schnell',
    array['image'],
    null, null, null,
    2048, 0, false, false,
    true, null,
    'Image generation. 4.80 neurons per 512 tile plus 9.60 per step; default 4 steps, maximum 8. Images are disabled by default.',
    null
  )
on conflict (id) do update
set
  provider = excluded.provider,
  model_id = excluded.model_id,
  purposes = excluded.purposes,
  neurons_per_m_input = excluded.neurons_per_m_input,
  neurons_per_m_output = excluded.neurons_per_m_output,
  neurons_per_image = excluded.neurons_per_image,
  context_tokens = excluded.context_tokens,
  max_output_tokens = excluded.max_output_tokens,
  supports_json = excluded.supports_json,
  supports_vision = excluded.supports_vision,
  enabled = excluded.enabled,
  notes = excluded.notes;

update public.ai_models
set fallback_id = 'llama-3.3-70b'
where id = 'llama-3.2-3b';

update public.ai_models
set fallback_id = 'llama-3.2-11b-vision'
where id = 'gemma-4-26b';
