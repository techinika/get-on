-- Platform staff: super admin, customer success

create table if not exists public.platform_staff (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text not null,
  role text not null default 'customer_success',
  totp_secret text not null,
  totp_enabled boolean not null default false,
  last_login_at timestamptz,
  last_ip_hash text,
  created_at timestamptz not null default now(),
  constraint platform_staff_role_check check (role in ('super_admin','customer_success'))
);

comment on table public.platform_staff is 'Platform staff accounts (super admin, customer success)';
comment on column public.platform_staff.role is 'Role: super_admin or customer_success';
comment on column public.platform_staff.totp_secret is 'TOTP secret for two-factor authentication';
comment on column public.platform_staff.totp_enabled is 'Whether TOTP is enabled (mandatory for all staff)';

create unique index if not exists platform_staff_email_idx on public.platform_staff (lower(email));

-- Enable RLS
alter table public.platform_staff enable row level security;

-- Policy: staff can read own profile only
create policy "staff can read own profile" on public.platform_staff
  for select using (email = current_setting('app.current_staff_email', true));

-- Policy: service role can do everything
grant all on public.platform_staff to service_role;

-- Audit log trigger setup will be done in migration 20261101000200
