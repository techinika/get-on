-- Support cases: customers raise a case, staff keep notes, the SLA clock runs
-- from the plan's response time.

alter table public.plans
  add column if not exists support_response_hours int not null default 96;

update public.plans set support_response_hours = case id
  when 'free' then 96
  when 'basic' then 48
  when 'pro' then 24
  when 'enterprise' then 4
  else support_response_hours
end
where id in ('free', 'basic', 'pro', 'enterprise');

create table if not exists public.support_cases (
  id uuid primary key default gen_random_uuid(),
  number bigint generated always as identity unique,
  team_id uuid not null references public.teams(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  opened_by uuid references auth.users(id) on delete set null,
  kind text not null default 'general',
  subject text not null,
  status text not null default 'open',
  priority text not null default 'normal',
  assigned_to uuid references auth.users(id) on delete set null,
  sla_hours int not null default 96,
  due_at timestamptz not null,
  first_response_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  escalated_at timestamptz,
  csat int,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint support_cases_kind_check check (
    kind in ('general', 'billing', 'technical', 'account', 'abuse', 'feature')
  ),
  constraint support_cases_status_check check (
    status in ('open', 'waiting_customer', 'waiting_staff', 'resolved', 'closed')
  ),
  constraint support_cases_priority_check check (
    priority in ('low', 'normal', 'high', 'urgent')
  ),
  constraint support_cases_csat_check check (csat is null or csat between 1 and 5),
  constraint support_cases_subject_check check (char_length(trim(subject)) between 3 and 200)
);


-- Compatibility with the first draft case table (title/created_by shape).
alter table public.support_cases
  add column if not exists number bigint generated always as identity,
  add column if not exists subject text,
  add column if not exists project_id uuid references public.projects(id) on delete set null,
  add column if not exists opened_by uuid references auth.users(id) on delete set null,
  add column if not exists sla_hours int default 96,
  add column if not exists due_at timestamptz,
  add column if not exists first_response_at timestamptz,
  add column if not exists escalated_at timestamptz,
  add column if not exists csat int,
  add column if not exists tags text[] default '{}',
  add column if not exists updated_at timestamptz default now();

do $$
declare
  v_con text;
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'support_cases' and column_name = 'title') then
    alter table public.support_cases alter column title drop not null;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'support_cases' and column_name = 'created_by') then
    alter table public.support_cases alter column created_by drop not null;
  end if;

  for v_con in
    select conname from pg_constraint
    where conrelid = 'public.support_cases'::regclass
      and contype = 'f'
      and pg_get_constraintdef(oid) like '%assigned_to%'
  loop
    execute format('alter table public.support_cases drop constraint %I', v_con);
  end loop;
end $$;

do $$
declare
  v_con text;
begin
  for v_con in
    select conname from pg_constraint
    where conrelid = 'public.support_cases'::regclass and contype = 'c'
  loop
    execute format('alter table public.support_cases drop constraint %I', v_con);
  end loop;
end $$;

alter table public.support_cases
  add constraint support_cases_status_check check (
    status in (
      'open', 'in_progress', 'waiting_customer', 'waiting_staff',
      'resolved', 'closed'
    )
  ) not valid;
alter table public.support_cases
  add constraint support_cases_priority_check check (
    priority in ('low', 'normal', 'medium', 'high', 'urgent')
  ) not valid;
alter table public.support_cases
  add constraint support_cases_kind_check check (
    kind in (
      'general', 'billing', 'technical', 'account', 'abuse',
      'feature', 'question', 'bug', 'other'
    )
  ) not valid;
alter table public.support_cases
  add constraint support_cases_csat_check check (csat is null or csat between 1 and 5) not valid;


do $$
declare
  v_col record;
