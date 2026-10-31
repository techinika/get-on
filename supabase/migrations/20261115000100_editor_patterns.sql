-- Saved editor patterns (v3 editor): a reusable subtree a team can insert again.
create table if not exists public.editor_patterns (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  created_by uuid null references auth.users(id) on delete set null,
  name text not null check (char_length(name) between 1 and 80),
  category text not null default 'My patterns' check (char_length(category) between 1 and 40),
  tags text[] not null default '{}',
  content jsonb not null,
  schema_version int not null default 5 check (schema_version = 5),
  usage_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists editor_patterns_team_idx
  on public.editor_patterns (team_id, updated_at desc);

alter table public.editor_patterns enable row level security;

drop policy if exists "editor_patterns_read" on public.editor_patterns;
create policy "editor_patterns_read" on public.editor_patterns
  for select using (public.user_is_team_member(team_id));

drop policy if exists "editor_patterns_insert" on public.editor_patterns;
create policy "editor_patterns_insert" on public.editor_patterns
  for insert with check (public.user_has_team_role(team_id, array['owner','admin','editor']));

drop policy if exists "editor_patterns_update" on public.editor_patterns;
create policy "editor_patterns_update" on public.editor_patterns
  for update using (public.user_has_team_role(team_id, array['owner','admin','editor']))
  with check (public.user_has_team_role(team_id, array['owner','admin','editor']));

drop policy if exists "editor_patterns_delete" on public.editor_patterns;
create policy "editor_patterns_delete" on public.editor_patterns
  for delete using (public.user_has_team_role(team_id, array['owner','admin','editor']));
