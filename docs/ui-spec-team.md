# Get-On UI Specification - Team, invitations, activity and referrals

This document replaces the Team page, project Activity, Recently deleted, template apply Step 1 and Invite and earn sections of `docs/ui-spec-app.md` and `docs/ui-spec.md`.

## 1. Team page `/dashboard/team`

- Container: default (960). Header: breadcrumb `{team name} / Team`, title "Team", description "People who can work on {team name}."
- Seats card: `{active members + pending invitations} of {limit}`. Free and Basic show 1, Pro 5, Enterprise "Unlimited". Text explains that a pending invitation uses a seat and a paused member does not.
- Members list: avatar, name, email for owners/admins, role badge, "You" badge, joined date. Paused members show a "Paused" badge and no access.
- Role control: Owner/Admin/Editor/Viewer. Changing a role opens a ConfirmDialog. Only owners and admins see it. The owner row never has a role control or Remove.
- Remove: 44 px menu; only shown when the current user can remove that member. ConfirmDialog says access ends immediately and their work stays. Owners cannot be removed.
- Leave team: shown on your own row when you are not the owner. ConfirmDialog warns that you lose access until invited again.
- Invitations: pending rows show email, role, sent time, expiry, and Resend (once per 24 hours) and Cancel. If the email could not be sent, show the copyable invitation link and a plain explanation. Never show a raw token, hash, prompt, model or JSON.
- Invite form: emails (one per line or comma), role, optional short message. Validate addresses before sending. Show a friendly error for duplicates, seat limits, disposable or invalid addresses, and rate limits. Never silently drop an address.
- Transfer ownership: owners only, and not on a personal team. ConfirmDialog requires typing the new owner's email. After transfer you become an Admin.
- Team details: team name with Save. Shows "Applies right away".
- Permission table: one table generated from the shared permission matrix. Columns Owner, Admin, Editor, Viewer. Rows grouped as Websites, Pages and design, Templates and AI, Team, Plan and referrals.
- Empty states: "It is just you for now" with the invite form; "No invitations waiting" for the list.
- Mobile: one column, role control and menu wrap below the member details, all tap targets at least 44 px.

## 2. Invitation page `/invite/[token]`

- `noindex`. Shows the team name, inviter name, role and expiry.
- Signed out: explains that they need an account with the invited email. Buttons "Create account" and "Log in", both preserving the invitation.
- Signed in with a different email: "This invitation is for {email}" with Log out.
- Email not verified: ask them to verify first.
- Valid: "Join {team}" and "Not now". Accept adds the member, sets the current team and opens `/dashboard`. Decline marks the invitation declined and shows a short confirmation.
- Expired, cancelled, already accepted, seat full or already a member: one plain message and a link to `/dashboard`.
- The link is a credential. Do not log it, include it in analytics, or put it in a URL that is sent to a third party.

## 3. Team activity `/dashboard/team/activity`

- Owners and admins only. Editors and viewers are redirected to `/dashboard`.
- Header: "Activity", description "Everything that has happened in {team name}."
- Filters: category chips (All, Websites, Pages, Design, Pictures, Settings, Domains, Plugins, Templates, Backups, AI, People, Security); website; person (including System); date (7, 30, 90 days, all); search. Filters update without a full reload and are reflected in the URL.
- Rows: summary, actor name or "Former member", relative time, website name when relevant. Coalesced rows show "N times" and the latest time.
- Detail: opens a panel with every recorded field and the extra details as a definition list. No raw JSON, ids, IP addresses or email bodies.
- Pagination: 50 rows per page, "Newer" and "Older". Keep filters.
- Export: owners and admins can download CSV. Escape spreadsheet formulas, include a UTF-8 BOM, and never include secrets.
- Deleted websites keep their history. Rows for deleted websites show a "Deleted" badge and link to Recently deleted when the viewer can restore.
- Empty: "Nothing has happened yet." with a note that history is kept for 730 days.
- Loading: skeleton rows, not a spinner-only screen. Reduced motion respected.

## 4. Project Activity

- The project Settings > Activity screen uses the same team activity data filtered to one website. It shows the same rows, detail panel and empty state, without team-wide filters.
- Owners, admins and editors can read project activity; viewers cannot.
- It survives website deletion and shows a "Deleted" note.

## 5. Recently deleted `/dashboard`

- A section below the website list, visible only when at least one website is deleted.
- Each row: name, `{subdomain}.get-on.tech`, "deleted {time}", "{n} days left". Deleted websites never count toward any plan limit.
- Restore: owners and admins. Before restoring, check plan room, page limit and the 14-day window. If there is no room, explain what to do (delete another website or upgrade). After restore, show the website in the list and a success message.
- Other roles see "Ask an owner or admin to restore it."
- After 14 days the website is removed for good and the web address is held for 30 more days. The row disappears; history stays in Activity.
- The section never exposes a deleted website in search, quick find, the website switcher or any usage count.

## 6. Template apply, Step 1

- Step 1 asks only what the template needs: which website, and whether to replace or add pages. It shows the plan limits that will apply and warns before replacing anything.
- Replacing creates a safety backup first and says so. Applying never publishes.
- Sample content is labelled as sample. Any sample claim warns before publishing.
- If the template needs a bigger plan, show the limit and a link to plans. Never bypass a plan limit.
- Buttons: "Back", "Continue". One obvious next step.

## 7. Invite and earn `/dashboard/invite`

- Owners, admins, editors and viewers can use referrals. Viewers cannot start AI actions.
- Header: "Invite and earn", description about inviting another business owner.
- Invite link card: the personal link `{site}/signup?ref={code}`, the code in plain text, and a Copy link button with a 2 second "Copied" state. Never show the code as a secret.
- Summary: friends who joined (qualified), friends waiting to publish, rewards ready to claim.
- Ladder: one row per active milestone with label, progress and "Reached". Plain language only.
- Rewards to claim: label such as "25 AI credits", "1,000 extra emails", "1 free month", "+10% extra AI credits every month". Each row has received time and a Claim button.
- Claiming AI credits adds them straight away and shows the new balance on the dashboard. Other rewards are marked "Saved. We will apply this to your account." Never claim a reward twice.
- Reward history: every received, claimed, revoked and expired record, newest first, with relative time. Keep these records even when a reward is used.
- How it works: three numbered steps. Mention the monthly cap and the manual check when many friends join the same day. Link to the programme rules in Terms.
- Empty: "Nothing waiting" with an explanation that rewards appear after a friend publishes.
- Mobile: link card stacks, code scrolls horizontally without breaking layout, buttons at least 44 px.

## 8. Programme rules (shown in plain language)

- A friend counts after they create an account, confirm their email and publish a website. Accounts on disposable email domains do not count. Self-referrals do not count.
- Values and caps are set by the team and may change. The current values are shown on the page.
- Rewards must be claimed before they are used. The record of what was received and claimed is kept.
- Abuse, fake accounts or duplicate accounts cancel rewards. Support can hold or revoke a referral with a reason.
- Referral emails are only sent by Get-On from `team@get-on.tech`.

## 9. Shared behaviour

- Every page uses the persistent shell and follows the seamless behaviour requirements in `docs/ui-spec-app.md` Section 7.
- 44 px tap targets, visible focus, reduced motion, 360 px minimum width, light and dark dashboard, AA contrast.
- No jargon. Never show token, prompt, model, neuron, schema, JSON or LLM in normal UI.
- Empty states have one obvious next step. Errors say what happened and what to do next.
- All mutations are server actions with permission checks, rate limits, friendly errors and activity logging.
- Nothing on these screens publishes a website or changes a live site except the explicit publish action.
