# Marketing email

Marketing email is opt-in, staff-controlled and deliberately separate from
service email. Read it with `docs/email-system.md`, `docs/admin.md` and
`docs/ui-spec-admin.md`.

## 1. Rules

- Marketing is opt-in only. Staff cannot opt anyone in, and there is no address
  import.
- Every message has a visible unsubscribe link, a plain reason line and the
  company's physical address once `marketing_settings.physical_address` is set.
- A pause, opt-out or suppression always wins. The outbox re-checks all three
  at send time, and `email_claim()` refuses to claim marketing rows while either
  marketing switch is paused.
- Marketing uses its own SES stream and configuration set (`gs-marketing`) so
  complaints do not damage transactional or billing reputation.
- No customer content is used to build an audience. Segments are based on
  account metadata and recorded consent only.
- Every campaign needs a super-admin approval before it can be queued. The
  queue function itself accepts only `approved`, `scheduled` or `sending`
  campaigns.
- No emojis, no hype words, short sentences. The copy rules are the same as
  `packages/email/src/copy.ts`.

## 2. Data model

Schema: `supabase/migrations/20261103000700_marketing.sql`.

| Table | Purpose |
|---|---|
| `marketing_settings` | One row. Sending domain, reply-to, physical address, unsubscribe and tracking bases, warm-up start, caps, pause state. |
| `marketing_segments` | Named audience with a JSON definition. |
| `marketing_campaigns` | Draft/scheduled/sent campaign, subject, preheader, content blocks, segment, approval and counts. |
| `marketing_campaign_recipients` | One row per recipient with the outbox id and delivery status. |
| `email_preferences` | Per-user opt-in, frequency cap, minimum gap and unsubscribe token. |
| `consent_records` | Append-only history of every opt-in and opt-out. |
| `notification_outbox` | The per-recipient queue. Marketing rows have `stream = 'marketing'`. |

Campaign statuses: `draft`, `pending_approval`, `approved`, `scheduled`,
`sending`, `sent`, `paused`, `cancelled`.

Recipient statuses: `queued`, `sent`, `failed`, `skipped`, `suppressed`.

## 3. Audience and segments

`marketing_segment_users(definition)` always starts from users who:

- have `email_preferences.marketing_opt_in = true`;
- have a confirmed email;
- have an email address.

The definition narrows that base:

| Type | Meaning |
|---|---|
| `all_opted_in` | Every opted-in user. |
| `plan` | Users in a team whose current `plan_id` is in `planIds`. |
| `team` | Users in one of `teamIds`. |
| `users` | An explicit `userIds` list. |

An unknown type returns nobody. Service role only. There is no "all users"
escape hatch.

## 4. Campaign lifecycle

1. Staff create a draft. Subject is 1–60 characters; preheader is 40–110
   characters when used.
2. The draft goes to `pending_approval`. A super admin approves it through the
   approval flow; a second super admin is required when the policy requires it.
3. A scheduled campaign becomes due. `pnpm job:campaigns-send` calls
   `marketing_campaign_queue(campaign_id)`.
4. The queue function checks the campaign status, the pause switches, the
   daily warm-up cap and the per-person limits.
5. Each eligible person gets one `notification_outbox` row with
   `dedupe_key = 'campaign:{campaignId}:{userId}'`, a 14-day expiry and the
   campaign content in the payload. Ineligible people get a `skipped` recipient
   row.
6. `pnpm job:notifications` sends the rows. `pnpm job:campaign-stats` copies the
   outbox result back to `marketing_campaign_recipients` and marks the campaign
   `sent` when nothing is left queued.

If the daily cap is hit, the campaign stays `sending` and the next run queues
more. If marketing is paused or the cap is reached, the job leaves the campaign
for later rather than losing recipients.

## 5. Limits

### Daily warm-up

`marketing_daily_cap()` returns:

| Age since `warmup_started_at` | Cap |
|---|---|
| Not set, or under 1 day | 500 |
| 1–2 days | 1,000 |
| 2–3 days | 2,000 |
| 3–4 days | 5,000 |
| 4–5 days | 10,000 |
| 5 days or more | Unlimited |

`daily_cap_override` replaces the whole curve. The cap counts marketing outbox
rows created since the start of the current UTC day.

### Per person

