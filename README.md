# Get-On

Get-On helps non-technical small business owners create a website quickly. Users sign up, get a personal team, and build websites inside teams.

This repository contains the app: Next.js web app, Supabase schema and migrations, landing and auth pages, the dashboard, the 6-step website wizard, the project area, publishing to `{name}.get-on.tech`, the report and admin moderation flows, and the legal pages.

## Documentation
- `docs/ui-spec.md` - the original UI specification (scaffolding, auth, landing, dashboard, wizard, project area).
- `docs/ui-spec-app.md` - the dashboard app refresh. It overrides `docs/ui-spec.md` for every `/dashboard` screen except the editor, the wizard and the preview.
- `docs/ui-spec-editor.md` - the visual editor, site look, images library, version history and preview, plus what is still to be built.
- `docs/ui-spec-publish.md` - publishing, public site pages, safety/moderation, the report page and the admin console.
- `docs/legal.md` - legal pages setup, company details, review markers and the pre-launch checklist.
- `docs/screenshots/` - the UI at 360, 768, 1024, 1280 and 1440 px wide, in light and dark.

## Prerequisites
- Node.js 22+
- pnpm 12+
- Docker Desktop (for local Supabase)
- Supabase CLI (`npm i -g supabase`)

## Repository layout
- `apps/web` - Next.js web app
- `packages/blocks` - block schemas, types and starter content
- `packages/renderer` - the page renderer used by the site output
- `packages/publisher` - turns a project into the static files for a published site
- `packages/site-server` - shared request handling for published sites (Worker and local Node)
- `apps/sites-worker` - the Cloudflare Worker for `*.get-on.tech`
- `supabase` - local Supabase config, migrations, seed, SQL tests
- `docs` - specifications and screenshots

## First-time setup
1. Copy env file:
   ```bash
   cp .env.example apps/web/.env.local
   ```
2. Fill all variables in `apps/web/.env.local`:
   - `NEXT_PUBLIC_SITE_URL`: app URL (local default: `http://localhost:3000`)
   - `NEXT_PUBLIC_SUPABASE_URL`: local or hosted Supabase URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: anon key for that Supabase project
   - `SUPABASE_SERVICE_ROLE_KEY`: service role key, only used on the server for demo requests, publishing and the admin console
   - `NEXT_PUBLIC_ENABLE_GOOGLE_AUTH`: `true` to show Google auth button
   - `SUPPORT_EMAIL`: support mailbox for help panel
   - `SUPPORT_WHATSAPP_NUMBER`: WhatsApp number in international format, no `+`
   - `PLAYWRIGHT_BASE_URL`: URL used by Playwright
   - `E2E_ENABLE_SIGNUP`: set to `1` to run signup smoke flow

   Request-a-demo (see `apps/web/.env.example` for the full list):
   - `IP_HASH_SALT`: salt used to hash the visitor IP for rate limiting
   - `FORM_TOKEN_SECRET`: secret used to sign the form timing token
   - `RESEND_API_KEY`: Resend API key for the notification emails. Without it the emails are logged to the console instead
   - `EMAIL_FROM`: the from address for those emails
   - `TURNSTILE_SECRET_KEY` and `NEXT_PUBLIC_TURNSTILE_SITE_KEY`: Cloudflare Turnstile keys. When the secret is set, the form must pass Turnstile
   - `NEXT_PUBLIC_COOKIE_CONSENT`: set to `true` to show the cookie notice

   Publishing (see `apps/web/.env.example` for the full list):
   - `PUBLISH_STORE`: `local` (default) builds into `.local-sites`; `cloudflare` uploads to R2 and KV
   - `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_KV_NAMESPACE_ID`, `CLOUDFLARE_R2_BUCKET`: needed for `cloudflare`
   - `ROOT_DOMAIN`: the live root domain, default `get-on.tech`
   - `ADMIN_EMAILS`: comma-separated emails allowed into `/admin`; empty disables it
   - `ABUSE_EMAIL`: where report notifications and abuse contacts go

   Legal pages:
   - `COMPANY_NAME`, `LEGAL_ENTITY`, `COMPANY_COUNTRY`, `COMPANY_ADDRESS`: the company details shown in the legal pages
   - `PRIVACY_EMAIL`, `ABUSE_EMAIL`: contact addresses for the legal pages
   - `LEGAL_EFFECTIVE_DATE`: the date shown on the legal pages
   - `LEGAL_REVIEW_PENDING`: keep at `true` until a lawyer has reviewed the marked passages. It shows a draft banner and highlights the passages that still need a decision

