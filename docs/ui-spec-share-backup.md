## 7. Screens and copy

Use the existing dashboard shell, cards, dialogs, toasts, `CopyValue`, chart primitives and 44 px targets. Never show raw JSON, tokens, storage keys, provider names, hashes, credit maths or internal IDs. Plain language wins.

### 7.1 Settings navigation and routes
Add to Safety:
- Backups — `/dashboard/projects/[id]/settings/backups`
- Export and import — `/dashboard/projects/[id]/settings/export-import`

Add under Website:
- Links and QR codes — `/dashboard/projects/[id]/settings/links`

The Address screen keeps its current route and replaces its address copy/share/QR controls with tracked links as described below. Every settings page states "Applies right away" or "Applies when you publish".

### 7.2 Backups screen
Header: H2 "Backups"; description "We keep safe copies of this website so you can go back if something goes wrong."; timing chip "Applies right away" because restoring changes the draft only.

Cards:
1. **Automatic backups** — switch (default on), frequency from plan, "We keep the last {n}" helper, last backup time, next backup time. Turning off stops new automatic backups but keeps existing ones. Requires `site.backups`.
2. **Back up now** — primary button. Shows "Making a backup..." then "Backup ready". If limit reached, show plan limit and link to Plan. Requires `site.backups`.
3. **Your backups** — newest first. Each row: date/time, kind label ("Automatic", "Manual", "Before a change"), page count, pictures included, size, "Lock" toggle (prevents automatic deletion), actions:
   - "Preview" (opens read-only summary; never live)
   - "Restore" (confirmation dialog: "This changes your draft, not your live website. We will make a safety backup first.")
   - "Download" (full backup ZIP; requires `export.backup`; tokenised, expires after 15 minutes)
   - "Delete" (confirmation; locked backups require unlock first)
   Show retention text: "Kept for {n} days" or "Kept until you delete it" for locked.
4. **Storage used** — progress bar for backup storage; "X of Y used". Over limit stops new manual/automatic backups with `BACKUP_STORAGE_FULL`.
5. **What is in a backup** — short list: pages, design, settings, redirects, plugins, pictures, files, and messages only when the owner switched that on at creation. Never secrets, keys, tokens or payment data.

States: empty, building, failed (retry), plan limit, storage full, viewer read-only. Restore never publishes. Delete is soft for exports but hard for backup rows after confirmation; storage objects are removed by `backup-gc`.

### 7.3 Export and import screen
Header: H2 "Export and import"; description "Take a copy of your website or bring one back."; timing "Applies right away" for exports and "Applies when you publish" for imports because import changes only the draft.

Tabs: **Export** and **Import**.

**Export tab** cards:
1. **Content only (JSON)** — "Pages, design, settings, redirects and plugins. No pictures or files." Button "Download content". Requires `export.content`. This is the format to import later.
2. **Full backup (ZIP)** — "Everything, including pictures and files, so you can restore the whole website later." Button "Download full backup". Requires `export.backup`.
3. **Website files (ZIP)** — paid plans only. "A ready-to-host copy of the published website. It does not include the editor or your account." Button "Download website files" or plan upsell. Requires `export.site_zip` and `site_zip_allowed`. Daily limit `site_zip_per_day`.
4. **Recent exports** — last 20 with kind, date, size, expiry and "Download again". Expired rows show "Expired" and no download. All downloads use a short-lived signed token.
5. **Export limits** — `exportsPerDay` for content/backup and `site_zip_per_day` for website ZIP. 429 with plain reset time.

**Import tab** cards:
1. **Choose a content file** — `.json` only, max 10 MB. Drop zone and file picker. Explain "A content file contains no pictures. Pictures already on this website stay unless the file replaces the page that uses them."
2. **What will happen** — mode radio: "Replace website content" (default) or "Add pages to this website". Replace keeps the current theme unless the file has a valid theme. Add keeps the home page and adds the other pages, renaming clashes. Never publishes.
3. **Check the file** — after upload show summary: source name/address, created date, page count, picture count (usually 0), warnings. Show "We check every file before changing anything." Button "Import" disabled until valid.
4. **Safety copy** — "We will make a safety backup first. You can undo this from Backups." Import creates `backups.kind='safety'`, `reason='before_import'`.
5. **Result** — "Imported. Your live website has not changed. Publish when you are ready." Link to pages and Publish. Show warnings as InfoBox.

