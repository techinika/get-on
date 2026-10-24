-- Templates system

alter table public.plans add column if not exists max_templates int;

update public.plans set max_templates = 1 where id = 'free';
update public.plans set max_templates = 3 where id = 'basic';
update public.plans set max_templates = 10 where id = 'pro';
update public.plans set max_templates = 50 where id = 'enterprise';

create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('system','team')),
  slug text null,
  team_id uuid null references public.teams(id) on delete cascade,
  created_by uuid null references auth.users(id) on delete set null,
  forked_from_template_id uuid null references public.templates(id) on delete set null,
  forked_from_version_id uuid null,
  name text not null,
  tagline text not null default '',
  description text not null default '',
  category text not null check (category in ('starter','software','professional','restaurant','shop','health-beauty','portfolio','community','education','other')),
  tags text[] not null default '{}',
  business_types text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft','published','archived')),
  plan_min text not null default 'free' check (plan_min in ('free','basic','pro','enterprise')),
  is_default boolean not null default false,
  featured boolean not null default false,
  sort int not null default 100,
  source text not null default 'code' check (source in ('code','admin','user')),
  current_version_id uuid null,
  page_count int not null default 0,
  uses_count int not null default 0,
  last_used_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint templates_team_required check ((kind = 'team' and team_id is not null) or (kind = 'system' and team_id is null)),
  constraint templates_slug_len check (slug is null or (char_length(slug) between 3 and 40 and slug ~ '^[a-z0-9][a-z0-9-]*$'))
);

create unique index if not exists templates_system_slug_unique on public.templates (slug) where slug is not null and kind = 'system' and deleted_at is null;
create unique index if not exists templates_one_default_system on public.templates ((1)) where is_default = true and kind = 'system' and deleted_at is null;
create index if not exists templates_team_idx on public.templates (team_id) where deleted_at is null;
create index if not exists templates_published_idx on public.templates (status, featured, sort) where status = 'published' and deleted_at is null;

alter table public.templates enable row level security;
drop policy if exists "templates_read" on public.templates;
create policy "templates_read" on public.templates for select using (
  (kind = 'system' and status = 'published' and deleted_at is null)
  or (
    kind = 'team' and deleted_at is null and team_id in (
      select team_id from public.team_members where user_id = auth.uid()
    )
  )
);
drop policy if exists "templates_write_team" on public.templates;
create policy "templates_write_team" on public.templates for all using (
  kind = 'team' and deleted_at is null and team_id in (
    select team_id from public.team_members where user_id = auth.uid() and role in ('owner','admin','editor')
  )
) with check (
  kind = 'team' and team_id in (
    select team_id from public.team_members where user_id = auth.uid() and role in ('owner','admin','editor')
  )
);
drop policy if exists "templates_delete_owner" on public.templates;
create policy "templates_delete_owner" on public.templates for delete using (
  kind = 'team' and team_id in (
    select team_id from public.team_members where user_id = auth.uid() and role = 'owner'
  )
);

create table if not exists public.template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.templates(id) on delete cascade,
  version int not null,
  package jsonb not null,
  package_hash text not null,
  schema_version int not null default 1,
  summary text,
  page_count int not null default 0,
  block_count int not null default 0,
  required_plugins text[] not null default '{}',
  fonts jsonb,
  asset_count int not null default 0,
  bytes int not null default 0,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (template_id, version)
);

alter table public.template_versions enable row level security;
drop policy if exists "template_versions_read" on public.template_versions;
create policy "template_versions_read" on public.template_versions for select using (
  exists (
    select 1 from public.templates t where t.id = template_versions.template_id
      and (
        (t.kind = 'system' and t.status = 'published' and t.deleted_at is null)
        or (t.kind = 'team' and t.deleted_at is null and t.team_id in (select team_id from public.team_members where user_id = auth.uid()))
      )
  )
);

create or replace function public.templates_prevent_default_delete()
returns trigger as $$
begin
  if old.is_default = true and old.kind = 'system' then
    raise exception 'DEFAULT_TEMPLATE_PROTECTED';
  end if;
  return old;
end;
$$ language plpgsql;

drop trigger if exists templates_prevent_default_delete on public.templates;
create trigger templates_prevent_default_delete before delete on public.templates for each row execute function public.templates_prevent_default_delete();

