# Custom domains

Get-On connects domains that customers already own. We do not host DNS, sell domains, manage nameservers or edit customer records. The customer adds a TXT proof record at `_geton-verify.{domain}` and one CNAME per connected address. Cloudflare for SaaS provides routing and automatic HTTPS behind a replaceable `HostnameProvider`.

## Invariants

1. Customers keep their DNS. We never host or edit it.
2. Two record kinds: `TXT _geton-verify.{domain}` = `geton-verify={32 lowercase hex}` proves control of the registrable domain; a CNAME per address points to `CF_SAAS_CNAME_TARGET`.
3. No provider hostname is created before the TXT proof succeeds.
4. Custom hostnames use Cloudflare for SaaS. `switch_now` uses HTTP DCV; `prepare_first` uses TXT DCV so HTTPS can become ready before the CNAME moves. See `docs/domains-spike.md`.
5. A hostname is live only when provider hostname and HTTPS are active, the KV mapping exists and `/_gs/health` succeeds.
6. One main address per website. Other addresses, alias domains and the free address (when enabled) 301 GET/HEAD to it. POST is never redirected.
7. A domain is a registrable domain from the Public Suffix List. Each domain has at most two addresses: one main and one optional extra that redirects.
8. Hostnames are globally unique among non-removed connections. A domain may be verified by multiple teams; an address connects to one website at a time.
9. HSTS on customer hosts: `Strict-Transport-Security: max-age=31536000` without `includeSubDomains` or `preload`. Platform hosts keep the stricter header.
10. KV pointer v2: `host:{hostname}` → `{ v:2, siteId, planLapsed? }`; `site:{siteId}` → pointer with `primaryHost`, `redirectToPrimary`, etc. The reader accepts the old single-key pointer for one release. A per-host `planLapsed` flag pauses only that address, so the free address keeps working.
11. Heavy changes take the project lock; provider calls for one domain take a per-domain lock.
12. Nothing publishes automatically except the explicit safe auto-publish when a domain goes live and there are no unpublished changes.
13. Provider limits are configurable: global rate limiter/queue, pending-hostname cap, quota alerts at 80% and maximum. Prices live only in docs/admin copy. `pnpm job:domains-plan` reconciles plan lapses per website: it restores addresses that fit, pauses the oldest over the limit, clears or promotes the project's primary address, and leaves the free address working.
14. TXT proof is valid for adding addresses for 90 days. Existing live addresses keep working if the record is later removed.
15. Never log tokens or full provider responses; never send provider ids to the browser.

## Data model

- `domains`: registrable domain claim, role (`primary`/`alias`), lifecycle status, verification value/expiry, review state, registrar lookup, optional project.
- `domain_hostnames`: connected address, main/extra role, switch mode, provider id/status/SSL status, ownership and validation TXT records, CNAME target/seen, polling/health fields.
- `domain_events`: user-readable history, trimmed to 1,000 per domain.
- `blocked_domains`: exact or wildcard suffix patterns, server-only.
- `released_hostnames`: provider hostnames queued for deletion.
- `projects.primary_host`, `projects.redirect_free_address`, `project_settings.auto_publish_on_domain`.
- `plans.custom_domains_per_site`.

## State machines

Domain: `draft` → `awaiting_txt` → `verified` → `connecting` → `live` ↔ `attention`; `stalled` after 14 days without a CNAME; `plan_lapsed`; `unassigned`; `removing` → `removed`; `failed`. Draft/proof expires after 14 days.

Hostname: `pending` → `active` → `live`; prepare-first `preparing` → `ready_to_switch` → `active` → `live`; problems `moved`, `blocked`, `error`; removal `removing` → `removed`.

Transition data and exhaustive tests live in `apps/web/lib/domains/state.ts`.

## Provider interface

`HostnameProvider` in `apps/web/lib/domains/provider.ts`:

- `checkSetup()`: fallback origin active, connection target matches config.
- `createHostname({ hostname, mode })` → provider id, status, SSL status, ownership TXT, validation TXT, errors.
- `getHostname(id)`, `retryValidation(id)`, `deleteHostname(id)`, `listHostnames(page)`, `usage()`.

`cloudflare.ts` uses the REST API through one `ProviderHttp` class: concurrency 5, global token bucket, retry with jitter on 429/5xx, idempotent requests, redaction and a circuit breaker. `fake.ts` is the default in development and supports a controllable clock, fake DNS and advance routes. The UI and jobs never call Cloudflare directly.

## Cloudflare setup

1. Enable Cloudflare for SaaS on the platform zone.
2. Create and activate the fallback origin.
3. Create `CF_SAAS_CNAME_TARGET` (for example `customers.get-on.tech`) pointing at the fallback origin.
4. Add the Worker route for custom-hostname traffic and more specific Worker: None routes for dashboard/platform hosts. Confirm the exact patterns on the deployed zone.
5. Create `CF_API_TOKEN_DOMAINS` with custom hostnames read/write and the setup-read scopes.
6. Set `CF_SAAS_ZONE_ID`, `CF_SAAS_CNAME_TARGET`, `CF_SAAS_HOSTNAMES_INCLUDED`, `DOMAINS_MAX_PENDING_HOSTNAMES`, `DOMAINS_PROVIDER_RPS`, `DOH_ENDPOINTS`, `RDAP_BOOTSTRAP_URL`, `DOMAINS_PROVIDER`.
7. Run `pnpm job:migrate-pointers` once, then schedule the domain jobs.

## Serving

The Worker resolves `host:{host}` first, then `site:{siteId}`. Unknown hosts get the platform not-found page. Custom hosts get the domain-not-connected or domain-paused page where applicable. Canonical redirects apply to GET/HEAD only and exclude `/_gs/health`. Forms work on custom hosts by resolving `domain_hostnames` before the free address.

## Runbooks

- **Stuck pending:** check TXT/CNAME with DoH, provider status and validation errors; retry validation no more than once every five minutes.
- **Padlock pending:** check CAA, validation records and provider SSL status. Do not delete the hostname while the customer is fixing records.
- **Moved hostname:** show attention, ask the customer to restore the CNAME. Keep provider resources; removal/reconcile handles deletion.
- **Claim dispute:** verify TXT, inspect pending age, use takeover only for never-live claims older than 7 days; live reassignment is admin-only with evidence.
- **Abuse takedown:** block the domain, remove KV mappings, queue provider deletion and notify the team.
- **Pointer migration:** run the idempotent job, compare old and new keys, then retire the old reader after one release.
