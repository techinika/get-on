# Get-On UI Specification v1
For all `/dashboard` screens except the editor, the wizard and the preview, `docs/ui-spec-app.md` overrides this file.
See also `docs/ui-spec-editor.md` for the Visual page editor, site look, images library, version history and preview.

Single source of truth for all visuals and copy. Follow it exactly. If something is not specified, stay consistent with these tokens and ask nothing; note the choice in your final summary.

## 0. Rules for the agent
- Design mobile-first at 360 px wide, then enhance at 640, 768, 1024, 1280.
- All values below are in CSS px unless stated. Use Tailwind with custom theme tokens that map to these values. No arbitrary one-off colours or sizes in components.
- Never show these words to users: slug, subdomain, DNS, schema, domain configuration. Say "web address".
- Every interactive element: minimum 44x44 hit area, visible focus ring, keyboard operable, correct ARIA role/label.
- Respect `prefers-reduced-motion` (disable all transforms/animations except opacity fades under 150ms).
- After building, add a script `pnpm screenshots` using Playwright to capture every screen listed here at 360, 768 and 1280 widths, light and dark, into `docs/screenshots/`. Review each image against this spec and list any deviations in your final summary.

## 1. Design tokens

### 1.1 Colour (CSS variables on :root, redefined under `.dark` and `@media (prefers-color-scheme: dark)` guarded by `:root:not([data-theme="light"])`)
Light:
- --bg #FFFBF5 (page background, warm cream)
- --surface #FFFFFF (cards, bars, dialogs)
- --surface-muted #F6F0E6 (alternate sections, info boxes, skeletons)
- --border #E8DFD0 (dividers, card borders)
- --border-strong #D9CDB8 (input borders, dashed borders)
- --text #1F1A17
- --text-muted #6B6158
- --primary #0B6B4F, --primary-hover #095A42, --primary-soft #E8F5EF (selected backgrounds), --on-primary #FFFFFF
- --accent #F5A524, --accent-soft #FDEFC9, --accent-text #7A4A00
- --success #1E8E3E, --success-soft #DDF5E6, --success-text #146C37
- --warning-soft #FFF4D6, --warning-border #F3D98A, --warning-text #7A4A00
- --danger #C62828, --danger-soft #FDECEC, --danger-border #F3B8B8, --danger-text #8E1B1B
- --info-soft #EAF1FB, --info-text #1B4B8F
- --scrim rgba(31,26,23,0.45)
Dark:
- --bg #14110F, --surface #1E1A17, --surface-muted #28231F, --border #3A332D, --border-strong #4A4138
- --text #F5EFE6, --text-muted #B5A99B
- --primary #3DBE8B, --primary-hover #5BD0A2, --primary-soft #12302A, --on-primary #06251A
- --accent #F5A524, --accent-soft #3A2C0E, --accent-text #F7CB7A
- --success-soft #12301D, --success-text #7BD99B, --warning-soft #3A2C0E, --warning-border #6B521A, --warning-text #F7CB7A
- --danger #EF6B6B, --danger-soft #3A1818, --danger-border #6B2A2A, --danger-text #F5A3A3
- --info-soft #14233A, --info-text #9CC0F5
Contrast: all text/background pairs above must meet WCAG AA (4.5:1 body, 3:1 large text). Verify in a test.

### 1.2 Typography (load with `next/font/google`, `display: swap`)
- Headings: "Bricolage Grotesque", weights 600 and 700, fallback system-ui sans-serif.
- Body and UI: "Figtree", weights 400, 500, 600, 700, fallback system-ui sans-serif.
- Base: 16/1.6 Figtree 400, colour --text.
- Display (hero H1): 40/1.1 mobile, 56/1.05 at 1024+, Bricolage 700, letter-spacing -0.02em.
- H1 (page titles): 28/1.2 mobile, 32/1.2 at 768+, Bricolage 700.
- H2 (sections): 28/1.2 mobile, 36/1.15 at 1024+, Bricolage 700.
- H3: 20/1.3 (22 at 1024+), Bricolage 600.
- Body large: 18/1.6 (20 at 1024+ for hero subheading only).
- Small: 14/1.5. Caption: 12/1.4. Eyebrow: 14/1.2, weight 700, uppercase, letter-spacing 0.08em, colour --primary.
- Buttons and labels: Figtree 600.
- Max line length for paragraphs: 65ch.

### 1.3 Spacing, layout, shape
- Spacing scale (4 px base): 4, 8, 12, 16, 20, 24, 32, 48, 64, 96.
- Container: max-width 1120, horizontal padding 20 (mobile), 32 at 768+, centred.
- Section vertical padding (landing): 64 mobile, 96 at 1024+.
- Radius: 8 small chips/tags, 12 inputs and buttons, 16 info boxes and small cards, 20 standard cards, 24 large cards and dialogs, 32 final CTA panel, 999 pills.
- Shadow card: `0 1px 2px rgba(31,26,23,0.06), 0 4px 16px rgba(31,26,23,0.06)`. Shadow raised: `0 8px 30px rgba(31,26,23,0.12)`. In dark mode use `rgba(0,0,0,0.4)` equivalents.
- Focus ring (all focusable elements): `outline: 3px solid var(--primary); outline-offset: 2px`.
- Motion: hover/press 150 ms ease-out; panels and dialogs 250 ms cubic-bezier(0.2, 0.8, 0.2, 1); progress bar 300 ms ease-out.
- Icons: lucide-react, stroke width 1.75, 20 px inline, 24 px in cards, 28 to 32 in feature tiles.

