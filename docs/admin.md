# Platform staff and the admin console

This document records the Phase 0 audit for the staff/admin/email work, then the rules the platform now follows. Read it with `docs/ui-spec-admin.md` (the admin and email screens) and `docs/email-system.md` (the email platform).

Terminology: **team roles** are Owner, Admin, Editor and Viewer (customers). **Platform staff** are Get-On employees with the roles **Super admin** and **Customer success**. Staff screens say "staff", never "admin user", so nobody confuses staff with the customer role Admin.

## 0. Phase 0 audit

### 0.1 Existing admin screens and actions and their fate

The old staff area was guarded by `ADMIN_EMAILS` and used the service-role client directly. Every item below is re-homed, restricted to metadata, moved behind approval, or removed.

| Screen / action | Old behaviour | New fate |
|---|---|---|
| `/admin` overview | Website-centric list with owner emails and "open website" links | Replaced. Role-aware dashboard on metadata only (7.2). No owner email unless masked; no website content. |
| `/admin/sites` list | Lists every site with name, address, owner email, review state | Metadata only via `admin_websites`; no open buttons; no owner emails in lists. |
| `/admin/sites/[siteId]` | Publish history, review buttons, **preview of draft**, rebuild, take offline / bring online, remove report | Draft preview **removed**. Rebuild and "bring online" **removed**. Take offline becomes super-admin **takedown** with reason + email; customer success requests it. Review approve/reject stays with the new emails. Report handling becomes moderation evidence. |
| `takeSiteOffline` (action) | Suspended a site and rewrote the KV pointer | Kept only as super-admin `moderation.takedown`, with category + reason, owner email and `website_suspended` activity row. Customer success can only request. |
| `bringSiteOnline` (action) | Restored a site | Super-admin `reinstate`, emails `website_unsuspended`. |
| `rebuildSite` (action) | Re-published a customer's site | **Removed** (website management). Job health/error counts remain visible. |
| `requestSiteReview` / `approveSite` | Requested/approved review | Kept as moderation decisions; approval clears `review_state` and emails `website_review_approved`; rejection emails `website_review_rejected`. |
| `removeReport` | Marked an abuse report handled | Kept inside moderation evidence flow. |
| `/admin/teams` + `setTeamPlan` | Listed teams, project counts, invitations; "Set plan manually" | Manual plan setting **replaced** by **Free access** (grants) behind approvals. Team 360 is metadata only. |
| `/admin/teams` Websites tab | Restore on behalf, run backup now, re-sync, delete provider hostname, reassign hostname, pause/resume domains | **Removed** (content or website management). Domain "re-check now" kept (metadata, direct). |
| `/admin/teams` Activity tab + reason dialog | Free-text reason, no transparency to customer | Replaced by the **access purpose modal** and a customer-visible `staff_viewed` team-activity row (no staff name). |
| `/admin/operations` | Domain provider health and pending hostnames | Visibility kept (jobs/health). Retrying customer operations for them **removed**. |
| `/admin/ai` | AI settings, model toggles, request counts | Settings and caps stay super-admin. Request viewer with **payloads is removed**; only metadata and masked moderation categories. |
| `/admin/ai/design` | Design gallery | Content-adjacent; kept read-only for platform-owned template art only; never customer content. |
| `/admin/billing` | Billing settings, terms, coupons, grants, void invoice, refund, review items | Re-homed under **Money** with the approvals matrix. Invoice PDFs super-admin only and audited. |
| `/admin/domains` + actions | Recheck, retry hostname, **reassign hostname**, pause/resume, simulate lapse, delete provider hostname, approve/reject | Reassign and delete provider hostname **removed** (website/domain management). Recheck direct. Approve/reject becomes `moderation.domain_review` (customer success requests). |
| `/admin/referrals` | Settings, held queue decisions | Customer success view + request; super admin decides. |
| `/admin/email` | Email health, recent emails, suppression list | Re-homed under **Email** with roles and masking (7.9). |
| `admin_audit_log` | Wrote moderation actions only | Renamed `staff_audit_log`; now also records **reads**; append-only. |
| `support_access` team-activity event | Existed conceptually | Renamed `staff_viewed`, visible to owners and admins. |
| `ADMIN_EMAILS` / `isAdminEmail` | Email allow-list | **Removed** everywhere. Identity is `platform_staff` + TOTP (AAL2). |
| Share/stats admin page (if present) | Platform-wide top parameter values, link abuse tools | **Removed** (customer data). Whitelist editor and rollup lag cards stay. |
| System templates editing | Editable by any admin email | Super admin only (platform-owned data). |

