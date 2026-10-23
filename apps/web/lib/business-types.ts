/**
 * Business types used by the setup wizard and the public demo request form.
 */
export const BUSINESS_TYPE_LABELS = [
  "Restaurant or cafe",
  "Salon or beauty",
  "Shop",
  "Photographer or creative",
  "Consultant or freelancer",
  "Church or community",
  "Repairs and services",
  "Farm or agriculture",
  "Teaching or tutoring",
  "Something else",
] as const;

export type BusinessTypeLabel = (typeof BUSINESS_TYPE_LABELS)[number];
