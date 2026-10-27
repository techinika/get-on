# Get-On UI Specification - Website settings completion

See `docs/ui-spec-share-backup.md` for Backups, Export and import, Links and QR codes, Address share controls, Publish success and Visitors. It replaces earlier specs for those screens.

See `docs/ui-spec-ai.md` for all AI controls; it wins where it conflicts.

See also `docs/ui-spec.md`, `docs/ui-spec-app.md`, `docs/ui-spec-publish.md`, and `docs/ui-spec-domains.md` (this replaces the Address settings spec).

## 7. Settings UI specification (atom level)
Tokens and components come from `docs/ui-spec.md` and `docs/ui-spec-app.md`. Reuse; do not duplicate.

### 7.1 Navigation and layout
- **Routes** under `/dashboard/projects/[id]/settings/`: `business`, `address`, `publishing`, `search`, `sitemap`, `redirects`, `analytics`, `backups`, `export-import`, `transfer`, `delete`, `activity`. `/settings` redirects to `business`. Also `.../visitors`.
- **Layout (1024 and above):** grouped Settings area with desktop side navigation, mobile index list. Side nav groups: Website (Business, Address, Publishing), Search and visitors (Search appearance, Sitemap and Google, Moved pages, Visitors and analytics), Safety (Backups, Export and import), Ownership (Transfer, Delete website), History (Activity). Danger item "Delete website" uses danger styling. Items show attention dots when needed.
- **Content column:** head block with H2, description, and timing chip "Applies right away" or "Applies when you publish". Cards below.
- **Below 1024:** index list with groups, detail pages show back link.
- **Save behaviour:** sticky save bar, unsaved-changes guard, actions use dialogs. Toast notes publish timing when relevant.
- **Loading and errors:** route-level skeletons; permission denied shows read-only with InfoBox.

### 7.2 Business (updates)
Tagline, browser tab icon with "Use my logo" switch, address details for Google (optional collapsible), time zone, browser bar colour. Timing: applies when you publish.

## 8. Other screens and relationships
Visitors page at `.../visitors` with cookie-free stats, ranges 7/30/90 days, DNT/GPC respect. Pause mode, redirects, backups, export/import, transfer, delete, activity as specified.
