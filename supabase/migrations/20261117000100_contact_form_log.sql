-- Contact form submission log: every attempt at /_forms/{formId} leaves a
-- visible record so nothing is silently dropped. Contains no message content
-- and no IP address (only the salted hash already used for rate limits).
create table if not exists public.form_submission_log (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  form_id text not null,
  received_at timestamptz not null default now(),
  result text not null check (
    result in (
      'stored','stored_spam','stored_duplicate','honeypot_dropped',
      'rate_limited','invalid','closed','not_found','unauthorised','error'
    )
  ),
  reason text,
  spam_score int not null default 0,
  duration_ms int not null default 0,
  host_kind text,
  trace_id text
);

create index if not exists form_submission_log_project_received_idx
  on public.form_submission_log (project_id, received_at desc);
create index if not exists form_submission_log_result_idx
  on public.form_submission_log (result, received_at desc);

alter table public.form_submission_log enable row level security;

drop policy if exists "form_submission_log_read_team" on public.form_submission_log;
create policy "form_submission_log_read_team"
  on public.form_submission_log
  for select to authenticated
  using (
    public.user_is_team_member(
      (select team_id from public.projects where id = project_id)
    )
  );

revoke all on public.form_submission_log from anon, authenticated;
grant select on public.form_submission_log to authenticated;
grant all on public.form_submission_log to service_role;

-- Duplicate flag on stored messages so a repeat submitter is visible in the
-- Messages page without triggering a second notification email.
alter table public.contact_messages
  add column if not exists duplicate boolean not null default false;

create index if not exists contact_messages_duplicate_idx
  on public.contact_messages (project_id, duplicate, created_at desc);
