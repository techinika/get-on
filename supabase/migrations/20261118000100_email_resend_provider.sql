-- One-person email now goes through Resend. SES is kept for marketing
-- campaigns. "auto" lets the sender choose per message; an explicit provider
-- still overrides every message.

alter table public.email_settings
  alter column email_provider set default 'auto';

do $$
declare
  v_constraint record;
begin
  for v_constraint in
    select conname
    from pg_constraint
    where conrelid = 'public.email_settings'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%email_provider%'
  loop
    execute format(
      'alter table public.email_settings drop constraint %I',
      v_constraint.conname
    );
  end loop;

  alter table public.email_settings
    add constraint email_settings_email_provider_check
    check (email_provider in ('auto', 'resend', 'ses', 'smtp', 'console', 'memory'));
end;
$$;

update public.email_settings
  set email_provider = 'auto', updated_at = now()
  where email_provider = 'console';

create or replace function public.admin_set_email_provider(p_provider text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_provider not in ('auto', 'resend', 'ses', 'smtp', 'console', 'memory') then
    raise exception 'Invalid email provider: %', p_provider;
  end if;
  update public.email_settings set email_provider = p_provider, updated_at = now() where id;
end;
$$;

revoke all on function public.admin_set_email_provider(text) from public;
grant execute on function public.admin_set_email_provider(text) to service_role;
