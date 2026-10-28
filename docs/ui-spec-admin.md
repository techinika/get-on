# Get-On UI Specification - Staff console

See `docs/admin.md` for the staff rules, privacy boundary, approvals matrix and audit model. See `docs/staff-permissions.md` for the generated permission list. This document defines the screens.

Terminology: **team roles** are Owner, Admin, Editor and Viewer (customers). **Platform staff** are Get-On employees with the roles **Super admin** and **Customer success**. Staff screens say "staff", never "admin user".

## 1. Rules that shape every screen

1. Staff see **metadata only**. No page text, blocks, pictures, files, messages, backups, exports, AI inputs or outputs, settings JSON, tracked links or visitor statistics.
2. Every view of a customer record starts with a **purpose** and opens a 60-minute access window. The first view per team per 24 hours writes one customer-visible `staff_viewed` row.
3. Every read and write is audited. The screen never hides that fact; a small line says "This view is recorded."
4. A Customer success member **requests** anything that changes money, access, credits, plans, a domain or a website. A Super admin decides. Direct action is only offered when the matrix allows it.
5. Staff never see full email addresses in lists. Lists use `MaskedEmail` (`j***@example.com`). The full address appears only in a Team 360 header, an invoice party block or an access-approved record.
6. No emojis. No hype words from `packages/email/src/copy.ts`. Sentences under 24 words. Plain English.
7. Every screen says what happens next and when it happens: "Applies right away", "Needs a second staff member", "Applies after approval".
8. Empty states say what the screen is for and what to do next. They never say "No data".
9. On a 403 the screen shows a short `PermissionNotice`. It never shows the record.
10. Admin responses are `Cache-Control: no-store`, `X-Robots-Tag: noindex`, and a strict CSP.

## 2. Access, session and MFA

- `/admin/**` requires an authenticated user in `platform_staff` with `status = active`.
- The user must reach **AAL2** with a TOTP factor. Without it, every route redirects to `/admin/setup-mfa?next={path}`.
- `/admin/setup-mfa` shows a QR code, the secret in text for manual entry, a 6-digit field and a "Turn on" button. After verification it shows 10 recovery codes with "Copy all" and "I saved them" (the codes are never shown again).
- Sessions end after **30 minutes idle** and **8 hours absolute**. Sensitive actions need re-authentication within **15 minutes**; the dialog asks for the 6-digit code and continues the action.
- If `ADMIN_HOST` is set, `/admin` only answers on that host. Other hosts get 404.
- If `ADMIN_IP_ALLOWLIST` is set, other addresses get 403 with "This network is not allowed to open the staff console."
- The console never renders a staff member's own recovery codes after enrolment.

## 3. Shell and navigation

The staff console uses its own `StaffShell` inside `apps/web/app/admin/(console)/layout.tsx`. It reuses the app tokens from `docs/ui-spec-app.md`.

### 3.1 Frame

- Top bar: 64 high (56 below 640), surface background, bottom border.
- Left: Get-On mark 32, wordmark "Get-On" and a neutral "Staff" pill.
- Middle: Quick find button styled like an input, "Search people, teams and websites" with `Ctrl K` chip.
- Right: environment pill (`Local`, `Staging`, `Live`) when `VERCEL_ENV` or `NODE_ENV` is not production; support inbox link; staff menu (name, role, "Account", "Sign out").
- Left sidebar at 1024 and above: 240 wide. Below 1024 it becomes a slide-over opened by a menu button. The console is desktop-first but must be usable at 360.
- Main: `max-width: 1200px`, padding 24 (16 below 640), page background `--app-bg`.
- No customer sidebar, no team switcher and no plan card.

### 3.2 Navigation

Groups, top to bottom. Items the role cannot use are hidden, not disabled. A tenant with no permission sees only the groups it can use.

