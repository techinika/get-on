export type AiFlags = {
  factClaims: string[];
  sampleClaims: string[];
  injection: boolean;
  empty: boolean;
};

const CLAIM_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: "award", pattern: /\b(award[- ]winning|winner|awarded|prize)\b/i },
  { label: "guarantee", pattern: /\b(guaranteed|guarantee|risk[- ]free)\b/i },
  { label: "ranking", pattern: /\b(number one|#1|best in|top rated|leading)\b/i },
  { label: "certified", pattern: /\b(certified|accredited|licensed|insured)\b/i },
  { label: "percentage", pattern: /\b\d{1,3}%/ },
  { label: "years", pattern: /\b\d{1,3}\+? years\b/i },
  { label: "customers", pattern: /\b\d[\d,]*\+? (customers|clients|projects)\b/i },
];

const INJECTION_PATTERNS = [
  /ignore (all )?(previous|above) instructions/i,
  /reveal (the )?(system|developer) prompt/i,
  /you are now/i,
  /act as (a|an) (different|new)/i,
  /do anything now/i,
];

export function stripHtml(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function sanitiseText(value: string, maxChars = 4000): string {
  const text = stripHtml(value)
    .replace(/^```(?:text|markdown|json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/\{\{|\}\}/g, "")
    .trim();
  return text.slice(0, maxChars).trim();
}

export function scanOutput(value: string): AiFlags {
  const text = value.trim();
  const factClaims = CLAIM_PATTERNS.filter(({ pattern }) =>
    pattern.test(text),
  ).map(({ label }) => label);
  const sampleClaims = /\b(sample|example|placeholder|lorem ipsum)\b/i.test(text)
    ? ["sample_text"]
    : [];
  const injection = INJECTION_PATTERNS.some((pattern) => pattern.test(text));
  return {
    factClaims,
    sampleClaims,
    injection,
    empty: text.length === 0,
  };
}

export function hasInjectionAttempt(value: string): boolean {
  return INJECTION_PATTERNS.some((pattern) => pattern.test(value));
}
