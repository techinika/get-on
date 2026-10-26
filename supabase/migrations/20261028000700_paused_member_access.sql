-- Paused members keep their seat row but lose access to the team.
-- RLS helpers must only count active memberships.

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
      and tm.status = 'active'
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
      and tm.status = 'active'
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
      and mine.status = 'active'
      and theirs.status = 'active'
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
      and tm.status = 'active'
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
      and tm.status = 'active'
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
      and tm.status = 'active'
      and (allowed_roles is null or tm.role = any (allowed_roles))
  );
$$;