- `frequency_cap_per_30d` defaults to 8.
- `min_hours_between` defaults to 48.
- A person who has reached either limit is recorded as `skipped` for that
  campaign.
- `email_preferences` can lower or raise both values within the database
  checks.

### Reputation guards

`email_settings` stores complaint and bounce thresholds:

| Guard | Warn | Pause |
|---|---|---|
| Complaint rate | 10 bps (0.1%) | 30 bps (0.3%) |
| Bounce rate | 300 bps (3%) | 500 bps (5%) |

The fields are in place. The automatic calculation and pause action are not
implemented yet; operational pause is currently manual.

## 6. Content

Campaign content is a small block format, not raw HTML:

```json
{
  "heading": "A clearer website for your business",
  "intro": "One short paragraph.",
  "blocks": [
    { "type": "text", "text": "A sentence." },
    { "type": "button", "label": "Open Get-On", "url": "https://get-on.tech" },
    { "type": "bullet", "text": "One point." },
    { "type": "divider" }
  ],
  "footer": "Optional closing line."
}
```

`marketingCampaignEmail()` escapes every value, allows only `http(s)` links,
caps the block count and adds the unsubscribe link and physical address. It
renders both HTML and plain text through the shared layout.

Before launch:

- Set `marketing_settings.physical_address`.
- Set `marketing_settings.unsubscribe_base` to the production unsubscribe URL.
- Confirm `reply_to` is `team@get-on.tech`.
- Confirm the `gs-marketing` configuration set and its SNS events exist.

## 7. Consent and unsubscribe

Opt-in writes `email_preferences` and an append-only `consent_records` row.
Opt-out does the same with `granted = false`.

`email_unsubscribe(token)`:

- looks up the token in `email_preferences`;
- turns `marketing_opt_in` off;
- writes `consent_records` with `source = 'unsubscribe_link'`;
- returns false for an unknown token.

`email_preference_reset_token()` rotates the link for a signed-in user.

`pnpm job:consent-audit` finds preferences that say opted in while the newest
consent record says refused, and turns them off with
`marketing_source = 'consent_audit'`.

The public page is `/email/unsubscribe?token=…`. The `?token=` value is the
only input; the page does nothing on GET and opts out on the POST button. This
keeps link scanners from unsubscribing people. After success the token is
removed from the address bar.

Signed-in customers can turn marketing on or off in Account → Email
preferences. That switch uses `email_preference_set()` with source `account`.
Opting in again still respects the suppression list; a hard bounce or complaint
keeps the address blocked.

## 8. Tracking

Tracking is optional. It turns on when `marketing_settings.tracking_base` (or
`EMAIL_TRACKING_BASE`) has an http(s) origin. The base is an origin such as
`https://get-on.tech`; the routes add their own path.

When it is on, the outbox:

- rewrites each unique http(s) link to
  `/email/click/{token}` and stores the original URL in
  `email_tracking_links`;
- leaves the unsubscribe link, `mailto:` links and relative links alone;
- adds a one-pixel image at `/email/open/{outboxId}`.

`email_track_click(token)` increments the count and returns the stored URL;
the route then redirects. `email_track_open(outboxId)` inserts or increments
the open row. Both are service-role-only, atomic and do not store an IP
address or user agent. A failed link insert keeps the original link, so
tracking can never break the message.

`pnpm job:email-tracking-purge` deletes both tables' rows after 24 months. The
marketing report view is not built yet.

## 9. Operations

| Command | Purpose |
|---|---|
| `pnpm job:campaigns-send` | Queue due scheduled campaigns. |
| `pnpm job:campaign-stats` | Reconcile recipient status and close finished campaigns. |
| `pnpm job:consent-audit` | Repair opt-in/consent mismatches. |
| `pnpm job:notifications` | Send the queued rows. |
| `pnpm job:email-tracking-purge` | Apply the 24-month retention rule. |

Pause everything by setting `marketing_settings.paused = true` (and
`email_settings.marketing_paused = true` if using that switch). The reason is
shown to staff.

## 10. Current gaps

- There is no campaign, segment or marketing screen in the admin console yet.
  The database and jobs are ready; staff currently need SQL or a script.
- Campaign approval is not wired to a UI.
- The complaint/bounce guards need a scheduled calculation and a pause action.
- The marketing report view remains to be built.
- The campaign preview and test-send screens are not built.