### 0.2 Every place an email is sent today

All sends go through `apps/web/lib/email/send.ts` → `packages/email`. Sender today is `team@get-on.tech` (or `billing@contact.get-on.tech` for `billing_*`). The new sender identities change every row.

| File | Kind | Recipients | Old sender | New stream / sender |
|---|---|---|---|---|
| `lib/contact/notify.ts` | `contact_notification` | owner + verified recipients | team@ | T / no-reply@contact |
| `lib/contact/notify.ts` | `contact_autoreply` | the visitor | team@ | T / no-reply@contact |
| `lib/contact/notify.ts` | `contact_digest` | owner | team@ | T / no-reply@contact |
| `lib/contact/notify.ts` | `recipient_verification` | new recipient | team@ | T / no-reply@contact |
| `lib/team/invitations.ts` | `team_invite`, `team_invite_reminder` | invitee | team@ | T / no-reply@contact |
| `lib/team/invitations.ts` | invite accepted/declined | inviter | team@ | T / no-reply@contact |
| `lib/team/transfers.ts` | `website_transfer` | recipient team | team@ | T / no-reply@contact |
| `lib/referral-rewards.ts` | `referral_reward` | referrer | team@ | T / no-reply@contact |
| `app/request-demo/actions.ts` | `demo_request_alert`, `demo_request_ack` | team / requester | team@ | T / no-reply@contact |
| `app/report/actions.ts` | `abuse_report_alert` | team | team@ | T / no-reply@contact |
| `app/invite/[token]/actions.ts` | `invite_accepted`, `invite_declined`, `member_removed` | owners | team@ | T / no-reply@contact |
| `app/dashboard/(shell)/team/actions.ts` | `member_role_changed` etc. | member | team@ | T / no-reply@contact |
| `app/dashboard/(shell)/projects/[projectId]/plugins/actions.ts` | `contact_*` | owner / visitor | team@ | T / no-reply@contact |
| `lib/billing/email.ts` | `billing_receipt`, `billing_payment_failed`, `billing_renewal_reminder`, `billing_grace_started`, `billing_lapsed`, `billing_debt_reminder`, `billing_invoice_expired`, `billing_refund` | owner / billing | billing@contact | B / billing@contact |
| `lib/email/send.ts` | `admin_alert` (legacy) | `ADMIN_EMAILS` | team@ | S / no-reply@contact → staff login emails |

All of these must move to `notification_outbox` + the catalogue (`packages/email/catalogue.ts`), keep their current triggers, and adopt the new senders and templates.

### 0.3 Significant product events that do not send an email yet

Compared with Section 9 of the brief. These have no email today and must gain one through the outbox:

