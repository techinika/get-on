export type EmailStream = "transactional" | "billing" | "marketing";

export interface EmailStreamDefinition {
  from: string;
  fromName: string;
  replyTo: string;
  configurationSet: string;
  configurationSetEnv: string;
}

/**
 * The only sender identities platform email may use. A stream is chosen from
 * the message kind, never by a caller-supplied address.
 */
export const EMAIL_STREAMS: Record<EmailStream, EmailStreamDefinition> = {
  transactional: {
    from: "no-reply@contact.get-on.tech",
    fromName: "Get-On",
    replyTo: "team@get-on.tech",
    configurationSet: "gs-transactional",
    configurationSetEnv: "SES_CONFIGURATION_SET_TRANSACTIONAL",
  },
  billing: {
    from: "billing@contact.get-on.tech",
    fromName: "Get-On Billing",
    replyTo: "billing@contact.get-on.tech",
    configurationSet: "gs-billing",
    configurationSetEnv: "SES_CONFIGURATION_SET_BILLING",
  },
  marketing: {
    from: "no-reply@contact.get-on.tech",
    fromName: "Get-On",
    replyTo: "team@get-on.tech",
    configurationSet: "gs-marketing",
    configurationSetEnv: "SES_CONFIGURATION_SET_MARKETING",
  },
};

const BILLING_PREFIXES = ["billing_", "invoice_", "payment_", "refund_", "coupon_"];
const MARKETING_PREFIXES = ["marketing_", "campaign_", "newsletter_"];

export function streamForKind(kind: string): EmailStream {
  const value = String(kind || "").toLowerCase();
  if (MARKETING_PREFIXES.some((prefix) => value.startsWith(prefix))) return "marketing";
  if (BILLING_PREFIXES.some((prefix) => value.startsWith(prefix))) return "billing";
  return "transactional";
}

export function streamDefinition(kind: string): EmailStreamDefinition {
  return EMAIL_STREAMS[streamForKind(kind)];
}

export function configurationSetForKind(kind: string): string {
  const stream = streamDefinition(kind);
  return process.env[stream.configurationSetEnv] || stream.configurationSet;
}
