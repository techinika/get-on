# Get-On bootstrap

Get-On is a website builder for small businesses. This repository currently includes the foundation: app scaffolding, auth, core database schema, landing page, and an empty dashboard.

## Prerequisites
- Node.js 22+
- pnpm 12+
- Docker Desktop (for local Supabase)
- Supabase CLI (`npm i -g supabase`)

## Repository layout
- `apps/web` - Next.js web app
- `supabase` - local Supabase config, migrations, seed, SQL tests
- `docs` - supporting docs

## First-time setup
1. Copy env file:
   ```bash
   cp .env.example apps/web/.env.local
   ```
2. Fill all variables in `apps/web/.env.local`:
   - `NEXT_PUBLIC_SITE_URL`: app URL (local default: `http://localhost:3000`)
   - `NEXT_PUBLIC_SUPABASE_URL`: local or hosted Supabase URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: anon key for that Supabase project
   - `NEXT_PUBLIC_ENABLE_GOOGLE_AUTH`: `true` to show Google auth button
   - `SUPPORT_EMAIL`: support mailbox for help panel
   - `SUPPORT_WHATSAPP_NUMBER`: WhatsApp number in international format, no `+`
   - `PLAYWRIGHT_BASE_URL`: URL used by Playwright
   - `E2E_ENABLE_SIGNUP`: set to `1` to run signup smoke flow

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

## Run the app
```bash
pnpm dev
```
Open `http://localhost:3000`.

## Scripts
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `pnpm test:e2e`

## Tests
Unit tests:
```bash
pnpm test
```

RLS SQL test:
```bash
supabase db test supabase/tests/rls.sql
```

Playwright smoke test (requires app + Supabase running):
```bash
E2E_ENABLE_SIGNUP=1 pnpm test:e2e
```

## CI
`.github/workflows/ci.yml` runs install, lint, typecheck, unit tests and build on every pull request.
