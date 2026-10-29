-- System template release tracking and publishing.
--
-- The code registry remains the source of template packages. These functions
-- copy a package into the template tables as a draft version and publish one
-- approved version at a time. No customer content is read or written.

alter table public.approval_requests
  drop constraint if exists approval_requests_target_check;
alter table public.approval_requests
  add constraint approval_requests_target_check check (
    target_type in (
      'team', 'project', 'website', 'domain', 'invoice', 'payment', 'ai',
      'staff', 'account', 'template'
    )
  );

alter table public.staff_audit_log
  drop constraint if exists staff_audit_log_target_check;
alter table public.staff_audit_log
  add constraint staff_audit_log_target_check check (
    target_type in (
      'staff', 'team', 'project', 'page', 'website', 'domain', 'billing',
      'invoice', 'payment', 'ai', 'email', 'marketing', 'consent', 'approval',
      'support_case', 'abuse', 'demo', 'setting', 'report', 'job',
      'coupon', 'billing_review', 'ai_model', 'referral', 'template'
    )
  ) not valid;

create or replace function public.template_versions_prevent_system_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if exists (
    select 1 from public.templates
    where id = old.template_id and kind = 'system'
  ) then
    raise exception 'TEMPLATE_VERSION_IMMUTABLE';
  end if;
  return new;
end;
$$;

drop trigger if exists template_versions_prevent_system_update on public.template_versions;
create trigger template_versions_prevent_system_update
  before update on public.template_versions
  for each row execute function public.template_versions_prevent_system_update();

update public.approval_policies
set description = 'Publish a saved version of a system template.'
where kind = 'template_publish';

create or replace function public.admin_template_sync(
  p_slug text,
  p_meta jsonb,
  p_package jsonb,
  p_package_hash text,
  p_summary text default null,
  p_page_count int default 0,
  p_block_count int default 0,
  p_required_plugins text[] default '{}',
  p_fonts jsonb default null,
  p_asset_count int default 0,
  p_bytes int default 0,
  p_sort int default 100
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_template public.templates;
  v_version public.template_versions;
  v_tags text[];
  v_business_types text[];
  v_next int;
  v_created boolean := false;
  v_imported boolean := false;
begin
  perform public.staff_assert('template.system.manage');

  if p_slug is null or p_slug !~ '^[a-z0-9][a-z0-9-]{2,39}$' then
    raise exception 'TEMPLATE_SLUG_INVALID';
  end if;
  if p_package_hash is null or p_package_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'TEMPLATE_HASH_INVALID';
  end if;
  if p_meta is null or p_package is null then
    raise exception 'TEMPLATE_PACKAGE_REQUIRED';
  end if;

  select coalesce(array_agg(value), '{}'::text[])
    into v_tags
  from jsonb_array_elements_text(coalesce(p_meta->'tags', '[]'::jsonb)) as value;

  select coalesce(array_agg(value), '{}'::text[])
    into v_business_types
  from jsonb_array_elements_text(coalesce(p_meta->'businessTypes', '[]'::jsonb)) as value;

  perform pg_advisory_xact_lock(hashtext('template:' || p_slug));

  select * into v_template
  from public.templates
  where kind = 'system' and slug = p_slug and deleted_at is null
  for update;

  if v_template.id is null then
    insert into public.templates (
      kind, slug, created_by, name, tagline, description, category, tags,
      business_types, status, plan_min, is_default, featured, sort, source,
      page_count
    ) values (
      'system', p_slug, auth.uid(),
      coalesce(nullif(trim(p_meta->>'name'), ''), p_slug),
      coalesce(p_meta->>'tagline', ''),
      coalesce(p_meta->>'description', ''),
      coalesce(nullif(p_meta->>'category', ''), 'other'),
      v_tags,
      v_business_types,
      'draft',
      coalesce(nullif(p_meta->>'planMin', ''), 'free'),
      false,
      coalesce((p_meta->>'featured')::boolean, false),
      p_sort,
      'code',
      greatest(p_page_count, 0)
    )
    returning * into v_template;
    v_created := true;
  else
    update public.templates
    set name = coalesce(nullif(trim(p_meta->>'name'), ''), name),
        tagline = coalesce(p_meta->>'tagline', tagline),
        description = coalesce(p_meta->>'description', description),
        category = coalesce(nullif(p_meta->>'category', ''), category),
        tags = v_tags,
        business_types = v_business_types,
        plan_min = coalesce(nullif(p_meta->>'planMin', ''), plan_min),
        featured = coalesce((p_meta->>'featured')::boolean, featured),
        sort = p_sort,
        source = 'code',
        updated_at = now()
    where id = v_template.id
    returning * into v_template;
  end if;

  select * into v_version
  from public.template_versions
  where template_id = v_template.id
  order by version desc
  limit 1;

  if v_version.id is not null and v_version.package_hash = p_package_hash then
    return jsonb_build_object(
      'ok', true,
      'template_id', v_template.id,
      'version_id', v_version.id,
      'version', v_version.version,
      'created', v_created,
      'duplicate', true
    );
  end if;

  v_next := coalesce(v_version.version, 0) + 1;
  insert into public.template_versions (
    template_id, version, package, package_hash, schema_version, summary,
    page_count, block_count, required_plugins, fonts, asset_count, bytes,
    created_by
  ) values (
    v_template.id, v_next, p_package, p_package_hash, 1, p_summary,
    greatest(p_page_count, 0), greatest(p_block_count, 0),
    coalesce(p_required_plugins, '{}'::text[]), p_fonts,
    greatest(p_asset_count, 0), greatest(p_bytes, 0), auth.uid()
  )
  returning * into v_version;
  v_imported := true;

  perform public.staff_audit(
    'template.sync', 'template', v_template.id::text, 'write',
    null, null,
    jsonb_build_object(
      'slug', v_template.slug,
      'version', v_version.version,
      'package_hash', v_version.package_hash,
      'created_template', v_created
    )
  );

  return jsonb_build_object(
    'ok', true,
    'template_id', v_template.id,
    'version_id', v_version.id,
    'version', v_version.version,
    'created', v_created,
    'duplicate', not v_imported
  );
end;
$$;

create or replace function public.admin_template_publish(
  p_template uuid,
  p_version uuid,
  p_reason text,
  p_approval uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_template public.templates;
  v_version public.template_versions;
begin
  perform public.staff_assert('template.system.manage');

  if p_reason is null or length(trim(p_reason)) < 10 then
    raise exception 'REASON_REQUIRED';
  end if;

  select * into v_template
  from public.templates
  where id = p_template and kind = 'system' and deleted_at is null
  for update;
  if v_template.id is null then
    raise exception 'TEMPLATE_NOT_FOUND';
  end if;

  select * into v_version
  from public.template_versions
  where id = p_version and template_id = p_template;
  if v_version.id is null then
    raise exception 'TEMPLATE_VERSION_NOT_FOUND';
  end if;

  if v_template.status = 'published'
     and v_template.current_version_id = p_version then
    return jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'template_id', v_template.id,
      'version_id', p_version,
      'version', v_version.version
    );
  end if;

  update public.templates
  set is_default = false,
      updated_at = now()
  where kind = 'system'
    and is_default = true
    and id <> v_template.id
    and deleted_at is null;

  update public.templates
  set status = 'published',
      current_version_id = p_version,
      page_count = v_version.page_count,
      is_default = (slug = 'starter'),
      updated_at = now()
  where id = v_template.id
  returning * into v_template;

  perform public.staff_audit(
    'template.publish', 'template', v_template.id::text, 'write',
    p_reason, p_approval,
    jsonb_build_object(
      'slug', v_template.slug,
      'version', v_version.version,
      'package_hash', v_version.package_hash
    )
  );

  return jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'template_id', v_template.id,
    'version_id', v_version.id,
    'version', v_version.version
  );