| Group | Item | Route | Icon |
|---|---|---|---|
| Today | Dashboard | `/admin` | LayoutDashboard |
| Today | Support | `/admin/support` | LifeBuoy |
| Today | Approvals | `/admin/approvals` | ShieldCheck |
| Customers | Search | `/admin/search` | Search |
| Customers | Teams | `/admin/teams` | Users |
| Customers | Websites | `/admin/websites` | Globe |
| Customers | Domains | `/admin/domains` | Link |
| Money | Billing | `/admin/billing` | CreditCard |
| Money | Finance | `/admin/finance` | Landmark |
| Reach | Email | `/admin/email` | Mail |
| Reach | Marketing | `/admin/marketing` | Send |
| Reach | Demo requests | `/admin/demos` | CalendarCheck |
| Safety | Abuse reports | `/admin/abuse` | Flag |
| Platform | Reports | `/admin/reports` | BarChart3 |
| Platform | Operations | `/admin/operations` | Activity |
| Platform | AI | `/admin/ai` | Sparkles |
| Platform | Templates | `/admin/templates` | LayoutTemplate |
| Staff | Staff | `/admin/staff` | UserCog |
| Staff | Audit log | `/admin/audit` | ScrollText |
| Staff | Settings | `/admin/settings` | Settings |

- Active item: `--primary-soft` background, `--primary` text, 3 px left bar.
- Group labels: 12/700 uppercase, `--text-muted`, 0.08em.
- "Approvals" shows a count pill when there are pending requests the role can decide or see.
- "Support" shows a danger dot when a case has passed its due time.
- The footer of the sidebar shows "Signed in as {name}", role and a "Sign out" link.

### 3.3 Quick find

`/admin/search` is the full screen. The top-bar button opens a dialog with the same behaviour: 560 wide, search input, groups People, Teams, Websites, Cases, Invoices. Results are metadata only. Selecting a result asks for a purpose when it opens a customer record.

### 3.4 Page header

`AdminPageHeader` props: `breadcrumbs`, `title`, `description`, `meta`, `actions`.

- Title: Bricolage 700, 28/32 (26 on mobile).
- Description: 16/24 `--text-muted`, maximum 70ch.
- `meta`: a row of neutral pills: environment, plan, status, "Last updated 2 min ago".
- Actions: right aligned, wrap; primary action last. Below 640 they stack full width.
- A "This view is recorded" caption sits under the description for any screen that reads a customer record.

## 4. Shared components

- `AdminPage` (`width: 'wide' | 'default' | 'narrow'`): 1200 / 960 / 720.
- `AdminSection`: title row, optional description, optional right action, content. 32 between sections.
- `StatCard`: label, value, comparison or helper, optional icon. Values use Bricolage 700 24.
- `DataTable`: sticky header, 44 rows, sortable columns, right-aligned numbers, checkbox column only when a bulk action exists. Below 768 rows become stacked cards with a label/value grid.
- `StatusBadge`: states and tokens:
  - good: `--success-soft` / `--success-text`
  - warning: `--warning-soft` / `--warning-text`
  - danger: `--danger-soft` / `--danger-text`
  - neutral: `--surface-muted` / `--text-muted`
  - info: `--info-soft` / `--info-text`
- `MaskedEmail`: monospace 13, with a "Reveal" icon button only when the screen has an approved access window. Reveal writes an audit row and shows the address for 60 seconds.
- `AccessPurposeDialog`: title "Why are you opening this account?", select with the six purposes (`support_case`, `billing_question`, `payment_issue`, `abuse_report`, `customer_request`, `reporting`), optional case link, text "The customer will see that Get-On viewed their account details. We do not show your name." Required purpose; "Open account" primary.
- `ApprovalRequestDialog`: shows the action, target, amount or impact, a required reason (minimum 10 characters), a summary of what will change, and "Send for approval". It never executes.
- `DirectActionDialog`: for Super admin direct actions. Requires a reason and a fresh code when the action is sensitive. If dual control is needed, the primary button becomes "Request approval" instead of "Do it now".
- `ReasonDialog`: a single required textarea, 10-500 characters, a live counter and plain examples.
- `ConfirmDialog`: title, one sentence of consequence, destructive action in `--danger`.
- `PermissionNotice`: lock icon, "You do not have access to this", one sentence, "Back to dashboard".
- `EmptyState`: icon tile 56, title 18/600, one sentence, one action.
- `SensitiveValue`: masked by default, "Reveal" with a 60-second timer, audit row on reveal.
- `CopyButton`: 44x44, copy icon, toast "Copied.".
- `Timeline`: audit, case or approval events. Left line, dot, time 12 muted, actor, action and a details disclosure.
- `Money`: always shows currency and cents. Never a bare number.
- `RelativeTime`: "2 minutes ago" with a `title` of the exact time.

