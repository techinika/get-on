# Share, backup, export and import rules

- Import reads JSON only (max 10 MB, depth 40, array 20k, string 100k).
- No zip import server-side. Legacy `.getonsite` `site.json` read only after unpacking.
- Nothing overwrites without a safety backup (`before_import`).
- Pictures never travel inside JSON; relinked by hash or user upload.
- Download files signed, 24h expiry, no secrets/messages/visitor data.
- Website ZIP paid only (Basic+); portable (relative links), styled (`assertStyled`), no tracking/form/stats.
- Short links never redirect outside site; unknown codes go to `/`.
- Tracking anonymous and cookie-free; parameter capture whitelisted; personal-looking values redacted.
- Every share/copy uses tracked link unless user picks plain address.
