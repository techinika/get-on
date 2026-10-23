# Legal pages

The four legal pages live in the app and are built from typed content, so the
table of contents and the "short version" box are generated from the same
source as the body text.

| Route | File | Content source |
| --- | --- | --- |
| `/terms` | `apps/web/app/terms/page.tsx` | `apps/web/lib/legal-content.ts` |
| `/privacy` | `apps/web/app/privacy/page.tsx` | `apps/web/lib/legal-content.ts` |
| `/cookies` | `apps/web/app/cookies/page.tsx` | `apps/web/lib/legal-content.ts` |
| `/acceptable-use` | `apps/web/app/acceptable-use/page.tsx` | `apps/web/lib/legal-content.ts` |

## How it is put together

- `apps/web/lib/company.ts` holds the company details. Every value comes from
  an environment variable and falls back to an obvious placeholder.
- `apps/web/lib/legal-content.ts` holds the content. Each document has a
  title, a short version (3 to 5 bullets) and a list of sections with ids.
- `apps/web/components/legal/legal-page.tsx` renders the shared layout: hero
  band, short version card, table of contents, body, end card and the
  floating "Back to top" button.
- `apps/web/components/legal/legal-text.tsx` renders the text. Links use
  `[label](/url)`, email addresses are turned into mail links, and anything
  still unfinished is highlighted.
- `apps/web/components/legal/legal-toc.tsx` is the scroll spy. It is a small
  client component that watches the headings with an IntersectionObserver.
- `apps/web/components/legal/copy-section-link.tsx` copies the address of a
  section and shows the toast "Link copied.".

## Drafts and placeholders

While `LEGAL_REVIEW_PENDING` is `true` (the default):

- every legal page shows the banner "Draft. These pages must be reviewed by a
  qualified lawyer before launch.";
- every unresolved placeholder, such as `[Company legal name]`, is shown with
  a highlight;
- every `[[DECISION: ...]]` marker is shown with a highlight.

The markers are questions for the lawyer, for example:

```
[[DECISION: payment provider, billing cycle, refunds and cancellation terms]]
```

When a decision is made, replace the marker with the real wording. Once
nothing is left, set `LEGAL_REVIEW_PENDING=false`. The unit test in
`apps/web/tests/legal-content.test.ts` then fails if a placeholder or a
marker is still in the content, so a production build cannot ship a half
finished page.

## Environment variables

| Variable | Used for | Default |
| --- | --- | --- |
| `COMPANY_NAME` | Trading name | `Get-On` |
| `LEGAL_ENTITY` | Registered company name | `[Company legal name]` |
| `COMPANY_COUNTRY` | Country of registration | `[Country]` |
| `COMPANY_ADDRESS` | Registered address | `[Registered address]` |
| `PRIVACY_EMAIL` | Privacy questions and data requests | `team@get-on.tech` |
| `ABUSE_EMAIL` | Abuse reports | `team@get-on.tech` |
| `SUPPORT_EMAIL` | Support questions | `team@get-on.tech` |
| `LEGAL_EFFECTIVE_DATE` | Date shown as "Last updated" | today, at build time |
| `LEGAL_REVIEW_PENDING` | Shows the draft banner and highlights | `true` |

## Cookie consent

Get-On only uses essential cookies, so there is no consent banner yet. The
stub lives in `apps/web/components/legal/cookie-consent.tsx` and is switched
off with `NEXT_PUBLIC_COOKIE_CONSENT=false`.

When analytics, or any other non-essential cookie, is added:

1. set `NEXT_PUBLIC_COOKIE_CONSENT=true`;
2. finish the banner so it stores the choice and blocks non-essential
   scripts until the visitor agrees;
3. add the new cookies to the table in the Cookie Policy, with the real
   duration from the code;
4. mention the change in the Cookie Policy and the Privacy Policy.

## Print styles

The print stylesheet lives at the end of `apps/web/app/globals.css`. It
hides the header, the footer, the table of contents and the floating
buttons, prints in black on white at 12 pt, shows the address after links,
and keeps headings and list items on one page.

## Before launch

1. Have a qualified lawyer read all four pages.
2. Fill in the company constants and remove every placeholder.
3. Answer every `[[DECISION: ...]]` marker.
4. Set `LEGAL_EVIEW_PENDING=false` and run `pnpm test` and `pnpm build`.
