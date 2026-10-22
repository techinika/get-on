-- Fix the row level security policies so authenticated requests stop failing
-- with "infinite recursion detected in policy for relation team_members"
-- (Postgres 42P17).
--
-- The policies on public.team_members read public.team_members inside their
-- own `using` expression. Postgres applies the policies of a table to the
-- sub-queries that read it, so the check re-entered itself and every read of
-- teams, projects, pages and media failed.
--
-- Membership checks now go through SECURITY DEFINER helpers. They read
-- team_members as the table owner, so RLS does not apply to the inner query
-- and the policies can no longer recurse. The helpers only ever report what
-- the calling user is allowed to see, so they stay safe to expose.

create or replace function public.user_is_team_member(target_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.team_members tm
    where tm.team_id = target_team_id
      and tm.user_id = auth.uid()
  );
$$;

create or replace function public.user_has_team_role(target_team_id uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.team_members tm
    where tm.team_id = target_team_id
      and tm.user_id = auth.uid()
      and tm.role = any (allowed_roles)
  );
$$;

create or replace function public.user_shares_team_with(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.team_members mine
    join public.team_members theirs on theirs.team_id = mine.team_id
    where mine.user_id = auth.uid()
      and theirs.user_id = target_user_id
  );
$$;

create or replace function public.user_can_access_project(
  target_project_id uuid,
  allowed_roles text[] default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.projects p
    join public.team_members tm on tm.team_id = p.team_id
    where p.id = target_project_id
      and tm.user_id = auth.uid()
      and (allowed_roles is null or tm.role = any (allowed_roles))
  );
$$;

create or replace function public.user_can_access_project_folder(
  target_folder text,
  allowed_roles text[] default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.projects p
    join public.team_members tm on tm.team_id = p.team_id
    where p.id::text = target_folder
      and tm.user_id = auth.uid()
      and (allowed_roles is null or tm.role = any (allowed_roles))
  );
$$;

create or replace function public.user_can_access_page(
  target_page_id uuid,
  allowed_roles text[] default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.pages pg
    join public.projects p on p.id = pg.project_id
    join public.team_members tm on tm.team_id = p.team_id
    where pg.id = target_page_id
      and tm.user_id = auth.uid()
      and (allowed_roles is null or tm.role = any (allowed_roles))
  );
$$;

revoke all on function public.user_is_team_member(uuid) from public;
revoke all on function public.user_has_team_role(uuid, text[]) from public;
revoke all on function public.user_shares_team_with(uuid) from public;
revoke all on function public.user_can_access_project(uuid, text[]) from public;
revoke all on function public.user_can_access_project_folder(text, text[]) from public;
revoke all on function public.user_can_access_page(uuid, text[]) from public;

grant execute on function public.user_is_team_member(uuid) to anon, authenticated, service_role;
grant execute on function public.user_has_team_role(uuid, text[]) to anon, authenticated, service_role;
grant execute on function public.user_shares_team_with(uuid) to anon, authenticated, service_role;
grant execute on function public.user_can_access_project(uuid, text[]) to anon, authenticated, service_role;
grant execute on function public.user_can_access_project_folder(text, text[]) to anon, authenticated, service_role;
grant execute on function public.user_can_access_page(uuid, text[]) to anon, authenticated, service_role;

-- Teams ---------------------------------------------------------------------

drop policy if exists "members can read teams" on public.teams;
create policy "members can read teams"
  on public.teams
  for select
  using (public.user_is_team_member(teams.id));

drop policy if exists "owners and admins can update teams" on public.teams;
create policy "owners and admins can update teams"
  on public.teams
  for update
  using (public.user_has_team_role(teams.id, array['owner', 'admin']))
  with check (public.user_has_team_role(teams.id, array['owner', 'admin']));

-- Team members -------------------------------------------------------------

drop policy if exists "members can read team members" on public.team_members;
create policy "members can read team members"
  on public.team_members
  for select
  using (public.user_is_team_member(team_members.team_id));

drop policy if exists "owners and admins manage team members" on public.team_members;
create policy "owners and admins manage team members"
  on public.team_members
  for all
  using (public.user_has_team_role(team_members.team_id, array['owner', 'admin']))
  with check (public.user_has_team_role(team_members.team_id, array['owner', 'admin']));

-- Projects -----------------------------------------------------------------

