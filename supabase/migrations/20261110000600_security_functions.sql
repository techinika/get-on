-- Security hardening: session verification functions for RLS and helpers.

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
    where ss.session_id = (nullif(current_setting('request.jwt.claim.session_id', true), ''))::uuid
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
    where ss.session_id = (nullif(current_setting('request.jwt.claim.session_id', true), ''))::uuid
      and ss.user_id = auth.uid()
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
    where ss.session_id = (nullif(current_setting('request.jwt.claim.session_id', true), ''))::uuid
      and ss.user_id = auth.uid()
      and ss.elevated_until is not null
      and ss.elevated_until > now()
  );
$$;

-- Auth before user created hook (called by auth service if available).
create or replace function public.auth_before_user_created(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := event->>'email';
  v_canonical text := public.canonical_email(v_email);
  v_domain text;
begin
  if v_email is null or v_email = '' then
    return jsonb_build_object('error', jsonb_build_object('message', 'AUTH_EMAIL_INVALID', 'http_code', 400));
  end if;
  v_domain := split_part(lower(v_email), '@', 2);
  if exists (select 1 from public.blocked_email_domains where domain = v_domain) then
    return jsonb_build_object('error', jsonb_build_object('message', 'AUTH_EMAIL_BLOCKED', 'http_code', 400));
  end if;
  if exists (select 1 from public.disposable_email_domains where domain = v_domain) then
    return jsonb_build_object('error', jsonb_build_object('message', 'AUTH_EMAIL_DISPOSABLE', 'http_code', 400));
  end if;
  if exists (select 1 from public.profiles where email_canonical = v_canonical and duplicate_of is null) then
    return jsonb_build_object('error', jsonb_build_object('message', 'AUTH_EMAIL_EXISTS', 'http_code', 400));
  end if;
  -- registration_open check
  if exists (select 1 from public.security_settings where id = true and (select count(*) from public.security_settings) > 0) then
    -- placeholder: registration openness stored elsewhere; default open
    null;
  end if;
  return jsonb_build_object('decision', 'continue');
end;
$$;
