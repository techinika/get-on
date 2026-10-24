-- Website settings expansion

alter table public.plans
  add column if not exists backup_auto_frequency text,
  add column if not exists backup_auto_keep int,
  add column if not exists backup_manual_max int,
  add column if not exists backup_storage_mb int,
  add column if not exists redirects_max int,
  add column if not exists exports_per_day int;

update public.plans set
  backup_auto_frequency = case id when 'free' then 'weekly' when 'basic' then 'daily' when 'pro' then 'daily' when 'enterprise' then 'daily' else 'weekly' end,
  backup_auto_keep = case id when 'free' then 1 when 'basic' then 7 when 'pro' then 14 when 'enterprise' then 30 else 1 end,
  backup_manual_max = case id when 'free' then 1 when 'basic' then 3 when 'pro' then 10 when 'enterprise' then 25 else 1 end,
  backup_storage_mb = case id when 'free' then 100 when 'basic' then 500 when 'pro' then 2048 when 'enterprise' then 10240 else 100 end,
  redirects_max = case id when 'free' then 3 when 'basic' then 25 when 'pro' then 100 when 'enterprise' then 500 else 3 end,
  exports_per_day = case id when 'free' then 3 when 'basic' then 5 when 'pro' then 10 when 'enterprise' then 20 else 3 end
where id in ('free','basic','pro','enterprise');

alter table public.project_settings
  add column if not exists tagline text not null default '',
  add column if not exists timezone text not null default 'UTC',
  add column if not exists address_parts jsonb not null default '{}'::jsonb,
  add column if not exists favicon_media_id uuid,
  add column if not exists theme_color text,
  add column if not exists seo_title_format text not null default '{page} | {site}',
  add column if not exists twitter_handle text,
  add column if not exists schema_type text,
  add column if not exists price_range text,
  add column if not exists area_served text,
  add column if not exists geo_lat real,
  add column if not exists geo_lng real,
  add column if not exists serves_cuisine text,
  add column if not exists accepts_reservations boolean not null default false,
  add column if not exists sitemap_include_images boolean not null default true,
  add column if not exists sitemap_checked_at timestamptz,
  add column if not exists sitemap_check jsonb,
  add column if not exists verification jsonb not null default '{}'::jsonb,
  add column if not exists ga jsonb not null default '{}'::jsonb,
  add column if not exists stats_enabled boolean not null default true,
  add column if not exists maintenance jsonb not null default '{}'::jsonb,
  add column if not exists custom_404 jsonb not null default '{}'::jsonb,
  add column if not exists google_search_console_confirmed boolean not null default false,
  add column if not exists last_backup_check_at timestamptz;

alter table public.media
  add column if not exists sha256 text;

create index if not exists media_project_sha_idx on public.media (project_id, sha256);

alter table public.projects
  add column if not exists deleted_at timestamptz,
  add column if not exists purge_after timestamptz,
  add column if not exists subdomain_hold_until timestamptz,
  add column if not exists deleted_by uuid,
  add column if not exists stats_site_key text,
  add column if not exists content_changed_at timestamptz default now();

update public.projects set stats_site_key = lower(substr(replace(gen_random_uuid()::text,'-',''),1,16)) where stats_site_key is null;
alter table public.projects alter column stats_site_key set not null;

create table if not exists public.redirects (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  from_path text not null,
  to_type text not null check (to_type in ('page','path','url')),
  to_page_id uuid references public.pages(id) on delete set null,
  to_value text,
  code int not null default 301 check (code in (301,302)),
  auto boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  hits int not null default 0,
  unique(project_id, from_path)
);

alter table public.redirects enable row level security;

create table if not exists public.project_operations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  kind text not null check (kind in ('publish','apply','import','restore','export','backup','transfer','delete')),
  heavy boolean not null default false,
  status text not null check (status in ('queued','running','done','failed','cancelled')),
  step text,
  progress int not null default 0,
  result jsonb,
  error_code text,
  error_message text,
  created_by uuid references auth.users(id),
  started_at timestamptz,
  finished_at timestamptz,
  heartbeat_at timestamptz default now(),
  expires_at timestamptz
);

create unique index if not exists project_operations_heavy_unique
  on public.project_operations (project_id)
  where heavy and status in ('queued','running');

create table if not exists public.project_activity (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  actor_user_id uuid references auth.users(id),
  event text not null,
  summary text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists project_activity_idx on public.project_activity (project_id, created_at desc);

create table if not exists public.backups (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  kind text not null check (kind in ('auto','manual','safety')),
  label text,
  status text not null check (status in ('building','ready','failed')),
  content_hash text,
  format_version int,
  json_bytes int,
  media_count int,
  media_bytes bigint,
  pictures_included boolean,
  page_count int,
  reason text,
  locked boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  r2_key text
);

create table if not exists public.backup_blobs (
  project_id uuid not null references public.projects(id) on delete cascade,
  sha256 text not null,
  mime text,
  bytes bigint,
  r2_key text,
  ref_count int not null default 1,
  created_at timestamptz not null default now(),
  orphaned_at timestamptz,
  primary key (project_id, sha256)
);

create table if not exists public.backup_media (
  backup_id uuid not null references public.backups(id) on delete cascade,
  sha256 text not null,
  kind text,
  meta jsonb,
  primary key (backup_id, sha256)
);

create table if not exists public.project_exports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  operation_id uuid,
  options jsonb,
  status text,
  r2_key text,
  bytes bigint,
  expires_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  download_count int not null default 0
);