### 1.4 Components (build once in `components/ui`, reuse everywhere)
Button
- Sizes: sm 36 high (padding 0 14, font 14) used only on desktop tables; md 44 high (padding 0 20, 16/600); lg 52 high (padding 0 28, 16/600). Radius 12. Icon gap 8.
- primary: bg --primary, text --on-primary, hover --primary-hover, active translateY(1px).
- secondary: bg --surface, 1.5px border --border-strong, text --text, hover bg --surface-muted.
- ghost: transparent, text --text, hover bg --surface-muted.
- danger: bg --danger, text #FFFFFF, hover darken 8%.
- disabled: opacity 0.5, cursor not-allowed. Loading: replace icon with 18 px spinner, text changes as specified per screen, button disabled and aria-busy true.
Input and Textarea
- Height 48 (textarea min 140), padding 0 14 (textarea 12 14), font 16 (never smaller, prevents iOS zoom), radius 12, bg --surface, border 1.5px --border-strong.
- Focus: border --primary plus the focus ring. Error: border --danger, with message below.
- Label: above field, 14/600, margin-bottom 6. Helper text: below, 14 --text-muted, margin-top 6. Error text: 14 --danger-text with a 16 px alert-circle icon, margin-top 6, `role="alert"`.
- Optional fields: append " (optional)" in --text-muted weight 400 to the label.
Badge/pill: height 24, padding 0 10, radius 999, 12/700. Variants: neutral (bg --surface-muted, text --text-muted), draft (bg --warning-soft, text --warning-text), live (bg --success-soft, text --success-text, 8 px dot before), primary (bg --primary-soft, text --primary), accent (bg --accent-soft, text --accent-text).
Progress bar: height 8, radius 4, track --border, fill --primary; fill turns --accent at 80% to 100% usage. Include `role="progressbar"` with aria values.
Card: bg --surface, 1px --border, radius 20, shadow card, padding 24 unless stated.
Dialog: centred, width min(440px, 100vw - 32px) (480 for forms), radius 24, padding 28, bg --surface, shadow raised, scrim --scrim; on mobile it rises as a bottom sheet (full width, top radius 24). Focus trapped, Escape closes, focus returns to trigger.
Menu (dropdown): width 220, radius 16, padding 6, bg --surface, 1px --border, shadow raised; items 44 high, padding 0 12, radius 10, gap 12, hover --surface-muted; destructive item text --danger.
Toast: bottom centre on mobile, bottom right at 768+, width min(360px, 100vw - 32px), radius 14, bg --surface, shadow raised, padding 14 16, 4 px left bar coloured by type, auto-dismiss 5 s, `role="status"`.
Skeleton: bg --surface-muted with a shimmer gradient to --border, 1.2 s loop, radius matching the real element.
Empty state: dashed 2px --border-strong border, radius 24, padding 48 (32 on mobile), centred.

## 2. Landing page `/`

### 2.1 Header
- Sticky top, height 64, bg --bg at 85% opacity with backdrop-filter blur(8px). 1px bottom border --border appears only after the user scrolls 8 px.
- Left: logo = 32x32 rounded square (radius 10, bg --primary) containing a white arrow-up-right icon 18 px, then wordmark "Get-On" Bricolage 700 22 px, gap 8.
- 768+: centred nav links "How it works", "Pricing", "FAQ": 16/500, gap 32, hover shows a 2 px underline in --primary with 6 px offset. Right side: "Log in" ghost md, "Start free" primary md, gap 8.
- Below 768: right side shows "Start free" primary at height 40 (padding 0 16) and a 44x44 menu icon button. Menu opens a panel dropping from the header, full width, bg --surface, padding 8 20 20, rows 56 high with 20/600 links and a "Log in" secondary full-width button at the bottom; closes on link click or Escape.

