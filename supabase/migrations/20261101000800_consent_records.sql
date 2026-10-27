-- Consent records: granular consent tracking for marketing, analytics, etc.

create table if not exists public.consent_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  granted boolean not null,
  granted_at timestamptz,
  revoked_at timestamptz,
  source text not null default 'signup',
  ip_hash text,
  user_agent text,
  expires_at timestamptz,
  constraint consent_records_kind_check check (kind in ('marketing','analytics','profiling','communication')),
  constraint consent_records_granted_check check (granted in (true, false))
);

comment on table public.consent_records is 'Granular consent records for marketing, analytics, profiling, communication';
comment on column public.consent_records.kind is 'marketing|analytics|profiling|communication';
comment on column public.consent_records.granted is 'Whether consent was granted';
comment on column public.consent_records.source is 'Signup flow source';

-- Enable RLS
alter table public.consent_records enable row level security;

-- Policy: users can read own consent
create policy "users can read own consent records" on public.consent_records
  for select using (user_id = auth.uid());

-- Policy: users can insert own consent (on signup)
create policy "users can insert own consent on signup" on public.consent_records
  for insert with check (user_id = auth.uid());

-- Policy: staff can read all consent
grant all on public.consent_records to service_role;

create index if not exists consent_records_user_idx on public.consent_records (user_id, kind);
create index if not exists consent_records_kind_idx on public.consent_records (kind, granted);
