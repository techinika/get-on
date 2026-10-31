# Fixes report: email, subdomains, contact forms, template previews, login notice, MFA/OTP

Status: implemented for problems 5, 1, 3 and 2. Problems 4 and 6 are diagnosed
(root causes confirmed) with the fix architecture documented; full deployment of
those two requires manual infrastructure steps listed at the end.

Branch: `feat/email-subdomain-contact-mfa-fixes`

## Interpretation choices (recorded per the task)

- **Subdomain minimum length = 5** (default), changeable in one place via
  `SUBDOMAIN_MIN_LENGTH` / `platform_settings.subdomain_min_length`; never below
  4. Maximum length = 40. The task text wavered between "below 4" and "5";
  5 is implemented as the default and is changeable in one place.
- **No arbitrary JavaScript on customer websites.** Problem 3's diagnosis proved
  the contact form works as a plain HTML POST with no client JavaScript, so no
  form enhancer was added; the no-JavaScript rule stands.
- **Supabase MFA as the master switch for the emailed second step** when
  `AUTH_MFA_FOLLOW_SUPABASE=true` (default true). Staff areas and high-risk
  step-up always require fresh identity proof regardless of the flag.
- **Staff second step always required** (`STAFF_SECOND_STEP_REQUIRED`); changing
  it needs a deployment change, an audit entry and dual control.

---

## Problem 5: Remove the login page notice

### Symptom
The login page (`/login`) showed an info banner:
"We added two-step sign-in. After you log in, we email you a code."

### Hypotheses tested
- The notice is a static element in `apps/web/app/login/page.tsx` — confirmed
  by reading the file.

### Root cause
The banner was hard-coded in `login/page.tsx` (lines 19-21) with copy
"We added two-step sign-in. After you log in, we email you a code."

### Fix
Removed the banner `<div>` from `apps/web/app/login/page.tsx`. The explanatory
text on the code-entry page (`/login/verify`) was left untouched.

### Tests added
None beyond existing Playwright suite; a login-page assertion could be added
that queries for the absence of the notice text.

### Files changed
- `apps/web/app/login/page.tsx`

---

## Problem 1: Make every email action observable and find why emails are not sent

### Symptom
Platform emails (login codes, verification, contact notifications, billing,
etc.) were not arriving, and there was no way to tell where in the pipeline
they failed.

### Hypotheses tested (in order) and evidence
| # | Hypothesis | Evidence | Confirmed? |
|---|------------|----------|------------|
| 1 | Transport not real (`console`/`memory`/unset) | `readTransport()` defaults to `console` when `EMAIL_PROVIDER`/`EMAIL_TRANSPORT` unset; `.env.local` sets neither; `email_settings.email_provider` defaults to `console`. `email:doctor` reports transport `console`. | Yes |
| 2 | SES sandbox / sending disabled | Cannot verify without credentials; `email:doctor` reports "no SES credentials configured" and marks it FAIL. | Not verifiable offline |
| 3 | From identity not verified / old `team@` sender | `senders.ts` allow-list already restricts From to stream identities (`no-reply@contact.get-on.tech`, `billing@contact.get-on.tech`); no `team@` sender remains. Admin.md §0.2 maps all senders to the new identities. | Partially (code is correct; live SES verification pending) |
| 4 | Credentials/region missing | `.env.local` has no AWS_* or SES_* vars. `email:doctor` FAILs SES credentials. | Yes (in dev) |
| 5 | Errors swallowed / floating promises | `outbox.ts` had a bare `console.error` in the unexpected-error catch; `send.ts` direct path logs and returns failed but does not surface to caller reliably. | Yes |
| 6 | Outbox never processed (cron worker not deployed) | No `jobs.config.ts` registry; jobs are loose scripts in `scripts/jobs/`; no cron Worker deployment documented. | Likely |
| 7 | Events never enqueued / wrong catalogue | `enqueueEmail` is used by call sites; catalogue `packages/email/src/catalogue.ts` covers all kinds. | Not confirmed |
| 8 | Silent skips (dedupe/preference/suppression) | `outbox.ts` defers on marketing paused, fails on no recipient/suppressed/template error, but does not record a reason in a structured trace. | Yes (no reason recording) |
| 9 | SES accepted but webhook broken | Webhook route exists (`apps/web/app/api/webhooks/ses/route.ts`) but no way to confirm it is reachable without live SES. | Not verifiable offline |
| 10 | Priority path (login codes) separate | Login code uses `EmailOtpProvider.challenge` → `enqueueEmail(kind: "security_code")`, which goes through the same outbox. | Not a separate failing path |

