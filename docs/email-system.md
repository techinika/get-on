# Email system

How Get-On sends platform email: the streams, the outbox, consent, delivery
events and the jobs that keep them moving. Read it with
`docs/marketing-email.md`, `docs/admin.md` and `docs/ses-setup.md`.

## 1. What the system guarantees

- Every platform email belongs to exactly one stream: **transactional**,
  **billing** or **marketing**. The stream decides the From address, display
  name, Reply-To and SES configuration set. A caller cannot choose a sender.
- Service email is always sent. Marketing email is sent only when the person
  opted in, has not unsubscribed and is not suppressed.
- Business changes and their email are meant to be committed together through
  `notification_outbox`. The outbox survives a mail outage and retries later.
- A retry never duplicates an event: `dedupe_key` is unique.
- A pause or opt-out always wins, even for mail queued before it.
- Bounces and complaints block the address until an operator removes it.
- The console shows delivery metadata only. It never shows message bodies or
  full customer addresses.

## 2. Streams and senders

The source of truth is `packages/email/src/streams.ts`.

| Stream | From | Display name | Reply-To | Configuration set |
|---|---|---|---|---|
| `transactional` | `no-reply@contact.get-on.tech` | Get-On | `team@get-on.tech` | `gs-transactional` |
| `billing` | `billing@contact.get-on.tech` | Get-On Billing | `billing@contact.get-on.tech` | `gs-billing` |
| `marketing` | `no-reply@contact.get-on.tech` | Get-On | `team@get-on.tech` | `gs-marketing` |

`streamForKind()` is the fallback for unknown kinds: `billing_`, `invoice_`,
`payment_`, `refund_` and `coupon_` go to billing; `marketing_`, `campaign_`
and `newsletter_` go to marketing; everything else is transactional.

Each configuration set can be overridden with
`SES_CONFIGURATION_SET_TRANSACTIONAL`, `SES_CONFIGURATION_SET_BILLING` and
`SES_CONFIGURATION_SET_MARKETING`. The fixed names are the defaults.

The SES sender rejects a caller-supplied `from` that does not match the stream
(`EMAIL_SENDER_NOT_ALLOWED`). `safeHeader()` strips CR/LF and control characters
before anything becomes a header. Subjects are capped at 180 characters and
recipients at 254.

## 3. Catalogue and content

`packages/email/src/catalogue.ts` is the list of every kind. A kind decides the
stream, the category and whether marketing consent is required. Kinds not in
the catalogue fall back to the prefix rule, so a typo still goes to a safe
stream but should be fixed rather than relied on.

Categories are `auth`, `account`, `team`, `website`, `domain`, `billing`, `ai`,
`contact`, `referral`, `demo`, `abuse`, `staff` and `marketing`.

Content comes from `packages/email/src/templates.ts` and
`packages/email/src/layout.ts`:

- 600 px table layout, cream page, white card, green button.
- Logo from `EMAIL_LOGO_URL` (and `EMAIL_LOGO_2X_URL` for retina). The files are
  served as PNGs from `apps/web/public/brand/`.
- Plain text is always generated beside the HTML.
- Copy rules live in `packages/email/src/copy.ts`: no emojis, no hype words,
  short sentences, a readable subject and a preheader when one is supported.
- Marketing content is a small block format (`heading`, `text`, `button`,
  `divider`) rendered by `marketingCampaignEmail()`. Links are limited to
  http(s), text is escaped, and the unsubscribe link and physical address are
  required.

## 4. Outbox lifecycle

Schema: `supabase/migrations/20261103000600_email_outbox.sql` and the job
helpers in `20261104000100_admin_jobs.sql`.

1. Business code calls `email_enqueue(...)` with a stable `dedupe_key`, a kind,
   a stream, a recipient (`user_id` or `to_email`), an optional team and related
   record, a JSON payload and an optional schedule/expiry.
2. `email_claim(limit)` locks due rows with `FOR UPDATE SKIP LOCKED`, sets them
   to `sending` and increments attempts. It refuses to claim marketing rows
   while marketing is paused.
3. `processNotificationOutbox()` in `apps/web/lib/email/outbox.ts` resolves the
   address (preferring `to_email`, otherwise `auth.users.email`), re-checks
   marketing consent and suppression, builds the message and sends it.
4. Success calls `email_mark_sent`. A permanent failure calls
   `email_mark_failed` with no retry time. A transient failure uses
   `nextAttempt()` (1, 5, 30 and 60 minutes, at most 5 attempts).
5. A suppressed address calls `email_mark_suppressed`. An expired row is failed
   with `EXPIRED`. A paused marketing row is deferred for 30 minutes without
   losing its place.
6. Every attempt writes `email_log` with the kind, stream, masked screen view,
   attempt count, SES message id and a short error.

Statuses are `queued`, `sending`, `sent`, `failed`, `suppressed` and
`cancelled`. The partial index on `(status, scheduled_for)` keeps the claim
query small.

Recipients are resolved at send time, not at enqueue time. This matters when a
user changes their email address after the event.

## 5. Consent and preferences

Schema: `supabase/migrations/20261103000500_email_consent.sql`.

- `email_preferences` has one row per user and is created for existing users by
  the migration. New users get a row from the app/bootstrap path.
- `marketing_opt_in` defaults to false. `marketing_opt_in_at`, `source` and a
  salted IP hash record how consent was given.
- `frequency_cap_per_30d` defaults to 8 and `min_hours_between` to 48. They can
  be lowered or raised within the check constraints; the marketing queue uses
  them.
