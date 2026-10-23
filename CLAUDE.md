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

## Known gaps
- The visual editor is a placeholder: the blocks and renderer packages exist, but there is no canvas, inspector, version history UI or public site route yet.
- Signed-in screenshots and the dashboard need a database with every migration applied and email confirmation switched off (or confirmed accounts).
