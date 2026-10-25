# Custom domains spike

Date: 2026-10-24. Sources were checked against current official documentation. No live `SPIKE_DOMAIN` or `CF_*` credentials were available in this environment, so provider calls are documentation-verified only. Real-domain verification remains a manual step.

## Decisions that change the prompt

1. **Prepare first uses TXT DCV.** Automatic HTTP certificate validation cannot finish before the CNAME moves. Cloudflare supports pre-validation with the custom-hostname ownership TXT record, and TXT DCV (`ssl.method: "txt"`) lets the certificate become active before cutover. We therefore use `ssl.method: "http"` for `switch_now` and `"txt"` for `prepare_first`. The UI shows the provider ownership TXT and the `_acme-challenge` validation TXT records in prepare-first mode.
2. **Worker routing needs a route plus exclusion routes.** A route on the platform zone (for example `*/*`) sends custom-hostname traffic to the sites Worker. More specific routes with **Worker: None** exclude the dashboard and other platform hosts. The fallback origin is still required and must be active. The Host header is preserved in the documented per-hostname Worker examples; we treat that as the contract and verify it with one real domain.
3. **Cloudflare statuses are richer than the prompt.** We accept `pending`, `active`, `active_redeploying`, `moved`, `blocked`, `pending_deletion`, `deleted`, plus test/provisioning values. Unknown values map to `pending` or `attention` with a technical detail, never a crash.
4. **CNAME removal is not immediate deletion.** Cloudflare marks the hostname `moved`; it can become `deleted` after seven days. We set `attention` on `moved` and keep our provider record until removal/reconcile handles it.
5. **Bare domain CNAME is not generally supported.** We recommend `www`, explain ALIAS/ANAME only as a provider-specific hint, and offer the `www` switch. Cloudflare-hosted customers can use CNAME flattening; that is their provider's feature, not ours.
6. **DoH negative answers and multi-string TXT** follow RFC 2308 and the shared Google JSON schema. Cloudflare does not document these details explicitly. We query two resolvers, treat any exact TXT string as success, and never cache a successful proof beyond the check.
7. **RDAP has no fixed cache TTL.** The IANA bootstrap is cached for 24 hours. `.tech` currently returns no cache headers, so registrar data is cached conservatively by our job, not by HTTP.
8. **Hostname quota/cost** from current Cloudflare for SaaS plans: 100 included, up to 50,000, about $0.10 per additional hostname. Values remain configuration-driven and are not hard-coded in UI or business logic.

## Cloudflare for SaaS setup

- Enable Cloudflare for SaaS on the platform zone.
- Create a proxied fallback origin and designate it. It must become **Active**.
- Recommended connection target: a proxied CNAME such as `customers.get-on.tech` pointing at the fallback origin. The app reads `CF_SAAS_CNAME_TARGET`; `checkSetup()` verifies it.
- Add the platform Worker route (for example `*/*`) and exclusion routes with Worker: None for dashboard/platform hosts. Confirm the exact patterns against the deployed zone.
- API token scopes need custom hostnames read/write on the SaaS zone and fallback-origin/zone read where used by setup checks.
- Never expose provider ids or raw responses to the browser.

Sources: [get started](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/start/getting-started/), [Worker as origin](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/start/advanced-settings/worker-as-origin/).

## Custom hostname API

| Action | Method and path | Key fields |
|---|---|---|
| Create | `POST /client/v4/zones/{zone_id}/custom_hostnames` | `hostname`, `ssl.method`, `ssl.type: "dv"`, `ssl.bundle_method: "ubiquitous"`, `ssl.wildcard: false`, `ssl.settings.min_tls_version: "1.2"` |
| Get | `GET /client/v4/zones/{zone_id}/custom_hostnames/{id}` | `id`, `hostname`, `status`, `ssl.status`, `ssl.validation_records`, `ssl.validation_errors`, `ownership_verification`, `verification_errors` |
| List | `GET /client/v4/zones/{zone_id}/custom_hostnames?page=&per_page=` | filters by hostname/status; used by reconcile |
| Retry | `PATCH /client/v4/zones/{zone_id}/custom_hostnames/{id}` | echo current SSL settings; resets DCV backoff |
| Delete | `DELETE /client/v4/zones/{zone_id}/custom_hostnames/{id}` | removes hostname and certificates |

Create can omit `ssl.validation_records`; poll GET shortly after. Duplicate hostname in the same zone returns HTTP 409 / error 1406. Across different SaaS zones, two accounts may hold the same hostname; routing follows the CNAME target.

