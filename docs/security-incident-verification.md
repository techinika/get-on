# Security incident: email verification (Problem A)

Date: 2026-10-29. Branch: `feature/security`.
Source: task prompt Section 2, Phase 0.

## Symptom
After signup, verifying the email shows an error that the code/link is expired, yet afterwards the user can still sign in. So unverified accounts can sign in and the verification step is unreliable.

## Hypotheses tested (in order)

### (1) Email security scanners or link previews consume the one-time confirmation link
**Evidence:** CONFIRMED by code.
- `apps/web/app/auth/callback/route.ts` lines 4-27: the OAuth/email-confirmation callback is a **GET** handler that calls `supabase.auth.exchangeCodeForSession(code)`. Supabase PKCE/email-confirmation codes are single use.
- A mail client's link preview, an antivirus scanner, or a Next.js prefetch hitting `/auth/callback?code=...` would exchange and consume the code before the user clicks, so the user's real click then fails with "That link has expired".
- There is no verify-email page in the app at all; confirmation is entirely link-based GET, so any scanner prefetch breaks it.
- Also the signup email redirect target is `/auth/callback`, a GET.
**Failing test to write:** `tests/security/verification-scanner-prefetch.test.ts` — simulate a GET to the confirmation URL before the user's click; assert the link is still consumable by the user (will fail until links are removed and codes are typed).

### (2) Confirmation link/code expiry shorter than email text promises, or stale redirect URL
**Evidence:** PARTIALLY CONFIRMED (config-dependent, cannot fully verify without a live project).
- The app never communicates an expiry to the user; the only message on failure is the generic "That link has expired. Please log in again." (`apps/web/app/auth/callback/route.ts` line 19). Supabase's default email-confirmation token lifetime is 1 hour (project setting), while users may expect longer.
- Redirect URL is built from `new URL(request.url).origin` at request time (`apps/web/app/auth/sign-up/route.ts` line 21), so it follows the request host; if `NEXT_PUBLIC_SITE_URL`/allowed redirect URLs in Supabase differ, the link can be rejected. No allow-list validation in app code.
- Mitigation in new design: no links at all; typed 6-digit codes with explicit 30-minute lifetime and a clear `OTP_EXPIRED` message.
**Failing test to write:** `tests/security/verification-expiry.test.ts` — assert the expiry communicated in email matches the actual token lifetime (will fail until codes replace links).

### (3) Multiple verification emails exist and an older code or link is used
**Evidence:** NOT CONFIRMED in code (no app-side resend of verification today), but plausible.
- Signup calls `supabase.auth.signUp` on every submit; Supabase sends a fresh confirmation email each time and invalidates previous tokens in many project configurations. The app has no dedupe or "already sent" state.
- No evidence of an explicit older-code path in app code.
**Failing test to write:** `tests/security/verification-resend.test.ts` — request two verification emails, use the first code/link, assert it fails and a new code works (will be covered by the OTP resend tests).

### (4) "Confirm email" is off or signup auto-confirms, so unverified accounts get sessions
**Evidence:** CONFIRMED as a risk / configuration dependency.
- `apps/web/app/auth/sign-up/route.ts` lines 46-58: if `data.session` is returned (which happens when email confirmation is disabled in the Supabase project), the user is redirected straight to the dashboard with a live session, with no verification step at all.
- There is no check of `email_confirmed_at` anywhere in the app.
**Failing test to write:** `tests/security/unverified-cannot-signin.test.ts` — assert an unverified account cannot reach `/dashboard` (will fail today because middleware only checks `!user`).

### (5) The app checks verification only on some routes (middleware gaps, server actions, API routes) and the DB does not check it at all
**Evidence:** CONFIRMED.
- `apps/web/proxy.ts` lines 19-21: only checks `if (!user && path.startsWith("/dashboard")` — no email-verified check. Matcher is only `["/", "/signup", "/login", "/dashboard/:path*"]`, so many routes are never middleware-protected at all.
- `apps/web/lib/supabase/middleware.ts` lines 5-26: `getUser()` only; no verification.
- RLS: `supabase/migrations` has 0 restrictive policies and 0 uses of any verification predicate. Policies gate on team membership only (`user_is_team_member` etc.), never on `email_verified_at`. So a stolen password gives full data access even for an unverified account.
- Server actions and API routes do not call any `requireVerifiedSession()` helper (none exists).
**Failing test to write:** `tests/security/stolen-password.test.ts` — sign in with password only (no code) and call the data API for every table/bucket; assert nothing readable/writable (will fail today).

### (6) OAuth sign-in or the invitation flow creates or links accounts without verifying the email
**Evidence:** PARTIALLY. Invitation flow is OK; OAuth is config-dependent.
- `supabase/migrations/20261028000300_team_member_rpcs.sql` `accept_invitation`: checks `v_verified is null` → `INVITE_EMAIL_UNVERIFIED`. So invitations require a verified email. Good.
- Google OAuth (`apps/web/app/auth/google/route.ts`, `apps/web/app/auth/callback/route.ts`): relies on Supabase marking the Google email as confirmed. Supabase does set `email_confirmed_at` for verified OAuth providers, but the app never re-checks and never gates on it. A misconfigured provider or an unverified Google email would still yield a session.
- No app-side handling of "Google email not verified".
**Failing test to write:** `tests/security/oauth-unverified.test.ts` — assert a Google login whose provider email is not verified cannot reach the dashboard (covered by middleware verification gate).

### (7) Clock or timezone mismatch between server and auth service when computing expiry
**Evidence:** NOT CONFIRMED. No app-side expiry computation exists; all expiry is Supabase's. No timezone handling in auth code. Marked "not applicable to current design; revisit if clocks are suspected."

### (8) The verification page calls the verification endpoint twice (React strict mode or prefetch), consuming the code
**Evidence:** CONFIRMED as the same mechanism as (1).
- There is no verification page today, but the `/auth/callback` GET is triggered by both the user click and any prefetch/scanner. Double invocation consumes the single-use code; the second call returns "expired".
- In React strict mode, any future client-side verification call would double-invoke; the new design must make verification idempotent or guard against double submit.
**Failing test to write:** `tests/security/verification-double-submit.test.ts` — submit the same code twice (strict-mode style); assert the first succeeds and the second does not error (returns already-verified / no-op) (will fail today because the link is consumed).

## Confirmed root causes
1, 4, 5, 8 (and 1 covers 8's mechanism). 2 is config-dependent and addressed by removing links. 3 and 6 are partial/acceptable today but tightened in the new design. 7 not applicable.

## Decision recorded
Replace link-based verification entirely with typed 6-digit email codes (Section 5.1/6.1 of the task prompt): no verification link anywhere, Supabase confirmation emails disabled for the project, confirm-email setting stays ON as defence in depth, and verification is enforced in middleware, server helpers and the database (restrictive RLS).
