-- Platform staff core: identity, login events, audit log, access windows and
-- the staff permission functions. Every staff check in the app and in SQL
-- goes through this migration.
--
-- Staff never read customer content. They read metadata through the
-- SECURITY DEFINER admin_* functions defined in later migrations.

-- 1. Staff records ---------------------------------------------------------

create table if not exists public.platform_staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'customer_success',
  status text not null default 'active',
  added_via text not null default 'invite',
  added_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  last_staff_login_at timestamptz,
  notes text,
  constraint platform_staff_role_check check (role in ('super_admin', 'customer_success')),
  constraint platform_staff_status_check check (status in ('active', 'suspended')),
  constraint platform_staff_added_via_check check (added_via in ('bootstrap', 'invite', 'migration'))
);

comment on table public.platform_staff is
  'Get-On employees. Team roles (owner/admin/editor/viewer) are separate customer roles.';

create table if not exists public.staff_permissions (
  role text not null check (role in ('super_admin', 'customer_success')),
  action text not null,
  allowed boolean not null default false,
  primary key (role, action)
);

-- Compatibility: an earlier draft used a different permission shape.
alter table public.staff_permissions
  add column if not exists role text,
  add column if not exists action text,
  add column if not exists allowed boolean default false,
  add column if not exists permission text;

do $$
declare
  v_col record;
  v_pk text;
  v_cols text;
  v_id_type text;
begin
  select c.conname, string_agg(a.attname, ',' order by a.attname)
    into v_pk, v_cols
  from pg_constraint c
  join pg_attribute a
    on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
  where c.conrelid = 'public.staff_permissions'::regclass
    and c.contype = 'p'
  group by c.conname;

  if v_pk is not null and v_cols not in ('role,action', 'action,role', 'id') then
    execute format('alter table public.staff_permissions drop constraint %I', v_pk);
  end if;

  select data_type into v_id_type
  from information_schema.columns
  where table_schema = 'public' and table_name = 'staff_permissions' and column_name = 'id';

  if v_id_type = 'uuid' then
    alter table public.staff_permissions alter column id set default gen_random_uuid();
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'staff_permissions'
      and column_name = 'permission'
  ) then
    update public.staff_permissions
    set action = permission
    where action is null and permission is not null;
  end if;

  -- Legacy draft tables had extra required columns that new rows do not set.
  for v_col in
    select c.column_name
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'staff_permissions'
      and c.is_nullable = 'NO'
      and c.column_default is null
      and c.is_identity = 'NO'
      and c.is_generated <> 'ALWAYS'
      and c.column_name not in ('role', 'action', 'allowed')
      and not exists (
        select 1
        from pg_index i
        join pg_attribute a
          on a.attrelid = i.indrelid and a.attnum = any (i.indkey)
        where i.indrelid = 'public.staff_permissions'::regclass
          and i.indisprimary
          and a.attname = c.column_name
      )
  loop
    execute format(
      'alter table public.staff_permissions alter column %I drop not null',
      v_col.column_name
    );
  end loop;
end $$;

update public.staff_permissions set allowed = false where allowed is null;

-- Remove duplicate draft rows so the unique index can be created.
delete from public.staff_permissions a
using public.staff_permissions b
where a.ctid < b.ctid
  and a.role is not distinct from b.role
  and a.action is not distinct from b.action;

create unique index if not exists staff_permissions_role_action_key
  on public.staff_permissions (role, action);


-- Compatibility: an earlier draft created this table with email as the key.
-- Add every column the current code expects, backfill what we can, and relax
-- legacy NOT NULL columns so new rows can be inserted.
alter table public.platform_staff
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists role text,
  add column if not exists status text default 'active',
  add column if not exists added_via text default 'invite',
  add column if not exists added_by uuid references auth.users(id) on delete set null,
  add column if not exists created_at timestamptz default now(),
  add column if not exists last_staff_login_at timestamptz,
  add column if not exists notes text,
  add column if not exists email text,
  add column if not exists name text,
  add column if not exists totp_secret text,
  add column if not exists totp_enabled boolean default false,
  add column if not exists last_login_at timestamptz,
  add column if not exists last_ip_hash text,
  add column if not exists id uuid default gen_random_uuid();