### 2.2 Hero
- Padding 48 top / 64 bottom on mobile; 96 / 96 at 1024+. Grid 12 columns at 1024+: text spans 7, visual spans 5, gap 48, vertically centred. Below 1024 stacked, text first, visual centred below with 48 top margin.
- Eyebrow pill above H1: height 32, padding 0 12, bg --accent-soft, text --accent-text 14/600, radius 999, sparkles icon 16 at left, gap 6, text "Free to start. No card needed." Margin-bottom 20.
- H1 text: "Get your business online in minutes." Display style. The word "online" has an SVG hand-drawn wavy underline in --accent, 8 px thick, placed under the word with 4 px offset.
- Subheading (margin-top 20, max-width 520, 18 mobile / 20 desktop, colour --text-muted): "No technical skills needed. You get a free web address like yourbusiness.get-on.tech. Build your pages with AI or by hand."
- Buttons row (margin-top 32): "Start free" primary lg with arrow-right icon 20 on the right; "See how it works" secondary lg (anchors to `#how`). Gap 12. Below 640 they stack and are full width.
- Trust list (margin-top 24): three items, each a check-circle icon 18 in --success plus 14/500 text, gap 6 within the item, gap 8 between rows (column on mobile) or 24 between items in a row at 640+. Items: "Free forever plan", "Set up in about 5 minutes", "Works on any phone".
- Visual (aria-hidden decorative group with role="img" and aria-label "Example of a small business website on a phone"):
  - Behind: blob 340x340, bg --accent-soft, radius 48, rotate -6deg, centred behind the phone.
  - Phone: width 280 (300 at 1024+), aspect ratio 1:2, radius 40, 10 px solid #1F1A17 frame, bg #FFFFFF, shadow raised, notch pill 90x24 centred at top 10 px, bg #1F1A17.
  - Inside, top to bottom: status space 40; browser bar height 44, bg #F6F0E6, containing an address pill (height 28, radius 14, bg #FFFFFF, centred, lock icon 12, text "rosebakery.get-on.tech" 12 px #1F1A17); hero image block height 140 with a linear gradient from #F5A524 to #E8743B and a 56 px white semi-transparent circle at its lower right; below it padding 16: title "Rose Bakery" Bricolage 700 22 px colour #1F1A17; three grey placeholder lines (height 8, radius 4, #E8DFD0, widths 100%, 90%, 60%, gap 8); a pill button "Order now" (height 36, padding 0 16, bg #0B6B4F, text white 14/600, radius 999); two small cards in a 2-column grid gap 8 (bg #F6F0E6, radius 12, padding 10, icon 16 plus 12 px text "Open 7am to 5pm" and "Call us"); bottom footer text "Built with Get-On" 10 px colour #6B6158 centred.
  - Floating chip top right (offset -16 from phone edge): bg --surface, radius 12, padding 8 12, shadow card, 14/600, green 8 px dot then "Published". Floating chip bottom left (offset -24): same style with sparkles icon 16 in --accent then "AI wrote this page". Both float with a 6 s ease-in-out infinite translateY(±6px) loop, staggered by 1 s.

### 2.3 How it works (`id="how"`)
- Section bg --surface-muted, padding 64 / 96. Centred header: eyebrow "How it works", H2 "Three steps to your first website", sub 18 --text-muted max-width 560, gap 12 between.
- Cards (margin-top 48): 1 column gap 16 on mobile, 3 columns gap 24 at 768+. Card style: bg --surface, 1px --border, radius 24, padding 28, shadow card.
- In each card: number badge 40x40 circle bg --primary, white 18/700 centred; H3 margin-top 16; body 16 --text-muted margin-top 8.
- Card 1: "Tell us about your business" / "Type your business name and a few words about what you do. That is all we need."
- Card 2: "Pick AI or a template" / "Let AI write your pages for you, or start from a ready-made design."
- Card 3: "Publish with one tap" / "Press Publish and your website is live at your own web address."

### 2.4 What you get (`id="features"`)
- Section bg --bg, padding 64 / 96. H2 "Everything your business needs to be found online", left-aligned on mobile and centred at 768+, max-width 640.
- Grid margin-top 48: 1 column, 2 columns at 640+, 3 columns at 1024+, gap 20. Card: bg --surface, 1px --border, radius 20, padding 24.
- Icon tile 48x48, radius 14, bg --accent-soft, icon 24 colour --accent-text. Title 18/600 margin-top 16. Body 16 --text-muted margin-top 6.
- Six cards (icon, title, text):
  1. Globe, "Your free web address", "Get yourbusiness.get-on.tech the moment you sign up."
  2. Sparkles, "AI writes your pages", "Tell us about your business and get ready-to-use pages."
  3. MousePointerClick, "Easy to edit", "Click on any text or picture and change it. No code, ever."
  4. Mail, "A contact form that works", "Customers send you messages. You read and reply in one place."
  5. Link2, "Your own domain when you grow", "Move to yourbusiness.com whenever you are ready."
  6. ShieldCheck, "Automatic backups", "Your website is saved for you, so nothing gets lost."

