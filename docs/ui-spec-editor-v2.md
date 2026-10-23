# Visual editor v2

For the editor, `docs/ui-spec-editor-v2.md` overrides `docs/ui-spec-editor.md` where they conflict.

## 8. Editor UI specification (atom level)
All values follow `docs/ui-spec.md` and `docs/ui-spec-app.md` (tokens, Button, Input, Badge, Dialog, Menu, Toast, InfoBox, Card, segmented control, switch row, list editor, image field, link field, icon picker, section background control). Reuse them. Dashboard UI uses dashboard tokens; only the canvas uses site tokens.

### 8.1 Layout, top bar, canvas frame and zoom
- **Grid:** the editor body is a three-column grid `grid-template-columns: var(--outline-w) minmax(0, 1fr) var(--panel-w)`; `--panel-w` is 340; `--outline-w` is 264 at 1280 and above when the outline is open (default open), otherwise 0. Between 1024 and 1279 the outline is a drawer (overlay, 280 wide, left, scrim, opened from the top bar "Sections" button or the `[` key). Below 1024: the bottom bar and sheets from the earlier spec (Section 8.17).
- **Top bar** (height 56, as before) gets these changes:
  - Left group: "Pages" back button; a 1x24 divider; the **page switcher** (Section 8.13); "Home" badge.
  - Centre group (768 and above): device switcher (as before) and, at 1024 and above, a **zoom control** to its right: a button (height 40, padding 0 12, radius 12, bg `--surface-muted`, text 14/600 "Fit", chevron-down 16, aria-haspopup menu) opening a Menu (width 160) with "Fit to screen" (default), "100%", "75%", "50%", check on the current. In `Fit` the scale is `min(1, availableWidth / deviceWidth)` (never below 0.4); other options set the scale, and the canvas scrolls horizontally when it does not fit. The caption under the frame shows "{device width} px, shown at {n}%".
  - Right group: Undo, Redo, **Page tips chip** (Section 8.15), "Share" ghost md with share-2 icon (opens Section 8.14), "Preview" secondary md, "Publish" (`PublishButton`). At 768 to 1279 "Share" and "Preview" move into the overflow kebab; below 768 everything except Undo-less compact set follows the mobile bar rules.
- **Frame:** device widths: Phone 390, Tablet 768, Computer 1200 (the real layout width). The frame wrapper is `width: {deviceWidth}px; zoom: var(--k)` (centred with `margin-inline: auto` on a wrapper of width `deviceWidth * k`). Below 768 viewport width the frame is the screen width, no zoom, no chrome (as before). Radius 16, 1px `--border`, shadow card, overflow hidden, background `--s-bg`. Width changes animate over 250 ms (not under reduced motion). Floating toolbars and insert points compute positions from `getBoundingClientRect` so they are correct under zoom. Drag and drop uses dnd-kit with a modifier that corrects pointer coordinates by `1 / k`.
- **Selectable header and footer:** hovering shows the dashed outline and tag "Header" or "Footer"; clicking selects (no drag handle, no delete). Their panels are in Section 8.9.

### 8.2 Left "Sections" outline (new)
- Container: width `--outline-w`, bg `--surface`, right border 1px `--border`, flex column, full body height.
- Header (height 48, padding 0 8 0 16, bottom border): "Sections" 14/700, count pill (neutral, 12/700) and a 40x40 ghost button (panel-left-close icon, aria-label "Hide sections list"). When hidden, a 40x40 ghost button with the list icon sits at the top-left of the canvas area (inset 12, `--surface` background, border, radius 12) to reopen it.
- Pinned rows: "Header" (top) and "Footer" (bottom of the list), each row 44 high, icon (panel-top, panel-bottom) and label, not draggable.
- Section rows (min-height 52, padding 6 8): a 28x44 drag handle (grip-vertical 16, visible on hover, focus and always on touch), block icon 18 in a 32x32 tile (radius 10, bg `--surface-muted`), then two lines: block name 14/600 and `blockSummary` 12 `--text-muted` (heading or first words, truncated). Hidden sections: eye-off icon 16 at the right and 50 percent opacity; shared sections: a link-2 icon 14 (accent) beside the name. Selected: bg `--primary-soft`, name `--primary`. Hover: bg `--row-hover`, kebab 36x36 appears (Menu: Duplicate, Hide from website or Show on website, Copy, Save as shared section, Delete (destructive)). Hover also highlights the block on the canvas (1.5px outline `--primary` at 50 percent) and clicking scrolls it into view (smooth, centre; instant under reduced motion).
- Drag and drop reorder with pointer, touch (press and hold 250 ms) and keyboard (handle focus, Space, arrows, Space, Escape) with live-region announcements ("Picked up Gallery. Position 3 of 8.").
- Footer (padding 12, top border): "Add a section" secondary md full width (plus icon) opening the picker.
- Empty page: the list shows only Header and Footer with the text "No sections yet" 14 muted centred.

