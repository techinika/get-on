# Pesapal API 3.0 spike

Status: integration design. Live sandbox verification is still manual because
this repository has no Pesapal sandbox credentials yet.

Sources checked on 26 October 2026:

- API reference: <https://developer.pesapal.com/how-to-integrate/e-commerce/api-30-json/api-reference>
- Authentication: <https://developer.pesapal.com/how-to-integrate/e-commerce/api-30-json/authentication>
- Register IPN: <https://developer.pesapal.com/how-to-integrate/e-commerce/api-30-json/registeripnurl>
- Submit order: <https://developer.pesapal.com/how-to-integrate/e-commerce/api-30-json/submitorderrequest>
- Transaction status: <https://developer.pesapal.com/how-to-integrate/e-commerce/api-30-json/gettransactionstatus>
- Refunds: <https://developer.pesapal.com/how-to-integrate/e-commerce/api-30-json/refund-request>

## What we use

Pesapal is a payment provider behind our own `PaymentProvider` interface. No
route, server action, email or job calls Pesapal directly.

```ts
interface PaymentProvider {
  name(): string;
  submitOrder(input: SubmitOrderInput): Promise<SubmitOrderResult>;
  getTransactionStatus(orderTrackingId: string): Promise<ProviderTransaction>;
  refund(input: RefundInput): Promise<ProviderRefund>;
  registerIpn?(url: string): Promise<{ notificationId: string }>;
}
```

- `PESAPAL` is the live adapter.
- `FAKE` is the default in development and tests. It never talks to the
  network and exposes a fake checkout page that can complete, fail or reverse a
  payment.
- Selecting a provider is server-side only. A browser can never choose the
  fake provider in production.

## Endpoints

| Purpose | Sandbox | Live |
|---|---|---|
| Token | `https://cybqa.pesapal.com/pesapalv3/api/Auth/RequestToken` | `https://pay.pesapal.com/v3/api/Auth/RequestToken` |
| Register IPN | `https://cybqa.pesapal.com/pesapalv3/api/URLSetup/RegisterIPN` | `https://pay.pesapal.com/v3/api/URLSetup/RegisterIPN` |
| Submit order | `https://cybqa.pesapal.com/pesapalv3/api/Transactions/SubmitOrderRequest` | `https://pay.pesapal.com/v3/api/Transactions/SubmitOrderRequest` |
| Status | `https://cybqa.pesapal.com/pesapalv3/api/Transactions/GetTransactionStatus?orderTrackingId=...` | `https://pay.pesapal.com/v3/api/Transactions/GetTransactionStatus?orderTrackingId=...` |
| Refund | `https://cybqa.pesapal.com/pesapalv3/api/Transactions/RefundRequest` | `https://pay.pesapal.com/v3/api/Transactions/RefundRequest` |

The base URL is selected by `PESAPAL_ENV=sandbox|live`. A typo must fail
startup, not silently fall back to sandbox.

## Authentication

`POST /Auth/RequestToken` with:

```json
{ "consumer_key": "...", "consumer_secret": "..." }
```

The bearer token is valid for up to 5 minutes. The adapter caches it in memory
with a safety margin (4 minutes), serialises concurrent token requests, and
retries once on `401` by discarding the cached token. Credentials are read from
`PESAPAL_CONSUMER_KEY` and `PESAPAL_CONSUMER_SECRET` and never logged.

## IPN registration

IPN is registered once per environment and stored in `billing_settings`:

```json
{
  "url": "https://get-on.tech/api/billing/pesapal/ipn",
  "ipn_notification_type": "POST"
}
```

The response `ipn_id` is the `notification_id` used in every order. We register
the IPN with `POST` because the handler must return JSON and must not be cached.
If the stored id is missing, the first checkout registers it; a job can repair a
missing registration.

## Checkout

1. The server creates a local `payment_attempt` with a unique
   `merchant_reference` (max 50 characters, only `A-Z a-z 0-9 - _ . :`).
2. It creates the order with `SubmitOrderRequest`:
   - `id`: our merchant reference
   - `currency`: our invoice currency
   - `amount`: invoice total in major units, two decimals
   - `description`: short plain-language description, max 100 characters
   - `callback_url`: `/api/billing/pesapal/callback`
   - `cancellation_url`: `/dashboard/plan?payment=cancelled`
   - `notification_id`: the registered IPN id
   - `billing_address`: email plus optional name/country. No card data ever
     reaches us.
