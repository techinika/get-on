-- Share, backup, export, import and visitor statistics.

-- 1. Plan limits -----------------------------------------------------------

alter table public.plans
  add column if not exists site_zip_allowed boolean not null default false,
  add column if not exists site_zip_per_day int not null default 0,
  add column if not exists tracked_links_max int not null default 0;

update public.plans set
  site_zip_allowed = case id when 'free' then false when 'basic' then false when 'pro' then true when 'enterprise' then true else false end,
  site_zip_per_day = case id when 'free' then 0 when 'basic' then 0 when 'pro' then 3 when 'enterprise' then 20 else 0 end,
  tracked_links_max = case id when 'free' then 0 when 'basic' then 5 when 'pro' then 50 when 'enterprise' then 500 else 0 end
where id in ('free','basic','pro','enterprise');

create or replace function public.billing_plan_limits(p_plan text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_plan text := p_plan;
  v_limits jsonb;
begin
  if v_plan is null or not exists (select 1 from public.plans where id = v_plan) then
    v_plan := 'free';
  end if;
  select jsonb_build_object(
    'maxWebsites', p.max_websites,
    'maxPagesPerSite', p.max_pages_per_site,
    'maxMembers', p.max_members,
    'maxPlugins', p.max_plugins,
    'maxTemplates', p.max_templates,
    'maxCustomDomainsPerSite', p.custom_domains_per_site,
    'maxRedirects', p.max_redirects,
    'maxPreviewLinks', p.max_preview_links,
    'maxDeletedPending', p.max_deleted_pending,
    'storageMb', p.storage_mb,
    'monthlyEmails', p.monthly_emails,
    'aiMonthlyCredits', p.ai_monthly_credits,
    'aiDailyActions', p.ai_daily_actions,
    'formsMonthly', p.forms_monthly,
    'backups', jsonb_build_object(
      'autoFrequency', p.backup_auto_frequency,
      'autoKeep', p.backup_auto_keep,
      'manualMax', p.backup_manual_max,
      'storageMb', p.backup_storage_mb
    ),
    'exportsPerDay', p.exports_per_day,
    'siteZipAllowed', p.site_zip_allowed,
    'siteZipPerDay', p.site_zip_per_day,
    'trackedLinksMax', p.tracked_links_max,
    'support', p.support_priority,
    'watermark', p.watermark_required
  ) into v_limits
  from public.plans p
  where p.id = v_plan;
  return coalesce(v_limits, '{}'::jsonb);
end;
$$;

-- 2. Export, backup and settings columns ----------------------------------

alter table public.project_exports
  add column if not exists kind text not null default 'content',
  add column if not exists version_source text,
  add column if not exists mime text,
  add column if not exists file_name text,
  add column if not exists sha256 text,
  add column if not exists format_version int;

do $$ begin
  alter table public.project_exports add constraint project_exports_kind_check
    check (kind in ('content','backup','site_zip'));
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.project_exports add constraint project_exports_version_source_check
    check (version_source is null or version_source in ('draft','live'));
exception when duplicate_object then null;
end $$;

alter table public.backups
  add column if not exists messages_included boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

alter table public.project_settings
  add column if not exists link_defaults jsonb not null default '{"source":"direct","medium":"link"}'::jsonb;

-- 3. Tracked links ---------------------------------------------------------

create table if not exists public.tracked_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  code text not null unique,
  target_path text not null default '/',
  label text,
  source text not null default 'direct',
  medium text not null default 'link',
  campaign text,
  term text,
  content text,
  params jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  last_clicked_at timestamptz,
  constraint tracked_links_code_check check (code ~ '^[a-z2-9]{7,10}$'),
  constraint tracked_links_target_check check (
    target_path = '/'
    or (
      target_path like '/%'
      and target_path not like '//%'
      and target_path not like '%..%'
      and position(chr(92) in target_path) = 0
      and target_path !~ '[?#]'
      and target_path !~ '[\r\n]'
      and char_length(target_path) <= 500
    )
  )
);

create index if not exists tracked_links_project_created_idx
  on public.tracked_links (project_id, created_at desc);

alter table public.tracked_links enable row level security;

drop policy if exists "team members read tracked links" on public.tracked_links;
create policy "team members read tracked links" on public.tracked_links
  for select using (
    exists (
      select 1 from public.projects p
      where p.id = tracked_links.project_id
        and public.team_can(p.team_id, 'links.view')
    )
  );

drop policy if exists "editors manage tracked links" on public.tracked_links;
create policy "editors manage tracked links" on public.tracked_links
  for insert with check (
    exists (
      select 1 from public.projects p
      where p.id = tracked_links.project_id
        and public.team_can(p.team_id, 'links.manage')
    )
  );

