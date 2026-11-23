export type EmailStream = "transactional" | "billing" | "marketing";
export type EmailTransport = "resend" | "ses" | "smtp" | "console" | "memory";

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
  kind: string;
  stream?: EmailStream;
  relatedType?: string;
  relatedId?: string;
};

export type EmailSendResult = {
  id: string;
};

export interface EmailSender {
  send(message: EmailMessage): Promise<EmailSendResult>;
}

export const EMAIL_STREAMS: Record<
  EmailStream,
  {
    from: string;
    resendFrom: string;
    replyTo: string;
    configurationSet: string;
  }
> = {
  transactional: {
    from: "no-reply@contact.get-on.tech",
    resendFrom: "no-reply@mail.get-on.tech",
    replyTo: "team@get-on.tech",
    configurationSet: "gs-transactional",
  },
  billing: {
    from: "billing@contact.get-on.tech",
    resendFrom: "billing@mail.get-on.tech",
    replyTo: "team@get-on.tech",
    configurationSet: "gs-billing",
  },
  marketing: {
    from: "no-reply@contact.get-on.tech",
    resendFrom: "no-reply@mail.get-on.tech",
    replyTo: "team@get-on.tech",
    configurationSet: "gs-marketing",
  },
};

export type EmailCatalogueEntry = {
  kind: string;
  stream: EmailStream;
  requiresMarketingConsent?: boolean;
};

const KINDS: EmailCatalogueEntry[] = [
  { kind: "contact_notification", stream: "transactional" },
  { kind: "contact_digest", stream: "transactional" },
  { kind: "recipient_verification", stream: "transactional" },
  { kind: "contact_autoreply", stream: "transactional" },
  { kind: "demo_request_alert", stream: "transactional" },
  { kind: "demo_request_ack", stream: "transactional" },
  { kind: "abuse_report_alert", stream: "transactional" },
  { kind: "admin_alert", stream: "transactional" },
  { kind: "team_invite", stream: "transactional" },
  { kind: "team_invite_reminder", stream: "transactional" },
  { kind: "member_removed", stream: "transactional" },
  { kind: "member_role_changed", stream: "transactional" },
  { kind: "team_ownership_transferred", stream: "transactional" },
  { kind: "seats_paused", stream: "transactional" },
  { kind: "invite_accepted", stream: "transactional" },
  { kind: "invite_declined", stream: "transactional" },
  { kind: "referral_reward", stream: "transactional" },
  { kind: "website_transfer", stream: "transactional" },
  { kind: "website_suspended", stream: "transactional" },
  { kind: "account_welcome", stream: "transactional" },
  { kind: "approval_requested", stream: "transactional" },
  { kind: "approval_decided", stream: "transactional" },
  { kind: "approval_expired", stream: "transactional" },
  { kind: "auth", stream: "transactional" },
  { kind: "billing_receipt", stream: "billing" },
  { kind: "billing_payment_failed", stream: "billing" },
  { kind: "billing_renewal_reminder", stream: "billing" },
  { kind: "billing_grace_started", stream: "billing" },
  { kind: "billing_lapsed", stream: "billing" },
  { kind: "billing_debt_reminder", stream: "billing" },
  { kind: "billing_invoice_expired", stream: "billing" },
  { kind: "billing_refund", stream: "billing" },
  { kind: "billing_grant", stream: "billing" },
  { kind: "marketing_campaign", stream: "marketing", requiresMarketingConsent: true },
];

export const EMAIL_CATALOGUE: Record<string, EmailCatalogueEntry> = Object.fromEntries(
  KINDS.map((entry) => [entry.kind, entry]),
);

export function streamForKind(kind: string): EmailStream {
  const known = EMAIL_CATALOGUE[kind];
  if (known) return known.stream;
  if (kind.startsWith("billing_")) return "billing";
  if (kind.startsWith("marketing_") || kind.startsWith("campaign_")) return "marketing";
  return "transactional";
}

