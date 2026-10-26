# Templates

## Rules (invariants)
1. Templates are read-only blueprints. Websites own independent copies. After applying there is no link.
2. Every template version is immutable. Editing a template creates a new version.
3. Applying never publishes. The live website is unchanged until the owner publishes.
4. Applying to an existing website is reversible for 30 days through a restore point (snapshot).
5. Plan limits are met by adapting, not by failing.
6. Sample content is never treated as real business facts. Sensitive items are marked as sample.
7. Editing a template uses the same visual editor through a hidden workspace (template mode). No second editor exists.
8. Every new website gets the default template (Starter). It is always available and cannot be deleted or unpublished.
9. Templates obey renderer rules: blocks from schema v4 only, theme v2 only, no scripts, no third-party requests, no fixed colours outside tokens.
10. AI-ready, not AI-built.

## Package format
See `packages/templates` types.

## Workspace model
Template workspaces are hidden projects of kind `template_workspace`.

## Apply algorithm
See implementation in `packages/templates/plan-application.ts` and `apps/web/lib/templates/apply.ts`.

Modes:
- `full` replaces the theme and every page, after saving a 30-day snapshot.
- `add` keeps the current home page, adds the template's other pages, and applies the template theme. It also saves a snapshot first. Existing paths are kept and a number is added to a clash (`/about` becomes `/about-2`). Links to the template home point at the current home page.
- `design` changes only the theme.
- `pages` replaces pages and keeps the current theme.

Add mode never goes over the plan page limit. If the website does not have room, apply stops with `PAGE_LIMIT` and the UI links to plans.

## Sample detection
See `packages/templates/sample.ts`.

## Art pipeline
`pnpm build:template-art` generates original WebP artwork into `packages/templates/assets/{template}/`.
