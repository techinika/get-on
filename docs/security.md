# Security

This document describes the rules the code enforces, the flows that implement
them, and the runbooks the team follows. It is the source of truth for
authentication and account security. `docs/ui-spec-security.md` covers the
screens; `docs/security-audit.md` records the route, RLS and secret inventory.

## 1. Core rules

1. **No access without a verified email and a completed second step.** A
   session counts only when `profiles.email_verified_at` is set **and** the
   session has a `totp` verification in `session_security` after Supabase MFA.
   The signup email code only proves the address; it does not replace the
   authenticator. This is enforced in `proxy.ts`, in server helpers and, once
   the restrictive policies are applied, in the database through
   `session_verified()`.
2. **One person, one account per email.** The canonical key
   (`public.canonical_email` / `canonical_email` in `apps/web/lib/security/canonical-email.ts`)
   is unique among non-duplicate profiles. Every signup path refuses a key that
   already exists.
3. **One-time secrets are single use.** Supabase Auth owns the signup email
   code (short lived, single use, hashed by Supabase). Our own reset and
   not-me links are random tokens stored only as SHA-256 hashes in
   `auth_tokens`, with a single-use conditional update.
4. **No one-time action is consumed by a page view.** Verification and reset
   links only render a page; the state change is always a `POST`.
5. **Sensitive actions still need a fresh check.** Staff actions require
   Supabase AAL2. Customer step-up can build on the same authenticator flow;
   there is no emailed login code.
6. **Sessions are visible and revocable.** `session_security` is the list;
   revoking sets `revoked_at` and the database function stops accepting the
   session immediately, before the JWT expires.
7. **No staff bypass.** Nobody at Get-On can skip or reset a customer's second
   step. Recovery is the documented process in section 8.
8. **Responses say no more than needed.** Login, resend and password reset
   responses are identical whether or not the account exists. The signup form
   is the one place that says an email is already registered, protected by
   Turnstile and rate limits.
9. **Abuse is throttled** through `rateLimit()` and `POLICIES`.
10. **Outbound requests to user-influenced URLs go through `safeFetch`.**
11. **Everything security-relevant is recorded** in `security_events` through
    `recordSecurityEvent()`.

## 2. Registration

`POST /api/auth/register` is the only signup path. The auth service's own
`/auth/v1/signup` must be closed (or guarded by the `auth_before_user_created`
hook), because the public anon key would otherwise bypass these rules.

Order of checks: origin, body, registration switch, email syntax, disposable and
blocked domains, terms, password policy, Have I Been Pwned, per-IP rate limits,
Turnstile, canonical uniqueness, then `auth.admin.createUser({ email_confirm: false })`.
The auth service sends the signup code through its SMTP settings, which point
at Resend on `mail.get-on.tech`. We store only the address in a signed pending
cookie; there is no local challenge row.

An existing **unverified** account with the same canonical email is never
duplicated: a new code is sent and the existing account is kept (its password is
not replaced). A verified account returns `AUTH_EMAIL_EXISTS`; a Google account
returns `AUTH_EMAIL_EXISTS_GOOGLE`.

Responses take a minimum of about 250 ms plus 200–400 ms of jitter so timing
does not reveal which branch ran.

## 3. Verification

`/verify-email` shows six boxes. `POST /api/auth/verify-email` calls Supabase
`verifyOtp({ type: "signup" })`, which confirms the address and returns the
session. We then set `profiles.email_verified_at`, create the
`session_security` row, and send the person to `/mfa/setup`.

There are **no verification links**. Supabase's signup template must show
`{{ .Token }}`. Expired and wrong codes verify nothing; a new code invalidates
the old one. `POST /api/auth/signup/resend` sends another code.

## 4. Sign-in

1. `POST /api/auth/login` checks origin, rate limits and account lockout, then
   verifies the password on the server (cookies set there).
2. A `session_security` row is created with `verified_at` null.
3. If the account has a verified Supabase TOTP factor, redirect to `/mfa`;
   otherwise redirect to `/mfa/setup`. `/mfa/setup` enrols the authenticator.
4. The browser calls Supabase `mfa.challenge` and `mfa.verify`, giving an AAL2
   session.
5. `POST /api/auth/mfa/complete` checks AAL2, marks `session_security` verified
   with method `totp`, records the device and, for a genuinely new device,
   emails the owner with a not-me link.

A session that has a password step but no authenticator code can only reach
`/mfa`, setup, logout and static assets. `proxy.ts` redirects everything under
`/dashboard` and `/onboarding` to the authenticator page.

Sessions created before this release have no `session_security` row and are
therefore unverified: the next page load asks for the authenticator code.

## 5. One-time secrets

- **Signup code:** sent by Supabase Auth; six digits, short lived, hashed and
  rate limited by Supabase. We add per-email and per-network sends.
- **Reset and not-me links:** 43-character random tokens in `auth_tokens`,
  stored as SHA-256 hashes, single use, `POST`-only for the state change.
  Lifetimes: reset 30 minutes, not-me 24 hours, email-change undo 72 hours.

Supabase Auth does not offer an email MFA factor. Customer sign-in uses TOTP;
the signup code is the only Supabase-sent code.

## 6. Passwords

Minimum 10 characters (`security_settings.min_password_length`), maximum 128,
no composition rules. Rejected: the local common-password list, the email local
part or display name, repeated characters, keyboard or numeric sequences, and
passwords present in the Have I Been Pwned range API. The HIBP call sends only
the first five characters of the SHA-1 hash, has a 2-second timeout and fails
open with a warning.

