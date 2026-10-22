import { z } from "zod";

export const REPORT_REASONS = [
  { value: "scam", label: "It is a scam or tries to steal information" },
  { value: "impersonation", label: "It pretends to be another person or business" },
  { value: "illegal", label: "It shows illegal content" },
  { value: "harmful", label: "It is harmful or hateful" },
  { value: "spam", label: "It is spam" },
  { value: "other", label: "Something else" },
] as const;

export const REPORT_REASON_LABELS: Record<string, string> = Object.fromEntries(
  REPORT_REASONS.map((reason) => [reason.value, reason.label]),
);

export const reportSchema = z.object({
  site: z
    .string()
    .trim()
    .min(1, "Please enter a website address.")
    .max(300, "That website address is too long."),
  reason: z.enum(
    ["scam", "impersonation", "illegal", "harmful", "spam", "other"],
    { errorMap: () => ({ message: "Please choose what the problem is." }) },
  ),
  details: z
    .string()
    .trim()
    .max(1000, "Please keep your message under 1000 characters.")
    .optional(),
  email: z
    .string()
    .trim()
    .max(200, "That email address is too long.")
    .refine(
      (value) => value === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
      "Please check that email address.",
    )
    .optional(),
});

export type ReportInput = z.infer<typeof reportSchema>;

/**
 * Accepts "rosebakery", "rosebakery.get-on.tech" or a full URL and returns
 * the name used in the database. Returns null when it cannot be a Get-On site.
 */
export function normalizeSiteName(value: string): string | null {
  let input = value.trim().toLowerCase();
  if (!input) return null;

  if (input.includes("://")) {
    try {
      input = new URL(input).hostname;
    } catch {
      return null;
    }
  }

  input = input.replace(/:\d+$/, "").replace(/\.$/, "");
  input = input.replace(/^www\./, "");

  const labels = input.split(".");
  if (labels.length > 1) {
    if (labels.length !== 3 || labels[1] !== "get-on" || labels[2] !== "tech") {
      return null;
    }
    input = labels[0] ?? "";
  }

  return /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/.test(input) ? input : null;
}
