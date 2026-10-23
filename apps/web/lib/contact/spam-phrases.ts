/** Phrases that are common in unsolicited advertising. Never language based. */
export const SPAM_PHRASES = [
  "seo services",
  "guest post",
  "backlinks",
  "crypto investment",
  "casino",
  "loan offer",
  "buy followers",
  "cheap pills",
  "work from home",
  "click here to",
] as const;

export const SPAM_PHRASES_LOWER = SPAM_PHRASES.map((phrase) => phrase.toLowerCase());
