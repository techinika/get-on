import { SPAM_PHRASES_LOWER } from "./spam-phrases";

export type SpamResult = {
  score: number;
  reasons: string[];
};

const LINK_RE = /(?:https?:\/\/|www\.)[^\s<>"']+/gi;

function linkCount(value: string): number {
  return (value.match(LINK_RE) ?? []).length;
}

function letters(value: string): string[] {
  return [...value].filter((char) => /\p{L}/u.test(char));
}

/**
 * Scores a submission without using the language or script of the text.
 * Matching non-Latin writing is never a reason on its own.
 */
export function scoreSubmission(input: {
  name: string;
  email: string;
  message: string;
}): SpamResult {
  let score = 0;
  const reasons: string[] = [];

  const links = linkCount(input.message);
  if (links > 2) {
    score += 60;
    reasons.push("too_many_links");
  }

  const lower = input.message.toLowerCase();
  let phraseHits = 0;
  for (const phrase of SPAM_PHRASES_LOWER) {
    if (lower.includes(phrase)) phraseHits += 1;
  }
  if (phraseHits > 0) {
    const points = Math.min(80, phraseHits * 40);
    score += points;
    reasons.push("spam_phrases");
  }

  const messageLetters = letters(input.message);
  if (messageLetters.length > 20) {
    const upper = messageLetters.filter((char) => char === char.toUpperCase() && char !== char.toLowerCase());
    if (upper.length / messageLetters.length > 0.7) {
      score += 20;
      reasons.push("mostly_uppercase");
    }
  }

  if (linkCount(input.name) > 0) {
    score += 60;
    reasons.push("link_in_name");
  }

  if (input.message.trim().length < 5) {
    score += 30;
    reasons.push("message_too_short");
  }

  return { score, reasons };
}

export const SPAM_THRESHOLD = 60;
