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
| Execute | The server-side executor | `approval_begin_execute` and `approval_finish_execute` |
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

## 7. Expiry and limits

- Lifetime: 72 hours.
- Open requests per staff member: 20.
- `pnpm job:approvals-expire` moves `pending` and `approved` requests past
  `expires_at` to `expired`.
- One pending request per `(kind, target_type, target_id, requested_by)`.

Expired requests stay visible for audit. They cannot be approved or executed.

## 8. UI behaviour

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

The database helpers are in `apps/web/lib/admin/approvals.ts`. The screen and
the per-kind executor dispatcher are still to be built.

## 9. Current gaps

- No approvals screen exists in `app/admin/(console)` yet.
- No executor dispatcher maps an approved kind to a service function. This is
  the main remaining wiring task before any request can complete end to end.
- `approval_requested`, `approval_decided` and `approval_expired` emails are in
  the catalogue but are not enqueued yet.
- The few direct super-admin actions in the billing/domain/site screens still
  need to be reviewed against the policy table so they either request or record
  an approval.
