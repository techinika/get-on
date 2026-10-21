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

## Dark and light mode (future plugin)
The site design system is prepared for a future "dark-mode" plugin:
- All colours in the renderer come from --s-* variables. No fixed hex/rgb outside tokens in renderer components.
- project_settings.theme has colorMode: 'light' | 'dark' | 'auto' (default 'light'). Only 'light' is honoured now.
- Palettes may include an optional dark object; it is ignored for now.
- Renderer root sets data-color-mode="light" and color-scheme: light; tokens are scoped to .gs-root so overrides can be added later.
- project_settings has logo_dark_url as nullable (unused now).
- Plugin "dark-mode" is registered as status 'planned' conceptually; not shown in UI.