### 8.3 Right panel structure
- Header (height 56) as before; below it a **segmented tab row** (height 44, padding 0 16, margin-top 12) whose options depend on the selection:
  - Nothing selected: "Page", "Design", "Tips" (with the count badge when above zero).
  - A block selected: "Edit", "Style", "Section".
  - Header or footer selected: "Edit", "Style".
  - Panels opened from elsewhere (Add section, History, Share) keep their own headers without tabs.
- Content: scrollable, padding 20, gap 20, group labels 12/700 caps. The last open tab per context is remembered during the session.
- Mobile (below 1024): the same tabs appear at the top of the bottom sheet (below the handle and header).

### 8.4 Block panels: Edit and Style tabs (per block)
Use the standard fields from the earlier specs (Input with counter, Textarea, List editor, Image field, Link field, Icon picker, segmented control, switch row, Select). Character limits match Section 5.5; counters show when within 20 percent of the limit. List editors show item thumbnails or icons in collapsed headers, support drag reorder, duplicate item (copy icon 36x36) and "Add item", with the limit text. New field types:
- **Price field:** Input with helper "Write it the way you want it shown, for example $20 or RWF 5,000."
- **Hours editor:** see Section 9.1 (reused for `opening-hours` custom hours).
- **File field:** like the image field with a file-text tile, "Choose a PDF", shows name and size, "Remove".
- **Tags field (menu items):** a row of 7 toggle chips (height 36) with labels Vegetarian, Vegan, Spicy, Gluten-free, Halal, New, Popular; at most 3 selected (others disable with helper "Up to 3").
- **Option cards:** the layout choosers as 2-column grids of 72-high cards with a mini wireframe drawn in `--text-muted` and a 13/600 label (as in the earlier spec).

### 8.5 "Section" tab (every block)
Order and exact controls:
1. **Background.** Label "Background". A grid of seven tiles (3 columns, gap 8; each 72x64, radius 12, 1.5px `--border-strong`, centred 24 px swatch sample above a 12/600 label; selected: 2px `--primary`, bg `--primary-soft`, check badge): Plain, Soft, Brand, Accent, Colour, Gradient, Picture (sample drawn from the current theme). Below the grid (margin-top 12):
   - Colour: a **colour field** (48x48 swatch button, hex text 15 mono, "Change" label) opening the colour picker (Section 8.7). A contrast chip under it: "Text on this colour: 9.1 to 1. Easy to read" (success) or "3.2 to 1. Hard to read" (warning) with a "Fix it" ghost sm button that adjusts the colour minimally (or switches text colour).
   - Gradient: two colour fields ("From", "To") and a segmented "Direction" (Down, Diagonal, Across, Up).
   - Picture: Image field, "Darken or lighten" segmented (None, Dark, Light, Brand), a slider "Strength" (0 to 80, step 10, label showing the value), "Text colour" segmented (Automatic, Light, Dark), and a note "Picture is cropped around its focus point."
