-- The renderer stylesheet is part of every published version. These columns
-- make it possible to see which version a live website used and to rebuild it
-- when the stylesheet changes.

alter table public.publishes
  add column if not exists renderer_version text,
  add column if not exists css_hash text,
  add column if not exists css_bytes bigint not null default 0,
  add column if not exists build_meta jsonb not null default '{}'::jsonb;

create index if not exists publishes_renderer_version_idx
  on public.publishes (renderer_version)
  where status = 'live';
