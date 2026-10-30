-- Make the email provider and SMTP settings present on databases that already
-- ran the original email_outbox migration (which was edited in place).

alter table public.email_settings
  add column if not exists email_provider text not null default 'console',
  add column if not exists smtp_host text default null,
  add column if not exists smtp_port integer default 587,
  add column if not exists smtp_secure boolean default false,
  add column if not exists smtp_user text default null,
  add column if not exists smtp_from text default null,
  add column if not exists smtp_name text default 'Get-On';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.email_settings'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%email_provider%'
  ) then
    alter table public.email_settings
      add constraint email_settings_email_provider_check
      check (email_provider in ('ses', 'smtp', 'console', 'memory'));
  end if;
end;
$$;

create or replace function public.admin_set_email_provider(p_provider text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_provider not in ('ses', 'smtp', 'console', 'memory') then
    raise exception 'Invalid email provider: %', p_provider;
  end if;
  update public.email_settings set email_provider = p_provider, updated_at = now() where id;
end;
$$;

create or replace function public.admin_get_email_provider()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_provider text;
begin
  select email_provider into v_provider from public.email_settings where id;
  if v_provider is null then
    v_provider := 'console';
  end if;
  return v_provider;
end;
$$;

create or replace function public.admin_set_smtp_settings(
  p_host text,
  p_port integer,
  p_secure boolean,
  p_user text,
  p_from text,
  p_name text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.email_settings set
    smtp_host = p_host,
    smtp_port = p_port,
    smtp_secure = p_secure,
    smtp_user = p_user,
    smtp_from = p_from,
    smtp_name = p_name,
    updated_at = now()
  where id;
end;
$$;

revoke all on function public.admin_set_email_provider(text) from public;
revoke all on function public.admin_get_email_provider() from public;
revoke all on function public.admin_set_smtp_settings(text, integer, boolean, text, text, text) from public;

grant execute on function public.admin_set_email_provider(text) to service_role;
grant execute on function public.admin_get_email_provider() to authenticated;
grant execute on function public.admin_set_smtp_settings(text, integer, boolean, text, text, text) to service_role;
