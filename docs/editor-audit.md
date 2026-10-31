# Editor audit (Phase 0)

Status: Phase 0 audit for the v3 rebuild. Date: 2026-10-31.

The rebuild replaces the editor instead of patching it. This document records
what exists today, what is broken or missing, what depends on the v4 content
model, and the dependency map for the v4 → v5 migration.

## 1. What exists today

| Area | Where | What it actually is |
|---|---|---|
| Editor route | `apps/web/app/dashboard/(shell)/projects/[projectId]/pages/[pageId]/page.tsx` | A server component: page preview, a text-field editor, an AI section composer, and a read-only JSON dump. It is not the v2 editor described in `docs/ui-spec-editor-v2.md`. |
| Text editing | `.../[pageId]/page-text-editor.tsx` | A list of text fields built from `collectTemplateSlots()`, rendered as `Input`/`Textarea`, with a manual save. |
| AI text | `.../[pageId]/ai-actions.ts` | `writeFieldWithAi` and `savePageText` server actions. |
| AI section | `.../[pageId]/ai-section-composer.tsx` | A form that appends an AI-built v4 block list. |
| Store | `apps/web/lib/editor/store.ts` | A small zustand store (`content`, `selectedBlockId`, `device`, `panel`, `saveState`, `baseRevision`, `past`, `future`). **Nothing imports it.** Its default `schemaVersion` is `3`, which disagrees with the rest of the app. |
| Preview | `page.tsx` | `RenderPage` inside `SiteRoot` at a fixed `max-w-[1100px]`. No iframe, no zoom, no device switch, no selection, no overlays. |
| Renderer | `packages/renderer` | React components (`RenderPage`, `RenderBlock`, `SiteHeader`, `SiteFooter`) that render v4 blocks. One static `styles/renderer.css` (1,899 lines) inlined at publish. |
| Publisher | `packages/publisher` | `buildSite()` renders pages to static HTML with one inline `<style data-gs="1">`. Budgets: 14 KB gzip CSS warning, 20 KB page warning. `assertStyledCss`/`assertStyledHtml` are the publish gate. |
| Content model | `packages/blocks/src/schemas.ts` | `pageContentSchema`: `schemaVersion: 4`, flat `blocks[]`, max 60 blocks. `sectionOptionsSchema` is the `sec` object (background, spacing, width, anchor, menuLabel, hideOn, hidden, shape, pattern, rule). |
| Migration | `packages/blocks/src/utils.ts` | `migrateContent()` normalises arrays/objects to schema 4; `normalizeBlock()` handles legacy hero layouts, `contact-cta`, gallery `imageIds`, contact form defaults. |
| Lint | `packages/blocks/src/layout-lint.ts` | Block-array lint (hero first, one hero, rhythm, contrast, letter marks, section count). |
| Theme | `packages/blocks/src/theme.ts` | 26 palettes, 12 font pairs, `themeTokens()` emits `--s-*` tokens. |
| Fonts | `packages/blocks/src/fonts.ts` | Curated font catalogue (`fonts/catalog.fallback.json`), pairs, business defaults, subsetting. |
| Templates | `packages/templates` | Template packages, apply engine, validation, variables, art. |
| AI | `packages/ai` + `apps/web/lib/ai` | Provider interface, fake provider, credits, tasks, prompts, design pipeline, template slots. |
| Plugins | `packages/plugins` | Plugin registry/types (contact plugin). |
| Tiptap | `apps/web/package.json` | `@tiptap/react`, `starter-kit`, `extension-link` are installed but **not used anywhere** in the editor. |
| Tests | `apps/web/tests`, `packages/publisher/tests` | Unit tests for blocks, publishing, renderer tokens, layout lint, AI, etc. `editor-store.test.ts` is a placeholder (`expect(true)`). |

## 2. Defects and weaknesses

### 2.1 State synchronisation
- The zustand editor store is dead code. The page editor keeps text fields in
  local React state and reads the page from the server; the AI composer and the
  text editor can both change content without a shared source of truth.
- `schemaVersion` is inconsistent: store default `3`, `migrateContent()` returns
  `4`, `pageContentSchema` requires `4`, `starter.ts` returns `3`,
  `publisher/html.tsx` passes `3` to the renderer. The renderer ignores it, so
  the bug is latent.
- The page editor calls `router.refresh()` after saving text. The preview, the
  field list and the AI composer can disagree until the refresh lands. There is
  no optimistic state, no dirty tracking across components and no conflict UI.
- Saving is manual (`Save changes`). There is no autosave, no debounce, no
  save-status chip, no offline handling and no revision conflict surface.

### 2.2 Selection and editing
- There is no selection, hover, breadcrumb, layers or inspector. The only
  editing surface is a generated list of text slots.
- `collectTemplateSlots()` drives the field list. It only knows v4 block props;
  it cannot see nested layouts, rich text marks, dynamic fields or attributes.
