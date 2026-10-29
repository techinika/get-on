-- Security hardening: profiles identity fields and canonical email.

alter table public.profiles
  add column if not exists email_canonical text,
  add column if not exists email_verified_at timestamptz,
  add column if not exists two_factor_enabled boolean not null default true,
  add column if not exists two_factor_setup_at timestamptz,
  add column if not exists password_changed_at timestamptz,
  add column if not exists timezone text not null default 'UTC',
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists duplicate_of uuid references public.profiles(id),
  add column if not exists signup_ip_hash text,
  add column if not exists last_sign_in_at timestamptz,
  add column if not exists locked_until timestamptz;

create table if not exists public.email_provider_rules (
  domain text primary key,
  ignore_dots boolean not null default false,
  collapse_repeated_dots boolean not null default false,
  strip_plus_tag boolean not null default true
);

insert into public.email_provider_rules (domain, ignore_dots, collapse_repeated_dots) values
  ('gmail.com', true, false),
  ('googlemail.com', true, false),
  ('yahoo.com', false, true),
  ('ymail.com', false, true),
  ('rocketmail.com', false, true)
on conflict (domain) do nothing;

-- SQL canonical_email: NFKC handled by app; here we do trim/lower/tag-strip/gmail mapping.
-- Full punycode and NFKC happen in the application; this function mirrors the
-- database-side computation for RLS/trigger use.
create or replace function public.canonical_email(p_email text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v text;
  v_at int;
  v_local text;
  v_domain text;
begin
  if p_email is null then return null; end if;
  v := lower(trim(p_email));
  if v = '' then return v; end if;
  v_at := strpos(v, '@');
  if v_at <= 1 or v_at = length(v) then return v; end if;
  v_local := substr(v, 1, v_at - 1);
  v_domain := substr(v, v_at + 1);

  -- strip +tag
  if position('+' in v_local) > 0 then
    v_local := split_part(v_local, '+', 1);
  end if;

  if v_domain in ('gmail.com','googlemail.com') then
    v_local := replace(v_local, '.', '');
    v_domain := 'gmail.com';
  elsif exists (select 1 from public.email_provider_rules r where r.domain = v_domain and r.collapse_repeated_dots) then
    v_local := regexp_replace(v_local, '\.{2,}', '.', 'g');
  end if;

  -- trim leading/trailing dots
  v_local := regexp_replace(v_local, '^\.+|\.+$', '', 'g');

  if v_local = '' or v_domain = '' then return v; end if;
  return v_local || '@' || v_domain;
end;
$$;

-- Trigger to keep profiles.email_canonical in sync with auth.users.email.
create or replace function public.profiles_set_canonical()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  select email into v_email from auth.users where id = new.id;
  new.email_canonical := public.canonical_email(v_email);
  return new;
end;
$$;

drop trigger if exists profiles_canonical_trg on public.profiles;
create trigger profiles_canonical_trg
  before insert or update on public.profiles
  for each row execute function public.profiles_set_canonical();

-- Partial unique index: one account per canonical email among non-duplicates.
create unique index if not exists profiles_email_canonical_unique
  on public.profiles (email_canonical)
  where duplicate_of is null and email_canonical is not null;

-- Backfill canonical keys for existing rows (duplicates recorded, never auto-merged).
update public.profiles p
set email_canonical = public.canonical_email(u.email)
from auth.users u
where u.id = p.id and p.email_canonical is null;
