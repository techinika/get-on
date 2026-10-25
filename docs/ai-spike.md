# AI generation spike

Date: 2026-10-25. Sources were checked against current official Cloudflare documentation. No live `CF_AI_*` credentials, Workers AI account or AI Gateway were available in this environment, so provider calls are documentation-verified only. Real-model JSON/moderation/image checks, latency numbers and credit calibration remain manual steps.

## Decisions that change the prompt

1. **Use the AI Gateway REST API, not the Workers AI binding.** The web app is a Next.js server, not a Worker with an `AI` binding. Text calls use `POST /accounts/{account_id}/ai/v1/chat/completions`; image calls use `POST /accounts/{account_id}/ai/run`. Workers AI requests require the `cf-aig-gateway-id` header. This keeps `AiProvider` replaceable and keeps every call on one Gateway path.
2. **Do not cache AI responses.** AI Gateway caching is exact-match and would return another user's generated text or skip a billable call. Send `cf-aig-skip-cache: true` on every request and keep caching disabled on the gateway.
3. **Do not let AI Gateway store prompt/response payloads.** Logging is on by default and can include prompts and responses. Send `cf-aig-collect-log-payload: false` on every request. Keep metadata logging for latency/cost diagnostics, and keep the product's own 30-day `ai_payloads` store as the only content store.
4. **Do not use Gateway cost numbers as the billing source.** AI Gateway cost is an estimate based on tokens and public pricing. Compute credits from provider-reported `usage` plus the admin registry's neuron prices. For image models, compute from the documented tile/step formula because there is no token usage.
5. **JSON Mode is structured output, not a guarantee.** It does not support streaming and can return `JSON Mode couldn't be met`. Every structured task must validate with Zod, attempt one repair, then fall back or fail with `AI_BAD_RESULT`.
6. **Only seed models that are both current and listed as JSON Mode capable for structured tasks.** `@cf/meta/llama-3.1-8b-instruct` is listed but deprecated (context 7,968 tokens), so it must not be seeded. `@cf/meta/llama-3.1-8b-instruct-fp8` exposes `response_format` but is not on the JSON Mode list; it is a candidate fallback only after a live JSON smoke test.
7. **Call Llama Guard ourselves.** AI Gateway Guardrails is useful defence in depth, but it is not the source of truth for category mapping, refusal copy, credit release or the moderation log. Call `@cf/meta/llama-guard-3-8b` as the `moderate` task before spending credits.
8. **Fail fast, retry deliberately.** Send `options.rejectIfBusy: true`, `cf-aig-max-attempts: 1` and a per-task `cf-aig-request-timeout`. Do not let Gateway silently retry a billable call. App-level retry only after a definite failure and only with the same reservation.
9. **Rename the plan column to match the task.** Rename `plans.ai_credits_monthly` to `plans.ai_monthly_credits`, add `plans.ai_daily_actions`, and update the shared constant and both plan seeds. Values: Free `0` monthly and `30` actions/day, Basic `100`/`100`, Pro `400`/`300`, Enterprise `1,500`/`1,000`. The Free 25-credit grant is separate and one-time through `ai_settings.free_grant_credits`.
10. **Use the existing target numbers, but calibrate them.** The 8-credit one-page and 22-credit five-page targets are plausible at Llama 3.3 70B prices, but they are tight. The 24,000-token context also means a five-page site must be split into page/section calls. Run the benchmark before treating the targets as final.

## Official contract

### Authentication and endpoints

- REST API token: Cloudflare API token with **Workers AI Read** permission, in `Authorization: Bearer <token>`. An AI Gateway-only token returns `401`.
- Gateway selection: `cf-aig-gateway-id: <gateway-id>` is required for Workers AI models.
- Text: `POST https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1/chat/completions`
- Image: `POST https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run` with `model` and `input`.
- AI Gateway core features are free. Logs follow Workers Logs retention/pricing for gateways created on or after 2026-09-24; legacy gateways have separate log limits.
- Gateway authentication tokens are account-scoped, not gateway-scoped. Use a server-only token, a dedicated account/gateway, and never expose it to the browser.

### Text request shape

```json
{
  "model": "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  "messages": [
    { "role": "system", "content": "..." },
    { "role": "user", "content": "..." }
  ],
  "response_format": {
    "type": "json_schema",
    "json_schema": { "...": "..." }
  },
  "max_tokens": 1200,
  "temperature": 0.4,
  "options": { "rejectIfBusy": true }
}
```