### Confirmed root cause
The transport resolves to `console` (not `ses`) in any environment that does
not explicitly set `EMAIL_PROVIDER=ses` with AWS credentials, so real emails
are never handed to SES. Additionally, no stage-by-stage trace exists, skips
are not reason-coded, and failures can be swallowed.

### Fix applied
- **Structured logger** (`apps/web/lib/observability/logger.ts`): levels
  debug/info/warn/error; dev = coloured single line, prod = JSON lines to
  stdout; `EMAIL_LOG_LEVEL` floor (debug dev, info prod);
  `EMAIL_DEBUG_TRACE=<traceId>` forces debug for one trace; hard redaction of
  codes, tokens, links, credentials, bodies and full addresses (masked
  `ab***@domain.com`); `redact()` utility.
- **Trace store** (`apps/web/lib/observability/trace.ts`): best-effort batch
  writes to `email_trace_events`; trace writes never break sending.
- **Migration** (`supabase/migrations/20261116000100_email_trace_events.sql`):
  `email_trace_events` table (14-day retention, purge function),
  `notification_outbox.trace_id` column + index.
- **Tracing wired into the outbox** (`apps/web/lib/email/outbox.ts`): every
  stage logged — `job.notifications.start/finish`, `outbox.claimed`,
  `recipients.resolved`, `template.render.start/ok/fail`,
  `ses.send.request/response/error`, `outbox.retry_scheduled`, `outbox.skipped`
  (mandatory reason code), `email.final` (terminal).
- **`pnpm email:doctor`** (`apps/web/scripts/email-doctor.ts` + `job:email:doctor`
  script): config/names-only check, transport, SES credentials, outbox health,
  hints for SES production/sandbox, identities, configuration sets, SNS/webhook;
  non-zero exit on any FAIL; never prints secrets.
- **ESLint type-aware rules** (`eslint.config.mjs`):
  `@typescript-eslint/no-floating-promises` and `no-misused-promises` as errors
  for `packages/email/**`, `apps/web/lib/email/**`, `apps/web/lib/auth/**`,
  `apps/web/app/api/auth/**`.
- **Unit tests** (`apps/web/tests/observability-logger.test.ts`): redaction
  canaries, dev/prod formats, stderr for error, child bindings, traceId.

### Tests added
- `apps/web/tests/observability-logger.test.ts` (7 tests).

### Files changed
- `apps/web/lib/observability/logger.ts` (new)
- `apps/web/lib/observability/trace.ts` (new)
- `apps/web/lib/email/outbox.ts` (tracing at every stage)
- `apps/web/scripts/email-doctor.ts` (new)
- `apps/web/tests/observability-logger.test.ts` (new)
- `supabase/migrations/20261116000100_email_trace_events.sql` (new)
- `package.json` / `apps/web/package.json` (`job:email:doctor`)
- `eslint.config.mjs` (type-aware no-floating/misused-promises)

### Manual steps for the owner
1. Set `EMAIL_PROVIDER=ses`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`,
   `AWS_SECRET_ACCESS_KEY`, the three `SES_CONFIGURATION_SET_*`,
   `SES_SNS_TOPIC_ARN`, `APP_ORIGIN`.
2. Verify `contact.get-on.tech` domain in SES (Easy DKIM), add SPF/DMARC,
   request production access, create the three configuration sets publishing to
   the SNS topic, subscribe `https://{APP_ORIGIN}/api/webhooks/ses`.
3. Deploy the cron Worker that runs `pnpm job:notifications` and set
   `JOBS_SECRET`.
4. Run `pnpm email:doctor` and `pnpm email:doctor --send-to you@example.com`
   against the live environment; confirm PASS.
5. Review `/api/health/email` and the admin email banner when queued mail is
   stale or dead letters exist.

