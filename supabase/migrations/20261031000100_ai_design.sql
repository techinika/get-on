-- Part C: AI design preferences, reports, history and unsupported requests.

alter table public.projects
  add column if not exists design_spec jsonb,
  add column if not exists renderer_version text,
  add column if not exists needs_manual_publish boolean not null default false;

alter table public.project_settings
  add column if not exists design_prefs jsonb not null default '{}'::jsonb;

create table if not exists public.ai_design_reports (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.ai_requests(id) on delete set null,
  team_id uuid not null references public.teams(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  spec jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  accuracy numeric(5, 4) not null default 0,
  weights jsonb not null default '{"must":3,"should":2,"nice":1}'::jsonb,
  unmet jsonb not null default '[]'::jsonb,
  unsupported jsonb not null default '[]'::jsonb,
  archetype text,
  variants jsonb not null default '{}'::jsonb,
  rounds integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists ai_design_reports_team_idx
  on public.ai_design_reports (team_id, created_at desc);
create index if not exists ai_design_reports_project_idx
  on public.ai_design_reports (project_id, created_at desc);

create table if not exists public.ai_design_history (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  request_id uuid,
  instruction text not null,
  archetype text not null,
  hero text,
  palette_family text,
  font_pair text,
  header text,
  rhythm text,
  theme jsonb not null default '{}'::jsonb,
  footer jsonb,
  hero_layout text,
  spec jsonb not null default '{}'::jsonb,
  report jsonb not null default '{}'::jsonb,
  changes jsonb not null default '[]'::jsonb,
  applied_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists ai_design_history_team_idx
  on public.ai_design_history (team_id, created_at desc);
create index if not exists ai_design_history_project_idx
  on public.ai_design_history (project_id, created_at desc);

create table if not exists public.ai_unsupported_requests (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  text text not null,
  nearest text,
  count integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_unsupported_text_length check (char_length(text) between 1 and 300)
);

create unique index if not exists ai_unsupported_requests_team_text_idx
  on public.ai_unsupported_requests (team_id, lower(text));

create index if not exists ai_unsupported_requests_team_idx
  on public.ai_unsupported_requests (team_id, updated_at desc);

alter table public.ai_design_reports enable row level security;
alter table public.ai_design_history enable row level security;
alter table public.ai_unsupported_requests enable row level security;

drop policy if exists "owners admins read design reports" on public.ai_design_reports;
create policy "owners admins read design reports"
  on public.ai_design_reports
  for select
  using (public.user_has_team_role(team_id, array['owner', 'admin']));

drop policy if exists "owners admins read design history" on public.ai_design_history;
create policy "owners admins read design history"
  on public.ai_design_history
  for select
  using (public.user_has_team_role(team_id, array['owner', 'admin']));

drop policy if exists "owners admins read unsupported design requests" on public.ai_unsupported_requests;
create policy "owners admins read unsupported design requests"
  on public.ai_unsupported_requests
  for select
  using (public.user_has_team_role(team_id, array['owner', 'admin']));

revoke all on public.ai_design_reports from anon, authenticated;
revoke all on public.ai_design_history from anon, authenticated;
revoke all on public.ai_unsupported_requests from anon, authenticated;

grant select on public.ai_design_reports to authenticated;
grant select on public.ai_design_history to authenticated;
grant select on public.ai_unsupported_requests to authenticated;
grant all on public.ai_design_reports to service_role;
grant all on public.ai_design_history to service_role;
grant all on public.ai_unsupported_requests to service_role;

drop trigger if exists ai_unsupported_requests_touch_updated_at on public.ai_unsupported_requests;
create trigger ai_unsupported_requests_touch_updated_at
  before update on public.ai_unsupported_requests
  for each row
  execute function public.touch_updated_at();
