-- Email trace events: one row per logged stage so a single trace id follows an
-- email from trigger through SES send to the delivery webhook. Retained 14 days
-- and purged by the job:email-trace-purge job. Meta carries only non-sensitive
-- data; codes, tokens, links and full addresses are redacted by the logger
-- before they ever reach this table.
create table if not exists public.email_trace_events (
  id uuid primary key default gen_random_uuid(),
  trace_id text not null,
  occurred_at timestamptz not null default now(),
  stage text not null,
  level text not null default 'info',
  template text,
  stream text,
  outbox_id uuid,
  email_log_id uuid,
  reason text,
  code text,
  duration_ms int,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists email_trace_events_trace_idx
  on public.email_trace_events (trace_id, occurred_at desc);
create index if not exists email_trace_events_stage_idx
  on public.email_trace_events (stage, occurred_at desc);
create index if not exists email_trace_events_outbox_idx
  on public.email_trace_events (outbox_id);

-- One trace id follows an email from trigger through SES send to the delivery
-- webhook. Stored on the outbox row so the job can log every stage under it.
alter table public.notification_outbox
  add column if not exists trace_id text;

create index if not exists notification_outbox_trace_idx
  on public.notification_outbox (trace_id);

alter table public.email_trace_events enable row level security;

drop policy if exists "staff read email trace events" on public.email_trace_events;
create policy "staff read email trace events"
  on public.email_trace_events
  for select to authenticated
  using (public.is_staff());

revoke all on public.email_trace_events from anon, authenticated;
grant select on public.email_trace_events to authenticated;
grant all on public.email_trace_events to service_role;

-- Purge trace events older than 14 days.
create or replace function public.email_trace_purge()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.email_trace_events
  where occurred_at < now() - interval '14 days';
end;
$$;

grant execute on function public.email_trace_purge() to service_role;
