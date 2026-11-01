alter table public.session_security
  drop constraint if exists session_security_verified_method_check;

alter table public.session_security
  add constraint session_security_verified_method_check
  check (verified_method in ('email_otp', 'signup_otp', 'totp'));
