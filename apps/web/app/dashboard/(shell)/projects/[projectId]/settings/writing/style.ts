import { TONES } from "./tone-options";

export type WritingStyleInput = {
  tones: string[];
  audience: string;
  wordsToUse: string[];
  wordsToAvoid: string[];
  businessFacts: Array<{ label: string; value: string }>;
};

function clean(value: FormDataEntryValue | null, max: number): string {
  return String(value ?? "").trim().slice(0, max);
}

function uniqueList(
  formData: FormData,
  key: string,
  max: number,
  maxLength: number,
): string[] {
  const seen = new Set<string>();
  const values: string[] = [];
  for (const entry of formData.getAll(key)) {
    const value = clean(entry, maxLength);
    if (!value) continue;
    const lower = value.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    values.push(value);
    if (values.length >= max) break;
  }
  return values;
}

export function parseWritingStyle(formData: FormData): WritingStyleInput {
  const tones = uniqueList(formData, "tones", TONES.length, 24)
    .filter((tone): tone is (typeof TONES)[number] =>
      TONES.includes(tone as (typeof TONES)[number]),
    )
    .slice(0, 3);
  const audience = clean(formData.get("audience"), 200);
  const wordsToUse = uniqueList(formData, "words_use", 10, 24);
  const wordsToAvoid = uniqueList(formData, "words_avoid", 10, 24);

  const labels = formData.getAll("fact_label");
  const values = formData.getAll("fact_value");
  const businessFacts: Array<{ label: string; value: string }> = [];
  for (let index = 0; index < Math.min(labels.length, values.length); index += 1) {
    const label = clean(labels[index] ?? null, 40);
    const value = clean(values[index] ?? null, 120);
    if (!label || !value) continue;
    businessFacts.push({ label, value });
    if (businessFacts.length >= 20) break;
  }

  return { tones, audience, wordsToUse, wordsToAvoid, businessFacts };
}