drop policy if exists "members can read projects" on public.projects;
create policy "members can read projects"
  on public.projects
  for select
  using (public.user_is_team_member(projects.team_id));

drop policy if exists "owners admins editors write projects" on public.projects;
create policy "owners admins editors write projects"
  on public.projects
  for all
  using (public.user_has_team_role(projects.team_id, array['owner', 'admin', 'editor']))
  with check (public.user_has_team_role(projects.team_id, array['owner', 'admin', 'editor']));

-- Pages --------------------------------------------------------------------

drop policy if exists "members can read pages" on public.pages;
create policy "members can read pages"
  on public.pages
  for select
  using (public.user_can_access_project(pages.project_id));

drop policy if exists "owners admins editors write pages" on public.pages;
create policy "owners admins editors write pages"
  on public.pages
  for all
  using (public.user_can_access_project(pages.project_id, array['owner', 'admin', 'editor']))
  with check (public.user_can_access_project(pages.project_id, array['owner', 'admin', 'editor']));

-- Media and page versions --------------------------------------------------

drop policy if exists "members can read media" on public.media;
create policy "members can read media"
  on public.media
  for select
  using (deleted_at is null and public.user_can_access_project(media.project_id));

drop policy if exists "editors can insert media" on public.media;
create policy "editors can insert media"
  on public.media
  for insert
  with check (public.user_can_access_project(media.project_id, array['owner', 'admin', 'editor']));

drop policy if exists "editors can update media" on public.media;
create policy "editors can update media"
  on public.media
  for update
  using (public.user_can_access_project(media.project_id, array['owner', 'admin', 'editor']));

drop policy if exists "owners admins can delete media" on public.media;
create policy "owners admins can delete media"
  on public.media
  for delete
  using (public.user_can_access_project(media.project_id, array['owner', 'admin']));

drop policy if exists "members can read page_versions" on public.page_versions;
create policy "members can read page_versions"
  on public.page_versions
  for select
  using (public.user_can_access_page(page_versions.page_id));

drop policy if exists "editors can insert page_versions" on public.page_versions;
create policy "editors can insert page_versions"
  on public.page_versions
  for insert
  with check (public.user_can_access_page(page_versions.page_id, array['owner', 'admin', 'editor']));

-- Profiles -----------------------------------------------------------------

drop policy if exists "team members can read teammate profiles" on public.profiles;
create policy "team members can read teammate profiles"
  on public.profiles
  for select
  using (public.user_shares_team_with(profiles.id));

-- Project settings ---------------------------------------------------------

create table if not exists public.project_settings (
  project_id uuid primary key references public.projects(id) on delete cascade,
  theme jsonb not null default '{"palette":"fresh-green","fontPair":"friendly","corners":"soft","colorMode":"light"}'::jsonb,
  logo_dark_url text,
  show_watermark boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.project_settings enable row level security;

drop policy if exists "members can read project settings" on public.project_settings;
create policy "members can read project settings"
  on public.project_settings
  for select
  using (public.user_can_access_project(project_settings.project_id));

drop policy if exists "owners admins editors write project settings" on public.project_settings;
create policy "owners admins editors write project settings"
  on public.project_settings
  for all
  using (public.user_can_access_project(project_settings.project_id, array['owner', 'admin', 'editor']))
  with check (public.user_can_access_project(project_settings.project_id, array['owner', 'admin', 'editor']));

-- Storage ------------------------------------------------------------------

drop policy if exists "team can upload project media" on storage.objects;
create policy "team can upload project media"
  on storage.objects
  for insert
  with check (
    bucket_id = 'project-media' and
    public.user_can_access_project_folder(
      (storage.foldername(name))[1],
      array['owner', 'admin', 'editor']
    )
  );

drop policy if exists "editors can update project media" on storage.objects;
create policy "editors can update project media"
  on storage.objects
  for update
  using (
    bucket_id = 'project-media' and
    public.user_can_access_project_folder(
      (storage.foldername(name))[1],
      array['owner', 'admin', 'editor']
    )
  );

drop policy if exists "owners admins can delete project media" on storage.objects;
create policy "owners admins can delete project media"
  on storage.objects
  for delete
  using (
    bucket_id = 'project-media' and
    public.user_can_access_project_folder(
      (storage.foldername(name))[1],
      array['owner', 'admin']
    )
  );