- `account.welcome` (first verified login), `account.password_changed`, `account.email_change_requested`, `account.email_changed`, `account.mfa_changed`, `account.deleted` (hook only).
- `team.member_joined`, `team.member_left`, `team.ownership_transferred` (notice), `team.seats_paused`.
- `website.created`, `website.first_published`, `website.publish_failed`, `website.unpublished`, `website.deleted`, `website.restored`, `website.purge_warning`, `website.purged`, `website.transferred` (both sides), `website.suspended` / `unsuspended`, `website.review_required` / `review_result`, `website.plan_paused`, `website.import_done`, `website.backup_failed`, `website.form_limit_reached`.
- Domain lifecycle emails (live, attention, stalled, expiring, plan lapsed/restored, removal notice, claim lost, review, reverify) exist in behaviour but not all are mailed.
- Billing: `invoice_created`, `invoice_voided`, `invoice_expiring`, `payment_pending`, `payment_reversed`, `refund_requested`/`completed`, `subscription_extended`, `grace_reminder`, `lapsed_reminder`, `plan_restored`, `coupon_assigned`, `access_granted`/`revoked`, `billing_email_verify`, `billing_details_changed`, `billing_hold`, `billing_grace_extended`, `credits_added_by_support`.
- AI: `ai.credits_low`, `ai.credits_added`, `ai.limit_set`, referral digests.
- Staff: `staff_added`, `staff_role_changed`, `staff_removed`, `staff_mfa_reset`, `staff_security_alert`, `approval_requested`, `approval_decided`, `approval_expired`, `campaign_finished`, `campaign_paused_by_guard`, `admin_weekly_report`, `admin_alert`. Approval mail is queued by `apps/web/lib/email/approval-notifications.ts`; it carries approval metadata only and never customer content.

### 0.4 Admin code that touches content tables

Before this work, admin modules read the following. The privacy boundary forbids all of these for staff; they are replaced by `admin_*` views/functions that expose metadata only.

- `apps/web/lib/admin-data.ts` — `projects` (name, subdomain, status, review state, suspension), `publishes` (status, live_at, **pages_count**). Page counts are metadata; publish rows are fine. No page text.
- `apps/web/app/admin/actions.ts` — `projects` (full row incl. team, subdomain), `publishes`, `site_flags`, `abuse_reports`. It also rewrites the KV pointer and re-publishes sites (content management) — removed.
- `apps/web/app/admin/teams/page.tsx` — `teams`, `plans`, `team_members`, `projects`, `team_invitations`, `profiles` (email). Email shown in lists → masked; full only on 360.
- `apps/web/app/admin/billing/*` — `billing_settings`, `billing_terms`, `coupons`, `access_grants`, `billing_review_items`. Metadata; kept behind Money + approvals.
- `apps/web/app/admin/ai/page.tsx` and `actions.ts` — `ai_models`, `ai_usage_daily`, `ai_requests` (count only). No payloads. Settings are platform data.
- `apps/web/app/admin/domains/*` — `domains`, `domain_hostnames`, `domain_events`, `projects` (id, name, subdomain). Metadata; hostname reassignment removed.
- `apps/web/app/admin/referrals/*` — `referral_settings`, `referrals`.

None of the above may select page blocks, page text, messages, media, backups, AI payloads, settings JSON, tracked links or visitor stats.

### 0.5 Service-role client in admin routes

Every file below constructed `createAdminClient()` inside `app/admin/**` (service role, bypasses RLS). Under the new rules admin code must not use the service-role client at all; staff reads go through `admin_*` views/functions on the user's own session.

Files to migrate off the service role:

- `apps/web/app/admin/actions.ts`
- `apps/web/app/admin/ai/actions.ts`
- `apps/web/app/admin/ai/page.tsx`
- `apps/web/app/admin/ai/design/page.tsx`
- `apps/web/app/admin/billing/actions.ts`
- `apps/web/app/admin/billing/page.tsx`
- `apps/web/app/admin/domains/actions.ts`
- `apps/web/app/admin/domains/page.tsx`
- `apps/web/app/admin/domains/[domainId]/page.tsx`
- `apps/web/app/admin/email/page.tsx`
- `apps/web/app/admin/operations/page.tsx`
- `apps/web/app/admin/page.tsx`
- `apps/web/app/admin/referrals/actions.ts`
- `apps/web/app/admin/referrals/page.tsx`
- `apps/web/app/admin/sites/page.tsx`
- `apps/web/app/admin/sites/[siteId]/page.tsx`
- `apps/web/app/admin/teams/actions.ts`
- `apps/web/app/admin/teams/page.tsx`
- `apps/web/lib/admin-data.ts` / `apps/web/lib/admin-domains.ts` (helpers, take a client)