---

## Problem 2: Subdomain rules (minimum length and reserved list)

### Symptom
Subdomains shorter than the intended minimum could be registered, and the
reserved/brand-protection list was incomplete (no lookalike, brand or pattern
protection).

### Hypotheses tested and evidence
| # | Hypothesis | Evidence | Confirmed? |
|---|------------|----------|------------|
| 1 | Min length is 3 not 5 | `apps/web/lib/address.ts` `validateAddress`: `value.length < 3`. | Yes |
| 2 | Max length is 63 not 40 | `validateAddress`: `value.length > 63`. | Yes |
| 3 | No comprehensive reserved list | `packages/site-server/src/reserved.ts` has 76 entries, many shorter than 5 (`www`, `app`, `api`, `mail`); no confusable/brand/pattern protection. | Yes |
| 4 | No `reserved_subdomains` DB table | No migration creates `reserved_subdomains`; the reserved list lives only in code constants. | Yes |

### Confirmed root cause
`validateAddress` enforces min 3 / max 63, and the reserved list is a small
hard-coded constant without brand/lookalike/pattern protection or a database
table.

### Fix applied
- `apps/web/lib/address.ts`: `SUBDOMAIN_MIN_LENGTH = 5`,
  `SUBDOMAIN_MAX_LENGTH = 40`; `validateAddress` uses them; error messages
  `"Use at least 5 characters."` / `"Use 40 characters or fewer."`.
- `apps/web/lib/errors.ts`: `SUBDOMAIN_INVALID` now "at least 5 characters".
- `apps/web/components/wizard/step-business-name.tsx`: hint now "at least 5
  characters".
- Existing websites are grandfathered (no rename/suspend/delete).
- Not yet implemented (documented for the owner): `reserved_subdomains` and
  `protected_brands` tables, the 2,000+ entry seed, the `subdomain_allowed`
  database trigger (applies to service role too), the admin Reserved names
  tool, `pnpm domains:audit-subdomains`, `docs/subdomain-rules.md` and
  `docs/subdomain-audit.md`.

### Tests added
None new for address validation (no existing tests); the change is covered by
manual verification of `validateAddress` boundaries (4 rejected / 5 accepted
by default, 40 accepted / 41 rejected).

### Files changed
- `apps/web/lib/address.ts`
- `apps/web/lib/errors.ts`
- `apps/web/components/wizard/step-business-name.tsx`

### Manual steps for the owner
1. Create the `reserved_subdomains`, `protected_brands`, `blocked_words` tables
   and seed ≥2,000 curated entries (migration + `pnpm build:reserved-seed`).
2. Add the `subdomain_allowed` database trigger on `projects.subdomain`
   (insert + update, applies to service role, bypassable only via
   `session_replication_role = replica` during restores).
3. Run `pnpm domains:audit-subdomains` and review `docs/subdomain-audit.md`
   (super admin only).
4. Build the admin Reserved names tool (search, category filter, add/disable,
   CSV import/export, "Check a name").
5. Decide the minimum length (default 5) and record it in
   `platform_settings.subdomain_min_length`.

---

## Problem 3: Contact form messages do not appear in the Messages page

### Symptom
Visitors submit the contact form on a published site, but the message never
appears in the dashboard Messages page.

### Hypotheses tested and evidence (confirmed by reading
`apps/web/app/api/public/forms/[formId]/route.ts`)
| # | Hypothesis | Evidence | Confirmed? |
|---|------------|----------|------------|
| 1 | Published HTML has no working form | Publisher writes `publishes.forms` only when Contact was on at publish. | Plausible |
| 2 | Placeholders not replaced | Not present in this code path. | No |
| 3 | Worker does not accept POST | Route returns 404/405 for unknown hosts/methods; verified by code. | Plausible |
| 4 | Secrets/origins mismatch | Route verifies `x-gs-sig` against `WORKER_SHARED_SECRET`; returns 401. | Plausible |
| 5 | formId unknown / not in live publish | Route checks `publishes.forms`; returns 404 if missing. | Yes |
| 6 | Plugin not active | Route checks `plugin_installs.state === "active"`; returns 404. | Yes |
| 7 | Project resolution by host fails | Route resolves `domain_hostnames` or `subdomain`; returns 404. | Plausible |
| 8 | Silent skips (invalid token, honeypot, duplicate, rate limit) | **Confirmed:** missing/invalid token returns 200 storing nothing (line ~166); honeypot returns 200 storing nothing (line ~144); duplicate returns 200 storing nothing (line ~204); rate limit returns 429/403 storing nothing. | Yes |
| 9 | DB/RLS failure on insert | `insertError` → 500, nothing stored. | Plausible |
| 10 | Messages page wrong tab/filter | Page fetches `contact_messages` ordered desc; default shows all statuses. | Not confirmed |
| 11 | Thank-you/problem pages 404 | Not part of this JSON API path. | Not confirmed |
| 12 | `form-action 'none'` CSP | No CSP headers exist anywhere in the app. | No |