- `unsubscribe_token` is a random 24-byte hex value. It is not a session token
  and is safe to put in a link. It can be rotated with
  `email_preference_reset_token()`.
- `consent_records` is append-only. The trigger blocks update and delete. Every
  opt-in, opt-out and unsubscribe writes a row with the source.
- `email_preference_set()` writes both the preference and the consent record.
  `email_unsubscribe(token)` turns marketing off and records
  `source = 'unsubscribe_link'`.
- `marketing_can_send(user_id)` is the final check: opted in, confirmed email
  and not suppressed.

The public unsubscribe page is `/email/unsubscribe?token=…`. It checks the
token shape, shows a button and calls `email_unsubscribe()` only on the POST
server action. A GET never changes anything, so a mail scanner cannot opt a
person out. The page is `noindex`, uses `no-referrer`, and drops the token from
the URL after success. Invalid or missing tokens show a plain explanation.

Account settings has a "Product news and tips" switch for signed-in users. It
calls `email_preference_set()` with source `account` and records the salted IP
hash only when the switch is turned on.

## 6. Delivery events and suppression

`apps/web/app/api/webhooks/ses/route.ts` receives SNS notifications.

- The envelope signature and certificate URL are checked in
  `apps/web/lib/email/sns.ts`; `SES_SNS_TOPIC_ARN` is checked when set.
- `SubscriptionConfirmation` is fetched only from an `https://*.amazonaws.com`
  URL.
- Delivery, bounce, complaint and reject events are stored in `email_events`,
  unique on `(ses_message_id, type)`.
- Permanent bounces and complaints write `email_suppressions` and mark the
  matching `email_log` row failed.
- The handler answers SNS quickly. A duplicate event is ignored.

Suppression is checked before every send and again before every retry. Removing
a suppression is an operator action and is audited by the console if done
through a staff screen.

## 7. The direct-send path

`apps/web/lib/email/send.ts` is the older single-call path. It still writes
`email_log`, checks suppression, applies an 8 second timeout, queues transient
failures in `email_log` and processes them with `processEmailQueue()`. It also
enforces `SES_DAILY_LIMIT`: at 90% of the limit, only critical kinds are sent
immediately.

Critical kinds include auth, invites, billing receipts and payment failures.
The direct path is kept only for code that has not moved to the outbox yet;
all business call sites now enqueue through `email_enqueue` and are sent by
`scripts/jobs/notifications.ts`.

## 8. Jobs and commands

| Command | What it does |
|---|---|
| `pnpm job:notifications` | Sends due outbox rows once (`processNotificationOutbox(50)`). |
| `pnpm job:campaigns-send` | Queues approved/scheduled campaigns that are due. |
| `pnpm job:campaign-stats` | Copies outbox results back to campaign recipients. |
| `pnpm job:consent-audit` | Disables opt-ins whose latest consent is a refusal. |
| `pnpm job:email-tracking-purge` | Deletes tracking links and opens older than 24 months. |
| `pnpm job:approvals-expire` | Expires pending and approved requests after 72 hours. |
| `pnpm job:sla-check` | Writes `sla_breached` case events. |
| `pnpm job:reports-refresh` | Refreshes the eight report snapshots. |
| `pnpm job:finance-snapshot` | Stores a month snapshot for finance. |
| `pnpm job:weekly-report` | Emails the weekly report to active super admins. |
| `pnpm job:staff-sessions-sweep` | Closes expired access windows and trims login events. |
| `pnpm job:all` | Runs the scheduled jobs in order. |

`pnpm job:email` still runs the legacy `email_log` queue.

## 9. Environment

| Variable | Purpose |
|---|---|
| `EMAIL_TRANSPORT` | `ses`, `console` or `memory`. Missing credentials fall back to console. |
| `AWS_REGION` | SES region. |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | SES API credentials. Server only. |
| `SES_CONFIGURATION_SET_TRANSACTIONAL` | Override the transactional set name. |
| `SES_CONFIGURATION_SET_BILLING` | Override the billing set name. |
| `SES_CONFIGURATION_SET_MARKETING` | Override the marketing set name. |
| `SES_SNS_TOPIC_ARN` | Reject SNS messages from another topic. |
| `SES_DAILY_LIMIT` | Daily send guard for the direct path. |
| `EMAIL_LOGO_URL` / `EMAIL_LOGO_2X_URL` | Public PNG logo URLs used in templates. |
| `APP_ORIGIN` | Base for links, unsubscribe and webhooks. |
| `EMAIL_TRACKING_BASE` | Base for tracked links when tracking is enabled. |
| `MARKETING_TOKEN_SECRET` | Signs marketing tracking/unsubscribe values where needed. |

## 10. Tests and local checks

- `apps/web/tests/email.test.ts` covers sender selection, header safety, copy
  rules, consent gating and the marketing block renderer.
- `pnpm --filter web test` runs the unit suite. `EMAIL_TRANSPORT=memory` keeps
  messages in `memorySender.messages`; development can inspect them through
  `/api/dev/outbox`.
- `EMAIL_TRANSPORT=console` logs the subject and recipient without sending.
- Live SES checks are in `docs/ses-setup.md`. Use the SES mailbox simulator for
  bounce and complaint events.

## 11. Current gaps

- Marketing links and opens are tracked only when `EMAIL_TRACKING_BASE` or
  `marketing_settings.tracking_base` is set. The endpoints do not store IP
  addresses. The marketing report view is still to be built.
- The console email screen shows the log and suppressions. Resending, removing
  a suppression and campaign controls are not on that screen yet.
- The production SES configuration sets, DKIM, MAIL FROM and SNS subscription
  still have to be created.
