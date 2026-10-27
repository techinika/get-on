-- Email preferences: user email consent and preferences

create table if not exists public.email_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  team_id uuid references public.teams(id) on delete set null,
  marketing_consent boolean not null default false,
  marketing_consent_at timestamptz,
  marketing_source text not null default 'signup',
  transactional_consent boolean not null default true,
  frequency_cap int not null default 0, -- 0 = unlimited, N = max N per day/week/month
  suppression_list boolean not null default false,
  unsubscribe_at timestamptz,
  preferences jsonb not null default '{}'::jsonb, -- Per-email kind preferences
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint email_preferences_frequency_cap_check check (frequency_cap >= 0)
);

comment on table public.email_preferences is 'User email consent and preferences';
comment on column public.email_preferences.marketing_consent is 'Whether user consented to marketing emails (opt-in at signup, unchecked)';
comment on column public.email_preferences.marketing_source is 'Signup flow source';
comment on column public.email_preferences.frequency_cap is 'Max emails per period (0=unlimited)';
comment on column public.email_preferences.preferences is 'Per-kind preferences (e.g. {"billing_receipt": true, "demo_request": false})';

-- Enable RLS
alter table public.email_preferences enable row level security;

-- Policy: users can read own preferences
create policy "users can read own email preferences" on public.email_preferences
  for select using (user_id = auth.uid());

-- Policy: users can update own preferences
create policy "users can update own email preferences" on public.email_preferences
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Policy: staff can read all preferences
grant all on public.email_preferences to service_role;

create unique index if not exists email_preferences_user_idx on public.email_preferences (user_id);
