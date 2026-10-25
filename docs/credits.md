# AI credits

## Unit

- 1 credit = 100 neurons (`AI_CREDIT_NEURONS`).
- Cloudflare publishes $0.011 per 1,000 neurons. `AI_USD_PER_NEURON=0.000011` is the fallback dollar conversion only.
- Neurons are the stable unit across text and image models.

## Text cost

```
inputNeurons  = inputTokens  × neuronsPerMInput  / 1,000,000
outputNeurons = outputTokens × neuronsPerMOutput / 1,000,000
credits       = ceil((inputNeurons + outputNeurons) / 100)
```

Provider-reported `usage` is the billing source. If the provider reports neurons directly, use those.

## Image cost

```
tiles   = ceil(width / 512) × ceil(height / 512)
neurons = 4.80 × tiles + 9.60 × steps × tiles
```

Examples:

- 512×512 at 4 steps = 43.2 neurons.
- 1024×1024 at 4 steps = 172.8 neurons.

## Estimate and reserve

```
estimate = promptTokens × inputRate
         + expectedOutputTokens × outputRate
         × 1.2 repair headroom
reserve  = min(ceil(estimate × 1.5), task cap)
```

- Prompt tokens are approximated as characters / 3.6, with a counted minimum.
- Expected output is 60% of the output budget or the schema-derived size.
- A completed paid action costs at least 1 credit.
- Failures, refusals and pre-call cancellations cost 0.
- `moderate` is part of the parent action estimate, not a separate charge.
- Settlement uses real usage and releases the unused reservation.

## Buckets

| Kind | Meaning |
| --- | --- |
| `free_grant` | One-time 25 credits for a new account |
| `monthly` | Plan refill |
| `referral` | Referral reward |
| `bonus` | Promotion or support credit |
| `purchase` | Bought credits |
| `admin` | Manual grant or adjustment |

`credit_buckets.available = amount_remaining - amount_reserved`.

Reservation order: earliest expiry first, non-expiring last, then monthly, referral, bonus, purchase, admin, free grant.

## Ledger

`credit_ledger` is append-only. A trigger blocks update and delete.

- `grant` is positive.
- `reserve` is a 0-credit hold entry with the post-hold balance.
- `settle` is negative actual usage.
- `release` is positive unused credit.
- `expire` is negative expired credit.
- `adjust` is a manual correction.

Every row has a plain-language summary and a `balance_after` value that excludes reserved credits.

## Plan values

| Plan | Monthly credits | Daily actions |
| --- | ---: | ---: |
| Free | 0 | 30 |
| Basic | 100 | 100 |
| Pro | 400 | 300 |
| Enterprise | 1,500 | 1,000 |

Free also gets the separate one-time 25-credit grant. It does not refill.

## Expiry

- Monthly grants run on the first day of the month UTC.
- Monthly credits expire at the end of the following month.
- Non-expiring buckets have `expires_at = null`.
- `expire_credits()` is a service-role job.

## Caps

- Per request: the task cap in `packages/ai/src/tasks/registry.ts`.
- Per member: optional `credit_member_caps.monthly_credits`.
- Per team per day: `plans.ai_daily_actions`.
- Platform per day: `ai_settings.daily_cap_credits`.
- Provider: Workers AI and AI Gateway limits are backstops, not billing controls.

## Free grant

`profiles.free_ai_grant_at` claims the one-time grant before `grant_credits` runs. The source key is `free:{userId}`. If the grant fails, the claim is reset.

## Still to build

- Monthly grant job.
- Expiry job.
- Referral and purchase hooks.
- Credit calibration against real usage.
- AI credits page and admin credit tools.
