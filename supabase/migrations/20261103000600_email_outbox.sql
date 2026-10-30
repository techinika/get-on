-- Email outbox, tracking and settings.

--

-- Business code writes one outbox row in the same transaction as the change it

-- describes. The worker resolves recipients, checks consent and suppression,

-- sends through SES, and records the result. Marketing and billing use

-- different streams so reputation stays separate.



create table if not exists public.notification_outbox (

  id uuid primary key default gen_random_uuid(),

  dedupe_key text not null unique,

  kind text not null,

  stream text not null default 'transactional',

  user_id uuid references auth.users(id) on delete set null,

  to_email text,

  team_id uuid references public.teams(id) on delete set null,

  related_type text,

  related_id uuid,

  locale text not null default 'en',

  payload jsonb not null default '{}'::jsonb,

  status text not null default 'queued',

  attempts int not null default 0,

  scheduled_for timestamptz not null default now(),

  next_attempt_at timestamptz,

  last_error text,

  ses_message_id text,

  created_at timestamptz not null default now(),

  sent_at timestamptz,

  expires_at timestamptz,

  constraint notification_outbox_stream_check check (

    stream in ('transactional', 'billing', 'marketing', 'system')

  ),

  constraint notification_outbox_status_check check (

    status in ('queued', 'sending', 'sent', 'failed', 'suppressed', 'cancelled')

  )

);



create index if not exists notification_outbox_due_idx

  on public.notification_outbox (status, scheduled_for)

  where status = 'queued';

create index if not exists notification_outbox_user_idx

  on public.notification_outbox (user_id, created_at desc);

create index if not exists notification_outbox_kind_idx

  on public.notification_outbox (kind, created_at desc);



create table if not exists public.email_assets (

  id uuid primary key default gen_random_uuid(),

  name text not null unique,

  mime text not null,

  width int,

  height int,

  sha256 text,

  data bytea not null,

  created_at timestamptz not null default now(),

  constraint email_assets_mime_check check (mime in ('image/png', 'image/jpeg', 'image/gif'))

);



create table if not exists public.email_tracking_links (

  id uuid primary key default gen_random_uuid(),

  outbox_id uuid not null references public.notification_outbox(id) on delete cascade,

  token text not null unique,

  url text not null,

  first_clicked_at timestamptz,

  clicks int not null default 0,

  created_at timestamptz not null default now()

);



create index if not exists email_tracking_links_outbox_idx

  on public.email_tracking_links (outbox_id);



create table if not exists public.email_tracking_opens (

  outbox_id uuid primary key references public.notification_outbox(id) on delete cascade,

  first_opened_at timestamptz not null default now(),

  opens int not null default 1

);



create table if not exists public.email_settings (

  id boolean primary key default true check (id),

  email_provider text not null default 'console' check (email_provider in ('ses', 'smtp', 'console', 'memory')),
    smtp_host text default null,
    smtp_port integer default 587,
    smtp_secure boolean default false,
    smtp_user text default null,
    smtp_from text default null,
    smtp_name text default 'Get-On',

  marketing_paused boolean not null default false,

  marketing_pause_reason text,

  warmup_started_at timestamptz,

  daily_cap_override int,

  complaint_warn_bps int not null default 10,

  complaint_pause_bps int not null default 30,

  bounce_warn_bps int not null default 300,

  bounce_pause_bps int not null default 500,

  updated_at timestamptz not null default now()

);



insert into public.email_settings (id) values (true) on conflict (id) do nothing;



-- Delivery log grows a few columns so one row tells the whole story.

alter table public.email_log

  add column if not exists outbox_id uuid references public.notification_outbox(id) on delete set null,

  add column if not exists stream text,

  add column if not exists template_key text,

  add column if not exists campaign_id uuid,

  add column if not exists reply_to text,

  add column if not exists provider text;



-- Enqueue ---------------------------------------------------------------



create or replace function public.email_enqueue(

  p_dedupe_key text,

  p_kind text,

  p_stream text,

  p_user_id uuid,

  p_to_email text,

  p_team_id uuid,

  p_related_type text,

  p_related_id uuid,

  p_payload jsonb default '{}'::jsonb,

  p_scheduled_for timestamptz default now(),

  p_expires_at timestamptz default null

)

returns uuid

language plpgsql

security definer

set search_path = public

as $$

declare

  v_id uuid;

