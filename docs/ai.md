# AI generation

Status: foundation in progress. The provider adapter, credit maths, prompt composer, database schema, text and section pipelines, image generation and the credit/payload jobs exist. The AI UI, admin console, evaluation runner and the remaining generation tasks are still to be built.

## Invariants

1. AI is optional. Every AI action keeps a manual alternative.
2. AI writes the draft only. Nothing is published automatically.
3. AI changes are undoable. Applying generated text creates one editor undo step.
4. Credits are checked and reserved before a paid model call.
5. Failures, refusals and pre-call cancellations are free.
6. User text is moderated before credits are reserved.
7. Output is validated and screened before it can be applied.
8. Only the minimum website data needed is sent to a model. Contact messages, subscribers, visitor stats, passwords and payment data are never sent.
9. Prompts and responses are not stored by AI Gateway. The product keeps its own payloads for 30 days.
10. The model registry is admin-editable. Feature code never hardcodes a model id.
11. AI Gateway is the only path to a model. Caching and payload logging are off.
12. Plain language: never show “token”, “prompt”, “model”, “neuron”, “schema”, “JSON” or “LLM” in normal UI.

## Where things live

- `packages/ai` — provider interface, fake provider, model registry, credit maths, task registry, prompt composer, errors and types.
- `apps/web/lib/ai` — runtime config, Workers AI adapter, provider factory, settings/skills loaders, guards, text pipeline and server action.
- `supabase/migrations/20261027000100_ai_platform.sql` — tables, RPCs, RLS, triggers, settings row and model seeds.
- `supabase/migrations/20261027000200_ai_usage_rpc.sql` — atomic daily usage recording.
- `docs/ai-spike.md` — Phase 0 research and manual verification checklist.
- `docs/ai-prompts.md` — prompt layers and composer rules.
- `docs/credits.md` — units, formulas, buckets, ledger and caps.
- `docs/skill-packs.md` — pack format and lifecycle.
- `docs/ui-spec-ai.md` — authoritative UI specification.

## Provider

`WorkersAiProvider` calls Cloudflare through AI Gateway:

- Text: `POST /accounts/{account_id}/ai/v1/chat/completions`.
- Image and Llama Guard: `POST /accounts/{account_id}/ai/run`.
- Required headers: `Authorization`, `cf-aig-gateway-id`, `cf-aig-skip-cache: true`, `cf-aig-collect-log-payload: false`, `cf-aig-max-attempts: 1`, `cf-aig-request-timeout`.
- Optional metadata: hashed team id, task id and opaque request id. No user id, email or content.
- `response_format` is sent only when the caller supplies a JSON schema and the selected model supports JSON.
- Provider errors map to `AI_*` codes in `packages/ai/src/errors.ts`.

`FakeAiProvider` is the development and test default. It is deterministic from a hash of the input and supports invalid JSON, schema violation, over-length, invented facts, injection compliance, timeout, rate limit, refusal, partial and slow modes.

Environment variables:

```dotenv
AI_PROVIDER=fake            # fake | workers-ai
AI_ENABLED=true
CF_AI_ACCOUNT_ID=
CF_AI_API_TOKEN=
AI_GATEWAY_ID=
AI_CREDIT_NEURONS=100
AI_DAILY_CAP_CREDITS=5000
AI_IMAGES_ENABLED=false
AI_USD_PER_NEURON=0.000011
```

`ai_settings.gateway_id` overrides `AI_GATEWAY_ID` when set. The database settings are authoritative for credit unit, daily cap, free grant, moderation, images, retention and language.

## Pipeline

`runTask` in `apps/web/lib/ai/pipeline.ts` currently handles text tasks:

1. Check the global switch and database settings.
2. Check team membership and editor-or-higher role.
3. Verify the website belongs to the team.
4. Check 6 requests/minute per user and 60/hour per team.
5. Check the plan's daily action limit and the platform daily credit cap.
6. Grant the one-time Free credits once per account.
7. Select a model from the registry.
8. Load writing style, business facts and active skill packs.
9. Compose the prompt and enforce the prompt-character limit.
10. Estimate credits and create an `ai_requests` row.
11. Moderate the input with Llama Guard.
12. Reserve credits through `ai_reserve`.
13. Call the provider.
14. Sanitise and screen the output; moderate it again when the task asks.
15. Settle actual usage, or release the reservation on failure.
16. Store the payload for 30 days and record daily usage.

The pipeline never writes to a page or publishes. The caller applies the result.

## Current text tasks

- `text.write`
- `text.improve`
- `list.expand`
- `seo.write`
- `profile.write`
- `design.suggest`

`section.generate` is the first structured task. It uses strict JSON mode, Zod validation and one repair call. `image.generate` is implemented with input moderation, credit reservation, provider generation, server-side re-encoding and media storage. The other structured tasks (`site.generate`, `template.fill`, `template.generate`, `page.generate`, `alt.describe`, `repair`) still need their task runners and schemas. `tips.fix` is deterministic and does not call a model.

## Credits

See `docs/credits.md`. The short version:

- 1 credit = 100 neurons.
- Text usage comes from provider `usage` and registry neuron rates.
- Images use `4.80 × tiles + 9.60 × steps × tiles`.
- Reserve `min(ceil(estimate × 1.5), cap)`.
- Settle the real amount, with a minimum of 1 credit for a completed paid action.
- `ai_requests` and `credit_ledger` are the audit trail.
- Monthly credits last until the end of the following month.
- Free gets a one-time 25-credit grant and no monthly refill.

## Database

Main tables: `ai_settings`, `ai_models`, `skill_packs`, `skill_pack_versions`, `ai_requests`, `credit_buckets`, `credit_reservations`, `credit_ledger`, `credit_member_caps`, `ai_payloads`, `ai_feedback`, `ai_usage_daily` and the `ai_usage_platform_daily` view.

RPCs: `ai_available`, `ai_balance`, `credits_used_in_cycle`, `grant_credits`, `ai_reserve`, `ai_settle`, `ai_release`, `expire_credits` and `ai_record_usage`.

RLS:

- Team members can read their team's buckets, ledger, requests, feedback and daily usage.
- Owners and admins manage member caps.
- Viewers cannot start AI actions.
- `ai_settings`, `ai_models`, skill packs, reservations and payloads are server-only.

The AI migration follows `20261026000400_domain_ops.sql`. Both migrations still need applying to the target Supabase project.

Jobs: `pnpm job:ai` grants monthly credits, expires old buckets and purges payloads. See `docs/credits.md`.

## Safety and review

- Llama Guard runs before spending credits.
- Output is sanitised, checked for empty output, injection compliance and suspicious claims.
- Suspicious claims mark the request `partial`; the UI must ask the user to keep or remove each flagged claim.
- Refusals are recorded without a charge.
- Admin kill switch and platform daily cap are enforced before a request is created.

## Testing

- `pnpm --filter @get-on/ai test`
- `pnpm --filter @get-on/ai typecheck`
- `pnpm --filter web test`
- `pnpm --filter web typecheck`
- `pnpm --filter web lint`

Live Workers AI, JSON-mode, moderation, image and latency checks remain manual because no Cloudflare credentials are available in this environment. See `docs/ai-spike.md`.
