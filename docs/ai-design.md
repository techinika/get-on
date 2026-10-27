# PART C: AI generation that follows the user's design wishes

## 9. Goals and definitions
- AI websites must look **designed**: organised sections, clear alignment, consistent spacing, good contrast, modern layouts, and **visibly different** from each other.
- Users can describe the look (free text and pickers) and the result must satisfy at least **90 percent** of their **supported** requirements, measured as `accuracy = sum(weight of satisfied) / sum(weight of all supported requirements)` with weights **must = 3, should = 2, nice = 1**. The system must also report every unmet or unsupported request honestly (100 percent of the time).
- **How the 90 percent is achieved:** (1) the user's words become a **checklist of atomic requirements** (the Design Spec); (2) every requirement that maps to a design token, variant, section or page is **enforced by code, not by the model** (so exact hex colours, named fonts, layout choices, density, shapes, included and excluded sections and page counts are honoured deterministically); (3) the model handles only what needs language (interpreting vague text, writing copy, tone); (4) a **verifier** scores the final result against the checklist and a **repair loop** fixes misses; (5) benchmark gates keep it above target.

## 10. The Design Spec
### 10.1 Schema (`packages/ai/design/spec.ts`, Zod)
```
DesignSpec {
  version: 1
  rawText: string                      // the user's description (max 600 chars)
  language: string
  requirements: Requirement[]          // atomic checklist (max 40)
  palette: { primary?: hex, accent?: hex, background?: hex, text?: hex, soft?: hex,
             mode: 'light'|'dark'|'auto', mood?: MoodId, userHex: hex[], avoid?: (hex|name)[] }
  fonts: { heading?: FontRef, body?: FontRef, feel?: FeelId, avoid?: string[] }
  layout: { hero?: HeroId, header?: HeaderId, footer?: FooterId, density?: Density,
            rhythm?: Rhythm, corners?: Corners, buttonShape?: ButtonShape, buttonStyle?: ButtonStyle,
            imageStyle?: ImageStyle, align?: 'left'|'center' }
  design: Partial<ThemeDesign>         // headingCase, display, etc.
  sections: { include: SectionRef[], exclude: SectionRef[], order?: SectionRef[], avoid?: string[] }
  pages: { include: PageRef[], exclude: PageRef[], count?: number }
  tone: ToneId[]                       // up to 3
  copy: { mention: string[], avoidWords: string[], useWords: string[] }
  archetype?: TemplateSlug             // user-named or inferred
  unsupported: { text: string, nearest?: string }[]
  conflicts: { a: string, b: string, resolution: string }[]
  confidence: number                   // 0..1 overall
  clarifications: { question: string, options: string[], requirementId: string }[]  // max 2
}
Requirement { id, kind, target, value, strength: 'must'|'should'|'nice', source: 'user'|'inferred'|'default', status?, evidence? }
```
Requirement kinds (each has a **verifier**): `color_exact` (a role has a given hex within ΔE ≤ 2 in OKLab terms), `color_family` (the primary or accent hue within a named family), `mode` (dark or light background by luminance), `font_exact` (heading or body family id), `font_feel` (the family belongs to the feel group), `hero_layout`, `header_style`, `footer_layout`, `density`, `rhythm`, `corners`, `button_shape`, `button_style`, `image_style`, `alignment`, `section_included` (a block type or purpose is present on the home page), `section_excluded`, `section_order` (before or after), `page_included`, `page_excluded`, `page_count`, `copy_mentions` (normalised tokens appear in page text), `copy_avoids` (absent), `tone` (heuristic: banned and preferred words), `contrast_ok` (all required contrasts pass), `language`. Unsupported requests (for example animations, video backgrounds, parallax, 3D, custom code, third-party widgets, sticky side menus) are recorded in `unsupported` with a nearest supported suggestion and are **excluded from the accuracy denominator** but always shown to the user.
### 10.2 Parsing (`packages/ai/design/parse.ts`: deterministic first, model second)
Deterministic extractors run before any model call and always win for what they find:
- **Colours:** hex codes (3 or 6 digits), `rgb()`, `hsl()`, CSS colour names (all 140), an extended friendly vocabulary of at least 120 names with hex values (sage, terracotta, navy, forest, mustard, coral, blush, charcoal, ivory, burgundy, teal, olive, sand, slate, lavender, peach, cobalt, emerald, rust, plum, ...) kept in `packages/ai/design/colour-vocabulary.ts`; role detection from nearby words ("main", "primary", "brand", "accent", "background", "text", "buttons") with defaults (first colour is primary, second accent); "dark mode", "dark theme", "black background" set mode `dark` (background luminance below 0.2 with a generated palette if the user gave no background); "black and white", "monochrome" set a monochrome palette; moods (warm, cool, earthy, pastel, vibrant, muted, neon, luxury, fresh, natural, playful, corporate) map to palette generators in the existing colour utilities with fixed rules.
- **Fonts:** exact Google font names (fuzzy match against the catalogue with a minimum similarity), categories (serif, sans, mono, rounded, handwritten, display), feels (elegant, modern, techy, friendly, bold, classic, quirky) mapped to curated families and weights.
- **Layout words:** the catalogue `synonyms` for hero, header, footer, variants, shapes ("rounded", "sharp", "pill buttons", "soft corners"), density ("spacious", "airy", "compact", "dense", "lots of white space"), alignment ("centred", "left aligned"), imagery ("big photos", "no images", "arched images", "circular photos").
- **Sections and pages:** words such as "include pricing", "add a menu", "FAQ", "gallery", "booking", "no testimonials", "without a blog", "one page", "five pages", mapped to block types and page templates; negations ("no", "without", "don't want", "remove") produce `section_excluded` or `page_excluded`.
- **Tone words:** friendly, professional, bold, calm, playful, elegant, warm, direct, luxury, technical, etc.
- **Language:** French, Spanish, Portuguese, German, Italian and Swahili input recognised for the common colour, layout and section words (at least 40 words each in `packages/ai/design/vocabulary.{fr,es,pt,de,it,sw}.ts`).
Then the **`design.interpret` task** (model, JSON, low temperature) receives the raw text, the deterministic result and the design catalogue and returns **only** the missing parts and confidence; its output is validated and **never overrides** a deterministic extraction (it may add requirements, resolve vague words such as "modern" using the vocabulary table in Section 11, and propose clarifications). Conflicts (two fonts for headings, "minimal" with "lots of decoration", "dark" with "pastel background") are recorded with a resolution rule: explicit beats inferred; the more specific beats the vaguer; the first mentioned wins ties; both stated in `conflicts` and shown to the user.
### 10.3 Vocabulary table (initial; expand to at least 150 entries in `packages/ai/design/vocabulary.ts`, each with token effects)
| Words | Effect |
|---|---|
| modern, clean | sans fonts (Manrope, Plus Jakarta Sans, Inter), corners soft, display normal, rhythm alternate, imageStyle rounded, density comfortable |
| minimal, minimalist, simple | hero `minimal` or `centered`, density airy, rhythm even, cards flat, rules hairline, fewer sections (max 5), buttons square or soft, one accent |
| elegant, luxury, refined, premium | serif headings (Cormorant Garamond, Playfair Display, Libre Baskerville), headingTracking wide on eyebrows, density airy, corners sharp, buttons outline, imageStyle arch or sharp, muted palette with metal accent |
| bold, loud, striking | display dramatic, headingCase upper, rhythm bold, corners sharp, strong primary, big buttons |
| playful, fun | rounded fonts (Nunito, Poppins, Bricolage Grotesque), corners round, buttons pill, imageStyle circle or arch, vibrant palette, eyebrow chip |
| warm, cozy, friendly | warm palette, soft serif or rounded sans, corners round, imageStyle rounded, rhythm alternate |
| techy, technical, developer, futuristic | mono or grotesk fonts, dark mode likely, grid pattern, corners sharp, hero `product-shot` or `minimal` |
| classic, traditional, timeless | serif fonts, corners sharp-ish, header `centered`, rules hairline, restrained palette |
| editorial, magazine | hero `editorial`, headingCase upper, display dramatic, rules bold, imageStyle sharp |
| earthy, natural, organic | earthy palette, serif or humanist sans, imageStyle rounded or arch, soft shapes |
| spacious, airy, lots of white space | density airy |
| compact, dense | density compact |
| rounded | corners round, buttons round or pill |
| sharp, square, angular | corners sharp, buttons square, imageStyle sharp, hero `diagonal` allowed |
| big photo, full screen image | hero `fullbleed` |
| split screen, image on the left or right | hero `split` with `imageSide` |
| centered, centred | alignment centre, hero `centered` |
| dark, dark theme | palette mode dark |
| colourful, vibrant | vibrant mood, rhythm bold |
| pastel, soft colours | pastel mood, corners round, rhythm alternate |
Words not in the table go to the model with the catalogue, and the result is cached by input hash (per request only).