begin
  for v_col in
    select c.column_name
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'support_cases'
      and c.is_nullable = 'NO'
      and c.column_default is null
      and c.is_identity = 'NO'
      and c.is_generated <> 'ALWAYS'
      and c.column_name not in ('team_id', 'subject', 'due_at')
      and not exists (
        select 1 from pg_index i
        join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any (i.indkey)
        where i.indrelid = 'public.support_cases'::regclass
          and i.indisprimary and a.attname = c.column_name
      )
  loop
    execute format('alter table public.support_cases alter column %I drop not null', v_col.column_name);
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
  where table_schema = 'public' and table_name = 'support_cases' and column_name = 'id';

  if v_type is null or v_identity = 'YES' or v_default is not null then
    return;
  end if;

  if v_type = 'uuid' then
    execute 'alter table public.support_cases alter column id set default gen_random_uuid()';
  elsif v_type in ('bigint', 'integer', 'smallint') then
    v_seq := 'support_cases_id_seq';
    execute format('create sequence if not exists public.%I', v_seq);
    execute format(
      'alter table public.support_cases alter column id set default nextval(%L::regclass)',
      'public.' || v_seq
    );
    execute format(
      'select setval(%L::regclass, greatest(coalesce((select max(id) from public.support_cases), 0), 1), true)',
      'public.' || v_seq
    );
  end if;
end $$;


-- A legacy case number must be able to fill itself too.
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
  where table_schema = 'public' and table_name = 'support_cases' and column_name = 'number';

  if v_type is null or v_identity = 'YES' or v_default is not null then
    return;
  end if;

  if v_type in ('bigint', 'integer', 'smallint') then
    v_seq := 'support_cases_number_seq';
    execute format('create sequence if not exists public.%I', v_seq);
    execute format(
      'alter table public.support_cases alter column number set default nextval(%L::regclass)',
      'public.' || v_seq
    );
    execute format(
      'select setval(%L::regclass, greatest(coalesce((select max(number) from public.support_cases), 0), 1), true)',
      'public.' || v_seq
    );
  end if;
end $$;

create unique index if not exists support_cases_number_key
  on public.support_cases (number);

create index if not exists support_cases_team_created_idx
  on public.support_cases (team_id, created_at desc);
create index if not exists support_cases_open_idx
  on public.support_cases (status, due_at)
  where status in ('open', 'waiting_customer', 'waiting_staff');
create index if not exists support_cases_assigned_idx
  on public.support_cases (assigned_to, status);

create table if not exists public.case_notes (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.support_cases(id) on delete cascade,
  author_user_id uuid references auth.users(id) on delete set null,
  author_kind text not null default 'customer',
  body text not null,
  internal boolean not null default false,
  created_at timestamptz not null default now(),
  constraint case_notes_author_kind_check check (author_kind in ('customer', 'staff', 'system')),
  constraint case_notes_body_check check (char_length(trim(body)) between 1 and 10000)
);

create index if not exists case_notes_case_created_idx
  on public.case_notes (case_id, created_at);

create table if not exists public.case_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.support_cases(id) on delete cascade,
  type text not null,
  message text,
  staff_user_id uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  constraint case_events_type_check check (
    type in (
      'created', 'status_change', 'assigned', 'escalated', 'note_added',
      'message_sent', 'sla_warning', 'sla_breached', 'resolved', 'closed',
      'reopened', 'csat'
    )
  )
);


-- Compatibility with the first draft event table.
alter table public.case_events
  add column if not exists staff_user_id uuid references auth.users(id) on delete set null;
alter table public.case_events drop constraint if exists case_events_type_check;
do $$
declare
  v_col record;