export function describeEmailKind(kind: string): EmailCatalogueEntry {
  const known = EMAIL_CATALOGUE[kind];
  if (known) return known;
  const stream = streamForKind(kind);
  return {
    kind,
    stream,
    ...(stream === "marketing" ? { requiresMarketingConsent: true } : {}),
  };
}

export function emailKindUsesConsent(kind: string): boolean {
  return Boolean(describeEmailKind(kind).requiresMarketingConsent);
}

let cachedTransport: EmailTransport | null | undefined;

export function resetTransportCache(): void {
  cachedTransport = undefined;
}

export function readTransport(): EmailTransport | null {
  if (cachedTransport !== undefined) return cachedTransport;
  const raw = (process.env.EMAIL_PROVIDER ?? process.env.EMAIL_TRANSPORT ?? "")
    .trim()
    .toLowerCase();
  if (raw === "resend" || raw === "ses" || raw === "smtp" || raw === "console" || raw === "memory") {
    cachedTransport = raw;
    return raw;
  }
  cachedTransport = null;
  return null;
}

export function transportForMessage(
  message: Pick<EmailMessage, "kind" | "stream">,
  override?: EmailTransport | null,
): EmailTransport {
  if (override) return override;
  const configured = readTransport();
  if (configured) return configured;
  const stream = message.stream ?? streamForKind(message.kind);
  return stream === "marketing" ? "ses" : "resend";
}

export class ResendSender implements EmailSender {
  private readonly baseUrl: string;
  private readonly apiKey?: string;

  constructor(options: { baseUrl?: string; apiKey?: string } = {}) {
    this.baseUrl = (options.baseUrl ?? "https://api.resend.com").replace(/\/$/, "");
    this.apiKey = options.apiKey;
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const apiKey = this.apiKey ?? process.env.RESEND_API_KEY ?? "";
    const stream = message.stream ?? streamForKind(message.kind);
    const streamConfig = EMAIL_STREAMS[stream];

    const response = await fetch(`${this.baseUrl}/emails`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: streamConfig.resendFrom,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
        reply_to: message.replyTo ?? streamConfig.replyTo,
        tags: [
          { name: "kind", value: message.kind },
          { name: "stream", value: stream },
        ],
      }),
    });

    if (response.status === 429) {
      const err = new Error("Too many requests") as Error & {
        name: string;
        statusCode: number;
      };
      err.name = "TooManyRequestsException";
      err.statusCode = 429;
      throw err;
    }

    if (!response.ok) {
      const err = new Error(`Resend HTTP ${response.status}`) as Error & {
        name: string;
        statusCode: number;
      };
      err.name = response.status >= 500 ? "ResendServerError" : "ResendError";
      err.statusCode = response.status;
      throw err;
    }

    const payload = (await response.json()) as { id?: string };
    return { id: String(payload.id ?? `resend_${Date.now()}`) };
  }
}

export const memorySender: EmailSender & { messages: EmailMessage[] } = {
  messages: [],
  async send(message: EmailMessage): Promise<EmailSendResult> {
    this.messages.push(message);
    return { id: `mem_${this.messages.length}` };
  },
};

