## 7. The 10 templates (new designs; new versions of the existing system templates)
**Rules for all templates:** each is a **different website**, not a re-colour. No two templates share a hero layout, a header style, a font pairing or a section rhythm. Every template has a Home page and 3 to 5 other pages plus the one-page version (unchanged mechanics). All text uses variables so real data replaces sample text (Section 8). No letter marks (6.6). Copy is generic and fact-free (no invented awards, years, numbers or prices except clearly marked sample values). Headings must read naturally with **no** business name inside variable fallbacks that look like another brand. Fonts must exist in the font catalogue (if one is missing, use the nearest curated font and record it in the final summary). Palettes must pass the contrast rules (`deriveTokens`); adjust by the smallest lightness change if one fails and record it. Spacing numbers below are the **template's overrides** of the section spacing multipliers (`sec.spaceTop/Bottom`: none 0, small 0.5, normal 1, large 1.5, xlarge 2).
**Distinctness matrix (must hold, tested):**
| # | Slug | Hero | Header | Footer | Rhythm | Headings | Density |
|---|---|---|---|---|---|---|---|
| 1 | `starter` | `split` (varies by composition, see 7.1) | `classic` (varies) | `simple` | `even` | per composition | comfortable |
| 2 | `software-company` | `product-shot` | `classic` sticky + CTA | `columns` dark | `bold` | Manrope 800, normal case | comfortable |
| 3 | `law-firm` | `arch` | `centered` | `columns` | `tinted` | Libre Baskerville 700, wide tracking on small caps eyebrows | airy |
| 4 | `restaurant` | `fullbleed` (centred) | `overlay` | `centered` | `alternate` with a dark menu board | DM Serif Display | airy |
| 5 | `developer-portfolio` | `minimal` | `minimal` | `simple` | `even` with rules | JetBrains Mono 700 | comfortable |
| 6 | `salon-beauty` | `offset-frame` | `centered` (no border) | `centered` | `alternate` | Cormorant Garamond 600 | airy |
| 7 | `boutique-shop` | `card-over-image` | `split` + announcement bar | `bigbrand` | `tinted` | Fraunces 700 | comfortable |
| 8 | `home-services` | `diagonal` | `classic` sticky, phone CTA | `columns` dark | `bold` | Oswald 600 uppercase | compact |
| 9 | `community-church` | `centered` + image below | `classic` | `columns` | `alternate` | Lora 700 | comfortable |
| 10 | `creative-studio` | `editorial` | `overlay`-free `minimal`? No: `split`-free: use `classic` with `wordmark` upper wide | `bigbrand` | `even` with bold rules | Space Grotesk 700 uppercase, dramatic | airy |
(Row 10 header: use `classic` with an uppercase, widely tracked wordmark and no CTA, different from row 5's `minimal` and row 3's `centered`. Row 1's header varies by composition; the tests treat the Starter as a family.)

Every template spec below defines: palette (the five roles, plus **section colours** for strong or dark sections via `sec.bg.color`), fonts, `theme.design`, buttons/cards/corners/density, header and footer config, the Home page (section order with variants, backgrounds, spacing, props), other pages, art direction and the required `includeIf` rules. Where a section lists "sec" it means `sec` overrides.

### 7.1 Starter (default; `starter`; ten compositions, one per business type)
Each composition keeps the one-page Home from earlier (sections per business type) but gets its **own design**:
| Composition | Hero (props) | Header | Palette (preset id) | Fonts | Design options |
|---|---|---|---|---|---|
| restaurant | `fullbleed`, centred, overlay dark 45, height tall | `overlay` | terracotta | Fraunces 700, Nunito Sans | rhythm alternate, imageStyle rounded, display normal |
| salon-beauty | `offset-frame`, image right, badge hidden | `centered` | blush | Playfair Display 600, Karla | rhythm alternate, imageStyle arch, eyebrow line |
| shop | `card-over-image`, card left | `split` | tomato | Outfit 600, Inter | rhythm tinted, corners soft, buttons pill |
| portfolio | `editorial` | `classic` (wide-tracked wordmark) | noir-gold | Space Grotesk 700, Inter | display dramatic, headingCase upper, rules bold, corners sharp |
| consultant | `split`, image left, frame none | `classic` | slate-blue | Source Serif 4 700, Source Sans 3 | rhythm even, corners soft, eyebrow caps |
| church-community | `centered`, image below (16:7) | `classic` | forest-gold | Lora 700, Nunito Sans | rhythm alternate, imageStyle rounded |
| repair-services | `diagonal` | `classic` sticky, phone CTA | graphite-orange | Oswald 600 (upper), Open Sans | rhythm bold, corners sharp, buttons square |
| farm-agriculture | `fullbleed`, left aligned, valign end | `overlay` | olive-grove | Young Serif 400, Figtree | rhythm tinted, density airy |
| education-tutoring | `arch` | `centered` | violet | Lexend 700, Nunito Sans | rhythm alternate, imageStyle arch, buttons round |
| other | `split`, image right | `classic` | fresh-green | Bricolage Grotesque 700, Figtree | rhythm even |
Each composition's sections use at least two variants from 6.8 so no two compositions share the same section look (tested with the distinctness gate). The Starter art is generated per composition (palette-matched, art recipes in 7.12).

### 7.2 Software company (`software-company`) — "modern SaaS"
- **Palette:** primary `#4338CA`, accent `#0EA5E9`, background `#FFFFFF`, text `#0B1020`, soft `#EEF2FF`; **dark section** `#0B1020` (text `#E6E9FF`) with gradient `linear-gradient(135deg, #0B1020, #1E1B4B)`.
- **Fonts:** Manrope 800 / Inter 400. **Design:** display normal, headingTracking tight, rhythm `bold`, imageStyle rounded, eyebrow chip, linkStyle arrow, corners soft (radius 12 / 20), buttons soft shape size large with shadow, cards shadow, density comfortable.
- **Header:** `classic`, sticky, border on, wordmark Manrope 800 24, tracking -0.02em, CTA "{{cta|Start free trial}}" solid. **Footer:** `columns`, dark (`#0B1020`).
- **Home:** (1) hero `product-shot` on the dark gradient: eyebrow chip, heading ("Everything your team needs, in one place." as the neutral fallback; real text from `business.description` when available), intro, two buttons, browser frame image `hero-dashboard` (ratio 16:10), frame overlapping the next section 72 px; (2) `logos` grayscale strip on plain, spaceTop large; (3) `features` `bento` anchor features (6 items; first tile primary); (4) `image-text` `overlap` (image left, art `feature-automation`) on plain; (5) `steps` `big-numbers` (3 steps) on `soft`; (6) `stats` `big-rules` (sample, flagged) on the dark section colour with on-dark text; (7) `testimonials` `wall` (3, sample-flagged) on plain; (8) `cta` `split` on plain with large spacing; (9) `faq` two columns, anchor faq; section shapes: `curve` bottom on (6).
- **Other pages:** Features (hero `centered` text only on soft, `features` `rows`, `image-text` `fullbleed-split` x2 alternating), Pricing (hero `minimal`, `pricing` highlighted middle plan, `faq`), About (hero `split`, `team` `offset`, `stats`), Contact (hero `minimal`, `contact-form` split).
- **Art direction:** `isometric-blocks` and `mesh-gradient`: rounded dashboard cards on an indigo mesh gradient, translucent glass panels, no text.

### 7.3 Law firm (`law-firm`) — "classic, calm, trustworthy"
- **Palette:** primary `#14213D` (navy), accent `#B08D57` (brass, decorative only), background `#FAF8F4`, text `#1B1F27`, soft `#EFEBE3`; dark section `#14213D` with ivory text.
- **Fonts:** Libre Baskerville 700 / Source Sans 3 400. **Design:** display normal, headingTracking normal, eyebrow `caps` tracking wide, rules `hairline`, rhythm `tinted`, imageStyle `arch`, corners sharp (2 / 4), buttons square solid, cards outlined, linkStyle underline, density airy.
- **Header:** `centered`, not sticky, border hairline both rows, wordmark Libre Baskerville 700 28 uppercase tracking 0.08em, `sub: 'type'`; no CTA in the header (a "Book a consultation" text link in the menu row end). **Footer:** `columns` on `#14213D` ivory text, disclaimer line.
- **Home:** (1) hero `arch` (text left, arch image right, top-ruled eyebrow, buttons "Book a free consultation" solid + "Our practice areas" outline), plain background with an ivory `noise` pattern; (2) `services` `columns-rules` ("Practice areas", 3 columns, no prices) on plain with `rule: top`; (3) `image-text` `overlap` (image right, art `office-art`, offset card) on `soft`; (4) `steps` horizontal (3 steps) plain; (5) `team` `offset` (3 people, sample-flagged) on plain; (6) `testimonials` `spotlight` (one quote, sample-flagged) on the navy section with ivory text; (7) `faq` one column; (8) `cta` `ribbon` brass with navy text; section shapes none.
- **Other pages:** Practice areas (hero `minimal` caps eyebrow, `services` `cards-image`, `steps` vertical, `faq`), Attorneys (hero `centered`, `team` grid with 3:4 portraits, `quote` big), About (hero `split` frame none, `stats` `big-rules`, `text` two columns), Contact (hero `minimal`, `contact-form` split, `map`, hours).
- **Art direction:** `arch-composition` (columns, arches, a scale motif in outline) in navy and brass tints; engraved line style, no text.

### 7.4 Restaurant (`restaurant`) — "warm, appetising"
- **Palette:** primary `#7A2E1D`, accent `#C9A24B`, background `#FBF6EE`, text `#2B1B14`, soft `#F3E7D6`; dark section `#1E1410` (cream text `#F5EBDD`).
- **Fonts:** DM Serif Display (400, nearest weight) / DM Sans 400. **Design:** display `dramatic` on the hero only, headingTracking normal, eyebrow `line`, imageStyle rounded (radius 20), corners round (20 / 28), buttons round, cards flat, density airy, rhythm `alternate`.
- **Header:** `overlay` (transparent over the hero, cream text), wordmark DM Serif Display 30, CTA "Book a table" solid on `--s-accent` style. **Footer:** `centered`, `soft` background, social icons.
- **Home:** (1) hero `fullbleed`, centred, overlay dark 50, height tall (min(88svh, 840px)), eyebrow line, display heading, buttons "View the menu" solid and "Book a table" outline (inverted), art `hero-table`; (2) `image-text` `fullbleed-split` (image left, art `story-kitchen`, text on `soft`) ; (3) `products` `lookbook` (3 favourites, orderMode none, sample prices flagged) on plain; (4) `menu` `board` teaser on the dark section (two columns, 4 items per section, leaders) with `shape.top: wave`; (5) `gallery` `mosaic` (8 images, zoom on) plain; (6) `testimonials` `cards` 3 (sample-flagged) on `soft`; (7) `map` card with hours on plain; (8) `cta` `banner` primary with display heading.
- **Other pages:** Menu (hero `minimal` centred, `menu` `board` full on the dark section, note on allergies, download button when a PDF exists), Visit us (hero `centered` image below, `map`, `opening-hours`, `contact-form` compact), Our story (hero `split`, `quote` big, `team` offset), Gallery (hero `minimal`, `gallery` `filmstrip`, `gallery` `mosaic`).
- **Art direction:** `grain-gradient` and `botanical-lines`: top-down table scenes made of overlapping circles (plates), curved line herbs, warm grain; no text.

### 7.5 Developer portfolio (`developer-portfolio`) — "dark, technical"
- **Palette (dark design):** background `#0B0F14`, text `#E6EDF3`, primary `#58E6D9`, accent `#F2B84B`, soft `#131A22`; card `#101821`.
- **Fonts:** JetBrains Mono 700 (headings) / Inter 400. **Design:** display normal, headingTracking tight, eyebrow `caps` mono feel (wordmark font heading), rules `hairline`, imageStyle sharp, corners sharp (2 / 4), buttons square soft style, cards outlined (1px `rgba(255,255,255,0.1)`), rhythm `even`, density comfortable, linkStyle arrow.
- **Header:** `minimal` (wordmark left in mono 600 18 lowercase style `case: normal`; "Menu" text button right; full-screen panel with large mono links). **Footer:** `simple` with social links as text links.
- **Home:** (1) hero `minimal` left aligned: mono eyebrow, heading in mono at `--s-h1` with the accent bar, intro, highlights row (skills) with rules, buttons "View my work" solid and "Get in touch" outline; a background `grid` pattern at 7 percent; (2) `features` `rows` ("What I do", 4 items) with hairlines; (3) `projects` `list` (3 to 6 rows, sample flagged, thumbnails from `md`) ; (4) `image-text` (image left, art `about-portrait`, imageStyle sharp, `frame: offset` accent); (5) `steps` `big-numbers` (4); (6) `testimonials` `cards` (2); (7) `link-list` outline (GitHub, LinkedIn, Email); (8) `cta` `ribbon`.
- **Other pages:** Projects (hero `minimal`, `projects` `list` all, `cta`), About (hero `split`, `text` two columns, `features` `rows` tools, `downloads`), Contact (hero `minimal`, `contact-form` split, `social-links` large).
- **Art direction:** `halftone` and `terminal-grid`: dark panels with teal line drawings (UI wireframes, code-like bars, no readable text).

### 7.6 Salon & beauty (`salon-beauty`) — "soft, elegant"
- **Palette:** primary `#8E4A5D`, accent `#B5835A`, background `#FFF9F6`, text `#2E2024`, soft `#F8E9E6`; deep section `#3A1F2A` (blush text).
- **Fonts:** Cormorant Garamond 600 / Karla 400. **Design:** display `dramatic` hero, headingTracking wide on eyebrows only, eyebrow `line`, imageStyle `arch`, corners round (20 / 28), buttons pill (outline emphasis), cards flat, rhythm `alternate`, density airy, linkStyle arrow.
- **Header:** `centered` without borders (hairline only under the menu), wordmark Cormorant Garamond 600 34 with `sub: 'type'`, CTA "Book now" as a pill in the menu row end. **Footer:** `centered`, `soft`.
- **Home:** (1) hero `offset-frame` (image right, 4:5, accent frame, badge from facts only); (2) `services` `list` ("Treatments and prices", leaders, sample prices flagged) in a narrow container on plain; (3) `image-text` `overlap` (image left, arch, art `studio-light`) on `soft`; (4) `gallery` `mosaic` (6) plain; (5) `testimonials` `spotlight` (sample-flagged) on the deep section with `shape.top: curve`; (6) `team` `offset` (3, arches); (7) `faq`; (8) `cta` `card` with `pattern: dots` on `soft`.
- **Other pages:** Services (hero `centered` image below, `services` `cards-image`, `pricing` optional), Gallery (hero `minimal`, `gallery` `filmstrip`), About (hero `arch`, `team`, `quote`), Contact (hero `minimal`, `contact-form` boxed, `map`, `opening-hours`, `social-links`).
- **Art direction:** `blob-field` and `arch-composition`: soft organic shapes, arches, a single botanical line, blush and copper gradients; no text.

### 7.7 Boutique shop (`boutique-shop`) — "product-first retail"
- **Palette:** primary `#1C1B1A`, accent `#C2410C`, background `#F7F3EE`, text `#151412`, soft `#ECE5DB`; cards `#FFFFFF` through `--s-card`.
- **Fonts:** Fraunces 700 / Work Sans 400. **Design:** display normal, headingTracking normal, eyebrow `caps`, imageStyle sharp (radius 4), corners sharp-ish (4 / 8), buttons square solid, cards outlined, rhythm `tinted`, density comfortable, linkStyle underline.
- **Header:** `split` (menu left, wordmark centre in Fraunces 700 28, CTA "Shop" and a text link "Contact" right) with an **announcement bar** (accent background: free-form text from the owner; template default hidden unless a facts-based message exists). **Footer:** `bigbrand` on `#1C1B1A` (cream text), giant wordmark.
- **Home:** (1) hero `card-over-image` (card left, image full-bleed, buttons "Shop the collection" + "Visit us"); (2) `features` `tiles` (3 to 4 promise tiles: delivery, returns, support: generic, no numbers); (3) `products` `lookbook` (4 to 6, orderMode whatsapp, sample prices flagged) on plain; (4) `image-text` `fullbleed-split` (story, art `studio-light`) ; (5) `products` `catalog` ("New in", 8 items) on `soft`; (6) `testimonials` `wall` (sample-flagged); (7) `cta` `split` with order by WhatsApp; (8) `faq` shipping questions (generic, no promises).
- **Other pages:** Shop (hero `minimal` with filter chips as `link-list` style, `products` `catalog` 12), About (hero `editorial`-free: `split`, `image-text`, `team`), Visit (hero `centered`, `map`, hours, `contact-details`), Contact (hero `minimal`, `contact-form` classic, `quick-contact`).
- **Art direction:** `still-life-shapes`: flat product silhouettes (bags, bottles, boxes as geometric shapes) on warm paper textures with soft shadows; no text.

### 7.8 Home services (`home-services`) — "bold, trustworthy trades"
- **Palette:** primary `#0A58CA`, accent `#FF7A00` (buttons with dark text through `--s-on-accent`), background `#FFFFFF`, text `#0F172A`, soft `#EAF2FF`; dark section `#0A2540` (white text).
- **Fonts:** Oswald 600 uppercase headings / Open Sans 400. **Design:** display normal, headingCase `upper`, headingTracking normal, eyebrow `chip`, imageStyle rounded (radius 8), corners sharp-ish (4 / 8), buttons square solid size large, cards shadow, rhythm `bold`, density compact, linkStyle arrow, rules bold.
- **Header:** `classic`, sticky, border on, wordmark Oswald 600 26 uppercase, **CTA = phone** ("Call {{business.phone}}" from the website phone; hidden if no phone, then "Get a quote" to Contact), a thin top announcement bar for hours ("Open today until 6pm" only when hours exist). **Footer:** `columns` on `#0A2540`.
- **Home:** (1) hero `diagonal` (blue text panel, image right, large phone button); (2) `stats` `big-rules` (generic sample, flagged) on plain; (3) `services` `cards-image` (6 services with icons, no prices) on plain; (4) `steps` `big-numbers` ("How it works", 4) on the dark section with `shape.top: slant`; (5) `before-after` (2 pairs) plain; (6) `testimonials` `cards` (3, sample-flagged) on `soft`; (7) `map` + service area (`area_served`) on plain; (8) `cta` `split` on primary with the phone button; (9) `faq`.
- **Other pages:** Services (hero `minimal`, `services` `columns-rules`, `faq`), Projects (hero `centered`, `gallery` `mosaic`, `before-after`), About (hero `split`, `team` offset, `stats`), Contact (hero `minimal`, `quick-contact` row, `contact-form` boxed, `map`).
- **Art direction:** `isometric-blocks` with tools and house outlines in blue and orange, flat and bold; angular shapes; no text.

### 7.9 Community & church (`community-church`) — "warm, welcoming"
- **Palette:** primary `#355E4B`, accent `#D9A441` (decorative), background `#FFFBF2`, text `#25302B`, soft `#EEF3E7`; warm section `#F4E8D0`.
- **Fonts:** Lora 700 / Nunito Sans 400. **Design:** display normal, headingTracking normal, eyebrow `line`, imageStyle rounded (radius 20), corners round (16 / 24), buttons round soft, cards flat, rhythm `alternate`, density comfortable, linkStyle arrow.
- **Header:** `classic`, not sticky, border off, wordmark Lora 700 26, CTA "Join us this week" (link to the Visit section). **Footer:** `columns`, `soft`.
- **Home:** (1) hero `centered` with the wide image **below** (ratio 16:7, rounded, soft shadow, art `gathering-warm`); (2) `features` `icons` ("What we do", 3 to 4 items) on plain; (3) `steps` horizontal ("Your first visit", 3) on `soft`; (4) `image-text` `offset`-style via `imageStyle: offset` (image right, art `hands-together`) ; (5) `gallery` `grid` 3 columns rounded; (6) `team` grid (3 leaders, sample-flagged) on the warm section; (7) `testimonials` `single` (sample-flagged); (8) `map` + `opening-hours` card (service times as hours) ; (9) `cta` `banner` with `pattern: dots`.
- **Other pages:** About (hero `split`, `text` two columns, `team`), Events (hero `minimal`, `steps` vertical as schedule, `cta`), Give (hero `centered`, `text`, `button`), Contact (hero `minimal`, `contact-form` boxed, `map`).
- **Art direction:** `blob-field` with `botanical-lines`: soft hills, light rays, hands and leaves in simple flat shapes, warm gold and green; no text.

### 7.10 Creative studio (`creative-studio`) — "editorial, high contrast"
- **Palette:** primary `#0A0A0A`, accent `#FF4D2E` (large text and decoration only), background `#FFFFFF`, text `#0A0A0A`, soft `#F2F2F0`.
- **Fonts:** Space Grotesk 700 / Inter 400. **Design:** display `dramatic`, headingCase `upper`, headingTracking tight, eyebrow `caps`, rules `bold`, imageStyle sharp (radius 0), corners sharp (0 / 2), buttons square solid (black) and outline, cards flat, rhythm `even` with bold rules, density airy, linkStyle arrow.
- **Header:** `classic` with an uppercase, widely tracked wordmark (Space Grotesk 700 18, tracking 0.18em), no CTA, border bold bottom. **Footer:** `bigbrand` (black text on white, giant wordmark).
- **Home:** (1) hero `editorial` (top rule with eyebrow and city, giant uppercase heading across the full width, intro and buttons in a 12-column split, image strip 21:9); (2) `projects` `featured` (first project large, then 4) on plain with `rule: top`; (3) `gallery` `mosaic` (8) edge-to-edge (`sec.width: full`); (4) `image-text` `fullbleed-split` (image right, art `studio-portrait`); (5) `services` `columns-rules` (3: "What we make"); (6) `logos` grayscale; (7) `testimonials` `spotlight` (one quote, sample-flagged) with an accent `rule`; (8) `cta` `ribbon` on `--s-accent` (black text); (9) `faq` two columns.
- **Other pages:** Work (hero `minimal`, `projects` `list` all), Studio (hero `split` sharp, `team` offset, `stats` big rules), Journal-free; Contact (hero `editorial` small, `contact-form` split, `social-links`).
- **Art direction:** `geometric-tiles` with `halftone`: black, white and vermillion blocks, overlapping circles and bars, strong crops; no text.

### 7.11 Shared template engineering
- Each template is a `TemplatePackage` (new versions) with compositions, `singlePage`, `aiHints` (updated to include its archetype name, design vocabulary and "do not" rules), `blockPurposes`, notices and the sample profile (used for previews only).
- Replace all sample brand names in blocks with variables (Section 8). Sample copy must be **brand-neutral**.
- Thumbnails and `og.jpg` regenerate from the new designs; the gallery shows the real new looks.
- Existing websites keep the version they used; only new applications use the new versions; the admin template pages show the new versions.

### 7.12 Art pipeline updates (`packages/templates/src/art.ts`)
Add recipe types: `mesh-gradient`, `isometric-blocks`, `arch-composition`, `grain-gradient`, `botanical-lines`, `halftone`, `terminal-grid`, `blob-field`, `still-life-shapes`, `geometric-tiles`. Each recipe takes the palette and a seed, outputs SVG then WebP (rules from the earlier art pipeline: no readable text, no real brands, per-file size limits, alt text). Every template ships at least: hero art (1600x1200 or 1600x1000), two section arts (1200x900), a portrait set where used (600x600 neutral shapes, **no faces and no initials**), logos where needed (480x160 as abstract single-colour **shapes without letters**: use simple geometric marks, never initials). Provide the contact-sheet HTML `docs/template-art-preview.html`.

Implemented in `packages/templates/src/art.ts` (`ART_RECIPES`, `renderArt`, `templateArtwork`, `artPlanFor`). `pnpm --filter web art:templates` writes SVG and WebP files to `docs/template-art/<slug>/` and rebuilds the contact sheet. The shared art tests cover determinism, palette use, the five-image plan, alt text, and the ban on text, faces and remote files.

## 8. Real website data when a template is applied
### 8.1 What must happen
After applying a template (`new`, `full`, `pages`, `design`), the website must show **its own** data wherever the template used sample data: business name, tagline, description, contact details, address, opening hours, social links, logo, and the site and page titles. Template sample profile values (names such as the sample business names, phone numbers, emails, addresses, hours) must **never** remain in the resulting content.
### 8.2 Variables (extend `packages/templates/variables.ts`)
Names: `business.name`, `business.tagline`, `business.description`, `business.type` (plain label, for example "Restaurant"), `business.city`, `business.region`, `business.country`, `business.phone`, `business.email`, `business.address`, `business.hoursSummary` (for example "Mon to Fri 9am to 5pm" from the structured hours), `business.areaServed`, `site.address`, `owner.firstName` (never used by default), `year`. Syntax `{{name|fallback}}` stays; **fallbacks must be brand-neutral** (no invented names, numbers or claims). Add **conditional visibility** for whole blocks and for header and footer items with `blockMeta.includeIf` values: `phone`, `email`, `address`, `hours`, `social`, `logo`, `description`, `tagline`, `city`, `areaServed`; and for text slots a `slotMeta.hideIfEmpty` flag so an empty variable removes the slot's block or item instead of leaving a gap.
### 8.3 Where each variable is used (rules for every template)
| Place | Source and rule |
|---|---|
| Header wordmark, footer wordmark and copyright | `business.name` (typographic text only); logo image replaces the wordmark when uploaded |
| Hero eyebrow | `business.type` and `business.city` joined with a middle dot, omitted segments trimmed |
| Hero heading and intro | the template's neutral headline, but the **intro** uses `business.description` when present, else `business.tagline`, else the neutral fallback sentence |
| About and story text | `business.description` when present (as the first paragraph) followed by neutral template text |
| Contact blocks, header CTA, footer, map, hours | `source: 'site'` bindings (website settings), hidden by `includeIf` when missing; header phone CTA uses `business.phone` |
| Social links | `social_links` from settings; hidden when empty |
| SEO | site title = `business.name` (and tagline when available per the title format), site description = `business.description` or the hero intro trimmed to 155 characters; each page title uses `{page} | {site}` through the title format; JSON-LD uses the real profile |
| Footer about text | `business.tagline` or `business.description` (trimmed 200), else omitted |
| Sample-only content (testimonials, stats, prices, team, logos, projects) | stays **sample-marked** and flagged as before (never presented as the owner's facts) |
### 8.4 Apply engine changes
- Resolve variables once at apply time with the website's **real** profile (website settings first; wizard answers for new websites); empty values resolve to the fallback or hide the block per 8.2.
- After resolution run a **sample-leak scan** on the result: it fails the apply (nothing changes) if any string from the template's `sampleProfile` (name, tagline, phone, email, address, hours text, social URLs) or any `example.` domain or `555` phone pattern remains in non-sample slots; in tests this is a hard failure; in production it logs `admin_alert` and falls back to hiding the offending slot instead of failing the customer.
- The setup panel lists missing real data that blocks hidden elements ("Add your phone to show a call button", "Add your opening hours", "Add your address to show a map", "Add a logo").
- `pages` mode and `design` mode use the **website's** existing profile too.
### 8.5 Tests
Apply each of the 10 templates to three profiles (full data, name only, nothing but a name and type) and assert: no sample strings (scan of all templates' sample profiles), correct header wordmark, correct contact blocks or hidden blocks, SEO fields filled, no empty gaps (no blocks that render nothing but still reserve space; check rendered HTML for empty sections), no letter-mark tiles, all sample-only content flagged.

### 8.6 Quality gates for templates (run in CI for all templates and compositions)
- Validate package; render every page at three container bands; **layout lint** (Section 13) with zero errors; contrast rules; exactly one `h1` per page; no horizontal overflow at 360; Lighthouse mobile at least 95 on each home page (published output served locally); distinctness: unique (hero layout, header style, font pair, rhythm) across the ten templates, unique primary-colour hue families (hue differences of at least 25 degrees between any two light templates or lightness differences for dark ones), perceptual-hash difference of the home page screenshots at 1280 between every pair above a threshold (document the threshold), and each template uses at least four block variants from 6.8.

---
