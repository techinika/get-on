# Entitlements

Every plan-dependent decision goes through one server-side resolver. Feature
code must not read `teams.plan_id`, `plans` or billing rows directly to decide
what a team may do.

## Source of truth

- `plans` stores the catalogue: prices, limits and plan rank.
- `team_billing` stores the current commercial state for a team:
  `status`, `effective_plan_id`, `paid_through`, `grace_ends_at`, `lapsed_at`
  and `debt_cents`.
- `subscription_terms` stores paid coverage. A term is active when
  `starts_at <= now < ends_at` and its status is `active`.
- `access_grants` stores free access from referrals, support or promotions.
- `teams.plan_id` is a cache of the effective plan, updated in the same
  transaction as `team_billing`. It exists so old code and the shell keep
  working while the migration is completed.

`billing_resolve_team(team_id, at)` returns:

```ts
type TeamAccess = {
  planId: PlanId;
  source: "paid" | "grant" | "free" | "grace" | "lapsed";
  status: "active" | "grace" | "lapsed" | "free";
  paidThrough: string | null;
  graceEndsAt: string | null;
  debtCents: number;
  limits: PlanLimits;
  features: FeatureFlags;
};
```

The resolver is deterministic and read-only. A job calls it and writes the
cache. Pages call it for display, but mutations call it again inside the
transaction that performs the mutation.

## Resolution order

1. **Active paid term.** The term covering `at` wins. If two terms overlap, the
   higher plan rank wins, then the later `starts_at`.
2. **Active access grant.** Highest plan rank, then latest start.
3. **Grace.** When a paid term ended and `grace_ends_at > at`, keep the paid
   plan and set `status = 'grace'`. The plan keeps working; the dashboard shows
   a billing notice with the exact end date.
4. **Free.** Otherwise use `free`.
5. **Lapse.** When grace has ended, `status = 'lapsed'`, `planId = 'free'` and
   the team keeps all data. No data is deleted by a lapse.

An unpaid renewal does not remove an active term. Coverage ends when the term
ends. Debt is tracked separately and does not silently extend access.

## Effective plan and debt

- A renewal invoice is created only when the customer asks for one, or when an
  admin creates it. We never auto-charge.
- A renewal stacks on top of active paid time. If paid time has already ended,
  the new term starts when payment is confirmed. The gap is debt, not access.
- A first subscription starts on the date the payment is confirmed.
- If a team skips months, the gap is recorded as debt. The billing dashboard
  shows the gap and the amount. Payments settle the oldest debt first, then the
  selected invoice. Debt does not grant access.
- Paying a debt does not backdate access and does not create a term for the
  skipped months unless an admin explicitly grants it.
- If the team was disabled and returns, the debt is visible before checkout.
  The checkout screen offers "Pay what is owed" and "Renew from the end of the
  last paid term" as separate choices.

## Limits

`PlanLimits` is a plain object with no database or React dependency:

```ts
type PlanLimits = {
  maxWebsites: number | null;
  maxPagesPerSite: number | null;
  maxMembers: number | null;
  maxPlugins: number | null;
  maxTemplates: number | null;
  maxCustomDomainsPerSite: number;
  maxRedirects: number;
  maxPreviewLinks: number;
  maxDeletedPending: number;
  storageMb: number;
  monthlyEmails: number;
  aiMonthlyCredits: number;
  aiDailyActions: number;
  formsMonthly: number;
  backups: {
    autoFrequency: "weekly" | "daily";
    autoKeep: number;
    manualMax: number;
    storageMb: number;
  };
  exportsPerDay: number;
  support: "standard" | "priority" | "highest";
  watermark: boolean;
};
```

`null` means unlimited. `0` means not included. Never use a truthy check for a
limit: `0` is a real limit.

## Feature flags

Feature flags are derived from limits and plan rank, never stored as a mutable
boolean per team:

| Feature | Rule |
|---|---|
| `customDomain` | `maxCustomDomainsPerSite > 0` |
| `removeBadge` | `!watermark` |
| `customCode` | Pro and above |
| `analytics` | Basic and above |
| `teamMembers` | `maxMembers === null || maxMembers > 1` |
| `plugins` | `maxPlugins === null || maxPlugins > 1` |
| `prioritySupport` | `support !== "standard"` |
| `previewLinks` | `maxPreviewLinks > 0` |
| `exports` | `exportsPerDay > 0` |

## Grace and lapse behaviour

When access is in grace:

- the paid plan stays active, so editing and publishing keep working;
- existing websites stay online;
- the dashboard shows a billing notice with the exact end date;
- downloads, exports and deletion remain available;
- renewing before the end date avoids a lapse.

When access is lapsed:

- the free plan limits apply to new work;
- publishing and new AI actions are blocked;
- existing paid resources are not deleted;
- websites that exceed free limits stay online in read-only mode until the
  owner chooses what to remove;
- the billing page shows the debt and the last paid term.

## Enforcement points

| Area | Where the resolver is used |
|---|---|
| Websites | create, duplicate, restore, transfer accept |
| Pages | create, duplicate, restore, template apply |
| Publishing | publish, unpublish, auto-publish, pointer plan state |
| Plugins | install, enable, plan lock |
| Domains | add, verify, switch, plan pause |
| Team | invite, accept, role change, seat reconcile |
| Templates | personal template create, apply |
| Backups | manual backup, restore, retention |
| Redirects | create, import |
| Preview links | create |
| Storage | upload, re-encode |
| Forms | monthly submissions |
| AI | reserve credits, daily action cap, member cap |
| Exports | export site, import site |
| Support | priority routing and SLA |
| Activity | retention trim |

## Database rules

- `plans` is readable by everyone. Billing tables are never readable by
  anonymous users.
- Invoices, payments and the ledger are append-only. A paid invoice can only be
  changed by a reversal or refund flow that writes a new row.
- All mutations are server-side and service-role only, or through a
  `security definer` function that checks `team_can`.
- RLS policies must not read the table they are defined on.
- `billing_resolve_team` is `stable security definer` and is not granted to
  `anon`.
- `billing_refresh_team` is service-role only. It locks `team_billing`, writes
  the cache and never deletes data.

## Migration plan

1. Add catalogue columns and billing tables.
2. Add the resolver, refresh function, invoice numbering and payment settlement.
3. Backfill `team_billing` for every existing team and set `teams.plan_id` from
   the resolver.
4. Add a reconciliation job. It reports drift and repairs the cache; it never
   changes a paid term.
5. Move each feature to the resolver, one area at a time, with tests.
6. Keep the old plan readers for one release, then delete them.