2. **Spacing.** Two rows "Space above" and "Space below", each a 5-option segmented control (labels "None", "S", "M", "L", "XL"; tooltips "No space", "Small", "Normal", "Large", "Extra large"; default "M"). Helper "Space between this section and the one next to it."
3. **Width.** Segmented "Narrow", "Normal", "Wide", "Full". Helper "How wide the content is."
4. **Link name.** Input with a `#` prefix addon, placeholder from `suggestAnchor`, helper "Use this to link to this section, for example from a button. Letters, numbers and dashes only." Errors: "Another section already uses this name." "Start with a letter. Use letters, numbers and dashes." A "Copy link" ghost sm button copies `{live address}/{path}#{name}`.
5. **Show in menu.** Input "Menu name (optional)" (max 24), helper "Adds this section to your website menu. Needs a link name; we add one for you." Setting a menu name auto-fills the link name if empty. Disabled on pages other than the homepage with helper "Section menus work on your homepage."
6. **Show on.** Three switch rows: "Phones", "Tablets", "Computers" (default on). Turning off the last one is prevented (toast "Turn on at least one, or hide the section.").
7. **Hide from my website.** Switch row with helper "Keeps it here so you can finish it later, but it will not be published."
8. **Reset section style** ghost md (danger text) with a ConfirmDialog "Reset this section's style?" "Your text and pictures stay. Background, spacing and width go back to normal."

### 8.6 "Design" tab (nothing selected)
Accordion of four sections (single-open, each header 56 high with title 16/600, a one-line summary 13 muted on the right such as "Terracotta" or "Fraunces and Nunito Sans", chevron). A **live sample card** is pinned at the top of the tab (height 120, radius 16, bg from the theme background, padding 16, border): heading sample "Your headline" in the heading font, a line of body text, a button in the current style, and a chip.
1. **Colours.**
   - **Ready-made palettes:** filter chips row (All, Fresh, Warm, Cool, Bold, Soft, Neutral; horizontal scroll). Grid of palette cards (2 columns, gap 12; each radius 16, 1.5px `--border-strong`, padding 10; a 44-high strip of five colour chips (primary, accent, background with border, text, soft), name 14/600; selected 2px `--primary` plus check badge; hover border `--primary`). Selecting applies instantly with undo support.
   - **Make your own** (a full-width card with a pencil icon and a "Custom" pill when no preset is active; expands inline): five rows (min-height 64, gap 12): swatch button 44x44 (radius 12, 1.5px border), then name 15/600 and description 13 muted, then hex 14 mono on the right: "Main colour" (buttons and links), "Accent" (highlights and badges), "Page background", "Text", "Soft background" (boxes and cards). Clicking opens the colour picker. A small contrast indicator on the text and main colour rows (check or alert icon with tooltip).
   - Buttons under the rows: "Suggest matching colours" (secondary md, wand icon, opens a sheet of the five harmonies as palette cards with a "Shuffle" ghost button), "Pick from my logo" (secondary md, image icon), "Reset" (ghost md, returns to the last preset or business-type default after confirmation).
   - **Summary box** (InfoBox): success "Your text is easy to read on your background." or warning "Some colours are hard to read together." with a "Fix it for me" primary sm button (applies `adjustForContrast` to text, link and on-colours minimally, one undo step).
   - **My colours:** row of saved colour dots (28, gap 8, max 12) with the label "My colours" and an "Add" button when a colour is being edited; long-press or right-click a dot opens "Remove".
2. **Fonts.**
   - Two **font fields** ("Headings", "Text"): button height 64, radius 12, 1.5px border, showing the family name in its own font (22), the category and style count (13 muted), chevron. Clicking opens the font picker (Section 8.8). Below each: weight segmented (headings: available among Medium 500, Bold 700, Extra bold 800 (limit to what exists); text: no choice, helper "Text uses the regular style and bold where needed.").
   - **Suggested pairs:** a horizontal chip row of 12 pairs (height 40, padding 0 14, radius 999; each chip shows the pair name; selected state as usual).
   - **Text size:** segmented "Small", "Normal", "Large".
   - **Font weight meter:** "Fonts add about {n} KB to each page." with a progress bar (success under 80 KB, accent under 120 KB, danger above) and helper "Fewer fonts make your website faster." The number comes from catalogue file sizes.
