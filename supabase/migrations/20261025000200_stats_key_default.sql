-- stats_site_key is required for every project. New rows created by the app
-- get a key from the API, but the column also needs a database default so
-- that imports, SQL inserts and older code paths keep working.

alter table public.projects
  alter column stats_site_key
  set default lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16));

update public.projects
set stats_site_key = lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16))
where stats_site_key is null;
