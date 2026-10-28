-- Email preferences and consent records.
--
-- Service email (receipts, security, delivery) is always sent: it is part of
-- the service. Marketing email is opt-in only, can be turned off in one click,
-- and keeps an append-only consent history.

create table if not exists public.email_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  marketing_opt_in boolean not null default false,
  marketing_opt_in_at timestamptz,
  marketing_source text,
  marketing_opt_in_ip_hash text,
  frequency_cap_per_30d int not null default 8,
  min_hours_between int not null default 48,
  unsubscribe_token text not null default encode(gen_random_bytes(24), 'hex'),
  locale text not null default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint email_preferences_frequency_check check (frequency_cap_per_30d between 0 and 100),
  constraint email_preferences_min_hours_check check (min_hours_between between 0 and 720)
);


-- Compatibility with the first draft preference table.
alter table public.email_preferences
  add column if not exists marketing_opt_in boolean default false,
  add column if not exists marketing_opt_in_at timestamptz,
  add column if not exists marketing_source text,
  add column if not exists marketing_opt_in_ip_hash text,
  add column if not exists frequency_cap_per_30d int default 8,
  add column if not exists min_hours_between int default 48,
  add column if not exists unsubscribe_token text default encode(gen_random_bytes(24), 'hex'),
  add column if not exists locale text default 'en',
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'email_preferences'
      and column_name = 'marketing_consent'
  ) then
    update public.email_preferences
    set marketing_opt_in = coalesce(marketing_opt_in, marketing_consent, false)
    where marketing_opt_in is null;
  else
    update public.email_preferences
    set marketing_opt_in = false
    where marketing_opt_in is null;
  end if;
end $$;


-- Make sure a legacy id column can fill itself when inserts omit it.
do $$
declare
  v_type text;
  v_default text;
  v_identity text;
  v_seq text;
begin
  select data_type, column_default, is_identity
    into v_type, v_default, v_identity
  from information_schema.columns
  where table_schema = 'public' and table_name = 'email_preferences' and column_name = 'id';

  if v_type is null or v_identity = 'YES' or v_default is not null then
    return;
  end if;

  if v_type = 'uuid' then
    execute 'alter table public.email_preferences alter column id set default gen_random_uuid()';
  elsif v_type in ('bigint', 'integer', 'smallint') then
    v_seq := 'email_preferences_id_seq';
    execute format('create sequence if not exists public.%I', v_seq);
    execute format(
      'alter table public.email_preferences alter column id set default nextval(%L::regclass)',
      'public.' || v_seq
    );
    execute format(
      'select setval(%L::regclass, greatest(coalesce((select max(id) from public.email_preferences), 0), 1), true)',
      'public.' || v_seq
    );
  end if;
end $$;

delete from public.email_preferences a
using public.email_preferences b
where a.ctid < b.ctid
  and a.user_id is not null
  and a.user_id = b.user_id;

create unique index if not exists email_preferences_user_key
  on public.email_preferences (user_id);
create unique index if not exists email_preferences_token_key
  on public.email_preferences (unsubscribe_token)
  where unsubscribe_token is not null;


do $$
declare
  v_col record;
begin
  for v_col in
    select c.column_name
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'email_preferences'
      and c.is_nullable = 'NO'
      and c.column_default is null
      and c.is_identity = 'NO'
      and c.is_generated <> 'ALWAYS'
      and c.column_name not in ('user_id')
      and not exists (
        select 1 from pg_index i
        join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any (i.indkey)
        where i.indrelid = 'public.email_preferences'::regclass
          and i.indisprimary and a.attname = c.column_name
      )
  loop
    execute format('alter table public.email_preferences alter column %I drop not null', v_col.column_name);
  end loop;
end $$;

create unique index if not exists email_preferences_token_idx
  on public.email_preferences (unsubscribe_token);
create index if not exists email_preferences_marketing_idx
  on public.email_preferences (marketing_opt_in)
  where marketing_opt_in;

insert into public.email_preferences (user_id)
select id from auth.users
on conflict (user_id) do nothing;

create table if not exists public.consent_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  granted boolean not null,
  source text not null,
  policy_version text,
  ip_hash text,
  user_agent text,
  created_at timestamptz not null default now(),
  constraint consent_records_kind_check check (
    kind in ('marketing', 'analytics', 'profiling', 'communication')
  )
);


-- Compatibility with the first draft consent table.
alter table public.consent_records
  add column if not exists policy_version text,
  add column if not exists created_at timestamptz default now();


do $$
declare
  v_col record;
begin
  for v_col in
    select c.column_name
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'consent_records'
      and c.is_nullable = 'NO'
      and c.column_default is null
      and c.is_identity = 'NO'
      and c.is_generated <> 'ALWAYS'
      and c.column_name not in ('user_id', 'kind', 'granted', 'source')
      and not exists (
        select 1 from pg_index i
        join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any (i.indkey)
        where i.indrelid = 'public.consent_records'::regclass
          and i.indisprimary and a.attname = c.column_name
      )
  loop
    execute format('alter table public.consent_records alter column %I drop not null', v_col.column_name);
  end loop;
end $$;


