# Get-On context

Get-On (get-on.tech) helps non-technical small business owners create a website quickly. Users sign up, get a personal team, and build websites inside teams.

## Product principles
- Plain language with no jargon
- Mobile-first UX
- Very fast screens
- One obvious next step per screen
- Users should never need hosting or DNS knowledge

## Current stack
- TypeScript strict mode
- Next.js App Router + Tailwind CSS + shadcn/ui-style components
- Supabase Postgres/Auth/RLS via `@supabase/ssr`
- pnpm, ESLint, Prettier, Vitest, Playwright (smoke + axe a11y specs)
- GitHub Actions CI
- `pnpm screenshots` captures UI-spec screens into `docs/screenshots/` at 360, 768, 1024, 1280 and 1440 px in light and dark (`E2E_SCREENSHOTS=1` includes signed-in screens)
- Tailwind runs through the Turbopack loader (`@tailwindcss/turbopack` in `apps/web/next.config.ts`). There is no PostCSS config, so without that rule no utility classes are generated.

## Specs
- `docs/ui-spec.md` - the original specification.
- `docs/ui-spec-app.md` - the dashboard app refresh. It overrides `docs/ui-spec.md` for every `/dashboard` screen except the editor, the wizard and the preview.
- `docs/ui-spec-editor.md` - editor, site look, images library, version history and preview, plus what is still to be built.
- `docs/legal.md` - legal pages setup and the pre-launch checklist.

## Screens
- Landing: `/`, auth: `/signup`, `/login`, `/forgot-password`, `/reset-password`.
- Request a demo: `/request-demo` (also `/contact`, which redirects there).
- Legal: `/terms`, `/privacy`, `/cookies`, `/acceptable-use` (and `/legal`, which redirects to `/terms`).
- Dashboard: `/dashboard` (websites), `/dashboard/plan`, `/dashboard/team`, `/dashboard/account`, and the project area `/dashboard/projects/[projectId]` with `pages`, `pages/[pageId]`, `images` and `settings`.

## Request a demo
- `apps/web/app/request-demo/actions.ts` is the server action. It uses a honeypot field, a signed timing token, optional Turnstile, shared Zod validation and rate limits (3 per hour per IP, 5 per day per email).
- The IP is stored only as a salted hash, using `IP_HASH_SALT`.
- `SUPABASE_SERVICE_ROLE_KEY` is only used server side, to write to `demo_requests` (RLS is on and no policies are exposed to the browser).
- All platform emails go through Amazon SES from team@get-on.tech, otherwise they are logged to the console. `sendEmail` never throws, so a mail outage cannot break the form.
- Turnstile is required as soon as `TURNSTILE_SECRET_KEY` is set.

## Legal pages
- The content lives in `apps/web/lib/legal-content.ts` and the company details in `apps/web/lib/company.ts`.
- `LEGAL_REVIEW_PENDING=true` shows a draft banner and highlights the passages that still need a decision. Passages marked `[[DECISION: ...]]` and values like `[Company legal name]` must be resolved before launch.
- The legal unit test fails in production mode if `LEGAL_REVIEW_PENDING` is `false` while any placeholder is left.

## Dark and light mode (future plugin)
The site design system is prepared for a future "dark-mode" plugin:
- All colours in the renderer come from --s-* variables. No fixed hex/rgb outside tokens in renderer components.
- project_settings.theme has colorMode: 'light' | 'dark' | 'auto' (default 'light'). Only 'light' is honoured now.
- Palettes may include an optional dark object; it is ignored for now.
- Renderer root sets data-color-mode="light" and color-scheme: light; tokens are scoped to .gs-root so overrides can be added later.
- project_settings has logo_dark_url as nullable (unused now).
- Plugin "dark-mode" is registered as status 'planned' conceptually; not shown in UI.

## Database
- Migrations live in `supabase/migrations/` and run in file-name order.
- The membership checks use `security definer` helpers (`user_is_team_member`, `user_has_team_role`, `user_can_access_project`, `user_can_access_page`, `user_shares_team_with`). Policies must never read the table they are defined on, that made Postgres raise 42P17.
- Plans and reserved web addresses are inserted by a migration, not only by `supabase/seed.sql`.
- A database needs every migration applied before the app works. `supabase db push` does it, or paste the files into the Supabase SQL editor in order.

## Custom domains
- Customers keep their DNS. They add one TXT proof record at `_geton-verify.{domain}` and one CNAME per address to `CF_SAAS_CNAME_TARGET`. We never host or edit DNS.
- No provider hostname is created before TXT verification. Cloudflare for SaaS is behind `HostnameProvider`; the fake provider is the development default.
- `switch_now` uses HTTP DCV; `prepare_first` uses TXT DCV so HTTPS can be ready before the CNAME moves.
- One main address per website; other addresses, alias domains and the free address (when enabled) 301 GET/HEAD to it. POST is never redirected. HSTS on customer hosts omits `includeSubDomains` and `preload`.
- KV pointer v2 uses `host:{hostname}` and `site:{siteId}`. Host mappings may carry `planLapsed` so one address pauses without pausing the free address. Keep the old reader for one release and run `pnpm job:migrate-pointers`.
- Domains are Basic and above. Limits come from `plans.custom_domains_per_site`; Free is 0.
- See `docs/domains.md`, `docs/domains-spike.md` and `docs/ui-spec-domains.md`.

## Known gaps
- The page editor shows a live preview of blocks; continue using Pages and Templates to update content and design.
- Signed-in screenshots and the dashboard need a database with every migration applied and email confirmation switched off (or confirmed accounts).

## Templates (added)
- Templates are blueprints copied into websites (no live link). Versions immutable. Apply never publishes.
- Default template (Starter) is always available and protected. Five system templates: Starter, Software company, Law firm, Restaurant, Developer portfolio.
- Personal templates per team with limits; workspaces use the same editor in template mode.
- Sample content is never copied as real business facts; sample claims warn before publishing.
- Plan limits adapted, not bypassed. Restore points for 30 days on replace operations.
- AI hooks only (no AI calls).


## See also
- docs/settings.md
- docs/ui-spec-settings.md


## Website settings core rules
1. Heavy changes never run at the same time on one website (publish, apply template, import, restore, transfer and delete). Read-only jobs do not block.
2. Nothing overwrites without a safety copy. Restore, import (replace/add), template apply, deletion create a safety backup first.
3. Nothing auto-publishes except explicit publish actions and the safe domain auto-publish (only when there are no unfinished changes). Restore/import/transfer change the draft only; live changes only on publish except redirects, pause mode and unpublish.
4. Backups and export files never contain secrets (no keys/tokens/emails/payment data). Contact messages included only when explicitly switched on.
5. Imported files are untrusted: validate structure/size, defend against zip tricks, re-encode pictures, verify PDFs, validate blocks, never execute/trust paths/ids.
6. Transfers move the website only; receiver must accept; limits checked on acceptance.
7. Published pages have no client JavaScript except Google Analytics when the owner enables it (loads first-party script and Google tag only after consent or if "count everyone"). Strict CSP otherwise.
8. Visitor stats are cookie-free and first-party: no IP stored, daily rotating salt, respect DNT/GPC, bots excluded.
9. Every settings page says when a change takes effect ("Applies right away" or "Applies when you publish"); changes needing publish mark unpublished changes.
10. Deleted websites are recoverable for 14 days, then permanently purged; web address held for 30 more days.