begin
  for v_col in
    select c.column_name
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'case_events'
      and c.is_nullable = 'NO'
      and c.column_default is null
      and c.is_identity = 'NO'
      and c.is_generated <> 'ALWAYS'
      and c.column_name not in ('case_id', 'type')
      and not exists (
        select 1 from pg_index i
        join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any (i.indkey)
        where i.indrelid = 'public.case_events'::regclass
          and i.indisprimary and a.attname = c.column_name
      )
  loop
    execute format('alter table public.case_events alter column %I drop not null', v_col.column_name);
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
  where table_schema = 'public' and table_name = 'case_events' and column_name = 'id';

  if v_type is null or v_identity = 'YES' or v_default is not null then
    return;
  end if;

  if v_type = 'uuid' then
    execute 'alter table public.case_events alter column id set default gen_random_uuid()';
  elsif v_type in ('bigint', 'integer', 'smallint') then
    v_seq := 'case_events_id_seq';
    execute format('create sequence if not exists public.%I', v_seq);
    execute format(
      'alter table public.case_events alter column id set default nextval(%L::regclass)',
      'public.' || v_seq
    );
    execute format(
      'select setval(%L::regclass, greatest(coalesce((select max(id) from public.case_events), 0), 1), true)',
      'public.' || v_seq
    );
  end if;
end $$;

create index if not exists case_events_case_occurred_idx
  on public.case_events (case_id, occurred_at desc);

-- Create ---------------------------------------------------------------

