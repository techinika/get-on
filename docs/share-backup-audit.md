# Share, backup, export and import audit

Date: 2026-10-27
Branch: `feature/share-backup-links`

This audit covers the existing backup, export, import, share, tracked-link,
QR-code and visitor-statistics code before implementing
`docs/ui-spec-share-backup.md`.

## Summary

- The working export is a synchronous JSON download. It writes no history row,
  enforces no permission or plan limit and emits `contentSchemaVersion: 3`
  while `@get-on/site-package` declares `4`.
- Backups, ZIP packages, import apply, restore points, export history,
  download tokens, retention and cleanup are schema/UI scaffolding only.
- Tracked links, short links, QR codes and campaign attribution do not exist.
- Visitor statistics are a stub. The visitors page always shows an empty state,
  `/api/stats` always returns zero, and the Worker captures no events.
- Admin has no visitor data and no combined visitor report.
- Every copy/share control writes the literal URL. Several surfaces use the
  free address instead of the main custom address.
- `primaryUrl()` is documented but does not exist; `primaryAddress()` is the
  real helper.

## Existing backup/export/import code

| Area | Existing code | State |
| --- | --- | --- |
| Backup schema | `supabase/migrations/20261025000100_settings_expansion.sql:113-152` | `backups`, `backup_blobs`, `backup_media` exist. No writer. |
| Export schema | same file `:154-166` | `project_exports` exists. No `kind`, version source, mime, file name, sha256 or format version. |
| Import schema | same file `:168-180` | `project_imports` exists. No apply path. |
| Operation lock | same file `:79-99`, `:259-281` | `project_operations` and `begin_project_operation` exist but are unused and the RPC has no authorization check. |
| JSON export | `apps/web/app/api/projects/[projectId]/exports/route.ts` | Streams JSON. `requireProject` only checks membership, so viewers can export. No history/limit. |
| Import endpoint | same route `POST` | Returns `503 IMPORT_NOT_READY`. |
| Backup routes | `apps/web/app/api/projects/[projectId]/backups/route.ts`, `apps/web/app/api/backups/create/route.ts` | Listing reads `select("*")` and leaks `r2_key`; create is a placeholder. |
| Export create | `apps/web/app/api/exports/create/route.ts` | Placeholder. |
| Import upload | `apps/web/app/api/imports/presign/route.ts`, `apps/web/app/api/imports/upload/route.ts` | Fake presign and an unauthenticated PUT. |
| Settings actions | `.../settings/actions.ts:643-658` | `createBackup` checks `page.edit`, not `site.backups`, and always fails. |
| UI | `.../settings/backups`, `.../settings/export-import` | Lists empty schema and says "not switched on". |
| Jobs | `apps/web/scripts/jobs/{backups,backup-gc,exports-cleanup,imports-cleanup,backfill-media-hashes}.ts` | All are empty `export {}` stubs. |
| Package | `packages/site-package/src/index.ts`, `export.ts` | Constants, loose types and a minimal manifest check. No ZIP, checksum or reader/writer. |
| Storage | `apps/web/lib/publishing/store.ts` | Publish-only R2/local helpers. No backup/export/import namespace or signed download. |
| Plans | `plans.backup_*`, `exports_per_day` | `exports_per_day` and backup limits are never enforced. No `site_zip_*` or `tracked_links_max`. |

`docs/settings.md` and `docs/site-package-format.md` describe jobs and a package
layout that do not exist yet.

## Existing share/address/QR code

- `apps/web/lib/publishing/config.ts` has `siteHostname`, `siteAddress` and
  `primaryAddress`. `primaryAddress` uses `primary_host` when present.
- `publish-card.tsx`, `publish-dialog.tsx`, `copy-value.tsx`,
  `address-manager.tsx`, `connect-wizard.tsx` and `domain-detail.tsx` copy or
  share raw URLs.
- `address-manager.tsx` shares `freeUrl`, not the main custom address.
- Admin, domains list, address and connect pages use `siteAddress()` (free
  host) in places where the main address should be shown.
- No QR dependency, component, route or download exists. The publish spec
  already asks for client-side `qrcode`, a 160px preview and a 1024px PNG with
  a 4-module quiet zone and error correction M.
- No `/_l/{code}` route exists in the Worker or the Next app.
- Worker cache keys include `url.search`, so campaign links fragment the cache
  unless `/_l` is handled before the normal site cache.
- The Worker only routes `*.get-on.tech/*` in `wrangler.jsonc`. Custom-domain
  routing is an operational deployment concern.

## Existing visitor statistics

- `apps/web/lib/stats/store.ts` defines a summary interface.
- `apps/web/lib/stats/memory.ts` always returns zero.
- `apps/web/app/api/stats/route.ts` is an unauthenticated zero response.
- `packages/site-server/src/bots.ts` has bot/countable helpers but is not
  exported or used.
- `apps/web/lib/settings/stats.ts` duplicates a smaller unused helper.
- `packages/site-server/src/handle.ts` and `apps/sites-worker/src/worker.ts`
  never record a request.
- `projects.stats_site_key` exists and is generated, but the live pointer does
  not carry it.