3. **Buttons and shapes.**
   - Sample strip (height 96, bg `--surface-muted`, radius 16, padding 16, flex gap 12) showing a button, a card and a picture with the current styles.
   - "Button shape" segmented with drawn samples (Square, Soft, Round, Pill); "Button style" segmented (Solid, Outline, Soft); "Button size" segmented (Normal, Large); switches "Capital letters on buttons" and "Soft shadow under buttons".
   - "Boxes" segmented (Flat, Outline, Shadow) for card style; "Corners of pictures and boxes" segmented (Sharp, Soft, Round).
4. **Spacing.** "How much room" segmented (Compact, Normal, Airy) with a 56-high sample strip (three bars with the section gap drawn to scale).
All Design changes preview live in the canvas, save through the existing debounced save to `project_settings.theme`, and are single undo steps (grouped within 800 ms).

### 8.7 Colour picker popover (atom level)
- Opens anchored to the colour field; on small screens it is a bottom sheet (height auto, max 90dvh, top radius 24, handle). Popover: width 328, padding 16, radius 20, bg `--surface`, 1px `--border`, shadow raised, z-index 60; focus trapped; Escape cancels.
- **Header** (height 32): "Choose a colour" 15/700; a 32x32 close button.
- **Colour wheel** (margin-top 12, centred): outer diameter 232. A **hue ring** (thickness 28) drawn with `conic-gradient` over all hues at full saturation; its handle is a 24 px circle with a 3px white border and a 1px dark outer ring (visible on every colour), filled with the current hue. Inside the ring a **saturation and brightness square** 124x124 (radius 8): background layers `linear-gradient(to top, #000, transparent)` over `linear-gradient(to right, #FFF, hsl(hue 100% 50%))`; its handle is a 20 px circle with a 3px white border and a dark outer ring filled with the current colour. Pointer and touch dragging with pointer capture, 60 fps, no layout thrash (draw with CSS gradients and transforms only).
- **Fine-tune sliders** (margin-top 16): "Lighter or darker" (brightness) and "Softer or stronger" (saturation), each a 16-high track with a gradient preview and a 24 px thumb (role slider, step 1, arrow keys, aria-valuetext "Brightness 62 percent"); a third optional slider "Colour" (hue 0 to 359) for keyboard users.
- **Value row** (margin-top 16): a 44x44 split swatch (left half the old colour, right half the new, radius 12), a hex input (height 44, prefix "#", uppercase, mono 15, accepts 3 or 6 digits, pastes with or without "#", invalid state with message "Use 6 letters or numbers, like 0B6B4F"), and an **eyedropper** icon button 44x44 (pipette icon) shown only when `EyeDropper` exists (tooltip "Pick a colour from your screen").
- **More** disclosure (details, 14/600): RGB inputs (three Inputs, height 40, 0 to 255) and a plain-words description line from `describeColour` ("Dark green").
- **Contrast row** (when the field has a partner colour, for example text on background): label "On your page background" with a chip showing the ratio and a status ("Easy to read", "OK for big text", "Hard to read") using success, warning and danger tokens, and a "Fix it" ghost sm button.
- **Saved and recent colours** (margin-top 16): label "My colours" with dots 28 and a "Save this colour" ghost sm button (disabled at 12); label "Recent" with up to 8 dots (stored locally per project). Dots are buttons with aria-labels from `describeColour`.
- **Footer** (margin-top 16, buttons right-aligned): "Cancel" secondary md (restores the previous colour) and "Done" primary md. Changes preview live in the canvas as the user drags, and are committed as one undo step on Done (or on closing by clicking outside).
- Accessibility: wheel parts have `role="slider"` with `aria-label` ("Colour", "Saturation and brightness"), arrow keys move 1 unit (Shift 10), Home and End jump, Tab order: hex, wheel hue, square, sliders, eyedropper, saved colours, buttons.

