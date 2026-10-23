import { emailLayout, button } from './layout';

export function contactNotificationEmail(opts: {
  site: string;
  pagePath: string;
  name: string;
  email: string;
  phone?: string | null;
  message: string;
  messagesUrl: string;
}) {
  const displayName = opts.name.trim() || 'Someone';
  const safeName = sanitizeLine(opts.name.trim()).slice(0, 40);
  const safeSite = sanitizeLine(opts.site).slice(0, 80);
  const subject = safeName ? `New message from ${safeName} on ${safeSite}` : `New message on ${safeSite}`;
  const body = `
    <p style="margin:0 0 16px 0;">${escapeHtml(displayName)} wrote to you from ${escapeHtml(opts.site)}${opts.pagePath ? escapeHtml(opts.pagePath) : ''}.</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F6F0E6;border-radius:12px;margin:16px 0;">
      <tr><td style="padding:16px;">
        <div><strong>Name:</strong> ${escapeHtml(opts.name || '(none)')}</div>
        <div><strong>Email:</strong> ${escapeHtml(opts.email)}</div>
        ${opts.phone ? `<div><strong>Phone:</strong> ${escapeHtml(opts.phone)}</div>` : ''}
        <div style="margin-top:12px;"><strong>Message:</strong></div>
        <div style="white-space:pre-wrap;word-break:break-word;margin-top:8px;">${escapeHtml(opts.message)}</div>
      </td></tr>
    </table>
    <p style="margin:16px 0;">Reply to this email to answer ${escapeHtml(displayName)} directly.</p>
    ${button(opts.messagesUrl, 'Open in Get-On')}
    <p style="margin:24px 0 0 0;font-size:13px;color:#6B6158;">You get this email because the contact form is on for ${escapeHtml(opts.site)}. Change this in Plugins.</p>
  `;
  const html = emailLayout({ title: subject, body });
  const text = [
    `${displayName} wrote to you from ${opts.site}${opts.pagePath || ''}.`,
    '',
    `Name: ${opts.name || '(none)'}`,
    `Email: ${opts.email}`,
    opts.phone ? `Phone: ${opts.phone}` : null,
    '',
    opts.message,
    '',
    `Reply directly to ${opts.email}.`,
    `Open in Get-On: ${opts.messagesUrl}`,
  ].filter(Boolean).join('\n');
  return { subject, html, text };
}

export function contactAutoreplyEmail(opts: {
  visitorName: string;
  businessName: string;
  subject: string;
  body: string;
}) {
  const name = opts.visitorName || 'there';
  const subj = (opts.subject || 'We got your message')
    .replace(/\{name\}/gi, name)
    .replace(/\{business\}/gi, opts.businessName || 'us')
    .replace(/[\r\n]/g, ' ');
  const bodyText = (opts.body || `Hi {name}, thank you for contacting {business}. We have your message and will reply soon.`)
    .replace(/\{name\}/gi, name)
    .replace(/\{business\}/gi, opts.businessName || 'us');
  const body = `
    <p style="white-space:pre-wrap;word-break:break-word;margin:0;">${escapeHtml(bodyText).replace(/\n/g, '<br>')}</p>
    <hr style="border:none;border-top:1px solid #E8DFD0;margin:24px 0;">
    <p style="margin:0;font-size:13px;color:#6B6158;">You are receiving this because you sent a message through ${escapeHtml(opts.businessName || 'this website')}'s website. This is an automatic reply.</p>
  `;
  const html = emailLayout({ title: subj, body });
  const text = `${bodyText}\n\n---\nYou are receiving this because you sent a message through ${opts.businessName || 'this website'}'s website. This is an automatic reply.`;
  return { subject: subj, html, text };
}


export function contactDigestEmail(opts: {
  count: number;
  site: string;
  messagesUrl: string;
}) {
  const subject = `${opts.count} more new message${opts.count === 1 ? '' : 's'} on ${opts.site}`;
  const body = `
    <p style="margin:0 0 16px 0;">There are ${opts.count} more new message${opts.count === 1 ? '' : 's'} waiting for you on ${escapeHtml(opts.site)}.</p>
    ${button(opts.messagesUrl, 'Open messages')}
  `;
  const html = emailLayout({ title: subject, body });
  const text = `There are ${opts.count} more new message${opts.count === 1 ? '' : 's'} waiting for you on ${opts.site}.\n\nOpen messages: ${opts.messagesUrl}`;
  return { subject, html, text };
}

