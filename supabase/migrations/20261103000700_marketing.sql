-- Marketing campaigns: opt-in audience, segments, warm-up caps, approval and
-- per-recipient queueing. Nothing sends without a super admin approval.

create table if not exists public.marketing_settings (
  id boolean primary key default true check (id),
  sending_domain text not null default 'contact.get-on.tech',
  reply_to text not null default 'team@get-on.tech',
  physical_address text,
  unsubscribe_base text not null default 'https://get-on.tech/email/unsubscribe',
  tracking_base text,
  warmup_started_at timestamptz,
  daily_cap_override int,
  frequency_cap_per_30d int not null default 8,
  min_hours_between int not null default 48,
  paused boolean not null default false,
  pause_reason text,
  updated_at timestamptz not null default now()
);

insert into public.marketing_settings (id) values (true) on conflict (id) do nothing;

create table if not exists public.marketing_segments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  definition jsonb not null default '{"type":"all_opted_in"}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketing_segments_name_check check (char_length(trim(name)) between 2 and 80)
);

create table if not exists public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subject text not null,
  preheader text,
  template_key text not null default 'marketing_newsletter',
  content jsonb not null default '{}'::jsonb,
  segment_id uuid references public.marketing_segments(id) on delete set null,
  status text not null default 'draft',
  scheduled_for timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  sent_at timestamptz,
  recipient_count int,
  paused_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketing_campaigns_status_check check (
    status in ('draft', 'pending_approval', 'approved', 'scheduled', 'sending', 'sent', 'paused', 'cancelled')
  ),
  constraint marketing_campaigns_subject_check check (char_length(subject) between 1 and 60),
  constraint marketing_campaigns_preheader_check check (
    preheader is null or char_length(preheader) between 40 and 110
  )
);

create table if not exists public.marketing_campaign_recipients (
  campaign_id uuid not null references public.marketing_campaigns(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  status text not null default 'queued',
  outbox_id uuid references public.notification_outbox(id) on delete set null,
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  primary key (campaign_id, user_id),
  constraint marketing_campaign_recipients_status_check check (
    status in ('queued', 'sent', 'failed', 'skipped', 'suppressed')
  )
);

create index if not exists marketing_campaigns_status_idx
  on public.marketing_campaigns (status, scheduled_for);
create index if not exists marketing_campaign_recipients_status_idx
  on public.marketing_campaign_recipients (campaign_id, status);

-- Warm-up cap: 500, 1000, 2000, 5000, 10000, then unlimited/override.
create or replace function public.marketing_daily_cap()
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select daily_cap_override from public.marketing_settings where id),
    case
      when (select warmup_started_at from public.marketing_settings where id) is null then 500
      when now() < (select warmup_started_at from public.marketing_settings where id) + interval '1 day' then 500
      when now() < (select warmup_started_at from public.marketing_settings where id) + interval '2 days' then 1000
      when now() < (select warmup_started_at from public.marketing_settings where id) + interval '3 days' then 2000
      when now() < (select warmup_started_at from public.marketing_settings where id) + interval '4 days' then 5000
      when now() < (select warmup_started_at from public.marketing_settings where id) + interval '5 days' then 10000
      else 2147483647
    end
  )
$$;

create or replace function public.marketing_segment_users(p_definition jsonb)
returns table (user_id uuid, email text)
language sql
stable
security definer
set search_path = public
as $$
  with base as (
    select u.id as user_id, u.email
    from auth.users u
    join public.email_preferences pref on pref.user_id = u.id
    where pref.marketing_opt_in
      and u.email_confirmed_at is not null
      and u.email is not null
  )
  select b.user_id, b.email
  from base b
  where case coalesce(p_definition->>'type', 'all_opted_in')
    when 'all_opted_in' then true
    when 'plan' then exists (
      select 1
      from public.teams t
      join public.team_members m on m.team_id = t.id and m.user_id = b.user_id
      where t.plan_id = any (
        coalesce(
          array(select jsonb_array_elements_text(coalesce(p_definition->'planIds', '[]'::jsonb))),
          array[]::text[]
        )
      )
    )
    when 'team' then exists (
      select 1 from public.team_members m
      where m.user_id = b.user_id
        and m.team_id::text = any (
          coalesce(
            array(select jsonb_array_elements_text(coalesce(p_definition->'teamIds', '[]'::jsonb))),
            array[]::text[]
          )
        )
    )
    when 'users' then b.user_id::text = any (
      coalesce(
        array(select jsonb_array_elements_text(coalesce(p_definition->'userIds', '[]'::jsonb))),
        array[]::text[]
      )
    )
    else false
  end
$$;

