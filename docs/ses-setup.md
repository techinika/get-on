# Amazon SES setup for Get-On

This document describes the steps to send all platform emails through Amazon SES. Normal platform mail uses `team@get-on.tech`; billing mail uses `billing@contact.get-on.tech`.

## 1) Verify the domain
1. In SES, go to **Verified identities** → **Create identity** → **Domain** and enter `get-on.tech`.
2. Choose **Easy DKIM** (RSA 2048-bit). SES will provide three CNAME records.
3. In Cloudflare DNS for `get-on.tech`, add those three CNAME records with **Proxy status = DNS only (grey cloud)**.
4. Wait for verification (can take a few minutes).

## 2) Custom MAIL FROM domain
1. In the domain identity, set a custom MAIL FROM domain (e.g. `contact.get-on.tech`).
2. Add the MX record SES provides (priority as shown) and the SPF TXT record (`v=spf1 include:amazonses.com ~all` or as instructed).
3. Verify the MAIL FROM domain in SES.

## 3) DMARC
Add a TXT record at `_dmarc.get-on.tech` starting at `p=none`:
```
v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.example; adkim=r; aspf=r
```
Monitor reports, then move to `p=quarantine` and eventually `p=reject` when stable.

## 4) Request production access
If in the SES sandbox, request production access in **Account dashboard → Request production access**. Include a short use-case description (transactional emails for a website builder platform: contact form notifications, auth emails, support/demo emails).

## 5) Configuration set and SNS events
1. Create a configuration set (e.g. `get-on-emails`).
2. Create an SNS topic for SES events.
3. Add an event destination in the configuration set for `Bounce`, `Complaint`, `Delivery`, `Reject` publishing to the SNS topic.
4. Create an HTTPS subscription to `https://your-app-domain.com/api/webhooks/ses` (or your app origin). Confirm the subscription via the confirmation URL.

## 6) IAM user (least privilege)
Create an IAM user with a policy allowing `ses:SendEmail`, `ses:SendRawEmail` restricted to the verified identity and configuration set.

## 7) SMTP credentials for Supabase Auth
In SES, go to **SMTP settings → Create SMTP credentials**. Use these in Supabase Auth → SMTP Settings with sender `team@get-on.tech` and display name `Get-On`.

## 8) Receive mail at team@get-on.tech
Use Cloudflare Email Routing to forward `team@get-on.tech` to a real mailbox. Ensure SPF does not conflict between routing and SES sending; use the MAIL FROM domain to manage sending identity separately.

## 8b) Verify billing@contact.get-on.tech
1. Verify `contact.get-on.tech` as an SES identity (or add it to the verified `get-on.tech` domain setup).
2. Confirm the address can send through the same configuration set.
3. Set `BILLING_EMAIL=billing@contact.get-on.tech` in production. Billing receipts, renewal reminders and payment failure notices use this address with Reply-To `team@get-on.tech`; every other email keeps `team@get-on.tech`.

## 9) Testing
Use SES mailbox simulator addresses to test bounces/complaints: `bounce@simulator.amazonses.com`, `complaint@simulator.amazonses.com`, `success@simulator.amazonses.com`.

## Environment variables
See `.env.example` for required values.

## App environment variables
| Variable | Purpose |
|---|---|
| `TEAM_EMAIL` | Default From address. Defaults to `team@get-on.tech`. |
| `BILLING_EMAIL` | Billing From address. Defaults to `billing@contact.get-on.tech`. Billing emails also use the display name `Get-On Billing`. |
| `EMAIL_TRANSPORT` | `ses`, `console` or `memory`. When unset, SES is used if `AWS_ACCESS_KEY_ID` exists, otherwise console. |
| `AWS_REGION` | SES region, e.g. `eu-west-1`. |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | IAM user credentials. Keep them server-side only. |
| `SES_CONFIGURATION_SET` | Configuration set that publishes Delivery/Bounce/Complaint events. |
| `SES_SNS_TOPIC_ARN` | Optional check that incoming webhook messages came from this topic. |
| `SES_DAILY_LIMIT` | Maximum sends per day before the 90% guard stops non-critical mail. |
| `APP_ORIGIN` | Public app origin used for unsubscribe/confirmation links and the webhook URL. |

`EMAIL_TRANSPORT=console` logs the subject and recipient instead of sending. `EMAIL_TRANSPORT=memory` keeps messages in `memorySender.messages` for tests and `/api/dev/outbox` in development.

## Delivery behaviour
- The app sends immediately with an 8 second timeout. A transient SES failure is queued, then retried after 1, 5, 30 and 60 minutes (at most 4 attempts).
- Every attempt is written to `email_log`. Hard failures and suppressed addresses are not retried.
- Addresses that bounce or complain are added to `email_suppressions` and skipped until an operator removes them.
- At 90% of `SES_DAILY_LIMIT`, only critical mail is sent: `auth`, `recipient_verification` and `admin_alert`.
- Run `pnpm job:email` once for a single pass, or leave it running as a worker (`EMAIL_QUEUE_INTERVAL_MS`, default 60000). It processes queued rows and prints a count.
- Admin overview links to `/admin/email`, which lists recent attempts and blocked addresses.

## Webhook
- The SNS subscription is confirmed through `https://{APP_ORIGIN}/api/webhooks/ses`.
- The route verifies the SNS signature and certificate chain, the topic ARN when set, and handles Delivery, Bounce, Complaint and Reject events idempotently.
- A bounce or complaint writes a suppression row. The handler always answers SNS quickly with 200 once a message is understood.

## Site Worker variables
The published-site Worker needs these so the no-JS form pipeline can sign requests to the app:
| Variable | Purpose |
|---|---|
| `APP_ORIGIN` | The app origin that receives `POST /api/public/forms/{formId}`. |
| `WORKER_SHARED_SECRET` | Shared secret used to sign `x-gs-*` headers. Must match the app. |
| `FORM_TOKEN_SECRET` | Signs the form token embedded in published pages. Rotate with `FORM_TOKEN_SECRET_PREVIOUS` so old pages keep working. |

Set secrets with `wrangler secret put` for `WORKER_SHARED_SECRET` and `FORM_TOKEN_SECRET`; keep the app values identical. `ROOT_DOMAIN` must match the Worker's zone.

## Smoke test
1. Send a demo request in development with `EMAIL_TRANSPORT=console`; confirm it logs once.
2. Set `EMAIL_TRANSPORT=ses` and send to a verified mailbox.
3. Use the SES simulator (`success@`, `bounce@`, `complaint@simulator.amazonses.com`) and confirm `/admin/email` shows the sent row and any suppression.
4. Publish a site with a contact form, submit it, and confirm the notification, the Messages inbox and the thank-you page.