export function getSender(
  message: Pick<EmailMessage, "kind" | "stream">,
  override?: EmailTransport | null,
): EmailSender {
  const transport = transportForMessage(message, override);
  if (transport === "resend" && process.env.RESEND_API_KEY) {
    return new ResendSender();
  }
  if (transport === "memory" || !process.env.RESEND_API_KEY) {
    return memorySender;
  }
  return {
    async send(msg: EmailMessage): Promise<EmailSendResult> {
      if (transport === "console") {
        console.info("[email]", msg.kind, msg.to, msg.subject);
      }
      memorySender.messages.push(msg);
      return { id: `${transport}_${Date.now()}` };
    },
  };
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function safeHeader(value: string, maxLength = 180): string {
  return value.replace(/[\r\n]+/g, " ").trim().slice(0, maxLength);
}

function safeUrl(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  if (/^(https?:|mailto:|\/)/i.test(trimmed)) return trimmed;
  return null;
}

export function button(url: string, label: string): string {
  const cleanUrl = safeUrl(url);
  if (!cleanUrl) return "";
  return `<p style="margin:24px 0;"><a href="${escapeHtml(cleanUrl)}" style="display:inline-block;background:#0B6B4F;color:#FFFFFF;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:8px;">${escapeHtml(label)}</a></p>`;
}

export function emailLayout(input: {
  title: string;
  preheader?: string;
  body: string;
  footer?: string;
  reason?: string;
}): string {
  const appUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://get-on.tech").replace(/\/$/, "");
  const footerHtml = input.footer
    ? `<div style="margin-top:24px;padding-top:16px;border-top:1px solid #E8DFD0;color:#6D635B;font-size:12px;line-height:18px;">${input.footer}</div>`
    : input.reason
      ? `<p style="margin-top:24px;padding-top:16px;border-top:1px solid #E8DFD0;color:#6D635B;font-size:12px;line-height:18px;">${escapeHtml(input.reason)}</p>`
      : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(input.title)}</title>
</head>
<body style="margin:0;padding:24px 12px;background:#F4F1EA;color:#1F1A17;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(input.preheader ?? "")}</span>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#FFFFFF;border:1px solid #E8DFD0;border-radius:12px;padding:32px;">
<tr><td>
<div style="margin-bottom:20px;">
<img src="${escapeHtml(appUrl)}/brand/logo.png" alt="Get-On" height="28" style="display:block;border:0;height:28px;" />
</div>
<h1 style="margin:0 0 16px;font-size:20px;line-height:28px;color:#1F1A17;">${escapeHtml(input.title)}</h1>
<div style="font-size:15px;line-height:24px;color:#1F1A17;">${input.body}</div>
${footerHtml}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

const BANNED_WORDS = [
  "leverage",
  "seamless",
  "seamlessly",
  "synergy",
  "disrupt",
  "revolutionary",
  "game-changing",
  "unleash",
  "unlock",
  "supercharge",
];

export function findBannedWords(text: string): string[] {
  const lower = text.toLowerCase();
  return BANNED_WORDS.filter((word) => new RegExp(`\\b${word}\\b`, "i").test(lower));
}

function countSyllables(word: string): number {
  const cleaned = word.toLowerCase().replace(/[^a-z]/g, "");
  if (cleaned.length <= 3) return 1;
  const groups = cleaned.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups?.length ?? 1);
}

export function gradeLevel(text: string): number {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 0;
  const sentenceCount = Math.max(1, sentences.length);
  const syllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
  const score = 0.39 * (words.length / sentenceCount) + 11.8 * (syllables / words.length) - 15.59;
  return Math.max(0, Math.round(score * 10) / 10);
}

export function lintEmailCopy(input: {
  subject: string;
  preheader?: string;
  body: string;
}): Array<{ code: string; message: string }> {
  const issues: Array<{ code: string; message: string }> = [];
  if (input.subject.length > 60) {
    issues.push({ code: "SUBJECT_TOO_LONG", message: "Keep the subject at 60 characters or fewer." });
  }
  const combined = `${input.subject} ${input.preheader ?? ""} ${input.body}`;
  if (/\{\{[^}]+\}\}/.test(combined)) {
    issues.push({ code: "PLACEHOLDER", message: "Remove unreplaced template placeholders." });
  }
  const sentences = input.body.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
  if (sentences.some((s) => s.split(/\s+/).filter(Boolean).length > 22)) {
    issues.push({ code: "SENTENCE_TOO_LONG", message: "Shorten long sentences to 22 words or fewer." });
  }
  const banned = findBannedWords(combined);
  if (banned.length > 0) {
    issues.push({ code: "BANNED_WORD", message: `Avoid hype words: ${banned.join(", ")}` });
  }
  return issues;
}

export type CampaignBlock =
  | { type: "paragraph"; text: string }
  | { type: "button"; label: string; url: string };

export type MarketingContent = {
  heading: string;
  intro?: string;
  blocks: CampaignBlock[];
};

