# Get-On billing UI specification

Status: implementation spec derived from the billing brief. It overrides the
Plan and billing sections of `docs/ui-spec-app.md` and `docs/ui-spec.md`.

> The original brief's Sections 7 and 8 must still be pasted here verbatim
> before this document is treated as the final wording. The screens below are
> the implementation contract until then.

## 1. Principles

- Plain language. No token, gateway, webhook, proration, ledger, SKU or JSON.
- One obvious next step per screen.
- Prepaid only. We never charge a card automatically.
- A price never changes because of a browser request. The server calculates it.
- Every state says what happens next and when access changes.
- Money is shown in the invoice currency, with the USD price underneath when
  they differ.
- A failed payment never loses money and never deletes data.
- The billing page is readable on a 360 px screen without horizontal scrolling.

## 2. Routes

| Route | Who | Purpose |
|---|---|---|
| `/dashboard/plan` | owner, admin (`plan.view`) | plan, usage, renewal, invoices, payment status |
| `/dashboard/plan/checkout` | owner (`billing.pay`) | choose term and coupon, start payment |
| `/dashboard/plan/invoices/[invoiceId]` | owner, admin | one invoice and its payments |
| `/dashboard/plan/renew` | owner | renewal or debt payment choice |
| `/admin/billing` | support/admin | search teams, create invoice, grant access, refund |
| `/admin/billing/teams/[teamId]` | support/admin | one team's billing history |
| `/admin/billing/settings` | owner/admin | terms, discounts, grace, reminders |
| `/admin/billing/coupons` | owner/admin | coupon list and editor |
| `/admin/billing/review` | owner/admin | amount mismatches and failed events |

## 3. Plan and billing (`/dashboard/plan`)

### Header

Breadcrumbs `{Team} / Plan and billing`. Title "Plan and billing". Description
"Your plan applies to everyone in {team name}."

### Billing notice

Show at most one notice, highest priority first:

1. **Payment failed** (danger): "Your payment did not go through. You have not
   been charged. Try again or choose another payment method." Action "Try
   again".
2. **Payment pending** (info): "We are waiting for {provider} to confirm your
   payment. This page updates by itself." Action "Check again".
3. **Grace ending** (warning): "Your paid time ends on {date}. You have {n}
   days left. Your website stays online, but editing stops after that." Actions
   "Renew now", "See what changes".
4. **Lapsed** (danger): "Your paid plan ended on {date}. Your website is still
   online, but new changes are paused. Nothing has been deleted." Action
   "Renew".
5. **Debt** (warning): "You have {amount} from {n} unpaid month(s). Paying this
   first clears the oldest balance. It does not add new time." Action "Pay what
   is owed".
6. **Renewal ready** (info): "Your paid time ends on {date}. Renew when you are
   ready. We will not charge you automatically." Action "Renew".

Notices are server-rendered. Dismissing a notice hides it for this browser
session only; it does not hide a payment failure or a lapsed state.

### Current plan card

- Eyebrow "Your plan"; plan name (Bricolage 28) and badge.
- Price line: "Free forever" or "{price} for {n} months" plus "until {date}".
- One-sentence summary from `PLAN_COPY`.
- Right column: usage rows for Websites, Team members, AI credits, Storage.
- If a term is active: a small line "Paid through {date}" and, for the owner,
  "Renew" secondary button.
- If a grant is active: "Free access until {date}" with a neutral badge. No
  payment action.
- If the plan is Enterprise: "Talk to us" instead of checkout.

### Billing details

Card with `SettingsSection` rows:

- **Billing email** (owner/admin can edit): helper "Receipts and renewal
  reminders go here."
- **Country** (owner/admin can edit): used for tax. Default from the account.
- **Currency**: read-only, from billing settings.
- **Payment method**: "Pay with Pesapal" and the last method used. We never show
  a card number.

### Invoices

Table or stacked rows at 360 px:

| Date | What it was for | Amount | Status | Action |
|---|---|---|---|---|
| 12 Oct 2026 | Pro, 12 months | $139.89 | Paid | View |
| 12 Oct 2026 | Pro, 12 months | $139.89 | Open | Pay |

Statuses in plain words: Paid, Open, Payment pending, Failed, Cancelled,
Refunded, Partly refunded, Expired. An expired invoice has "Create a new one".

Empty state: receipt icon, "No invoices yet", "Your receipts will show up here
after your first payment."

### Renewal

- The owner sees "Renew" only when there is an active or expired paid term.
- Clicking opens `/dashboard/plan/renew`, never a charge.
- The renewal screen shows:
  - current paid-through date;
  - the new term start date (the day after paid-through);
  - term options and prices;
  - any debt, separately, with "This pays the oldest balance first";
  - "Create invoice" primary.
- Creating an invoice does not reserve the price forever. The invoice shows an
  expiry date and a note "Prices can change after this date."
- Paying a renewal while paid time is still active stacks the new term on the
  end date. If paid time has already ended, the new term starts when payment is
  confirmed; the gap is shown as debt and never grants access.
- The first paid term starts on the payment confirmation date.

## 4. Checkout (`/dashboard/plan/checkout`)

Only the owner can pay. Admins see "Ask the owner to pay" with the owner's
name or email.

Steps on one screen:

1. Plan summary (name, term, start date, end date).
2. Term selector: 1, 6, 12, 24, 36, 48, 60 months. Each option shows the
   effective monthly price and the total. The selected option shows the saving
   in plain words ("Save $12.00").