end;
$$;

create or replace function public.admin_system_templates()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.staff_assert('template.system.manage');

  return jsonb_build_object(
    'templates', coalesce((
      select jsonb_agg(row)
      from (
        select
          t.id, t.slug, t.name, t.tagline, t.description, t.category, t.tags,
          t.business_types, t.status, t.plan_min, t.is_default, t.featured,
          t.sort, t.current_version_id, t.page_count, t.uses_count,
          t.created_at, t.updated_at,
          (select v.version from public.template_versions v where v.id = t.current_version_id) as current_version,
          (select count(*)::int from public.template_versions v where v.template_id = t.id) as version_count
        from public.templates t
        where t.kind = 'system' and t.deleted_at is null
        order by t.sort asc, t.name asc
      ) row
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.admin_system_template(p_template uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_template public.templates;
begin
  perform public.staff_assert('template.system.manage');

  select * into v_template
  from public.templates
  where id = p_template and kind = 'system' and deleted_at is null;
  if v_template.id is null then
    return null;
  end if;

  return jsonb_build_object(
    'template', to_jsonb(v_template) || jsonb_build_object(
      'current_version',
        (select v.version from public.template_versions v where v.id = v_template.current_version_id)
    ),
    'versions', coalesce((
      select jsonb_agg(version)
      from (
        select
          to_jsonb(v) - 'package' || jsonb_build_object(
            'is_current', v.id = v_template.current_version_id
          ) as version
        from public.template_versions v
        where v.template_id = v_template.id
        order by v.version desc
      ) rows
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.admin_template_sync(
  text, jsonb, jsonb, text, text, int, int, text[], jsonb, int, int, int
) from public;
revoke all on function public.admin_template_publish(uuid, uuid, text, uuid) from public;
revoke all on function public.admin_system_templates() from public;
revoke all on function public.admin_system_template(uuid) from public;

grant execute on function public.admin_template_sync(
  text, jsonb, jsonb, text, text, int, int, text[], jsonb, int, int, int
) to authenticated, service_role;
grant execute on function public.admin_template_publish(uuid, uuid, text, uuid) to authenticated, service_role;
grant execute on function public.admin_system_templates() to authenticated, service_role;
grant execute on function public.admin_system_template(uuid) to authenticated, service_role;