update public.platform_staff set role = 'customer_success' where role is null;
update public.platform_staff set status = 'active' where status is null;
update public.platform_staff set added_via = 'migration' where added_via is null;

update public.platform_staff ps
set user_id = u.id
from auth.users u
where ps.user_id is null
  and ps.email is not null
  and lower(ps.email) = lower(u.email);

do $$
declare
  v_pk text;
  v_cols text;
  v_id_type text;
begin
  -- The first draft keyed staff by email. Move the key to user_id first, so
  -- the old key columns can become optional.
  select c.conname, string_agg(a.attname, ',' order by a.attname)
    into v_pk, v_cols
  from pg_constraint c
  join pg_attribute a
    on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
  where c.conrelid = 'public.platform_staff'::regclass
    and c.contype = 'p'
  group by c.conname;

  if v_pk is not null and v_cols like '%email%' then
    execute format('alter table public.platform_staff drop constraint %I', v_pk);
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'platform_staff' and column_name = 'email'
  ) then
    alter table public.platform_staff alter column email drop not null;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'platform_staff' and column_name = 'name'
  ) then
    alter table public.platform_staff alter column name drop not null;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'platform_staff' and column_name = 'totp_secret'
  ) then
    alter table public.platform_staff alter column totp_secret drop not null;
  end if;

  select data_type into v_id_type
  from information_schema.columns
  where table_schema = 'public' and table_name = 'platform_staff' and column_name = 'id';

  if v_id_type = 'uuid' then
    alter table public.platform_staff alter column id set default gen_random_uuid();
  end if;
end $$;

-- Any other legacy required column that new rows do not fill is relaxed too.
do $$
declare
  v_col record;
begin
  for v_col in
    select c.column_name
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'platform_staff'
      and c.is_nullable = 'NO'
      and c.column_default is null
      and c.is_identity = 'NO'
      and c.is_generated <> 'ALWAYS'
      and not exists (
        select 1
        from pg_index i
        join pg_attribute a
          on a.attrelid = i.indrelid and a.attnum = any (i.indkey)
        where i.indrelid = 'public.platform_staff'::regclass
          and i.indisprimary
          and a.attname = c.column_name
      )
  loop
    execute format(
      'alter table public.platform_staff alter column %I drop not null',
      v_col.column_name
    );
  end loop;
end $$;

create unique index if not exists platform_staff_id_key
  on public.platform_staff (id);

drop index if exists public.platform_staff_user_idx;
create unique index platform_staff_user_idx
  on public.platform_staff (user_id);

-- Drop any earlier checks on these columns, whatever they were named, and
-- add the current ones. NOT VALID keeps old rows as they are.
do $$
declare
  v_con text;
begin
  for v_con in
    select conname from pg_constraint
    where conrelid = 'public.platform_staff'::regclass and contype = 'c'
  loop
    execute format('alter table public.platform_staff drop constraint %I', v_con);
  end loop;

  -- The draft used admin/support names for the same two jobs. Old checks are
  -- gone by now, so the names can change before the new checks are added.
  update public.platform_staff
    set role = case role when 'admin' then 'super_admin' else 'customer_success' end
    where role in ('admin', 'support');
  update public.platform_staff set status = 'suspended' where status = 'disabled';

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'platform_staff' and column_name = 'id'
      and column_default is null
  ) then
    alter table public.platform_staff alter column id set default gen_random_uuid();
  end if;
end $$;

alter table public.platform_staff
  add constraint platform_staff_role_check check (role in ('super_admin', 'customer_success')) not valid;
alter table public.platform_staff
  add constraint platform_staff_status_check check (status in ('active', 'suspended')) not valid;
alter table public.platform_staff
  add constraint platform_staff_added_via_check check (added_via in ('bootstrap', 'invite', 'migration')) not valid;

create index if not exists platform_staff_role_idx on public.platform_staff (role, status);

-- Seeded from packages/permissions/src/staff-matrix.ts. Do not edit by hand;
-- run `pnpm --filter web staff:docs` to regenerate the seed migration.

-- 2. Sign-in events --------------------------------------------------------

