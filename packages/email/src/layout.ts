export const TEAM_EMAIL = process.env.TEAM_EMAIL || 'team@get-on.tech';
export const COMPANY_NAME = 'Get-On';

export function emailLayout(opts: { title: string; preheader?: string; body: string }) {
  const preheader = opts.preheader ? `<div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(opts.preheader)}</div>` : '';
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#F8F4EC;">
${preheader}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" style="max-width:560px;" cellspacing="0" cellpadding="0">
        <tr>
          <td style="padding:0 0 24px 0;">
            <table role="presentation" cellspacing="0" cellpadding="0"><tr>
              <td style="width:32px;height:32px;background:#0B6B4F;border-radius:8px;text-align:center;vertical-align:middle;color:#fff;font-weight:700;">↗</td>
              <td style="padding-left:10px;font-family:Figtree,Helvetica,Arial,sans-serif;font-size:18px;font-weight:700;color:#1F1A17;">Get-On</td>
            </tr></table>
          </td>
        </tr>
        <tr>
          <td style="background:#FFFFFF;border:1px solid #E8DFD0;border-radius:16px;padding:32px;font-family:Figtree,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:#1F1A17;">
            ${opts.body}
          </td>
        </tr>
        <tr>
          <td style="padding:24px 0 0 0;text-align:center;font-family:Figtree,Helvetica,Arial,sans-serif;font-size:12px;color:#6B6158;">
            Sent by Get-On, get-on.tech.<br>
            Questions? Write to team@get-on.tech.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function button(href: string, label: string) {
  return `<table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:24px;"><tr><td style="background:#0B6B4F;border-radius:12px;"><a href="${escapeHtml(href)}" style="display:inline-block;height:48px;line-height:48px;padding:0 24px;color:#fff;text-decoration:none;font-weight:600;font-size:16px;">${escapeHtml(label)}</a></td></tr></table>`;
}