- There is no in-place text editing, no rich text, no marks, no links inside
  text, no dynamic business fields, no undo/redo beyond a one-step history of
  AI text replacements.
- Heading level, images, links, layout variants and section options are edited
  in other screens (Pages/Templates), not in the editor. This contradicts the
  editor goals and makes "one obvious next step" hard.

### 2.3 Drag and drop, canvas and coordinates
- No drag and drop anywhere in the editor.
- The preview is a normal DOM flow, not an isolated canvas. There is no zoom,
  no device width switch, no custom width and therefore no coordinate mapping
  problem today — and no foundation for one.
- The fixed `max-w-[1100px]` frame means the "editor" cannot show the real
  desktop/tablet/phone layout, so responsive mistakes are invisible until
  publish.
- There is no iframe isolation. Site CSS and dashboard CSS share a document in
  the editor preview (the renderer classes are prefixed, but there is no hard
  boundary), and published-only CSS layers cannot be previewed faithfully.

### 2.4 Undo grouping and history
- Only AI text replacements are undoable, one step at a time. Structural edits
  have no undo at all.
- The dead store pushes a full content clone on every `setContent`, which would
  group badly (one entry per keystroke) and keep 100 full copies in memory.
- There is no shared history across text, style, structure and AI patches.

### 2.5 Performance
- The whole page is server-rendered on every navigation; there is no local
  editing model, so typing cannot be fast.
- The preview renders every block on every keystroke in the text editor
  (`router.refresh()`), so long pages are slow.
- No virtualisation anywhere. The field list renders every text slot.
- No code splitting for Tiptap, CodeMirror, patterns or AI panels (they are not
  used yet).

### 2.6 Mobile behaviour
- The preview is a wide card with `max-w-[1100px]`; on a phone it becomes a
  squeezed desktop layout. There is no device switch and no touch editing.
- The text fields stack, which is usable, but there is no sheet layout, no
  bottom toolbar and no long-press drag.

### 2.7 Accessibility
- The preview is non-interactive and has no accessible name beyond its visual
  heading. There is no live region for selection or save status.
- The text editor labels are generic ("Heading · text"); fields are not grouped
  by section. There is no keyboard path from the preview to a field.
- The AI dialog has no credit preview, no result preview and no change list.

### 2.8 Memory leaks and lifecycle
- No listeners or observers exist in the editor today, so there are no known
  leaks. The risk arrives with the iframe, `ResizeObserver`, `postMessage`,
  pointer capture and Tiptap instances; the rebuild must own their cleanup.
- The dead store keeps full content clones forever within a session.

### 2.9 Content and feature gaps
- No custom CSS, classes, IDs, ARIA, data attributes, hide-per-device, lock,
  layer names or notes.
- No page CSS or site CSS.
- No style system: v4 `sec` is a small enum-based section style, not a general
  CSS property model. There is no per-element style, no responsive override, no
  hover/focus state, no preset and no compiled stylesheet per page.
- No patterns, saved sections or synced references. `shared` exists as a v4
  block but has no table or editor.
- No developer drawer, no editor settings, no shortcuts dialog.
- No preview mode, no private preview route inside the editor, no template
  editing on the new editor (templates are edited through a separate flow).

### 2.10 Safety gaps
- No custom code exists, so the CSS/HTML sandbox does not exist yet. The
  published CSS gate only checks that the renderer stylesheet is present and
  marked; it cannot check node classes, user layers or badge protection because
  those do not exist.
- The Free-plan badge (`gs-watermark`, "Built with Get-On") is rendered inside
  the footer component and styled by `renderer.css`. There is no "Report this
  site" link yet, no inline `!important` protection, no `@layer gs-protect` and
  no browser test for hiding it. Once custom CSS exists this becomes a real
  vulnerability, so it must ship with the sandbox.
- Plugin gating exists for the contact form in the publisher warning path, but
  there is no capability map and no server-side element gating model.

## 3. Current content model and everything that depends on it

`PageContentV4 = { schemaVersion: 4, blocks: Block[] }` where
`Block = { id, type, props, sec?, includeIf?, slotMeta?, sampleOnly? }`.
`sec` is `SectionOptions` from `schemas.ts`.

Direct dependencies (call sites):

