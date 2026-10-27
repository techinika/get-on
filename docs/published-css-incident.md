# Published website CSS incident

## What owners saw

Some published websites opened without the site stylesheet. The editor preview
looked normal, and a freshly seeded local site looked normal, but the live page
could arrive as plain HTML. A second report said the data saved in KV did not
look complete.

## What was ruled out

| Hypothesis | Result | Evidence |
|---|---|---|
| The renderer produced escaped CSS (`&gt;`) | Ruled out | The local HTML contained a single unescaped `<style>` block with `.gs-root{` and the full token set. |
| The build did not put CSS in the page | Ruled out | `buildSite()` inlined 20,352 bytes of CSS in the local page; the complete HTML was 24,453 bytes. |
| The theme tokens were missing | Ruled out | The token block and the inline `--s-*` style were both present on `.gs-root`. |
| The local site server dropped the style | Ruled out | `curl` against `rosebakery.localhost:8787` returned the styled page. |
| The free-address pointer was empty | Ruled out | The pointer had `siteId`, `publishId`, `state`, `builtAt` and `plan`. |

## Root causes

### 1. The stylesheet was read from disk at runtime

`readRendererCss()` used `createRequire(import.meta.url)` and `readFileSync()`
to read `packages/renderer/styles/renderer.css`. That file was not imported by
the publish route, so Next output tracing could leave it out of a production
deployment. The function caught every error and returned `""`, which meant the
build produced a page with tokens but no renderer rules. Nothing stopped the
publish.

This was confirmed by building the app and checking the server chunks. The old
code depended on a file outside the traced module graph. The new code embeds the
stylesheet in the renderer package, so the bundler must include it.

### 2. Cloudflare KV stored only the small host mapping at the free address

The local store wrote a complete pointer at `pointers/{host}.json` and a v2
mapping beside it. The Cloudflare store wrote only `site:{siteId}` plus the v2
mapping at `host:{hostname}`. An older deployed Worker reads `host:` and expects
the full pointer, so the free address could resolve to no site or an incomplete
site. The two stores did not behave the same way.

The Cloudflare store now writes the full pointer at the free host as well as
`site:{siteId}`. Custom addresses also keep a full copy, refreshed on every
publish, so an older Worker never serves the previous publish forever.

### 3. Custom addresses kept the first publish forever

A custom host got its full copy once, when the domain went live. Later
publishes updated only `site:{siteId}` and the free host. New Workers read the
site pointer, but an older Worker read the stale full copy at the custom host.
The publish flow now refreshes every live custom host after a successful probe.

## The fix

- The renderer stylesheet is generated into `packages/renderer/src/css-manifest.ts`
  with a content hash. `readRendererCss()` returns that string.
- `buildCss()` still writes one stylesheet: tokens, font faces and renderer CSS.
- Every HTML page has one `<style data-gs="1" data-renderer-version="...">` tag.
- `assertStyledCss()` and `assertStyledHtml()` stop a publish when the stylesheet
  is missing, incomplete or unmarked.
- The publish store checks the uploaded home page again before the pointer moves.
- The publish record stores `renderer_version`, `css_hash`, `css_bytes` and
  `build_meta`.
- Cloudflare publishes probe the free address with retries, accept an expected
  redirect to the custom main address, probe the custom address without
  blocking the publish, and roll the pointer back when the page is not styled.
  Local publishes skip the network probe.
- Every successful publish refreshes the full KV copy for each live custom
  address.
- Admin can rebuild a live website when the draft matches the live revision.
  `pnpm job:rebuild-published` does the same for stale live versions.

## Verification

- `pnpm --filter @get-on/publisher test` covers the manifest parity, the styled
  gate, the unstyled build rejection and the styled upload check.
- `pnpm --filter web test` covers the unstyled upload rejection, the full
  pointer at the free host and the full custom-host copy.
- `pnpm build` succeeds, and `d0764557851e8bc9` plus `.gs-header` are present in
  `apps/web/.next/server/chunks`, so the CSS is in the production bundle.
- A local seeded publish returns `<style data-gs="1" data-renderer-version="d0764557851e8bc9">`.