## 5. Routes

| Route | Screen | Who |
|---|---|---|
| `/admin` | Dashboard | all staff |
| `/admin/setup-mfa` | Authenticator setup | staff without AAL2 |
| `/admin/search` | Search | `account.search` |
| `/admin/teams` | Teams list | `account.search` |
| `/admin/teams/[teamId]` | Team 360 | `account.view` |
| `/admin/websites` | Websites list | `website.search` |
| `/admin/websites/[siteId]` | Website record | `website.view` |
| `/admin/domains` | Domains list | `domain.view` |
| `/admin/domains/[domainId]` | Domain record | `domain.view` |
| `/admin/billing` | Money overview | `billing.view` |
| `/admin/billing/invoices/[invoiceId]` | Invoice | `billing.invoice.view` |
| `/admin/approvals` | Approvals queue | `staff.view` or any approve permission |
| `/admin/approvals/[requestId]` | Approval detail | requester, approver or super admin |
| `/admin/support` | Support cases | `support.case.view` |
| `/admin/support/[caseId]` | Case | `support.case.view` |
| `/admin/abuse` | Abuse reports | `abuse.view` |
| `/admin/abuse/[reportId]` | Report | `abuse.view` |
| `/admin/email` | Email health | `email.view` |
| `/admin/email/log/[logId]` | Email delivery | `email.view` |
| `/admin/marketing` | Campaigns | `marketing.view` |
| `/admin/marketing/[campaignId]` | Campaign | `marketing.view` |
| `/admin/marketing/segments` | Segments | `marketing.segment.view` |
| `/admin/marketing/settings` | Marketing settings | `marketing.settings` |
| `/admin/demos` | Demo requests | `demo.view` |
| `/admin/reports` | Reports | `reports.view` |
| `/admin/finance` | Finance | `finance.view` |
| `/admin/operations` | Jobs and health | `platform.jobs.view` |
| `/admin/ai` | AI settings and usage | `ai.view` |
| `/admin/templates` | System templates | `template.system.manage` |
| `/admin/staff` | Staff team | `staff.view` |
| `/admin/audit` | Audit log | `staff.audit.view` |
| `/admin/settings` | Platform settings | `platform.settings` |

Every route has `loading.tsx` (skeleton with the final block sizes), `error.tsx` ("Something went wrong", "Try again", "Back to dashboard") and a permission check in the server component.

## 6. Screens

### 6.1 Dashboard (`/admin`)

- Header: title "Today", description "What needs a person right now.", meta with the date and the current staff role, action "Search" secondary.
- Row of 4 `StatCard`s: "Open cases" (with "N past due" danger text), "Pending approvals" (with "oldest 6 h"), "Failed emails 24 h", "Marketing" (Running / Paused / Off).
- "Needs attention" card: a single list ordered by urgency. Rows: support cases past due, approvals older than 24 h, websites under review, abuse reports waiting, email failures. Each row has an icon, title, one-line reason, relative time and "Open".
- "Today" numbers: new teams, new websites, payments, emails sent, cases closed. 2 columns on mobile, 5 on desktop.
- "Recent staff activity": last 8 audit rows for the role (who, action, target type, time). No customer content.
- If the role has no `reports.view`, the numbers card is replaced by "Your work" (my open cases, my requests).
- Empty: "Nothing needs a person right now." with a check icon.