3. Install deps:
   ```bash
   pnpm approve-builds --all
   pnpm install
   ```

## Run Supabase locally
```bash
supabase start
supabase db reset
```

- `supabase db reset` applies migrations and `supabase/seed.sql`.
- Local Studio runs at `http://127.0.0.1:54323` by default.

## Apply the database to a hosted project
The app needs every migration in `supabase/migrations/`, in file-name order. Pick one:
```bash
supabase link --project-ref <project-ref>
supabase db push
```
or paste the migration files into the Supabase SQL editor, one file at a time, in order.

- The plans and the reserved web addresses are inserted by a migration, so the list is complete after the push.
- The row level security policies call `security definer` helpers. A policy must never read the table it is defined on, that makes Postgres raise `42P17 infinite recursion detected in policy`.
- Turn off "Confirm email" in the Supabase dashboard for local work, otherwise a new account has no session and the dashboard cannot be reached.

## Run the app
```bash
pnpm dev
```
Open `http://localhost:3000`.

To work on published sites locally:
```bash
pnpm dev:all
```
This starts the app and the local site server at `http://localhost:8787`, serving `{name}.localhost`. `pnpm seed:site` creates a sample published site at `rosebakery.localhost:8787`. Without Cloudflare credentials, publishing writes to `.local-sites/`.

## Publishing setup (manual, before launch)
1. Apply every migration, including `20261022000300_publishing.sql`.
2. Create the R2 bucket and KV namespace, then put their names/ids and a scoped API token in the environment.
3. Add the wildcard DNS record and route for `*.get-on.tech`, then deploy the Worker:
   ```bash
   pnpm --filter @get-on/sites-worker deploy
   ```
4. Register `get-on.tech` with the Public Suffix List so each website gets browser isolation.
5. Set `ADMIN_EMAILS` and `ABUSE_EMAIL`.
6. Check that the R2 REST upload keeps the `Content-Type` header the adapter sends. The adapter also verifies `index.html` by reading it back.

## Scripts
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `pnpm test:e2e` (set `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` if browsers cannot download)
- `pnpm screenshots` (captures `docs/screenshots/` at 360 to 1440 px in light and dark; add `E2E_SCREENSHOTS=1` for signed-in screens, plus `E2E_ADMIN_EMAIL` and `E2E_ADMIN_PASSWORD` for the admin screens)
- `pnpm dev:all` (app plus the local published-site server)
- `pnpm seed:site` (create the local `rosebakery` sample site)

## Tests
Unit tests (WCAG AA contrast, plan/seed drift, block schemas, demo request validation, spam checks, publishing, moderation, admin access and legal content):
```bash
pnpm test
```

RLS SQL test:
```bash
supabase db test supabase/tests/rls.sql
```

Playwright smoke + a11y suite (axe, 360px overflow, spec copy, hit areas; requires app running):
```bash
pnpm test:e2e
```

Signup flow test (requires app + Supabase running):
```bash
E2E_ENABLE_SIGNUP=1 pnpm test:e2e
```

## CI
`.github/workflows/ci.yml` runs install, lint, typecheck, unit tests and build on every pull request.

## Status
The visual editor is the remaining piece of work. The blocks and renderer packages exist, and the editor route shows what is on a page, but the canvas, inspector, version history and the public site preview are not built yet. See `docs/ui-spec-editor.md`.

The dashboard, the wizard, publishing, the local site server, the Cloudflare Worker, the report flow, the admin console, the request-a-demo form and the legal pages are built. The legal copy still carries `[[DECISION: ...]]` markers and placeholders, and `docs/legal.md` lists what has to be decided before launch.
