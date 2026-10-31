# Editor prototypes (Phase 0)

Status: Phase 0 prototypes for the v3 rebuild. Date: 2026-10-31.

Each prototype answers one risky question. The notes below are the result we
build against; the throwaway prototype code is not committed. Anything that can
be verified by a unit test is verified in Release 1 instead.

## 1. Canvas in an iframe

**Question:** can the editor show the real page at 390/768/1280/1440, zoom
without blurring, and still draw selection, hover and drop indicators?

**Prototype:** a same-origin `<iframe>` whose body is the shared renderer output,
inside a wrapper that applies `transform: scale(z)` with
`transform-origin: top center`. Overlays are absolutely positioned siblings of
the iframe (not inside it), positioned from element rectangles translated by the
same scale and scroll offsets.

**Findings:**
- Scaling the iframe keeps text and images crisp (it is a real layout, not a
  bitmap). `zoom` was rejected: it reflows layout differently in Firefox and
  breaks the container query width.
- Same-origin iframes let us read `contentDocument` and attach listeners
  directly; no `postMessage` protocol is needed for selection, hover or
  pointer drag. This removes a whole class of desync bugs. A thin
  `postMessage` bridge is still used for height changes and for preview mode.
- Overlays must be **outside** the iframe, otherwise scaled borders and handles
  inherit site CSS and drift. Coordinates: `rect = el.getBoundingClientRect()`
  inside the iframe, then `screen = rect * scale + iframeOffset`.
- The iframe needs an explicit height (content height) and `ResizeObserver` on
  the body; otherwise scrollbars and drop targets are wrong.
- `@container site` works in the iframe when the iframe body is the container.
  The device width is the iframe width, so container queries see the real
  width. This is why styles are emitted with container queries, not viewport
  media queries.
- Pointer events inside the iframe are used for click-select, double-click to
  edit and drag handles. The editor listens in the capture phase so a site link
  never navigates while editing.
- Preview mode swaps the iframe to the published HTML (same CSS, no overlays)
  and keeps the same width/zoom.

**Decision:** same-origin iframe + outside overlays + CSS transform scaling +
container queries. No bitmap canvas, no `zoom`.

## 2. Drag and drop across an iframe boundary

**Question:** can we drag a block from the left panel into the iframe, reorder
inside it, and drop before/after/inside with a visible indicator?

**Prototype:** pointer events (`pointerdown`/`pointermove`/`pointerup`) with
`setPointerCapture` on the editor document. On `pointerdown` in the panel or on
a canvas handle, the editor computes the target node from
`elementFromPoint` inside the iframe document (the iframe is same-origin, so
this works even while the pointer is over it). Drop zones are derived from node
rectangles: top 25% = before, bottom 25% = after, middle = inside (only when the
node accepts children).

**Findings:**
- HTML5 drag-and-drop is unusable across an iframe: the iframe swallows
  `dragover`/`drop` inconsistently and the drag image is wrong. Pointer events
  are predictable and work on touch.
- `elementFromPoint` inside the iframe returns the deepest element; we walk up
  to the nearest `[data-gs-node]` to find the node. This also handles text
  spans, media wrappers and links.
- Auto-scroll is required near the top/bottom of the canvas and near panel
  edges. A single `requestAnimationFrame` loop while dragging is enough.
- The indicator must be drawn as an overlay line/box, not by mutating the site
  DOM, so it never affects layout or publishes.
- Drop inside a `text` node is rejected (text has no children); drop into a
  locked node is rejected with a toast. The same validator runs on drop and on
  keyboard move, so keyboard and pointer share rules.
- A drag started in the panel creates a new node on drop, not a copy of a
  rendered element. The panel item carries `{kind, variant}` only.

**Decision:** pointer-event DnD with `elementFromPoint`, rectangle-based drop
zones, overlay indicators, shared move validation, and `requestAnimationFrame`
auto-scroll. Keyboard alternative: `Cmd/Ctrl+↑/↓` moves, `Cmd/Ctrl+Shift+↑/↓`
duplicates, `Alt+←/→` outdents/indents.

## 3. Style compiler and sanitising CSS

**Question:** can structured styles be compiled to small, safe, deterministic
CSS that the canvas, preview, published site and ZIP all share?

**Prototype:** a `StyleSet` per node (`base`, `tablet`, `phone`, `states`)
compiled by one function. Values are whitelist-validated first. Compiled rules
are hashed (`gs-s-{hash8}`) and deduplicated across nodes. Page-level CSS is
emitted inside `@layer gs-base, gs-theme, gs-nodes, gs-user` and the node rules
use `@container site (max-width: …)` for tablet/phone.

**Findings:**
- Hashing the normalised declaration block (property order fixed, whitespace
  removed) gives stable class names across saves and lets many nodes share one
  class. Typical page: 60–80 nodes collapse to 20–35 classes, ~6–12 KB.
- Emitting one rule per node per breakpoint is simpler but 2–3× larger and
  produces unstable diffs. Dedupe is worth it.
- Cascade order matters: `gs-protect` (badge/report link) first so later layers
  can never override it, then `gs-base` (renderer), `gs-theme` (tokens),
  `gs-nodes` (compiled), `gs-user` (custom CSS). Custom CSS is last, which is
  what customers expect, but it still cannot beat `!important` badge rules in
  `gs-protect` because those rules are inline.
- A fallback for browsers without `@layer` is needed: without it, layer order is
  source order, so the compiler also emits the layers in cascade order. Modern
  browsers all support `@layer`; the fallback is acceptable.
