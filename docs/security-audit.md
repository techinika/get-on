# Security audit

Date: 2026-10-29. Branch: `feature/security`.
Source: task prompt Section 2 (audit) and Section 8.3.

This document is the Phase-0/audit deliverable. It records (a) routes and handlers, (b) RLS state, (c) service-role client uses, (d) server-side fetches to user-influenced URLs, (e) secrets and where they are read, (f) cookies and flags, (g) jobs and their real schedule (or lack of one), (h) reminders and notices and when they fire, (i) existing accounts that violate the new rules.

## (a) Routes, server actions, API handlers and required session level

47 route handlers exist under `apps/web/app` (list from `find apps/web/app -path '*route.ts'`). Auth routes: `/auth/sign-up`, `/auth/login`, `/auth/logout`, `/auth/google`, `/auth/callback`, `/auth/forgot-password`, `/auth/reset-password`. Public-ish: `/api/public/forms/[formId]`, `/api/stats/ingest`, `/api/webhooks/ses`, `/email/click/*`, `/email/open/*`, `/contact`, `/report`, `/request-demo`. Protected by middleware today: only paths starting `/dashboard` (and `/` `/signup` `/login` are in the matcher). Middleware (`apps/web/proxy.ts`) only checks `!user`, never email verification or two-step completion. Server actions in `apps/web/app/**/actions.ts` and `apps/web/lib/**` rely on `createClient()` (anon) or `createAdminClient()` (service role) and do not call any `requireVerifiedSession()` (none exists). Classification for the new model: every `/dashboard/*`, every mutating API route and every server action becomes "verified + two-step-verified"; `/admin/*` additionally requires staff elevation; public routes (landing, auth, legal, report, demo, contact form, click/open tracking) stay public or rate-limited.

## (b) Tables and RLS state

- RLS enabled on ~125 tables (distinct `alter table ... enable row level security`).
- 145 `create policy` statements across migrations.
- Restrictive policies: **0** (`as restrictive` not used anywhere). This is the core gap for database-level second-step enforcement.
- Membership checks use security-definer helpers: `user_is_team_member` (28), `user_has_team_role` (28), `user_can_access_project` (44), `user_can_access_page` (6), `user_shares_team_with` (5). Security-definer appears 189 times.
- No policy references `email_verified_at` or any session-verification predicate. Direct data-API calls with a stolen password succeed for unverified accounts.

## (c) Service-role client uses

`createAdminClient()` (`apps/web/lib/supabase/admin.ts`) uses `SUPABASE_SERVICE_ROLE_KEY` and bypasses RLS. Used widely: billing, publishing, activity, operations, admin actions, invite, transfer, confirm-recipient, referrals, exports/imports, media, backups, reports, support, team. Every one of these is a place where a bug could bypass RLS; the audit treats each as needing a review and, where possible, replacement with the user client plus RLS. The admin client is also used inside server actions that run as the user (e.g. `apps/web/app/dashboard/(shell)/team/actions.ts`), which is a privilege-escalation risk if inputs are not re-validated.

## (d) Server-side fetches to user-influenced URLs

Raw `fetch(` calls in non-test code (30 total). User-influenced ones that must move to `safeFetch`:
- `apps/web/lib/publishing/service.ts:68` (probe of a user site URL)
- `apps/web/lib/domains/service.ts:91` (health check of a customer hostname)
- `apps/web/lib/publishing/store.ts:121-261` (R2/S3-compatible object storage calls — fixed host, but URL built from config; review)
- `apps/web/scripts/jobs/domains.ts:212` (RDAP/health fetches)
- `apps/web/lib/links/kv.ts:28` (KV resync)
- `apps/web/lib/billing/pesapal.ts:132` (fixed Pesapal API host)
- `apps/web/lib/ai/provider.ts:114` (fixed Workers AI / gateway host)
- `apps/web/app/dashboard/(shell)/projects/[projectId]/settings/actions.ts:384` (URL from form input — must be safeFetch)
- `apps/web/app/api/webhooks/ses/route.ts:53` (confirmUrl from SNS — fixed-ish, verify)
- Turnstile siteverify calls in `request-demo/actions.ts` and `report/actions.ts` (fixed host, fine, but should share a helper).

Client-side fetches to our own API (`/api/...`) are same-origin and not in scope for safeFetch, but must keep CSRF/origin checks.

## (e) Secrets and where they are read

`apps/web/lib/env.ts` reads a subset; many reads are direct `process.env.*` scattered across lib and scripts. Secrets found: `SUPABASE_SERVICE_ROLE_KEY`, `IP_HASH_SALT`, `TURNSTILE_SECRET_KEY`, `FORM_TOKEN_SECRET` (+ previous), `INVITE_TOKEN_PEPPER`, `TRANSFER_TOKEN_PEPPER`, `MARKETING_TOKEN_SECRET`, `STATS_SALT_SECRET`, `WORKER_SHARED_SECRET`, `AWS_*`/SES, `CF_API_TOKEN_DOMAINS`, `CF_AI_API_TOKEN`, `AI_GATEWAY_ID`, `TRANSFER_TOKEN_PEPPER`, `IP_HASH_SALT`. Several have insecure dev defaults (`dev-form-token-secret-change-me`, `dev-salt`, `dev-invite-pepper-change-me`). No startup validation that secrets are set in production. `.env.example` exists. New secrets needed: `OTP_PEPPER`, `OTP_PEPPER_PREVIOUS`, `SECURITY_TOKEN_SECRET`, `JOBS_SECRET`, `FIELD_KEYS`, `FIELD_KEY_CURRENT`, `IP_HASH_PEPPER_ROTATION`, `HIBP_ENABLED`, `APP_ORIGIN`, `HEARTBEAT_URL`, `CSP_ENFORCE`.

