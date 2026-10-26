# Team

## Roles
Owner, Admin, Editor, Viewer. The permission matrix in `packages/permissions` is the only source of truth. The database mirrors it in `permission_matrix` and `team_can`.

- Owner: one per team, cannot be removed or paused, only the owner can transfer ownership.
- Admin: manages people, websites and settings, but cannot change the owner or the plan.
- Editor: edits pages and designs and publishes, but cannot manage people or billing.
- Viewer: read-only, cannot start AI actions.

## Seats
Seats are active members plus pending invitations. Paused members do not use a seat and cannot access the team.

| Plan | Seats |
|---|---|
| Free | 1 |
| Basic | 1 |
| Pro | 5 |
| Enterprise | Unlimited |

The database trigger rejects a new invitation when the team is full (`SEATS_FULL`). Downgrades call `enforce_seat_plan`, which pauses members beyond the limit except the owner. Upgrades call `restore_seat_plan` to bring paused members back.

## Invitations
- Created by owners and admins only.
- Email addresses are normalised and must not already be a member or have a pending invitation.
- Tokens are random, single use, stored only as an HMAC-SHA256 hash with `INVITE_TOKEN_PEPPER`.
- Expire after 7 days. Resend is allowed once per 24 hours and extends the expiry.
- The invited email must match the signed-in account and be verified before accepting.
- A pending invitation uses a seat. Cancel or expiry releases it.
- Invitation emails use `team_invite` and are critical; failures keep the copyable link visible.

## Website transfers
Owners and admins can send a website to someone outside the team. The link is random, single use, stored as an HMAC-SHA256 hash and expires after 7 days. The receiver must sign in with the email address on the transfer, choose a team they own or manage, and accept. Limits are checked at acceptance, not when the link is sent. Accepting never publishes. A transfer in progress is cancelled if the website is moved, deleted or the sender cancels it. Expired transfers are marked by `job:transfers-expire`.

## Ownership
Transfer requires the owner to type the new owner's email. The new owner must already be a member. The old owner becomes an Admin. Personal teams cannot transfer ownership until they are made a normal team.

## Leaving and removal
Removal ends access immediately and keeps all work. The removed person is shown as "Former member" in activity. The owner cannot leave without transferring ownership first.

## Support access
Support may change a team plan with a written reason. Every change writes `admin_audit_log` and team activity. Support never impersonates a member.
