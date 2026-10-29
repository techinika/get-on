# Security

This document describes the rules the code enforces, the flows that implement
them, and the runbooks the team follows. It is the source of truth for
authentication and account security. `docs/ui-spec-security.md` covers the
screens; `docs/security-audit.md` records the route, RLS and secret inventory.

## 1. Core rules

1. **No access without a verified email and a completed second step.** A
   session counts only when `profiles.email_verified_at` is set **and** the
   session has an `email_otp` verification in `session_security`. This is
   enforced in `proxy.ts`, in server helpers and, once the restrictive policies
   are applied, in the database through `session_verified()`.
2. **One person, one account per email.** The canonical key
   (`public.canonical_email` / `canonical_email` in `apps/web/lib/security/canonical-email.ts`)
   is unique among non-duplicate profiles. Every signup path refuses a key that
   already exists.
3. **Codes are secret, short lived, single use and bound.** Only an HMAC of the
   code is stored (`auth_challenges.code_hash`). A code is bound to its purpose,
   subject, challenge id, browser binding cookie and, for sign-in, the auth
   session id.
4. **No one-time action is consumed by a page view.** Verification and reset
   links only render a page; the state change is always a `POST`.
5. **Sensitive actions need a fresh code** (step-up). `session_step_up_ok()` in
   the database and `requireStepUp()` in server code.
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
The auth service does **not** send an email; we create a `signup_verify`
challenge and send the code through our outbox.

An existing **unverified** account with the same canonical email is never
duplicated: a new code is sent and the existing account is kept (its password is
not replaced). A verified account returns `AUTH_EMAIL_EXISTS`; a Google account
returns `AUTH_EMAIL_EXISTS_GOOGLE`.

Responses take a minimum of about 250 ms plus 200–400 ms of jitter so timing
does not reveal which branch ran.

## 3. Verification

`/verify-email` shows six boxes. `POST /api/auth/verify-email` verifies the
code, sets `email_confirmed_at` through the admin API and
`profiles.email_verified_at`, then starts the session server-side with a
`magiclink` token that is used once, immediately, and never emailed. The signup
code counts as the first sign-in code for that browser.

There are **no verification links**. Supabase's own auth emails must be disabled
(Section 9). Expired and wrong codes verify nothing and always return a clear
message; a new code invalidates the old one.

## 4. Sign-in

1. `POST /api/auth/login` checks origin, rate limits and account lockout, then
   verifies the password on the server (cookies set there).
2. A `session_security` row is created with `verified_at` null.
3. A `login` challenge is created, bound to `__Host-gs_chal` and the session id.
4. The code email goes out. `/login/verify` has six boxes.
5. `POST /api/auth/otp/verify` verifies the code, marks the session verified,
   records the device and, for a genuinely new device, emails the owner.

A session that has a password step but no code can only reach `/login/verify`,
resend, logout and static assets. `proxy.ts` redirects everything under
`/dashboard` and `/onboarding` to the code page.

Sessions created before this release have no `session_security` row and are
therefore unverified: the next page load asks for a code.

## 5. Codes

| Purpose | Lifetime | Bound to |
| --- | --- | --- |
| `signup_verify` | 30 minutes | email hash, browser |
| `login` | 10 minutes | user, session, browser |
| `step_up` | 10 minutes | user, session, browser |
| `email_change_old` / `_new` | 15 minutes | user, browser |
| `recovery` | 30 minutes | user, browser |

Six digits from `crypto.randomInt`, leading zeros kept. Stored as
`HMAC-SHA256(OTP_PEPPER, purpose | subject | challengeId | code)` with the
pepper version, compared in constant time. Five attempts per code, then it is
invalidated. Resend cooldown 60 seconds; five codes per hour per subject and
per email hash, ten per hour per network. Parallel verification is safe because
consumption is a conditional update (`consumed_at is null`).

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
- The step-up dialog, Account Security page, session list, notification centre,
  scheduler, reminders, admin Security and Jobs pages, field encryption and
  `security.txt` expiry job are specified in `docs/ui-spec-security.md` and are
  not built yet.
- Staff elevation replaces the earlier authenticator-app requirement only after
  the staff screens are migrated; the `SecondFactorProvider` interface is ready
  for a second provider.