export function marketingCampaignEmail(input: {
  subject: string;
  preheader: string;
  content: MarketingContent;
  unsubscribeUrl: string;
  physicalAddress?: string | null;
}) {
  const bodyParts: string[] = [];
  const textParts: string[] = [input.content.heading];
  if (input.content.intro) {
    bodyParts.push(`<p>${escapeHtml(input.content.intro)}</p>`);
    textParts.push(input.content.intro);
  }
  for (const block of input.content.blocks) {
    if (block.type === "paragraph") {
      bodyParts.push(`<p>${escapeHtml(block.text)}</p>`);
      textParts.push(block.text);
    } else if (block.type === "button") {
      const btn = button(block.url, block.label);
      if (btn) {
        bodyParts.push(btn);
        textParts.push(`${block.label}: ${block.url}`);
      }
    }
  }
  const unsub = safeUrl(input.unsubscribeUrl) ?? "#";
  const address = input.physicalAddress ?? "";
  const addressHtml = address ? `<p style="margin:0 0 8px;">${escapeHtml(address)}</p>` : "";
  const footer = `${addressHtml}<p style="margin:0;"><a href="${escapeHtml(unsub)}" style="color:#0B6B4F;">Turn off marketing email</a></p>`;
  textParts.push(`---\n${address ? `${address}\n` : ""}Turn off marketing email: ${unsub}`);

  return {
    subject: safeHeader(input.subject),
    html: emailLayout({
      title: input.content.heading,
      preheader: input.preheader,
      body: bodyParts.join("\n"),
      footer,
    }),
    text: textParts.join("\n\n"),
  };
}

export function teamNoticeEmail(input: {
  title: string;
  preheader?: string;
  intro?: string;
  body?: string;
  details?: Array<{ label: string; value: string }>;
  ctaUrl?: string;
  ctaLabel?: string;
  actionUrl?: string;
  actionLabel?: string;
  footer?: string;
}) {
  const ctaHref = input.ctaUrl ?? input.actionUrl;
  const ctaText = input.ctaLabel ?? input.actionLabel;
  const cta = ctaHref && ctaText ? button(ctaHref, ctaText) : "";
  const introHtml = input.intro ? `<p>${escapeHtml(input.intro)}</p>` : "";
  const bodyHtml = input.body ? `<p>${escapeHtml(input.body)}</p>` : "";
  const detailsHtml =
    input.details && input.details.length > 0
      ? `<dl style="margin:16px 0;padding:12px 16px;background:#F9F6F0;border-radius:8px;">${input.details
          .map(
            (d) =>
              `<div style="margin:4px 0;"><strong style="color:#1F1A17;">${escapeHtml(d.label)}:</strong> <span>${escapeHtml(d.value)}</span></div>`,
          )
          .join("")}</dl>`
      : "";
  const introText = input.intro ? `${input.intro}\n\n` : "";
  const bodyText = input.body ? `${input.body}` : "";
  const detailsText =
    input.details && input.details.length > 0
      ? `\n\n${input.details.map((d) => `${d.label}: ${d.value}`).join("\n")}`
      : "";
  return {
    subject: safeHeader(input.title),
    html: emailLayout({
      title: input.title,
      preheader: input.preheader ?? input.intro ?? input.title,
      body: `${introHtml}${bodyHtml}${detailsHtml}${cta}`,
      reason: input.footer,
    }),
    text: `${input.title}\n\n${introText}${bodyText}${detailsText}${ctaHref ? `\n\n${ctaHref}` : ""}`,
  };
}