-- Queue a campaign for an approved send. Runs as service role from the job.
create or replace function public.marketing_campaign_queue(p_campaign_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign public.marketing_campaigns;
  v_settings public.marketing_settings;
  v_segment jsonb;
  v_cap int;
  v_already int;
  v_queued int := 0;
  v_skipped int := 0;
  v_row record;
  v_outbox uuid;
  v_freq int;
  v_min_hours int;
  v_recent int;
  v_last timestamptz;
begin
  if auth.role() <> 'service_role' then
    raise exception 'NOT_ALLOWED';
  end if;

  select * into v_campaign from public.marketing_campaigns where id = p_campaign_id for update;
  if v_campaign.id is null then
    raise exception 'CAMPAIGN_NOT_FOUND';
  end if;
  if v_campaign.status not in ('approved', 'scheduled', 'sending') then
    raise exception 'CAMPAIGN_NOT_APPROVED';
  end if;

  select * into v_settings from public.marketing_settings where id;
  if v_settings.paused then
    raise exception 'MARKETING_PAUSED';
  end if;

  select coalesce(definition, '{"type":"all_opted_in"}'::jsonb)
    into v_segment
  from public.marketing_segments
  where id = v_campaign.segment_id;
  v_segment := coalesce(v_segment, '{"type":"all_opted_in"}'::jsonb);

  v_cap := public.marketing_daily_cap();
  select count(*) into v_already
  from public.notification_outbox
  where stream = 'marketing'
    and created_at >= date_trunc('day', now());
  if v_already >= v_cap then
    raise exception 'MARKETING_DAILY_CAP';
  end if;

  update public.marketing_campaigns
    set status = 'sending', updated_at = now()
    where id = p_campaign_id;

  for v_row in
    select s.user_id, s.email
    from public.marketing_segment_users(v_segment) s
  loop
    if v_already + v_queued >= v_cap then
      exit;
    end if;

    select frequency_cap_per_30d, min_hours_between
      into v_freq, v_min_hours
    from public.email_preferences where user_id = v_row.user_id;
    v_freq := coalesce(v_freq, v_settings.frequency_cap_per_30d);
    v_min_hours := coalesce(v_min_hours, v_settings.min_hours_between);

    select count(*), max(created_at)
      into v_recent, v_last
    from public.notification_outbox
    where stream = 'marketing'
      and user_id = v_row.user_id
      and created_at >= now() - interval '30 days';

    if v_recent >= v_freq or (v_last is not null and v_last > now() - make_interval(hours => v_min_hours)) then
      insert into public.marketing_campaign_recipients (campaign_id, user_id, email, status)
      values (p_campaign_id, v_row.user_id, v_row.email, 'skipped')
      on conflict (campaign_id, user_id) do nothing;
      v_skipped := v_skipped + 1;
      continue;
    end if;

    v_outbox := public.email_enqueue(
      'campaign:' || p_campaign_id::text || ':' || v_row.user_id::text,
      'marketing_campaign',
      'marketing',
      v_row.user_id,
      v_row.email,
      null,
      'campaign',
      p_campaign_id,
      jsonb_build_object(
        'campaign_id', p_campaign_id,
        'subject', v_campaign.subject,
        'preheader', v_campaign.preheader,
        'template_key', v_campaign.template_key,
        'content', v_campaign.content
      ),
      now(),
      now() + interval '14 days'
    );

    insert into public.marketing_campaign_recipients (
      campaign_id, user_id, email, status, outbox_id
    ) values (
      p_campaign_id, v_row.user_id, v_row.email, 'queued', v_outbox
    )
    on conflict (campaign_id, user_id) do nothing;

    if v_outbox is not null then
      v_queued := v_queued + 1;
    end if;
  end loop;

  update public.marketing_campaigns
    set recipient_count = v_queued,
        status = case when v_queued = 0 then 'sent' else 'sending' end,
        sent_at = case when v_queued = 0 then now() else sent_at end,
        updated_at = now()
    where id = p_campaign_id;

  return jsonb_build_object('queued', v_queued, 'skipped', v_skipped, 'cap', v_cap);
end;
$$;

alter table public.marketing_settings enable row level security;
alter table public.marketing_segments enable row level security;
alter table public.marketing_campaigns enable row level security;
alter table public.marketing_campaign_recipients enable row level security;

drop policy if exists "staff read marketing settings" on public.marketing_settings;
create policy "staff read marketing settings"
  on public.marketing_settings
  for select to authenticated
  using (public.staff_can('marketing.view'::text));

drop policy if exists "staff read segments" on public.marketing_segments;
create policy "staff read segments"
  on public.marketing_segments
  for select to authenticated
  using (public.staff_can('marketing.segment.view'::text));

drop policy if exists "staff read campaigns" on public.marketing_campaigns;
create policy "staff read campaigns"
  on public.marketing_campaigns
  for select to authenticated
  using (public.staff_can('marketing.view'::text));

drop policy if exists "staff read campaign recipients" on public.marketing_campaign_recipients;
create policy "staff read campaign recipients"
  on public.marketing_campaign_recipients
  for select to authenticated
  using (public.staff_can('marketing.view'::text));

revoke all on public.marketing_settings from anon;
revoke all on public.marketing_segments from anon;
revoke all on public.marketing_campaigns from anon;
revoke all on public.marketing_campaign_recipients from anon;
grant select on public.marketing_settings to authenticated;
grant select on public.marketing_segments to authenticated;
grant select on public.marketing_campaigns to authenticated;
grant select on public.marketing_campaign_recipients to authenticated;
grant all on public.marketing_settings to service_role;
grant all on public.marketing_segments to service_role;
grant all on public.marketing_campaigns to service_role;
grant all on public.marketing_campaign_recipients to service_role;

revoke all on function public.marketing_daily_cap() from public;
revoke all on function public.marketing_segment_users(jsonb) from public;
revoke all on function public.marketing_campaign_queue(uuid) from public;

grant execute on function public.marketing_daily_cap() to authenticated, service_role;
grant execute on function public.marketing_segment_users(jsonb) to service_role;
grant execute on function public.marketing_campaign_queue(uuid) to service_role;
