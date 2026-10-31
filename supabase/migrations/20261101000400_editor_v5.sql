-- The v5 editor keeps a named rollback version before the first save.
alter table public.page_versions
  drop constraint if exists page_versions_reason_check;

alter table public.page_versions
  add constraint page_versions_reason_check
  check (reason in ('auto', 'manual', 'before_restore', 'before_editor_v3'));

-- v5 stores one node tree in `blocks`, so count nodes instead of top-level blocks
-- and allow the full 1 MB document limit from docs/editor-engine.md.
create or replace function public.save_page_content(p_page_id uuid, p_content jsonb, p_expected_revision integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_id uuid;
  v_team_id uuid;
  v_user_id uuid;
  v_role text;
  v_stored_revision integer;
  v_stored_content jsonb;
  v_content_size integer;
  v_new_revision integer;
  v_node_count integer;
  v_block_count integer;
  v_latest_auto_created_at timestamptz;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  select pg.project_id, pg.revision, pg.blocks
    into v_project_id, v_stored_revision, v_stored_content
  from public.pages pg
  where pg.id = p_page_id
  for update;

  if v_project_id is null then
    raise exception 'page_not_found';
  end if;

  select p.team_id into v_team_id
  from public.projects p
  where p.id = v_project_id;

  select tm.role into v_role
  from public.team_members tm
  where tm.team_id = v_team_id and tm.user_id = v_user_id;

  if coalesce(v_role, '') not in ('owner', 'admin', 'editor') then
    raise exception 'not_authorized';
  end if;

  if v_stored_revision <> p_expected_revision then
    raise exception 'REVISION_CONFLICT';
  end if;

  v_content_size := octet_length(p_content::text);
  if v_content_size > 1024 * 1024 then
    raise exception 'CONTENT_TOO_LARGE';
  end if;

  if p_content->>'schemaVersion' = '5' then
    with recursive nodes as (
      select p_content->'root' as node
      union all
      select child
      from nodes
      cross join lateral jsonb_array_elements(coalesce(nodes.node->'children', '[]'::jsonb)) as child
    )
    select count(*) into v_node_count from nodes;
    if v_node_count > 2000 then
      raise exception 'TOO_MANY_SECTIONS';
    end if;
    select coalesce(jsonb_array_length(coalesce(p_content->'root'->'children', '[]'::jsonb)), 0)
      into v_block_count;
  else
    select coalesce(jsonb_array_length(coalesce(p_content->'blocks', '[]'::jsonb)), 0)
      into v_block_count;
    if v_block_count > 60 then
      raise exception 'TOO_MANY_SECTIONS';
    end if;
  end if;

  if v_stored_content is distinct from p_content then
    select created_at into v_latest_auto_created_at
    from public.page_versions
    where page_id = p_page_id and reason = 'auto'
    order by created_at desc
    limit 1;

    if v_latest_auto_created_at is null or v_latest_auto_created_at < now() - interval '10 minutes' then
      insert into public.page_versions (page_id, content, reason, block_count, created_by)
      values (
        p_page_id,
        v_stored_content,
        'auto',
        case
          when v_stored_content->>'schemaVersion' = '5'
            then coalesce(jsonb_array_length(coalesce(v_stored_content->'root'->'children', '[]'::jsonb)), 0)
          else coalesce(jsonb_array_length(coalesce(v_stored_content->'blocks', '[]'::jsonb)), 0)
        end,
        v_user_id
      );
    end if;
  end if;

  v_new_revision := v_stored_revision + 1;

  update public.pages
  set blocks = p_content,
      revision = v_new_revision,
      updated_at = now()
  where id = p_page_id;

  delete from public.page_versions
  where id in (
    select id from (
      select id, row_number() over (partition by reason order by created_at desc) as rn
      from public.page_versions
      where page_id = p_page_id and reason = 'auto'
    ) t where t.rn > 30
  );

  delete from public.page_versions
  where id in (
    select id from (
      select id, row_number() over (partition by reason order by created_at desc) as rn
      from public.page_versions
      where page_id = p_page_id and reason = 'manual'
    ) t where t.rn > 20
  );

  return v_new_revision;
end;
$$;
