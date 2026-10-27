-- Export rows are created by editors and updated by the download route.
drop policy if exists "export users create exports" on public.project_exports;
create policy "export users create exports" on public.project_exports
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = project_exports.project_id
        and (
          public.team_can(p.team_id, 'export.content')
          or public.team_can(p.team_id, 'export.backup')
          or public.team_can(p.team_id, 'export.site_zip')
        )
    )
  );

drop policy if exists "export users update exports" on public.project_exports;
create policy "export users update exports" on public.project_exports
  for update to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_exports.project_id
        and (
          public.team_can(p.team_id, 'export.content')
          or public.team_can(p.team_id, 'export.backup')
          or public.team_can(p.team_id, 'export.site_zip')
        )
    )
  )
  with check (
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