3. Coupon input. "Have a code?" opens a field. Applying a code re-quotes on the
   server. Invalid codes say "That code is not valid for this plan." Expired
   codes say "That code expired on {date}." Never reveal whether another team
   used it.
4. Order summary: plan price, discount, tax, total, currency. No hidden fees.
5. Payment: primary "Pay {total} with Pesapal". Secondary "Cancel".
6. Small print: "You will pay once. We will not charge you again automatically.
   Your plan ends on {date}."

The primary button is disabled while the quote is stale. Any change to term or
coupon creates a new server quote and a new idempotency key.

On submit:

- The server re-checks the quote, plan, coupon, limits and owner permission.
- It creates an invoice and a payment attempt in one transaction.
- It redirects to the provider.
- If the provider fails before redirect, the invoice stays open and the page
  shows "We could not start the payment. You have not been charged."

Return screens:

- `/dashboard/plan?payment=done&invoice=...`: "Payment received. We are
  confirming it." then polls a server route every 3 seconds for up to 60
  seconds.
- `payment=failed`: "That payment did not go through. You have not been
  charged." Actions "Try again", "Choose another method".
- `payment=cancelled`: "Payment cancelled. Nothing was charged."
- `payment=review`: "We received your payment but need to check it. Our team
  has been notified. You will not be charged twice."

Never show "Paid" from a callback alone. Only the verified status call can
change the invoice.

## 5. Invoice detail

- Header: invoice number, status badge, date.
- Seller block: company legal name, address, tax id when configured.
- Buyer block: team name, billing email, country.
- Lines: description, term dates, quantity, unit price, amount.
- Totals: subtotal, discount, tax, total, paid, balance.
- Payments: date, method, reference, amount, status.
- Actions: "Download PDF", "Print", "Pay now" (owner, open invoice), "Ask for
  help" (help panel).
- Paid invoices show "This invoice is final." No edit or delete action.
- A void invoice shows a diagonal "Cancelled" stamp in the status area and a
  note explaining why.

## 6. Admin billing

Admin screens are dense, use tables and are not part of the customer shell.

- Search by team, owner email, invoice number or payment reference.
- Team page: commercial state, effective plan, terms, grants, invoices,
  payments, ledger, activity.
- Actions with a confirmation dialog and a required reason:
  - create invoice (plan, term, price override, note);
  - mark invoice paid (only with a reference and a reason);
  - void invoice;
  - grant access (plan, dates, source, note);
  - revoke grant;
  - refund (full/partial, reason);
  - change grace days for one team;
  - resend receipt.
- Every action writes `team_activity` with category `billing`, the actor, the
  reason and the amount.
- Amount mismatches and unverified callbacks appear in Review with "Ignore",
  "Match to invoice" and "Mark for refund".

## 7. Settings

`/admin/billing/settings` controls:

- term lengths and discount percentages;
- grace days;
- reminder days before the end;
- invoice expiry days;
- maximum unpaid invoices;
- default currency and exchange rate;
- tax rules;
- email sender and reply-to (read-only, from env);
- provider mode (read-only, from env).

Every change is audited. A change never edits existing invoices.

## 8. Coupons

- Code, active, percent or fixed amount, plans it applies to, first purchase
  only, minimum term, start/end, max redemptions, per-team limit.
- Codes are case-insensitive, stored uppercase and never listed publicly.
- A coupon is reserved when the invoice is created and consumed only when it is
  paid. An expired invoice releases the reservation.
- Coupons never reduce tax below zero and never make a total negative.

## 9. Access grants

- Source: referral, support, promotion, migration.
- Plan, start, end, note, created by.
- A grant never creates an invoice or a payment.
- The customer sees "Free access until {date}" and no price.
- An expired grant falls back to the paid term or free plan.
- Revoking a grant does not delete data.

## 10. Emails

All billing email comes from `billing@contact.get-on.tech` with reply-to
`team@get-on.tech`. Kinds:

| Kind | When | Critical |
|---|---|---|
| `billing_receipt` | payment confirmed | yes |
| `billing_payment_failed` | failed or reversed | yes |
| `billing_renewal_reminder` | N days before end | yes |
| `billing_grace_started` | grace begins | yes |
| `billing_lapsed` | grace ends | yes |
| `billing_debt_reminder` | monthly while debt exists | no |
| `billing_invoice_expired` | invoice expiry | no |
| `billing_refund` | refund recorded | yes |
| `billing_grant` | access grant created | no |

Rules:

- Receipts are sent once per confirmed payment. A retry does not resend.
- Reminders are deduplicated in `billing_notifications`.
- A bounce or suppression is visible in admin.
- No email contains a card number, full provider payload or password.
- The receipt link is a signed, expiring link to the invoice page.

## 11. Empty, loading and error states

- Loading: skeleton rows that match the final layout. No spinner-only page.
- Error: "We could not load your billing details." with "Try again" and a help
  link. Never show a raw error code.
- Offline: keep the last rendered totals and disable payment actions with
  "You are offline. Reconnect to pay."
- No JavaScript: the plan page, invoice list and invoice detail render on the
  server. Checkout needs JavaScript only for the term selector; the default
  term still works without it.

## 12. Accessibility

- Every status has text, not only colour.
- The term selector is a radio group with a fieldset and legend.
- Errors are linked with `aria-describedby` and announced with `role="alert"`.
- The payment result poll uses `aria-live="polite"` and stops after 60 seconds.
- Tables have captions and row headers. On mobile they become definition lists.
- Focus returns to the triggering button after a dialog closes.
- All touch targets are at least 44 by 44 px.