### 6.2 Search (`/admin/search`)

- A large search input at the top, autofocus, placeholder "Search by name, email, team or web address".
- Tabs: All, People, Teams, Websites, Cases, Invoices.
- Results are a table with masked emails. No content previews.
- Selecting a person or team opens Team 360 and starts the purpose dialog. Selecting a website opens the website record with the purpose dialog. Invoices open directly when the role has `billing.invoice.view`.
- No results: "Nothing matched "{query}"." plus "Try an email address, a team name or a web address."
- Every query is audited with the query text, but never the results.

### 6.3 Teams list (`/admin/teams`)

- Header: "Teams", description "Every customer team. Metadata only."
- Filters: plan, status (active, grace, lapsed, paused), has a past-due case, created date. Search by team name or masked email.
- Table columns: Team, Owner (masked), Plan, Members, Websites, Billing status, Open cases, Created. Row click opens Team 360.
- Bulk export is offered only with `account.export`. The export file contains the visible columns, no emails.
- Empty: "No teams match those filters." with "Clear filters".

### 6.4 Team 360 (`/admin/teams/[teamId]`)

This is the main customer record. Opening it requires a purpose.

- Header: team name, owner masked email, plan badge and billing status. Actions depend on role:
  - Customer success: "Request free access", "Request refund", "Message customer", "Open case".
  - Super admin: "Free access", "Refund", "Billing hold", "Rebuild entitlements".
  - Every money action opens `ApprovalRequestDialog` first. Direct actions open `DirectActionDialog`.
- Tabs: Overview, People, Websites, Billing, AI, Cases, Activity, Notes.
- **Overview:** stat cards (members, websites, storage, AI credits left, open cases, lifetime paid), plan and paid-through, risk notes ("Past due", "No owner sign-in for 30 days"), and the latest 5 activity rows.
- **People:** member list with name, masked email, team role, status, last seen. Actions: "Clear sign-in lockout" and "Sign out everywhere" (both direct, audited). No password or session tokens.
- **Websites:** metadata rows (name, web address, status, published, review state). No preview, no rebuild, no restore. "Open website" opens the public address in a new tab only when it is live.
- **Billing:** plan, terms, invoices (masked), payments, debt, grace end, coupon. Actions: resend invoice/receipt, check payment (direct); void invoice, refund, manual payment, credit adjustment, extend grace, billing hold (request or direct per matrix).
- **AI:** monthly credits, used, daily actions, last request metadata (kind, status, model id hidden behind "Model" disclosure? No: show "AI request" and status only), member caps. Actions: add credits, change a member cap (request/direct).
- **Cases:** cases for this team, open first.
- **Activity:** team-visible activity, including `staff_viewed` rows. Staff see the same rows the customer sees, not the staff audit log.
- **Notes:** internal notes with author and time. Notes are staff-only and never visible to customers. "Add note" opens a 6-row textarea.
- Right rail (desktop): "Access window" card with the remaining minutes, purpose, case link and "Close access". Below it "Account facts" (created, owner since, plan source) and "Quick actions".
- The header shows "This view is recorded. The customer will see that Get-On viewed their account details." once.

### 6.5 Websites list and record

**List (`/admin/websites`)**
- Columns: Website, Team, Address, Status, Published, Review, Abuse, Updated.
- Filters: status, review state, has abuse report, plan.
- No open, preview, rebuild, restore or delete actions.
- Row opens the record. "Open public site" appears only for live sites and opens a new tab.

