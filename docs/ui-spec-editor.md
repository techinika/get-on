For the editor,  overrides this file where they conflict.

For the editor,  overrides this file where they conflict.

# Get-On UI Specification v1 - Editor

This document covers the Visual page editor, site look, images library, version history and preview. It extends `docs/ui-spec.md` (app scaffolding, auth, landing, dashboard, wizard, project area) and `docs/ui-spec-app.md` (the dashboard app refresh, which takes precedence for every `/dashboard` screen except the editor, the wizard and the preview).

The editor is the one part of the product that is **not finished**. This document records both the intended behaviour and the state of the build today, so the gap is explicit.

## Intended behaviour

### Editor screen

- Top bar: back link to the project, page title, page path, and a device switcher (phone / tablet / computer).
- Canvas: the page blocks rendered in order, matching the renderer output so the editor and the published page look the same.
- Inspector: a panel for the selected block covering every property in the block schema.
- Save state in the top bar: `saved` / `saving` / `unsaved` / `offline` / `error`.
- Block actions: add, remove, move up, move down, and duplicate.
- Autosave with an explicit save when the user leaves the page.

### Site look

- Palette, font and corner rounding for the whole site, edited in one place.
- Preview of the current site look applied to the canvas.

### Images library

- Upload images to Supabase Storage, see the file name, size and where each image is used.
- Pick an image for the project, reuse it in image and gallery blocks, and delete images that are no longer needed.

### Version history

- Every save writes a new revision of the page content and keeps the previous ones.
- The history list shows when each version was saved and a version can be restored, which becomes the new current version.

### Preview

- The preview renders the page exactly as a visitor would see it, at phone, tablet and computer widths.
- Preview uses the same renderer package as the published site, so what you see is what you get.

## What is built today

| Area | State |
| --- | --- |
| Editor route | `/dashboard/projects/[projectId]/pages/[pageId]` renders a read-only preview of the page blocks plus a "Developer view" JSON dump, behind a "The visual editor is coming soon" notice |
| Editor state | `apps/web/lib/editor/store.ts` - Zustand store with content, selected block, device, panel, save state, base revision and undo/redo history (capped at 100 entries). Covered by `apps/web/tests/editor-store.test.ts`; not yet wired into the editor UI |
| Blocks package | `packages/blocks` - Zod schemas and types for `hero`, `heading`, `text`, `image`, `gallery`, `features`, `faq`, `contact-details`, `social-links`, `button`, `contact-form`, `spacer`, `divider`, plus link targets, starter content and the default theme |
| Renderer package | `packages/renderer` - `render-page.tsx`, `render-block.tsx` and `renderer.css`. All colours come from the `--s-*` custom properties, so a theme can override them without touching component code |
| Data model | `supabase/migrations/20261020000300_editor_system.sql` creates `page_versions` and `media`; the `pages` table carries the block content |
| Images | `/dashboard/projects/[projectId]/images` uploads through the project media API (`apps/web/app/api/projects/[projectId]/media/route.ts`, 5 MB limit, `image/webp`, `image/jpeg`, `image/png`) and deletes images |
| Site look | `project_settings.theme` holds the palette; `colorMode` is `light`, `dark` or `auto` and only `light` is honoured today. See `docs/ui-spec-app.md` for the dark mode plugin plan |
| Project settings | `/dashboard/projects/[projectId]/settings` is a placeholder notice |

## Not built yet

- The editor canvas: no drag and drop, no add/remove/move block actions, no inspector panel for block properties, no autosave.
- The public site route: nothing renders the renderer package yet, so a project cannot be published or previewed.
- Site look editing and the per-block style controls.
- The version history UI. The `page_versions` table exists but no code writes to or reads from it.
- Image and gallery pickers inside the editor.
- Side-by-side version comparison.
- Preview device switcher.

## Testing

- `apps/web/tests/blocks.test.ts` covers the block schemas and starter content.
- `apps/web/tests/renderer-tokens.test.ts` covers the renderer token contract.
- `apps/web/tests/editor-store.test.ts` covers the editor store, including undo and redo.
- `apps/web/tests/smoke.spec.ts` and `apps/web/tests/a11y.spec.ts` cover the app screens that exist today.
