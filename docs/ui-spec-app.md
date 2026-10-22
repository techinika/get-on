# Get-On UI Specification v1 - Dashboard app

For all `/dashboard` screens except the editor, the wizard and the preview, this document overrides `docs/ui-spec.md`.

Publishing, the published site, the publish UI and the safety and moderation screens are specified in `docs/ui-spec-publish.md`.

## 3. Information architecture and routes
| Route | Level | Page | Container |
|---|---|---|---|
| `/dashboard` | Team | Websites | wide (1120) |
| `/dashboard/team` | Team | Team and members | default (960) |
| `/dashboard/plan` | Team | Plan and billing | default (960) |
| `/dashboard/account` | Team | Account | narrow (720) |
| `/dashboard/projects/[id]` | Project | Overview | default (960) |
| `/dashboard/projects/[id]/pages` | Project | Pages | default (960) |
| `/dashboard/projects/[id]/images` | Project | Pictures | default (960) |
| `/dashboard/new`, editor, preview | Special | keep own layouts | n/a |
| `/request-demo` | Public | Request a demo | public layout |
| `/terms`, `/privacy`, `/cookies`, `/acceptable-use` | Public | Legal | public layout |
| `/contact` | Public | permanent (308) redirect to `/request-demo` | n/a |
| `/legal` | Public | redirect to `/terms` | n/a |

Disabled "Soon" destinations (no route yet): Templates, Invite and earn, and in a project Plugins and Settings.

Navigation rules: at most two levels (Team, then Project). Every page is reachable in two clicks or fewer from the dashboard home. The user always knows where they are (active item, breadcrumbs, page title).

## 4. Design refresh: app tokens
Add these to the existing token file. Keep every older token; these are additions or overrides for `/dashboard` screens.

**Colours**
| Token | Light | Dark |
|---|---|---|
| --app-bg | #F8F4EC | #12100E |
| --sidebar-bg | var(--surface) | var(--surface) |
| --row-hover | #F6F0E6 | #28231F |
| --kbd-bg | #F1EBDF | #332D27 |
| --scrim-strong | rgba(31,26,23,0.55) | rgba(0,0,0,0.6) |
Dashboard pages use `--app-bg` as the page background; cards, top bar, sidebar and dialogs use `--surface`.

**Shape and elevation (dashboard)**
- Card: bg `--surface`, 1px `--border`, radius 16, shadow none. Interactive cards on hover: border `--border-strong` and shadow `0 2px 8px rgba(31,26,23,0.08)` (dark: `rgba(0,0,0,0.35)`), 150 ms. Popovers, menus, dialogs keep the raised shadow.
- Dialog and sheet radius stays 24. Buttons and inputs keep radius 12.

**App type scale** (Figtree unless stated)
- Page title: Bricolage Grotesque 700, 28/32 (26/32 below 640).
- Section title: 18/24 weight 700.
- Card title: 16/24 weight 600.
- Body: 15/22 weight 400. Large body (descriptions under titles): 16/24.
- Small: 13/18. Caption: 12/16. Eyebrow/label caps: 12/16 weight 700, uppercase, tracking 0.08em, colour `--text-muted`.
- Numbers in stats: Bricolage 700, 24/28.
- Inputs always 16 px (prevents iOS zoom).

**Density**: row heights 40 (menu rows on desktop), 44 (nav items, buttons md), 48 (inputs, mobile rows), 56 (list rows with two lines), 72 (page rows). All spacing snaps to 4 px.

**Spacing between blocks**: page header to content 32 (24 below 640); between page sections 32 (24 below 640); inside cards 20 (24 for cards with a title row); between related fields 16; between a label and its field 6.

**Motion**: hover 150 ms ease-out; sidebar width 200 ms cubic-bezier(0.2, 0.8, 0.2, 1); sheets and dialogs 250 ms; page content fade-in 120 ms (opacity only, no movement). All of these are disabled except opacity under `prefers-reduced-motion`.

## 5. App shell specification

### 5.1 Layout frame
- Root grid for all dashboard routes (except special ones): top bar fixed at the top (height 64; 56 below 640), sidebar fixed at the left below the top bar (desktop 1024 and above), main content to the right.
- CSS variable `--sidebar-w` is 248 (expanded) or 72 (collapsed), set on the root from a cookie so the correct width is rendered on the server (no flash). Main has `margin-left: var(--sidebar-w)` at 1024 and above, with a 200 ms transition on the margin.
- Main: min-height `calc(100dvh - 64px)`, bg `--app-bg`. Only the main area scrolls with the page; the sidebar scrolls separately if its content is taller than the screen (`overflow-y: auto`, `overscroll-behavior: contain`, thin scrollbar).
- Below 1024 there is no sidebar. A bottom tab bar replaces it (5.6) and main gets bottom padding 88 plus the safe-area inset.

### 5.2 Top bar
Container: height 64 (56 below 640), bg `--surface`, bottom border 1px `--border`, padding 0 16 (0 24 at 1024+), flex space-between centre, `position: fixed`, z-index 40, full width.

**Desktop and tablet (640 and above)**
- Left group (gap 12): logo mark 32 (radius 10, bg `--primary`, arrow-up-right icon 18 white) linking to `/dashboard`; wordmark "Get-On" Bricolage 700 20 (visible at 1024+ only); a 1x24 divider in `--border`; **team switcher** (5.8).
- Centre-right (at 1024+, flex 1, max-width 360, margin-left auto): **quick find button** (5.9) styled like an input: height 40, radius 12, bg `--surface-muted`, 1px `--border`, padding 0 12, flex gap 8, search icon 18 `--text-muted`, label "Search" 15 `--text-muted`, on the right a kbd chip (height 22, padding 0 6, radius 6, bg `--kbd-bg`, 12/600 `--text-muted`) showing "Ctrl K" (or "⌘ K" on Apple devices). Below 1024 it is a 44x44 ghost icon button (search icon 20).
- Right group (gap 4, margin-left 12): Help ghost button (44 high; life-buoy icon 20 plus the text "Help" at 1280+, icon only below, aria-label "Help"); avatar button (40x40 circle, bg `--accent-soft`, initials 14/700 `--accent-text`) opening the user menu (5.10).
- The plan badge is removed from the top bar (it now lives in the sidebar plan card).

**Mobile (below 640)**
- Team routes: left logo mark 32 (links to `/dashboard`), then the team switcher in compact form (button height 40, team name 15/600 truncated at 140, chevron 16). Right: search icon button 44, Help icon button 44, avatar 36.
- Project routes: left back button (44x44, arrow-left 20, goes to `/dashboard`), project name (16/600, truncated, flex 1) and the status badge. Right: search icon 44, avatar 36. The team switcher is hidden; Help moves into the avatar menu.

