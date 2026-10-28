export const BANNED_WORDS = [
  "leverage",
  "seamless",
  "supercharge",
  "unlock",
  "empower",
  "delve",
  "elevate",
  "revolutionize",
  "cutting-edge",
  "game-changing",
  "robust",
  "journey",
  "ai-powered",
  "magic",
  "effortless",
  "world-class",
] as const;

export const SUBJECT_MAX = 60;
export const PREHEADER_MIN = 40;
export const PREHEADER_MAX = 110;
export const SENTENCE_MAX_WORDS = 24;
export const GRADE_MAX = 8;

export interface EmailCopy {
  subject: string;
  preheader?: string;
  body: string;
}

export interface CopyIssue {
  code:
    | "BANNED_WORD"
    | "SUBJECT_TOO_LONG"
    | "PREHEADER_TOO_SHORT"
    | "PREHEADER_TOO_LONG"
    | "SENTENCE_TOO_LONG"
    | "GRADE_TOO_HIGH"
    | "EMOJI"
    | "PLACEHOLDER";
  detail: string;
}

const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
const PLACEHOLDER = /\{\{?\s*[a-z0-9_]+\s*\}?\}/i;

export function findBannedWords(text: string): string[] {
  const lower = text.toLowerCase();
  return BANNED_WORDS.filter((word) => lower.includes(word));
}

export function words(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

export function sentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

/** A small, deliberately conservative readability estimate. */
export function gradeLevel(text: string): number {
  const clean = text.replace(/https?:\/\/\S+/g, " ");
  const allWords = words(clean);
  if (allWords.length === 0) return 0;
  const sentenceCount = Math.max(1, sentences(clean).length);
  const syllables = allWords.reduce((sum, word) => sum + countSyllables(word), 0);
  const score =
    0.39 * (allWords.length / sentenceCount) + 11.8 * (syllables / allWords.length) - 15.59;
  return Math.max(0, Math.round(score * 10) / 10);
}

function countSyllables(word: string): number {
  const clean = word.toLowerCase().replace(/[^a-z]/g, "");
  if (clean.length <= 3) return 1;
  const groups = clean
    .replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "")
    .replace(/^y/, "")
    .match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups?.length ?? 1);
}

export function lintEmailCopy(copy: EmailCopy): CopyIssue[] {
  const issues: CopyIssue[] = [];
  const subject = copy.subject.trim();
  const preheader = (copy.preheader ?? "").trim();

  if (subject.length > SUBJECT_MAX) {
    issues.push({
      code: "SUBJECT_TOO_LONG",
      detail: `Subject is ${subject.length} characters; keep it to ${SUBJECT_MAX}.`,
    });
  }
  if (preheader && preheader.length < PREHEADER_MIN) {
    issues.push({
      code: "PREHEADER_TOO_SHORT",
      detail: `Preheader is ${preheader.length} characters; use at least ${PREHEADER_MIN}.`,
    });
  }
  if (preheader.length > PREHEADER_MAX) {
    issues.push({
      code: "PREHEADER_TOO_LONG",
      detail: `Preheader is ${preheader.length} characters; keep it to ${PREHEADER_MAX}.`,
    });
  }

  const allText = [subject, preheader, copy.body].join(" ");
  for (const word of findBannedWords(allText)) {
    issues.push({ code: "BANNED_WORD", detail: `Remove the word "${word}".` });
  }
  if (EMOJI.test(allText)) {
    issues.push({ code: "EMOJI", detail: "Do not use emojis in email." });
  }
  if (PLACEHOLDER.test(allText)) {
    issues.push({
      code: "PLACEHOLDER",
      detail: "A placeholder was left in the copy.",
    });
  }

  for (const sentence of sentences(copy.body)) {
    const count = words(sentence).length;
    if (count > SENTENCE_MAX_WORDS) {
      issues.push({
        code: "SENTENCE_TOO_LONG",
        detail: `A sentence has ${count} words; keep sentences under ${SENTENCE_MAX_WORDS}.`,
      });
    }
  }

  const grade = gradeLevel(copy.body);
  if (grade > GRADE_MAX) {
    issues.push({
      code: "GRADE_TOO_HIGH",
      detail: `Reading grade is about ${grade}; aim for ${GRADE_MAX} or lower.`,
    });
  }

  return issues;
}
