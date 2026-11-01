# Amazon SES setup for Get-On

Amazon SES is used for batch marketing campaigns. One-person email (auth
codes, invites, account notices, contact mail and billing) goes through Resend,
so `RESEND_API_KEY` and the Resend domain verification are also required in
production. The app is the only sender; Supabase Auth uses SES SMTP only for
sign-in and account emails.

Read this with `docs/email-system.md` and `docs/marketing-email.md`. The stream
and sender rules are in `packages/email/src/streams.ts`; do not add a new From
address outside that file.

## 1. Verify the sending domain

1. In SES, open **Verified identities** → **Create identity** → **Domain** and
   enter `contact.get-on.tech`.
2. Choose **Easy DKIM** (RSA 2048-bit).
3. Add the three CNAME records in Cloudflare DNS with **Proxy status = DNS only**
   (grey cloud).
4. Wait for the identity to verify.

`get-on.tech` must also stay verified for the human mailboxes and the
`team@get-on.tech` Reply-To. `contact.get-on.tech` is the sending subdomain.

## 2. Custom MAIL FROM

1. Set a custom MAIL FROM domain such as `mail.contact.get-on.tech`.
2. Add the MX record SES gives you.
3. Add the SPF TXT record (`v=spf1 include:amazonses.com ~all` unless SES shows
   something different).
4. Verify the MAIL FROM domain.

Keeping the envelope domain separate from the visible From domain protects the
main domain's reputation.

## 3. DMARC

Start at `_dmarc.contact.get-on.tech` with:

```
v=DMARC1; p=none; rua=mailto:dmarc@get-on.tech; adkim=r; aspf=r
```

Move to `p=quarantine` and then `p=reject` only after the reports are clean.
Keep DMARC on the parent `get-on.tech` consistent with the subdomain policy.

## 4. Request production access

If the account is in the SES sandbox, request production access from **Account
dashboard → Request production access**. Describe transactional website
notifications, account email, billing and opt-in product updates.

## 5. Three configuration sets

Create one configuration set per stream. They keep reputation and event data
separate.

| Configuration set | Stream | From |
|---|---|---|
| `gs-transactional` | Service and account email | `no-reply@contact.get-on.tech` |
| `gs-billing` | Invoices, receipts, payment issues | `billing@contact.get-on.tech` |
| `gs-marketing` | Opt-in campaigns | `no-reply@contact.get-on.tech` |

For each set:

1. Add an event destination for **Delivery**, **Bounce**, **Complaint** and
   **Reject**.
2. Publish the events to the same SNS topic used by
   `/api/webhooks/ses`.
3. Keep the destination enabled for both success and failure events.

The app sends the set name in `ConfigurationSetName`. The environment names are
`SES_CONFIGURATION_SET_TRANSACTIONAL`, `SES_CONFIGURATION_SET_BILLING` and
`SES_CONFIGURATION_SET_MARKETING`. The values above are the defaults, so the
variables are optional unless the names differ.

## 6. SNS topic and webhook

1. Create one SNS topic for SES events.
2. Add an HTTPS subscription to
   `https://{APP_ORIGIN}/api/webhooks/ses`.
3. Confirm the subscription. The route checks the SNS signature and certificate
   URL before confirming.
4. Set `SES_SNS_TOPIC_ARN` in the app so messages from another topic are
   rejected.

The route:

- verifies the SNS envelope in `apps/web/lib/email/sns.ts`;
- stores Delivery/Bounce/Complaint/Reject in `email_events`;
- suppresses permanent bounces and complaints;
- marks the matching `email_log` row failed;
- answers quickly and ignores duplicates.

## 7. IAM user

Create a least-privilege IAM user that can call `ses:SendEmail` and
`ses:SendRawEmail` for the verified identity and the three configuration sets.
Do not give the app console access or identity-management rights.

Store `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` only in the server
environment.

## 8. Supabase Auth SMTP

Use SES SMTP credentials in Supabase Auth → SMTP Settings:

- From: `no-reply@contact.get-on.tech`
- Sender name: `Get-On`
- Reply-To: `team@get-on.tech` when the Supabase project supports it

Supabase Auth uses the `auth`, `password_reset`, `email_verification` and
`magic_link` kinds. They belong to the transactional stream even though
Supabase sends them.

## 9. Human mailboxes

Use Cloudflare Email Routing (or another mailbox provider) for
`team@get-on.tech`, `billing@contact.get-on.tech` and the legal/abuse addresses.
These addresses receive mail; they are not the sending identity.

`team@get-on.tech` is the Reply-To for transactional and marketing mail.
`billing@contact.get-on.tech` is both From and Reply-To for billing mail.

## 10. Testing

Use the SES mailbox simulator:

- `success@simulator.amazonses.com`
- `bounce@simulator.amazonses.com`
- `complaint@simulator.amazonses.com`

Check that:

- `/admin/email` shows the sent or failed row;
- the bounce or complaint creates an `email_suppressions` row;
- a repeat send to that address is suppressed;
- the marketing pause switch prevents new marketing claims;
- the unsubscribe function turns marketing off.

## 11. Environment

| Variable | Purpose |
|---|---|
| `EMAIL_PROVIDER` | Optional override: `auto` (Resend one-person, SES campaigns), `resend`, `ses`, `log`/`console`, `memory`/`fake`. |
| `EMAIL_TRANSPORT` | Older name still read by `readTransport()`; use `EMAIL_PROVIDER` for new setups. |
| `RESEND_API_KEY` | Resend API key for one-person email. Server only. |
| `AWS_REGION` | SES region, for example `eu-west-1`. |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | SES API credentials. Server only. |
| `SES_CONFIGURATION_SET_TRANSACTIONAL` | Transactional configuration set. |
| `SES_CONFIGURATION_SET_BILLING` | Billing configuration set. |
| `SES_CONFIGURATION_SET_MARKETING` | Marketing configuration set. |
| `SES_SNS_TOPIC_ARN` | Reject messages from any other SNS topic. |
| `SES_DAILY_LIMIT` | Direct-send daily guard. |
| `EMAIL_LOGO_URL` / `EMAIL_LOGO_2X_URL` | Public logo URLs for templates. |
| `APP_ORIGIN` | Base for links and the SNS webhook. |
| `EMAIL_TRACKING_BASE` | Base for tracked links when tracking is enabled. |
| `MARKETING_TOKEN_SECRET` | Secret for signed marketing values where needed. |

`TEAM_EMAIL` remains the human contact address and the fallback for support and
legal pages. It is not the From address.

## 12. Pre-launch checks

- All three configuration sets exist and publish to the SNS topic.
- `contact.get-on.tech` DKIM, SPF and DMARC pass.
- `SES_SNS_TOPIC_ARN` matches the live topic.
- `EMAIL_PROVIDER=auto` (or unset) in production, with `RESEND_API_KEY` set.
- `contact.get-on.tech` is verified in Resend for one-person email.
- `marketing_settings.physical_address` and `unsubscribe_base` are set before
  the first campaign.
- The public unsubscribe page is deployed before any marketing send.
- Bounce and complaint events reach `/api/webhooks/ses` and write suppressions.