- `project_settings.stats_enabled` and `ga` exist. The publish loader does not
  select them, the pointer does not carry them and the consent script is unused.
- `redirects.hits` exists but is never incremented.
- `contact_messages` has `page_path` but no source, referrer, campaign or link.
- The visitors page (`.../visitors/page.tsx`) only renders empty states.
- There is no chart component, no daily stats table, no rollup job and no admin
  visitor aggregate.

## Analytics Engine limits (verified 2026-10-27)

Cloudflare Workers Analytics Engine accepts:

- at most 20 blobs, 20 doubles and 1 index per `writeDataPoint`;
- at most 16 KB total blob data per data point (raised from 5 KB in 2026);
- an index of at most 96 bytes;
- at most 250 data points per Worker invocation;
- raw data retention of three months (90 days).

Source: <https://developers.cloudflare.com/analytics/analytics-engine/limits>

Because raw retention is only 90 days, daily rollups must live in Postgres.
The implementation uses a signed first-party Worker-to-app event endpoint as
the durable source and optionally writes the same event to Analytics Engine for
edge observability. No IP, email, user id or content is written to Analytics
Engine.

## Security and correctness gaps to retrofit

1. Viewers can read backups and download content exports.
2. `createBackup` uses the wrong permission.
3. `/api/imports/upload` is unauthenticated.
4. `begin_project_operation` has no authorization check.
5. `/operations/[opId]` does not verify project ownership.
6. Backup listing exposes storage keys and hashes.
7. No import size/depth/array/string limits, prototype-pollution guard, path
   safety, checksum verification, picture re-encoding or PDF verification.
8. No safety backup before import, restore or overwrite.
9. No download tokens, expiry, rate limits or download counters.
10. `contentSchemaVersion` mismatch (`3` vs `4`).
11. Copy/share controls bypass the main address and create no tracked link.
12. Stats are documented as cookie-free but nothing is counted.

## Implementation decisions

- `@get-on/site-package` becomes the single source for format constants, Zod
  schemas, manifest validation, content limits, checksums and ZIP read/write.
- Content JSON is the only import format. The server never parses an uploaded
  ZIP. A legacy `.getonsite` `site.json` may be read only after it has been
  unpacked by the owner and uploaded as JSON.
- Use `fflate` for ZIP writing, `qrcode` for PNG/SVG QR output and `pdf-lib`
  for the print sheet. Pictures are re-encoded with `sharp` before packaging.
- Export/backup/import objects use a dedicated `project-packages` bucket when
  configured, with a local fallback for development. Keys are
  `exports/{projectId}/{exportId}.zip`, `backups/{projectId}/{backupId}.zip`
  and `imports/{teamId}/{importId}.json`.
- Export rows record `kind` (`content`, `backup`, `site_zip`), `version_source`
  (`draft`/`live`), `mime`, `file_name`, `sha256`, `format_version`, `bytes`
  and `expires_at`.
- Every tracked link stores an internal target path only. `/_l/{code}` never
  redirects to an external origin and never trusts a client-supplied target.
- Short links are written to KV as `link:{code}` immediately, independent of
  publishing. The Worker handles `/_l/{code}` before canonical-host redirects
  and before the site cache.
- Visitor counting happens in the Worker for HTML 200 GET responses. The
  Worker sends a signed, body-only event to the app with a daily-salted visitor
  hash. The app stores aggregate daily rows and optional daily visitor hashes;
  it never stores IP addresses.
- Query parameters are sent as a bounded string and filtered server-side by
  `stats_param_whitelist`. Only allowlisted keys are stored.
- `contact_messages.source` and `source_link_id` record the tracked link and
  allowlisted campaign values for the submitted page.
- Long-term daily rollups live in `stats_daily`, `link_stats_daily` and
  `param_stats_daily`. Analytics Engine is optional raw observability, not the
  reporting source of truth.
- Admin reporting reads the same daily tables with service-role access and can
  combine every website, per-website series and all-time peaks.

## Planned schema additions

- `plans.site_zip_allowed`, `plans.site_zip_per_day`,
  `plans.tracked_links_max`.
- `project_exports.kind`, `version_source`, `mime`, `file_name`, `sha256`,
  `format_version`.
- `tracked_links`, `link_stats_daily`, `param_stats_daily`,
  `stats_param_whitelist`, `stats_daily`, `stats_visitors_daily`.
- `contact_messages.source`, `contact_messages.source_link_id`.
- `project_settings.link_defaults`.
- New permissions: `links.view`, `links.manage`, `links.delete`,
  `export.content`, `export.backup`, `export.site_zip`, `import.content`.

## Planned tests

- Format/limit/validator unit tests, prototype pollution, depth/array/string
  limits, checksum and path traversal.
- ZIP round-trip, deterministic manifest, media re-encode, no secrets.
- Import merge/replace, page limits, safety backup, never publishes.
- Link code generation, same-site targets, revocation, plan cap, QR decode.
- Worker `/_l` redirect, no open redirect, canonical order, campaign params,
  bot/DNT/GPC filtering.
- Stats ingest signature/replay, daily unique visitors, rollup, admin combine.
- UI/e2e coverage for the new settings screens and charts where the local
  database is available.