| Dependency | Files |
|---|---|
| `migrateContent` / `validateContent` | `apps/web/app/dashboard/(shell)/projects/[projectId]/pages/[pageId]/page.tsx`, `apps/web/lib/ai/template-slots.ts`, `apps/web/lib/site-package/content.ts`, `packages/templates/src/validation.ts`, `apps/web/tests/blocks.test.ts`, `apps/web/tests/template-real-data.test.ts` |
| `collectMediaIds`, `collectAnchors`, `ensureUniqueAnchors`, `countSampleBlocks`, `countBlocks`, `blockLabel` | `apps/web/lib/ai/template-slots.ts`, `apps/web/lib/site-package/content.ts`, `packages/templates/src/apply.ts`, `packages/renderer/src/render-block.tsx`, `apps/web/app/dashboard/(shell)/projects/[projectId]/page.tsx`, `apps/web/app/dashboard/(shell)/projects/[projectId]/publish/page.tsx` |
| `RenderPage` / `RenderBlock` | `apps/web/app/dashboard/(shell)/projects/[projectId]/pages/[pageId]/page.tsx`, `apps/web/app/templates/[slug]/page.tsx`, `packages/publisher/src/html.tsx`, `packages/renderer/index.tsx` |
| `lintLayout` | `packages/templates/src/validation.ts`, `apps/web/lib/ai/*`, publisher preflight paths |
| Page content storage | `pages.blocks` (jsonb), `save_page_content` RPC, `page_versions`, autosnapshots, backups |
| Publishing | `apps/web/lib/publishing/build-input.ts`, `packages/publisher/src/build.ts`, `html.tsx`, `seo.ts`, `apps/web/lib/publishing/*`, Website ZIP/export-import, share previews, Overview thumbnails, search |
| Templates | `packages/templates/src/{apply,validation,variables,kit,art,catalog,registry}.ts` |
| AI | `packages/ai` tasks/prompts/design, `apps/web/lib/ai/{actions,template-slots,design-*}` |
| Import/export | `apps/web/lib/site-package/*`, `packages/site-package/src/*` |

## 4. v4 → v5 migration dependency map

The v5 model is a tree (`PageContentV5` with a `page` root). The migration must
run wherever v4 content is read, and both versions must render until the batch
has converted everything.

1. **Schema and converter** (`packages/blocks/src/v5/migrate.ts`):
   - `migrateV4ToV5(content)` maps each v4 block to a top-level `smart` node
     (`props.kind = block.type`, `props` minus `sec`).
   - `sec.bg` → `style.base` background properties (plain none, soft/brand/accent
     token colours, colour, gradient, image + overlay).
   - `sec.spaceTop`/`spaceBottom` → padding tokens; `sec.width` → `maxWidth`;
     `sec.anchor` → `attrs.id` (validated, unique, suffixed); `sec.menuLabel` →
     `props.menuLabel`; `sec.hideOn` → `hidden`; `sec.hidden` → `hidden.all`;
     `sec.shape`/`sec.pattern` → clip-path/background image styles.
   - `shared` → `reference` node.
   - Plugin requirements stay on the node (`requiresPlugin` from the v4 type).
   - Deterministic ids: keep the v4 id where it is a valid v5 id, otherwise
     derive a stable id; the migration must be idempotent.
2. **Validation** (`validateContentV5`) must be the single authority used by the
   editor, save RPC, publisher, importer and AI verifier.
3. **Renderer/publisher** must accept both shapes. `RenderPage` gains a
   `renderContentV5` branch; the publisher compiles styles per page and emits
   cascade layers. v4 keeps the current path until the batch is done.
4. **Templates**: `packageVersion: 2` packages carry v5 trees. The apply engine
   maps text slots by traversing `props.text` and rich text nodes, keeps slot
   ids stable via node ids, and migrates old packages on read.
5. **AI**: `template-slots`, `ai-section-composer`, design apply and the
   verifier read trees. The edit-patch format replaces whole-list writes.
6. **Import/export, backups, Website ZIP, share previews, thumbnails, search**:
   read through the same `readPageContent()` helper that returns v5 (migrating
   v4 on read) so no downstream code needs two branches.
7. **Rollback**: before the lazy conversion, insert a `before_editor_v3`
   version with the v4 content. Restoring it returns the page to v4.

## 5. Decisions for the rebuild (fix by replacement)

- The v2 "Edit / Style / Section" inspector and the block list canvas are
  replaced by the three-column v3 editor (`docs/ui-spec-editor-v3.md`).
- The flat v4 block list is replaced by a v5 node tree. v4 blocks survive as
  `smart` nodes with their existing renderers, so all system templates keep
  rendering.
- The dead zustand store is replaced by a tree store with command-based history,
  one history for text, style, structure, custom CSS and AI patches.
- The editor canvas becomes a same-origin iframe at the real device width,
  scaled with CSS transforms, with overlays in the same document. The shared
  renderer produces the iframe body; the editor only adds overlay attributes.
- Styles become structured data compiled to CSS by one compiler. Raw CSS only
  exists as sandboxed custom CSS.
- The publisher and the canvas use the same compiled CSS and the same cascade
  layers. The badge protection ships with the sandbox.
- `EDITOR_V3` gates the new editor. New pages default to v5; v4 pages can be
  opened in the old editor until converted.

## 6. Known open items after this audit

- Plan limits for custom code and patterns are proposed in the engine spec and
  need a product decision before launch (see `docs/editor-engine.md` §6.6).
- The "Report this site" link does not exist yet; it is added with the badge
  protection in the publisher.
- Tiptap is installed but unused; the rebuild wires it for in-place rich text.
- The current text-slot editor is the only editing path; it is removed when
  `EDITOR_V3` is on.