### 2.5 Pricing (`id="pricing"`)
- Section bg --surface-muted, padding 64 / 96. Centred eyebrow "Pricing", H2 "Simple prices. Start free.", sub "Plans are paid per team. Change your plan any time."
- Cards (margin-top 48; padding-top 14 to leave room for the tag): 1 column gap 16, 2 columns at 768+, 4 columns at 1280+ with gap 20. Card: bg --surface, 1px --border, radius 24, padding 28, flex column, equal height.
- Highlighted card is Basic: 2px solid --primary border, shadow raised, tag "Most popular" centred on the top edge (top -14): pill bg --primary, text white, 12/700 uppercase, padding 0 12, height 28.
- Card content, top to bottom: plan name 18/700; descriptor 14 --text-muted (margin-top 4); price row margin-top 20: amount Bricolage 700 44 px then "/month" 16 --text-muted (baseline aligned); button full width md margin-top 20; 1px divider margin 24 0; feature list with 12 px row gap, each row: check icon 18 --success then text 15, gap 10.
- Free: "$0". Descriptor "To try it out". Button "Start free" secondary. Features: "1 website", "1 page", "Contact form", "Free address: yourname.get-on.tech", "Small Get-On badge on your site", "Standard support".
- Basic: "$7.99". Descriptor "For a small business site". Button "Choose Basic" primary. Features: "2 websites", "Up to 5 pages each", "Use your own domain", "2 extra features (plugins)", "No Get-On badge", "Standard support".
- Pro: "$13.99". Descriptor "For growing businesses". Button "Choose Pro" secondary. Features: "5 websites", "Unlimited pages", "Use your own domain", "5 extra features (plugins)", "Up to 5 team members", "Priority support".
- Enterprise: "$59.99". Descriptor "For big teams and agencies". Button "Choose Enterprise" secondary. Features: "Unlimited websites", "Unlimited pages", "Unlimited team members", "Unlimited extra features", "Use your own domain", "Highest-priority support".
- All buttons link to `/signup` for now (billing comes later). Note below grid, 14 --text-muted centred, margin-top 24: "Prices are in US dollars. Plans are paid per team."
- Prices and limits come from one shared constant mirroring the `plans` table; add a unit test that fails if they drift apart.

### 2.6 FAQ (`id="faq"`)
- Section bg --bg, padding 64 / 96. Centred H2 "Questions people ask", list below (margin-top 32), max-width 760, centred.
- Native `<details>/<summary>`. Each item has a 1px bottom border --border. Summary: min-height 56, padding 20 0, 18/600, flex space-between, chevron-down icon 20 rotating 180deg when open (150 ms), default marker hidden, focus ring on summary. Answer: 16 --text-muted, max-width 65ch, padding-bottom 20.
- Q/A:
  1. "What is a web address?" / "It is what people type to find your website, like rosebakery.get-on.tech. You get one free."
  2. "Do I need to know how websites work?" / "No. We ask simple questions and set everything up. If you can send a message on your phone, you can do this."
  3. "Can I use my own domain, like mybusiness.com?" / "Yes, on paid plans. We will guide you step by step."
  4. "What happens on the free plan?" / "You get one website with one page and a contact form on a free get-on.tech address. A small Get-On badge appears at the bottom of your page."
  5. "Can I cancel any time?" / "Yes. You can change or cancel your plan whenever you want."

### 2.7 Final call to action
- Section padding 32 0 64 (96 at 1024+). Panel: max-width 1120, bg --primary, radius 32, padding 40 24 (64 48 at 768+), text centred, overflow hidden, position relative. Decorative circles: 160 px at top-left offset (-40,-40) and 220 px at bottom-right offset (-60,-60), bg --accent, opacity 0.25.
- H2 white "Ready to get your business online?"; sub 18 white at 90%, max-width 520, margin-top 12; button lg bg #FFFFFF, text --primary (in dark mode keep bg #FFFFFF, text #0B6B4F), "Start free" with arrow-right, margin-top 28.

### 2.8 Footer
- bg #1F1A17 (same in dark mode), text #E8DFD0, padding 48 0 32. Layout: mobile stacked with 32 gap; 768+ a row: left block (logo with white wordmark, tagline "Get your business online." 14, max-width 280), right three link columns gap 64 (Product: How it works, Pricing, FAQ; Company: Contact; Legal: Terms, Privacy). Column heading 12/700 uppercase tracking 0.08em colour #B5A99B; links 15, row gap 12, hover underline. Bottom row after a 1px #3A332D divider, margin-top 32, padding-top 24: "© 2026 Get-On" 14 colour #B5A99B.

### 2.9 Page metadata
Title "Get-On: Get your business online in minutes". Description "Build a simple website for your business with AI or by hand. Free web address, no technical skills needed." Open Graph image 1200x630 generated with `next/og` using --bg background, headline text and the logo.