Headers:

```text
Authorization: Bearer $CF_AI_API_TOKEN
cf-aig-gateway-id: $AI_GATEWAY_ID
cf-aig-skip-cache: true
cf-aig-collect-log-payload: false
cf-aig-max-attempts: 1
cf-aig-request-timeout: 60000
Content-Type: application/json
```

`cf-aig-request-timeout` is measured from the first part of the response. For synchronous JSON calls, set it per task. The documented retry headers are `cf-aig-max-attempts` (max 5), `cf-aig-retry-delay` (max 60000 ms) and `cf-aig-backoff` (`constant`, `linear`, `exponential`).

### Response shapes

- `/ai/v1/chat/completions`: OpenAI-compatible `choices[0].message.content` and `usage.prompt_tokens`, `usage.completion_tokens`, `usage.total_tokens`.
- `/ai/run`: `{ result, success, errors, messages }`. Image models return base64 in `result.image`; Llama Guard returns either a string or `{ safe, categories }` in `result.response`.
- The provider adapter must normalize both shapes into one `AiResult` with text or image, usage, model id and raw status. It must not leak raw provider envelopes to the UI.

### Per-request Gateway headers

| Header | Use |
|---|---|
| `cf-aig-gateway-id` | Required for Workers AI models |
| `cf-aig-skip-cache` | Always `true`; no shared generated content |
| `cf-aig-collect-log-payload` | Always `false`; keep prompts/responses out of Gateway logs |
| `cf-aig-request-timeout` | Per task; fail rather than hang |
| `cf-aig-max-attempts` | `1`; retries are app-controlled |
| `cf-aig-metadata` | Hashed team id, task id and opaque request id only; no user id, email or content |

`cf-aig-collect-log: false` would remove the whole metadata log entry. Prefer `cf-aig-collect-log-payload: false` so latency, tokens, model and status remain observable without Customer Content.

### Errors and plain mapping

| Workers AI / Gateway | HTTP | Internal | Product code |
|---|---:|---:|---|
| Request timeout | 408 | 3007 | `AI_TIMEOUT` |
| Aborted | 408 | 3008 | `AI_TIMEOUT` |
| Request too large | 413 | 3006 | `AI_TOO_LONG` |
| Daily free allocation used | 429 | 3036 | `AI_RATE_LIMIT` |
| Out of capacity / `rejectIfBusy` | 429 | 3040 | `AI_BUSY` |
| Gateway rate limit | 429 | — | `AI_RATE_LIMIT` |
| Model requires Workers Paid | 403 | 5035 | `AI_PROVIDER_ERROR` |
| Invalid model / no such model | 400/404 | 3042/5007 | `AI_PROVIDER_ERROR` |
| JSON Mode not met | 400 | — | `AI_BAD_RESULT` |
| Safety refusal | 200 | — | `AI_REFUSED` |

Every failure releases the reservation and writes no negative ledger row. `AI_BUSY`, `AI_RATE_LIMIT` and `AI_TIMEOUT` are retryable; schema/safety failures are not silently retried.

## Model registry seed

The registry is admin-editable and stores model id, purpose, context, JSON/vision flags, prices, neuron rates and `verified_at`. Prices below are the official unit prices and neuron rates checked on 2026-10-25.

