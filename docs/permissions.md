# Permissions

All role checks go through `packages/permissions/matrix.ts` (`can`) and SQL `team_can(team_id, action)`. No ad hoc role checks.

See `packages/permissions/matrix.ts` for the full matrix.