export function recipientVerificationEmail(opts: {
  site: string;
  ownerName: string;
  confirmUrl: string;
}) {
  const subject = `Confirm your email address for ${opts.site} messages`;
  const body = `
    <p style="margin:0 0 16px 0;">${escapeHtml(opts.ownerName)} asked to send contact messages from ${escapeHtml(opts.site)} to this address. If that is fine, confirm below. If you do not know them, ignore this email.</p>
    ${button(opts.confirmUrl, 'Yes, send me the messages')}
    <p style="margin:24px 0 0 0;font-size:13px;color:#6B6158;">This link works for 48 hours.</p>
  `;
  const html = emailLayout({ title: subject, body });
  const text = `${opts.ownerName} asked to send contact messages from ${opts.site} to this address.\n\nConfirm: ${opts.confirmUrl}\n\nThis link works for 48 hours. If you do not know them, ignore this email.`;
  return { subject, html, text };
}

export function demoRequestAlertEmail(opts: {
  businessName: string;
  fields: Array<{ label: string; value: string }>;
}) {
  const subject = `[Get-On Demo] ${sanitizeLine(opts.businessName).slice(0, 80)}`;
  const rows = opts.fields.map((row) => `${row.label}: ${row.value}`).join('\n');
  const table = opts.fields
    .map(
      (row) =>
        `<tr><td style="padding:6px 12px 6px 0;color:#6B6158;font-size:14px;vertical-align:top;">${escapeHtml(
          row.label,
        )}</td><td style="padding:6px 0;font-size:14px;">${escapeHtml(row.value)}</td></tr>`,
    )
    .join('');
  const body = `<p style="margin:0 0 16px 0;">A new demo request came in.</p><table style="border-collapse:collapse;">${table}</table>`;
  const html = emailLayout({ title: subject, body });
  return { subject, html, text: `A new demo request came in.\n\n${rows}` };
}

export function demoRequestAckEmail(opts: { firstName: string; email: string }) {
  const subject = 'We got your demo request';
  const body = `<p style="margin:0 0 16px 0;">Hi ${escapeHtml(opts.firstName)},</p><p style="margin:0;">Thanks for asking about Get-On. We will email you within 1 working day to agree a time that suits you. If anything changes, just reply to this email.</p><p style="margin:24px 0 0 0;">The Get-On team</p>`;
  const html = emailLayout({ title: subject, body });
  const text = `Hi ${opts.firstName},\n\nThanks for asking about Get-On. We will email you within 1 working day to agree a time that suits you.\n\nThe Get-On team`;
  return { subject, html, text };
}

export function abuseReportAlertEmail(opts: {
  site: string;
  reason: string;
  fields: Array<{ label: string; value: string }>;
}) {
  const subject = `[Get-On Report] ${sanitizeLine(opts.site).slice(0, 80)} (${sanitizeLine(opts.reason).slice(0, 40)})`;
  const rows = opts.fields.map((row) => `${row.label}: ${row.value}`).join('\n');
  const table = opts.fields
    .map(
      (row) =>
        `<tr><td style="padding:6px 12px 6px 0;color:#6B6158;font-size:14px;vertical-align:top;">${escapeHtml(
          row.label,
        )}</td><td style="padding:6px 0;font-size:14px;">${escapeHtml(row.value)}</td></tr>`,
    )
    .join('');
  const body = `<p style="margin:0 0 16px 0;">New abuse report for ${escapeHtml(opts.site)}.</p><table style="border-collapse:collapse;">${table}</table>`;
  const html = emailLayout({ title: subject, body });
  return { subject, html, text: `New abuse report for ${opts.site}.\n\n${rows}` };
}

export function adminAlertEmail(opts: { title: string; message: string }) {
  const subject = `[Get-On Alert] ${sanitizeLine(opts.title).slice(0, 100)}`;
  const body = `<p style="margin:0;white-space:pre-wrap;">${escapeHtml(opts.message)}</p>`;
  const html = emailLayout({ title: subject, body });
  return { subject, html, text: opts.message };
}

export function sanitizeLine(value: string | null | undefined): string {
  return String(value ?? '').replace(/[\r\n]+/g, ' ').replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
}

function escapeHtml(value: string) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