**Record (`/admin/websites/[siteId]`)**
- Header: website name, team link, public address, status and review badge.
- Tabs: Overview, Moderation, Domains, Activity.
- **Overview:** metadata only: created, first published, last published, page count, publish status, storage used, plan. No page list, no text, no pictures, no settings.
- **Moderation:** review state, abuse reports, screening rule ids that fired, up to five 80-character excerpts of **published** text (not draft), and reporter text. A Super admin can "Approve", "Reject" or "Take down"; Customer success can "Request takedown" and "Request review decision". All require a reason; takedown also requires a category.
- **Domains:** addresses, verification state, HTTPS state, plan pause. Actions: "Re-check now" (direct), "Request review" / "Request plan pause" / "Request removal".
- **Activity:** moderation events and team-visible changes. Never page edits or drafts.
- The record never renders a draft preview, iframe or content link.

### 6.6 Domains

**List:** Address, Team, Website, Type (main/alias/free), Verification, HTTPS, Last checked. Filters: verification, HTTPS, paused. Row opens the record.
**Record:** header with the address and status. Panels: DNS proof (TXT name and value, copy buttons), CNAME target, provider hostname state, certificate state, last checks, events. Actions: "Re-check now" (direct), "Request review", "Request plan lapse pause", "Request removal". The console never edits DNS and never reassigns a hostname.

### 6.7 Money (`/admin/billing`)

- Header: "Billing", description "Invoices, payments and money in. No card data.", actions "Export" (super admin) and "Settings" (super admin).
- Stat cards: paid this month, outstanding, debt, refunds this month, failed payments.
- Tabs or sections: Invoices, Payments, Debt, Coupons, Access grants, Review items, Settings.
- **Invoices table:** number, team, amount, status, due, paid. Amount and status; party is masked. Row opens the invoice.
- **Invoice:** header with number, status and total. Party block with the legal name and a masked email; "Reveal tax id" only with `billing.tax_id.view_full`, audited. Lines, payments and timeline. Actions: "Resend invoice", "Check payment status" (direct); "Void invoice", "Refund", "Record manual payment", "Adjust credit" (request/direct). "Open PDF" only with `billing.invoice.pdf`; opening writes an audit row.
- **Debt:** team, amount, months, oldest debt, access state. No automatic charge.
- **Coupons:** code, percent/amount, uses, expiry, status. Create is super admin only.
- **Access grants:** team, plan, start, end, reason, by. Creating a grant goes through approvals.
- **Review items:** queue for payment issues, each with a team, amount and one-line reason.
- **Settings:** prices, terms, grace days, reminder days, provider state. Every change shows "Applies to new invoices" or "Applies right away" and writes an audit row.
- All money actions show the amount in USD and require a reason. Above the dual-control threshold the dialog says "A second Super admin must approve this."

### 6.8 Approvals (`/admin/approvals`)

- Header: "Approvals", description "Changes that need a second person.", action "New request" only when the role can request.
- Tabs: Waiting for me, My requests, All open, Closed.
- **Queue table:** action, target, amount or impact, requester, age, expires in. Age over 24 h gets a warning badge; over 72 h is Expired.
- **Detail:** a plain summary ("Refund $240.00 to Team Acme for invoice INV-1042."), the reason, the payload in human labels (never raw JSON), the state hash check result, policy threshold, requester, approver, timeline.
- Buttons: "Approve", "Reject", "Request changes" and "Cancel request" (requester only). The approver cannot approve their own request; the button is disabled with "You requested this. Another Super admin must decide."
- Dual control: the first approval changes the state to "Waiting for a second Super admin"; the second approval executes or marks ready to execute. A threshold breach is explained in one sentence.
- After execution the detail shows "Done" or "Could not finish" with a plain reason and a "Try again" action. Stale state shows "The account changed since this was requested. Ask for a new approval."
- Empty: "Nothing is waiting for you." / "You have not requested anything." / "No open approvals."

### 6.9 Support cases (`/admin/support`, `/admin/support/[caseId]`)

