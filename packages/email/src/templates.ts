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

export function teamInviteEmail(opts: {
  inviterName: string;
  teamName: string;
  role: 'admin' | 'editor' | 'viewer';
  message?: string | null;
  acceptUrl: string;
  expiresAt: string;
  abilities: string[];
}) {
  const inviter = sanitizeLine(opts.inviterName).slice(0, 80) || 'A teammate';
  const team = sanitizeLine(opts.teamName).slice(0, 80) || 'a team';
  const role = opts.role === 'admin' ? 'Admin' : opts.role === 'editor' ? 'Editor' : 'Viewer';
  const article = role === 'Admin' ? 'an' : 'a';
  const subject = `${inviter} invited you to join ${team} on Get-On`;
  const abilities = opts.abilities.slice(0, 3).map((line) => `<li>${escapeHtml(line)}</li>`).join('');
  const note = opts.message
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F6F0E6;border-radius:12px;margin:16px 0;"><tr><td style="padding:12px 16px;font-style:italic;">${escapeHtml(opts.message)}</td></tr></table>`
    : '';
  const body = `
    <p style="margin:0 0 16px 0;">${escapeHtml(inviter)} invited you to join <strong>${escapeHtml(team)}</strong> as ${article} <strong>${role}</strong>.</p>
    ${note}
    <p style="margin:16px 0 8px 0;">As ${article} ${role} you can:</p>
    <ul style="margin:0 0 16px 20px;padding:0;">${abilities}</ul>
    ${button(opts.acceptUrl, 'Accept invitation')}
    <p style="margin:24px 0 0 0;font-size:13px;color:#6B6158;">This invitation ends on ${escapeHtml(opts.expiresAt)}. If you do not know ${escapeHtml(inviter)}, you can ignore this email.</p>
  `;
  const html = emailLayout({ title: subject, body });
  const text = [
    `${inviter} invited you to join ${team} as ${article} ${role}.`,
    opts.message ? `\n"${opts.message}"` : '',
    '',
    `As ${article} ${role} you can:`,
    ...opts.abilities.slice(0, 3).map((line) => `- ${line}`),
    '',
    `Accept invitation: ${opts.acceptUrl}`,
    '',
    `This invitation ends on ${opts.expiresAt}. If you do not know ${inviter}, you can ignore this email.`,
  ].filter(Boolean).join('\n');
  return { subject, html, text };
}

export function teamNoticeEmail(opts: {
  title: string;
  intro: string;
  details?: Array<{ label: string; value: string }>;
  actionUrl?: string;
  actionLabel?: string;
  footer?: string;
}) {
  const title = sanitizeLine(opts.title).slice(0, 120) || 'Team update';
  const intro = sanitizeLine(opts.intro).slice(0, 500);
  const details = (opts.details ?? []).slice(0, 8);
  const rows = details
    .map(
      (row) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#6B6158;font-size:14px;vertical-align:top;">${escapeHtml(row.label)}</td><td style="padding:4px 0;font-size:14px;">${escapeHtml(row.value)}</td></tr>`,
    )
    .join('');
  const body = `
    <p style="margin:0 0 16px 0;">${escapeHtml(intro)}</p>
    ${rows ? `<table style="border-collapse:collapse;margin:8px 0 16px 0;">${rows}</table>` : ''}
    ${opts.actionUrl ? button(opts.actionUrl, opts.actionLabel ?? 'Open Get-On') : ''}
    ${opts.footer ? `<p style="margin:24px 0 0 0;font-size:13px;color:#6B6158;">${escapeHtml(opts.footer)}</p>` : ''}
  `;
  const html = emailLayout({ title, body });
  const text = [
    intro,
    '',
    ...details.map((row) => `${row.label}: ${row.value}`),
    opts.actionUrl ? `\n${opts.actionLabel ?? 'Open Get-On'}: ${opts.actionUrl}` : '',
    opts.footer ? `\n${opts.footer}` : '',
  ].filter(Boolean).join('\n');
  return { subject: title, html, text };
}

export interface MarketingBlock {
  type: 'heading' | 'paragraph' | 'bullet' | 'button' | 'quote' | 'divider';
  text?: string;
  label?: string;
  url?: string;
}