create or replace function public.support_case_create(
  p_team_id uuid,
  p_kind text,
  p_subject text,
  p_body text,
  p_project_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_hours int := 96;
  v_plan text;
  v_is_staff boolean := public.is_staff();
begin
  if not v_is_staff and not public.user_is_team_member(p_team_id) then
    raise exception 'NOT_ALLOWED';
  end if;
  if char_length(trim(coalesce(p_subject, ''))) < 3 then
    raise exception 'CASE_SUBJECT';
  end if;

  select t.plan_id, coalesce(p.support_response_hours, 96)
    into v_plan, v_hours
  from public.teams t
  join public.plans p on p.id = t.plan_id
  where t.id = p_team_id;
  if v_plan is null then
    raise exception 'TEAM_NOT_FOUND';
  end if;

  insert into public.support_cases (
    team_id, project_id, opened_by, kind, subject, sla_hours, due_at
  ) values (
    p_team_id, p_project_id, auth.uid(), coalesce(p_kind, 'general'),
    left(trim(p_subject), 200), v_hours, now() + make_interval(hours => v_hours)
  )
  returning id into v_id;

  insert into public.case_notes (case_id, author_user_id, author_kind, body)
  values (v_id, auth.uid(), case when v_is_staff then 'staff' else 'customer' end, left(p_body, 10000));

  insert into public.case_events (case_id, type, staff_user_id, message)
  values (v_id, 'created', case when v_is_staff then auth.uid() else null end, null);

  return v_id;
end;
$$;

-- Notes ----------------------------------------------------------------

create or replace function public.support_case_note(
  p_case_id uuid,
  p_body text,
  p_internal boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_case public.support_cases;
  v_is_staff boolean := public.is_staff();
begin
  select * into v_case from public.support_cases where id = p_case_id;
  if v_case.id is null then
    raise exception 'CASE_NOT_FOUND';
  end if;
  if not v_is_staff and not public.user_is_team_member(v_case.team_id) then
    raise exception 'NOT_ALLOWED';
  end if;
  if p_internal and not v_is_staff then
    raise exception 'NOT_ALLOWED';
  end if;

  insert into public.case_notes (case_id, author_user_id, author_kind, body, internal)
  values (
    p_case_id, auth.uid(),
    case when v_is_staff then 'staff' else 'customer' end,
    left(p_body, 10000), coalesce(p_internal, false)
  )
  returning id into v_id;

  if v_is_staff and v_case.first_response_at is null and not p_internal then
    update public.support_cases set first_response_at = now(), updated_at = now()
    where id = p_case_id;
  end if;

  insert into public.case_events (case_id, type, staff_user_id)
  values (p_case_id, 'note_added', case when v_is_staff then auth.uid() else null end);

  return v_id;
end;
$$;

-- Staff management -----------------------------------------------------

create or replace function public.support_case_update(
  p_case_id uuid,
  p_status text default null,
  p_assignee uuid default null,
  p_priority text default null,
  p_escalate boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_case public.support_cases;
begin
  perform public.staff_assert('support.case.view');
  select * into v_case from public.support_cases where id = p_case_id;
  if v_case.id is null then
    raise exception 'CASE_NOT_FOUND';
  end if;

  if p_status is not null then
    perform public.staff_assert(
      case when p_status in ('resolved', 'closed') then 'support.case.close' else 'support.case.assign' end
    );
  end if;
  if p_assignee is not null then
    perform public.staff_assert('support.case.assign');
  end if;
  if p_escalate then
    perform public.staff_assert('support.case.escalate');
  end if;

  update public.support_cases
    set status = coalesce(p_status, status),
        assigned_to = coalesce(p_assignee, assigned_to),
        priority = coalesce(p_priority, priority),
        escalated_at = case when p_escalate then now() else escalated_at end,
        resolved_at = case when p_status = 'resolved' then now() else resolved_at end,
        closed_at = case when p_status = 'closed' then now() else closed_at end,
        updated_at = now()
    where id = p_case_id;

  if p_status is not null and p_status <> v_case.status then
    insert into public.case_events (case_id, type, staff_user_id, message)
    values (
      p_case_id,
      case when p_status = 'resolved' then 'resolved' when p_status = 'closed' then 'closed' else 'status_change' end,
      auth.uid(), v_case.status || ' -> ' || p_status
    );
  elsif p_assignee is not null then
    insert into public.case_events (case_id, type, staff_user_id)
    values (p_case_id, 'assigned', auth.uid());
  elsif p_escalate then
    insert into public.case_events (case_id, type, staff_user_id)
    values (p_case_id, 'escalated', auth.uid());
  end if;
end;
$$;

create or replace function public.support_sla_check()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if auth.role() <> 'service_role' then
    raise exception 'NOT_ALLOWED';
  end if;
  insert into public.case_events (case_id, type, message)
  select c.id, 'sla_breached', 'First response was due ' || c.due_at::text
  from public.support_cases c
  where c.status in ('open', 'waiting_customer', 'waiting_staff')
    and c.first_response_at is null
    and c.due_at <= now()
    and not exists (
      select 1 from public.case_events e
      where e.case_id = c.id and e.type = 'sla_breached'
    );
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

alter table public.support_cases enable row level security;
alter table public.case_notes enable row level security;
alter table public.case_events enable row level security;

drop policy if exists "team members read own cases" on public.support_cases;
create policy "team members read own cases"
  on public.support_cases
  for select to authenticated
  using (public.user_is_team_member(team_id) or public.is_staff());

drop policy if exists "team members read own case notes" on public.case_notes;
create policy "team members read own case notes"
  on public.case_notes
  for select to authenticated
  using (
    public.is_staff()
    or (
      not internal
      and exists (
        select 1 from public.support_cases c
        where c.id = case_notes.case_id and public.user_is_team_member(c.team_id)
      )
    )
  );

drop policy if exists "team members read own case events" on public.case_events;
create policy "team members read own case events"
  on public.case_events
  for select to authenticated
  using (
    public.is_staff()
    or exists (
      select 1 from public.support_cases c
      where c.id = case_events.case_id and public.user_is_team_member(c.team_id)
    )
  );

revoke all on public.support_cases from anon;
revoke all on public.case_notes from anon;
revoke all on public.case_events from anon;
grant select on public.support_cases to authenticated;
grant select on public.case_notes to authenticated;
grant select on public.case_events to authenticated;
grant all on public.support_cases to service_role;
grant all on public.case_notes to service_role;
grant all on public.case_events to service_role;

revoke all on function public.support_case_create(uuid, text, text, text, uuid) from public;
revoke all on function public.support_case_note(uuid, text, boolean) from public;
revoke all on function public.support_case_update(uuid, text, uuid, text, boolean) from public;
revoke all on function public.support_sla_check() from public;

grant execute on function public.support_case_create(uuid, text, text, text, uuid) to authenticated, service_role;
grant execute on function public.support_case_note(uuid, text, boolean) to authenticated, service_role;
grant execute on function public.support_case_update(uuid, text, uuid, text, boolean) to authenticated, service_role;
grant execute on function public.support_sla_check() to service_role;
