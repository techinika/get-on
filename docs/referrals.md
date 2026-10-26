# Referrals

## Links and codes
Every profile has an 8-character referral code. A member shares `{site}/signup?ref={code}` or a published website's subdomain.

The `gs_ref` cookie is set for 30 days on `/`, `/signup` and `/login` when a valid `ref` is present. On sign-up the server:
1. Rejects disposable email domains, self-referrals, unknown codes and a disabled programme.
2. Stores only salted hashes of the IP, user agent and email.
3. Records the referral as `signed_up`, or `held` when the referrer is over the monthly cap or daily velocity limit.
4. Sets `profiles.referred_by` once.

## Qualification
A friend counts after they confirm their email and publish a website, and after `qualify_hours` (default 24) so fraud checks can run. The `job:referrals-qualify` job moves `published` to `qualified` and awards rewards.

## Ladder (current proposals)
| Friends | Reward |
|---|---|
| 1 | 25 AI credits |
| 3 | 1,000 extra emails |
| 5 | 1 free month |
| 10 | 3 free months and a permanent +10% AI monthly credits |

The referred friend gets 10 welcome AI credits when they qualify. Values live in `referral_ladder` and `referral_settings`, never in feature code.

## Claiming and records
Rewards are not used until the member claims them. Each reward has `claim_status` (`unclaimed`, `claimed`, `revoked`). Claiming AI credits calls `grant_credits` with the idempotent source `referral:{rewardId}` and then `claim_referral_reward`.

`referral_reward_events` is append-only and keeps every `received`, `claimed`, `revoked` and `expired` record. Never delete a reward or its history to "clean up"; mark it revoked instead.

Other reward types are entitlements. Claiming marks them saved for the account until billing or email support applies them.

## Anti-abuse
- Disposable email domains are blocked.
- Self-referrals are blocked.
- Monthly cap (default 50) and daily velocity hold (default 5) are checked at sign-up.
- Held referrals wait for a person to review them in `/admin/referrals`.
- Support can reject or revoke with a reason. Every change is audited.
- Referral emails only come from `team@get-on.tech`.

## Jobs
- `pnpm job:referrals-qualify` qualifies due referrals and creates rewards.
- `pnpm job:deleted-purge` keeps activity and reward history.