- **List:** tabs Open, Mine, Waiting on customer, Resolved, All. Columns: number, subject, team, plan, priority, status, due, assignee. Overdue rows show a danger left border and "Overdue by 3 h".
- SLA follows plan: Free 96 h, Basic 48 h, Pro 24 h, Enterprise 4 h.
- **Case:** header with number, subject, team, plan, SLA due and status. Actions: Assign to me, Change priority, Close, Reopen, Escalate.
- Layout: conversation and internal notes in the main column; right rail with customer facts (plan, billing status, websites count, recent cases), access window and linked approval.
- Composer has two tabs: "Reply to customer" and "Internal note". Internal notes are amber-tinted and never emailed. Reply sends an email through the outbox; the subject is "Re: [CASE-123] {subject}".
- Closing requires a reason and a resolution category. A closed case can be reopened within 14 days.
- Empty: "No cases match these filters."

### 6.10 Abuse reports (`/admin/abuse`)

- List: report, website, category, reporter (masked), age, status. Filters: open, deciding, closed.
- Detail: reporter text, published address, screening rule ids and published excerpts only. Actions: "Decide" (super admin) with outcomes Keep, Restrict, Take down; Customer success can "Recommend" with a note.
- Moderation decisions email the owner. The screen shows the exact email that will be sent before confirming.
- Empty: "No abuse reports are waiting."

### 6.11 Email (`/admin/email`)

- Header: "Email", description "Delivery health for every stream.", actions "Send test" (super admin) and "Suppression list".
- Stat cards per stream: Transactional, Billing, Marketing, System. Each shows sent 24 h, failed 24 h, complaints and bounces in basis points. A stream over the warn threshold gets a warning badge; over the pause threshold gets a danger badge and "Paused".
- **Log table:** time, kind, stream, recipient (masked), status, attempts, error. Row opens the delivery.
- **Delivery:** kind, stream, masked recipient, subject, status, attempts, SES message id, timeline, and the exact error. Actions: "Resend" (direct, audited), "Suppress address" (super admin), "Open related record".
- **Suppression list:** email (masked), reason, source, created. Add/remove requires `email.suppression.manage` and a reason.
- **Settings:** complaint/bounce warn and pause thresholds, marketing warm-up, daily cap override. Every change says "Applies right away."
- Marketing sends are never shown with an unsubscribe token or full address.

### 6.12 Marketing (`/admin/marketing`)

- Header: "Marketing", description "Opted-in customers only.", actions "New campaign" and "Settings" (super admin).
- Stat cards: opted-in people, sent 30 d, open rate, complaint rate, warm-up day and today's cap.
- Tabs: Campaigns, Segments, Settings.
- **Campaigns table:** name, subject, segment, status, recipients, scheduled, sent. Statuses: Draft, Needs approval, Approved, Scheduled, Sending, Sent, Paused, Cancelled.
- **Campaign editor:** name, subject (max 60), preheader (40-110), template key, content blocks (plain editor, no raw HTML), segment picker with a count and "Preview as email". Copy lint runs live with plain messages: "This subject is too long.", "Remove the word "leverage".", "This sentence is too long."
- Actions: "Save draft", "Send for approval", "Approve" (super admin, not the author), "Send now", "Pause". Sending requires approval and shows the daily cap and warm-up stage in the confirm dialog. A paused campaign shows the guard that paused it.
- **Segments:** name, description, definition (all opted in, plan, team, specific people), live count, last updated. No email addresses in the list; the count only.
- **Settings:** sending domain, reply-to, physical address, unsubscribe base, frequency cap, minimum hours, warm-up start, daily override, paused switch and reason. Every change says "Applies right away."
- Empty campaigns: "No campaigns yet." with "Create a campaign".

### 6.13 Demo requests (`/admin/demos`)

- List: business, contact (masked), interest, source, age, status. Filters: new, contacted, closed.
- Detail: submitted fields, consent line, Turnstile result and the acknowledgement email status. Actions: "Mark contacted", "Add note", "Close" (direct, audited). No bulk export of raw addresses.
- Empty: "No demo requests are waiting."

### 6.14 Reports (`/admin/reports`)