drop policy if exists "editors update tracked links" on public.tracked_links;
create policy "editors update tracked links" on public.tracked_links
  for update using (
    exists (
      select 1 from public.projects p
      where p.id = tracked_links.project_id
        and public.team_can(p.team_id, 'links.manage')
    )
  ) with check (
    exists (
      select 1 from public.projects p
      where p.id = tracked_links.project_id
        and public.team_can(p.team_id, 'links.manage')
    )
  );

drop policy if exists "owners and admins delete tracked links" on public.tracked_links;
create policy "owners and admins delete tracked links" on public.tracked_links
  for delete using (
    exists (
      select 1 from public.projects p
      where p.id = tracked_links.project_id
        and public.team_can(p.team_id, 'links.delete')
    )
  );

-- 4. Contact attribution ---------------------------------------------------

alter table public.contact_messages
  add column if not exists source text,
  add column if not exists source_link_id uuid references public.tracked_links(id) on delete set null;

create index if not exists contact_messages_source_link_idx
  on public.contact_messages (source_link_id)
  where source_link_id is not null;

-- 5. Daily statistics ------------------------------------------------------

create table if not exists public.stats_daily (
  project_id uuid not null references public.projects(id) on delete cascade,
  date date not null,
  views bigint not null default 0,
  visitors bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (project_id, date)
);

create table if not exists public.stats_visitors_daily (
  project_id uuid not null references public.projects(id) on delete cascade,
  date date not null,
  visitor_hash text not null,
  created_at timestamptz not null default now(),
  primary key (project_id, date, visitor_hash)
);

