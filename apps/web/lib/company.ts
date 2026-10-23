import env from "@/lib/env";

/**
 * Company details used on the legal pages.
 */
export const company = {
  name: process.env.COMPANY_NAME ?? "Get-On",
  legalEntity: process.env.LEGAL_ENTITY ?? "[Company legal name]",
  country: process.env.COMPANY_COUNTRY ?? "[Country]",
  address: process.env.COMPANY_ADDRESS ?? "[Registered address]",
  supportEmail: env.teamEmail,
  privacyEmail: env.teamEmail,
  abuseEmail: env.teamEmail,
  teamEmail: env.teamEmail,
  effectiveDate: process.env.LEGAL_EFFECTIVE_DATE ?? new Date().toISOString().slice(0, 10),
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
