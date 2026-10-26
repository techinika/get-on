# Settings

Rules for website settings:
- Heavy changes never run at the same time on one website (publish, apply template, import, restore, transfer, delete).
- Nothing overwrites without a safety copy for restore/import/template/delete operations.
- Nothing publishes automatically except explicit publish actions.
- Backups and exports never contain secrets.
- Imported files are untrusted and validated.
- Transfers move the website only; receivers must accept.
- A website can be moved to another of your teams straight away, or sent to another person by email. The email link is single use and lasts 7 days. The receiver picks a team they own or manage; website and page limits are checked when they accept. The sender can cancel while it is waiting. `TRANSFER_TOKEN_PEPPER` hashes the link token (it falls back to `INVITE_TOKEN_PEPPER`).
- Published pages have no client JavaScript except Google Analytics when enabled.
- Visitor stats are cookie-free and first-party.
- Every settings page states when changes take effect.
- Deleted websites are recoverable for 14 days, then purged after 30 more days holding the web address.

Jobs (documented): backups (hourly), backup-gc (daily), exports-cleanup (hourly), imports-cleanup (hourly), transfers-expire (hourly), deleted-purge (daily), subdomain-release (daily), activity-trim (daily), redirects-resync (daily), backfill-media-hashes (once).
