# Email templates

Two kinds of email leave Get-On. Both use `mail.get-on.tech` for auth, but they are configured in different places.

## App email (`packages/email/src/templates.ts`)
These are sent by the app through Resend (one person at a time) or Amazon SES for marketing campaigns and batches. Locally the console/memory sender is used. Each builder returns `{ subject, html, text }`; `packages/email/src/layout.ts` provides the shared layout and button.

| Builder | Kind | When |
|---|---|---|
| `contactNotificationEmail` | `contact_notification` | A new website message, sent to confirmed recipients |
| `contactDigestEmail` | `contact_digest` | More messages than the hourly notification cap allows |
| `contactAutoreplyEmail` | `contact_autoreply` | Optional automatic reply to the visitor (Basic+) |
| `recipientVerificationEmail` | `recipient_verification` | Confirming an extra recipient address |
| `demoRequestAlertEmail` | `demo_request_alert` | Someone asks for a demo |
| `demoRequestAckEmail` | `demo_request_ack` | Demo request acknowledgement |
| `abuseReportAlertEmail` | `abuse_report_alert` | A visitor reports a website |
| `adminAlertEmail` | `admin_alert` | Operational warning to the team |

Rules:
- Keep the subject plain and specific (for example "New message from Sam on Rose Bakery").
- Escape every dynamic value. Dynamic subject lines are sanitised and stripped of newlines.
- The HTML and text versions must both be accurate; do not put a link only in HTML.
- Contact notifications set Reply-To to the visitor. Auto-replies set Reply-To to the first confirmed recipient or the owner.
- Do not hard-code any address other than `TEAM_EMAIL` defaults.

## Supabase Auth email
Paste these into Supabase Auth → Email Templates. Supabase sends auth mail through SMTP; point it at Resend (domain `mail.get-on.tech`). It does not use `packages/email`.

- Confirm signup: subject `Your Get-On code`. This is the signup code email, so the body must show `{{ .Token }}` and **not** only a confirmation link.
- Reset password: subject `Reset your Get-On password`.
- Magic link: subject `Your Get-On login link`.
- Change email: subject `Confirm your new email`.
- Invite: subject `You have been invited to Get-On`.

Supabase Auth does not offer an email second factor. Customer sign-in uses TOTP authenticator codes; the signup code above is the only Supabase-sent code.

## Template checks
- `sanitizeLine` removes line breaks and stray markup from names and site titles.
- Preview both HTML and text when changing a template.
- `SES_DAILY_LIMIT` protects the shared SES account used for marketing; single-recipient mail does not use that guard.