- Header: "Reports", actions "Export" (super admin) and "Refresh now" (super admin).
- Tabs: Growth, Revenue, Support, Reliability, Email.
- Every report shows the period, the generated time and a small "Snapshot" badge. Numbers are links to the filtered list when the role has that permission.
- Charts: one line or bar per panel, tokens only, no gradients. Tables under the chart for exact values.
- **Growth:** signups, teams, websites, first publishes, by week.
- **Revenue:** collected, outstanding, refunds, debt, by month. Always USD.
- **Support:** cases opened/closed, first response, SLA met, by plan.
- **Reliability:** publish success, job failures, domain problems.
- **Email:** sent, delivered, bounced, complained, by stream.
- **Weekly report:** the latest email preview with "Send now" (super admin) and "Resend last".
- Empty: "No snapshot for this period yet." with "Refresh now" for super admins.

### 6.15 Finance (`/admin/finance`)

- Header: "Finance", description "Month close and reconciliation.", actions "Close month" (super admin) and "Export".
- Month picker, then stat cards: collected, refunded, net, outstanding, debt, MRR equivalent.
- Reconciliation table: provider reference, invoice, team, amount, status, matched. Unmatched rows have "Review" and a one-line explanation. Staff never see card data.
- "Close month" shows a checklist (all payments matched, no open disputes, refunds recorded), requires a reason and writes an audit row. A closed month is read-only; a correction creates a note, not an edit.
- Empty: "No payments in this month."

### 6.16 Operations (`/admin/operations`)

- Header: "Operations", description "Jobs, queues and platform health."
- Stat cards: failing jobs, queued emails, stalled domains, publish errors, last backup.
- Job table: name, last run, duration, status, error. Actions: "Run now" and "Retry" only with `platform.jobs.retry`, both audited. Running a heavy job asks for confirmation because it can affect many websites.
- Queue panel: outbox counts by status and stream, oldest queued, next retry.
- Domain provider panel: pending hostnames, verification backlog, certificate warnings. No "retry customer operation" buttons.
- Incident banner: when `platform.incident.manage`, a banner editor with message, severity, start/end and "Show on dashboard". Else read-only.
- Empty: "All jobs are healthy."

### 6.17 AI (`/admin/ai`)

- Header: "AI", description "Models, credits and usage. No prompts or outputs."
- Tabs: Overview, Models, Credits, Limits, Settings.
- **Overview:** requests 30 d, credits used, blocked, top kinds (labels only), error codes.
- **Models:** model id, task kind, status, JSON support, last changed. Only super admin with `ai.settings` can change status.
- **Credits:** team, plan, monthly allowance, used, remaining, last top-up. Actions: "Add credits" (request; direct for super admin), amount in credits and a reason.
- **Limits:** per-member daily caps. Change is a request; super admin can approve.
- **Settings:** provider state, fake vs live, default model per task, guard rails. No API tokens are shown; a token field is write-only.
- No screen shows a prompt, completion, schema, neuron count or raw JSON. Use "request", "result", "credits" and "use".

### 6.18 Templates (`/admin/templates`)

- List: system template name, version, status, updated, used by count. Only platform-owned templates.
- Detail: name, description, preview image, version history, "Apply to new websites" toggle, "Publish version" action. Publishing requires a reason and is audited.
- No customer templates and no customer content.

### 6.19 Staff (`/admin/staff`)

- List: name, masked email, role, status, MFA on, last sign-in, added by. Super admin only for changes.
- Actions: "Add staff" (email must already have a confirmed account), "Change role", "Suspend", "Reactivate", "Reset authenticator", "Remove".
- Reset authenticator and remove require a reason and a confirm dialog; both email the staff member. Removing the last super admin is blocked with "Add another Super admin first."
- Detail: permissions matrix read-only, recent staff audit rows, session count. No recovery codes.

### 6.20 Audit log (`/admin/audit`)

- Filters: staff member, action, target type, date range, approval id.
- Table: time, staff, role, action, target type, target id (short), purpose, reason, approval. Row opens a details drawer with the full row.
- The log is append-only. There is no edit or delete.
- Full staff names are visible to staff only. Customer names are metadata labels, never content.
- Empty: "No audit rows match those filters."