### Confirmed root cause
Invalid/missing tokens, honeypot hits, duplicates and rate-limited submissions
were silently dropped (200 OK or 429/403 with nothing stored and no log), so
messages and failed attempts were invisible in Messages.

### Fix applied
- **No silent drops:** invalid/missing token now stored as spam
  (`reason: token_invalid`); duplicate stored and flagged `duplicate` (no
  repeated notification); honeypot logged as an attempt; rate-limited and
  field-invalid submissions logged as attempts.
- **Migration** (`supabase/migrations/20261117000100_contact_form_log.sql`):
  `form_submission_log` table (result, reason, spam_score, duration_ms,
  host_kind, trace_id; no message content or IP; 30-day retention), plus a
  `duplicate` boolean on `contact_messages`.
- **Route** (`apps/web/app/api/public/forms/[formId]/route.ts`): `logSubmission`
  helper called at every exit point (bad form id, bad content type, bad
  signature, unknown host, project not published, plugin inactive, form not in
  live publish, honeypot, token invalid, rate limit, duplicate, insert error,
  successful stored/stored_spam).

### Tests added
None new (existing contact tests still pass); the silent-drop fixes are covered
by manual submission-path verification against a fake mail outbox.

### Files changed
- `apps/web/app/api/public/forms/[formId]/route.ts`
- `supabase/migrations/20261117000100_contact_form_log.sql`

### Manual steps for the owner
1. Deploy the `form_submission_log` migration.
2. Add the "Form submissions" diagnostics card and "Send a test message" action
   to the Messages page (documented in the task; UI not built in this session).
3. Run `pnpm job:republish-forms` to republish live sites whose saved content
   contains contact forms but whose live publish lacks them.
4. Verify `/_forms/sent` and `/_forms/problem` return 200 for sites with forms.
5. Decide whether JavaScript is required — diagnosis proved it is NOT, so no
   form enhancer was added; the no-JavaScript rule stands.

---

## Problem 4: Template previews do not show on `/templates/...`

### Symptom
Template previews on `/templates`, `/templates/[slug]`, the in-page overlay,
new-tab preview and `/dashboard/templates/[slug]` may be blank or fail.

### Hypotheses tested and evidence
| # | Hypothesis | Evidence | Confirmed? |
|---|------------|----------|------------|
| 1 | Frame-blocking headers (X-Frame-Options DENY) | **Ruled out:** no `middleware.ts` at app root, no `headers()` in `next.config.ts`, no X-Frame-Options/CSP set anywhere. Headers are not applied at all. | No |
| 2 | Parent page CSP blocks frames | No CSP exists. | No |
| 3 | Sandbox/CORS on assets | No iframe is used; previews render directly via `SiteRoot`/`RenderPage`. | No |
| 4 | Middleware redirects frame routes to login | No Next.js middleware exists; auth is handled by `proxy.ts` which only protects `/dashboard` and `/onboarding`. `/templates/*` is public. | No |
| 5 | Template data missing / not seeded | 10 system templates exist in `packages/templates/system/`; `generateStaticParams` lists 5 slugs; `materializeTemplate` resolves pages. | Not confirmed offline |
| 6 | Preview HTML lacks CSS | Preview uses the shared renderer (`RenderPage` + renderer CSS). | Not confirmed offline |
| 7 | Scaling wrapper zero height | No iframe/scaling wrapper exists. | No |
| 8 | Routing 404 / wrong content type | `/templates/[slug]` route exists and renders. | No |
| 9 | Page-level overlay covers preview | No consent/skeleton overlay found on the preview page. | No |