A static test fails when `app/admin/**` or `lib/admin/**` imports `@/lib/supabase/admin` or a storage client, or queries a forbidden table.

## 1. Staff roles and permissions

Two staff roles: **Super admin** and **Customer success**. The permission matrix is `packages/permissions/src/staff-matrix.ts`; the generated summary is `docs/staff-permissions.md`; the SQL function `staff_can(permission)` is generated from the same file and a test asserts the two agree.

- Every staff check goes through `staff_can` / `staff_assert` (TypeScript `staffCan` / `staffAssert`). No other staff checks exist.
- Customer success can search, view metadata (with a purpose), keep notes, run cases, message customers, check payment status, resend invoice/receipt/invitation/verification emails, rebuild entitlements, clear a coupon or sign-in lockout, and update demo requests. Everything that changes money, access, credits, plans or a website is a **request**.
- Super admin is the only role for staff management, kill switches, pricing, coupon creation, AI settings, system templates, marketing, exports and most reports.
- Dual control: above thresholds, and for some actions whenever two or more super admins exist, a second super admin must approve. If only one super admin exists, dual control is skipped and the audit row is flagged `single_operator`.

## 2. Customer content boundary

Staff can never read or change customer content. "Content" includes: page blocks and text, titles and slugs, shared sections, pictures, files, PDFs and storage objects, website settings and business profile data (hours, social links, SEO, analytics ids, verification tags, redirects, writing style, design, colors), team templates, contact messages and recipients, subscribers, backups, exports, imports and their files, preview links, tracked links and link statistics, visitor statistics, AI inputs and outputs, billing tax ids (masked for super admins only), and anything in customer storage.

Staff may see metadata only: account and team identity, websites as records, domains, plans, quotas and usage numbers, invoices/payments, AI credit summaries and request metadata, the team activity log, email delivery logs, abuse reports and the moderation evidence defined below, demo requests, cases and notes.

Moderation evidence is limited to: the **public** published address (openable like any visitor), the screening rule ids that fired and up to five 80-character excerpts of **published** text, and the reporter's text. Draft or unpublished content is never shown.

Enforcement is threefold:

1. **Database:** staff paths have no grants on forbidden tables; `admin_*` views expose explicit columns only; `SECURITY DEFINER` functions check `staff_can` and AAL2 and write an audit row. A test enumerates every table and asserts no staff path can read a forbidden one.
2. **Code:** admin modules import only from `lib/admin/data/*`. ESLint forbids the service-role client, storage clients and forbidden-table queries in `app/admin/**` and `lib/admin/**`. The forbidden list is `packages/permissions/forbidden-for-staff.ts`, used by tests and CI.
3. **Tests:** canary strings placed in page text, messages, AI payloads, backups and business details must never appear in any admin response, log or email.

The one website action a staff member may take is a super-admin **takedown** (sets the suspension state; no content change; reason and category required; owner emailed). Customer success can only request it.

## 3. Staff authentication and sessions

- Staff sign in with their normal account, then complete a TOTP challenge (Supabase MFA) to reach **AAL2**. Without it every `/admin` route and every admin function refuses (`STAFF_MFA_REQUIRED`).
- A staff member without an enrolled factor is redirected to `/admin/setup-mfa` (QR enrolment, 10 one-time recovery codes, stored hashed). Recovery code use is audited and emailed. Staff cannot disable their own MFA.
- Sessions: idle 30 minutes, absolute 8 hours, re-authentication within 15 minutes for sensitive actions. Admin responses send `Cache-Control: no-store` and `X-Robots-Tag: noindex` with a strict CSP.
- Optional `ADMIN_HOST` (when set, `/admin` only responds there) and `ADMIN_IP_ALLOWLIST` (CIDRs; empty means off). Failed attempts are rate limited.
- Every staff sign-in and failure writes `staff_login_events`.