| Model | Purpose | Context | JSON | Vision | Price | Neurons |
|---|---|---:|---|---|---|---|
| `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | Structured primary | 24,000 | Yes | No | $0.293 / $2.253 per M in/out | 26,668 / 204,805 per M in/out |
| `@cf/meta/llama-3.2-3b-instruct` | Cheap plain text | 80,000 | Not listed | No | $0.0509 / $0.335 per M in/out | 4,625 / 30,475 per M in/out |
| `@cf/google/gemma-4-26b-a4b-it` | Vision / plain text | 256,000 | Not listed | Yes | $0.10 / $0.30 per M in/out | 9,091 / 27,273 per M in/out |
| `@cf/meta/llama-3.2-11b-vision-instruct` | Vision alternative | 128,000 | Not listed | Yes | $0.0485 / $0.676 per M in/out | 4,410 / 61,493 per M in/out |
| `@cf/meta/llama-guard-3-8b` | Moderation | 131,072 | Not needed | No | $0.484 / $0.03 per M in/out | 44,003 / 2,730 per M in/out |
| `@cf/black-forest-labs/flux-1-schnell` | Image generation | Prompt max 2,048 | No | No | $0.0000528 / 512 tile + $0.0001056 / step | 4.80 / 512 tile + 9.60 / step |

Notes:

- `@cf/meta/llama-3.1-8b-instruct` is deprecated and has a 7,968-token context. Do not seed it even though it appears in the JSON Mode list.
- `@cf/meta/llama-3.1-8b-instruct-fp8` is the likely cheap structured fallback (32,000 context, $0.152/$0.287), but it is not on the JSON Mode list. Keep it out of the seed and disabled until a live JSON smoke test passes.
- The JSON Mode supported list also names older Hermes/DeepSeek models. They are not default candidates for this product.
- Llama Guard categories are `S1`–`S14`. Its output can be a string or an object; parse both. Store the category, not the raw user text, in the moderation log.
- Llama 3.2 11B Vision requires accepting the Meta licence with an initial `{ "prompt": "agree" }` request. Prefer Gemma 4 for vision unless a benchmark proves otherwise.
- Flux.1 schnell defaults to 4 steps, maximum 8. At 4 steps, one 512×512 tile costs `4.80 + (9.60 × 4) = 43.2` neurons. A 1024×1024 image is four tiles: `(4.80 × 4) + (9.60 × 4 × 4) = 172.8` neurons.

## Credit and cost model

Default: **1 credit = 100 neurons** (`AI_CREDIT_NEURONS=100`). Neurons are the stable unit across text and image models. The published dollar rate is `$0.011 / 1,000 neurons`, so `AI_USD_PER_NEURON=0.000011` is the non-neuron conversion fallback.

For text, prefer provider-reported neurons when present; otherwise:

```text
neurons = input_tokens × input_neurons_per_million / 1_000_000
        + output_tokens × output_neurons_per_million / 1_000_000
