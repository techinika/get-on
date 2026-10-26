-- Referral codes, claimable rewards and an append-only reward history.

alter table public.referral_rewards add column if not exists claim_status text not null default 'unclaimed';
do $$ begin
  alter table public.referral_rewards add constraint referral_rewards_claim_status_check
    check (claim_status in ('unclaimed','claimed','revoked'));
exception when duplicate_object then null;
end $$;
create unique index if not exists referral_rewards_ladder_once
  on public.referral_rewards (user_id, ladder_id)
  where ladder_id is not null;
create unique index if not exists referral_rewards_welcome_once
  on public.referral_rewards (user_id, note)
  where note like 'welcome:%';
alter table public.referral_rewards add column if not exists claimed_at timestamptz;
alter table public.referral_rewards add column if not exists claimed_by uuid;
alter table public.referral_rewards add column if not exists claim_note text;

create table if not exists public.referral_reward_events (
  id uuid primary key default gen_random_uuid(),
  reward_id uuid not null references public.referral_rewards(id) on delete cascade,
  user_id uuid not null,
  event text not null check (event in ('received','claimed','revoked','expired')),
  amount numeric,
  note text,
  actor_user_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists referral_reward_events_reward_idx on public.referral_reward_events (reward_id, created_at desc);
alter table public.referral_reward_events enable row level security;
drop policy if exists "users read own reward events" on public.referral_reward_events;
create policy "users read own reward events"
  on public.referral_reward_events for select
  using (auth.uid() = user_id);

alter table public.referral_settings enable row level security;
drop policy if exists "referral settings readable" on public.referral_settings;
create policy "referral settings readable"
  on public.referral_settings for select
  using (true);

create or replace function public.record_referral_reward(
  p_user uuid,
  p_team uuid,
  p_ladder uuid,
  p_milestone int,
  p_type text,
  p_amount numeric,
  p_status text,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.referral_rewards (
    user_id, team_id, ladder_id, milestone, reward_type, amount, status, note, claim_status
  ) values (
    p_user, p_team, p_ladder, p_milestone, p_type, p_amount, p_status, p_note,
    case when p_status = 'applied' then 'claimed' else 'unclaimed' end
  )
  returning id into v_id;

  insert into public.referral_reward_events (reward_id, user_id, event, amount, note)
  values (v_id, p_user, 'received', p_amount, p_note);

  return v_id;
end;
$$;

revoke all on function public.record_referral_reward(uuid, uuid, uuid, int, text, numeric, text, text) from public;
grant execute on function public.record_referral_reward(uuid, uuid, uuid, int, text, numeric, text, text) to service_role;

create or replace function public.claim_referral_reward(p_reward uuid, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_reward record;
begin
  select * into v_reward from public.referral_rewards where id = p_reward and user_id = v_user;
  if v_reward.id is null then
    raise exception 'NOT_ALLOWED';
  end if;
  if v_reward.claim_status = 'claimed' then
    return jsonb_build_object('ok', true, 'already', true);
  end if;
  if v_reward.claim_status = 'revoked' then
    raise exception 'NOT_ALLOWED';
  end if;

  update public.referral_rewards
    set claim_status = 'claimed', claimed_at = now(), claimed_by = v_user, claim_note = p_note,
        status = 'applied', applied_at = now()
    where id = p_reward;

  insert into public.referral_reward_events (reward_id, user_id, event, amount, note, actor_user_id)
  values (p_reward, v_user, 'claimed', v_reward.amount, p_note, v_user);

  return jsonb_build_object('ok', true, 'type', v_reward.reward_type, 'amount', v_reward.amount);
end;
$$;

revoke all on function public.claim_referral_reward(uuid, text) from public;
grant execute on function public.claim_referral_reward(uuid, text) to authenticated, service_role;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  first_name text;
  personal_team_id uuid;
  v_code text;
  v_try int := 0;
begin
  first_name := split_part(coalesce(new.raw_user_meta_data->>'full_name', new.email, 'there'), ' ', 1);

  loop
    v_try := v_try + 1;
    select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
      into v_code from generate_series(1, 8);
    exit when not exists (select 1 from public.profiles where referral_code = v_code);
    if v_try > 20 then
      v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
      exit;
    end if;
  end loop;

  insert into public.profiles (id, full_name, email, referral_code)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', first_name), new.email, v_code)
  on conflict (id) do update set email = excluded.email;

  insert into public.teams (name, owner_id, plan_id, is_personal)
  values (format('%s''s Team', first_name), new.id, 'free', true)
  returning id into personal_team_id;

  insert into public.team_members (team_id, user_id, role)
  values (personal_team_id, new.id, 'owner')
  on conflict (team_id, user_id) do nothing;

  return new;
end;
$$;

-- Backfill codes for existing accounts.
do $$
declare
  r record;
  v_code text;
begin
  for r in select id from public.profiles where referral_code is null loop
    loop
      select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
        into v_code from generate_series(1, 8);
      exit when not exists (select 1 from public.profiles where referral_code = v_code);
    end loop;
    update public.profiles set referral_code = v_code where id = r.id;
  end loop;
end $$;

alter view public.project_activity set (security_invoker = true);
