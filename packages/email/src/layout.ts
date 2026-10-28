export const EMAIL_COLORS = {
  page: "#F4F1EA",
  card: "#FFFFFF",
  border: "#E8DFD0",
  title: "#1F1A17",
  muted: "#6B6158",
  button: "#0B6B4F",
  buttonText: "#FFFFFF",
} as const;

export const EMAIL_LOGO_URL =
  process.env.EMAIL_LOGO_URL || "https://get-on.tech/brand/logo.png";
export const EMAIL_LOGO_2X_URL =
  process.env.EMAIL_LOGO_2X_URL || "https://get-on.tech/brand/logo@3x.png";

export function emailLayout(opts: {
  title: string;
  preheader?: string;
  body: string;
  footer?: string;
  unsubscribeUrl?: string;
  reason?: string;
}) {
  const preheader = opts.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(opts.preheader)}</div>`
    : "";
  const footerNote = opts.reason
    ? `<br>${escapeHtml(opts.reason)}`
    : "<br>Questions? Write to team@get-on.tech.";
  const unsubscribe = opts.unsubscribeUrl
    ? `<br><a href="${escapeHtml(opts.unsubscribeUrl)}" style="color:${EMAIL_COLORS.muted};">Turn off marketing email</a>`
    : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(opts.title)}</title>
</head>
<body style="margin:0;padding:0;background:${EMAIL_COLORS.page};">
${preheader}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${EMAIL_COLORS.page};">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;">
        <tr>
          <td style="padding:0 0 24px 0;">
            <a href="https://get-on.tech" style="text-decoration:none;">
              <img src="${escapeHtml(EMAIL_LOGO_URL)}" srcset="${escapeHtml(EMAIL_LOGO_URL)} 2x, ${escapeHtml(EMAIL_LOGO_2X_URL)} 3x" width="160" height="40" alt="Get-On" style="display:block;width:160px;height:40px;border:0;">
            </a>
          </td>
        </tr>
        <tr>
          <td style="background:${EMAIL_COLORS.card};border:1px solid ${EMAIL_COLORS.border};border-radius:16px;padding:32px;font-family:Figtree,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:${EMAIL_COLORS.title};">
            ${opts.body}
          </td>
        </tr>
        <tr>
          <td style="padding:24px 0 0 0;text-align:center;font-family:Figtree,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:${EMAIL_COLORS.muted};">
            Sent by Get-On, get-on.tech.${footerNote}
            ${opts.footer ? `<br>${escapeHtml(opts.footer)}` : ""}
            ${unsubscribe}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

export function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function button(href: string, label: string) {
  return `<table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:24px;"><tr><td style="background:${EMAIL_COLORS.button};border-radius:12px;"><a href="${escapeHtml(href)}" style="display:inline-block;height:48px;line-height:48px;padding:0 24px;color:${EMAIL_COLORS.buttonText};text-decoration:none;font-weight:600;font-size:16px;">${escapeHtml(label)}</a></td></tr></table>`;
}
