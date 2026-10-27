-- Harden content import: add mode keeps the home page and renames path clashes;
-- replace mode applies settings, redirects and plugins. Never publishes.
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
  v_path text;
  v_base text;
  v_suffix int;
  v_is_home boolean;
  v_home_set boolean := false;
  v_added int := 0;
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
  else
    select count(*) into v_page_count from public.pages where project_id = p_project;
    select count(*) into v_suffix
    from jsonb_array_elements(p_pages) item
    where coalesce((item->>'is_homepage')::boolean, false) = false
      and coalesce(nullif(item->>'path', ''), '/') <> '/';
    if v_page_limit is not null and v_page_count + v_suffix > v_page_limit then
      raise exception 'PAGE_LIMIT';
    end if;
  end if;

  for v_page in select * from jsonb_array_elements(p_pages) loop
    v_path := coalesce(nullif(v_page->>'path', ''), '/');
    v_is_home := coalesce((v_page->>'is_homepage')::boolean, false) or v_path = '/';

    if p_mode = 'add' then
      -- Keep the existing home page; imported home content is not merged.
      if v_is_home then
        continue;
      end if;
      v_base := v_path;
      v_suffix := 2;
      while exists (
        select 1 from public.pages where project_id = p_project and path = v_path
      ) loop
        v_path := v_base || '-' || v_suffix;
        v_suffix := v_suffix + 1;
      end loop;
      v_is_home := false;
    elsif v_is_home and not v_home_set then
      v_home_set := true;
    else
      v_is_home := false;
    end if;

    insert into public.pages (
      project_id, title, path, position, is_homepage, blocks,
      show_in_menu, is_hidden, seo_title, seo_description, hide_from_search
    ) values (
      p_project,
      left(coalesce(v_page->>'title', 'Page'), 200),
      left(v_path, 200),
      coalesce((v_page->>'position')::int, 0),
      v_is_home,
      coalesce(v_page->'blocks', '[]'::jsonb),
      coalesce((v_page->>'show_in_menu')::boolean, true),
      coalesce((v_page->>'is_hidden')::boolean, false),
      nullif(left(coalesce(v_page->>'seo_title', ''), 200), ''),
      nullif(left(coalesce(v_page->>'seo_description', ''), 500), ''),
      coalesce((v_page->>'hide_from_search')::boolean, false)
    );
    v_added := v_added + 1;
  end loop;

  if p_mode = 'replace' then
    if not v_home_set then
      update public.pages set is_homepage = true
      where id = (
        select id from public.pages where project_id = p_project
        order by position, created_at limit 1
      );
    end if;

    insert into public.project_settings (project_id)
      values (p_project)
      on conflict (project_id) do nothing;

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
        and coalesce(item->>'from_path', '') not like '%..%'
      on conflict (project_id, from_path) do nothing;
    end if;

    if p_plugins is not null and jsonb_typeof(p_plugins) = 'array' then
      delete from public.plugin_installs where project_id = p_project;
      insert into public.plugin_installs (project_id, plugin_id, state)
      select p_project, left(value, 80), 'active'
      from jsonb_array_elements_text(p_plugins)
      where value ~ '^[a-z0-9][a-z0-9-]{0,79}$'
        and exists (select 1 from public.plugin_catalog c where c.id = value);
    end if;
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
