-- Security hardening: read the session id from the JWT claims, registration
-- flag, and row level security for the auth-internal tables.

-- Supabase puts `session_id` in the verified JWT claims. auth.jwt() is the
-- supported accessor; the old request.jwt.claim.* setting is kept as a fallback
-- for older PostgREST versions.
create or replace function public.current_session_id()
returns uuid
language sql
stable
set search_path = public
as $$
  select nullif(
    coalesce(
      auth.jwt() ->> 'session_id',
      current_setting('request.jwt.claim.session_id', true)
    ),
    ''
  )::uuid;
$$;

create or replace function public.session_verified()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.session_security ss
    join public.profiles p on p.id = ss.user_id
    where ss.session_id = public.current_session_id()
      and ss.user_id = auth.uid()
      and ss.verified_at is not null
      and ss.revoked_at is null
      and ss.expires_at > now()
      and ss.idle_expires_at > now()
      and p.email_verified_at is not null
  );
$$;

create or replace function public.session_step_up_ok(p_max_age interval)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.session_security ss
    where ss.session_id = public.current_session_id()
      and ss.user_id = auth.uid()
      and ss.revoked_at is null
      and ss.verified_at is not null
      and ss.step_up_until is not null
      and ss.step_up_until > now() - p_max_age
  );
$$;

create or replace function public.session_elevated()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.session_security ss
    where ss.session_id = public.current_session_id()
      and ss.user_id = auth.uid()
      and ss.revoked_at is null
      and ss.elevated_until is not null
      and ss.elevated_until > now()
  );
$$;

grant execute on function public.current_session_id() to authenticated, service_role;
grant execute on function public.session_verified() to authenticated, service_role;
grant execute on function public.session_step_up_ok(interval) to authenticated, service_role;
grant execute on function public.session_elevated() to authenticated, service_role;

-- Registration switch.
alter table public.security_settings
  add column if not exists registration_open boolean not null default true;

-- Re-issue the signup guard so it honours the switch.
create or replace function public.auth_before_user_created(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := event->>'email';
  v_canonical text := public.canonical_email(event->>'email');
  v_domain text;
  v_open boolean;
begin
  if v_email is null or v_email = '' then
    return jsonb_build_object('error', jsonb_build_object('message', 'AUTH_EMAIL_INVALID', 'http_code', 400));
  end if;

  select registration_open into v_open from public.security_settings where id = true;
  if v_open is false then
    return jsonb_build_object('error', jsonb_build_object('message', 'REGISTRATION_CLOSED', 'http_code', 403));
  end if;

  v_domain := split_part(lower(v_email), '@', 2);
  if exists (select 1 from public.blocked_email_domains where domain = v_domain) then
    return jsonb_build_object('error', jsonb_build_object('message', 'AUTH_EMAIL_BLOCKED', 'http_code': 400));
  end if;
  if exists (select 1 from public.disposable_email_domains where domain = v_domain) then
    return jsonb_build_object('error', jsonb_build_object('message', 'AUTH_EMAIL_DISPOSABLE', 'http_code': 400));
  end if;
  if exists (select 1 from public.profiles where email_canonical = v_canonical and duplicate_of is null) then
    return jsonb_build_object('error', jsonb_build_object('message', 'AUTH_EMAIL_EXISTS', 'http_code': 400));
  end if;

  return jsonb_build_object('decision', 'continue');
end;
$$;

-- Indexes used by the challenge and session paths.
create index if not exists auth_challenges_ip_idx on public.auth_challenges (ip_hash, created_at desc);
create index if not exists auth_challenges_email_idx on public.auth_challenges (email_hash, purpose, created_at desc);
create index if not exists session_security_idle_idx on public.session_security (idle_expires_at);

-- Internal tables: service role only. RLS on with no policy denies the anon and
-- authenticated roles outright.
do $$
declare
  t text;
  tables text[] := array[
    'auth_challenges', 'auth_tokens', 'rate_limits', 'auth_lockouts', 'blocked_ips',
    'signup_attempts', 'security_settings', 'email_provider_rules',
    'disposable_email_domains', 'blocked_email_domains', 'job_definitions',
    'job_runs', 'job_locks'
  ];
begin
  foreach t in array tables loop
    if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = t) then
      execute format('alter table public.%I enable row level security', t);
    end if;
  end loop;
end $$;

-- Users may list and revoke their own sessions once the session is verified.
alter table public.session_security enable row level security;

drop policy if exists session_security_select_own on public.session_security;
create policy session_security_select_own on public.session_security
  for select to authenticated
  using (user_id = auth.uid() and (select public.session_verified()));
