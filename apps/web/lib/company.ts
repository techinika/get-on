import env from "@/lib/env";

/**
 * Company details used on the legal pages. Every value can be set with an
 * environment variable. The defaults are obvious placeholders so a missing
 * value is easy to spot before launch.
 */
export const company = {
  /** Trading name, for example "Get-On". */
  name: process.env.COMPANY_NAME ?? "Get-On",
  /** Full registered name of the company. */
  legalEntity: process.env.LEGAL_ENTITY ?? "[Company legal name]",
  /** Country where the company is registered. */
  country: process.env.COMPANY_COUNTRY ?? "[Country]",
  /** Registered address of the company. */
  address: process.env.COMPANY_ADDRESS ?? "[Registered address]",
  /** Where customers get help. */
  supportEmail: env.supportEmail,
  /** Where privacy questions and data requests go. */
  privacyEmail: process.env.PRIVACY_EMAIL ?? "privacy@get-on.tech",
  /** Where abuse reports go. */
  abuseEmail: process.env.ABUSE_EMAIL ?? "abuse@get-on.tech",
  /** Date the current version applies from, in ISO format. */
  effectiveDate: process.env.LEGAL_EFFECTIVE_DATE ?? new Date().toISOString().slice(0, 10),
  /**
   * True while the legal pages still need a lawyer to read them. While this
   * is true the pages show a draft banner and highlight anything unfinished.
   */
  reviewPending: (process.env.LEGAL_REVIEW_PENDING ?? "true") !== "false",
};

export type Company = typeof company;

/** A friendly date, for example "22 October 2026". */
export function formatEffectiveDate(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}
