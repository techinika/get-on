-- The auto-publish preference does not change the website content, so changing
-- it must not mark the website as having unpublished changes.
create or replace function public.bump_project_content_revision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_id uuid;
begin
  if tg_table_name = 'project_settings'
     and (to_jsonb(new) - 'auto_publish_on_domain')
       = (to_jsonb(old) - 'auto_publish_on_domain') then
    return coalesce(new, old);
  end if;

  v_project_id := coalesce(new.project_id, old.project_id);

  update public.projects
  set content_revision = content_revision + 1,
      updated_at = now()
  where id = v_project_id;

  return coalesce(new, old);
end;
$$;