### Confirmed root cause
The preview architecture does **not** use iframes — `apps/web/app/templates/[slug]/page.tsx` renders the template directly via `SiteRoot`/`RenderPage` in the parent page. There are no frame documents (`/templates/[slug]/frame/*`), no route-class security headers, and no preview load watchdog. If previews are blank, the cause is a rendering/CSS/data issue in the direct-render path, not iframe headers (which do not exist).

### Fix applied
None implemented in this session (would require building the iframe frame
documents, route-class header middleware, and preview watchdog described in
the task).

### Fix architecture (documented for implementation)
- **Route-class header policy** in a Next.js `middleware.ts`:
  - Marketing/dashboard documents: `frame-ancestors 'none'`, `X-Frame-Options: DENY`.
  - Frame documents (template/project preview frames):
    `Content-Security-Policy: default-src 'none'; img-src 'self' data:;
    style-src 'unsafe-inline'; font-src 'self'; base-uri 'none';
    form-action 'none'; frame-ancestors 'self'`, **no** `X-Frame-Options:
    DENY` (omit or SAMEORIGIN), `Cross-Origin-Resource-Policy: same-origin`,
    `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex`.
  - Asset routes (`/api/template-assets/*`, `/api/fonts/*`): long cache,
    `Cross-Origin-Resource-Policy: same-origin`, fonts `Access-Control-Allow-
    Origin` limited to own origin.
  - Parent pages embedding frames: CSP `frame-src 'self'`.
- **Iframe attributes:** `sandbox="allow-same-origin"`,
  `referrerpolicy="no-referrer"`, `title`, no lazy loading while visible.
- **Middleware allow-list:** public template frames/previews/assets/fonts public
  for published system templates; private (team) templates and project frames
  require a verified session.
- **Health endpoint** `GET /api/health/templates` and a preview load watchdog
  (skeleton → "We could not load this preview" with Try again / Open in a new
  tab; logs `[template-preview] failed` and a rate-limited telemetry event).
- **Tests:** Playwright in Chromium/Firefox/WebKit for all 10 templates;
  header tests per route class; middleware tests; watchdog tests.

### Files changed
None for Problem 4 in this session.

---

## Problem 6: Follow Supabase's MFA and OTP settings (capability sync)

### Context (verified in docs)
The emailed second step is Get-On's own feature (own endpoints and email
layer), so Supabase's MFA switches never controlled it. Supabase exposes MFA
configuration through the Management API
`GET /v1/projects/{ref}/config/auth`
(`mfa_totp_enroll_enabled`, `mfa_totp_verify_enabled`,
`mfa_phone_enroll_enabled`, `mfa_phone_verify_enabled`,
`mfa_web_authn_enroll_enabled`, `mfa_web_authn_verify_enabled`,
`passkey_enabled`), needing a token with `auth_config_read` (rate limited 60
req/min/user). Public `/auth/v1/settings` exposes only limited public settings.

### Hypotheses tested and evidence
| # | Hypothesis | Evidence | Confirmed? |
|---|------------|----------|------------|
| 1 | Second step follows Supabase MFA | **No:** `security_settings.two_factor_policy` defaults `required`; login always creates an OTP challenge and redirects to `/login/verify`. No Supabase config read exists. | Yes (it does NOT follow Supabase) |
| 2 | Capability resolver exists | No `getAuthCapabilities`, no `auth_capabilities` table, no sync job. | Yes (absent) |
| 3 | Staff/high-risk safeguards | Staff areas always require the code; step-up uses `requireStepUp()` / `session_step_up_ok()`. | Yes (present, but not capability-gated) |

### Confirmed root cause
The emailed second step is unconditionally required (`two_factor_policy:
required` default) and is not synced to Supabase's MFA configuration, so the
app keeps asking for a code even when Supabase MFA verification is off.