### 8.8 Font picker dialog (atom level)
- Dialog width 560 (full-screen sheet below 640), radius 24. Header: H3 "Choose a font for {headings|text}" and a close button. Search (margin-top 16): Input height 48 with search icon, placeholder "Search fonts", debounce 200 ms. Filter chips (margin-top 12; horizontal scroll; height 36): All, Sans, Serif, Display, Handwriting, Monospace. A "Your text" Input (height 44, max 40 characters, default the business name, label "Try your own words") controls the sample text in rows.
- First group (when no search or filter): "Good for {business type}" (6 suggestions from a small mapping by type) then "Popular".
- List: virtualised, row height 76, padding 12 16, bottom border 1px `--border`; the family sample text at 26/1.2 in its own font (heading weight for headings, 400 for text), then the family name 13/600 and meta "{Category}, {n} styles" 12 muted; right a check-circle 20 `--primary` when selected. Rows load their font file lazily when within 2 screens (font-display swap, a 1 line skeleton until loaded). Hover bg `--row-hover`; selected bg `--primary-soft`; keyboard: arrows, Enter selects, type-ahead.
- Footer (margin-top 16): "Cancel" secondary md and "Use this font" primary md. Choosing a font previews live in the canvas. If the site would exceed two families the dialog shows an InfoBox (warning) "Websites use two fonts at most, one for headings and one for text."
- Failure states: offline or catalogue error (InfoBox danger with "Try again" and the fallback curated list still usable); font file failed ("We could not load that font. Please choose another.").

### 8.9 Header and footer panels
Selecting Header or Footer in the canvas or outline opens these. All fields live-update the canvas. Header tabs "Edit" and "Style"; footer the same.
**Header, Edit:** Logo (Image field; helper "Square or wide logos both work."), "Light logo for dark backgrounds" (Image field, optional), Business name is read-only with a link "Change in Settings". "What the menu shows" segmented ("Pages", "Sections of the homepage", "Both"); "Extra links" list editor (label and Link field, up to 5); "Button in the header" switch with label, link and style ("Solid", "Outline") fields; "Announcement bar" switch with text (120), link, colour segmented ("Brand", "Accent", "Dark", "Custom" opening the colour picker).
**Header, Style:** Logo size slider (24 to 64, step 4, shows "36"), Logo or name segmented ("Automatic", "Logo only", "Name only"), Menu position segmented ("Left", "Centre", "Right"), Background segmented ("Plain", "Soft", "Brand"), "Line under the header" switch, "Stay at the top when scrolling" switch.
**Footer, Edit:** "About text" Textarea (200), Link columns list editor (up to 3; each with a title and up to 6 links), switches "Show social links", "Show contact details", "Show opening hours", "Copyright text" Input (placeholder "© {year} {business}", helper "{year} and {business} fill in automatically").
**Footer, Style:** Layout option cards ("Simple", "Columns", "Centred"), Background segmented ("Soft", "Plain", "Brand", "Dark").
Both panels end with an InfoBox (info): "The menu also shows pages marked 'Show in menu' in Page settings."

### 8.10 Add-section picker (redesigned)
- Entry points as before. Desktop: the right panel; mobile: a sheet at 90dvh. Segmented control (height 44) at the top with three tabs: "Sections", "Ready-made", "Saved".
- A **search Input** (height 44, search icon) under the tabs on Sections and Ready-made (filters by name, description, tags and business type words).
- **Sections tab:** groups with these headings and items (icon, name, description). Group label 12/700 caps margin-top 20. Item rows as in the earlier spec (min-height 72, icon tile 48 `--accent-soft`).
  - Start: Hero ("A big welcome with a headline and buttons."), Heading ("A title to start a part of your page."), Text ("Paragraphs, lists and columns."), Picture with text ("A picture beside your story."), Quote ("A big quote or statement.")
  - Pictures and video: Picture, Gallery ("A grid, wall or slider of pictures."), Video ("A video people open on YouTube or Vimeo."), Before and after ("Show the difference your work makes.")
  - Sell: Products ("Show what you sell. Customers order by WhatsApp, link, email or phone."), Services and prices ("List what you do and what it costs."), Menu ("A menu with sections, prices and tags."), Pricing plans ("Compare packages side by side."), Downloads ("PDF files people can download.")
  - Show your work: Projects ("Show your best work with results."), Testimonials ("What your customers say."), Numbers ("Big numbers that build trust."), Logos ("Clients, partners or where you were featured."), Team ("Introduce your people."), How it works ("Explain your steps."), 
  - Help visitors: Questions, Opening hours, Map and directions ("Your address with direction buttons."), Contact details, Contact form, Contact buttons, Social links, Call to action ("Invite people to take the next step."), Link list ("A stack of big buttons.")
  - Layout: Button, Space, Line.