3. The response gives `order_tracking_id` and `redirect_url`. We store the id
   and send the browser to the redirect URL.
4. The callback and IPN contain only `OrderTrackingId`,
   `OrderMerchantReference` and `OrderNotificationType`. They are **not**
   trusted as proof of payment.
5. Both handlers call `GetTransactionStatus` server-side, then pass the result
   through the same idempotent payment pipeline.

## Status mapping

| `status_code` | `payment_status_description` | Local state |
|---|---|---|
| 1 | COMPLETED | confirmed |
| 2 | FAILED | failed |
| 3 | REVERSED | reversed |
| 0 | INVALID | invalid |
| other / no status | unknown | pending, retry later |

Only `COMPLETED` with a matching merchant reference, currency and amount can
settle an invoice. A mismatch is recorded as a review item and never marks the
invoice paid.

`amount` from Pesapal is compared as integer minor units after rounding, not as
a float.

## Idempotency

- `payment_events` has a unique key on `(provider, event_key)`. An IPN and a
  callback for the same order are the same business event.
- `payment_attempts.merchant_reference` is unique.
- `payments.provider_reference` (`order_tracking_id`) is unique.
- Confirming a payment locks the invoice row with `for update`, verifies it is
  still open, then inserts the payment and ledger rows in one transaction.
- Replaying an old IPN returns `200` without changing balances.
- The IPN handler returns
  `{"orderNotificationType":"IPNCHANGE","orderTrackingId":"...","orderMerchantReference":"...","status":200}`
  only after the transaction commits. On a retryable failure it returns `500`
  so Pesapal retries.
- The callback page never returns JSON; it redirects to a normal result screen.

## Currency, tax and rounding

- Plan prices and all internal amounts are USD cents.
- Invoices store their charge currency and the exchange rate used.
- `billing_settings.default_charge_currency` defaults to `USD`.
- If a local currency is configured, the rate comes from `exchange_rates` and
  is snapshotted on the invoice. A later rate change never changes an existing
  invoice.
- Tax is computed on the discounted subtotal and stored as `tax_cents`. The
  default rate is zero until a tax rule is configured.
- All money is integer minor units. Rounding is half-up at the final currency
  conversion only.

## Refunds

Refunds are owner/admin actions, always against a confirmed payment and always
recorded even when the provider call fails. Partial refunds are allowed up to
the unrefunded amount. A refund never deletes the payment or the invoice.
Access is reduced only when the refund policy says so; by default a refund does
not shorten an already-paid term, but an admin can end the term explicitly.

## Environment

```dotenv
PAYMENT_PROVIDER=fake
PESAPAL_ENV=sandbox
PESAPAL_CONSUMER_KEY=
PESAPAL_CONSUMER_SECRET=
PESAPAL_IPN_URL=https://get-on.tech/api/billing/pesapal/ipn
PESAPAL_CALLBACK_URL=https://get-on.tech/api/billing/pesapal/callback
```

`PAYMENT_PROVIDER=pesapal` with missing credentials must fail closed. Production
must never start with `PAYMENT_PROVIDER=fake`.

## Manual verification checklist

- [ ] Register the sandbox IPN and store the returned id.
- [ ] Complete a sandbox card payment and confirm one payment row only.
- [ ] Replay the same IPN and confirm no duplicate ledger row.
- [ ] Fail a payment and confirm the invoice stays open.
- [ ] Reverse a payment and confirm a review item is created.
- [ ] Refund part of a payment and confirm totals.
- [ ] Change the Pesapal amount in a test and confirm the mismatch is rejected.
- [ ] Confirm a callback with a valid-looking but unverified status is ignored.
- [ ] Confirm the IPN handler returns `500` on a simulated database failure.
- [ ] Confirm no credential, full payload or personal data is logged.

## Open questions for Pesapal

- Which currencies are enabled on our merchant account (USD and KES at least)?
- Are partial refunds available for all payment methods?
- What is the retry schedule for IPN `500` responses?
- Is the IPN id stable across dashboard changes, or must we re-register?
