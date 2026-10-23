-- Publishing, SEO fields for published sites, moderation and the admin audit
-- trail. Run this after 20261022000200_seed_reference_data.sql.

-- Websites ------------------------------------------------------------------

alter table public.projects
  add column if not exists content_revision bigint not null default 0,
  add column if not exists review_state text not null default 'none',
  add column if not exists review_requested_at timestamptz,
  add column if not exists suspended_reason text,
  add column if not exists suspended_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'projects_review_state_check'
      and conrelid = 'public.projects'::regclass
  ) then
    alter table public.projects
      add constraint projects_review_state_check
      check (review_state in ('none', 'pending'));
  end if;
end
$$;

create index if not exists projects_review_state_idx
  on public.projects (review_state)
  where review_state = 'pending';

alter table public.pages
  add column if not exists is_hidden boolean not null default false,
  add column if not exists seo_title text,
  add column if not exists seo_description text,
  add column if not exists hide_from_search boolean not null default false,
  add column if not exists social_image_url text;

alter table public.project_settings
  add column if not exists seo_site_title text,
  add column if not exists seo_description text,
  add column if not exists social_image_url text,
  add column if not exists search_indexing boolean not null default true;

-- Publishing history --------------------------------------------------------

create table if not exists public.publishes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  status text not null default 'building'
    check (status in ('building', 'ready', 'failed', 'live', 'offline', 'superseded')),
  content_revision bigint not null default 0,
  snapshot jsonb not null default '{}'::jsonb,
  pages_count integer not null default 0,
  size_bytes bigint not null default 0,
  error_code text,
  error_message text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  live_at timestamptz
);

create index if not exists publishes_project_created_idx
  on public.publishes (project_id, created_at desc);

create unique index if not exists publishes_one_live_per_project_idx
  on public.publishes (project_id)
  where status = 'live';

alter table public.publishes enable row level security;

drop policy if exists "members can read publishes" on public.publishes;
create policy "members can read publishes"
  on public.publishes
  for select
  using (public.user_can_access_project(publishes.project_id));

drop policy if exists "editors can create publishes" on public.publishes;
create policy "editors can create publishes"
  on public.publishes
  for insert
  with check (
    public.user_can_access_project(
      publishes.project_id,
      array['owner', 'admin', 'editor']
    )
  );

drop policy if exists "editors can update publishes" on public.publishes;
create policy "editors can update publishes"
  on public.publishes
  for update
  using (
    public.user_can_access_project(
      publishes.project_id,
      array['owner', 'admin', 'editor']
    )
  )
  with check (
    public.user_can_access_project(
      publishes.project_id,
      array['owner', 'admin', 'editor']
    )
  );

-- Moderation ----------------------------------------------------------------

create table if not exists public.site_flags (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  kind text not null check (kind in ('report', 'review', 'suspension', 'manual')),
  reason text,
  notes text,
  admin_email text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null
);

create index if not exists site_flags_project_open_idx
  on public.site_flags (project_id, created_at desc)
  where resolved_at is null;

alter table public.site_flags enable row level security;

create table if not exists public.abuse_reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  site_name text not null,
  reason text not null
    check (reason in ('scam', 'impersonation', 'illegal', 'harmful', 'spam', 'other')),
  details text,
  reporter_email text,
  ip_hash text not null,
  status text not null default 'new' check (status in ('new', 'handled')),
  created_at timestamptz not null default now(),
  handled_at timestamptz,
  handled_by uuid references auth.users(id) on delete set null
);

create index if not exists abuse_reports_project_created_idx
  on public.abuse_reports (project_id, created_at desc);

create index if not exists abuse_reports_status_created_idx
  on public.abuse_reports (status, created_at desc);

alter table public.abuse_reports enable row level security;

create table if not exists public.admin_audit_log (
  id bigint generated always as identity primary key,
  admin_email text not null,
  action text not null,
  project_id uuid references public.projects(id) on delete set null,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_log_project_created_idx
  on public.admin_audit_log (project_id, created_at desc);

create index if not exists admin_audit_log_created_idx
  on public.admin_audit_log (created_at desc);

alter table public.admin_audit_log enable row level security;

-- Only the service role reads and writes moderation data. The server checks
-- ADMIN_EMAILS before it uses the service role, and every console action
-- writes an admin_audit_log row.

-- Content snapshots and change detection ------------------------------------

create or replace function public.project_content_snapshot(p_project_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'project', (
      select jsonb_build_object(
        'name', p.name,
        'subdomain', p.subdomain
      )
      from public.projects p
      where p.id = p_project_id
    ),
    'pages', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', pg.id,
            'title', pg.title,
            'path', pg.path,
            'position', pg.position,
            'is_homepage', pg.is_homepage,
            'show_in_menu', pg.show_in_menu,
            'is_hidden', pg.is_hidden,
            'blocks', pg.blocks,
            'revision', pg.revision,
            'seo_title', pg.seo_title,
            'seo_description', pg.seo_description,
            'hide_from_search', pg.hide_from_search,
            'social_image_url', pg.social_image_url
          )
          order by pg.position, pg.created_at, pg.id
        )
        from public.pages pg
        where pg.project_id = p_project_id
      ),
      '[]'::jsonb
    ),
    'settings', coalesce(
      (
        select to_jsonb(ps) - 'created_at' - 'updated_at'
        from public.project_settings ps
        where ps.project_id = p_project_id
      ),
      '{}'::jsonb
    )
  );
