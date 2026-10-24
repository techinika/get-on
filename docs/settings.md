# Settings

Rules for website settings:
- Heavy changes never run at the same time on one website (publish, apply template, import, restore, transfer, delete).
- Nothing overwrites without a safety copy for restore/import/template/delete operations.
- Nothing publishes automatically except explicit publish actions.
- Backups and exports never contain secrets.
- Imported files are untrusted and validated.
- Transfers move the website only; receivers must accept.
- Published pages have no client JavaScript except Google Analytics when enabled.
- Visitor stats are cookie-free and first-party.
- Every settings page states when changes take effect.
- Deleted websites are recoverable for 14 days, then purged after 30 more days holding the web address.

Jobs (documented): backups (hourly), backup-gc (daily), exports-cleanup (hourly), imports-cleanup (hourly), transfers-expire (hourly), deleted-purge (daily), subdomain-release (daily), activity-trim (daily), redirects-resync (daily), backfill-media-hashes (once).
