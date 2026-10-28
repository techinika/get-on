# Approvals and dual control

Sensitive staff actions use a four-eyes approval instead of a direct write:
customer success asks, a super admin decides, and a second super admin decides
too when the policy requires it. Read it with `docs/admin.md`,
`docs/staff-permissions.md` and `docs/ui-spec-admin.md`.

## 1. Who can do what

| Step | Who | Database check |
|---|---|---|
| Request | A staff member with the policy's `request_permission` | `staff_assert(request_permission)` |
| Decide | A staff member with the policy's `approve_permission` | `staff_assert(approve_permission)` |
| Execute | The server-side executor | `approval_begin_execute` and `approval_finish_execute`; both also require the policy's `approve_permission` |
| Cancel | The requester, while pending | `requested_by = auth.uid()` |

Every request, decision, execution and cancellation writes `staff_audit_log`.
A request also records the target, the payload, the state hash and whether the
decision needed a second person.

A person can never decide their own request. A person who gave the first
approval cannot give the second approval either.

## 2. Policy table

`approval_policies` is seeded by
`supabase/migrations/20261103000300_staff_approvals.sql`.

| Kind | Label | Request permission | Approve permission | Second approval |
|---|---|---|---|---|
| `refund` | Refund a payment | `billing.refund.request` | `billing.refund.approve` | Above USD 200 |
| `manual_payment` | Record a manual payment | `billing.manual_payment.request` | `billing.manual_payment.approve` | Above USD 500 |
| `credit_adjust` | Adjust a credit balance | `billing.credit_adjust.request` | `billing.credit_adjust.approve` | Above USD 100 |
| `ai_credits` | Add AI credits | `ai.credits.request` | `ai.credits.approve` | Above 1,000 credits |
| `access_grant` / `free_access` | Give free access | `access.free.request` | `access.free.approve` | Always |
| `invoice_void` | Void an invoice | `billing.invoice.void.request` | `billing.invoice.void.approve` | Always |
| `grace_extend` | Extend grace time | `billing.grace_extend.request` | `billing.grace_extend.approve` | Never |
| `billing_hold` | Place a billing hold | `billing.hold.request` | `billing.hold.approve` | Always |
| `plan_change` | Change a plan | `access.free.request` | `access.free.approve` | Always |
| `credits_limit` | Change an AI limit | `ai.limits.request` | `ai.limits.approve` | Never |
| `website_takedown` | Take a website down | `website.takedown.request` | `website.takedown.approve` | Never |
| `website_reinstate` | Bring a website back | `website.reinstate.request` | `website.reinstate.approve` | Never |
| `website_plan_pause` | Pause for a plan | `website.plan_pause.request` | `website.plan_pause.approve` | Never |
| `domain_review` | Decide a domain review | `domain.review.request` | `domain.review.approve` | Never |
| `domain_plan_lapse` | Pause a domain for a plan | `domain.plan_lapse.request` | `domain.plan_lapse.approve` | Never |
| `domain_remove` | Remove a custom address | `domain.remove.request` | `domain.remove.approve` | Never |
| `account_delete` | Delete an account | `account.delete.request` | `account.delete.approve` | Always |
| `template_publish` | Publish a system template | `template.system.manage` | `template.system.manage` | Never |

`access_grant` and `free_access` are aliases kept for older callers. New code
should use `access_grant`.

A policy with no USD and no credit threshold requires a second approval for
every request. A threshold policy requires one only above the threshold.
`grace_extend` has a hard-coded exception: an extension of 90 days or less does
not need a second approval even if the policy says it does.

## 3. Single-operator mode

Dual control needs two active super admins. If only one exists:

- `requires_second` is turned off for the request;
- `single_operator` is set to true;
- the audit row records the exception.

This keeps a one-person operation usable without hiding that the second pair of
eyes was unavailable. When a second super admin is added, the normal rule
applies to new requests. Existing requests keep the mode they were created
with.

## 4. Request rules

`approval_request(kind, target_type, target_id, reason, payload, state_hash,
amount_usd, amount_credits)`:

- rejects an unknown or inactive kind (`APPROVAL_UNKNOWN`);
- requires a reason of at least 10 characters (`APPROVAL_REASON`);
- rejects a 21st open request from the same person (`APPROVAL_TOO_MANY_OPEN`);
- keeps at most one pending request for the same kind, target and requester;
- stores `expires_at = now() + 72 hours`;
- writes an `audit` row and, in the full app, queues an `approval_requested`
  email through the outbox.

Target types are `team`, `project`, `website`, `domain`, `invoice`, `payment`,
`ai`, `staff` and `account`.

The payload is data, not code. The executor must validate it again and must not
trust it just because it was approved.

## 5. Decision

`approval_decide(request_id, decision, reason)`:

1. Locks the request.
2. Checks the request is still `pending`.
3. Marks it `expired` and raises `APPROVAL_EXPIRED` if the deadline has passed.
4. Rejects a decision by the requester (`APPROVAL_FOUR_EYES`).
5. Requires a 10-character reason, including to reject.
6. On `rejected`, sets `status = 'rejected'` and records the decider and reason.
7. On the first approval of a dual-control request, records
   `first_approved_by`/`first_approved_at` and leaves the request `pending`.
   The caller sees `awaiting_second`.
8. On the second approval, or on a single-approval request, sets
   `status = 'approved'`, `decided_by` and `decided_at`.
9. Refuses the same person as both approvers.

A rejected request cannot be revived. Make a new request.

## 6. Execution

