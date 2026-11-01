-- Read the session id from the verified JWT claims.
--
-- Older installs read request.jwt.claim.session_id, which current PostgREST
-- does not populate. The tfa_required restrictive policies then rejected every
-- authenticated table read, even after the user completed MFA and the
-- session_security row was verified. The dashboard saw no membership rows and
-- redirected back to /login.
--
-- Re-issue the helpers so they all use auth.jwt() through current_session_id().
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