create table if not exists public.staff_login_events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  event text not null,
  ip_hash text,
  user_agent text,
  created_at timestamptz not null default now(),
  constraint staff_login_events_event_check check (
    event in ('success', 'failure', 'mfa_success', 'mfa_failure', 'recovery_used', 'reauth', 'logout')
  )
);


-- Compatibility if a partial run already made this table.
alter table public.staff_login_events
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists event text,
  add column if not exists ip_hash text,
  add column if not exists user_agent text,
  add column if not exists created_at timestamptz default now();
alter table public.staff_login_events alter column created_at set default now();

do $$
declare
  v_col record;
begin
  for v_col in
    select c.column_name
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'staff_login_events'
      and c.is_nullable = 'NO'
      and c.column_default is null
      and c.is_identity = 'NO'
      and c.is_generated <> 'ALWAYS'
      and c.column_name not in ('event')
      and not exists (
        select 1
        from pg_index i
        join pg_attribute a
          on a.attrelid = i.indrelid and a.attnum = any (i.indkey)
        where i.indrelid = 'public.staff_login_events'::regclass
          and i.indisprimary
          and a.attname = c.column_name
      )
  loop
    execute format(
      'alter table public.staff_login_events alter column %I drop not null',
      v_col.column_name
    );
  end loop;

  for v_col in
    select conname
    from pg_constraint
    where conrelid = 'public.staff_login_events'::regclass and contype = 'c'
  loop
    execute format('alter table public.staff_login_events drop constraint %I', v_col.conname);
  end loop;
end $$;

alter table public.staff_login_events
  add constraint staff_login_events_event_check check (
    event in ('success', 'failure', 'mfa_success', 'mfa_failure', 'recovery_used', 'reauth', 'logout')
  ) not valid;


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
  where table_schema = 'public' and table_name = 'staff_login_events' and column_name = 'id';

  if v_type is null or v_identity = 'YES' or v_default is not null then
    return;
  end if;

  if v_type = 'uuid' then
    execute 'alter table public.staff_login_events alter column id set default gen_random_uuid()';
  elsif v_type in ('bigint', 'integer', 'smallint') then
    v_seq := 'staff_login_events_id_seq';
    execute format('create sequence if not exists public.%I', v_seq);
    execute format(
      'alter table public.staff_login_events alter column id set default nextval(%L::regclass)',
      'public.' || v_seq
    );
    execute format(
      'select setval(%L::regclass, greatest(coalesce((select max(id) from public.staff_login_events), 0), 1), true)',
      'public.' || v_seq
    );
  end if;
end $$;

create index if not exists staff_login_events_user_created_idx
  on public.staff_login_events (user_id, created_at desc);

-- 3. Audit log -------------------------------------------------------------

create table if not exists public.staff_audit_log (
  id uuid primary key default gen_random_uuid(),
  staff_user_id uuid references auth.users(id) on delete set null,
  occurred_at timestamptz not null default now(),
  action text not null,
  target_type text not null,
  target_id text,
  purpose text,
  reason text,
  approval_id uuid,
  ip_hash text,
  user_agent text,
  details jsonb not null default '{}'::jsonb,
  constraint staff_audit_log_target_check check (
    target_type in (
      'staff', 'team', 'project', 'page', 'website', 'domain', 'billing',
      'invoice', 'payment', 'ai', 'email', 'marketing', 'consent',
      'approval', 'support_case', 'abuse', 'demo', 'setting', 'report', 'job'
    )
  )
);