- Custom CSS cannot be trusted even after validation: it is parsed with
  `postcss`, selectors are scoped (`.gs-root` prefix, `gs-n-{id}` for
  `selector`), at-rules are allow-listed, `position: fixed` is rewritten to
  `sticky`, and `url()` is restricted to small data URIs and `/assets/`. The
  scoper must handle `:root`, `html`, `body`, `*`, commas, `:is/:where` and
  nested selectors.
- Rejecting unknown properties is safer than passing them through. Unknown
  property → error with a friendly message, not a silent drop (silent drops
  look like broken CSS to the user).
- Size budget is enforced per page after minification; over budget blocks save
  with a clear message and a "reduce CSS" action.

**Decision:** structured `StyleSet` + whitelist validation + hash-deduped
compiler + cascade layers + postcss-based sandbox. No arbitrary CSS outside the
sandbox; no inline `style` attributes from the editor.

## 4. In-place rich text with Tiptap

**Question:** can Tiptap edit a text node in place inside the canvas iframe
without fighting the renderer or the history?

**Prototype:** Tiptap mounted on the text node element inside the iframe
document, using `StarterKit` + `Link`, with a JSON document stored on the node.
The rest of the page stays rendered by the shared renderer. A floating toolbar
is positioned from the selection rectangle, outside the iframe.

**Findings:**
- Mounting Tiptap on the existing rendered element is fragile (Tiptap wants to
  own the DOM). The reliable pattern is: on double-click, replace the rendered
  text node content with an empty editable host and mount Tiptap there; on blur
  or Escape, serialise JSON, validate, commit one history entry, and re-render
  the node through the shared renderer.
- Plain text stays plain: a text node may be `props.text` (string) or
  `props.rich` (Tiptap JSON). Migration keeps strings as strings so v4 content
  does not suddenly gain marks.
- Dynamic fields (`{business.name}`, `{contact.phone}`) are Tiptap inline atoms
  with `contenteditable=false`; they resolve at render time. They are never
  turned into plain text.
- The floating toolbar must use the iframe's selection rect translated by zoom
  and scroll. Portals into the iframe are possible but drag focus and styles
  across documents; rendering the toolbar in the editor document is simpler.
- History: Tiptap's own history is disabled; the editor commits one patch on
  blur. This keeps one undo stack for the whole editor. (Tiptap keyboard undo
  inside the field is handled by intercepting `Cmd/Ctrl+Z` while editing and
  applying the editor history only after the field is committed; the prototype
  showed users expect field-level undo first, so the field keeps a local
  undo buffer and the editor history gets one entry on commit.)
- Sanitising on the server: allow only known node types and marks, drop
  unknown attrs, force `href` through `safeHref`, strip `target` unless
  `rel="noopener noreferrer"`, limit depth/length.
- jsdom in tests can mount Tiptap but not lay out; tests cover JSON validation
  and patch application, not pixels.

**Decision:** Tiptap in the iframe, mount-on-edit, JSON on the node, shared
renderer for display, one editor history entry per commit, server-side JSON
sanitiser.

## 5. Cascade layers and badge protection

**Question:** can Free-plan customers and custom CSS never hide the badge or
the report link, including with `!important`, `display:none`, `opacity:0`,
`position` tricks or `visibility`?

**Prototype:** the badge and report link are rendered by the renderer as
`<div class="gs-watermark" data-gs-protect="1">` with inline styles
(`display:block !important; visibility:visible !important; opacity:1 !important;
position:relative !important; …`) and sit in `@layer gs-protect`, before all
other layers. Custom CSS is scoped to `.gs-root` and cannot match
`[data-gs-protect]` because the scoper refuses selectors that target protected
attributes/classes. A browser test tries a list of attacks.

**Findings:**
- Inline `!important` beats author stylesheet `!important` only if the
  stylesheet is also inline `!important`? No: **inline `!important` wins over
  author `!important`**, and only user-agent/user-origin `!important` can beat
  it. So inline `!important` is the strongest author-level protection.
- The scoper must reject or neutralise selectors that mention `gs-protect`,
  `gs-watermark`, `[data-gs-protect]`, or `*` combined with `!important`
  declarations that would affect the badge. Simplest robust rule: custom CSS
  may not contain `!important` at all (validation error), and protected
  elements use inline `!important`. This is what we ship.
- `display:none` on an ancestor can still hide the badge. Mitigation: the badge
  is a direct child of the site root and the report link is inside it; custom
  CSS cannot target `.gs-root > .gs-watermark` because the scoper rewrites
  selectors to `.gs-root …` and rejects `gs-watermark`. Ancestor attacks
  (`footer { display:none }`) can hide the footer containing the badge, so the
  badge is rendered outside the footer as a direct child of `.gs-root` on Free.
- A browser test (Playwright) applies a set of hostile CSS snippets to a
  published page and asserts the badge is visible and clickable.
- The report link is a normal anchor to `/report-site?host=…`; it must remain
  keyboard-focusable.

**Decision:** badge + report link as protected direct children of the site root,
inline `!important`, `@layer gs-protect` first, custom CSS forbids
`!important`, Playwright hostile-CSS test.

## Outcomes applied in Release 1

- `packages/blocks/src/v5/` owns the tree, validation, style compiler, CSS
  sandbox and HTML sanitiser.
- `packages/renderer` renders v5 nodes through the existing block renderers and
  emits `data-gs-node` attributes.
- `packages/publisher` compiles the shared CSS and emits the cascade layers and
  protected badge markup.
- `apps/web/tests/editor-v5-*.test.ts` cover schema limits, migration parity,
  compiler dedupe/layers, sandbox attacks and badge protection markup.