## 3. Auth pages `/signup`, `/login`, `/forgot-password`
- Page bg --bg. Top: logo centred, margin-top 32. Card below: margin-top 32, width min(440px, 100% - 32px), bg --surface, 1px --border, radius 24, padding 24 (32 at 640+), shadow card. Centred on larger screens with 48 top margin.
- Card header: H1 (28) and sub 16 --text-muted margin-top 8. Signup: "Create your free account" / "It takes less than a minute." Login: "Welcome back" / "Log in to manage your website." Forgot: "Reset your password" / "Enter your email and we will send you a link."
- Form fields, 16 gap, margin-top 24. Signup: Full name, Email, Password. Login: Email, Password (with "Forgot password?" link right-aligned above the field, 14 --primary). Password field has a 44x44 show/hide eye button inside the right edge; helper on signup "At least 8 characters".
- Submit button lg full width. Labels: "Create my account", "Log in", "Send reset link". Loading text: "Creating your account...", "Logging in...", "Sending...".
- If Google login is enabled: after the submit button, a divider row ("or" 14 --text-muted between two 1px lines, margin 20 0) then a secondary lg full-width "Continue with Google" button with the Google G logo 20 px at left.
- Footer line inside card, centred 14, margin-top 24: "Already have an account? Log in" / "New here? Create a free account".
- Error banner at the top of the form (above first field): bg --danger-soft, 1px --danger-border, radius 12, padding 12 14, alert-circle icon 18 --danger, text 14 --danger-text, `role="alert"`. Field-level errors use the Input error style.
- Signup success redirects straight to `/dashboard/new`. Forgot password success replaces the form with a mail-check icon in a 56 px --primary-soft circle, title "Check your email", text "If that address has an account, a reset link is on its way."

