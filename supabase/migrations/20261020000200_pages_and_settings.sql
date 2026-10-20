-- Pages, project settings, and web-address availability (UI Spec v1 §6–§8)

alter table public.projects
  add column if not exists settings jsonb not null default '{}'::jsonb;

create table if not exists public.pages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  path text not null,
  position integer not null default 0,
  is_homepage boolean not null default false,
  blocks jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (project_id, path)
);

create index if not exists pages_project_position_idx
  on public.pages (project_id, position);

alter table public.pages enable row level security;

create policy "members can read pages"
  on public.pages
  for select
  using (
    exists (
      select 1
      from public.projects p
      join public.team_members tm on tm.team_id = p.team_id
      where p.id = pages.project_id
        and tm.user_id = auth.uid()
    )
  );

create policy "owners admins editors write pages"
  on public.pages
  for all
  using (
    exists (
      select 1
      from public.projects p
      join public.team_members tm on tm.team_id = p.team_id
      where p.id = pages.project_id
        and tm.user_id = auth.uid()
        and tm.role in ('owner', 'admin', 'editor')
    )
  )
  with check (
    exists (
      select 1
      from public.projects p
      join public.team_members tm on tm.team_id = p.team_id
      where p.id = pages.project_id
        and tm.user_id = auth.uid()
        and tm.role in ('owner', 'admin', 'editor')
    )
  );

-- Availability check: not taken by a project and not reserved.
create or replace function public.is_subdomain_available(candidate text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select not exists (select 1 from public.projects where subdomain = candidate)
     and not exists (select 1 from public.reserved_subdomains where name = candidate);
$$;
