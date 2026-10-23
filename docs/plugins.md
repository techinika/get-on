# Plugins

Plugins add optional features to one website (project). The first real plugin is Contact, which adds forms, a Messages inbox and email notifications.

## Layout
- `packages/plugins/src/registry.ts` is the source of truth for the UI: `id`, `name`, `tagline`, `icon`, `status`, `freeOk`, `blocks`, `templates`, `nav`, `settingsRoute`, `checklist`.
- `supabase/migrations/20261023000100_plugins.sql` holds `plugin_catalog`, `plugin_installs`, the `enable_plugin` / `disable_plugin` RPCs and the per-project lock helper.
- `apps/web/app/dashboard/(shell)/projects/[projectId]/plugins` is the Plugins screen. `.../plugins/contact` holds Contact settings.
- `apps/web/lib/contact/` holds form validation, spam scoring, rate limits, notification caps, phone/mail links and CSV export.
- `packages/publisher` puts the enabled forms and plugin ids into `publishes.forms` and `publishes.plugins`; generated pages only show the form when Contact was on at publish time.

## Adding a plugin
1. Add the manifest entry with its blocks, templates, nav item, settings route and checklist item.
2. Add the plugin to `plugin_catalog` in a migration. `apps/web/tests/plans-drift.test.ts` checks the catalog and plan limits stay aligned.
3. Add block schemas in `@get-on/blocks`, rendering in `@get-on/renderer`, template builders in `@get-on/blocks/templates` and tests for every template.
4. Add routes, server actions, navigation and settings copy.
5. Update `docs/ui-spec-plugins.md`, `docs/blocks.md` and `docs/editor.md` if the editor changes.
6. Keep new UI copy plain: no database, DNS, SMTP or token words.

## Rules
- Every available plugin must ship at least 8 template variations across at least 2 categories.
- Free allows exactly one plugin, and only plugins flagged `freeOk` (currently Contact).
- Limits are per website: Free 1, Basic 2, Pro 5, Enterprise unlimited.
- Free never gets auto-reply; it is Basic and above.
- Plugins are enabled through the RPC, never by writing `plugin_installs` from the browser.
- Turning a plugin off keeps its data. Forms disappear from the live site at the next publish.
- Coming soon plugins are shown but cannot be turned on.

## Contact plugin
### Form pipeline
1. A published visitor posts to `/_forms/{formId}` on the site host.
2. The site Worker reads the form, signs `x-gs-host`, `x-gs-ip`, `x-gs-ua`, `x-gs-ts` and `x-gs-sig`, and forwards the request to `APP_ORIGIN/api/public/forms/{formId}`.
3. The app verifies the Worker signature and the form token (`FORM_TOKEN_SECRET`). Tokens are valid for 7 days; older ones are heavily penalised, not rejected.
4. Validation, the honeypot, spam scoring, per-IP short/daily limits and the plan daily cap run before insert. Honeypot hits return success and are discarded.
5. Accepted messages trigger `after()`: owner notification (or hourly digest), then an optional auto-reply. Delivery is best effort and never blocks the visitor's thank-you page.

### Limits and safety
- Per IP: 5 messages per 10 minutes and 15 per day. Plan daily caps: Free 20, Basic 100, Pro 300, Enterprise 1000.
- Duplicate email + message in 24 hours is ignored.
- Notifications: at most 20 per hour and 100 per day per project; over the hourly cap sends one digest per hour.
- Auto-reply: Basic+, at most one per visitor per site per 24 hours, 100 per day per site.
- At most 3 extra recipients. They must confirm by email first. Owners always receive messages.
- Recipients, message contents and IP hashes are readable only by owners, admins and editors of the team.
- Spam is deleted after 30 days. Run `pnpm job:cleanup` from a daily cron (`0 3 * * *`) to remove it.

### Email
Recipients get a notification with Reply-To set to the visitor. Auto-replies go from `"{Business} via Get-On" <team@get-on.tech>` with Reply-To set to the first confirmed recipient (or the owner). See `docs/ses-setup.md`.

### Editor and publish
- Forms are ordinary blocks, so they work without JavaScript on the live site.
- The editor can add a form from the Basic group or from Ready-made templates. If Contact is off, adding one opens the turn-on dialog first.
- Publishing writes `forms` and `plugins` on the publish row. Publish pre-flight warns when saved pages contain a form but Contact is off.

## Navigation
The project sidebar shows Plugins for every project. When any plugin provides items, a "Your plugins" section appears; Contact adds Messages with an unread badge. The mobile More sheet also shows Messages. Quick find adds Plugins and, when on, Messages for the current website.

## AI
Templates are plain data so a later AI pass can use them as defaults without changing the renderer or the saved block shape.