`approval_begin_execute(request_id, state_hash)` locks an approved request,
checks the deadline and compares the state hash. A mismatch raises
`APPROVAL_STALE`; the request must be re-made against the current state.

`approval_finish_execute(request_id, ok, error)` marks the request `executed` or
`failed` and records a short error. It must be called even when the executor
throws, so a request is never left in `approved` after an attempt.

The executor is responsible for:

- checking the payload against the live record;
- calling the same service function the customer feature uses;
- never auto-publishing or changing customer content unless the approved action
  explicitly says so;
- writing the business audit row in addition to the approval row.

There is no generic "execute anything" endpoint. Each kind needs its own small
executor and its own re-validation.

The dispatcher lives in `apps/web/lib/admin-actions/approvals.ts`. These kinds
are connected:

| Kind | What the executor does |
|---|---|
| `refund` | Re-reads the payment, checks the remaining amount, then calls `refundPayment` with the approval id. |
| `manual_payment` | Re-reads the invoice, checks it is open and the amount equals the total, then records a `manual` payment through `billing_confirm_payment`. |
| `access_grant` / `free_access` | Creates a plan grant through `admin_billing_create_grant`. |
| `invoice_void` | Calls `admin_billing_void_invoice`. |
| `plan_change` | Calls `admin_set_team_plan`. |
| `ai_credits` | Adds an admin credit bucket through `grant_credits`, keyed by the approval id. |
| `credits_limit` | Re-checks the active member, then sets `credit_member_caps.monthly_credits` through `admin_ai_set_member_limit`. |
| `grace_extend` | Adds days to the team's grace window through `admin_billing_extend_grace`; the extension is stored per team and overlays the global setting. |
| `billing_hold` | Places or releases a team billing hold through `admin_billing_set_hold`; the billing job still refreshes access but skips reminder emails while the hold is active. |
| `website_plan_pause` | Keeps the live version in place, sets `planLapsed` on the site and live custom hosts, stores `projects.plan_paused_at`, and blocks new publishes with `PLAN_PAUSED`. |
| `website_takedown` | Rebuilds the pointer as suspended and records a site flag. |
| `website_reinstate` | Restores the last publish and resolves the suspension flag. |
| `domain_review` | Approves, or rejects with the request reason. |
| `domain_remove` | Removes the domain and its provider hostnames through the domain service. |
| `domain_plan_lapse` | Re-checks the live domain, then pauses it with reason `plan` and writes `planLapsed` host pointers. |

The other kinds return a plain "not connected yet" error and change nothing.
They need their own service function before they can be switched on.

A failed request can be retried by a Super admin through `approval_retry`, but
only inside the 72-hour window. The retry clears the previous error and puts the
request back in `approved`. Refunds store the approval id so a retry after a
successful refund cannot refund twice.

## 7. Expiry and limits

- Lifetime: 72 hours.
- Open requests per staff member: 20.
- `pnpm job:approvals-expire` moves `pending` and `approved` requests past
  `expires_at` to `expired`.
- One pending request per `(kind, target_type, target_id, requested_by)`.

Expired requests stay visible for audit. They cannot be approved or executed.

## 8. Notifications

All three approval emails go through `notification_outbox` with a stable dedupe
key and are sent by `pnpm job:notifications`:

- `approval_requested` goes to active staff who can give the approval, except
  the requester.
- `approval_decided` goes to the requester when the result is rejected,
  executed or failed. It also asks the remaining approvers for a second
  decision after the first approval of a dual-control request.
- `approval_expired` goes to the requester when the expiry job closes the
  request.

The expiry job collects the due request ids before calling `approval_expire()`
and queues one outcome email for each. A notification failure never breaks the
approval itself, and the request link always points at `/admin/approvals/{id}`.
The email contains only approval metadata, never customer content.

## 9. UI behaviour

The approvals screen is specified in `docs/ui-spec-admin.md`:

- A count pill for pending requests.
- Requester view: own requests, status, age, decision reason and a Cancel
  action while pending.
- Super-admin view: all requests, the target, the reason, the payload summary,
  the first approver and the Approve/Reject actions.
- Sensitive actions show a re-authentication prompt if the last sign-in is older
  than 15 minutes.
- The screen never renders customer content. It shows record identifiers,
  masked emails and the approved metadata.

The database helpers are in `apps/web/lib/admin/approvals.ts`, the email helper
is `apps/web/lib/email/approval-notifications.ts`, the screen is at
`/admin/approvals`, and the dispatcher is in
`apps/web/lib/admin-actions/approvals.ts`.

`/admin/approvals/new` creates a request for any action the signed-in member can
ask for and the executor can finish. It asks for the record id, the reason and
the action fields (amount, plan, dates, credits or domain decision). It never
shows customer content and never executes the action. The queue shows the New
request button only when the member can request at least one action.

Sites, domains, teams and billing prefill the target id and action through
`RequestApprovalLink`. A direct form is shown only when the member has the
`direct` permission for that action; otherwise the screen shows the matching
request link. Plan changes use `access.free.direct`, not the broader entitlement
rebuild permission.

## 10. Current gaps

- Free access and AI credit requests are still started from New request with a
  pasted team id. The other record screens prefill the target.
- The executor does not cover `credit_adjust`, `account_delete` or
  `template_publish`, so those kinds are hidden from New request.
- "Request changes" closes the request as rejected. The requester must send a
  new request with the change.
- Billing settings, discounts and other super-admin-only forms are still shown
  to customer success; only their server actions refuse the change.
