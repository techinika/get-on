-- Dashboard refresh: track when a website was last changed and let team
-- members see each other's name and email address.

alter table public.projects
  add column if not exists updated_at timestamptz not null default now();

create index if not exists projects_team_updated_idx
  on public.projects (team_id, updated_at desc);

alter table public.pages
  add column if not exists updated_at timestamptz not null default now();

alter table public.profiles
  add column if not exists email text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  first_name text;
  personal_team_id uuid;
begin
  first_name := split_part(coalesce(new.raw_user_meta_data->>'full_name', new.email, 'there'), ' ', 1);

  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', first_name), new.email)
  on conflict (id) do update set email = excluded.email;

  insert into public.teams (name, owner_id, plan_id, is_personal)
  values (format('%s''s Team', first_name), new.id, 'free', true)
  returning id into personal_team_id;

  insert into public.team_members (team_id, user_id, role)
  values (personal_team_id, new.id, 'owner')
  on conflict (team_id, user_id) do nothing;

  return new;
end;
$$;

drop policy if exists "team members can read teammate profiles" on public.profiles;

create policy "team members can read teammate profiles"
  on public.profiles
  for select
  using (
    exists (
      select 1
      from public.team_members mine
      join public.team_members theirs on theirs.team_id = mine.team_id
      where mine.user_id = auth.uid()
        and theirs.user_id = profiles.id
    )
  );
