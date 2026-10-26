# Team activity

One append-only log per team in `team_activity`. The old per-project table is `project_activity_legacy` and `project_activity` is a security-invoker view for the project Activity screen.

## What is recorded
- Actor: user id, name snapshot, role snapshot, kind (`user`, `system`, `support`). A removed member keeps their name and shows as "Former member" when no profile exists.
- Event and category from `packages/activity`.
- Summary in plain language.
- Website id and name snapshot, target type/id/name.
- Extra details in `meta`; never show raw JSON in the UI.
- Client, when known.

## Append-only
Updates may only change `last_at`, `count` and `meta` for coalescing. Deletes are blocked by a trigger unless `app.activity_trim` is on. `trim_team_activity()` is the only delete path and runs from `pnpm job:activity-trim`.

## Coalescing
High-frequency events (typing, repeated design changes) use a `coalesce_key` and a window from the catalog. The log updates the newest matching row inside the window and increments `count`.

## Retention
`plans.activity_retention_days`, default 730. Downgrades keep existing rows and apply the shorter retention on the next trim. A website purge never deletes its activity; the log survives with the website name snapshot.

## Access
Owners and admins read team activity. Owners, admins and editors read project activity. Viewers cannot. CSV export is owners and admins only, with formula escaping and a UTF-8 BOM.

## Jobs
- `pnpm job:activity-trim` removes rows older than the plan retention.
- Activity is written through `logTeamActivity` / `log_activity`, never inserted directly from feature code.