Errors use `IMPORT_TOO_BIG`, `IMPORT_NOT_VALID`, `IMPORT_TOO_NEW`, `IMPORT_EXPIRED`, `PAGE_LIMIT`, `PROJECT_BUSY` with plain copy. Imported JSON is untrusted: validate structure, limits, blocks, theme, media references, page paths and prototype keys; never execute or trust paths/IDs. ZIP upload is rejected with "Unpack the ZIP and upload the content file inside." No server ZIP import.

### 7.4 Links and QR codes screen
Header: H2 "Links and QR codes"; description "Make a link you can track, then copy it or print a QR code."; timing "Applies right away".

Cards:
1. **Create a link** — form:
   - "What is it for?" label (optional, max 60)
   - "Where should it go?" page picker (internal pages only, default home)
   - "Where will you use it?" source (default "direct")
   - "How?" medium (default "link")
   - "Campaign" (optional)
   - "Term" and "Content" (optional, advanced)
   - extra allowlisted parameters are not editable here; they are captured from incoming links.
   Button "Create link".
2. **Your links** — table/cards: label, short address with Copy, destination page, source/medium/campaign, clicks (7/30/90 toggle), last click, actions QR / Copy / Edit / Turn off / Delete. `links.view` to read; `links.manage` to create/edit; `links.delete` to delete.
3. **QR code** — dialog with 160px preview, "Download PNG", "Download SVG", "Print sheet". Uses the tracked short link, not the raw address. Requires a published website. PNG 1024x1024, 4-module quiet zone, error correction M. Print sheet is A4 PDF with business name, address and one QR.
4. **Link defaults** — source, medium, campaign, term, content saved in `project_settings.link_defaults`; used when copy/share creates a tracked link. "Applies right away".
5. **Limits** — `tracked_links_max`; show used/limit and upsell. 0 means not included.
6. **Privacy note** — "We count clicks and visits without cookies. We do not store IP addresses or identify visitors."

If the website has never published, creating a link is allowed but copy shows "Publish first so this link works" and QR is disabled. Link target must be a path in this website; external URLs are rejected. Turning off a link keeps its history and returns a neutral "This link is no longer active" page that links to the website home. Deleting a link removes its short code permanently and keeps aggregate stats.

### 7.5 Address screen changes
Keep the existing free address and custom address cards. Replace every copy/share/QR action with:
- **Copy** — copies a tracked short link with `source=copy`, `medium=address`, and the current link defaults. Toast "Link copied." Secondary text action "Copy plain address" copies the real address.
- **Share** — native share when available, otherwise a small menu: WhatsApp, Email, Copy. All use a tracked link with `medium=share`. WhatsApp text: "Visit {business name} online: {tracked link}".
- **QR code** — opens the same QR dialog using a tracked link with `medium=qr`, `source=qr`. Requires a live address. Never encodes the raw URL when tracking is available.
- **Open** — opens the real address, not the short link.

The "main address" is `primaryAddress()`: live custom main host if present, else free address. All display/copy/share/QR surfaces use it. The free address card keeps its redirect switch and copy action. Admin and domains pages use `primaryAddress()` when showing "the website address".

### 7.6 Publish success changes
After publish, success view shows:
- "Your website is live" and the main address with `CopyValue`.
- Primary "Open my website".
- Secondary grid: "Share on WhatsApp" and "Download QR code".
- "Copy link" uses a tracked link with `medium=share`, `source=publish`.
- The QR dialog uses a tracked link with `medium=qr`, `source=publish`.
- "What to do next" gains "Share your website" which opens the same actions and completes when Copy, WhatsApp or QR is used.
- If tracking cannot be created, fall back to the plain address with a small note "This link will not be counted."

### 7.7 Visitors screen
Header: H2 "Visitors"; description "See how many people visit your website. We do not use cookies and we do not identify anyone."; range tabs 7 / 30 / 90 days; timezone from settings; DNT/GPC respected.