- **Ready-made tab:** a chip row for categories (All, Hero, About, Services, Products, Portfolio, Trust, Menu, Location, Contact, Links; horizontal scroll, height 36) and a "For {business type}" toggle chip (default on, sorts matching templates first without hiding others). Template cards as in the plugins prompt (aspect 16:10 live preview using the project's theme and sample content; name 15/600; description 13 muted). Plugin templates appear in their category with a plugin chip and the existing On or Off behaviour. Section 8.10.1 lists the ready-made templates.
- **Saved tab:** shared sections (Section 8.11) as preview cards with the usage count ("Used on 2 pages") and a kebab (Rename, Delete). Empty state: bookmark icon 40 in a 72 circle and "No saved sections yet. Save a section from its menu and reuse it on any page."
- After inserting, the new block is selected, scrolled into view and the toast "{name} added." with "Undo" appears.

**8.10.1 Ready-made templates (core, `pluginId: 'core'`)** ... (template list and page starters as defined in the task).

### 8.11 Shared (saved) sections
- Toolbar and outline menus: "Save as shared section" opens a Dialog (440): H3 "Save this section", text 15 muted "Reuse it on other pages. If you change it later, it changes everywhere.", Input "Name" (required, max 60, default from `blockSummary`), buttons "Cancel" and "Save" (loading "Saving..."). On success the block is replaced by a `shared` reference, selected, with toast "Saved. You can find it under Saved." Limit message from `SHARED_LIMIT_REACHED`.
- A shared block shows a **accent** tag in the canvas: link-2 icon and "Shared: {name}". Its panel starts with an InfoBox: "This section is shared. Changes here appear on every page that uses it. Used on {n} page{s}." followed by normal Edit, Style and Section fields (editing writes to the shared definition) and two buttons at the bottom: "Make a copy for this page only" and "Rename or delete".
- Saving: edits to a shared block save through `save_shared_section` with its own revision, in the same autosave queue. A conflict shows the same dialog as pages. The save status chip reflects the combined state.
- Renaming: Dialog like save. Outline and picker show shared sections with the link-2 icon.

### 8.12 Image tools
- **Image field** (everywhere): when a picture is set, an "Edit picture" ghost sm button appears beside "Change picture" and "Remove".
- **Edit picture dialog** (width 760; full-screen on mobile): left, a canvas area (max-height 480) with the picture; right (320 wide) controls: focus point, preview crops, crop and turn, footer actions.
- **Replace file** (Pictures page and image field menu): choose a new file; process; overwrite path, dimensions, size, set `replaced_at`; every use updates after the next publish; refresh thumbnails by version query string.
- **Use the YouTube picture:** server action fetches `maxresdefault.jpg` then `hqdefault.jpg`, 5s timeout, 2 MB cap.
- **Alt text nudge:** after choosing a picture without a description, inline InfoBox with an Input.
- **Stock photos:** third tab "Free photos" with a "Coming soon" empty state.

### 8.13 Pages: switcher, duplicate, starters, copy and paste
- **Page switcher:** chevron segment opening a Menu (width 320, max-height 420): search Input (when >6 pages), rows with title, Home chip, eye-off, check; footer actions "Add a page", "Duplicate this page", "All pages".
- **Add page dialog (update):** width 640; step 1 starter grid, step 2 name and address. Page limit rules unchanged.
- **Duplicate page:** dialog with name default "{title} (copy)", read-only new address, copies content with new block ids and unique anchors, keeps shared references, sets `duplicated_from`.
- **Copy and paste sections:** clipboard `{ v: 4, blocks: [...] }` with `gs-clipboard:` prefix and localStorage fallback; paste validates and regenerates ids, resolves anchors, keeps same-project pictures only.

### 8.14 Private preview links
- **Share dialog** (width 480): expiry segmented 1/7/30 days, create link, copy, WhatsApp/email links, active links list, revoke.
- **Viewer** `/p/{token}/{path?}`: hashed token validation, rate limit 60/min/IP, noindex, no-store, no-referrer; draft bar, device switcher, frames, forms disabled; expired/revoked show ended page.

### 8.15 Page tips (checks)
- **Engine** `packages/page-checks`: pure `runChecks` returns checks. Runs on idle after changes and in publish preflight.
- **Panel**: summary card, groups "Fix these" and "Nice to have", rows with "Show me"/"Fix it", dismissible localStorage.
- **Top bar chip:** none: success soft; else warning count (warn only) and neutral tips.
- **Publish integration:** preflight shows all warn results across visible pages, counts tips as one info row; none block publishing; store summary in `publishes.checks`.

### 8.16 Command palette and shortcuts
- **Command palette** (Ctrl/Cmd+K or `/`): groups Add a section, Go to, Do. Fuzzy, arrows/Enter/Escape, focus restore.
- **Shortcuts dialog** (`?`): list as specified. Ignored while typing, except Ctrl+Z in Tiptap and Ctrl+S.

### 8.17 Mobile and tablet adaptations (below 1024)
- Bottom bar below 768: Undo/Redo, Add pill, Sections, Design, More. Sheets with snap behaviour; outline as drawer/sheet; block panel tabs at sheet top; pickers as 90dvh sheets.
- 768–1023: top bar overflow kebab, outline drawer, right panel sheet, frames scaled.
- Dialogs become bottom sheets below 640.

## 9. Other screens and relationships

### 9.1 Settings, Business tab (updates)
Add three sections:
1. **Opening hours.** Description "Shown on your website and in Google." Time-format segmented ("12 hour", "24 hour"), seven day rows (Open/Closed/24 hours, time pairs, Add another time max 2), validation ("The second time must come after the first"), preset chips, "Copy Monday to all days", Notes about hours (max 300), live preview card.
2. **Social links.** Description "Shown in your header, footer and contact sections." List editor (max 8): network Select with brand icons, URL Input with per-network placeholders and validation, WhatsApp takes a number, drag to reorder.
3. **Logo for dark backgrounds** inside the Logo section: "Light logo (optional)" with helper "Used when your header or footer has a dark or coloured background."
Business type Select gains InfoBox info "This only changes suggestions, not your pages."
Data flows feed blocks, header, footer, contact details, map, JSON-LD and checklist.

### 9.2 Pictures page (`.../images`) updates
- Tabs "Pictures" and "Files". Pictures toolbar: search, sort, filter chips All/Unused/Used on pages, select mode for bulk delete. Tiles show usage chip and kebab with Edit picture, Replace picture, Copy file name.
- **Files tab:** list card with PDF rows (name, meta, usage, kebab), "Upload PDF" action, dropzone for empty state, `FILE_TOO_LARGE`/`FILE_NOT_PDF` errors.
- Third tab "Free photos" coming soon.
- Storage bar counts pictures and files together.

### 9.3 Project settings and overview relationships
- **Overview checklist** additions: "Choose your colours and fonts", "Add your opening hours" (for applicable types), "Customise your header and footer", "Check your page tips".
- **Pages manager:** starter Add page dialog, Duplicate, "{n} sections" label.
- **Quick find:** adds "Design" and "Page tips" actions inside a project.
- **Admin console:** "Fonts" (sync status, catalogue size, last sync, failed downloads with retry) and "Preview links" counts on project detail; actions write admin_audit_log.

### 9.4 Wizard and starter content (updates)
- New websites receive business-type palette and fonts and a starter page from template ids. Business details prefill first sections; picture slots remain placeholders.
- **Single-page sites (Free plan):** when exactly one visible page, header menu defaults to `sections` and starter sections get `menuLabel`/`anchor`.

### 9.5 Relationship with plans and limits
No design feature is plan-gated. Limits: pages, plugins, storage, preview links (Free 1, Basic 3, Pro 5, Enterprise 20). Free watermark and report links unchanged.