## 4. App shell (all `/dashboard` routes except the wizard)
- Top bar: height 64, bg --surface, bottom border 1px --border, padding 0 16 (0 32 at 1024+), flex space-between, sticky.
- Left: logo mark 32 (wordmark visible at 640+); then a slash separator "/" in --text-muted; then team switcher button (ghost md, max-width 180 truncating, users icon 18, team name 16/600, chevron-down 16). For now the switcher only shows the current team with a disabled "Create another team (coming soon)" item.
- Right, gap 8: plan badge (variants: Free neutral, Basic and Pro primary, Enterprise accent) hidden below 480; Help button (ghost md, life-buoy icon 20, text "Help" hidden below 480 but aria-label kept); avatar button 40x40 circle, bg --accent-soft, initials 14/700 --accent-text. Avatar menu: header block (name 16/600, email 14 --text-muted, padding 12), divider, items "Log out" (log-out icon).
- Content: bg --bg, container max-width 1120, padding 24 (40 at 1024+), min-height calc(100vh - 64px).
- Help panel: fixed right, top 0, bottom 0, width min(400px, 100vw), full screen below 640; bg --surface, left border 1px --border, shadow raised, slides in from the right (250 ms); scrim behind at every size, click closes, Escape closes, focus trapped, focus returns to Help button. Header 64 high with title "Need help?" 18/700 and a 44x44 close (x) button. Body padding 24: H3 "Talk to us"; text 15 --text-muted "We usually reply within {target}." where target comes from the plan (Free "3 to 5 working days", Basic "2 working days", Pro "1 working day", Enterprise "4 working hours"); two full-width lg buttons gap 12 margin-top 20: "Email us" (primary, mail icon) and "WhatsApp us" (secondary, message-circle icon coloured #1FA855). Info box margin-top 24: bg --surface-muted, radius 16, padding 16, 14 text "Your plan: {Plan}. Support priority: {Standard | Priority | Highest}." The email link is `mailto:` with subject "Get-On help" and a body prefilled with team name, plan and current page path; the WhatsApp link is `https://wa.me/{number}?text=` with the same prefilled message (URL-encoded). Both use env variables.

## 5. Team dashboard `/dashboard`
- Title row: H1 "Your websites" left; "Create website" primary md with plus icon right (below 640 it drops under the title, full width, margin-top 16).
- Usage card (margin-top 24): Card padding 20. Grid: 1 column on mobile with 1px dividers and 16 gaps, 3 columns at 768+ with vertical dividers. Each cell: label 14 --text-muted, value 20/600 ("0 of 1"), progress bar margin-top 8. Cells: "Websites", "Team members", "AI credits left" (value "10 of 10"). Footer row inside the card, margin-top 16, 14: "You are on the Free plan." plus a link "See plans" in --primary (links to `/#pricing`).
- Empty state (when no projects, margin-top 24): Empty state style. Icon: LayoutTemplate 56 px in a 96 px circle bg --accent-soft, icon colour --accent-text. H2 (22) "Let us get your business online". Text 16 --text-muted max-width 420 "It takes about 5 minutes. We will ask a few simple questions and set everything up for you." Button lg primary "Create your first website".
- Project grid (margin-top 24): 1, 2 and 3 columns at 0, 640 and 1024, gap 20. Project card: Card style with padding 0 and overflow hidden; hover raises (shadow raised, translateY -2px, 150 ms).
  - Thumbnail: aspect 16:9. Background is one of 4 gradients chosen by hashing the project id: #F5A524 to #E8743B; #0B6B4F to #3DBE8B; #6D5DD3 to #A18BFF; #E8743B to #F5A524 mixed with cream. Inside: a mini browser frame (inset 16, bg #FFFFFF at 92%, radius 10) with a 20 px top bar holding three 6 px dots (#E8DFD0) and below it the first letter of the project name centred in Bricolage 700 32 px colour #1F1A17. Status badge top-right inset 12 (draft or live).
  - Body padding 16: name 18/600 truncated; address row margin-top 4: globe icon 14 plus "rosebakery.get-on.tech" 14 --text-muted truncated.
  - Footer row margin-top 16: "Open" primary md flex-1; kebab icon button 44x44 secondary opening a Menu with "Open" and "Delete website" (destructive).
- Delete dialog: icon triangle-alert 24 in a 48 px circle bg --danger-soft colour --danger, H3 "Delete {name}?", text 16 --text-muted "Your website will be taken down. You can ask us to bring it back within 14 days." Label "Type {name} to confirm" with an Input. Footer buttons right-aligned gap 12: "Cancel" secondary md, "Delete website" danger md, disabled until the typed text matches exactly. After success: toast "{name} was deleted."

## 6. First-run wizard `/dashboard/new`
No app shell. Layout:
- Top bar 64 high, bg --surface, bottom border: left logo mark, right "Save and exit" ghost md with x icon (saves draft and returns to `/dashboard`).
- Progress bar directly under it: full width, height 4, track --border, fill --primary, width = step/6, 300 ms.
- Content: centred column max-width 560, padding 24, margin-top 32 (64 at 768+). First line "Step {n} of 6" 14 --text-muted. Then H1 (28/32) margin-top 8, sub 16 --text-muted margin-top 8, step body margin-top 32.
- Action bar: below 768 it is fixed to the bottom, height 72 plus safe-area inset, bg --surface, top border 1px --border, padding 12 20, containing "Back" ghost md (hidden on step 1) and "Continue" primary lg flex-1. At 768+ it is inline below the body, margin-top 40, Back on the left, Continue on the right (min-width 160). Reserve bottom padding 96 on mobile so content is never hidden behind the bar.
- Skippable steps (3, 5) show a centred text button "Skip this step" (14, --text-muted, underline) under the Continue button (margin-top 16).
- Step transitions: content fades and slides 12 px horizontally in 250 ms (opacity only under reduced motion). Move focus to the step H1 on each change. State is saved on every change and restored on reload.

Step 1, title "What is your business called?", sub "We will use this for your website and your web address."
- Input lg variant: height 56, font 18, placeholder "For example: Rose Bakery", autofocus, label "Business name".
- Address card (margin-top 24): bg --surface-muted, radius 16, padding 16. Caption "YOUR WEB ADDRESS" 12/700 tracking 0.08em --text-muted. Address line (margin-top 4) 20/600, word-break: break-all: typed part in --primary, then ".get-on.tech" in --text-muted. Placeholder before typing: "yourbusiness.get-on.tech" all --text-muted.
- Status line (margin-top 8, 14): checking = 16 px spinner + "Checking..."; available = check-circle --success + "Available! This is yours."; taken = x-circle --danger + "That one is taken. Try one of these:" followed by up to 3 suggestion chips (height 36, padding 0 14, radius 999, 1.5px --border-strong, 14/600; click selects); invalid = alert-circle with the plain-language reason. Debounce 400 ms.
- "Change address" text button (14, --primary) toggles an inline Input with a read-only ".get-on.tech" suffix addon (bg --surface-muted, 1.5px border, padding 0 12), helper "Use letters, numbers and dashes only. At least 3 characters."
- Continue is disabled until the name is non-empty and the address is available.

Step 2, title "What kind of business is it?", sub "This helps us suggest the right look and wording."
- Radio-card grid: 2 columns gap 12 on mobile, 3 columns gap 16 at 640+. Card: min-height 112, padding 16, radius 16, 1.5px --border-strong, bg --surface, flex column centred gap 8; icon 32 in --primary; label 16/600 centred. Hover border --primary. Selected: 2px --primary border, bg --primary-soft, and a 20 px check-circle (filled --primary, white check) at top-right inset 8. Role radiogroup, arrow-key navigation.
- Items (icon, label): UtensilsCrossed "Restaurant or cafe"; Scissors "Salon or beauty"; ShoppingBag "Shop"; Camera "Photographer or creative"; Briefcase "Consultant or freelancer"; Users "Church or community"; Wrench "Repairs and services"; Sprout "Farm or agriculture"; GraduationCap "Teaching or tutoring"; Sparkles "Something else".
- Continue disabled until one is selected.

Step 3, title "Tell us about your business", sub "In a few words, what do you do? You can skip this."
- Textarea min-height 140, label "About your business (optional)", placeholder "For example: We bake fresh bread and cakes every morning and deliver across town." Character counter bottom-right inside the field, 12 --text-muted, "0/300", hard limit 300.

Step 4, title "How would you like to start?", sub "You can change everything later."
- Three full-width stacked option cards (gap 12, radio group). Card: padding 20, radius 20, 1.5px --border-strong, flex row gap 16 align centre. Left icon tile 56x56 radius 16 bg --accent-soft icon 28 --accent-text. Middle: title 18/600, description 14 --text-muted. Right: 24 px radio circle (selected: filled --primary with white inner dot). Selected card: 2px --primary border, bg --primary-soft.
  - Sparkles, "Create it for me with AI", "Answer a few questions and we write your pages." with an accent badge "Coming very soon" beside the title.
  - LayoutTemplate, "Pick a template", "Start from a ready-made design." with the same badge.
  - FilePlus, "Start blank", "Begin with a simple page and build it yourself." Selected by default.
- If AI or template is chosen, show below the cards an info box (bg --info-soft, radius 16, padding 14 16, info icon 18, text 14 --info-text): "This is coming very soon. For now we will set you up with a simple starter page you can build on." and store the original choice in `project_settings`.

Step 5, title "How can customers reach you?", sub "These go on your website. All of this is optional."
- Fields (gap 16): Phone (type tel, inputmode tel), Email (type email), Address (Input), each with "(optional)". Then the logo uploader.
- Logo uploader: label "Your logo (optional)"; dropzone height 140, dashed 2px --border-strong, radius 16, centred column: upload icon 28 --primary, "Tap to add your logo" 16/600, "PNG or JPG, up to 2 MB" 14 --text-muted. Drag-over state: border --primary, bg --primary-soft. After upload: 96x96 preview box (radius 16, 1px --border, object-fit contain, padding 8) with "Change" and "Remove" ghost sm buttons to its right. Errors (wrong type or too big) shown inline with the Input error style: "Please choose a PNG or JPG picture under 2 MB."

Step 6, title "You are all set", sub "Check the details, then create your website."
- Summary card: padding 24, radius 24. Top a 16:9 mini browser mock using the project gradient style from section 5 with the business name. Below, rows (padding 12 0, 1px divider): label 14 --text-muted left, value 16/600 right (web address in --primary), each with an "Edit" text button (14 --primary) that jumps back to its step: Business name, Web address, Business type.
- Primary lg full-width button "Create my website"; loading label "Setting up your website...". On success go to `/dashboard/projects/{id}` and show toast "Your website is ready!"
- Errors: banner above the button (Input error banner style). Subdomain taken sends the user to step 1 with the suggestions open. Limit reached replaces the card with a limit box: bg --warning-soft, 1px --warning-border, radius 20, padding 24, lock icon 24 in --warning-text, H3 "Your Free plan includes 1 website", text 16 "To add another website, you will need a bigger plan.", buttons "See plans" (primary md, links to `/#pricing`) and "Back to my websites" (secondary md).

## 7. Project area `/dashboard/projects/[projectId]/*`

### 7.1 Navigation shell
- Desktop (1024+): left sidebar fixed under the top bar, width 248, bg --surface, right border 1px --border, padding 16. Top: "All websites" link (arrow-left icon 16, 14 --text-muted, height 40). Then project block (margin-top 8, padding 12 0): name 18/700 truncated, address 14 --text-muted truncated, status badge below (margin-top 8). Nav list (margin-top 16, gap 4): items height 44, padding 0 12, radius 12, icon 20 and label 16/500, gap 12. Active: bg --primary-soft, text --primary, weight 600. Hover: bg --surface-muted. Items: Overview (LayoutDashboard), Pages (FileText), Images (Image), Plugins (Puzzle), Settings (Settings). Not-yet-built items are non-interactive (`aria-disabled`), opacity 0.6, with a right-aligned "Soon" pill (neutral, 11/700).
- Content area to the right: padding 40, max-width 960.
- Below 1024: no sidebar. Header under the top bar: height 56, bg --surface, bottom border, padding 0 8, containing a 44x44 back button (arrow-left, goes to `/dashboard`), project name 16/700 truncated, status badge. Fixed bottom tab bar: height 64 plus safe-area inset, bg --surface, top border, 5 equal tabs, each icon 22 above label 11/600, active colour --primary with a 3 px --primary bar at the top of the tab (width 24, radius 2), inactive --text-muted. Content padding 20 with 88 bottom padding.

### 7.2 Overview
- H1 "Overview", sub 16 --text-muted "Here is what to do next to get your website ready."
- Setup checklist Card (margin-top 24, padding 24). Header row: H3 "Get your website ready" left, "{done} of {total} done" 14 --text-muted right, plus a 44x44 chevron toggle button (collapses the list, keeps header and bar). Progress bar margin-top 12. List margin-top 16.
  - Row: min-height 64, padding 12 0, top border 1px --border (none on first), flex gap 12, align centre; whole row is a link. Left status circle 24: done = filled --success with white check icon 14; to-do = 2px --border-strong ring. Middle: title 16/600 (done rows title colour --text-muted), description 14 --text-muted. Right: chevron-right 20 --text-muted; for not-yet-available items a "Soon" neutral pill instead, and the row has aria-disabled with opacity 0.6; for domain on Free a "Upgrade" accent pill.
  - Items (title / description): "Add your logo and business details" / "Help customers recognise and reach you." (links to Settings placeholder for now, completes when any of phone, email, address or logo exists); "Look at your homepage" / "See what your first page looks like." (links to Pages; completes after the user opens the Pages list); "Turn on your contact form" / "Let customers send you messages." (Soon); "Add a title and description for Google" / "Help people find you in search results." (Soon); "Use your own domain" / "Replace yourbusiness.get-on.tech with yourbusiness.com." (Upgrade on Free, Soon otherwise); "Connect Google Analytics" / "See how many people visit." (Soon); "Publish your website" / "Make it live for everyone." (Soon).
  - When every available item is done, collapse automatically and show a "Show checklist" ghost sm button.
- Stats grid (margin-top 24): 1 column on mobile, 3 columns at 768+, gap 16. Stat card padding 20, radius 20: label 14 --text-muted, value Bricolage 700 24 margin-top 4, progress bar margin-top 12 where relevant. Cards: "Pages" ("1 of 1"), "Storage" ("0 MB of 100 MB"), "Status" ("Draft" with draft badge; sub text "Not live yet").
- Preview card (margin-top 16): aspect 16:10 (max-height 360), bg --surface-muted, radius 20, 1px --border, centred column with eye icon 32 --text-muted and text 16 --text-muted "Preview coming soon".

## 8. Pages manager `.../pages`
- Title row: H1 "Pages" and sub "{used} of {limit} pages used" (limit text "unlimited" when null) 14 --text-muted below; "Add page" primary md with plus icon on the right (full width under the title below 640).
- When at the limit: replace the button with a notice box (bg --warning-soft, 1px --warning-border, radius 16, padding 16, flex gap 12, lock icon 20 --warning-text, text 15 --warning-text "Your {Plan} plan includes {n} page{s}. Upgrade to add more.", plus "See plans" secondary sm at the right; stacks on mobile).
- List card (margin-top 24): Card with padding 0 and overflow hidden. Rows: min-height 72, padding 12 16, top divider 1px --border (none on first), flex centre gap 12.
  - Drag handle: grip-vertical icon 20 in a 44x44 button, --text-muted, cursor grab; aria-label "Move {title}".
  - Middle: first line title 16/600 followed by a "Home" pill (primary variant with house icon 12) if homepage; second line address like "/about-us" 14 --text-muted (homepage shows "/").
  - Status badge (draft) hidden below 480.
  - Right: "Edit" secondary sm (height 36 at 768+, 40 on mobile) and a 44x44 kebab opening a Menu: "Rename", "Set as homepage" (hidden if already), "Move up", "Move down" (disabled at ends), divider, "Delete" (destructive). If the page is the homepage, "Delete" is disabled with helper text "Make another page your homepage first" shown as a tooltip and in the menu item's `aria-describedby`.
  - Dragging: dragged row gets bg --surface, shadow raised, scale 1.01, 150 ms; drop placeholder is a dashed 2px --border-strong row of the same height.
- Add page dialog (480): H3 "Add a page"; Input "Page name" (placeholder "For example: About us"); below it a read-only address preview card (bg --surface-muted, radius 12, padding 12, 14): "Web address: rosebakery.get-on.tech/about-us" with a pencil icon button to edit the path part inline (helper "Letters, numbers and dashes only."); footer "Cancel" secondary md and "Add page" primary md (loading label "Adding..."). Errors inline; a taken path shows "You already have a page with this address."
- Rename dialog: same layout with title "Rename page" and button "Save".
- Delete confirmation dialog: danger icon style as section 5, H3 "Delete {title}?", text "This page will be removed from your website.", buttons "Cancel" and "Delete page".
- Optimistic updates with rollback and an error toast "That did not work. Please try again."
- Loading state: three skeleton rows of 72 px.

### 8.1 Editor placeholder `.../pages/[pageId]`
- Back link "Pages" (arrow-left), H1 "Editing: {title}". Notice box (info style, info icon): "The visual editor is coming soon. For now you can see what is on this page below."
- Card "What is on this page": renders the stored blocks read-only in a simple preview (heading block as H2 text, text block as paragraph, button block as a disabled pill button, contact-details block as a small list) inside a bordered white frame with 24 padding. Below, a collapsible "Developer view" (native details) with the block JSON in a monospace code block (14 px, bg --surface-muted, radius 12, padding 16, horizontal scroll).

## 9. Global states and patterns
- Page loading: route-level skeletons matching the final layout (no spinners for full pages).
- 404 and error pages: centred, 56 px icon in an --accent-soft circle, H1 "We could not find that page" (or "Something went wrong"), sub 16 --text-muted, primary md button "Back to my websites".
- Offline or failed request: toast "You seem to be offline. We will keep your changes and save them when you are back." for autosaved forms.
- Toast copy is friendly and short, no error codes. Map `LIMIT_WEBSITES_REACHED`, `LIMIT_PAGES_REACHED`, `SUBDOMAIN_TAKEN` and others to plain messages in one translation map.
- Dark mode: a toggle in the avatar menu (Light, Dark, System), stored in a cookie to avoid flash.

## 10. Acceptance checks for visuals
- No horizontal scrolling at 360 px on any screen.
- Every screen passes axe-core with no serious or critical issues (add an automated check in Playwright).
- Lighthouse on the landing page: 95+ for performance, accessibility, best practices and SEO on mobile.
- Cumulative layout shift below 0.05 everywhere. Reserve space for fonts, images and the phone mockup.
- Screenshots generated and reviewed as described in section 0, with deviations reported.