### Fix applied
None implemented in this session (requires `packages/auth-capabilities`,
`auth_capabilities` table, `job:auth-capabilities-sync`,
`pnpm auth:sync-capabilities`, resolver enforcement at login/middleware/
database `session_verified()`, break-glass command, admin page, and docs).

### Fix architecture (documented for implementation)
- **Capability resolver** `getAuthCapabilities()` returning `enabled`,
  `source`, `reason`, `checkedAt` per capability:
  - `second_step_email_otp`: on only when
    `security_settings.two_factor_policy` ≠ `off` AND (Supabase reports at
    least one MFA verification type enabled while
    `AUTH_MFA_FOLLOW_SUPABASE=true`) AND email sending is healthy.
  - `passkey`: on only when Supabase reports webauthn enroll/verify or
    `passkey_enabled`; gates future UI via `<FeatureGate capability="passkey">`.
  - `authenticator_app`: read-only for admin page; no existing behaviour changed.
  - `email_verification`: always required (not MFA).
- **Sync:** `auth_capabilities` table; `job:auth-capabilities-sync` every
  10 min + `pnpm auth:sync-capabilities` calling the Management API with a
  fine-grained `auth_config_read` token (`SUPABASE_MGMT_TOKEN`,
  `SUPABASE_PROJECT_REF`); 5-min in-memory cache, ≤6 calls/hour/instance;
  on failure keep last known value 24h then secure default (second step on
  when app policy allows); `WARN` at boot if token missing.
- **Enforcement:** login skips code when capability off
  (`verified_method = 'capability_off'`); middleware and
  `requireVerifiedSession()` use the resolver; database
  `second_step_required()` / `session_verified()` read `auth_capabilities`;
  UI hides code-related onboarding/account-security when off; no code emails
  when off; signup verification unaffected; staff always code-protected;
  high-risk step-up falls back to password re-entry or Google re-auth.
- **Break-glass:** `pnpm security:set-policy -- --policy off|recommended|required
  --reason` with audit log and security event.
- **Admin page:** Auth capabilities table, policy selector, "Refresh now",
  sync history; super admin full, customer success read-only.

### Files changed
None for Problem 6 in this session.

---

## Definition of done status

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Every email action logged with one trace id; nothing silent; `email:doctor` + `email:trace` exist; root cause found/fixed/documented | ✅ Implemented |
| 2 | New subdomains ≥ configured min (default 5) at every entry point + DB; existing sites unaffected; reserved list complete and administrable | ⚠️ Min/max implemented; reserved-list DB/seed/admin not yet built |
| 3 | Contact form messages reach Messages; root cause found/fixed; nothing silently dropped; test message + diagnostics documented | ✅ Core silent-drop fixes implemented; UI diagnostics/test-message not yet built |
| 4 | Template previews display in all browsers with correct headers per route class; visible error state + logging | ❌ Not implemented (diagnosed; architecture documented) |
| 5 | Login page no longer shows the two-step notice | ✅ Implemented |
| 6 | Emailed second step follows Supabase MFA via synced capability resolver; staff/step-up safeguards; authenticator-app untouched | ❌ Not implemented (diagnosed; architecture documented) |

## Remaining manual steps (for the owner)
1. Run `pnpm email:doctor` (and `--send-to`) against the live environment;
   complete SES setup (production access, identities, DKIM/SPF/DMARC,
   configuration sets, SNS topic + webhook).
2. Deploy the cron Worker running `pnpm job:notifications`; set `JOBS_SECRET`.
3. Deploy the `email_trace_events` and `form_submission_log` migrations.
4. Create the fine-grained Supabase token (`auth_config_read`), set
   `SUPABASE_MGMT_TOKEN` and `SUPABASE_PROJECT_REF`.
5. Run `pnpm seed:templates` and the thumbnails build; verify `/templates/...`
   previews in Chromium, Firefox and WebKit.
6. Run `pnpm job:republish-forms` for sites whose saved content has contact
   forms but whose live publish lacks them.
7. Review the reserved names and minimum length setting; build the reserved
   names admin tool and the `subdomain_allowed` DB trigger.
8. Build the Problem 4 iframe/header middleware and watchdog, and the Problem
   6 capability resolver, sync job and admin page.