export interface MarketingContent {
  heading?: string;
  intro?: string;
  blocks?: MarketingBlock[];
  footer?: string;
}

function safeMarketingUrl(value: string | undefined): string | null {
  const raw = sanitizeLine(value).slice(0, 500);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

function marketingBlock(block: MarketingBlock): { html: string; text: string } | null {
  const text = sanitizeLine(block.text).slice(0, 2000);
  if (block.type === 'divider') {
    return { html: '<hr style="border:0;border-top:1px solid #E8DFD0;margin:24px 0;">', text: '' };
  }
  if (block.type === 'button') {
    const url = safeMarketingUrl(block.url);
    if (!url) return null;
    const label = sanitizeLine(block.label || block.text).slice(0, 60) || 'Open Get-On';
    return { html: button(url, label), text: `${label}: ${url}` };
  }
  if (!text) return null;
  if (block.type === 'heading') {
    return {
      html: `<h2 style="margin:24px 0 8px 0;font-size:20px;line-height:1.3;color:#1F1A17;">${escapeHtml(text)}</h2>`,
      text,
    };
  }
  if (block.type === 'quote') {
    return {
      html: `<blockquote style="margin:16px 0;padding:12px 16px;background:#F6F0E6;border-left:3px solid #0B6B4F;color:#1F1A17;">${escapeHtml(text)}</blockquote>`,
      text: `"${text}"`,
    };
  }
  if (block.type === 'bullet') {
    return { html: `<ul style="margin:0 0 16px 20px;padding:0;"><li>${escapeHtml(text)}</li></ul>`, text: `- ${text}` };
  }
  return { html: `<p style="margin:0 0 16px 0;">${escapeHtml(text)}</p>`, text };
}

/**
 * Marketing campaigns use plain content blocks, never raw HTML. Every link is
 * checked and every value is escaped before it reaches the layout.
 */
export function marketingCampaignEmail(opts: {
  subject: string;
  preheader?: string | null;
  content?: MarketingContent | null;
  unsubscribeUrl: string;
  physicalAddress?: string | null;
  reason?: string | null;
}) {
  const subject = sanitizeLine(opts.subject).slice(0, 60) || 'Get-On update';
  const preheader = sanitizeLine(opts.preheader).slice(0, 110) || undefined;
  const content = opts.content ?? {};
  const heading = sanitizeLine(content.heading).slice(0, 120);
  const intro = sanitizeLine(content.intro).slice(0, 600);
  const blocks = (content.blocks ?? []).slice(0, 40).map(marketingBlock).filter(Boolean) as Array<{
    html: string;
    text: string;
  }>;
  const footer = sanitizeLine(content.footer).slice(0, 300);
  const address = sanitizeLine(opts.physicalAddress).slice(0, 200);
  const body = [
    heading ? `<h1 style="margin:0 0 16px 0;font-size:24px;line-height:1.3;color:#1F1A17;">${escapeHtml(heading)}</h1>` : '',
    intro ? `<p style="margin:0 0 16px 0;">${escapeHtml(intro)}</p>` : '',
    ...blocks.map((block) => block.html),
    footer ? `<p style="margin:24px 0 0 0;font-size:13px;color:#6B6158;">${escapeHtml(footer)}</p>` : '',
  ]
    .filter(Boolean)
    .join('\n');
  const html = emailLayout({
    title: subject,
    preheader,
    body: body || `<p style="margin:0 0 16px 0;">${escapeHtml(subject)}</p>`,
    footer: address || undefined,
    reason:
      sanitizeLine(opts.reason).slice(0, 200) ||
      'You are getting this because you opted in to Get-On updates.',
    unsubscribeUrl: opts.unsubscribeUrl,
  });
  const text = [
    heading,
    intro,
    '',
    ...blocks.map((block) => block.text).filter(Boolean),
    footer,
    '',
    'Turn off marketing email: ' + opts.unsubscribeUrl,
    address,
  ]
    .filter((line) => line !== undefined && line !== null && line !== '')
    .join('\n');
  return { subject, html, text };
}