-- Make sure a legacy id column can fill itself when inserts omit it.
do $$
declare
  v_type text;
  v_default text;
  v_identity text;
  v_seq text;
begin
  select data_type, column_default, is_identity
    into v_type, v_default, v_identity
  from information_schema.columns
  where table_schema = 'public' and table_name = 'consent_records' and column_name = 'id';

  if v_type is null or v_identity = 'YES' or v_default is not null then
    return;
  end if;

  if v_type = 'uuid' then
    execute 'alter table public.consent_records alter column id set default gen_random_uuid()';
  elsif v_type in ('bigint', 'integer', 'smallint') then
    v_seq := 'consent_records_id_seq';
    execute format('create sequence if not exists public.%I', v_seq);
    execute format(
      'alter table public.consent_records alter column id set default nextval(%L::regclass)',
      'public.' || v_seq
    );
    execute format(
      'select setval(%L::regclass, greatest(coalesce((select max(id) from public.consent_records), 0), 1), true)',
      'public.' || v_seq
    );
  end if;
end $$;

create index if not exists consent_records_user_kind_idx
  on public.consent_records (user_id, kind, created_at desc);

create or replace function public.consent_records_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'CONSENT_APPEND_ONLY';
end;
$$;

drop trigger if exists consent_records_no_change on public.consent_records;
create trigger consent_records_no_change
  before update or delete on public.consent_records
  for each row execute function public.consent_records_immutable();

create or replace function public.email_preference_set(
  p_marketing_opt_in boolean,
  p_source text,
  p_ip_hash text default null,
  p_user_agent text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  insert into public.email_preferences (
    user_id, marketing_opt_in, marketing_opt_in_at, marketing_source,
    marketing_opt_in_ip_hash, updated_at
  ) values (
    auth.uid(), coalesce(p_marketing_opt_in, false),
    case when p_marketing_opt_in then now() else null end,
    left(coalesce(p_source, 'account'), 40),
    case when p_marketing_opt_in then p_ip_hash else null end,
    now()
  )
  on conflict (user_id) do update set
    marketing_opt_in = excluded.marketing_opt_in,
    marketing_opt_in_at = case
      when excluded.marketing_opt_in then now()
      else email_preferences.marketing_opt_in_at
    end,
    marketing_source = excluded.marketing_source,
    marketing_opt_in_ip_hash = case
      when excluded.marketing_opt_in then excluded.marketing_opt_in_ip_hash
      else email_preferences.marketing_opt_in_ip_hash
    end,
    updated_at = now();

  insert into public.consent_records (
    user_id, kind, granted, source, ip_hash, user_agent
  ) values (
    auth.uid(), 'marketing', coalesce(p_marketing_opt_in, false),
    left(coalesce(p_source, 'account'), 40), p_ip_hash, p_user_agent
  );
end;
$$;

create or replace function public.email_unsubscribe(p_token text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
begin
  select user_id into v_user
  from public.email_preferences
  where unsubscribe_token = p_token;
  if v_user is null then
    return false;
  end if;
  update public.email_preferences
    set marketing_opt_in = false, updated_at = now()
    where user_id = v_user;
  insert into public.consent_records (user_id, kind, granted, source)
  values (v_user, 'marketing', false, 'unsubscribe_link');
  return true;
end;
$$;

create or replace function public.email_preference_reset_token()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  v_token := encode(gen_random_bytes(24), 'hex');
  update public.email_preferences
    set unsubscribe_token = v_token, updated_at = now()
    where user_id = auth.uid();
  return v_token;
end;
$$;

-- Whether a marketing email may go to this user right now.
create or replace function public.marketing_can_send(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.email_preferences p
    join auth.users u on u.id = p.user_id
    where p.user_id = p_user_id
      and p.marketing_opt_in
      and u.email_confirmed_at is not null
      and not exists (
        select 1 from public.email_suppressions s
        where lower(s.email) = lower(u.email)
      )
  )
$$;

alter table public.email_preferences enable row level security;
alter table public.consent_records enable row level security;

drop policy if exists "users read own email preferences" on public.email_preferences;
create policy "users read own email preferences"
  on public.email_preferences
  for select to authenticated
  using (user_id = auth.uid() or public.is_staff());

drop policy if exists "users read own consent records" on public.consent_records;
create policy "users read own consent records"
  on public.consent_records
  for select to authenticated
  using (user_id = auth.uid() or public.is_staff());

revoke all on public.email_preferences from anon;
revoke all on public.consent_records from anon;
grant select on public.email_preferences to authenticated;
grant select on public.consent_records to authenticated;
grant all on public.email_preferences to service_role;
grant all on public.consent_records to service_role;

revoke all on function public.email_preference_set(boolean, text, text, text) from public;
revoke all on function public.email_unsubscribe(text) from public;
revoke all on function public.email_preference_reset_token() from public;
revoke all on function public.marketing_can_send(uuid) from public;

grant execute on function public.email_preference_set(boolean, text, text, text) to authenticated, service_role;
grant execute on function public.email_unsubscribe(text) to anon, authenticated, service_role;
grant execute on function public.email_preference_reset_token() to authenticated, service_role;
grant execute on function public.marketing_can_send(uuid) to service_role;