Sources: [create](https://developers.cloudflare.com/api/resources/custom_hostnames/methods/create/), [list](https://developers.cloudflare.com/api/resources/custom_hostnames/methods/list/), [validation status](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/domain-support/hostname-validation/validation-status/).

## SSL and validation

- Ownership: `ownership_verification = { type: "txt", name: "_cf-custom-hostname.{hostname}", value }`.
- DCV records: `ssl.validation_records[]` with `status`, `txt_name` (`_acme-challenge.{hostname}`) and `txt_value`. With TXT DCV these can be added before the CNAME switch.
- CAA must allow one of `pki.goog`, `letsencrypt.org`, `ssl.com`. CAA is checked up the hostname tree and through the CNAME to our target. We show the exact records to add when CAA is found.
- Retry validation is rate-limited by Cloudflare backoff. We retry at most once every five minutes and rely on automatic rechecks. Hostname validation retries up to 75 times over seven days; DCV tokens expire after 7–14 days depending on CA.

Sources: [validate certificates](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/security/certificate-management/issue-and-validate/validate-certificates/), [TXT validation](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/security/certificate-management/issue-and-validate/validate-certificates/txt/), [CAA troubleshooting](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/security/certificate-management/issue-and-validate/validate-certificates/troubleshooting/).

## Status mapping

Hostname status: `pending` → waiting; `active` / `active_redeploying` → active; `moved` → moved; `blocked` → blocked; `pending_deletion` / `deleted` → provider removed; unknown → pending with technical detail. SSL status: `initializing`, `pending_validation`, `pending_issuance`, `pending_deployment` → pending; `active` → active; `*_timed_out`, `expired`, `inactive`, `holding_deployment` → attention; deletion states → removed.

Sources: [status codes](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/reference/status-codes/custom-hostnames/), [error codes](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/domain-support/hostname-validation/error-codes/), [backoff](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/domain-support/hostname-validation/backoff-schedule/).

## DNS-over-HTTPS

- Fixed endpoint: `https://cloudflare-dns.com/dns-query` with `Accept: application/dns-json`, `name`, `type`, 3-second timeout. The second resolver comes from `DOH_ENDPOINTS` and is verified during setup.
- Response follows the Google JSON schema: `Status`, `Answer[]` with numeric `type`, `TTL`, `data`. NXDOMAIN is `Status: 3`; NODATA is `Status: 0` with no matching answer.
- TXT `data` contains quoted strings. We compare the exact proof string among the returned strings. Any matching resolver is success; records with no match produce `TXT_WRONG_VALUE`.
- Standard RFC 2308 negative caching applies. We warn that a check made before adding a record can take up to 30 minutes to see it.

Sources: [Cloudflare DoH](https://developers.cloudflare.com/1.1.1.1/encryption/dns-over-https/make-api-requests/), [JSON schema](https://developers.cloudflare.com/1.1.1.1/encryption/dns-over-https/make-api-requests/dns-json/), [Google JSON](https://developers.google.com/speed/public-dns/docs/doh/json), [RFC 2308](https://www.rfc-editor.org/rfc/rfc2308).

## RDAP

- Bootstrap: `https://data.iana.org/rdap/dns.json`, shape `services: [[tlds], [baseUrls]]`, cached 24 hours.
- `.tech` base URL: `https://rdap.radix.host/rdap/`. Domain response uses `objectClassName: "domain"`, `ldhName`, `nameservers`, `secureDNS`, `status`, `entities`, `events`.
- Registrar name is in the registrar entity's vCard `fn`; expiry is the `events[]` entry with `eventAction: "expiration"`. Missing or failed RDAP is non-blocking.

Sources: [IANA bootstrap](https://data.iana.org/rdap/dns.json), [.tech delegation](https://www.iana.org/domains/root/db/tech.html), [RFC 7480](https://www.rfc-editor.org/rfc/rfc7480), [RFC 7483](https://www.rfc-editor.org/rfc/rfc7483).

## Manual verification still required

- One real spare domain: create hostname, observe ownership TXT and TXT DCV records, switch CNAME, confirm active HTTPS, remove CNAME and observe `moved`.
- Confirm the deployed Worker route and exclusion patterns, Host header and fallback-origin behaviour.
- Confirm current hostname count/pricing in the Cloudflare dashboard and the exact API token scopes.
- Confirm Cloudflare-proxied customer CNAME behaviour (O2O) and CAA issuer list at the time of launch.