## 11. Resolver, variation and pipeline
### 11.1 Resolver (`packages/ai/design/resolve.ts`, pure)
`resolveDesign(spec, brief, plan)` returns the final `DesignDecision { archetype (template slug), compositionId, theme, header, footer, heroLayout, heroProps, sectionPlan, pages, report }`:
1. **Archetype scoring:** each template has a profile (hero id, header, rhythm, density, font feel, palette mood, business types, tone words, section habits). Score = sum of requirement weights matched by the template's defaults plus business-type fit; choose the best, with ties broken by the variation seed (11.2). A user-named archetype wins.
2. **Apply overrides** from the spec to the archetype's theme and layout: palette roles (user hex used **exactly**), fonts (named fonts exactly; feel mapped to curated), layout ids, `theme.design`, section includes and excludes (adding ready-made sections from the catalogue, removing optional ones, respecting required structure), page counts within the plan.
3. **Contrast protection that never overrides the user silently:** after applying, run the contrast rules; if a failure involves only roles the user did **not** set, adjust those minimally (existing `adjustForContrast`); if it involves user-set roles, keep the user's colours, adjust the opposite role where possible, otherwise keep and add a `contrast_ok` unmet item with a plain explanation and an automatic suggested alternative.
4. **Dark mode:** `mode: dark` builds a dark background (`#0B0F14`-class neutral tinted by the primary hue unless the user gave a background), text and soft from the existing generators, and picks heroes and header styles that work on dark.
5. **Output a `report`:** per requirement the planned value and expected verifier.
### 11.2 Variation engine (diversity)
`designSeed = hash(teamId, requestId)`; among options within a score tolerance (within 5 percent), pick by seed. Keep `ai_design_history` (team id, archetype, hero, palette family, font pair, header, rhythm, created at); avoid repeating any of the last 5 (archetype, hero, palette family, font pair) combinations for the same team **unless** the user's spec requires it. Never vary anything the user specified. A diversity test generates 100 sites for 10 business types with no user spec and asserts no more than 15 percent share the same (hero, header, palette family, font pair) and every archetype appears.
### 11.3 Pipeline changes (`site.generate`)
New and changed steps (existing steps keep their schemas; all use the Design Spec):
0. Moderate inputs (unchanged), then **`design.interpret`** (deterministic parse plus a small model call; cost target 0.5 credits).
1. `brief` (unchanged, now also receives the spec's tone and copy requirements).
2. **`design`**: replaced by `resolveDesign` (deterministic; the model is used only to break ties among archetypes and to pick among palette moods when the spec is vague).
3. `plan` (uses the resolved section plan, page list and layout rules).
4. `write` (per page; prompts receive the resolved design summary, tone, `mention` and `avoidWords`, and the slot list).
5. `seo`.
6. **`check`** now includes **`verifyDesign`** and the **layout lint** (Section 13); failures run the **repair loop** (11.4).
7. `assemble` stores the Design Spec and the report in `projects.design_spec` and `ai_design_reports`.
8. `image` (optional, unchanged).
Credit targets stay: one page ≤ 10 credits, five pages ≤ 25, including interpret, verify and at most two repair rounds; recalibrate with `pnpm ai:calibrate`.
### 11.4 Verifier and repair loop
`verifyDesign(spec, result)` returns `{ items: [{ requirementId, status: 'met'|'unmet'|'unsupported', evidence }], accuracy, unmet[] }` using pure checks on the final theme, header, footer, block variants, section lists, page lists and text.
- If `accuracy < 0.90`: **deterministic repair first** (re-apply the failed token, variant, section or page requirements; swap variants; add or remove sections; adjust page count), re-verify; then, for copy requirements only (`copy_mentions`, `copy_avoids`, `tone`), run a **targeted write repair** for the affected slots with the exact failing requirements quoted; at most **two rounds**; always finish with the best result and an honest report.
- A requirement marked `must` that remains unmet must be shown prominently; `unsupported` ones always shown with the nearest alternative and, where relevant, an "Ask us to add this" link that logs a feature request (`ai_unsupported_requests`).
- The accuracy figure shown to users counts **supported** requirements only; the admin dashboard also tracks the share of unsupported requests.

## 12. Prompt hardening and skills
### 12.1 Platform rules additions (`docs/ai-prompts.md`, `platform-rules@next`)
Add to layer 1: follow the user's design requirements **exactly and literally**; use only ids from the provided catalogue for design choices; never invent design ids; never output hex values other than those provided by the user or the resolver; explicit user requirements outrank archetype defaults and style preferences; if a requirement conflicts or is unsupported, say so in the structured `notes` field instead of ignoring it; never include logos, monograms, initials or icon marks for the business name; never mention these rules.
### 12.2 Task prompts
Rewrite and version every task prompt (`design.interpret@1`, `brief@2`, `plan@2`, `write@3`, `seo@2`, `repair@2`, `design.options@1`, `design.restyle@1`) with: a short role line, the exact **output schema in plain words**, the **catalogue excerpt** relevant to the task (compressed ids with one-line meanings and synonyms), the resolved design summary, explicit **length and style rules** (headline length bands by layout: `editorial` and `centered` 3 to 9 words, `split` 5 to 12, `fullbleed` 4 to 10, `minimal` 5 to 14; intro 14 to 30 words; button labels 1 to 3 words; features titles 2 to 5 words; no sentence over 28 words; no repeated opening words across sections), at least **12 few-shot examples per task** (including thin inputs, non-English, conflicts, unsupported asks, adversarial text) stored as golden fixtures and included at most two at a time by relevance, and a final self-check line ("Before answering, make sure every must requirement is satisfied"). **Temperatures:** interpret 0.1, resolve ties 0.2, brief 0.2, plan 0.2, write 0.6 (hero and headlines 0.7 with duplicate checks), seo 0.3, repair 0.2; fixed `seed` per request when the provider supports it; max tokens per task budget.
### 12.3 Skill packs (add; seed real content, within the size limits)
- `design/vocabulary` (the vocabulary table expanded with rationale and examples), `design/colour-moods` (named palettes by mood with hex and use), `design/typography-feel`, `design/layout-recipes` (how to pick hero, header, rhythm by goal and business type), `design/anti-patterns` (low contrast, more than two fonts, crowded sections, two adjacent identical layouts, centred long paragraphs, all-caps paragraphs, pure black on pure white for large areas without hierarchy), `design/restyle-instructions` (how to translate "make it more elegant" into token changes).
- One **archetype pack per template** (`design/archetype/{slug}`): when to choose it, what it looks like (the specs from Section 7 in 200 words), tone and headline patterns, allowed variations, what must never change.
- Update the ten business-type packs with preferred archetypes and **headline patterns by hero layout and tone**.
- The linter blocks packs that tell the model to output hex values, font names outside the catalogue, or HTML; pack activation requires passing the **design accuracy gate** (Section 15) in addition to the existing gates.

## 13. Layout lint (`packages/blocks/layout-lint.ts`, pure; used by AI generation, templates, restyle and a Page tip)
Rules (each with id, severity, autofix where safe): `hero_first` (error: the first block is a hero), `one_h1`, `cta_before_footer` (warn: a call-to-action or contact block among the last two), `no_adjacent_same_layout` (warn, autofix by switching variants), `max_consecutive_centred_text` (warn: more than two centred text-only sections in a row), `rhythm_respected` (error: automatic section backgrounds follow the theme rhythm; never two adjacent strong sections), `min_contrast` (error), `consistent_alignment` (warn: mixing left and centred headings more than the archetype allows), `density_matches_spec`, `section_count_range` (warn: home page between 5 and 9 sections, one-page sites up to 12), `no_empty_sections`, `images_have_slots_or_fallback`, `text_within_variant_limits` (error: slot texts within variant-specific length bands so layouts do not break), `shape_not_on_edges`, `pattern_contrast`, `no_letter_mark`, `button_count` (hero has at most two buttons), `heading_order`. The lint runs in the AI `check` step (autofixing what it can), in all template quality gates and as a Page tip (`layout_lint_*`).

## 14. User-facing features
### 14.1 Wizard: "How should it look?" (new step after "Tell us more", only when AI is chosen)
Layout (same wizard shell and action bar as other steps; content max-width 640):
- H1 28 "How should your website look?", sub 16 muted "Describe it in your own words, or pick from the options. You can skip anything."
- **Describe the look** Textarea (min-height 112, max 400, counter, placeholder "For example: Modern and clean, deep green and cream, serif headings, big photo at the top, lots of white space"). Under it **example chips** (height 36, radius 999): "Modern and minimal", "Warm and friendly, earthy colours", "Dark and bold with neon accents", "Elegant, serif headings, lots of white space", "Playful and colourful" (click inserts the text).
- **Style** chips (multi-select up to 3): Modern, Minimal, Bold, Elegant, Playful, Warm, Techy, Classic, Editorial (height 40).
- **Colours:** a row with a main-colour swatch button (44, opens the colour picker; "Use my logo colours" ghost sm when a logo exists), an "Accent colour" swatch (optional), and a segmented control "Background": Light, Dark, Let AI choose. Helper "We will use your exact colours."
- **Fonts:** Select "Feel": Let AI choose, Modern sans, Classic serif, Friendly rounded, Bold display, Techy mono, plus an Input "Or name a font" with autocomplete from the font catalogue (helper "Any Google font").
- **Top of the page** (hero) option cards: a grid (2 columns at 360, 3 from 640, 5 from 1024) of 11 wireframe cards (the ten hero layouts plus "Let AI choose"), each 96 high with a mini drawing and a 13/600 label.
- **Spacing and shape:** segmented "Spacing": Airy, Balanced, Compact; segmented "Corners": Round, Soft, Sharp; segmented "Buttons": Pill, Rounded, Square.
- **Sections:** two chip groups "Include" (Pricing, Gallery, FAQ, Team, Testimonials, Map, Booking button, Newsletter-free, Menu) and "Leave out" (the same list); a chip cannot be in both.
- A line 13 muted "We follow your choices exactly. If something is not possible, we tell you."
- Primary "Show me 3 looks" (with `CreditChip` "About 2 credits") and a ghost "Skip, just write it" (uses the spec as is). **Clarifications** (max 2) appear inline when the interpreter is unsure ("You said blue. Which blue?" with 3 swatch options), free of charge and skippable.
### 14.2 "Pick a look" (3 previews)
`design.options` returns three **distinct** resolved designs (different archetype or hero, header and palette families, all satisfying the requirements). Each card (padding 0, radius 16, border 1px, hover border `--primary`) shows a **live render** (the renderer, scaled, non-interactive, 16:10) of header + hero + one section with the website's real name and neutral sample copy built from the brief (no AI writing yet), then a summary line of chips (for example "Elegant serif", "Cream and green", "Image on the right", "Spacious") and a row of five palette dots. Buttons under the cards: "Use this look" (primary) and "Show 3 more" (secondary, `CreditChip`, up to 3 times, never repeating previous options). The chosen design is saved to the draft and shown on the summary step. Cost target 2 credits per set, cap 4.
### 14.3 "How we followed your request" (success view and Tips panel)
After generation, a Card (padding 20, radius 16) titled "How we followed your request" with an accuracy line ("9 of 10 done", progress bar) and a checklist (rows min-height 44: status icon (check-circle `--success`, alert-triangle `--warning-text` for unmet, info for unsupported), the requirement in plain words ("Main colour is #1E40AF", "Headings use a serif font", "Pricing section included", "Video background: not available, we used a full-width photo"), and a "Change" ghost sm button that opens the right control (Design tab, Add section, etc.)). Unmet or unsupported items are listed first. A "Restyle with AI" button opens 14.4.
### 14.4 Restyle with AI (design only)
- **Entry points:** Design tab (top card "Restyle with AI", sparkles), the command palette, the success view, the Templates apply success view.
- **Dialog** (width 560, sheet on mobile): Textarea "How should it change?" (max 300, placeholder "Make it more elegant, use deep green, serif headings, bigger hero image"), chips ("More elegant", "More modern", "Bolder", "Softer", "Darker", "Lighter", "More spacious", "More compact", "Rounder", "Sharper"), a switch "Keep my colours" (default on when the user has set custom colours), `CreditChip` "About 2 credits", "Preview" primary md.
- Result: **before and after** side by side (two scaled live renders of the homepage, 16:10 each, labelled "Now" and "New") with a list of changes ("Headings: Libre Baskerville → Cormorant Garamond", "Corners: soft → sharp", "Hero: split → editorial") and the verified requirements; buttons "Use the new look" (applies theme, header, footer, variants and section options only, **never text**, as one undo step), "Try again" (new variation), "Cancel". Accuracy rules apply (the instruction becomes requirements and is verified).
- Task `design.restyle` (credits target 2, cap 4). Content is never changed; `layout lint` runs on the result.
### 14.5 Writing style settings: "Look and feel"
Add a card to `settings/writing` "Look and feel" mirroring the wizard fields (style chips, colours, fonts, spacing, corners, buttons, hero choice, sections to include or leave out) saved to `project_settings.design_prefs`; AI generation, restyle and section generation use them as defaults (explicit requests override).
### 14.6 Section and page generation
`section.generate` and `page.generate` read `design_prefs` and the current theme and layout choices; they may choose variants from the catalogue to match the site (for example use `lookbook` products on a boutique design) and must pass the layout lint with the page's neighbours; "Describe it" accepts style words ("with big numbers", "as a table", "in a dark band") mapped through the vocabulary.

## 15. Data, evals and gates
### 15.1 Database (new migrations)
`projects`: add `design_spec jsonb`, `renderer_version text`, `needs_manual_publish boolean default false`. `publishes`: add `renderer_version text`, `source_key text`. `project_settings`: add `design_prefs jsonb default '{}'`. `ai_design_reports` (`request_id`, `team_id`, `spec jsonb`, `result jsonb`, `accuracy numeric`, `weights jsonb`, `unmet jsonb`, `unsupported jsonb`, `archetype text`, `variants jsonb`, `rounds int`, `created_at`), `ai_design_history` (`team_id`, `request_id`, `archetype`, `hero`, `palette_family`, `font_pair`, `header`, `rhythm`, `created_at`), `ai_unsupported_requests` (`id`, `team_id`, `text`, `nearest`, `count`, `created_at`). RLS: owners and admins read their team's reports; admin console reads all; server writes.
### 15.2 Fixtures and gates (`packages/ai/eval/design`)
- **At least 200 design briefs** across: exact hex colours (primary only, primary and accent, three colours), named and mood colours, dark mode, fonts (exact, category, feel), hero choices, header choices, density and shape words, section includes and excludes, page counts, tone words, copy mentions and avoid words, vague words ("modern", "nice"), contradictions, unsupported requests, French, Spanish, Portuguese and Swahili input, very long input, empty input, adversarial input (instructions to ignore rules, HTML, emoji, RTL text, brand impersonation). Each has expected requirements with strengths and the expected resolved values.
- **Deterministic gates (CI, fake provider):** extraction precision and recall at least 95 percent on requirements that have deterministic extractors; **exact hex honoured in 100 percent** of cases; named fonts honoured 100 percent when in the catalogue; excluded sections never present 100 percent; page counts honoured 100 percent within plan limits; unmet or unsupported requests reported 100 percent; layout lint zero errors on all generated results; contrast rules satisfied or reported 100 percent.
- **Model benchmark (manual with real models, `pnpm ai:eval -- --task design`):** weighted accuracy at least **90 percent** on the supported requirements (including vague-word cases), conflict resolution correct in at least 90 percent, clarification questions asked in at most 15 percent of briefs, and the diversity test (11.2) passes. Results are written to `docs/ai-benchmarks/` and shown in the admin console.
- **Activation gate for skill packs and prompt versions:** a pack or prompt version can be activated only if the design accuracy gate does not regress and stays at or above 90 percent; overrides need a written reason.
### 15.3 Admin dashboard additions (`/admin/ai`)
"Design accuracy" page: weekly accuracy by task, model and pack version, unmet requirement kinds ranked, unsupported requests ranked (with counts and "Mark as planned"), diversity metrics, the repair rate, and a requirement explorer (open a report to see the spec, verifier evidence and outputs).

## 16. Tests (in addition to Part A and the gates above)
- **Renderer and templates:** snapshots for every new hero layout, header style, footer layout, section shape and pattern, and block variant at 390, 768 and 1280 with three themes (light, dark custom, high-contrast) and with and without images (fallback backgrounds); the distinctness gate; the layout lint on all templates; no letter marks; default-theme parity (old content renders unchanged); migration of old hero ids; accessibility (axe) on every template page and variant fixture; Lighthouse targets; keyboard navigation for the `minimal` header panel and the `centered` header menu.
- **Data binding:** the Section 8.5 matrix for all 10 templates, including the sample-leak scan, hidden blocks when data is missing, SEO fields and JSON-LD with real data, wordmark text only.
- **AI design:** unit tests for every parser (colours: hex, rgb, names, moods, role detection, dark mode; fonts: fuzzy matches and feels; layout synonyms; negations; sections and pages; languages), the spec schema and conflict resolution, the resolver (archetype scoring, overrides, exact hex preservation, contrast protection that keeps user colours, dark mode builder), the variation engine, the verifier for every requirement kind (met, unmet, unsupported), the repair loop (deterministic first, targeted write repair, two-round limit, honest report), prompt composition snapshots with the catalogue excerpt and few-shot selection, the restyle task (content never changes, undo works), looks preview determinism and no repeats, credit estimates and caps for the new tasks, injection and adversarial fixtures, `design_prefs` effects.
- **End to end (Playwright, desktop 1280 and mobile 390, fake provider with scripted design outputs):** the wizard design step (every control), clarifications, 3 looks with live previews, "Show 3 more", choosing a look, generation, the success view with the "How we followed your request" report (met, unmet and unsupported items) and its "Change" shortcuts; a brief with exact colours and a named font ends with those exact values in the saved theme and in the **published page's computed styles** (assert `getComputedStyle`); excluded sections absent; page count honoured on Basic and one-page on Free; restyle before and after, apply and undo; the Tips panel layout lint; applying each of the 10 templates to a website with real data and checking the published output (header wordmark text, contact info, no sample strings, styles present); the distinctness screenshots of all 10 published home pages side by side; the refresh job restoring styles on a previously unstyled published site.
- **Visual:** `pnpm screenshots` output reviewed against this spec, including a contact sheet of the 10 templates' home pages and each hero layout.

## 17. Documentation
`docs/published-css-incident.md`, `docs/design-system.md` (tokens, variants, header, footer, shapes, patterns with the exact sizes above), `docs/template-designs.md` (the ten designs, distinctness matrix, art directions, quality gates), `docs/ai-design.md` (Design Spec, parsers, resolver, variation, verifier, repair loop, vocabulary, accuracy definition and gates, restyle and looks), updates to `docs/blocks.md`, `docs/templates.md`, `docs/templates-ai.md`, `docs/ai.md`, `docs/ai-prompts.md`, `docs/skill-packs.md`, `docs/publishing.md`, `README.md`, `CLAUDE.md`.

## 18. Definition of done
- **Part A:** published websites are always styled; the CSS comes from one source shared by the editor and the publisher; the publish gate, post-upload verification, live probe and automatic rollback prevent unstyled sites; `renderer_version`, stored sources and the refresh job repair existing sites; a test reproduces the original bug and fails if it returns; the root cause is documented.
- **Part B:** the renderer supports the new header, footer, hero, shape, pattern and block variants with the exact specs; the 10 templates look like different real websites (distinctness gate passes), have no letter-in-rectangle marks, use brand-neutral copy, pass all quality gates, and every applied template shows the website's own name, contact details, hours, social links and titles with no template sample data left.
- **Part C:** user design descriptions become verified requirements; exact colours, fonts, layouts, sections and pages are honoured by code; the verifier and repair loop reach at least 90 percent weighted accuracy on supported requirements in the benchmark; unmet and unsupported requests are always reported; wizard looks, previews, the report card and Restyle with AI work; AI sites are varied, organised and pass the layout lint; skill packs and prompts are hardened and gated.
- All unit, integration, end-to-end, accessibility, visual and performance checks pass locally and in CI.
- Finish with a short summary: the Part A root cause and how it was verified on a real site, what was built, fonts or palette values substituted, deviations found in the screenshot review, the distinctness and accuracy results (and what remains a manual benchmark), assumptions, anything stubbed, and the manual steps for me (deploying Part A first, running `job:republish-stale` and checking a live site, regenerating art and thumbnails, seeding the new template versions, running the AI design benchmark with real models, reviewing and activating the new skill packs).

input field to add username to delete website is jumping,i type a letter and lose focus and have to click on it to focus again.

Also, when we publish websites, it is not showing when we open it now, it seems the data being saved in KV are not full. Look into this and help me fix this again.; start by creating a to-do list and it is the one we will keep tracking, check what is finished before moving to the next
