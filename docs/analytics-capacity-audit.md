# Phase 0 Audit

## (a) Google Analytics, gtag, dataLayer and third-party scripts

### Existing locations:
- `apps/web/app/dashboard/(shell)/projects/[projectId]/settings/analytics/analytics-form.tsx` - GA config form with Measurement ID, consent mode ("ask" or "all")
- `apps/web/components/legal/cookie-consent.tsx` - Cookie consent requirement: `NEXT_PUBLIC_COOKIE_CONSENT=true` when analytics enabled
- `packages/site-server/src/handle.ts` line 690-713 - Counts visible HTML page views (existing analytics counting, not GA4)
- `packages/site-server/src/handle.ts` line 46-47 - `statsSaltSecret` for daily rotating salt (privacy-first visitor counting)

### Google Tag Manager / gtag:
- No gtag/Google Analytics currently loaded on public pages
- No `dataLayer` defined in the framework
- No Google script tags in any templates or pages

## (b) Current state of platform SEO

### Metadata:
- Landing page: Title "Get-On: Get your business online in minutes", Description "Build a simple website for your business with AI or by hand. Free web address, no technical skills needed."
- Template pages: Use framework metadata API, but need updating for new specs
- Legal pages: Static, via `lib/legal-content.ts`
- No canonical host redirect currently configured
- No robots.txt generation currently

### Sitemap:
- `app/sitemap.ts` exists but needs review for new allowed routes
- Search Console verification: exists and verified (must not break)

### Robots.txt:
- Needs to be generated to disallow private areas, allow public pages

### Structured data:
- Organization, WebSite, SoftwareApplication, AggregateOffer may exist but need verification
- FAQPage may exist if FAQ is implemented

### Redirects:
- Need to verify canonical host (www vs apex)
- 404 handling needs review

### Existing Search Console verification:
- Must record how it's done and keep it identical

## (c) Route inventory split

### Public (allowed for Google Analytics):
- `/`, `/templates`, `/templates/[slug]`, `/templates/category/[category]`, `/pricing`, `/request-demo`, `/signup`, `/login`, `/terms`, `/privacy`, `/cookies`, `/acceptable-use`, `/billing-policy`, `/report`

### Auth flow:
- `/signup`, `/login`, `/forgot-password`, `/reset-password`, `/verify-email`, `/login/verify`

### Token / private:
- `/e/` tracking redirects
- `/invite/`, `/transfer/`
- `/billing/` (including payment return)
- `/email/` (unsubscribe, preferences)
- `/security/`
- `/reset-password`, `/forgot-password`
- `/verify-email`, `/login/verify`
- `/onboarding/`
- `/confirm-recipient`
- `/p/` (preview links)
- `/dashboard`, `/admin`, `/api` (all private)
- Error pages rendered for private routes

### Marketing/(marketing) route group:
- To be defined for allowing Google Analytics

## (d) Worker stats event fields, Analytics Engine dataset binding and SQL API usage

### Worker stats event fields (from `packages/site-server/src/handle.ts`):
- `kind`: "view" or "click"
- `path`: URL path
- `params`: utm_source, utm_medium, utm_campaign, utm_term, utm_content, ref, fbclid, gclid, msclkid, ttclid, gs_link
- `siteId`: project identifier
- `projectId`: mapped from siteId
- `date`: ISO date string
- `visitorHash`: salted hash of IP + UA + date
- `linkCode`: optional link identifier

### Analytics Engine dataset:
- Currently bound to Worker events
- Data stored in Supabase tables (need to check current schema)
- Retention: 90 days (per `docs/stats.md`)

