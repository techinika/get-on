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
- `pnpm screenshots` captures UI-spec screens into `docs/screenshots/` (`E2E_SCREENSHOTS=1` includes signed-in screens)
