export type ContactAutoReply = {
  enabled: boolean;
  subject: string;
  body: string;
};

export type ContactSettings = {
  notifyOwner: boolean;
  thanksTitle: string;
  thanksText: string;
  autoReply: ContactAutoReply;
};

export const CONTACT_SETTINGS_DEFAULTS: ContactSettings = {
  notifyOwner: true,
  thanksTitle: "Thank you!",
  thanksText: "Your message has been sent. We will get back to you soon.",
  autoReply: {
    enabled: false,
    subject: "We got your message",
    body: "Hi {name}, thank you for contacting {business}. We have your message and will reply soon.",
  },
};

function boolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function text(value: unknown, fallback: string, max: number): string {
  if (typeof value !== "string") return fallback;
  return value.slice(0, max);
}

/** Merges the stored contact settings with the defaults. */
export function parseContactSettings(value: unknown): ContactSettings {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const auto =
    raw.autoReply && typeof raw.autoReply === "object"
      ? (raw.autoReply as Record<string, unknown>)
      : {};
  return {
    notifyOwner: boolean(raw.notifyOwner, CONTACT_SETTINGS_DEFAULTS.notifyOwner),
    thanksTitle: text(raw.thanksTitle, CONTACT_SETTINGS_DEFAULTS.thanksTitle, 60),
    thanksText: text(raw.thanksText, CONTACT_SETTINGS_DEFAULTS.thanksText, 300),
    autoReply: {
      enabled: boolean(auto.enabled, CONTACT_SETTINGS_DEFAULTS.autoReply.enabled),
      subject: text(auto.subject, CONTACT_SETTINGS_DEFAULTS.autoReply.subject, 160),
      body: text(auto.body, CONTACT_SETTINGS_DEFAULTS.autoReply.body, 500),
    },
  };
}

/** Validates contact settings coming from the dashboard form. */
export function contactSettingsSchema(value: unknown): ContactSettings {
  const parsed = parseContactSettings(value);
  return {
    ...parsed,
    thanksTitle: parsed.thanksTitle.trim() || CONTACT_SETTINGS_DEFAULTS.thanksTitle,
    thanksText: parsed.thanksText.trim() || CONTACT_SETTINGS_DEFAULTS.thanksText,
    autoReply: {
      ...parsed.autoReply,
      subject: parsed.autoReply.subject.trim() || CONTACT_SETTINGS_DEFAULTS.autoReply.subject,
      body: parsed.autoReply.body.trim() || CONTACT_SETTINGS_DEFAULTS.autoReply.body,
    },
  };
}