credits = ceil(neurons / AI_CREDIT_NEURONS)
```

For Flux:

```text
neurons = 4.80 × tiles + 9.60 × steps × tiles
```

The action estimate reserves `min(ceil(estimate × 1.5), cap)` and settlement uses actual usage, releasing the difference. The estimate is the prompt-token approximation (characters / 3.6, with a counted minimum) plus expected output (60% of the output budget or schema-derived size), times 1.2 for repair headroom, summed over steps. A minimum of 1 credit applies to a completed paid action; failures, refusals and pre-call cancellations are free. The `moderate` task's 0.3-credit target is included in the parent action estimate, not a separate charge. If moderation makes 1-credit actions unprofitable, raise the minimum action price rather than silently dropping moderation.

Examples at Llama 3.3 70B rates:

| Action target | Neurons | Approximate work |
|---:|---:|---|
| 1 credit | 100 | ~1,000 input + ~350 output tokens |
| 5 credits | 500 | ~5,000 input + ~1,800 output tokens |
| 8 credits | 800 | ~10,000 input + ~2,600 output tokens |
| 22 credits | 2,200 | ~20,000 input + ~8,100 output tokens |

These fit the product targets on paper. The 24,000-token context means the five-page target must be split into page/section calls. The image target (5 credits) is conservative: a 1024×1024 Flux image at 4 steps is about 173 neurons, or 2 credits at 100 neurons/credit.

## Privacy and retention

- Workers AI standard inference has zero data retention and does not train on Customer Content. Exceptions include storage the customer enables (R2, KV, Durable Objects, Vectorize), AI Gateway logging/caching, async/batch features, and safety/legal retention.
- AI Gateway logging is an exception and is on by default. We disable payload storage and caching, so Cloudflare should retain only operational metadata (model, tokens, status, latency, cost) for the log retention period.
- AI Gateway logs use Workers Logs for new gateways: 3 days on Workers Free, 7 days on Workers Paid. Do not treat Gateway logs as the product audit trail.
- The product's `ai_payloads` store keeps prompts and outputs for 30 days, then purges. No API tokens, auth secrets, contact-form messages, emails or payment data in payloads. Admin payload views are audited.
- Do not send member emails, contact submissions, auth data or private files to a model. Business facts and site text only.
- If BYOK is added later, the provider terms change and must be re-reviewed. BYOK remains "Coming soon" for now.

## Rate limits and platform backstops

- Workers AI text generation: 300 requests/minute by default; paid-only models: 20 requests/minute on standard Workers AI billing, 50 with prepaid AI Gateway credits.
- Workers AI text-to-image: 720 requests/minute.
- Free allocation: 10,000 neurons/day, reset at 00:00 UTC. The 25 free credits (2,500 neurons) are a product grant, not a separate Cloudflare allocation.
- AI Gateway rate limiting and spend limits return `429` and are eventually consistent. Use them as account-level backstops only; the credits engine and per-team/member limits remain authoritative.
- Our own limits: 6 AI requests/minute per user, 60/hour per team (moderation excluded), plus per-plan daily actions: Free 30, Basic 100, Pro 300, Enterprise 1,000.
- Also enforce per-action caps and a platform daily credit cap with an admin alert. These limits must stay below Cloudflare's account limits.

## Database implications

- Rename `plans.ai_credits_monthly` to `plans.ai_monthly_credits`. Add `plans.ai_daily_actions`. Update seed and app constants from `0/50/200/1000` to `0/100/400/1500`; daily actions are Free `30`, Basic `100`, Pro `300`, Enterprise `1,000`. Free gets a separate one-time 25-credit grant, not a monthly refill.
- The rename touches `supabase/seed.sql`, `apps/web/lib/plans.ts` and the `plans-drift` test. Update the seed column order and the test's fixed column regex together.
- Add `profiles.free_ai_grant_at` (or an idempotent ledger key) so the free grant cannot be claimed twice.
- Add `ai_settings`, `ai_models`, `skill_packs`, immutable `skill_pack_versions`, `credit_buckets`, `credit_reservations`, append-only `credit_ledger`, `credit_member_caps`, `ai_requests`, `ai_payloads`, `ai_feedback` and `ai_usage_daily`.
- Extend `project_settings` with `brand_voice` and `business_facts`; extend `media` with AI flags; keep `logo_dark_url` nullable and unused.
- Add RPCs: `grant_credits`, `ai_reserve`, `ai_settle`, `ai_release`, `expire_credits`, `ai_balance`, `credits_used_in_cycle`.
- Reservations use `select ... for update` on the selected buckets. Settlement is idempotent per reservation. The ledger is immutable (no update/delete), never negative, and records balance after. Expired monthly credits are a bucket expiry, not a negative ledger row.
- RLS uses the existing `security definer` membership helpers. Policies must not read the table they are defined on. Credit writes go through RPCs/service role, not direct browser writes.
- Migration order: add the AI migration after `20261026000400_domain_ops.sql`. The domain migration is still pending on the target database.

## Architecture implications

- `packages/ai/providers`: `AiProvider` interface, Workers AI REST provider, fake provider, error normalisation.
- `packages/ai/registry`: admin model registry and purpose → primary/fallback mapping.
- `packages/ai/tasks`: task registry with Zod input/output schemas, credit target/cap, timeout and model purpose.
- `packages/ai/prompts`: layered system rules, skill pack version, brand voice, business facts, task prompt; prompt manifest with hashes.
- `packages/ai/guards`: Llama Guard moderation, fact guard, sample/claim review, output schema validation and one repair attempt.
- `packages/ai/credits`: reserve/settle/release, cost calculation, bucket expiry and member caps.
- `packages/ai/pipeline`: text and image orchestration, progress events, payload storage.
- `packages/ai/skills`, `packages/ai/eval`, `packages/ai/seed`: skill packs, fixtures, benchmark harness, seed data.
- `apps/web/lib/ai`: server actions, operation polling, template/page/media integration.
- `apps/web/app/api/ai/*`: authenticated server routes. No provider token or raw model call in the browser.
- Long actions (wizard site generation, template fill, bulk SEO, bulk alt text, template generation) run as `ai_requests` operations with progress and polling. Small editor actions can be synchronous within the request timeout.
- Pipeline order: validate input → moderate → reserve → compose prompt → provider → validate JSON → repair once → fact/safety review → settle → store payload → return. On any failure after reserve, release; on partial success, settle only the work done.
- Nothing publishes automatically. Wizard/template/page generation changes the draft only; the user reviews and publishes.
- Kill switch and daily platform cap are checked before reserve. `AI_DISABLED`, `AI_DAILY_CAP` and `AI_NO_CREDITS` never reach the provider.

## Manual verification still required

- Create a Workers AI token and AI Gateway, then run one real JSON call on Llama 3.3 70B. Confirm `response_format`, `usage` fields and the AI Gateway headers.
- Smoke-test JSON Mode on the candidate structured fallback (`llama-3.1-8b-instruct-fp8`) before enabling it for structured tasks. Record pass/fail in `ai_models.verified_at`. Separately check plain-text quality on Llama 3.2 3B and vision/plain-text quality on Gemma 4.
- Run Llama Guard on safe and unsafe prompts. Confirm both string and object output, categories `S1`–`S14`, and the refusal/refund path.
- Generate one Flux image. Confirm base64 output, 512/1024 tile cost, re-encode path and media storage.
- Measure p50/p95 latency and actual token usage for each task. Recalibrate the 1/5/8/22-credit targets and the 24,000-token split strategy.
- Confirm `cf-aig-skip-cache` and `cf-aig-collect-log-payload: false` are honoured, and that Gateway logs contain metadata but no prompt/response text.
- Confirm `rejectIfBusy`, timeout, retry and 429 mappings against a real busy/timeout response.
- Confirm the account token permissions and that no token or prompt appears in app logs or browser payloads.
- Confirm the Free daily allocation and paid-model rate limits in the Cloudflare dashboard.
- Apply the pending domain migration and then the AI migration to the target Supabase project before signed-in AI tests.

## Sources

- [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/) — updated 2026-10-20.
- [Workers AI limits](https://developers.cloudflare.com/workers-ai/platform/limits/) — updated 2026-09-17.
- [Workers AI data usage](https://developers.cloudflare.com/workers-ai/platform/data-usage/) — updated 2026-10-16.
- [Workers AI JSON Mode](https://developers.cloudflare.com/workers-ai/features/json-mode/) — updated 2026-09-14.
- [Workers AI OpenAI compatibility](https://developers.cloudflare.com/workers-ai/configuration/open-ai-compatibility/) — updated 2026-09-18.
- [Workers AI reject busy requests](https://developers.cloudflare.com/workers-ai/features/reject-if-busy/) — updated 2026-09-17.
- [Workers AI errors](https://developers.cloudflare.com/workers-ai/platform/errors/) — updated 2026-09-17.
- [Workers AI REST API](https://developers.cloudflare.com/workers-ai/get-started/rest-api/) — updated 2026-09-15.
- [AI Gateway Workers AI](https://developers.cloudflare.com/ai-gateway/usage/providers/workersai/) — updated 2026-09-17.
- [AI Gateway REST API](https://developers.cloudflare.com/ai-gateway/usage/rest-api/) — updated 2026-10-09.
- [AI Gateway request handling](https://developers.cloudflare.com/ai-gateway/configuration/request-handling/) — updated 2026-09-14.
- [AI Gateway logging](https://developers.cloudflare.com/ai-gateway/observability/logging/) — updated 2026-09-24.
- [AI Gateway caching](https://developers.cloudflare.com/ai-gateway/features/caching/) — updated 2026-09-30.
- [AI Gateway costs](https://developers.cloudflare.com/ai-gateway/observability/costs/) — updated 2026-09-24.
- [AI Gateway pricing](https://developers.cloudflare.com/ai-gateway/reference/pricing/) — updated 2026-10-15.
- [AI Gateway rate limiting](https://developers.cloudflare.com/ai-gateway/features/rate-limiting/) — updated 2026-09-30.
- [AI Gateway spend limits](https://developers.cloudflare.com/ai-gateway/features/spend-limits/) — updated 2026-09-30.
- [AI Gateway authentication](https://developers.cloudflare.com/ai-gateway/configuration/authentication/) — updated 2026-06-17.
- [Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/) — updated 2026-10-12.
- [Llama 3.3 70B](https://developers.cloudflare.com/workers-ai/models/llama-3.3-70b-instruct-fp8-fast/), [Llama 3.2 3B](https://developers.cloudflare.com/workers-ai/models/llama-3.2-3b-instruct/), [Llama 3.1 8B FP8](https://developers.cloudflare.com/workers-ai/models/llama-3.1-8b-instruct-fp8/), [Gemma 4 26B](https://developers.cloudflare.com/workers-ai/models/gemma-4-26b-a4b-it/), [Llama 3.2 11B Vision](https://developers.cloudflare.com/workers-ai/models/llama-3.2-11b-vision-instruct/), [Llama Guard 3 8B](https://developers.cloudflare.com/workers-ai/models/llama-guard-3-8b/), [FLUX.1 schnell](https://developers.cloudflare.com/workers-ai/models/flux-1-schnell/).
