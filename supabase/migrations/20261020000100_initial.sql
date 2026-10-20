create extension if not exists "pgcrypto";

create table if not exists public.plans (
  id text primary key,
  name text not null,
  price_usd_monthly numeric(10,2) not null,
  max_websites integer,
  max_pages_per_site integer,
  max_members integer,
  max_plugins integer,
  ai_credits_monthly integer not null,
  storage_mb integer not null,
  monthly_emails integer not null,
  custom_domain_allowed boolean not null,
  watermark_required boolean not null
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  plan_id text not null default 'free' references public.plans(id),
  is_personal boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'editor', 'viewer')),
  primary key (team_id, user_id)
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  name text not null,
  subdomain text not null unique,
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now()
);

create table if not exists public.reserved_subdomains (
  name text primary key
);

create unique index if not exists teams_one_free_team_per_owner_idx
  on public.teams (owner_id)
  where plan_id = 'free';

alter table public.plans enable row level security;
alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.projects enable row level security;
alter table public.reserved_subdomains enable row level security;

create policy "plans readable by everyone"
  on public.plans
  for select
  using (true);

create policy "reserved subdomains readable by everyone"
  on public.reserved_subdomains
  for select
  using (true);

create policy "users read own profile"
  on public.profiles
  for select
  using (auth.uid() = id);

create policy "users update own profile"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "members can read teams"
  on public.teams
  for select
  using (
    exists (
      select 1
      from public.team_members tm
      where tm.team_id = teams.id
        and tm.user_id = auth.uid()
    )
  );

create policy "owners and admins can update teams"
  on public.teams
  for update
  using (
    exists (
      select 1
      from public.team_members tm
      where tm.team_id = teams.id
        and tm.user_id = auth.uid()
        and tm.role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1
      from public.team_members tm
      where tm.team_id = teams.id
        and tm.user_id = auth.uid()
        and tm.role in ('owner', 'admin')
    )
  );

create policy "members can read team members"
  on public.team_members
  for select
  using (
    exists (
      select 1
      from public.team_members membership
      where membership.team_id = team_members.team_id
        and membership.user_id = auth.uid()
    )
  );

create policy "owners and admins manage team members"
  on public.team_members
  for all
  using (
    exists (
      select 1
      from public.team_members membership
      where membership.team_id = team_members.team_id
        and membership.user_id = auth.uid()
        and membership.role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1
      from public.team_members membership
      where membership.team_id = team_members.team_id
        and membership.user_id = auth.uid()
        and membership.role in ('owner', 'admin')
    )
  );

create policy "members can read projects"
  on public.projects
  for select
  using (
    exists (
      select 1
      from public.team_members tm
      where tm.team_id = projects.team_id
        and tm.user_id = auth.uid()
    )
  );

create policy "owners admins editors write projects"
  on public.projects
  for all
  using (
    exists (
      select 1
      from public.team_members tm
      where tm.team_id = projects.team_id
        and tm.user_id = auth.uid()
        and tm.role in ('owner', 'admin', 'editor')
    )
  )
  with check (
    exists (
      select 1
      from public.team_members tm
      where tm.team_id = projects.team_id
        and tm.user_id = auth.uid()
        and tm.role in ('owner', 'admin', 'editor')
    )
  );

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

  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', first_name));

  insert into public.teams (name, owner_id, plan_id, is_personal)
  values (format('%s''s Team', first_name), new.id, 'free', true)
  returning id into personal_team_id;

  insert into public.team_members (team_id, user_id, role)
  values (personal_team_id, new.id, 'owner');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute procedure public.handle_new_user();
