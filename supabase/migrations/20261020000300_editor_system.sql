-- Editor system: pages revisions, versions, media, project settings theme, RPCs

alter table public.pages
  add column if not exists revision integer not null default 1,
  add column if not exists show_in_menu boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();

alter table public.project_settings
  add column if not exists theme jsonb not null default '{"palette":"fresh-green","fontPair":"friendly","corners":"soft","colorMode":"light"}'::jsonb,
  add column if not exists logo_dark_url text,
  add column if not exists show_watermark boolean not null default true;

create table if not exists public.page_versions (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages(id) on delete cascade,
  content jsonb not null,
  reason text check (reason in ('auto','manual','before_restore')),
  label text,
  block_count integer,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists page_versions_page_created_idx
  on public.page_versions (page_id, created_at desc);

create table if not exists public.media (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  path text not null,
  filename text,
  mime text,
  size_bytes integer,
  width integer,
  height integer,
  alt text default '',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists media_project_idx on public.media (project_id);

-- Storage bucket
insert into storage.buckets (id, name, public, allowed_mime_types, file_size_limit)
  values (
    'project-media',
    'project-media',
    true,
    ARRAY['image/webp', 'image/jpeg', 'image/png']::text[],
    5 * 1024 * 1024
  )
on conflict (id) do nothing;

-- RLS for media
alter table public.media enable row level security;
alter table public.page_versions enable row level security;

create policy "members can read media"
  on public.media
  for select
  using (
    deleted_at is null and
    exists (
      select 1
      from public.projects p
      join public.team_members tm on tm.team_id = p.team_id
      where p.id = media.project_id
        and tm.user_id = auth.uid()
    )
  );

create policy "editors can insert media"
  on public.media
  for insert
  with check (
    exists (
      select 1
      from public.projects p
      join public.team_members tm on tm.team_id = p.team_id
      where p.id = media.project_id
        and tm.user_id = auth.uid()
        and tm.role in ('owner', 'admin', 'editor')
    )
  );

create policy "editors can update media"
  on public.media
  for update
  using (
    exists (
      select 1
      from public.projects p
      join public.team_members tm on tm.team_id = p.team_id
      where p.id = media.project_id
        and tm.user_id = auth.uid()
        and tm.role in ('owner', 'admin', 'editor')
    )
  );

create policy "owners admins can delete media"
  on public.media
  for delete
  using (
    exists (
      select 1
      from public.projects p
      join public.team_members tm on tm.team_id = p.team_id
      where p.id = media.project_id
        and tm.user_id = auth.uid()
        and tm.role in ('owner', 'admin')
    )
  );

create policy "members can read page_versions"
  on public.page_versions
  for select
  using (
    exists (
      select 1
      from public.pages pg
      join public.projects p on p.id = pg.project_id
      join public.team_members tm on tm.team_id = p.team_id
      where pg.id = page_versions.page_id
        and tm.user_id = auth.uid()
    )
  );

create policy "editors can insert page_versions"
  on public.page_versions
  for insert
  with check (
    exists (
      select 1
      from public.pages pg
      join public.projects p on p.id = pg.project_id
      join public.team_members tm on tm.team_id = p.team_id
      where pg.id = page_versions.page_id
        and tm.user_id = auth.uid()
        and tm.role in ('owner', 'admin', 'editor')
    )
  );

-- Storage RLS
create policy "team can upload project media"
  on storage.objects
  for insert
  with check (
    bucket_id = 'project-media' and
    exists (
      select 1
      from public.projects p
      join public.team_members tm on tm.team_id = p.team_id
      where tm.user_id = auth.uid()
        and tm.role in ('owner', 'admin', 'editor')
        and (storage.foldername(name))[1] = p.id::text
    )
  );

create policy "public can read project media"
  on storage.objects
  for select
  using (bucket_id = 'project-media');

create policy "editors can update project media"
  on storage.objects
  for update
  using (
    bucket_id = 'project-media' and
    exists (
      select 1
      from public.projects p
      join public.team_members tm on tm.team_id = p.team_id
      where tm.user_id = auth.uid()
        and tm.role in ('owner', 'admin', 'editor')
        and (storage.foldername(name))[1] = p.id::text
    )
  );

create policy "owners admins can delete project media"
  on storage.objects
  for delete
  using (
    bucket_id = 'project-media' and
    exists (
      select 1
      from public.projects p
      join public.team_members tm on tm.team_id = p.team_id
      where tm.user_id = auth.uid()
        and tm.role in ('owner', 'admin')
        and (storage.foldername(name))[1] = p.id::text
    )
  );

-- Trigger to check storage limit on media insert
create or replace function public.check_media_storage_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id uuid;
  v_plan_id text;
  v_limit_mb integer;
  v_total_bytes bigint;
begin
  select p.team_id, t.plan_id into v_team_id, v_plan_id
  from public.projects p
  join public.teams t on t.id = p.team_id
  where p.id = new.project_id;

  select coalesce(max(storage_mb), 100) into v_limit_mb
  from public.plans
  where id = v_plan_id;

  select coalesce(sum(size_bytes), 0) into v_total_bytes
  from public.media
  where project_id = new.project_id
    and deleted_at is null;

  if v_total_bytes + coalesce(new.size_bytes, 0) > v_limit_mb * 1024 * 1024 then
    raise exception 'LIMIT_STORAGE_REACHED';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_check_media_storage_limit on public.media;
create trigger trg_check_media_storage_limit
  before insert on public.media
  for each row
  execute function public.check_media_storage_limit();

-- Migrate existing pages with old content format
update public.pages
set blocks = jsonb_build_object('schemaVersion', 2, 'blocks', blocks)
where jsonb_typeof(blocks) = 'array';

-- RPC save_page_content
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

  if v_role not in ('owner', 'admin', 'editor') then
    raise exception 'not_authorized';
  end if;

  if v_stored_revision <> p_expected_revision then
    raise exception 'REVISION_CONFLICT';
  end if;

  v_content_size := octet_length(p_content::text);
  if v_content_size > 512 * 1024 then
    raise exception 'CONTENT_TOO_LARGE';
  end if;

  -- count blocks
  select jsonb_array_length(coalesce(p_content->'blocks', '[]'::jsonb)) into v_block_count;
  if v_block_count > 60 then
    raise exception 'TOO_MANY_SECTIONS';
  end if;

  -- snapshot previous content as auto if changed and last auto > 10 minutes or none
  if v_stored_content is distinct from p_content then
    select created_at into v_latest_auto_created_at
    from public.page_versions
    where page_id = p_page_id and reason = 'auto'
    order by created_at desc
    limit 1;

    if v_latest_auto_created_at is null or v_latest_auto_created_at < now() - interval '10 minutes' then
      insert into public.page_versions (page_id, content, reason, block_count, created_by)
      values (p_page_id, v_stored_content, 'auto', jsonb_array_length(coalesce(v_stored_content->'blocks', '[]'::jsonb)), v_user_id);
    end if;
  end if;

  v_new_revision := v_stored_revision + 1;

  update public.pages
  set blocks = p_content,
      revision = v_new_revision,
      updated_at = now()
  where id = p_page_id;

  -- prune
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

create or replace function public.save_page_version(p_page_id uuid, p_label text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_stored_content jsonb;
  v_block_count integer;
  v_new_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  select blocks into v_stored_content
  from public.pages
  where id = p_page_id;

  v_block_count := jsonb_array_length(coalesce(v_stored_content->'blocks', '[]'::jsonb));
  insert into public.page_versions (page_id, content, reason, label, block_count, created_by)
  values (p_page_id, v_stored_content, 'manual', p_label, v_block_count, v_user_id)
  returning id into v_new_id;

  return v_new_id;
end;
$$;

create or replace function public.restore_page_version(p_version_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_page_id uuid;
  v_version_content jsonb;
  v_current_content jsonb;
  v_current_revision integer;
  v_new_revision integer;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  select pv.page_id, pv.content into v_page_id, v_version_content
  from public.page_versions pv
  where pv.id = p_version_id;

  select pg.blocks, pg.revision into v_current_content, v_current_revision
  from public.pages pg
  where pg.id = v_page_id
  for update;

  -- snapshot current as before_restore
  insert into public.page_versions (page_id, content, reason, block_count, created_by)
  values (v_page_id, v_current_content, 'before_restore', jsonb_array_length(coalesce(v_current_content->'blocks', '[]'::jsonb)), v_user_id);

  v_new_revision := v_current_revision + 1;
  update public.pages
  set blocks = v_version_content,
      revision = v_new_revision,
      updated_at = now()
  where id = v_page_id;

  return v_new_revision;
end;
$$;

-- Add editor_tour_done to profiles if table exists
do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'profiles') then
    alter table public.profiles add column if not exists editor_tour_done boolean not null default false;
  end if;
end $$;
