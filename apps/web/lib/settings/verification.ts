export const GOOGLE_TAG_RE = /^[A-Za-z0-9_-]{20,100}$/;
export const GOOGLE_FILE_RE = /^google[a-f0-9]{16}\.html$/;
export const BING_TAG_RE = /^[A-Fa-f0-9]{32}$/;
export const OTHER_VERIF_RE = /^[A-Za-z0-9._-]{8,120}$/;

export function extractGoogleTagContent(input: string) {
  const trimmed = input.trim();
  const m = trimmed.match(/content="([^"]+)"/i);
  if (m && m[1]) return m[1].trim();
  return trimmed.replace(/["']/g, "");
}

export function isValidGoogleTagContent(s: string) {
  return GOOGLE_TAG_RE.test(s);
}

export function isValidGoogleFileName(s: string) {
  return GOOGLE_FILE_RE.test(s.trim());
}

export function isValidGoogleFileContent(content: string, fileName: string) {
  const c = content.trim();
  return c === `google-site-verification: ${fileName}` || c.includes(fileName);
}

export function isValidBingTag(s: string) {
  return BING_TAG_RE.test(s.trim());
}