$$;

revoke all on function public.project_content_snapshot(uuid) from public;
grant execute on function public.project_content_snapshot(uuid) to service_role;

create or replace function public.project_has_unpublished_changes(p_project_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_live_revision bigint;
  v_current_revision bigint;
begin
  if auth.uid() is not null
     and not public.user_can_access_project(p_project_id) then
    raise exception 'not_authorized';
  end if;

  select p.content_revision into v_current_revision
  from public.projects p
  where p.id = p_project_id;

  if v_current_revision is null then
    raise exception 'project_not_found';
  end if;

  select pub.content_revision into v_live_revision
  from public.publishes pub
  where pub.project_id = p_project_id
    and pub.status = 'live'
  limit 1;

  return v_live_revision is null or v_live_revision <> v_current_revision;
end;
$$;

revoke all on function public.project_has_unpublished_changes(uuid) from public;
grant execute on function public.project_has_unpublished_changes(uuid)
  to authenticated, service_role;

create or replace function public.publish_rate_ok(
  p_project_id uuid,
  p_max integer default 10,
  p_window_minutes integer default 60
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_recent integer;
begin
  if not public.user_can_access_project(
    p_project_id,
    array['owner', 'admin', 'editor']
  ) then
    return false;
  end if;

  select count(*) into v_recent
  from public.publishes pub
  where pub.project_id = p_project_id
    and pub.created_at > now() - (p_window_minutes * interval '1 minute');

  return v_recent < p_max;
end;
$$;

revoke all on function public.publish_rate_ok(uuid, integer, integer) from public;
grant execute on function public.publish_rate_ok(uuid, integer, integer)
  to authenticated, service_role;

-- Every change to a page or to the site settings raises the content revision,
-- so "Live, with changes" is cheap to compute and can never be missed.

create or replace function public.bump_project_content_revision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_id uuid;
begin
  v_project_id := coalesce(new.project_id, old.project_id);

  update public.projects
  set content_revision = content_revision + 1,
      updated_at = now()
  where id = v_project_id;

  return coalesce(new, old);
end;
$$;

drop trigger if exists pages_bump_content_revision on public.pages;
create trigger pages_bump_content_revision
  after insert or update or delete on public.pages
  for each row
  execute function public.bump_project_content_revision();

drop trigger if exists project_settings_bump_content_revision on public.project_settings;
create trigger project_settings_bump_content_revision
  after insert or update or delete on public.project_settings
  for each row
  execute function public.bump_project_content_revision();

create or replace function public.bump_project_content_on_rename()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.name is distinct from old.name
     or new.subdomain is distinct from old.subdomain then
    new.content_revision := old.content_revision + 1;
  end if;
  return new;
end;
$$;

drop trigger if exists projects_bump_content_on_rename on public.projects;
create trigger projects_bump_content_on_rename
  before update of name, subdomain on public.projects
  for each row
  execute function public.bump_project_content_on_rename();

-- Owners and editors may edit the project row, but only the service role may
-- put a site under review or take it offline. This stops a moderated owner
-- from clearing their own moderation state.

create or replace function public.protect_project_moderation_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    if new.review_state is distinct from old.review_state
       or new.review_requested_at is distinct from old.review_requested_at
       or new.suspended_reason is distinct from old.suspended_reason
       or new.suspended_at is distinct from old.suspended_at then
      raise exception 'not_authorized';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists projects_protect_moderation_fields on public.projects;
create trigger projects_protect_moderation_fields
  before update on public.projects
  for each row
  execute function public.protect_project_moderation_fields();

-- Keep updated_at current for pages and settings.

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists pages_touch_updated_at on public.pages;
create trigger pages_touch_updated_at
  before update on public.pages
  for each row
  execute function public.touch_updated_at();

drop trigger if exists project_settings_touch_updated_at on public.project_settings;
create trigger project_settings_touch_updated_at
  before update on public.project_settings
  for each row
  execute function public.touch_updated_at();

-- The trigger functions never need to be called directly.

revoke all on function public.bump_project_content_revision() from public;
revoke all on function public.bump_project_content_on_rename() from public;
revoke all on function public.protect_project_moderation_fields() from public;
revoke all on function public.touch_updated_at() from public;