## 4. Audit and transparency

- `staff_audit_log` is append-only (triggers block update/delete). Every staff read of a customer record and every write is audited with who, what, when, why (purpose), and the approval id when applicable.
- `staff_access_sessions` records each opened customer record with a purpose and a 60-minute window. Reads inside the window reuse one `read` row per record per window.
- When staff open a customer's account details, owners and admins see a team-activity row `staff_viewed` ("Get-On customer success viewed your account details. Reason: {purpose}. Case {number}") once per team per 24 hours, without the staff member's name.

## 5. Approvals

- Customer success requests an action with a validated payload and a written reason (min 10 characters). A super admin decides with a reason (required to reject). Four-eyes: `decided_by <> requested_by`.
- Approved requests re-validate state (`APPROVAL_STALE` when plan/balance/invoice/website state changed in a way that matters), execute through the same service functions the customer features use, record requester + approver, email the parties, and mark `executed` or `failed`.
- Requests expire after 72 hours (`job:approvals-expire`). At most 20 open requests per support member; duplicate open requests are rejected. A requester can cancel their own pending request.
- Super-admin direct actions require a reason and fresh authentication; dual control applies above thresholds and whenever two or more super admins exist for the listed kinds.
- Record screens show a direct form only when the member has the matching `direct` permission. Everyone else gets a prefilled request link when they can request that action.

Seeded policies and thresholds live in `docs/approvals.md`.

## 6. Email

The email platform is documented in `docs/email-system.md` and marketing in `docs/marketing-email.md`. Rules that affect staff:

- Senders are fixed by stream: `transactional` and `marketing` from `no-reply@contact.get-on.tech` ("Get-On"), `billing` from `billing@contact.get-on.tech` ("Get-On Billing"). `team@get-on.tech` is only Reply-To and the human contact in footers.
- Every significant event queues one email through the outbox in the same transaction as the business change, deduplicated by key, recipients resolved at send time, retried and logged.
- Marketing only goes to users who opted in; staff cannot opt anyone in or import addresses. Every marketing email has a visible unsubscribe link and one-click headers.
- Emails use the shared layout with the Get-On logo as a PNG, plain English, no emojis, no hype.

## 7. Bootstrapping the first super admin

The app has **no** code path that creates a super admin except staff management by an existing super admin. The first one is created with the CLI:

```
pnpm admin:bootstrap -- --email you@example.com
```

The script: uses `DATABASE_URL` (or the service role from the environment), never ships in the app; checks the user exists with a confirmed email; calls `bootstrap_super_admin`; prints the next steps (sign in, set up the authenticator app). It fails clearly when a super admin already exists.

Manual SQL equivalent for the very first time (bypasses the app; only use before any super admin exists):

```sql
select public.bootstrap_super_admin('you@example.com');
```

Both paths write a `staff_audit_log` row (action `bootstrap`).

## 8. Retrofit summary

The retrofit table in §0.1 is the definition of done for existing screens. In addition:

- Every email send site moves to the outbox and catalogue with the new templates and senders.
- Every existing template is rebuilt in the new layout and copy rules.
- Signup, Google onboarding and Account pages gain consent and preferences.
- `team_activity` gains `staff_viewed`.
- `docs/ses-setup.md` is updated for the new sender identities, configuration sets and Supabase Auth SMTP.
- Plans gain `support_response_hours` used by cases.
- `.env.example` gains `ADMIN_HOST`, `ADMIN_IP_ALLOWLIST`, `EMAIL_TRACKING_BASE`, `MARKETING_TOKEN_SECRET`, `ADMIN_BOOTSTRAP` notes and loses `ADMIN_EMAILS`.
