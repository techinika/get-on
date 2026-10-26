-- Keep a web address unavailable for 30 days after a website is purged.
create table if not exists public.subdomain_holds (
  name text primary key,
  hold_until timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.subdomain_holds enable row level security;

create or replace function public.is_subdomain_available(candidate text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select not exists (select 1 from public.projects where subdomain = candidate)
     and not exists (select 1 from public.reserved_subdomains where name = candidate)
     and not exists (select 1 from public.subdomain_holds where name = candidate and hold_until > now());
$$;

create or replace function public.release_subdomain_holds()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if auth.role() <> 'service_role' then
    raise exception 'NOT_ALLOWED';
  end if;
  with removed as (
    delete from public.subdomain_holds where hold_until <= now() returning 1
  )
  select count(*) into v_count from removed;
  return v_count;
end;
$$;
revoke all on function public.release_subdomain_holds() from public;
grant execute on function public.release_subdomain_holds() to service_role;
