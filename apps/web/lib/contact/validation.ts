import { z } from "zod";

export const CONTACT_LIMITS = {
  name: 80,
  email: 254,
  phone: 30,
  message: 5000,
} as const;

export type ContactFormConfig = {
  id: string;
  pagePath: string;
  showName: boolean;
  showPhone: boolean;
  phoneRequired: boolean;
};

export type ContactSubmission = {
  name: string;
  email: string;
  phone: string | null;
  message: string;
  pagePath: string;
};

/** NFC, control characters removed and trimmed. */
export function cleanText(value: string): string {
  return value
    .normalize("NFC")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim();
}

export function normalizeSubmissionFields(
  values: Record<string, string>,
  config: Pick<ContactFormConfig, "showName" | "showPhone" | "phoneRequired">,
): { ok: true; value: ContactSubmission } | { ok: false } {
  const name = cleanText(values.name ?? "").slice(0, CONTACT_LIMITS.name);
  const email = cleanText(values.email ?? "").slice(0, CONTACT_LIMITS.email).toLowerCase();
  const phoneRaw = cleanText(values.phone ?? "").slice(0, CONTACT_LIMITS.phone);
  const message = cleanText(values.message ?? "").slice(0, CONTACT_LIMITS.message);

  const schema = z.object({
    name: config.showName ? z.string().min(1).max(CONTACT_LIMITS.name) : z.string().max(CONTACT_LIMITS.name),
    email: z.string().email().max(CONTACT_LIMITS.email),
    phone: config.showPhone
      ? config.phoneRequired
        ? z.string().min(1).max(CONTACT_LIMITS.phone)
        : z.string().max(CONTACT_LIMITS.phone)
      : z.string().max(CONTACT_LIMITS.phone),
    message: z.string().min(5).max(CONTACT_LIMITS.message),
  });

  const parsed = schema.safeParse({ name, email, phone: phoneRaw, message });
  if (!parsed.success) return { ok: false };

  return {
    ok: true,
    value: {
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone ? parsed.data.phone : null,
      message: parsed.data.message,
      pagePath: cleanText(values._b ?? "").slice(0, 200),
    },
  };
}
