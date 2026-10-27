-- Case events: event tracking for support cases (SLA timers, status changes)

create table if not exists public.case_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.support_cases(id) on delete cascade,
  occurred_at timestamptz not null default now(),
  type text not null,
  message text,
  staff_id uuid references public.platform_staff(id),
  metadata jsonb not null default '{}'::jsonb,
  constraint case_events_type_check check (type in ('status_change','sla_violation','note_added','file_upload','message_sent','assign','resolve','close'))
);

comment on table public.case_events is 'Event tracking for support cases (SLA, status changes, notes)';
comment on column public.case_events.type is 'status_change|sla_violation|note_added|file_upload|message_sent|assign|resolve|close';

-- Enable RLS
alter table public.case_events enable row level security;

-- Policy: team members can read events for their cases
create policy "team members can read own case events" on public.case_events
  for select using (
    exists (select 1 from public.team_members tm where tm.team_id = (
      select team_id from public.support_cases where id = case_id
    ) and tm.user_id = auth.uid() and tm.status = 'active')
  );

-- Policy: staff can read/write all events
grant all on public.case_events to service_role;

create index if not exists case_events_case_idx on public.case_events (case_id, occurred_at desc);
