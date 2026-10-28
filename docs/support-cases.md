# Support cases

Support cases are how a customer asks for help and how staff keep the work,
notes and SLA clock in one place. Read it with `docs/admin.md`,
`docs/ui-spec-admin.md` and `docs/reports.md`.

## 1. Model

Schema: `supabase/migrations/20261103000400_support_cases.sql`.

| Table | Purpose |
|---|---|
| `support_cases` | The case record: team, optional website, subject, kind, status, priority, assignee, SLA and CSAT. |
| `case_notes` | Customer and staff messages. Internal notes are staff-only. |
| `case_events` | Append-style timeline: created, status change, assignment, escalation, note, SLA breach, resolve, close, reopen and CSAT. |

A case always belongs to a team. It may point at one website, which is useful
when the customer has several.

## 2. Case fields

- **Subject**: 3–200 characters.
- **Kind**: `general`, `billing`, `technical`, `account`, `abuse`, `feature`, or
  the compatibility values `question`, `bug` and `other`.
- **Status**: `open`, `in_progress`, `waiting_customer`, `waiting_staff`,
  `resolved`, `closed`.
- **Priority**: `low`, `normal`, `medium`, `high`, `urgent`.
- **SLA hours**: copied from the team's plan when the case is created.
- **Due at**: created time plus the SLA hours. This is a first-response target,
  not a resolution target.
- **CSAT**: 1–5, optional.
- **Tags**: free-form text array.
- **Escalated at**: set when a staff member escalates the case.

The plan values are:

| Plan | First response |
|---|---|
| Free | 96 hours |
| Basic | 48 hours |
| Pro | 24 hours |
| Enterprise | 4 hours |

## 3. Customer path

`support_case_create(team_id, kind, subject, body, project_id)`:

- allows a team member or a staff member;
- rejects a subject shorter than 3 characters;
- reads the plan's `support_response_hours` and sets `due_at`;
- creates the first customer note;
- writes the `created` event;
- returns the case id.

A customer can add a public note with `support_case_note(case_id, body, false)`.
A customer cannot create an internal note. A staff note that is not internal
sets `first_response_at` if it is still null.

The customer-facing support screen and the link from the help panel are still to
be built. The database functions are ready.

## 4. Staff path

`support_case_note(case_id, body, internal)`:

- staff can write public or internal notes;
- only staff can write `internal = true`;
- the first public staff note stops the first-response clock;
- every note writes a `note_added` event.

`support_case_update(case_id, status, assignee, priority, escalate)`:

- `support.case.view` is checked first;
- changing status to `resolved` or `closed` needs `support.case.close`;
- assigning needs `support.case.assign`;
- escalating needs `support.case.escalate`;
- status changes write `status_change`, `resolved` or `closed` events;
- assignment and escalation write their own events.

Reopening a closed or resolved case is a status change in the same function.
The `support.case.reopen` permission exists in the matrix; the function
currently accepts any status through the close/assign branch, so the executor
should check the permission explicitly before reopening.

## 5. Visibility and privacy

RLS on `support_cases` and `case_events` lets a team member read their own
cases, and lets staff read cases. `case_notes` lets a team member read only
non-internal notes on their own cases.

That means the console must still respect the staff content boundary:

- case subjects and customer notes are support data, not website content;
- staff screens may show them only inside the support workflow;
- a case note must never be copied into a website, email campaign or report;
- internal notes are never sent to the customer.

## 6. SLA and jobs

`pnpm job:sla-check` calls `support_sla_check()`:

- finds open, in-progress, waiting-customer and waiting-staff cases;
- with `first_response_at` still null and `due_at <= now()`;
- writes one `sla_breached` event per case;
- returns the number of new breach events.

The job is idempotent because it checks for an existing `sla_breached` event.
It does not change the case status or email anyone yet.

A warning event before the breach is not implemented. The `sla_warning` event
type exists.

## 7. Reports

`report_refresh('support')` stores:

- open cases;
- open cases past due with no first response;
- open cases grouped by priority;
- average first-response hours over 30 days;
- average CSAT.

`report_refresh('health')` also stores the open SLA breach count. See
`docs/reports.md`.

## 8. Console design

The support screens in `docs/ui-spec-admin.md` are:

- **Cases list**: open first, then waiting, then resolved. Filters for status,
  priority, assignee, plan and breach. Count pills use the SLA clock.
- **Case detail**: subject, team, website, plan, status, priority, assignee,
  due time, customer notes, internal notes and the timeline. Actions: reply,
  internal note, assign, escalate, resolve, close and reopen.
- **Customer 360 link**: open the team record without leaving the case.
- **No content browsing**: the case links to metadata only. Staff cannot open
  the customer's editor, files or messages from here.

## 9. Current gaps

- No customer support screen exists in the dashboard.
- No staff case list or case detail screen exists in the admin console.
- Case reply emails (`support_case_reply`) are not in the catalogue or outbox
  yet.
- SLA warning emails and breach notifications are not sent.
- CSAT collection and the reopen permission check are not built.
- The help panel shows plan priority text only; it does not create a case.
