# Stats

- Cookie-free first-party tracking only (no IP stored, rotating daily salt).
- Whitelist: `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `utm_id`, `gs_link`, `ref`, `fbclid`, `gclid`, `msclkid`, `ttclid`.
- Click ids recorded only as presence flags (e.g. `fbclid`), never the value.
- Values redacted if they contain `@` or 7+ digits (`__redacted`).
- Events sent by the Worker (`kind: view` or `click`) to `/api/stats/ingest`.
- Daily rollups stored in `stats_daily`, `link_stats_daily`, `param_stats_daily`; 90-day event retention (optional AE); daily totals kept indefinitely.
