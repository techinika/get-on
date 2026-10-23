# Email templates

Two kinds of email leave Get-On. Both use `team@get-on.tech`, but they are configured in different places.

## App email (`packages/email/src/templates.ts`)
These are sent by the app through Amazon SES (or the console/memory sender locally). Each builder returns `{ subject, html, text }`; `packages/email/src/layout.ts` provides the shared layout and button.

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
Paste these into Supabase Auth → Email Templates. Use `{{ .ConfirmationURL }}` in the button.

- Confirm signup: subject `Confirm your email for Get-On`.
- Reset password: subject `Reset your Get-On password`.
- Magic link: subject `Your Get-On login link`.
- Change email: subject `Confirm your new email`.
- Invite: subject `You have been invited to Get-On`.

Auth mail goes through Supabase's SMTP settings, which should point at SES (see `docs/ses-setup.md`). It does not use `packages/email`.

## Template checks
- `sanitizeLine` removes line breaks and stray markup from names and site titles.
- Preview both HTML and text when changing a template.
- `SES_DAILY_LIMIT` protects the shared account; auth, verification and admin alerts are marked critical and are not blocked by the normal daily guard.