### 5.3 Left sidebar: shared container
- Fixed, left 0, top 64, bottom 0, width `var(--sidebar-w)`, bg `--sidebar-bg`, right border 1px `--border`, padding 12, flex column, z-index 30.
- Section label: 12/700 uppercase tracking 0.08em `--text-muted`, padding 16 12 8 (first label padding-top 4). When collapsed it is replaced by a 1px `--border` divider with margin 12 8.
- **Nav item** (link): position relative, height 44, padding 0 12, radius 12, flex gap 12, centre; icon 20 (stroke 1.75) in `--text-muted`; label 15/500 `--text`; margin-bottom 2.
  - Hover: bg `--row-hover`.
  - Active: bg `--primary-soft`, icon and label `--primary`, label weight 600, plus a 3x20 bar at the left edge (position absolute, left -12, top 12, radius 0 3px 3px 0, bg `--primary`). `aria-current="page"`.
  - Disabled "Soon": opacity 0.6, no hover, `aria-disabled="true"`, not focusable by tab, with a right-aligned neutral pill "Soon" (height 20, padding 0 8, radius 999, 11/700).
- **Collapsed** (72 wide): items become 48x48 centred icon buttons (radius 14), labels hidden but kept as `aria-label`; a tooltip appears to the right after 300 ms hover or on focus (bg `#1F1A17`, white 13/600, padding 6 10, radius 8, offset 12, z-index 50); "Soon" items show "{Name} (coming soon)". Active bar stays.
- **Collapse toggle** at the very bottom: height 40, full width, ghost, radius 12, icon panel-left-close (panel-left-open when collapsed) 18 plus label "Collapse" 14/500 `--text-muted` (label hidden when collapsed). `aria-expanded`. Shortcut: the `[` key when no input is focused. State persisted in cookie `gs_sidebar` (`expanded` or `collapsed`) and applied server-side.
- Default state: expanded at 1280 and above, collapsed from 1024 to 1279 on first visit (until the user chooses).
- A subtle 1px top shadow line appears at the top of the nav area when it has scrolled (`box-shadow: inset 0 8px 8px -8px rgba(0,0,0,0.12)`).

### 5.4 Team-level sidebar content (top to bottom)
Section "Workspace": Websites (LayoutGrid) to `/dashboard`; Templates (LayoutTemplate) Soon.
Section "Team": Members (Users) to `/dashboard/team`; Plan and billing (CreditCard) to `/dashboard/plan`; Invite and earn (Gift) Soon.
Section "You": Account (UserCircle) to `/dashboard/account`.
Then a flexible spacer, then the **plan card**, then the collapse toggle.

**Plan card** (expanded only; margin 0 0 8; padding 14; radius 16; bg `--surface-muted`; 1px `--border`): top row plan name 15/700 and a plan badge (Free neutral, Basic and Pro primary, Enterprise accent); below (margin-top 10) usage text 13 `--text-muted` "{used} of {limit} websites" (limit text "unlimited" when null) and a progress bar (margin-top 6); then a "See plans" secondary sm button full width (margin-top 12) linking to `/dashboard/plan`. For Enterprise show a check-circle `--success` icon and "You have everything" 13 instead of the bar and button. Collapsed: replaced by a 48x48 icon button (credit-card icon) linking to `/dashboard/plan`, with a tooltip "{Plan} plan".

### 5.5 Project-level sidebar content
Replaces the team sidebar content in the same container (cross-fade 120 ms; width state carries over).
1. "All websites" back link: height 40, padding 0 12, arrow-left 16 and label 14/500 `--text-muted`, hover underline; collapsed: 48x48 icon button with tooltip "All websites".
2. **Project switcher** button (margin-top 8): full width, height 56, padding 8 12, radius 14, bg `--surface-muted`, 1px `--border`, flex gap 12, centre. Left a 32x32 square (radius 10) filled with the project's gradient and its first letter (Bricolage 700 16, `#1F1A17`); middle name 15/600 truncated and address 12 `--text-muted` truncated (globe icon 12 before it); right chevrons-up-down 16 `--text-muted`. Opens a Menu (width equals the button, max-height 320, scrollable): items for each project in the team (name 15/600, address 12 muted, check icon on the current), then a divider and "All websites" item. Collapsed: only the 40x40 square, tooltip with the name, still opens the menu (width 240).
3. Status line (margin 12 0 4, padding 0 12): status badge (draft or live) and 13 `--text-muted` text "Not live yet" or "Live". Hidden when collapsed.
4. Nav (margin-top 8): Overview (LayoutDashboard); Pages (FileText); Pictures (Image), the label is "Pictures" in all UI; Plugins (Puzzle) Soon; Settings (Settings) Soon.
5. Spacer, then a bottom block (padding-top 12, top border 1px `--border`): "Preview" secondary md full width with eye icon, linking to the homepage preview route; below it (margin-top 8) "Publish" primary md full width with rocket icon, `aria-disabled`, opacity 0.5, tooltip "Publishing is coming soon". Collapsed: both become 48x48 icon buttons.
6. Collapse toggle as in 5.3.

### 5.6 Mobile bottom tab bar (below 1024)
- Fixed bottom, height 64 plus safe-area inset, bg `--surface`, top border 1px `--border`, z-index 40, grid of equal columns.
- Tab: flex column centre gap 2, min-height 56, icon 22, label 11/600; inactive `--text-muted`; active `--primary` with a 3x24 bar (radius 0 0 3px 3px) at the very top of the tab. Pressed state bg `--row-hover`. Disabled "Soon" items are not shown on mobile.
- **Team routes (4 tabs):** Websites (LayoutGrid), Team (Users), Plan (CreditCard), Account (UserCircle).
- **Project routes (4 tabs):** Overview (LayoutDashboard), Pages (FileText), Pictures (Image), Websites (LayoutGrid; goes back to `/dashboard`).
- The bar hides while the on-screen keyboard is open (use `visualViewport` height change) and during dialogs.

### 5.7 Breadcrumbs (in the page header, not the top bar)
- Row height 24, margin-bottom 12, 14/500. Items are links in `--text-muted` (hover underline); the last item is plain text in `--text`; separators are chevron-right 14 `--text-muted` with margin 0 6. Long names truncate at 160 px with ellipsis and a `title` attribute.
- Trails: `/dashboard` none (no breadcrumb row; the title row starts directly). Team pages: "{Team name} / {Page}" (the team name links to `/dashboard`). Project pages: "{Team name} / {Project name} / {Section}"; pages: "... / Pages / {Page title}" where applicable. The project name links to the Overview.
- Below 640 show only a back link: arrow-left 16 plus the parent's label (for example "Pages"), 14/500 `--primary`, tap height 44 (negative margin to keep the row at 24 visual height).
- Markup: `<nav aria-label="Breadcrumb"><ol>` with `aria-current="page"` on the last item.

