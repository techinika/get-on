# Reports

Reports are pre-computed snapshots of platform metadata. The console reads the
snapshot, not the live business tables, so a page load stays fast and the same
number is shown to everyone. Read it with `docs/admin.md`,
`docs/ui-spec-admin.md` and `docs/support-cases.md`.

## 1. Rules

- Reports are metadata only. No page text, messages, files, AI payloads,
  settings JSON, tracked links or visitor statistics.
- Every report is stored with a period, a generated time and the data.
- A report is read through a staff permission, never through a service-role
  client in the browser.
- Money is stored in cents and keeps its currency. Reports do not convert
  currencies.
- A closed finance month is read-only. A correction is a note, not an edit.
- The weekly email is a summary, not a replacement for the console.

## 2. Tables

Schema: `supabase/migrations/20261103000800_reporting.sql`.

| Table | Purpose |
|---|---|
| `report_snapshots` | One row per kind and period. Unique on `(kind, period_start, period_end)`. |
| `finance_months` | Month status (`open` or `closed`), closer, close time, totals and notes. |
| `finance_snapshots` | A month's finance totals at a point in time. |
| `weekly_reports` | The weekly summary, with `emailed_at` for idempotent sending. |
| `system_health_snapshots` | Point-in-time health counts. |

Report kinds: `overview`, `growth`, `revenue`, `support`, `email`, `ai`,
`domains`, `health`.

## 3. Refresh

`pnpm job:reports-refresh` calls `report_refresh(null)` for all eight kinds.
`report_refresh('email')` refreshes one kind. The default window is the last 30
days, starting at the beginning of the day 29 days ago and ending at the current
hour.

The function is `SECURITY DEFINER`. Service role can always call it; a staff
member needs `reports.view`.

### overview

- users, teams, new teams in 30 days;
- websites and published websites (deleted excluded);
- live custom domains;
- open support cases;
- confirmed payments in 30 days.

### growth

A daily series for the last 30 days: signups, teams and websites.

### revenue

- confirmed payments by month and currency for the last 12 months;
- processed refunds in the same window;
- open debt from `open`, `payment_pending` and `expired` invoices.

### support

- open cases;
- open cases past due with no first response;
- open cases by priority;
- average first-response hours over 30 days;
- average CSAT.

### email

- outbox sent, failed and suppressed in 30 days;
- counts by stream;
- opted-in users;
- suppression count.

### ai

- requests and failures in 30 days;
- charged credits;
- requests by feature.

### domains

- domains by status;
- live hostnames;
- hostnames needing attention;
- hostnames with health failures.

### health

- failed outbox rows;
- rows stuck in `sending` for more than 15 minutes;
- pending and expired approvals;
- open SLA breaches;
- expired staff access windows still open;
- domains needing attention.

## 4. Finance

`finance_snapshot(month)`:

- defaults to the current month;
- stores confirmed payments, payments by currency, processed refunds, invoice
  counts and open debt;
- deletes an earlier snapshot for the same month and day, then inserts one;
- updates `finance_months.totals` when the month is still open.

`finance_months` is the month-close record. The close flow should:

1. require a reason of at least 10 characters;
2. check that payments are matched, no disputes are open and refunds are
   recorded;
3. set `status = 'closed'`, `closed_by`, `closed_at` and the final totals;
4. write a staff audit row.

A closed month is never edited. Corrections are notes on the month and a new
snapshot, with the original preserved.

The month-close screen is still to be built. The table and totals already exist.

## 5. Weekly report

`pnpm job:weekly-report`:

1. calls `weekly_report()` for the current week;
2. returns new teams, new websites, published changes, confirmed payments,
   support opened/closed, marketing sent and failed email;
3. inserts or updates `weekly_reports` for the week;
4. skips the email if `emailed_at` is already set;
5. sends one email to every active super admin;
6. sets `emailed_at` only if at least one send succeeded.

The email text is built in `apps/web/scripts/jobs/weekly-report.ts`. It is a
plain summary and contains no customer content.

## 6. Permissions

| Area | Permission |
|---|---|
| Report snapshots and weekly reports | `reports.view` |
| Finance months and finance snapshots | `finance.view` |
| Health snapshots | `reports.view` |
| Refresh | service role, or `reports.view` |

The console must mask emails and must never include customer content in a chart,
table export or email.

## 7. Console design

The reports area in `docs/ui-spec-admin.md` includes:

- an overview row with the period picker;
- growth, revenue and plan mix;
- support load, first-response time and CSAT;
- email health by stream and the suppression count;
- AI usage and credits;
- domain health;
- finance months, with close and correction actions;
- a health page for jobs and stuck work.

The screen reads `report_snapshots` and `finance_snapshots`. It does not run the
aggregation queries on page load.

## 8. Current gaps

- No reports screen exists in the admin console.
- No finance month-close screen or close RPC exists; the table and snapshot
  function are ready.
- `system_health_snapshots` has no writer yet. Health figures currently come
  from the `health` report kind.
- The weekly email uses the direct `sendEmail()` path; it should move to the
  outbox when the report email kind is wired.
- There is no CSV export. If one is added, it must contain metadata only and be
  audited.
