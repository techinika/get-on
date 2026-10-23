import { parsePhoneNumberFromString } from "libphonenumber-js";

/** A `tel:` address with only the characters a phone app understands. */
export function telHref(phone: string | null | undefined): string | null {
  const clean = (phone ?? "").trim();
  if (!clean) return null;
  const digits = clean.replace(/[^\d+]/g, "");
  return digits ? `tel:${digits}` : null;
}

/** A mailto link with a safely encoded subject and body. */
export function mailtoHref(
  email: string | null | undefined,
  subject?: string,
  body?: string,
): string | null {
  const clean = (email ?? "").trim();
  if (!clean) return null;
  const params = new URLSearchParams();
  if (subject) params.set("subject", subject);
  if (body) params.set("body", body);
  const query = params.toString();
  return `mailto:${clean}${query ? `?${query}` : ""}`;
}

/**
 * A WhatsApp link, only when the number is a valid international number.
 * Returns null for local or ambiguous numbers so the button is not shown.
 */
export function whatsappHref(
  phone: string | null | undefined,
  text?: string,
): string | null {
  const clean = (phone ?? "").trim();
  if (!clean.startsWith("+")) return null;
  const parsed = parsePhoneNumberFromString(clean);
  if (!parsed?.isValid() || !parsed.number.startsWith("+")) return null;
  const digits = parsed.number.replace(/\D/g, "");
  const suffix = text ? `?text=${encodeURIComponent(text)}` : "";
  return `https://wa.me/${digits}${suffix}`;
}

/** A reply body that quotes the first 500 characters of the original. */
export function replyBody(message: string): string {
  const quote = message.slice(0, 500);
  return `\n\n---\n${quote}`;
}