### SQL API usage:
- `/api/stats/ingest` endpoint validates worker signature, sanitizes params, calls `record_stats_event` RPC
- RPC `record_stats_event` inserts into stats tables
- Whitelist param keys: `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `utm_id`, `ref`, `fbclid`, `gclid`, `msclkid`, `ttclid`

## (e) Visitors page current state and why it may show nothing

### Current Visitors page (`apps/web/app/dashboard/(shell)/projects/[projectId]/visitors/page.tsx`):
- Shows three states:
  1. unpublished: "Publish your website to start counting"
  2. counting off: "Visitor counting is off"
  3. no visitors yet: "No visitors yet"
- Reads `project.settings.stats_enabled` to determine if counting is on
- Reads `project.status === "published"` to determine if published
- If neither published nor counting enabled, shows messaging
- If published and counting on, shows "No visitors yet" (likely because no data has been ingested)

### Possible reasons it shows "No visitors yet":
1. **Broken binding**: The page reads `stats_enabled` from `project_settings` but may not be set correctly
2. **Missing token**: Worker events may not be reaching the ingest API
3. **Empty dataset**: Analytics Engine may not have data yet
4. **Index key mismatch**: `stats_site_key` may not be properly set on projects
5. **Query errors**: The stats reader may have SQL issues
6. **Caching**: Data may be cached and stale

### Current stats storage:
- Daily rollups in `stats_daily`, `link_stats_daily`, `param_stats_daily` (90-day retention per `docs/stats.md`)
- Daily totals kept indefinitely
- No long-term history beyond 90 days

## (f) Existing model registry and admin Models page capabilities

### Model registry (`ai_models` table):
- Stores model information from Cloudflare catalogue
- Fields: model id, task type, properties, deprecation status
- Admin page exists at `/admin/console/ai` (needs verification)

### Admin Models page capabilities:
- List models with status
- Test model calls
- Import from catalogue
- Price management
- Assignment management (primary/fallback/candidate)
- Canary rollout

### What's missing per the new specs:
- Model status tracking (`active`, `deprecated`, `removed`, `candidate`)
- `catalog_ref` for raw catalogue entries
- `discovered_at` timestamps
- `ai_model_prices` table (append-only price history)
- `ai_model_assignments` with canary and rollout flow
- `ai_canary_metrics` for monitoring canary performance

## (g) Shared resources with concurrency limits

### Current limits (from code review):
- **AI calls**: Pools exist but need verification of capacities
- **Publish builds**: In-memory semaphore of 5 (to be replaced with governor)
- **Exports**: Limited but need verification
- **Imports**: Limited but need verification
- **Backups**: Limited but need verification
- **Email sending**: SES rate budget exists

### Specific limits found:
- `packages/capacity` - resource governor setup (partial)
- Email send rate: transactional reserve 50%, never less than 5 msg/s
- No per-team caps documented yet

## (h) Signup entitlement flow

### Current flow:
1. User registers via `POST /api/auth/register`
2. Email verification sent
3. User clicks verification link
4. After verification, entitlements are granted (but need to verify if synchronous)

### Steps after signup:
- Profile creation
- Personal team "{First name}'s Team" creation
- Owner membership
- `team_billing` set to Free plan
- `teams.plan_id = 'free'`
- `email_preferences` defaults
- Referral code generation
- Referral attribution if `gs_ref` exists
- **Account provisioning row** creation
- Welcome notice creation
- Onboarding checklist state

### Synchronous vs periodic:
- Need to verify if `activateFreeEntitlements` runs in the same transaction as email verification
- The prompt specifies it should be synchronous (no waiting for nightly job)

### Accounts missing free entitlements:
- Need to audit existing verified accounts for missing entitlements

## (i) Existing accounts missing any free entitlement

### Repair needed:
- `job:provision-repair` runs every 10 minutes to find verified accounts missing items
- Uses `verifyProvisioning(userId)` to compute `missing` list
- Fixes idempotently
- Alerts when >5 accounts needed repair in an hour

### Audit script:
- `pnpm provisioning:audit` reports all existing accounts missing entitlements
- `--apply` repairs them (grants free credit once per account; never grants twice)

### Unique grant guard:
- `free_ai_grant_at` per user (unique constraint)
- Idempotency key `free-grant:{userId}`
- Two simultaneous verification requests produce one grant