Cards:
1. **Summary** — visitors, page views, change vs previous period with up/down text (not colour alone).
2. **Visitors over time** — accessible SVG bar/line chart, one bar per day, tooltip on focus/hover, keyboard accessible, reduced-motion safe, empty state. Use the same chart primitive for the project overview sparkline and admin combined report.
3. **Top pages** — path, views, share of views.
4. **Top links** — label, short code, clicks, visitors.
5. **Campaigns** — allowlisted parameter key/value, views/clicks, source/medium/campaign summary. Empty state "No campaign visits yet."
6. **Recent contact messages source** — count by source/link, no personal data in this card.
7. **Privacy** — "No cookies. No IP addresses stored. Bots excluded. Daily numbers kept long term; detailed raw events are not stored."
8. **Counting switch** — link to Analytics settings; if off, show "Counting is off" with switch for editors.

If no data: "No visitors yet. Publish and share your website to start counting." If never published: "Publish your website to start counting." If plan analytics is not included, show read-only summary with upsell; existing data remains visible.

### 7.8 Admin combined visitors
Admin gets a "Visitors" section on `/admin` and a detail page `/admin/visitors`:
- Combined visitors and views for 7/30/90 days and all time.
- Chart of combined daily visitors.
- Table per website: visitors, views, change, top link, top campaign, last visit.
- Peak day, busiest website, total tracked links, total clicks.
- Filter by team, plan, status and date range. CSV export of aggregates only, no visitor-level rows.
- Link to each website's Visitors page.
- Show data freshness ("Updated {time}") and rollup health. If rollups are stale, show a neutral notice, never raw JSON.

### 7.9 Empty, loading and error rules
- Skeletons for cards and charts; no layout shift.
- 44 px minimum targets; visible focus ring; reduced motion.
- 360 px minimum width; tables become stacked cards.
- Light and dark dashboard themes; charts use tokens, not fixed hex.
- Toasts for copy, download start, backup ready, import result, link created.
- Never show a raw exception. Stable error codes map to plain copy in `lib/errors`.
- Viewer sees read-only pages with InfoBox "Ask an owner, admin or editor to make changes." and no action buttons.

## 8. API, worker and data behaviour

### 8.1 Formats and limits
- Package format: `getonsite` v1, content schema v4. Manifest includes `kind`, `source`, `options`, `counts`, `contentHash`, `mediaTotalBytes`, `createdWith`, `createdAt`, `formatVersion`, `contentSchemaVersion`, `themeVersion`.
- Content JSON: max 10 MB, max depth 40, max 20,000 items in any array, max 100,000 characters in any string. Reject `__proto__`, `constructor` and `prototype` keys. Reject unknown top-level keys. Validate pages, blocks, theme, redirects, plugins and media references with Zod.
- Full backup ZIP: manifest, `site.json`, `media/index.json`, `media/files/*`, optional `messages.json`, `checksums.sha256`. Pictures re-encoded to WebP/PNG/JPEG, max 5 MB each; PDFs verified by magic bytes and size; no executable files, symlinks, absolute paths, `..`, backslashes or duplicate names. No secrets.
- Website ZIP: published files plus `README.txt`, `sitemap.xml`, `robots.txt`, assets and a plain `site.json` containing only public content. No editor data, contacts, analytics, account ids, tokens or internal keys. Paid plans only.
- Content import accepts `.json` only. It never accepts `.zip` or `.getonsite` on the server. Legacy `.getonsite` `site.json` is read only after the owner unpacks it and uploads the JSON. Reject too-new format versions.
- Every archive entry is checked for path safety and checksum. Uncompressed total must not exceed 250 MB or 4x the compressed size, whichever is lower.

### 8.2 Download security
- Exports, backups and website ZIPs are written to storage under
  `exports/{projectId}/{exportId}.zip`, `backups/{projectId}/{backupId}.zip`,
  and `imports/{teamId}/{importId}.json`.
- The browser never receives a storage key. A download route checks the session,
  project/team, permission and row expiry, increments `download_count`, then
  returns a 15-minute signed token URL or streams with `Cache-Control: no-store`.