### 5.8 Team switcher
- Button (desktop): height 40, padding 0 10 0 8, radius 12, ghost with hover bg `--row-hover`, flex gap 8: a 24x24 rounded square (radius 8, bg `--accent-soft`, users icon 14 `--accent-text`), team name 15/600 (max-width 180, truncated), chevrons-up-down 16 `--text-muted`.
- Menu (width 280): label "Your teams" (12/700 caps, padding 8 12). Items (height 52, padding 0 12, radius 10): team name 15/600 truncated, plan badge, and a check icon `--primary` at the right for the current team; "Personal" 12 muted text under the name for the personal team. Selecting a team sets cookie `gs_team` and navigates to `/dashboard` with a soft navigation. Divider, then item "Add another team" (plus icon).
- "Add another team" opens a dialog (440): H3 "Add another team", text 16 `--text-muted` "Every account includes one free team. Extra teams need a paid plan, and payments are coming soon.", buttons "Close" (secondary md) and "See plans" (primary md, links to `/dashboard/plan`).
- If the user belongs to one team the menu still opens (it shows that team and the add item).
- Server rule: the current team is read from `gs_team` and validated against the user's memberships on every request; fall back to the personal team.

### 5.9 Quick find (Ctrl or Cmd + K, or `/` when no input is focused)
- Dialog aligned to the top: width min(560px, 100vw - 32px), margin-top 12vh, radius 20, bg `--surface`, raised shadow, scrim `--scrim-strong`. Below 640: full-screen sheet.
- Search row: height 56, padding 0 16, search icon 20, input 17 (no border, no ring beyond the dialog's own focus treatment), placeholder "Search websites, pages and settings", clear button when text exists, `esc` kbd chip on the right (hidden on touch).
- Results (max-height 360, scrollable, padding 8): group labels (12/700 caps, padding 8 12); items height 48, padding 0 12, radius 10, flex gap 12: icon tile 32x32 (radius 8, bg `--surface-muted`, icon 18), title 15/600 and a muted 13 detail (for example the web address or the project name) , a "Jump to" arrow on the active row. Active row: bg `--primary-soft`. Arrow keys move, Enter opens, Escape closes, focus is trapped and returns to the trigger.
- Groups and sources: **Websites** (all projects in the team), **Pages** (pages of the current project, only inside a project), **Go to** (Websites, Team, Plan and billing, Account, Request a demo). Matching is case-insensitive, accent-insensitive, substring first then subsequence; max 6 per group.
- Empty result: "Nothing found for "{query}"" 15 `--text-muted` centred with padding 32.
- Footer (desktop only, height 40, top border, padding 0 16, 12 `--text-muted`): "Up and down to move, Enter to open, Esc to close".
- Data: fetched on first open through one lightweight route handler (`/api/quick-find`), cached for 60 seconds in memory and invalidated after any create or delete of a website or page.

### 5.10 User menu (avatar)
Menu width 280, radius 16, padding 6. Header block (padding 12, bottom divider): name 15/600, email 13 `--text-muted`, both truncated. Items (height 44): "Account" (user-circle) to `/dashboard/account`; "Help" (life-buoy; opens the Help panel; shown here on mobile only); then a **Theme row**: label "Theme" 15 on the left, and a segmented control on the right with three 36x32 icon buttons (sun "Light", moon "Dark", monitor "Match my device"), stored in a cookie and applied server-side; then a divider; "Log out" (log-out icon, `--danger-text`). Footer row (padding 8 12 6, top divider): links "Terms", "Privacy" 12 `--text-muted`, separated by a dot.

### 5.11 Shared layout components (build these, use everywhere)
- `AppShell`: frame, top bar, sidebar, bottom bar, progress bar, toaster, Help panel mount.
- `AppPage` with prop `width: 'wide' | 'default' | 'narrow' | 'form'` mapping to max-width 1120, 960, 720, 560. Horizontal padding 20 (below 640), 24 (640 to 1023), 40 (1024 and above); top padding 32 (24 below 640); bottom padding 64 (96 below 1024 to clear the tab bar). Centred with `margin-inline: auto`. Never place custom widths on page content.
- `PageHeader` props: `breadcrumbs`, `title`, `description`, `actions`, `tabs`. Layout: breadcrumb row; title row with `display: flex; justify-content: space-between; align-items: flex-start; gap: 16`; left block title (28/32) and optional description (16/24 `--text-muted`, max-width 60ch, margin-top 4); right actions (flex, gap 8, wrap, flex-shrink 0). Below 640 the actions drop under the description (margin-top 16) and a single primary action becomes full width. Optional tab row (margin-top 24, bottom border 1px `--border`): underline tabs, height 48, 15/600, active `--primary` with a 3 px bar, inactive `--text-muted`. Margin below the whole header 32 (24 below 640).
- `Section`: title row (section title 18/24, optional description 14 `--text-muted`, optional right action), content margin-top 16; sections separated by 32.
- `StatCard`, `SettingsSection` (two-column settings row: label and description in 4 of 12 columns, controls in 8 of 12, at 768 and above; stacked below; sections separated by a 1px divider with 32 padding), `EmptyState`, `InfoBox` (info, warning, danger, success variants using the tokens), `ConfirmDialog`, `ListRow`, `SkeletonPage`.
- All pages compose only these.

### 5.12 Alignment and layout rules (apply everywhere)
1. Page title, breadcrumbs, section titles and the first card all share the same left edge (the container edge). Nothing is indented relative to it.
2. Primary actions sit at the right end of the title row on desktop; on mobile they sit below the title, full width when alone.
3. Cards in a row have equal height (`align-items: stretch`); card footers are pinned to the bottom (`margin-top: auto`).
4. Two-line list rows: title top, supporting text below, both left aligned; statuses and actions right aligned and vertically centred.
5. Numbers in comparison tables are centred under their column header; text columns are left aligned.
6. Grid gaps: 24 at 768 and above, 16 below. Card grids: 1 column below 640, 2 from 640, 3 from 1024 inside wide containers (2 inside default containers).
7. No horizontal scrolling on the page at any width from 360 up. Wide tables scroll inside their own `overflow-x: auto` container with a visible right-edge fade.
8. Icons sit on the text baseline centre line, with 8 px gap to text; icon-only buttons are 44x44 with the icon centred.
9. Truncate long names with ellipsis and `title`, never wrap names in rows or menus.
10. Vertical rhythm: no stray margins; spacing always comes from the tokens in Section 4.

## 6. Screens

### 6.1 Websites (`/dashboard`, wide)
- PageHeader: no breadcrumbs; title "Websites"; description "Everything in {team name}."; action "Create website" primary md with plus icon (leads to `/dashboard/new`; at the limit it stays enabled and opens the limit dialog described below).
- **Summary card** (margin-bottom 32): padding 20; grid 1 column below 768 (cells separated by 1px dividers, padding 12 0), 3 columns from 768 (vertical 1px dividers, padding 0 24, first cell padding-left 0). Cell: icon tile 40x40 (radius 12, bg `--accent-soft`, icon 20 `--accent-text`; icons globe, users, sparkles), label 13 `--text-muted`, value 24 Bricolage 700 ("0 of 1"), progress bar (margin-top 8, hidden when the limit is unlimited). Cells: "Websites", "Team members", "AI credits left".
- **Your websites** Section: title "Your websites" with the count in a neutral pill. Empty state when none: dashed card (2px dashed `--border-strong`, radius 20, padding 48, 32 on mobile), 96 circle `--accent-soft` with layout-template icon 48, H2 (22) "Let us get your business online", text 16 muted max-width 420 "It takes about 5 minutes. We will ask a few simple questions and set everything up for you.", button lg "Create your first website".
- **Website card**: Card with padding 0 and overflow hidden; grid 1, 2 (from 640), 3 (from 1024) columns, gap 20. The whole card is a link (stretched link technique) to the project, with a separate kebab button above it (z-index) for the menu. Thumbnail aspect 16:10 using the gradient and mini-browser style from the old spec; status badge top-left inset 12 (draft or live). Body padding 16: name 16/600 truncated; address row (margin-top 4) globe icon 14 and "name.get-on.tech" 13 `--text-muted` truncated. Footer row padding 0 16 16, margin-top 12: left small text "Edited {relative time}" 12 `--text-muted`; right kebab button 40x40 with Menu "Open", "Preview", "Delete website" (destructive; same delete dialog as before). Hover: border `--border-strong`, shadow-sm, thumbnail scale 1.02 (150 ms, clipped).
- At the plan limit, "Create website" opens a dialog (440): lock icon in a 48 circle `--warning-soft`, H3 "Your {Plan} plan includes {n} website{s}", text "To add another website, you will need a bigger plan.", buttons "Close" and "See plans" (links to `/dashboard/plan`).
- **Help strip** (margin-top 32): Card padding 20, flex gap 16 (stacked on mobile): left a 48 tile (life-buoy, bg `--info-soft`, icon `--info-text`), text block title 16/600 "Not sure where to start?" and body 15 `--text-muted` "Request a demo and we will walk you through it, or message us any time."; right buttons "Request a demo" (secondary md, links to `/request-demo`) and "Open help" (ghost md, opens the Help panel).

### 6.2 Plan and billing (`/dashboard/plan`, default)
- PageHeader: breadcrumbs "{Team} / Plan and billing"; title "Plan and billing"; description "Your plan applies to everyone in {team name}."
- **Current plan card** (padding 24): grid 12 columns at 768 and above (left 7, right 5), stacked below.
  - Left: eyebrow "Your plan"; plan name Bricolage 700 28 with the plan badge; price line 16 `--text-muted` ("Free forever" or "$7.99 per month"); one-sentence description 15 `--text-muted` ("To try it out. Includes one website with one page.").
  - Right: usage list (gap 16): rows with label 14/600, "{used} of {limit}" 14 `--text-muted` right aligned, progress bar beneath. Rows: Websites, Team members, AI credits this month, Storage (MB). Real numbers from the database.
- **Billing note** (margin-top 16): InfoBox info variant, icon info 18: "Payments are coming soon. When they are ready, you will be able to upgrade here in a few taps."
- **Compare plans** Section (title "Compare plans"): table in a bordered card (radius 16, overflow-x auto, min table width 720). First column sticky (left 0, bg `--surface`, width 200, label 15/600). Four plan columns each 160 wide, header cell padding 16: plan name 16/700, price 14 `--text-muted` ("$0", "$7.99 / month", "$13.99 / month", "$59.99 / month"), a "Current plan" primary pill under the current plan's name. The current column has bg `--primary-soft` throughout. Rows (height 52, bottom border 1px `--border`): Websites; Pages per website; Team members; Extra features (plugins); Your own domain (check or dash); No Get-On badge (check or dash); Support priority (Standard, Standard, Priority, Highest); AI credits per month; Picture storage; Subscriber emails per month (dash on Free). Values centred; check icons 18 `--success`, dash icons 18 `--text-muted`. Last row (height 72) buttons: for plans above the current: "Upgrade" secondary md, `aria-disabled`, tooltip "Payments are coming soon"; Enterprise: "Talk to us" primary md linking to `/request-demo?interest=enterprise`; for the current plan: text "Your plan" 14 `--text-muted`. Data comes from the shared plans constant (the same one used on the landing page).
- **Billing history** Section (margin-top 32): EmptyState (dashed, compact padding 32) with receipt icon 40, "No invoices yet", "Your receipts will show up here once payments start."

### 6.3 Team (`/dashboard/team`, default)
- PageHeader: breadcrumbs "{Team} / Team"; title "Team"; description "People who can work on {team name}."
- **Members** Section: Card padding 0; ListRow per member (min-height 72, padding 12 20, top divider): avatar 40 (initials 14/700, bg `--accent-soft`), name 15/600 and email 13 `--text-muted`, role badge on the right (Owner primary, Admin neutral, Editor neutral, Viewer neutral). "You" neutral pill after your own name. Data from `team_members`.
- **Invite people** Section: Card padding 20. Fields row: Email input and Role Select (Admin, Editor, Viewer), "Send invite" primary md; all disabled with `aria-disabled`. Above them an InfoBox (info or warning variant): for plans with 1 seat: "Your {Plan} plan includes 1 team member. Upgrade to add more people." with a "See plans" secondary sm; for Pro: "{used} of 5 seats used. Invitations are coming soon."; Enterprise: "Invitations are coming soon."
- **What each role can do** Section: Card padding 0; four rows (padding 16 20): role badge, one-line description: Owner "Everything, including billing and deleting the team."; Admin "Manage people and settings. Cannot delete the team."; Editor "Edit pages and pictures."; Viewer "Look at the website. Cannot change anything."
- **Team name** (SettingsSection inside a card): Input "Team name" prefilled, saved with a "Save" primary md (enabled only when changed; only owners and admins; others see it read-only). Success toast "Team name saved."

### 6.4 Account (`/dashboard/account`, narrow)
- PageHeader: breadcrumbs "Account"; title "Account"; description "Your personal details and settings."
- Use `SettingsSection` rows inside one card (padding 24, sections divided by 1px lines):
  1. **Profile**: Full name Input; Email (read-only Input with lock icon, helper "To change your email, contact support."); "Save changes" primary md.
  2. **Password**: New password Input with show/hide, Confirm password Input, helper "At least 8 characters."; "Update password" secondary md. Errors in plain words ("Those passwords do not match.").
  3. **Appearance**: segmented control Light, Dark, Match my device (same as the user menu).
  4. **Delete account** (danger styling: title in `--danger-text`): text "To delete your account and everything in it, contact us. We will help you export your data first." and a secondary md button "Contact support" opening the Help panel (not a mailto).

### 6.5 Project overview (`.../[projectId]`, default)
- PageHeader: breadcrumbs "{Team} / {Project}"; title "Overview"; description "Here is what to do next to get your website ready."; actions "Preview" secondary md (eye icon) and "Edit homepage" primary md (pencil icon).
- Layout from 1024: two columns (main 1fr and aside 280, gap 24); below, one column in this order: Setup checklist, Aside cards, Preview.
- **Main:** the Setup checklist card as before, restyled with the new tokens (padding 24, row min-height 64); under it the live homepage preview card (aspect 16:10, max-height 360, as previously built, the "Edit homepage" overlay button removed because it is now in the header).
- **Aside (stack, gap 16):**
  - "Your web address" card (padding 16): label 12 caps, address 16/600 `--primary` wrapped with `word-break: break-all`, buttons row (margin-top 12, gap 8): "Copy" secondary sm (copy icon; toast "Address copied.") and "Open" secondary sm (external-link icon, `aria-disabled` with tooltip "Your website is not live yet").
  - StatCards "Pages" ("1 of 1" and bar), "Storage" ("0 MB of 100 MB" and bar), "Status" (draft badge and "Not live yet").
  - "Need help?" card (padding 16, bg `--info-soft`): 14 `--info-text` "Stuck? We are happy to help." and a "Open help" ghost sm button.

### 6.6 Pages (`.../pages`, default) and Pictures (`.../images`, default)
- Use PageHeader and the layout rules above. Breadcrumbs "{Team} / {Project} / Pages" (or "Pictures"). Titles "Pages" and "Pictures" with the "{used} of {limit}" description. Their primary action ("Add page", "Upload pictures") sits in the header actions slot.
- Page rows keep their content from the earlier spec, restyled: Card padding 0; rows min-height 72; drag handle 44x44 at the left; title 15/600 with the Home pill; address 13 `--text-muted`; status badge; "Edit" secondary sm and kebab 44x44 at the right; "Edited {relative time}" under the address 12 `--text-muted`.
- Picture grid: 2 columns below 640, 3 from 640, 4 from 1024; gap 12 (16 from 768).

### 6.7 Loading, empty and error states
- Each route has a `loading.tsx` that renders `AppPage`, a skeleton PageHeader (breadcrumb bar 14x160, title bar 28x240, description bar 16x320), and skeletons for its main blocks with the exact final dimensions (cards 88 high for summary, 3 website cards with 16:10 thumbnails, 72-high rows, and so on). Shimmer 1.2 s. Skeletons appear only if loading lasts more than 150 ms (avoid flicker).
- Each route segment has `error.tsx` (inside the shell, so navigation still works): InfoBox danger variant card centred with alert icon 24, H3 "Something went wrong", text "We could not load this page. Please try again.", buttons "Try again" (primary md, calls `reset`) and "Back to my websites" (secondary md).
- `not-found.tsx` inside the shell: icon in an `--accent-soft` circle 56, H1 (24) "We could not find that page", sub 15 muted, button "Back to my websites".
- Permission denied (a project in another team): same as not found, with no information leak.

## 7. Seamless behaviour requirements
1. **Persistent shell.** `AppShell` lives in a layout that never unmounts while moving between dashboard routes, including between team and project levels. Only the page content swaps. A Playwright test must prove that a marker set on the sidebar DOM node survives navigation (no full page reload).
2. **Prefetch.** All shell and page links use `next/link` with prefetch on viewport and on hover. Prefetch the project's Overview, Pages and Pictures routes when the project sidebar mounts.
3. **Top progress bar.** A 3 px bar at the very top of the viewport (above the top bar, z-index 60, colour `--primary`, with a soft glow `0 0 8px var(--primary)`), starting after 120 ms of pending navigation, trickling to 80% and completing with a 150 ms fade. No bar for navigations under 120 ms.
4. **Skeleton and streaming.** Use `loading.tsx` and `Suspense` boundaries so the shell and page header appear instantly and data blocks stream in (summary card, website list, checklist, preview each in its own boundary).
5. **Data fetching once.** Fetch user, current team and plan once per request in the shell layout using React `cache()` and pass what children need through server components or a small context; pages never refetch them.
6. **Optimistic UI** for rename, reorder, set homepage, delete, theme and team name saves, with rollback and a friendly toast on error. Mutations revalidate by tag (`team:{id}`, `project:{id}`, `pages:{projectId}`), never the whole route tree.
7. **Preserved state.** Scroll position is restored on back and forward. Sidebar state, theme and current team come from cookies and render correctly on the server (no flash). Form drafts in the wizard and settings forms survive reloads.
8. **Content transition.** A `template.tsx` wraps page content and fades it in over 120 ms (opacity only). The shell does not animate.
9. **Unsaved changes guard.** Forms with unsaved edits (team name, account profile) warn before navigating away (in-app link click and `beforeunload`) with a ConfirmDialog "Leave without saving?" (buttons "Keep editing" and "Leave"). The editor continues to flush autosave as before.
10. **Session expiry.** If a request returns unauthorised, redirect to `/login?next={current path}`; after login return to that path. Never lose the user's place silently.
11. **Keyboard.** Ctrl or Cmd+K and `/` open quick find; `[` toggles the sidebar; Escape closes dialogs, menus and the Help panel. Visible focus everywhere; skip link "Skip to content" as the first focusable element (visible on focus: top-left inset 12, height 44, padding 0 16, radius 12, bg `--primary`, white text).
12. **Performance budgets.** The shell should ship the minimum client JavaScript: server components by default; client components only for the sidebar collapse, menus, quick find, progress bar and forms. Cached navigations should paint the new page's skeleton in under 100 ms. No layout shift when the sidebar state is restored (use the cookie value on the server).
13. **Offline and failure.** Failed mutations never leave the UI in a wrong state. A global listener shows the toast "You seem to be offline. We will keep trying." once per outage.

## 8. Request a demo

### 8.1 Database (new migration)
`demo_requests`:
- `id uuid primary key default gen_random_uuid()`, `created_at timestamptz default now()`
- `full_name text not null`, `email text not null`, `phone text null`, `business_name text not null`
- `business_type text null`, `websites_needed text check (websites_needed in ('1','2-5','6-20','20+')) not null`
- `meeting_method text check (meeting_method in ('video','phone','whatsapp')) not null`
- `preferred_time text check (preferred_time in ('morning','afternoon','evening','any')) not null`
- `timezone text null`, `message text null` (max 500 characters), `interest text null` (for example `enterprise`)
- `consent boolean not null` (must be true), `status text not null default 'new' check (status in ('new','contacted','scheduled','closed'))`
- `user_id uuid null references auth.users`, `source_page text null`, `ip_hash text null`, `user_agent text null`
- Index on `(ip_hash, created_at desc)` and on `(email, created_at desc)`.
- Row Level Security enabled with **no** policies for anonymous or authenticated roles. Inserts happen only from the server with the service role. Add a database test proving an anonymous client cannot select or insert.

### 8.2 Server logic
- Server action `submitDemoRequest(formData)` with a shared Zod schema (also used in the client for instant validation): trim all strings; name 2 to 80 characters; email valid and at most 254; phone optional, 6 to 20 characters of digits, spaces, plus, dash and parentheses; business name 2 to 80; message at most 500; consent must be true.
- Spam protection: hidden honeypot field named `website` (positioned off screen, `tabindex="-1"`, `autocomplete="off"`, `aria-hidden`); reject silently (respond as success) when it is filled. A signed time token rendered with the form; reject if submitted in under 3 seconds or older than 2 hours. Cloudflare Turnstile verification when `TURNSTILE_SECRET_KEY` and `NEXT_PUBLIC_TURNSTILE_SITE_KEY` exist (invisible mode); skipped otherwise.
- Rate limits, from the database: at most 3 requests per `ip_hash` per hour and 5 per email per day. `ip_hash = sha256(ip + IP_HASH_SALT)`; never store raw IPs. Over the limit returns the friendly error below.
- On success: insert, then send two emails through `lib/email.ts` (a small provider-neutral interface; the default adapter uses Resend with `RESEND_API_KEY`; when no key exists, log the email to the console in development and still succeed):
  1. To `SUPPORT_EMAIL`: subject "New demo request: {business name}"; plain text and simple HTML with every field, a "Reply to {email}" line and the interest.
  2. To the requester: subject "We got your demo request"; short, warm text: "Hi {first name}, thanks for asking about Get-On. We will email you within 1 working day to agree a time that suits you. If anything changes, just reply to this email." Sign-off "The Get-On team". Include a footer line with the privacy link. Reply-to is `SUPPORT_EMAIL`.
  Email failures are logged and do not fail the request.
- Return typed results: `{ ok: true }` or `{ ok: false, code: 'VALIDATION' | 'RATE_LIMIT' | 'SERVER', fieldErrors? }`.

### 8.3 Page layout `/request-demo` (public layout: landing header and footer)
- Page bg `--bg`. Section padding 48 0 64 (64 0 96 at 1024+), container 1120, padding-inline 20 (32 at 768+).
- Grid: from 1024, 12 columns, gap 64: copy block spans 5 columns, form card spans 7, both aligned to the top (form card sticky is not needed). Below 1024: stacked, copy first, form after (margin-top 40).
- **Copy block:**
  - Eyebrow pill "Request a demo" (height 32, padding 0 12, radius 999, bg `--accent-soft`, text `--accent-text` 14/600, video icon 16 at left).
  - H1 "See Get-On in action." Display style (40/44 mobile, 52/56 from 1024), margin-top 16.
  - Subheading 18/1.6 `--text-muted` max-width 480, margin-top 16: "A short, friendly call where we show you how it works and answer your questions. No technical knowledge needed."
  - "What happens next" label (12/700 caps, margin-top 32). Ordered steps (gap 20, margin-top 16): number circle 32 (bg `--primary`, white 14/700), title 16/600, text 15 `--text-muted`. 1: "You send the form" / "It takes about a minute."; 2: "We reply within 1 working day" / "We will suggest a time that suits you."; 3: "We show you around" / "About 20 minutes, and you can ask us anything."
  - Reassurance row (margin-top 32, gap 12, wrap): three chips (height 36, padding 0 12, radius 999, bg `--surface`, 1px `--border`, 14/500, icon 16 `--primary` and text): clock "20 minutes", video "Video, phone or WhatsApp", shield-check "No pressure".
  - Small text (margin-top 24, 14 `--text-muted`): "Prefer to write? Email us at {SUPPORT_EMAIL}."
- **Form card:** Card, padding 24 (32 at 640+), radius 24, shadow card (this card keeps the landing shadow style). H2 (22) "Tell us a little about you", sub 15 `--text-muted` margin-top 4, form margin-top 24, field gap 16.
  - Row 1 (2 columns from 640, gap 16): "Your name" (autocomplete name), "Email" (type email, inputmode email, autocomplete email).
  - Row 2: "Phone or WhatsApp (optional)" (type tel, autocomplete tel, helper "Include the country code"), "Business name".
  - Row 3: "Type of business" Select (options from the shared business types list, plus "Something else", placeholder "Choose one"), "How many websites do you need?" Select ("Just 1", "2 to 5", "6 to 20", "More than 20").
  - "How would you like to meet?" radio cards in a 3-column row (stacked below 480): each min-height 72, padding 12, radius 14, 1.5px `--border-strong`, flex column centre gap 6, icon 22 `--primary`, label 14/600 ("Video call", "Phone call", "WhatsApp"); selected: 2px `--primary`, bg `--primary-soft`. Default "Video call".
  - "When suits you best?" segmented control (4 options: "Morning", "Afternoon", "Evening", "Any time"), default "Any time"; helper 13 `--text-muted` "Your time zone: {detected timezone}" (detected on the client with `Intl`, saved in the hidden `timezone` field).
  - "What would you like to see? (optional)" Textarea (min-height 112, counter 0/500, placeholder "For example: how to build a simple website for my shop.").
  - Consent checkbox (custom 24x24, radius 8, 2px `--border-strong`, checked: bg `--primary` with white check; row min-height 44 with the label 14/1.5): "I agree that Get-On may contact me about my demo request. See our Privacy Policy." where "Privacy Policy" links to `/privacy` in a new tab. Required.
  - Submit button lg full width "Request my demo"; loading text "Sending..."; below it (margin-top 12) 13 `--text-muted` centred "We only use your details to arrange your demo."
  - If the visitor is logged in, prefill name and email from the profile and show nothing else different. If the URL contains `?interest=enterprise` show a neutral pill "Asking about: Enterprise" under the card subtitle (and store it).
  - Validation: on blur and on submit; errors per field with the standard error style; on submit focus the first invalid field and show a banner above the form "Please check the highlighted fields."
- **Success state** (replaces the card content, no page change, focus moved to the heading): 72 circle `--success-soft` with check icon 32 `--success`; H2 "Thank you, {first name}!"; text 16 `--text-muted` "We have your request. We will email you at {email} within 1 working day to agree a time."; summary box (bg `--surface-muted`, radius 16, padding 16, rows 14: "Meeting" value, "Best time" value, "Business" value); buttons "Back to home" secondary md and, when logged in, "Go to my dashboard" primary md.
- **Error banners** (above the form): rate limit "You have sent a few requests already. Please wait a little and try again, or email us at {SUPPORT_EMAIL}."; server error "We could not send your request. Please try again, or email us at {SUPPORT_EMAIL}." Both use the danger banner style and `role="alert"`.
- Metadata: title "Request a demo | Get-On", description "See how Get-On works in a short, friendly call. No technical knowledge needed." Add to `sitemap.xml`.

### 8.4 Entry points and replacements
- Remove any Contact page or link from the codebase; add the 308 redirect from `/contact`.
- Landing header: right group becomes "Log in" (ghost md), "Request a demo" (secondary md, hidden below 1024), "Start free" (primary md). The mobile menu panel gets a "Request a demo" row (56 high) above "Log in".
- Landing footer: Company column shows "Request a demo"; the Legal column shows "Terms of Service", "Privacy Policy", "Cookie Policy", "Acceptable Use".
- Pricing: the Enterprise button label becomes "Talk to us" and links to `/request-demo?interest=enterprise`.
- FAQ: add item "Can I see a demo first?" / "Yes. Request a demo and we will show you around and answer your questions." (link inside the answer to `/request-demo`).
- Final CTA panel: under the white "Start free" button add a text link "or request a demo" (white, underlined, 15/600, margin-top 16).
- Dashboard: the Help strip (6.1), the Plan page Enterprise button, the quick find "Go to" group, and the Help panel footer line "Want a walkthrough? Request a demo" (14 `--text-muted`, link in `--primary`).

## 9. Legal pages

### 9.1 Shared setup
- Routes `/terms`, `/privacy`, `/cookies`, `/acceptable-use`, each statically rendered, with the landing header and footer.
- Constants in `lib/company.ts` read from environment variables with obvious placeholders: `COMPANY_NAME` ("Get-On"), `LEGAL_ENTITY` ("[Company legal name]"), `COMPANY_COUNTRY` ("[Country]"), `COMPANY_ADDRESS` ("[Registered address]"), `SUPPORT_EMAIL`, `PRIVACY_EMAIL`, `ABUSE_EMAIL`, `LEGAL_EFFECTIVE_DATE` (default today's date at build in ISO), `LEGAL_REVIEW_PENDING` (default `true`).
- When `LEGAL_REVIEW_PENDING` is true: show a banner at the top of every legal page (bg `--warning-soft`, 1px `--warning-border`, radius 12, padding 12 16, alert icon 18 `--warning-text`, 14 `--warning-text`): "Draft. These pages must be reviewed by a qualified lawyer before launch." Also render every unresolved placeholder and every `[[DECISION: ...]]` marker as highlighted text (`mark` with bg `--accent-soft`, text `--accent-text`, radius 4, padding 0 4). A unit test fails the production build when `LEGAL_REVIEW_PENDING` is false and any placeholder or marker remains.
- Write the text in plain, short sentences at roughly an eighth-grade reading level. No legalese when a simple word exists. Use "we" and "you". Do not invent facts about the company; use the constants and `[[DECISION: ...]]` markers.
- Content is authored as typed TypeScript or MDX data (sections with ids, titles and blocks), so the table of contents and the "short version" box are generated from it.

### 9.2 Page layout (all four)
- **Hero band:** bg `--surface-muted`, bottom border 1px `--border`, padding 48 0 (64 0 from 768). Container 1120. Eyebrow "Legal" (14/700 caps `--primary`). H1 (36/44, 44/52 from 1024, Bricolage 700) with the page title. Meta row (margin-top 16, 14 `--text-muted`, flex space-between wrap gap 12): "Last updated {date}" with calendar icon 16, and on the right "Print this page" ghost sm button (printer icon).
- **"The short version" card** (margin-top 32, max-width 720): bg `--surface`, 1px `--border`, left border 4px `--primary`, radius 16, padding 20; title 16/700 "The short version"; 3 to 5 bullets at 15/1.6 (check-circle 18 `--success` markers, gap 8) summarising the page in plain words.
- **Body:** container 1120, padding 48 20 (64 32 from 768). From 1024: grid with columns 240px and minmax(0, 720px), gap 64, centred. TOC column sticky at top 96.
  - TOC: label "On this page" (12/700 caps). Links 14/500, padding 6 12, border-left 2px `--border`, text `--text-muted`; active (scroll spy by IntersectionObserver in a tiny client component) border `--primary`, text `--primary`, weight 600; hover text `--text`.
  - Below 1024: the TOC is a `<details>` card above the content (radius 16, 1px `--border`, summary height 48 padding 0 16 15/600 with chevron, list padding 8 16 16).
  - **Typography:** H2 24/32 Bricolage 700, margin-top 48 (first 0), `scroll-margin-top: 88px`; H3 18/26 weight 600, margin-top 28; paragraphs 16/1.7 `--text`, margin-bottom 16; lists with 24 indent and 8 gap; links `--primary` underlined, offset 3; inline code and email in 15; tables: bordered (1px `--border`), radius 12, overflow-x auto, header row bg `--surface-muted` 13/700 caps, cells padding 12 16, 15. Section numbering shown as "1. ", "2. " in H2.
  - **Heading anchors:** hovering or focusing an H2 reveals a 32x32 link-icon button at the left (outside the text column on desktop, inline after the text on mobile) that copies the section URL (toast "Link copied.").
- **End of page:** card (padding 20, radius 16, bg `--surface-muted`, margin-top 48): "Questions about this page?" 16/600 and "Email us at {PRIVACY_EMAIL}." 15 `--text-muted`; below it a row of links to the other three legal pages (14/600, gap 16).
- A floating "Back to top" button (44x44 circle, bg `--surface`, 1px `--border`, shadow card, arrow-up icon 20) bottom-right inset 20 appears after scrolling 600 px.
- **Print stylesheet:** hide header, footer, hero meta buttons, TOC and floating buttons; black text on white; 12 pt; show URLs after links; avoid page breaks inside headings and list items; keep the title and "Last updated" at the top.
- Metadata per page; all four are in `sitemap.xml`; each has a canonical URL.

### 9.3 Required content per page
Each topic below must appear as its own section. Fill every sentence from the constants or markers; where a legal choice is needed, write `[[DECISION: ...]]` with a short explanation of the choices.

**Terms of Service** (title "Terms of Service")
1. Who we are and what these terms cover (service description in plain words; acceptance by creating an account or using a site).
2. Your account (age requirement `[[DECISION: minimum age, for example 16 or 18]]`, accurate details, keeping your password safe, one free team per account).
3. Teams, plans and payments (plans are paid per team; limits per plan; prices shown in US dollars; payments are not live yet, so describe this generically and add `[[DECISION: payment provider, billing cycle, refunds and cancellation terms]]`).
4. Free plan and the Get-On badge (one website, one page, our badge stays on free sites, we may change free limits with notice).
5. Your website and your content (you own your content and are responsible for it; you give us permission to host, copy and display it only to run the service; we do not claim ownership).
6. Addresses and domains (free addresses on get-on.tech belong to Get-On and may be reclaimed if abusive or unused `[[DECISION: inactivity period]]`; custom domains stay yours).
7. AI features (results can be wrong or similar to others; you must check them; credits and fair-use limits; do not enter private data you do not want processed by our AI providers).
8. Email, subscribers and contact forms (you are responsible for having permission to email people and for following anti-spam and privacy laws; sending limits per plan; we may pause sending if complaints are high).
9. Acceptable use (summary and link to the Acceptable Use Policy).
10. Backups and availability (we make backups but you should keep your own copies; no promise of uninterrupted service; planned maintenance).
11. Ending things (you can cancel any time; we may suspend or end accounts that break the rules, with notice where possible; deleted websites can be recovered for 14 days, then are removed permanently).
12. Our responsibility (a plain-language limit of liability and no-warranty section `[[DECISION: liability cap and jurisdiction-specific wording; lawyer must review]]`).
13. Changes to these terms (how and when we notify; continued use means acceptance).
14. Governing law and disputes `[[DECISION: governing law, courts or arbitration]]`.
15. Contact (support email and address).

**Privacy Policy** (title "Privacy Policy")
1. Who is responsible for your data (the legal entity and contact; two roles: for our own account data we are the controller; for visitor data on customers' websites we act on the customer's behalf, and the customer is responsible for their visitors).
2. What we collect (account details: name, email, password hash; team and billing details when payments exist; website content and pictures; messages and subscriber lists collected through customers' sites; usage and security logs such as hashed IP addresses; demo request details; support messages).
3. Why we use it and our legal reasons (to run the service, security and abuse prevention, support, legal duties, improving the product, with consent for marketing emails) `[[DECISION: confirm legal bases and applicable laws such as GDPR or local law]]`.
4. Who we share it with (providers that help us run Get-On, listed by role and with placeholders for names that are not final: database and login, hosting and network, email delivery, AI generation, payments, error monitoring; we do not sell personal data).
5. Where your data is stored and transfers `[[DECISION: data regions]]`.
6. How long we keep it (account while active; deleted websites 14 days then removed; backups rolling window; demo requests `[[DECISION: retention period]]`; security logs short period).
7. Your choices and rights (access, correction, export, deletion, objection, withdrawing consent; how to ask; timeline `[[DECISION]]`).
8. Security (plain description of what we do: encryption in transit, access controls, backups, abuse monitoring; no system is perfectly secure).
9. Children (not for children under the minimum age).
10. Cookies (link to the Cookie Policy).
11. Visitors to websites built with Get-On (we may process basic technical data to deliver pages; the website owner is responsible for their own notices).
12. Changes to this policy.
13. Contact and complaints (privacy email, address, and the right to complain to a data protection authority).

**Cookie Policy** (title "Cookie Policy")
1. What cookies are (two plain sentences).
2. How we use them: only essential cookies for now; no advertising cookies; no third-party tracking.
3. A table of cookies with name, purpose, who sets it, how long it lasts. Include at minimum: the Supabase session cookies (login), `gs_team` (current team), `gs_sidebar` (sidebar state), theme cookie (light or dark), wizard draft storage (local storage, say so), anti-spam token if Turnstile is on. Mark durations from the real code, not guesses.
4. Cookies on websites built with Get-On (website owners may add their own tools; we only set essential ones).
5. How to control cookies in a browser (generic instructions).
6. Changes and contact.
Do not build a consent banner now, because only essential cookies exist. Add a `CookieConsent` component stub, off behind the flag `NEXT_PUBLIC_COOKIE_CONSENT=false`, documented in `docs/legal.md` for when analytics are added.

**Acceptable Use Policy** (title "Acceptable Use Policy")
1. Why this policy exists (protect visitors, customers and the shared get-on.tech domain).
2. What you may not publish or send: illegal content; phishing, scams or fake login pages; impersonation of people, businesses or brands; malware or harmful code; hate or harassment; content that sexualises or endangers children (zero tolerance, reported to authorities); content that infringes others' rights; misleading health or financial claims; sexual content `[[DECISION: whether adult content is allowed at all]]`; weapons and drug sales `[[DECISION]]`.
3. Email and subscriber rules (consent, no purchased lists, honour unsubscribes, no deceptive subjects).
4. Platform abuse (circumventing limits, creating many free accounts, reselling free sites, scraping, overloading, probing for weaknesses).
5. Addresses (names that mislead or imitate others, reserved names).
6. How we enforce (automated checks and reports; steps: remove content, warn, suspend, end the account; immediate action for serious harm; how to appeal).
7. Reporting a problem (email `{ABUSE_EMAIL}`; a "Report this site" link will come to every free site).
8. Changes and contact.

## 10. Small changes to landing and auth
- Landing header, footer, pricing button, FAQ and final CTA as in Section 8.4.
- Signup page: under the submit button (margin-top 12, 13 `--text-muted`, centred, line-height 1.5): "By creating an account you agree to our Terms of Service and Privacy Policy." with both as links (opening in a new tab).
- Login page unchanged. Both pages keep their old layout.
- Replace the placeholder Terms and Privacy pages from the first build with the real ones from Section 9.