create table if not exists public.project_imports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  team_id uuid references public.teams(id) on delete cascade,
  r2_key text,
  bytes bigint,
  status text check (status in ('uploaded','validated','applied','failed','expired')),
  summary jsonb,
  warnings jsonb,
  expires_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.ownership_transfers (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  from_team_id uuid not null references public.teams(id) on delete cascade,
  from_user_id uuid references auth.users(id),
  to_email text,
  to_team_id uuid references public.teams(id),
  mode text not null check (mode in ('own_team','invite')),
  status text not null check (status in ('pending','accepted','declined','cancelled','expired')),
  token_hash text unique,
  message text,
  expires_at timestamptz not null,
  resolved_at timestamptz,
  resolved_by uuid,
  result jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists ownership_transfers_one_pending
  on public.ownership_transfers (project_id)
  where status = 'pending';

create table if not exists public.released_subdomains (
  subdomain text primary key,
  hold_until timestamptz not null,
  released_at timestamptz not null default now()
);

alter table public.project_operations enable row level security;
alter table public.project_activity enable row level security;
alter table public.backups enable row level security;
alter table public.backup_blobs enable row level security;
alter table public.backup_media enable row level security;
alter table public.project_exports enable row level security;
alter table public.project_imports enable row level security;
alter table public.ownership_transfers enable row level security;
alter table public.redirects enable row level security;
alter table public.released_subdomains enable row level security;

create or replace function public.subdomain_available(p_name text)
returns boolean
language sql
stable
as $$
  select not exists (
    select 1 from public.projects where lower(subdomain)=lower(p_name) and deleted_at is null
  ) and not exists (
    select 1 from public.released_subdomains where lower(subdomain)=lower(p_name) and hold_until > now()
  )
$$;

-- Basic RLS policies
create policy "team members read redirects" on public.redirects for select using (public.user_can_access_project(project_id));
create policy "editors manage redirects" on public.redirects for all using (
  exists (select 1 from public.projects p join public.team_members tm on tm.team_id=p.team_id where p.id=redirects.project_id and tm.user_id=auth.uid() and tm.role in ('owner','admin','editor'))
) with check (
  exists (select 1 from public.projects p join public.team_members tm on tm.team_id=p.team_id where p.id=redirects.project_id and tm.user_id=auth.uid() and tm.role in ('owner','admin','editor'))
);

create policy "team members read activity" on public.project_activity for select using (public.user_can_access_project(project_id));
create policy "team members read operations" on public.project_operations for select using (public.user_can_access_project(project_id));
create policy "team members read backups" on public.backups for select using (public.user_can_access_project(project_id));
create policy "editors manage backups" on public.backups for all using (
  exists (select 1 from public.projects p join public.team_members tm on tm.team_id=p.team_id where p.id=backups.project_id and tm.user_id=auth.uid() and tm.role in ('owner','admin','editor'))
) with check (
  exists (select 1 from public.projects p join public.team_members tm on tm.team_id=p.team_id where p.id=backups.project_id and tm.user_id=auth.uid() and tm.role in ('owner','admin','editor'))
);

create policy "team members read exports" on public.project_exports for select using (public.user_can_access_project(project_id));
create policy "team members read imports" on public.project_imports for select using (
  exists (select 1 from public.teams t join public.team_members tm on tm.team_id=t.id where t.id=project_imports.team_id and tm.user_id=auth.uid())
);
create policy "team members read transfers" on public.ownership_transfers for select using (
  exists (select 1 from public.projects p join public.team_members tm on tm.team_id=p.team_id where p.id=ownership_transfers.project_id and tm.user_id=auth.uid()) or
  (lower(to_email)=lower((select email from auth.users where id=auth.uid())))
);

create or replace function public.begin_project_operation(p_project_id uuid, p_kind text, p_heavy boolean)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_heavy then
    if exists (select 1 from public.project_operations where project_id = p_project_id and heavy and status in ('queued','running')) then
      raise exception 'PROJECT_BUSY';
    end if;
  end if;
  insert into public.project_operations (project_id, kind, heavy, status, started_at, heartbeat_at)
  values (p_project_id, p_kind, p_heavy, 'running', now(), now())
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.begin_project_operation(uuid,text,boolean) from public;
grant execute on function public.begin_project_operation(uuid,text,boolean) to authenticated, service_role;