-- Compatibility: an earlier draft used staff_id, a uuid target_id and narrow
-- purpose/action checks. Add the new columns and relax the old ones.
alter table public.staff_audit_log
  add column if not exists staff_user_id uuid references auth.users(id) on delete set null,
  add column if not exists occurred_at timestamptz default now(),
  add column if not exists action text,
  add column if not exists target_type text,
  add column if not exists target_id text,
  add column if not exists purpose text,
  add column if not exists reason text,
  add column if not exists approval_id uuid,
  add column if not exists ip_hash text,
  add column if not exists user_agent text,
  add column if not exists details jsonb default '{}'::jsonb,
  add column if not exists staff_id uuid,
  add column if not exists target_name text;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'staff_audit_log'
      and column_name = 'target_id' and data_type = 'uuid'
  ) then
    alter table public.staff_audit_log
      alter column target_id type text using target_id::text;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'staff_audit_log' and column_name = 'staff_id'
  ) then
    alter table public.staff_audit_log alter column staff_id drop not null;
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
  where table_schema = 'public' and table_name = 'staff_audit_log' and column_name = 'id';

  if v_type is null or v_identity = 'YES' or v_default is not null then
    return;
  end if;

  if v_type = 'uuid' then
    execute 'alter table public.staff_audit_log alter column id set default gen_random_uuid()';
  elsif v_type in ('bigint', 'integer', 'smallint') then
    v_seq := 'staff_audit_log_id_seq';
    execute format('create sequence if not exists public.%I', v_seq);
    execute format(
      'alter table public.staff_audit_log alter column id set default nextval(%L::regclass)',
      'public.' || v_seq
    );
    execute format(
      'select setval(%L::regclass, greatest(coalesce((select max(id) from public.staff_audit_log), 0), 1), true)',
      'public.' || v_seq
    );
  end if;
end $$;

alter table public.staff_audit_log
  alter column ip_hash drop not null,
  alter column purpose drop not null,
  alter column details set default '{}'::jsonb;

do $$
declare
  v_con text;
begin
  for v_con in
    select conname from pg_constraint
    where conrelid = 'public.staff_audit_log'::regclass and contype = 'c'
  loop
    execute format('alter table public.staff_audit_log drop constraint %I', v_con);
  end loop;
end $$;

alter table public.staff_audit_log
  add constraint staff_audit_log_target_check check (
    target_type in (
      'staff', 'team', 'project', 'page', 'website', 'domain', 'billing',
      'invoice', 'payment', 'ai', 'email', 'marketing', 'consent',
      'approval', 'support_case', 'abuse', 'demo', 'setting', 'report', 'job'
    )
  ) not valid;

create index if not exists staff_audit_log_staff_created_idx
  on public.staff_audit_log (staff_user_id, occurred_at desc);
create index if not exists staff_audit_log_target_idx
  on public.staff_audit_log (target_type, target_id, occurred_at desc);
create index if not exists staff_audit_log_created_idx
  on public.staff_audit_log (occurred_at desc);

-- Backfill the new staff key from the legacy platform_staff.id link, but only
-- when that legacy column exists. Drop the old guard first so a re-run can
-- repair rows after the trigger was installed.
drop trigger if exists staff_audit_log_no_update on public.staff_audit_log;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'platform_staff' and column_name = 'id'
  ) then
    update public.staff_audit_log a
    set staff_user_id = ps.user_id
    from public.platform_staff ps
    where a.staff_user_id is null
      and a.staff_id is not null
      and ps.id = a.staff_id
      and ps.user_id is not null;
  end if;
end $$;

create or replace function public.staff_audit_log_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'STAFF_AUDIT_APPEND_ONLY';
end;
$$;

drop trigger if exists staff_audit_log_no_update on public.staff_audit_log;
create trigger staff_audit_log_no_update
  before update or delete on public.staff_audit_log
  for each row execute function public.staff_audit_log_immutable();

-- Move the older moderation log into the new table, keeping history.
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'admin_audit_log'
  ) and not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'admin_audit_log_migrated'
  ) then
    insert into public.staff_audit_log (
      staff_user_id, occurred_at, action, target_type, target_id, reason, details
    )
    select
      null,
      a.created_at,
      a.action,
      case when a.project_id is null then 'website' else 'project' end,
      a.project_id::text,
      a.reason,
      coalesce(a.metadata, '{}'::jsonb)
        || jsonb_build_object('legacy_admin_email', a.admin_email)
    from public.admin_audit_log a;
    alter table public.admin_audit_log rename to admin_audit_log_migrated;
  end if;
end $$;

-- 4. Access windows --------------------------------------------------------