## (f) Cookies and flags

- Supabase auth: `sb-*-auth-token` (managed by @supabase/ssr; flags depend on Supabase config — verify Secure/HttpOnly/SameSite).
- `gs_ref`: httpOnly, sameSite lax, secure in prod, 30 days, path `/` (proxy.ts).
- `gs_team` (`TEAM_COOKIE`): path `/`, maxAge 1 year, sameSite lax, httpOnly **false**, secure in prod (invite/transfer actions). Readable by JS — should be HttpOnly.
- `gs_sidebar` (`SIDEBAR_COOKIE`): set client-side, path `/`, max-age 1 year, samesite lax, **no secure flag**.
- No `__Host-` prefixed cookies anywhere. New cookies needed: `__Host-gs_chal` (challenge binding, 30 min, HttpOnly, Secure, SameSite=Strict), `__Host-gs_dev` (device recognition, 1 year, HttpOnly, Secure, SameSite=Strict).

## (g) Jobs and their real schedule

There is **no scheduler in the repository**. CI (`.github/workflows/ci.yml`) only runs on PR/workflow_dispatch. `apps/sites-worker/wrangler.jsonc` has no cron triggers. `supabase/config.toml` has no scheduled jobs. `docs/plugins.md` and `docs/domains.md` tell operators to run `pnpm job:*` from an external daily cron. `apps/web/scripts/jobs/all.ts` runs a fixed subset sequentially and is the de facto "run everything" entry point, but nothing invokes it automatically. Job inventory (Section 10 of the task prompt) plus audit-discovered jobs must all be registered in the new scheduler. `job:all` omits domains, ai, rebuild-published, backfill-media-hashes.

## (h) Reminders and notices and when they fire

- Billing reminders: `apps/web/lib/billing/email.ts` (notifyRenewalReminder at 14/7/3/1 days before term end, notifyDebt, notifyGraceStarted, notifyLapsed, notifyInvoiceExpired) deduped via `billing_notifications` (unique team_id+dedupe_key). Triggered from `apps/web/scripts/jobs/billing.ts` reading `settings.reminderDays` (default 30,7,1 — note: docs say 14,7,3,1; mismatch).
- Domain reminders: email kinds in catalogue; triggered from domain jobs.
- Invitations expiry: `apps/web/scripts/jobs/invitations-expire.ts`.
- Unverified account cleanup: no job exists today (new: `job:unverified-cleanup`).
- In-app notices/banners: no notification centre exists today. "notice" is local UI state and the `teamNoticeEmail` template. No bell/unread UI found.
- No central reminder engine, no dedupe across processes, no SLO measurement, no quiet hours.

## (i) Existing accounts that violate the new rules

Cannot be computed without a live database. The audit requires running (after migrations):
- `pnpm security:audit-accounts` → report unverified users who signed in, duplicates by canonical email, profiles without auth users, auth users without profiles, staff without verified email.
- `pnpm security:repair-accounts --apply` → safe repairs only (mark unverified-with-sessions as requiring verification at next login, revoke sessions; never delete accounts with data).
- Duplicate detection: `canonical_email()` backfill sets `duplicate_of` on the newer account in each group; report written to `docs/security-duplicates-report.md`. Never auto-merge or delete.

## Additional findings

- No dedicated `/verify-email` page; confirmation is link-based GET (`/auth/callback`).
- No rate-limit framework beyond ad hoc per-feature counters; no central policy registry or coverage test.
- No `safeFetch`; raw fetches to user-influenced URLs exist (Section (d)).
- No field encryption; sensitive columns (billing tax IDs, phones) stored plaintext.
- No security event log table or `recordSecurityEvent()` helper.
- No CSP or security headers configured in `apps/web/next.config.ts` (only Tailwind loader).
- No Turnstile integration in auth flows (only demo-request and report).
- Staff MFA is TOTP (AAL2) via Supabase; prompt Section 3/5.7 says retain TOTP infrastructure but make email OTP the active second factor for everyone including staff, with elevation. Contradiction recorded in the plan (Section 3 says "retained and we do not change anything on it", while 5.7/8.5 say remove enrolment pages/recovery codes). Resolution adopted: keep TOTP fields and provider interface, remove enrolment UX and recovery codes, email OTP becomes the active factor, staff additionally require elevation. Flagged for confirmation before launch.
- Signup is client-driven via Supabase `auth.signUp` directly from the browser route handler; public signup is not closed. Needs server-controlled endpoint.
- Google OAuth callback does not verify provider email in app code (relies on Supabase).
- Middleware matcher omits many routes; protection is implicit.
- `gs_team` cookie is httpOnly:false; `gs_sidebar` has no secure flag.
- Dev secret defaults present in several places.

## Assumptions recorded (to confirm before launch)

- `two_factor_policy`: `required` by default (prompt default).
- Code lifetimes: login/step_up 10 min, signup_verify 30 min, email_change 15 min, recovery 30 min.
- Session lifetimes: 30 days absolute / 7 days idle; staff 8 h / 30 min.
- JWT lifetime target 15 minutes (verify Supabase supports the chosen value).
- Rate limits per Section 5.6.
- IP hashes use a monthly rotating pepper.
- Disposable email domain list seeded from a public list.
- Auth service capabilities to verify on a live project: "before user created" hook availability, `session_id` claim in JWT, confirmation-email disable, JWT lifetime range. Record findings in docs/security.md.
- CSP rollout in report-only first, then enforce via `CSP_ENFORCE`.