export function teamInviteEmail(input: {
  teamName: string;
  inviterName?: string;
  role: string;
  acceptUrl: string;
  message?: string | null;
  expiresAt?: string;
  abilities?: string[];
}) {
  const intro = `${input.inviterName ? `${input.inviterName} invited` : "You were invited"} to join ${input.teamName} as ${input.role}.`;
  const noteHtml = input.message ? `<p>${escapeHtml(input.message)}</p>` : "";
  const noteText = input.message ? `\n\n${input.message}` : "";
  const abilitiesHtml =
    input.abilities && input.abilities.length > 0
      ? `<ul style="margin:12px 0;padding-left:20px;">${input.abilities.map((a) => `<li>${escapeHtml(a)}</li>`).join("")}</ul>`
      : "";
  const expiryHtml = input.expiresAt ? `<p style="color:#6D635B;font-size:13px;">Expires ${escapeHtml(input.expiresAt)}.</p>` : "";
  return {
    subject: safeHeader(`Join ${input.teamName} on Get-On`),
    html: emailLayout({
      title: `Join ${input.teamName}`,
      preheader: intro,
      body: `<p>${escapeHtml(intro)}</p>${noteHtml}${abilitiesHtml}${button(input.acceptUrl, "Accept invitation")}${expiryHtml}`,
    }),
    text: `${intro}${noteText}\n\nAccept invitation: ${input.acceptUrl}${input.expiresAt ? `\n\nExpires ${input.expiresAt}.` : ""}`,
  };
}

export function recipientVerificationEmail(input: {
  siteName?: string;
  site?: string;
  ownerName?: string;
  verifyUrl?: string;
  confirmUrl?: string;
}) {
  const site = input.siteName || input.site || "your website";
  const url = input.verifyUrl ?? input.confirmUrl ?? "";
  const body = `Confirm your email address to receive contact form messages from ${site}.`;
  return {
    subject: safeHeader(`Confirm messages from ${site}`),
    html: emailLayout({
      title: "Confirm your email address",
      preheader: body,
      body: `<p>${escapeHtml(body)}</p>${button(url, "Confirm email address")}`,
    }),
    text: `${body}\n\nConfirm: ${url}`,
  };
}

export function contactAutoreplyEmail(input: {
  visitorName: string;
  businessName: string;
  subject: string;
  body: string;
}) {
  const greeting = input.visitorName ? `Hi ${input.visitorName},` : "Hello,";
  return {
    subject: safeHeader(input.subject || `Thanks for contacting ${input.businessName}`),
    html: emailLayout({
      title: input.businessName,
      preheader: input.body.slice(0, 120),
      body: `<p>${escapeHtml(greeting)}</p><p>${escapeHtml(input.body)}</p>`,
    }),
    text: `${greeting}\n\n${input.body}\n\n— ${input.businessName}`,
  };
}

export function contactDigestEmail(input: {
  count: number;
  site: string;
  messagesUrl: string;
}) {
  const title = `${input.count} new messages on ${input.site}`;
  return {
    subject: safeHeader(title),
    html: emailLayout({
      title,
      preheader: `You have ${input.count} waiting messages.`,
      body: `<p>${escapeHtml(input.site)} received ${input.count} new contact form messages.</p>${button(input.messagesUrl, "Open messages")}`,
    }),
    text: `${title}\n\nOpen messages: ${input.messagesUrl}`,
  };
}

export function contactNotificationEmail(input: {
  site: string;
  pagePath: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  messagesUrl: string;
}) {
  const title = `New message on ${input.site}`;
  const phoneLine = input.phone ? `<p><strong>Phone:</strong> ${escapeHtml(input.phone)}</p>` : "";
  return {
    subject: safeHeader(`${title} from ${input.name || input.email}`),
    html: emailLayout({
      title,
      preheader: input.message.slice(0, 120),
      body: `<p><strong>From:</strong> ${escapeHtml(input.name)} (${escapeHtml(input.email)})</p>${phoneLine}<p><strong>Page:</strong> ${escapeHtml(input.pagePath || "/")}</p><p>${escapeHtml(input.message)}</p>${button(input.messagesUrl, "Reply in Get-On")}`,
    }),
    text: `${title}\nFrom: ${input.name} (${input.email})${input.phone ? `\nPhone: ${input.phone}` : ""}\nPage: ${input.pagePath || "/"}\n\n${input.message}\n\nMessages: ${input.messagesUrl}`,
  };
}

