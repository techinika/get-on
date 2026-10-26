# Permissions

All role checks go through `packages/permissions/src/matrix.ts` (`can`, `canActOn`) and the SQL function `team_can(team_id, action)`. Never check a role string directly in a feature.

## Matrix
The TypeScript matrix generates `packages/permissions/matrix.json`, which the Team page renders. The database stores the same rows in `permission_matrix` and policies call `team_can`.

Groups:
- Websites: view, create, delete, restore, purge, transfer.
- Pages and design: edit, publish, settings, domains, plugins, backups, messages.
- Templates and AI: use, manage, delete, AI use, AI limits, full AI ledger.
- Team: view, invite admins/members, change admin/member roles, remove admins/members, rename, transfer, leave, activity.
- Plan and referrals: view, manage, use referrals.

## Rules
- The owner passes every action.
- Admins pass everything except owner-only actions (transfer, plan management, owner role).
- Editors edit and publish but never manage people, billing or domains.
- Viewers read only and cannot start AI actions.
- Acting on an admin requires `team.role.admin` or `team.remove.admin`; acting on a member requires the member variants.
- A paused member fails `team_can` and cannot read or change anything.
- `team_can` must not read the table used by the policy that calls it. Use the security-definer helpers to avoid 42P17.