create table if not exists public.staff_access_sessions (
  id uuid primary key default gen_random_uuid(),
  staff_user_id uuid not null references auth.users(id) on delete cascade,
  team_id uuid references public.teams(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  case_id uuid,
  purpose text not null,
  opened_at timestamptz not null default now(),
  expires_at timestamptz not null,
  closed_at timestamptz,
  constraint staff_access_sessions_purpose_check check (
    purpose in (
      'support_case', 'billing_question', 'payment_issue', 'abuse_report',
      'customer_request', 'reporting'
    )
  )
);


-- Compatibility if a partial run already made this table.
alter table public.staff_access_sessions
  add column if not exists staff_user_id uuid references auth.users(id) on delete cascade,
  add column if not exists team_id uuid references public.teams(id) on delete cascade,
  add column if not exists project_id uuid references public.projects(id) on delete cascade,
  add column if not exists case_id uuid,
  add column if not exists purpose text,
  add column if not exists opened_at timestamptz default now(),
  add column if not exists expires_at timestamptz,
  add column if not exists closed_at timestamptz;
alter table public.staff_access_sessions alter column opened_at set default now();

do $$
declare
  v_col record;
begin
  for v_col in
    select c.column_name
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'staff_access_sessions'
      and c.is_nullable = 'NO'
      and c.column_default is null
      and c.is_identity = 'NO'
      and c.is_generated <> 'ALWAYS'
      and c.column_name not in ('staff_user_id', 'team_id', 'purpose', 'expires_at')
      and not exists (
        select 1
        from pg_index i
        join pg_attribute a
          on a.attrelid = i.indrelid and a.attnum = any (i.indkey)
        where i.indrelid = 'public.staff_access_sessions'::regclass
          and i.indisprimary
          and a.attname = c.column_name
      )
  loop
    execute format(
      'alter table public.staff_access_sessions alter column %I drop not null',
      v_col.column_name
    );
  end loop;

  for v_col in
    select conname
    from pg_constraint
    where conrelid = 'public.staff_access_sessions'::regclass and contype = 'c'
  loop
    execute format('alter table public.staff_access_sessions drop constraint %I', v_col.conname);
  end loop;
end $$;

alter table public.staff_access_sessions
  add constraint staff_access_sessions_purpose_check check (
    purpose in (
      'support_case', 'billing_question', 'payment_issue', 'abuse_report',
      'customer_request', 'reporting'
    )
  ) not valid;


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
  where table_schema = 'public' and table_name = 'staff_access_sessions' and column_name = 'id';

  if v_type is null or v_identity = 'YES' or v_default is not null then
    return;
  end if;

  if v_type = 'uuid' then
    execute 'alter table public.staff_access_sessions alter column id set default gen_random_uuid()';
  elsif v_type in ('bigint', 'integer', 'smallint') then
    v_seq := 'staff_access_sessions_id_seq';
    execute format('create sequence if not exists public.%I', v_seq);
    execute format(
      'alter table public.staff_access_sessions alter column id set default nextval(%L::regclass)',
      'public.' || v_seq
    );
    execute format(
      'select setval(%L::regclass, greatest(coalesce((select max(id) from public.staff_access_sessions), 0), 1), true)',
      'public.' || v_seq
    );
  end if;
end $$;

create index if not exists staff_access_sessions_staff_idx
  on public.staff_access_sessions (staff_user_id, opened_at desc);
create index if not exists staff_access_sessions_team_idx
  on public.staff_access_sessions (team_id, opened_at desc);

-- 5. Permission functions --------------------------------------------------

create or replace function public.staff_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role::text
  from public.platform_staff
  where user_id = auth.uid()
    and status::text = 'active'
  limit 1
$$;

create or replace function public.staff_has_mfa()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.platform_staff
    where user_id = auth.uid() and status = 'active'
  )
$$;