create or replace function public.templates_prevent_default_archive()
returns trigger as $$
begin
  if old.is_default = true and old.kind = 'system' and new.status in ('draft','archived') then
    raise exception 'DEFAULT_TEMPLATE_PROTECTED';
  end if;
  if new.is_default = true and new.kind = 'system' and new.status != 'published' then
    raise exception 'DEFAULT_TEMPLATE_PROTECTED';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists templates_prevent_default_archive on public.templates;
create trigger templates_prevent_default_archive before update on public.templates for each row execute function public.templates_prevent_default_archive();

create table if not exists public.template_assets (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.templates(id) on delete cascade,
  key text not null,
  storage_path text not null,
  mime text not null,
  width int not null,
  height int not null,
  bytes int not null,
  sha256 text not null,
  alt text not null default '',
  is_art boolean not null default false,
  owner_team_id uuid null references public.teams(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (template_id, key)
);

alter table public.template_assets enable row level security;
drop policy if exists "template_assets_read" on public.template_assets;
create policy "template_assets_read" on public.template_assets for select using (
  exists (
    select 1 from public.templates t where t.id = template_assets.template_id
      and (
        (t.kind = 'system' and t.status = 'published' and t.deleted_at is null)
        or (t.kind = 'team' and t.deleted_at is null and t.team_id in (select team_id from public.team_members where user_id = auth.uid()))
      )
  )
);

create table if not exists public.template_workspaces (
  template_id uuid primary key references public.templates(id) on delete cascade,
  project_id uuid unique not null references public.projects(id) on delete cascade,
  base_version_id uuid not null references public.template_versions(id) on delete restrict,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.template_workspaces enable row level security;
drop policy if exists "template_workspaces_read" on public.template_workspaces;
create policy "template_workspaces_read" on public.template_workspaces for select using (
  exists (
    select 1 from public.templates t where t.id = template_workspaces.template_id
      and t.deleted_at is null and t.team_id in (select team_id from public.team_members where user_id = auth.uid())
  )
);

alter table public.projects add column if not exists kind text not null default 'site';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'projects_kind_check') then
    alter table public.projects add constraint projects_kind_check check (kind in ('site','template_workspace'));
  end if;
end $$;
alter table public.projects add column if not exists template_origin jsonb;

create table if not exists public.site_snapshots (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  reason text not null check (reason in ('before_template','before_restore','manual')),
  label text,
  data jsonb not null,
  bytes int not null default 0,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days')
);

alter table public.site_snapshots enable row level security;
drop policy if exists "site_snapshots_read" on public.site_snapshots;
create policy "site_snapshots_read" on public.site_snapshots for select using (
  exists (
    select 1 from public.projects p where p.id = site_snapshots.project_id
      and p.kind = 'site'
      and exists (select 1 from public.team_members tm where tm.team_id = p.team_id and tm.user_id = auth.uid())
  )
);

create table if not exists public.template_applications (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  template_id uuid not null references public.templates(id) on delete restrict,
  version_id uuid not null references public.template_versions(id) on delete restrict,
  mode text not null check (mode in ('new','full','design','pages')),
  composition_id text,
  options jsonb,
  snapshot_id uuid null references public.site_snapshots(id) on delete set null,
  result jsonb,
  applied_by uuid null references auth.users(id) on delete set null,
  applied_at timestamptz not null default now()
);

alter table public.template_applications enable row level security;
drop policy if exists "template_applications_read" on public.template_applications;
create policy "template_applications_read" on public.template_applications for select using (
  exists (
    select 1 from public.projects p where p.id = template_applications.project_id
      and exists (select 1 from public.team_members tm where tm.team_id = p.team_id and tm.user_id = auth.uid())
  )
);

alter table public.media add column if not exists is_template_art boolean not null default false;
alter table public.media add column if not exists source_template_version_id uuid null;
alter table public.media add column if not exists template_asset_key text null;

create or replace function public.increment_template_use(p_template_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.templates
  set uses_count = uses_count + 1,
      last_used_at = now()
  where id = p_template_id and deleted_at is null;
end;
$$;

grant execute on function public.increment_template_use(uuid) to authenticated;
