-- Profiles created before the security columns existed (or confirmed outside
-- this app) can have email_verified_at = null even though Supabase has already
-- confirmed the address. session_verified() requires the profile flag, so those
-- users passed MFA but every RLS read still returned zero rows.
update public.profiles p
set email_verified_at = u.email_confirmed_at
from auth.users u
where p.id = u.id
  and p.email_verified_at is null
  and u.email_confirmed_at is not null;