- Downloads are rate limited by `exportsPerDay` for content/backup and
  `site_zip_per_day` for website ZIP. Token is single-purpose, project-bound and
  expires. No public bucket.
- Backup downloads require `export.backup`; content JSON `export.content`;
  website ZIP `export.site_zip`. Creating backups requires `site.backups`.
- Cleanup jobs remove expired objects and rows. Locked backups are exempt from
  automatic deletion. Deleted websites cascade their package objects.

### 8.3 Tracked link rules
- Code is 7-10 lowercase base32 characters, unambiguous alphabet, unique,
  generated server-side with retry. Never sequential.
- `tracked_links` stores `project_id`, `code`, `target_path`, `label`, `source`,
  `medium`, `campaign`, `term`, `content`, `params jsonb`, `created_by`,
  `created_at`, `revoked_at`, `last_clicked_at`.
- Target must be `/` or a path of a visible page in the same website. Reject
  `//`, `\`, `..`, CR/LF, schemes, query and fragment in `target_path`.
- KV `link:{code}` = `{ v:1, siteId, projectId, targetPath, params, active }`.
  Created/updated immediately; revoked on turn-off/delete. No target URL is
  accepted from the browser at redirect time.
- Worker handles `/_l/{code}` before canonical-host redirects and before cache.
  Active: 302 to the main address plus path and allowlisted parameters, then
  counts the click. Unknown/revoked: neutral 404/410 page linking to the
  website home where known, else platform not-found. GET/HEAD only; POST 405.
- Short link is on the website's main address when live, else free address.
  Every copy/share/QR action creates or reuses a tracked link with defaults and
  `source`/`medium` set for the surface. "Copy plain address" is secondary.
- `tracked_links_max` per website. 0 means not included. Existing links remain
  readable after a downgrade but cannot be added; over-limit links show a plan
  notice and keep redirecting.
- Admin can see link counts and abuse signals, but not visitor identities.

### 8.4 QR rules
- QR encodes the tracked short link, never the raw address when tracking is on.
- Client preview uses lazy-loaded `qrcode`, 160x160, white background, 12 px
  padding, 1 px border, radius 16, caption "Scan to open your website. Print it
  for your shop window."
- PNG 1024x1024, 4-module quiet zone, error correction M, filename
  `{subdomain}-qr.png`. SVG equivalent. Print sheet A4 PDF with business name,
  address, QR and a short instruction. Validate scannability with a decoder in
  tests. If the website is not live, disable QR with "Publish first".

### 8.5 Campaign parameters
- Allowlist is `stats_param_whitelist` in the database. Default keys:
  `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`,
  `gclid`, `fbclid`, `msclkid`.
- Worker captures query params on `/_l` clicks and on countable page views. It
  sends a bounded query string (max 512 bytes) to the app; the app filters by
  allowlist, lowercases keys, trims values to 200 chars and stores only known
  keys. Never store unknown params.
- Link creation stores its own source/medium/campaign/term/content in
  `tracked_links`; on redirect those values are added to the destination query
  (existing destination params win for non-UTM keys).
- Contact form submissions record `source` (source/medium/campaign summary) and
  `source_link_id` from the tracked link or allowlisted `utm_*`/click id. This
  is attribution only, never a visitor identity.
- No cookies, fingerprinting, IP storage or cross-site tracking. DNT/GPC
  disables counting. Bots and prefetch requests are excluded. Daily rotating
  salt produces a visitor hash; the hash is stored only in the daily visitor
  table and is never exposed in UI or exports.

### 8.6 Worker and statistics
- Count only GET, HTML, status 200 responses. Exclude `/_forms`, `/_gs`,
  `/_l`, assets, redirects, bots, prefetch and DNT/GPC.
- Worker sends a signed event to the app (HMAC over timestamp + body with
  `WORKER_SHARED_SECRET`), with `siteId`, `projectId`, `date`, `path`,
  `visitorHash`, `linkCode`, `params` and `kind` (`view` or `click`). It never
  sends IP, user agent, email or content. Timestamp is checked within 5 minutes
  to stop replay.
- App endpoint verifies the signature, resolves the project, checks
  `stats_enabled` and plan analytics, then calls a service-role RPC:
  - `stats_daily` increments views; `stats_visitors_daily` unique
    `(project_id, date, visitor_hash)` increments visitors only once.
  - `link_stats_daily` increments clicks/visitors per link/day.
  - `param_stats_daily` increments views/clicks per allowlisted key/value/day
    and optional link.
- Optionally write the same event to Analytics Engine. Never make AE the
  reporting source; raw AE retention is 90 days.
- Daily rollups are kept indefinitely in Postgres. Visitor hashes may be
  deleted after 90 days without changing the daily totals.
- Rollup job `pnpm job:stats-rollup` verifies/repairs daily rows, expires old
  visitor hashes and writes job history. `pnpm job:stats-cleanup` removes
  stale raw data if AE export is enabled.
- Admin and Visitors pages read daily tables, never AE directly. All queries
  are project/team scoped for users; admin uses service role with allowlist.

### 8.7 Plan and permission behaviour
Add plan limits:
- `site_zip_allowed` boolean
- `site_zip_per_day` int
- `tracked_links_max` int

Suggested defaults: Free 0/0/0, Basic false/0/5, Pro true/3/50,
Enterprise true/20/500. All decisions go through the billing resolver, never
`teams.plan_id` directly. `0` means not included; `null` means unlimited.

Add permissions and mirror them in TypeScript, `matrix.json` and
`permission_matrix`:
- `links.view`: owner/admin/editor/viewer true
- `links.manage`: owner/admin/editor true
- `links.delete`: owner/admin true
- `export.content`: owner/admin/editor true
- `export.backup`: owner/admin/editor true
- `export.site_zip`: owner/admin true
- `import.content`: owner/admin/editor true

Viewers can read links and visitor summaries but cannot create, edit, delete,
export or import. Editors cannot download a paid website ZIP unless the matrix
says so. A lapsed plan keeps existing links redirecting and existing data
readable, but blocks new links, new exports and website ZIP downloads.

### 8.8 Data retention
- Backups: plan `backup_auto_keep` for automatic, `backup_manual_max` for
  manual; safety backups kept 30 days; locked until unlocked. Storage cap from
  `backup_storage_mb`.
- Exports: 7 days for content/backup; 24 hours for website ZIP; 1 hour for
  import uploads. Rows remain for history but downloads expire.
- Links: kept until deleted; stats kept indefinitely as daily aggregates.
- Visitor hashes: 90 days; daily totals forever. Contact messages follow the
  existing retention.
- Admin audit of downloads and link abuse is kept per existing admin policy.

### 8.9 Jobs
- `pnpm job:backups` creates automatic backups due by plan frequency.
- `pnpm job:backup-gc` deletes expired unlocked backups and orphaned blobs.
- `pnpm job:exports-cleanup` deletes expired export objects and marks rows.
- `pnpm job:imports-cleanup` deletes expired uploads.
- `pnpm job:stats-rollup` repairs daily stats and expires visitor hashes.
- `pnpm job:stats-cleanup` removes raw AE exports when enabled.
- `pnpm job:backfill-media-hashes` hashes existing media for backup dedupe.
All jobs are idempotent, log to job history and never publish or change live
content.

### 8.10 Testing and observability
- Unit tests: validators, limits, prototype keys, checksums, path traversal,
  ZIP round-trip, media re-encode, import merge/replace, safety backup, link
  code/targets/revocation/plan caps, QR decode, worker redirects and cache
  order, stats signature/replay, daily unique counting, rollups, admin combine.
- Integration/e2e: backups create/restore/download, content export/import,
  website ZIP gating, link create/copy/QR/redirect, visitors chart, admin
  combined visitors, empty/loading/error states, viewer read-only.
- Screenshots for every new screen/state at 360, 768, 1024, 1280 and 1440 px,
  light and dark. Review and list deviations.
- Log stable error codes and job outcomes, never tokens, storage keys, raw
  visitor hashes or personal data.
- Analytics Engine limits verified: 20 blobs, 20 doubles, 1 index, 16 KB blobs,
  96-byte index, 250 points/invocation, 90-day raw retention. Never exceed
  them; batch or drop with a counter.