function renderFieldRowsHtml(
  fields?: Array<{ label: string; value: string }> | Record<string, unknown>,
): { html: string; text: string } {
  if (!fields) return { html: "", text: "" };
  const items = Array.isArray(fields)
    ? fields
    : Object.entries(fields).map(([label, value]) => ({ label, value: String(value ?? "") }));
  if (items.length === 0) return { html: "", text: "" };
  return {
    html: `<dl style="margin:16px 0;padding:12px 16px;background:#F9F6F0;border-radius:8px;">${items
      .map(
        (item) =>
          `<div style="margin:4px 0;"><strong>${escapeHtml(item.label)}:</strong> ${escapeHtml(item.value)}</div>`,
      )
      .join("")}</dl>`,
    text: items.map((item) => `${item.label}: ${item.value}`).join("\n"),
  };
}

export function abuseReportAlertEmail(input: {
  site: string;
  reason: string;
  details?: string;
  adminUrl?: string;
  fields?: Array<{ label: string; value: string }> | Record<string, unknown>;
}) {
  const title = `Abuse report for ${input.site}`;
  const renderedFields = renderFieldRowsHtml(input.fields);
  const cta = input.adminUrl ? button(input.adminUrl, "Review report") : "";
  return {
    subject: safeHeader(title),
    html: emailLayout({
      title,
      preheader: input.reason,
      body: `<p><strong>Reason:</strong> ${escapeHtml(input.reason)}</p>${input.details ? `<p>${escapeHtml(input.details)}</p>` : ""}${renderedFields.html}${cta}`,
    }),
    text: `${title}\nReason: ${input.reason}${input.details ? `\n\n${input.details}` : ""}${renderedFields.text ? `\n\n${renderedFields.text}` : ""}${input.adminUrl ? `\n\n${input.adminUrl}` : ""}`,
  };
}

export function demoRequestAckEmail(input: { name?: string; firstName?: string; email?: string }) {
  const displayName = input.firstName || input.name || "";
  const title = "We received your demo request";
  const body = `Thanks ${displayName || "for reaching out"}. Someone from our team will follow up shortly.`;
  return {
    subject: safeHeader(title),
    html: emailLayout({ title, preheader: body, body: `<p>${escapeHtml(body)}</p>` }),
    text: `${title}\n\n${body}`,
  };
}

export function demoRequestAlertEmail(input: {
  name?: string;
  email?: string;
  business?: string;
  businessName?: string;
  notes?: string;
  fields?: Array<{ label: string; value: string }>;
}) {
  const biz = input.business || input.businessName || input.name || "Website";
  const title = `Demo request: ${biz}`;
  const renderedFields = renderFieldRowsHtml(input.fields);
  const basicHtml = [
    input.name ? `<p><strong>Name:</strong> ${escapeHtml(input.name)}</p>` : "",
    input.email ? `<p><strong>Email:</strong> ${escapeHtml(input.email)}</p>` : "",
    `<p><strong>Business:</strong> ${escapeHtml(biz)}</p>`,
    input.notes ? `<p>${escapeHtml(input.notes)}</p>` : "",
  ]
    .filter(Boolean)
    .join("");
  return {
    subject: safeHeader(title),
    html: emailLayout({
      title,
      preheader: input.email ? `${input.name ?? biz} (${input.email}) requested a demo.` : `${biz} requested a demo.`,
      body: `${basicHtml}${renderedFields.html}`,
    }),
    text: `${title}${input.name ? `\nName: ${input.name}` : ""}${input.email ? `\nEmail: ${input.email}` : ""}\nBusiness: ${biz}${input.notes ? `\n\n${input.notes}` : ""}${renderedFields.text ? `\n\n${renderedFields.text}` : ""}`,
  };
}

export function adminAlertEmail(input: {
  title: string;
  summary?: string;
  message?: string;
  actionUrl?: string;
}) {
  const bodyText = input.summary ?? input.message ?? "";
  const cta = input.actionUrl ? button(input.actionUrl, "Open Admin") : "";
  return {
    subject: safeHeader(input.title),
    html: emailLayout({
      title: input.title,
      preheader: bodyText.slice(0, 120),
      body: `<p>${escapeHtml(bodyText)}</p>${cta}`,
    }),
    text: `${input.title}\n\n${bodyText}${input.actionUrl ? `\n\n${input.actionUrl}` : ""}`,
  };
}