create table if not exists public.link_stats_daily (
  link_id uuid not null references public.tracked_links(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  date date not null,
  clicks bigint not null default 0,
  visitors bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (link_id, date)
);

create index if not exists link_stats_daily_project_date_idx
  on public.link_stats_daily (project_id, date);

create table if not exists public.param_stats_daily (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  date date not null,
  param_key text not null,
  param_value text not null,
  link_id uuid references public.tracked_links(id) on delete set null,
  views bigint not null default 0,
  clicks bigint not null default 0,
  updated_at timestamptz not null default now()
);

create unique index if not exists param_stats_daily_unique
  on public.param_stats_daily (
    project_id,
    date,
    param_key,
    param_value,
    coalesce(link_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

create table if not exists public.stats_param_whitelist (
  param_key text primary key,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.stats_param_whitelist (param_key) values
  ('utm_source'), ('utm_medium'), ('utm_campaign'), ('utm_term'),
  ('utm_content'), ('gclid'), ('fbclid'), ('msclkid')
on conflict (param_key) do nothing;

create table if not exists public.stats_job_runs (
  id uuid primary key default gen_random_uuid(),
  job text not null,
  status text not null check (status in ('running','ok','failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  count int,
  error text
);

create index if not exists stats_job_runs_job_idx
  on public.stats_job_runs (job, started_at desc);

alter table public.stats_daily enable row level security;
alter table public.stats_visitors_daily enable row level security;
alter table public.link_stats_daily enable row level security;
alter table public.param_stats_daily enable row level security;
alter table public.stats_param_whitelist enable row level security;
alter table public.stats_job_runs enable row level security;

drop policy if exists "team members read daily stats" on public.stats_daily;
create policy "team members read daily stats" on public.stats_daily
  for select using (public.user_can_access_project(project_id));

drop policy if exists "team members read link stats" on public.link_stats_daily;
create policy "team members read link stats" on public.link_stats_daily
  for select using (public.user_can_access_project(project_id));

drop policy if exists "team members read parameter stats" on public.param_stats_daily;
create policy "team members read parameter stats" on public.param_stats_daily
  for select using (public.user_can_access_project(project_id));

drop policy if exists "authenticated read parameter whitelist" on public.stats_param_whitelist;
create policy "authenticated read parameter whitelist" on public.stats_param_whitelist
  for select to authenticated using (true);

-- 6. Export/backup read policies ------------------------------------------

drop policy if exists "team members read backups" on public.backups;
create policy "backup users read backups" on public.backups
  for select using (
    exists (
      select 1 from public.projects p
      where p.id = backups.project_id
        and public.team_can(p.team_id, 'site.backups')
    )
  );

drop policy if exists "editors manage backups" on public.backups;
create policy "backup users manage backups" on public.backups
  for all using (
    exists (
      select 1 from public.projects p
      where p.id = backups.project_id
        and public.team_can(p.team_id, 'site.backups')
    )
  ) with check (
    exists (
      select 1 from public.projects p
      where p.id = backups.project_id
        and public.team_can(p.team_id, 'site.backups')
    )
  );

drop policy if exists "team members read exports" on public.project_exports;
create policy "export users read exports" on public.project_exports
  for select using (
    exists (
      select 1 from public.projects p
      where p.id = project_exports.project_id
        and (
          public.team_can(p.team_id, 'export.content')
          or public.team_can(p.team_id, 'export.backup')
          or public.team_can(p.team_id, 'export.site_zip')
        )
    )
  );

drop policy if exists "team members read imports" on public.project_imports;
create policy "import users read imports" on public.project_imports
  for select using (
    exists (
      select 1 from public.projects p
      where p.id = project_imports.project_id
        and public.team_can(p.team_id, 'import.content')
    )
  );

-- 7. Permissions -----------------------------------------------------------

insert into public.permission_matrix (action, owner, admin, editor, viewer) values
  ('links.view', true, true, true, true),
  ('links.manage', true, true, true, false),
  ('links.delete', true, true, false, false),
  ('export.content', true, true, true, false),
  ('export.backup', true, true, true, false),
  ('export.site_zip', true, true, false, false),
  ('import.content', true, true, true, false)
on conflict (action) do update set
  owner = excluded.owner,
  admin = excluded.admin,
  editor = excluded.editor,
  viewer = excluded.viewer;

-- 8. Statistics ingest RPC -------------------------------------------------

create or replace function public.record_stats_event(
  p_project uuid,
  p_date date,
  p_visitor_hash text,
  p_path text,
  p_link_id uuid,
  p_params jsonb,
  p_kind text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows int := 0;
  v_key text;
  v_value text;
begin
  if auth.role() <> 'service_role' then
    raise exception 'NOT_ALLOWED';
  end if;
  if p_kind not in ('view','click') then
    raise exception 'INVALID_EVENT';
  end if;
  if p_date is null or p_date < current_date - 1 or p_date > current_date + 1 then
    raise exception 'INVALID_DATE';
  end if;
  if p_kind = 'view' then
    insert into public.stats_daily (project_id, date, views, visitors)
    values (p_project, p_date, 1, 0)
    on conflict (project_id, date) do update
      set views = stats_daily.views + 1,
          updated_at = now();

    if p_visitor_hash is not null and p_visitor_hash <> '' then
      insert into public.stats_visitors_daily (project_id, date, visitor_hash)
      values (p_project, p_date, left(p_visitor_hash, 128))
      on conflict (project_id, date, visitor_hash) do nothing;
      get diagnostics v_rows = row_count;
      if v_rows > 0 then
        update public.stats_daily
          set visitors = visitors + 1, updated_at = now()
          where project_id = p_project and date = p_date;
      end if;
    end if;
  else
    if p_link_id is not null then
      update public.tracked_links
        set last_clicked_at = now()
        where id = p_link_id and project_id = p_project and revoked_at is null;
      insert into public.link_stats_daily (link_id, project_id, date, clicks)
      values (p_link_id, p_project, p_date, 1)
      on conflict (link_id, date) do update
        set clicks = link_stats_daily.clicks + 1,
            updated_at = now();
    end if;
  end if;

  if p_params is not null and jsonb_typeof(p_params) = 'object' then
    for v_key, v_value in
      select key, value from jsonb_each_text(p_params)
      where key in (select param_key from public.stats_param_whitelist where enabled)
      limit 20
    loop
      insert into public.param_stats_daily (
        project_id, date, param_key, param_value, link_id,
        views, clicks
      ) values (
        p_project, p_date, left(v_key, 80), left(v_value, 200), p_link_id,
        case when p_kind = 'view' then 1 else 0 end,
        case when p_kind = 'click' then 1 else 0 end
      )
      on conflict (project_id, date, param_key, param_value,
        (coalesce(link_id, '00000000-0000-0000-0000-000000000000'::uuid)))
      do update set
        views = param_stats_daily.views + case when p_kind = 'view' then 1 else 0 end,
        clicks = param_stats_daily.clicks + case when p_kind = 'click' then 1 else 0 end,
        updated_at = now();
    end loop;
  end if;
end;
$$;

revoke all on function public.record_stats_event(uuid,date,text,text,uuid,jsonb,text) from public;
grant execute on function public.record_stats_event(uuid,date,text,text,uuid,jsonb,text) to service_role;

-- 9. Import apply RPC ------------------------------------------------------

create or replace function public.apply_content_import(
  p_project uuid,
  p_mode text,
  p_pages jsonb,
  p_settings jsonb,
  p_redirects jsonb,
  p_plugins jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team uuid;
  v_page_limit int;
  v_page_count int;
  v_page jsonb;
  v_old_ids uuid[];
  v_new_ids uuid[];
  v_added int := 0;
  v_replaced int := 0;
begin
  if p_mode not in ('replace','add') then
    raise exception 'IMPORT_NOT_VALID';
  end if;
  select team_id into v_team from public.projects where id = p_project and deleted_at is null;
  if v_team is null then
    raise exception 'PROJECT_NOT_FOUND';
  end if;
  if not public.team_can(v_team, 'import.content') then
    raise exception 'NOT_ALLOWED';
  end if;
  if exists (
    select 1 from public.project_operations
    where project_id = p_project and heavy and status in ('queued','running')
  ) then
    raise exception 'PROJECT_BUSY';
  end if;

  select max_pages_per_site into v_page_limit
  from public.plans p join public.teams t on t.plan_id = p.id
  where t.id = v_team;

  if jsonb_typeof(p_pages) <> 'array' or jsonb_array_length(p_pages) = 0 then
    raise exception 'IMPORT_NOT_VALID';
  end if;
  if v_page_limit is not null and jsonb_array_length(p_pages) > v_page_limit then
    raise exception 'PAGE_LIMIT';
  end if;

  if p_mode = 'replace' then
    delete from public.pages where project_id = p_project;
  end if;

  for v_page in select * from jsonb_array_elements(p_pages) loop
    insert into public.pages (
      project_id, title, path, position, is_homepage, blocks,
      show_in_menu, is_hidden, seo_title, seo_description, hide_from_search
    ) values (
      p_project,
      left(coalesce(v_page->>'title', 'Page'), 200),
      left(coalesce(v_page->>'path', '/'), 200),
      coalesce((v_page->>'position')::int, 0),
      coalesce((v_page->>'is_homepage')::boolean, false),
      coalesce(v_page->'blocks', '[]'::jsonb),
      coalesce((v_page->>'show_in_menu')::boolean, true),
      coalesce((v_page->>'is_hidden')::boolean, false),
      nullif(left(coalesce(v_page->>'seo_title', ''), 200), ''),
      nullif(left(coalesce(v_page->>'seo_description', ''), 500), ''),
      coalesce((v_page->>'hide_from_search')::boolean, false)
    );
    v_added := v_added + 1;
  end loop;

  if p_mode = 'add' then
    select count(*) into v_page_count from public.pages where project_id = p_project;
    if v_page_limit is not null and v_page_count > v_page_limit then
      raise exception 'PAGE_LIMIT';
    end if;
  end if;

  if p_settings is not null and jsonb_typeof(p_settings) = 'object' then
    update public.project_settings
      set theme = coalesce(p_settings->'theme', theme),
          seo_site_title = coalesce(p_settings->>'seo_site_title', seo_site_title),
          seo_description = coalesce(p_settings->>'seo_description', seo_description),
          seo_title_format = coalesce(p_settings->>'seo_title_format', seo_title_format),
          search_indexing = coalesce((p_settings->>'search_indexing')::boolean, search_indexing),
          twitter_handle = coalesce(p_settings->>'twitter_handle', twitter_handle),
          custom_404 = coalesce(p_settings->'custom_404', custom_404),
          updated_at = now()
      where project_id = p_project;
  end if;

  if p_redirects is not null and jsonb_typeof(p_redirects) = 'array' then
    delete from public.redirects where project_id = p_project and auto = false;
    insert into public.redirects (project_id, from_path, to_type, to_value, code, auto)
    select p_project,
           left(coalesce(item->>'from_path', ''), 200),
           case when coalesce(item->>'to_type','path') in ('page','path','url') then item->>'to_type' else 'path' end,
           left(coalesce(item->>'to_value', '/'), 500),
           case when coalesce((item->>'code')::int, 301) = 302 then 302 else 301 end,
           false
    from jsonb_array_elements(p_redirects) item
    where coalesce(item->>'from_path', '') like '/%'
      and coalesce(item->>'from_path', '') not like '//%'
      and coalesce(item->>'from_path', '') not like '%..%';
  end if;

  if p_plugins is not null and jsonb_typeof(p_plugins) = 'array' then
    delete from public.plugin_installs where project_id = p_project;
    insert into public.plugin_installs (project_id, plugin_id, state)
    select p_project, left(value, 80), 'active'
    from jsonb_array_elements_text(p_plugins)
    where value ~ '^[a-z0-9][a-z0-9-]{0,79}$'
      and exists (select 1 from public.plugin_catalog c where c.id = value);
  end if;

  update public.projects
    set content_revision = content_revision + 1,
        content_changed_at = now(),
        updated_at = now()
    where id = p_project;

  return jsonb_build_object(
    'pages', v_added,
    'mode', p_mode
  );
end;
$$;

revoke all on function public.apply_content_import(uuid,text,jsonb,jsonb,jsonb,jsonb) from public;
grant execute on function public.apply_content_import(uuid,text,jsonb,jsonb,jsonb,jsonb) to authenticated, service_role;