### 6.21 Settings (`/admin/settings`)

- Sections: Platform, Email, Security, Features, Legal, Danger zone.
- **Platform:** product name, support email, public site URL, default plan. Each row shows "Applies right away".
- **Email:** stream senders (read-only, fixed in code), reply-to, `EMAIL_TRACKING_BASE`, logo URLs, test send. Changes say "Applies to new emails".
- **Security:** `ADMIN_HOST`, `ADMIN_IP_ALLOWLIST` (read-only from env with a note), session limits (read-only), MFA policy (read-only).
- **Features:** kill switches for AI, marketing, new signups, publishing, with a reason and confirmation. Marketing and publishing switches show a danger banner.
- **Legal:** review pending badge, placeholder count, link to the legal docs. No editing of legal text here.
- **Danger zone:** "Rebuild all KV pointers", "Re-run migrations report", "Expire all staff sessions". Each needs a reason, a typed confirmation and is audited.
- Empty never applies; the screen always renders the current values.

### 6.22 Authenticator setup (`/admin/setup-mfa`)

- Centered card 480. Title "Set up your authenticator", text "We ask for a 6-digit code each time you open the staff console."
- Steps: 1) scan the QR with an authenticator app, 2) enter the 6-digit code, 3) save recovery codes.
- The secret is shown in a copyable block for manual entry. The code input is 6 digits, `inputmode="numeric"`, autocomplete one-time-code.
- Errors: "That code did not work. Check the time on your phone and try again."
- Recovery codes: 10 codes in a two-column grid, "Copy all", "Download" and "I saved them". A warning says "These codes work once. Store them somewhere safe."
- After success, redirect to `next` or `/admin`.

## 7. Dialogs and feedback

- Mutations show a toast: success "Saved.", failure the plain reason from the server. Never a stack trace.
- Destructive dialogs name the target and the consequence. "Take down acme.com" is better than "Confirm".
- Request dialogs never look like they executed. The success toast says "Sent for approval."
- A direct action success toast says what happened: "Refund recorded." / "Website taken down." / "Case closed."
- Every dialog traps focus, closes on Escape, returns focus to the trigger and is usable at 360.
- No modal stacks more than two deep.

## 8. Loading, empty, error and stale states

- Skeleton: header bars, 4 stat cards, 8 table rows. Shimmer 1.2 s. Show after 150 ms.
- Empty: one sentence and one action. Examples: "No open approvals.", "No failed emails in the last 24 hours."
- Error: `InfoBox` danger, "We could not load this page.", the request id in small text, "Try again" and "Back to dashboard".
- Not found: "We could not find that record." Never reveal whether it exists in another team.
- Stale approval: warning `InfoBox`, "The account changed after this request. The approval is no longer safe to run.", "Request again" and "Close".
- Stale data after a mutation: optimistic row update, then revalidate by tag. On failure, roll back and keep the dialog open with the reason.

## 9. Accessibility and privacy

- Every table has a caption, column headers and a keyboard focus order.
- Icon-only buttons have `aria-label`; all interactive targets are at least 44x44.
- Colour is never the only signal; a text label or icon accompanies every badge.
- The purpose dialog is the first focusable element when a record opens.
- No customer content is ever placed in `title`, `aria-label`, a URL, a log or a toast.
- The full email reveal timer is visible: "Hidden in 60 seconds."
- Staff cannot screenshot-proof the console, but every reveal is audited and the screen says so.

## 10. Copy rules for the console

- Say "staff", "team", "customer", "website", "web address", "invoice" and "payment".
- Never say "admin user", "payload", "schema", "token", "neuron", "prompt", "LLM" or "JSON".
- Buttons are verbs: "Send for approval", "Take down", "Resend invoice", "Close case".
- Errors are one sentence and say what to do next.
- Times are relative with an exact `title`. Money always includes the currency.
- No emojis. No exclamation marks. No hype words.
