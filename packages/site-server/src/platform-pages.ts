/**
 * The pages Get-On shows when a website cannot be served: the address is
 * unknown, the website is not live, or it has been suspended. They are plain
 * HTML with inline CSS and no JavaScript.
 */

const FONT_STACK = "Figtree, system-ui, -apple-system, 'Segoe UI', sans-serif";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function shell(options: {
  icon: string;
  title: string;
  text: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  const action =
    options.actionLabel && options.actionHref
      ? `<a class="button" href="${escapeHtml(options.actionHref)}">${escapeHtml(options.actionLabel)}</a>`
      : "";
  return `<!doctype html>
<html lang="en" data-color-mode="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(options.title)} | Get-On</title>
<meta name="robots" content="noindex,nofollow">
<style>
*,*::before,*::after{box-sizing:border-box}
body{margin:0;background:#FFFBF5;color:#1F1A17;font-family:${FONT_STACK};font-size:16px;line-height:1.6;-webkit-text-size-adjust:100%}
.page{min-height:100dvh;display:flex;flex-direction:column;justify-content:center;align-items:center;max-width:480px;margin:0 auto;padding:24px;text-align:center}
.icon{width:80px;height:80px;border-radius:999px;background:#FDEFC9;display:flex;align-items:center;justify-content:center;color:#7A4A00}
.icon svg{width:40px;height:40px;display:block}
h1{font-size:28px;line-height:34px;font-weight:700;margin:24px 0 0}
p{font-size:17px;line-height:1.6;color:#6B6158;margin:12px 0 0}
a.button{display:inline-flex;align-items:center;justify-content:center;height:52px;padding:0 28px;border-radius:12px;background:#0B6B4F;color:#fff;font-size:16px;font-weight:600;text-decoration:none;margin-top:28px}
a.button:focus-visible{outline:3px solid #0B6B4F;outline-offset:2px}
.footer{margin-top:40px;font-size:14px;color:#6B6158}
.footer a{color:#6B6158}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
</style>
</head>
<body>
<div class="page">
<div class="icon" aria-hidden="true">${options.icon}</div>
<h1>${escapeHtml(options.title)}</h1>
<p>${escapeHtml(options.text)}</p>
${action}
<p class="footer">Made with <a href="https://get-on.tech">Get-On</a></p>
</div>
</body>
</html>
`;
}

const COMPASS_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>';

const SHIELD_ALERT_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>';

const CLOCK_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>';

const PLUG_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22v-5"/><path d="M9 8V2"/><path d="M15 8V2"/><path d="M18 8H6a2 2 0 0 0-2 2v3a8 8 0 0 0 16 0v-3a2 2 0 0 0-2-2Z"/></svg>';

const PAUSE_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>';

/** The address is unknown, reserved, or has never been published. */
export function notFoundPage(): string {
  return shell({
    icon: COMPASS_ICON,
    title: "We could not find this website",
    text: "The address may be misspelt, or the website has not been published yet.",
    actionLabel: "Go to Get-On",
    actionHref: "https://get-on.tech",
  });
}

/** The owner has paused a website while making changes. */
export function pausedPage(
  title?: string | null,
  text?: string | null,
): string {
  return shell({
    icon: CLOCK_ICON,
    title: title?.trim() || "We will be back soon",
    text:
      text?.trim() ||
      "This website is being updated. Please check again in a little while.",
  });
}

/** The website exists but the owner has not published it. */
export function notPublishedPage(): string {
  return shell({
    icon: COMPASS_ICON,
    title: "This website is not live yet",
    text: "The owner has not published it, or has taken it offline for now.",
    actionLabel: "Go to Get-On",
    actionHref: "https://get-on.tech",
  });
}

/** The owner has not connected this address to a website yet. */
export function domainNotConnectedPage(): string {
  return shell({
    icon: PLUG_ICON,
    title: "This domain is not connected to a website yet",
    text: "If you own this domain, log in to Get-On and choose a website for it.",
    actionLabel: "Go to Get-On",
    actionHref: "https://get-on.tech",
  });
}

/** The website behind this address is paused because its plan lapsed. */
export function domainPausedPage(): string {
  return shell({
    icon: PAUSE_ICON,
    title: "This website is taking a break",
    text: "The owner needs to renew their plan to bring it back.",
    actionLabel: "Go to Get-On",
    actionHref: "https://get-on.tech",
  });
}

/** The website has been taken offline by Get-On. */
export function suspendedPage(siteName?: string | null): string {
  const reportHref = siteName
    ? `https://get-on.tech/report?site=${encodeURIComponent(siteName)}`
    : "https://get-on.tech/report";
  return shell({
    icon: SHIELD_ALERT_ICON,
    title: "This website is not available",
    text: "It has been taken offline because it broke our rules or is being reviewed.",
    actionLabel: "Report a problem",
    actionHref: reportHref,
  });
}