## 7. Rate limits and locks

Policies live in `apps/web/lib/security/policies.ts`. Login: 10 per 15 minutes
per email hash, 30 per hour per network. Code verification: 10 per 30 minutes
per session. Code sends: as in section 5. Registration: 5 per hour and 20 per
day per network hash. Password reset: 3 per hour per email hash, 10 per hour per
network. After 10 password failures in 15 minutes the account is locked for
15 minutes (`profiles.locked_until`) and the owner gets a notice.

IP addresses are never stored raw; `hashIp()` uses `IP_HASH_SALT`.

## 8. Account recovery

### Password reset

1. `/forgot-password` posts to `POST /api/auth/password/forgot` (Turnstile, 3
   requests per hour per address and 10 per hour per network). The answer is
   always `/forgot-password?sent=1`, with the same words and about the same
   delay, whether or not the address has an account.
2. A live account gets a row in `auth_tokens` with purpose `password_reset`, a
   30-minute lifetime and the exact address `https://{APP_ORIGIN}/reset-password?t=...`
   in the email. `replaceOpen` retires earlier links, and only the SHA-256 hash
   of the token is stored.
3. `GET /reset-password?t=` only looks the token up. Nothing changes from a page
   view, so an email scanner that opens the link cannot use it. Used, expired
   and unknown tokens all show the same "That link is no longer valid" card
   with a link to ask for a new one.
4. `POST /api/auth/password/reset` checks the password policy and Have I Been
   Pwned, consumes the token with a conditional update (`used_at is null`), sets
   the password through the admin API, retires every other reset link, revokes
   every session (`revokeAllSessions`, reason `password_changed`), emails the
   owner and shows the success card. A token is therefore used once even when
   two requests race.
5. `POST` only. There is no `GET` on any of the three endpoints.

The old Supabase `resetPasswordForEmail` routes (`/auth/forgot-password` and
`/auth/reset-password`) are deleted: they depended on auth emails, which are off.

### "This was not me"

Each sign-in code email carries a **Secure my account** button. The link is an
`auth_tokens` row with purpose `not_me` (24 hours, one use) and points at
`/security/not-me?t=`. The page only reads the token. `POST /api/auth/not-me`
consumes it, signs out every device, retires open reset links, sends a fresh
password reset link and records a critical `not_me_reported` event. The success
card tells the owner to check their email; it never claims the password was
changed, because the owner chooses it through the reset link.

### Email lost

Email lost: the public recovery form opens a support case. Only a super admin
may change an account's login email, with dual control when two or more super
admins exist, identity checks per the runbook, and a **72-hour waiting period**
during which the old address receives daily notices and a "stop this" link.
After the change every session is revoked and a password reset is forced. No
other staff path changes a login email.

## 9. Manual settings for the auth service

These are not code changes and must be applied in the Supabase dashboard:

- **Confirm email: on.** Unverified accounts must not receive a session even if
  our code has a bug.
- **Public signup: off**, or the before-user-created hook enabled and pointed at
  `public.auth_before_user_created`.
- **Auth emails: off** (custom SMTP disabled / all templates disabled). Our
  outbox sends every authentication email from `no-reply@contact.get-on.tech`.
- **JWT lifetime: 15 minutes**; refresh token rotation on.
- **Redirect URLs:** only `APP_ORIGIN` paths we use.
- **Rate limits:** align the auth service limits with section 7.

Until public signup is closed, the API still refuses a canonical duplicate and
the database hook refuses it too when enabled.

## 10. Runbooks

### Key rotation

1. Generate a new `OTP_PEPPER` (32+ random bytes) and move the old value to
   `OTP_PEPPER_PREVIOUS`; set `OTP_PEPPER_VERSION` to the next integer.
2. Deploy. Codes in flight still verify against the previous pepper; new codes
   use the current one.
3. After the longest lifetime (30 minutes), the previous value can be removed.

`SECURITY_TOKEN_SECRET` rotation invalidates pending auth cookies, which is
safe: users start the flow again.

### Suspected breach

1. Revoke sessions: `update session_security set revoked_at = now()` for the
   affected user, and sign the user out in the auth service.
2. Force a password reset and check `security_events` for the window.
3. Notify the owner using `account_secured`; follow the legal notification
   process if personal data was exposed.

### "Under attack"

1. Turn on Cloudflare WAF managed rules and bot fight mode.
2. Rate limit `/api/auth/*` at the edge (10 requests per minute per IP).
3. Block offending address hashes in `blocked_ips`; the admin Security page
   lists them.
4. Watch `security_events` for `login_rate_limited` and `otp_failed` spikes.

## 11. Known gaps (tracked)

- Restrictive "two-step required" policies are generated by
  `pnpm security:gen-rls`; they must be applied with the rest of the migrations
  before the database-level guarantee is live.
- Password reset and the not-me link are built. Email change with its undo
  link, the step-up dialog, Account Security page, session list, notification
  centre, scheduler, reminders, admin Security and Jobs pages, field encryption
  and the `security.txt` expiry job are specified in `docs/ui-spec-security.md`
  and are not built yet.
- Staff elevation replaces the earlier authenticator-app requirement only after
  the staff screens are migrated; the `SecondFactorProvider` interface is ready
  for a second provider.
