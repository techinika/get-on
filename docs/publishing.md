
## Google Analytics and consent
Published pages may load a first-party script when Google Analytics is enabled. Consent banner shown when consent is 'ask'. Strict CSP otherwise.

## Stylesheet safety

Every published page carries one inline stylesheet marked `data-gs="1"` and a
`data-renderer-version`. The stylesheet is generated from
`packages/renderer/styles/renderer.css` into
`packages/renderer/src/css-manifest.ts`, so a server bundle cannot leave the CSS
file behind.

A publish stops when the stylesheet is empty, incomplete or unmarked. The upload
check reads the home page back before the live pointer moves. In Cloudflare mode
the live address is probed and the pointer rolls back when the page is not
styled. `publishes.renderer_version`, `css_hash`, `css_bytes` and `build_meta`
record what went live.

To rebuild live websites that use an older renderer, run
`pnpm job:rebuild-published`. It skips any website with unpublished changes. The
admin website page has the same action as "Rebuild website".

See `docs/published-css-incident.md`.