begin

  insert into public.notification_outbox (

    dedupe_key, kind, stream, user_id, to_email, team_id, related_type,

    related_id, payload, scheduled_for, expires_at

  ) values (

    p_dedupe_key, p_kind, coalesce(p_stream, 'transactional'), p_user_id,

    lower(nullif(trim(p_to_email), '')), p_team_id, p_related_type,

    p_related_id, coalesce(p_payload, '{}'::jsonb), coalesce(p_scheduled_for, now()),

    p_expires_at

  )

  on conflict (dedupe_key) do nothing

  returning id into v_id;

  return v_id;

end;

$$;



-- Claim a batch for the worker. FOR UPDATE SKIP LOCKED keeps two workers from

-- sending the same email.

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

      select id

      from public.notification_outbox

      where status = 'queued'

        and scheduled_for <= now()

        and (next_attempt_at is null or next_attempt_at <= now())

        and (expires_at is null or expires_at > now())

      order by scheduled_for

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



create or replace function public.email_mark_sent(p_id uuid, p_ses_message_id text)

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

    set status = 'sent', sent_at = now(), ses_message_id = p_ses_message_id,

        last_error = null

    where id = p_id;

end;

$$;



create or replace function public.email_mark_failed(

  p_id uuid,

  p_error text,

  p_retry_at timestamptz

)

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

    set status = case when p_retry_at is null then 'failed' else 'queued' end,

        last_error = left(p_error, 500),

        next_attempt_at = p_retry_at

    where id = p_id;

end;

$$;



create or replace function public.email_mark_suppressed(p_id uuid, p_reason text)

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

    set status = 'suppressed', last_error = left(coalesce(p_reason, 'suppressed'), 200)

    where id = p_id;

end;

$$;



alter table public.notification_outbox enable row level security;

alter table public.email_assets enable row level security;

alter table public.email_tracking_links enable row level security;

alter table public.email_tracking_opens enable row level security;

alter table public.email_settings enable row level security;



drop policy if exists "staff read email settings" on public.email_settings;

create policy "staff read email settings"

  on public.email_settings

  for select to authenticated

  using (public.is_staff());



revoke all on public.notification_outbox from anon, authenticated;

revoke all on public.email_assets from anon, authenticated;

revoke all on public.email_tracking_links from anon, authenticated;

revoke all on public.email_tracking_opens from anon, authenticated;

grant select on public.email_settings to authenticated;

grant all on public.notification_outbox to service_role;

grant all on public.email_assets to service_role;

grant all on public.email_tracking_links to service_role;

grant all on public.email_tracking_opens to service_role;

grant all on public.email_settings to service_role;



revoke all on function public.email_enqueue(text, text, text, uuid, text, uuid, text, uuid, jsonb, timestamptz, timestamptz) from public;

revoke all on function public.email_claim(int) from public;

revoke all on function public.email_mark_sent(uuid, text) from public;

revoke all on function public.email_mark_failed(uuid, text, timestamptz) from public;

revoke all on function public.email_mark_suppressed(uuid, text) from public;



grant execute on function public.email_enqueue(text, text, text, uuid, text, uuid, text, uuid, jsonb, timestamptz, timestamptz) to service_role;

grant execute on function public.email_claim(int) to service_role;

grant execute on function public.email_mark_sent(uuid, text) to service_role;

grant execute on function public.email_mark_failed(uuid, text, timestamptz) to service_role;

grant execute on function public.email_mark_suppressed(uuid, text) to service_role;




create or replace function public.admin_set_email_provider(p_provider text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_provider not in ('ses', 'smtp', 'console', 'memory') then
    raise exception 'Invalid email provider: %', p_provider;
  end if;
  update public.email_settings set email_provider = p_provider, updated_at = now() where id;
end;
$$;

create or replace function public.admin_get_email_provider()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_provider text;
begin
  select email_provider into v_provider from public.email_settings where id;
  if v_provider is null then
    v_provider := 'console';
  end if;
  return v_provider;
end;
$$;

grant execute on function public.admin_set_email_provider(text) to service_role;
grant execute on function public.admin_get_email_provider() to authenticated;

create or replace function public.admin_set_smtp_settings(p_host text, p_port integer, p_secure boolean, p_user text, p_from text, p_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.email_settings set
    smtp_host = p_host,
    smtp_port = p_port,
    smtp_secure = p_secure,
    smtp_user = p_user,
    smtp_from = p_from,
    smtp_name = p_name,
    updated_at = now()
  where id;
end;
$$;

