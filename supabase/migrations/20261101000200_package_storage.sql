-- Private storage for backups, exports and temporary import uploads.
-- No storage policies are added: only the service role may read or write.
insert into storage.buckets (id, name, public, file_size_limit)
  values
    ('project-backups', 'project-backups', false, 262144000),
    ('project-exports', 'project-exports', false, 262144000),
    ('project-imports', 'project-imports', false, 10485760)
on conflict (id) do nothing;