create or replace function public.staff_can(p_action text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when auth.role() = 'service_role' then true
    when not public.staff_has_mfa() then false
    else exists (
      select 1
      from public.platform_staff ps
      join public.staff_permissions sp on sp.role::text = ps.role::text
      where ps.user_id = auth.uid()
        and ps.status::text = 'active'
        and sp.action::text = p_action
        and sp.allowed
    )
  end
$$;

create or replace function public.staff_assert(p_action text)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' then
    return;
  end if;
  if public.staff_role() is null then
    raise exception 'NOT_STAFF';
  end if;
  if not public.staff_has_mfa() then
    raise exception 'STAFF_MFA_REQUIRED';
  end if;
  if not public.staff_can(p_action) then
    raise exception 'STAFF_NOT_ALLOWED';
  end if;
end;
$$;

-- 6. Audit and access helpers ---------------------------------------------

-- The draft used a bigint id here; text works with either shape.
drop function if exists public.staff_audit(text, text, text, text, text, uuid, jsonb, text, text);

create or replace function public.staff_audit(
  p_action text,
  p_target_type text,
  p_target_id text,
  p_purpose text default null,
  p_reason text default null,
  p_approval_id uuid default null,
  p_details jsonb default '{}'::jsonb,
  p_ip_hash text default null,
  p_user_agent text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id text;
  v_staff uuid;
begin
  if auth.role() <> 'service_role' and not public.is_staff() then
    raise exception 'NOT_STAFF';
  end if;
  v_staff := auth.uid();
  insert into public.staff_audit_log (
    staff_user_id, action, target_type, target_id, purpose, reason,
    approval_id, details, ip_hash, user_agent
  ) values (
    v_staff, p_action, p_target_type, p_target_id, p_purpose, p_reason,
    p_approval_id, coalesce(p_details, '{}'::jsonb), p_ip_hash, p_user_agent
  )
  returning id::text into v_id;
  return v_id;
end;
$$;

create or replace function public.staff_open_access(
  p_team_id uuid,
  p_purpose text,
  p_case_id uuid default null,
  p_ip_hash text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_purpose text := p_purpose;
begin
  perform public.staff_assert('account.view');
  if v_purpose not in (
    'support_case', 'billing_question', 'payment_issue', 'abuse_report',
    'customer_request', 'reporting'
  ) then
    raise exception 'INVALID_PURPOSE';
  end if;
  if not exists (select 1 from public.teams where id = p_team_id) then
    raise exception 'TEAM_NOT_FOUND';
  end if;

  update public.staff_access_sessions
    set closed_at = now()
    where staff_user_id = auth.uid()
      and team_id = p_team_id
      and closed_at is null;

  insert into public.staff_access_sessions (
    staff_user_id, team_id, case_id, purpose, expires_at
  ) values (
    auth.uid(), p_team_id, p_case_id, v_purpose, now() + interval '60 minutes'
  )
  returning id into v_id;

  perform public.staff_audit(
    'view', 'team', p_team_id::text, v_purpose,
    null, null, jsonb_build_object('access_session', v_id), p_ip_hash, null
  );

  insert into public.team_activity (
    team_id, actor_user_id, actor_name, actor_role, actor_kind,
    category, event, summary, coalesce_key, visibility
  )
  select
    p_team_id, null, 'Get-On', null, 'support',
    'team', 'staff_viewed',
    'Get-On customer success viewed your account details. Reason: '
      || replace(v_purpose, '_', ' ') || '.',
    'staff_viewed:' || to_char(now() at time zone 'utc', 'YYYY-MM-DD'),
    'team'
  where not exists (
    select 1 from public.team_activity a
    where a.team_id = p_team_id
      and a.coalesce_key = 'staff_viewed:'
        || to_char(now() at time zone 'utc', 'YYYY-MM-DD')
  );

  return v_id;
end;
$$;

create or replace function public.staff_close_access(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.staff_access_sessions
    set closed_at = now()
    where id = p_session_id
      and staff_user_id = auth.uid()
      and closed_at is null;
end;
$$;

-- 7. Bootstrap -------------------------------------------------------------

create or replace function public.bootstrap_super_admin(
  p_email text,
  p_allow_additional boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_existing int;
  v_admin_count int;
begin
  if current_user not in ('postgres', 'supabase_admin', 'service_role')
     and auth.role() is distinct from 'service_role' then
    raise exception 'NOT_ALLOWED';
  end if;

  select id into v_user
  from auth.users
  where lower(email) = lower(trim(p_email))
    and email_confirmed_at is not null
  limit 1;

  if v_user is null then
    raise exception 'USER_NOT_FOUND';
  end if;

  select count(*) into v_admin_count
  from public.platform_staff
  where role = 'super_admin' and status = 'active';

  if v_admin_count > 0 and not p_allow_additional then
    raise exception 'SUPER_ADMIN_EXISTS';
  end if;

  select count(*) into v_existing
  from public.platform_staff
  where user_id = v_user;

  update public.platform_staff
    set role = 'super_admin', status = 'active', added_via = 'bootstrap'
    where user_id = v_user;

  if not found then
    update public.platform_staff
      set user_id = v_user,
          role = 'super_admin',
          status = 'active',
          added_via = 'bootstrap'
      where user_id is null
        and email is not null
        and lower(email) = lower(trim(p_email));
    if found then
      v_existing := 1;
    else
      insert into public.platform_staff (user_id, role, status, added_via)
      values (v_user, 'super_admin', 'active', 'bootstrap')
      on conflict (user_id) do update
        set role = 'super_admin', status = 'active';
    end if;
  end if;

  insert into public.staff_audit_log (
    staff_user_id, action, target_type, target_id, purpose, details
  ) values (
    v_user, 'bootstrap', 'staff', v_user::text, 'write',
    jsonb_build_object('email', lower(trim(p_email)), 'existing', v_existing > 0)
  );

  return v_user;
end;
$$;

-- 8. RLS and grants --------------------------------------------------------

alter table public.platform_staff enable row level security;
alter table public.staff_permissions enable row level security;
alter table public.staff_login_events enable row level security;
alter table public.staff_audit_log enable row level security;
alter table public.staff_access_sessions enable row level security;

drop policy if exists "staff read own record" on public.platform_staff;
create policy "staff read own record"
  on public.platform_staff
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "staff read permissions" on public.staff_permissions;
create policy "staff read permissions"
  on public.staff_permissions
  for select to authenticated
  using (true);

drop policy if exists "staff read own login events" on public.staff_login_events;
create policy "staff read own login events"
  on public.staff_login_events
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "super admins read audit log" on public.staff_audit_log;
create policy "super admins read audit log"
  on public.staff_audit_log
  for select to authenticated
  using (public.staff_can('staff.audit.view'::text));

drop policy if exists "staff read own access sessions" on public.staff_access_sessions;
create policy "staff read own access sessions"
  on public.staff_access_sessions
  for select to authenticated
  using (staff_user_id = auth.uid());

revoke all on public.platform_staff from anon;
revoke all on public.staff_permissions from anon;
revoke all on public.staff_login_events from anon;
revoke all on public.staff_audit_log from anon;
revoke all on public.staff_access_sessions from anon;

grant select on public.platform_staff to authenticated;
grant select on public.staff_permissions to authenticated;
grant select on public.staff_login_events to authenticated;
grant select on public.staff_audit_log to authenticated;
grant select on public.staff_access_sessions to authenticated;

grant all on public.platform_staff to service_role;
grant all on public.staff_permissions to service_role;
grant all on public.staff_login_events to service_role;
grant all on public.staff_audit_log to service_role;
grant all on public.staff_access_sessions to service_role;

revoke all on function public.staff_role() from public;
revoke all on function public.staff_has_mfa() from public;
revoke all on function public.is_staff() from public;
revoke all on function public.staff_can(text) from public;
revoke all on function public.staff_assert(text) from public;
revoke all on function public.staff_audit(text, text, text, text, text, uuid, jsonb, text, text) from public;
revoke all on function public.staff_open_access(uuid, text, uuid, text) from public;
revoke all on function public.staff_close_access(uuid) from public;
revoke all on function public.bootstrap_super_admin(text, boolean) from public;

grant execute on function public.staff_role() to authenticated, service_role;
grant execute on function public.staff_has_mfa() to authenticated, service_role;
grant execute on function public.is_staff() to authenticated, service_role;
grant execute on function public.staff_can(text) to authenticated, service_role;
grant execute on function public.staff_assert(text) to authenticated, service_role;
grant execute on function public.staff_audit(text, text, text, text, text, uuid, jsonb, text, text) to authenticated, service_role;
grant execute on function public.staff_open_access(uuid, text, uuid, text) to authenticated, service_role;
grant execute on function public.staff_close_access(uuid) to authenticated, service_role;
grant execute on function public.bootstrap_super_admin(text, boolean) to service_role;
