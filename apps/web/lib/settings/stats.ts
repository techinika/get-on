export function isBotUa(ua: string) {
  const patterns = [/bot/i, /crawler/i, /spider/i, /slurp/i, /bingpreview/i];
  return patterns.some((p) => p.test(ua));
}

export function shouldCountRequest(input: {
  method: string;
  accept?: string | null;
  secPurpose?: string | null;
  purpose?: string | null;
  ua?: string | null;
}) {
  if (input.method !== "GET") return false;
  if (input.secPurpose === "prefetch" || input.purpose === "prefetch") return false;
  if (input.ua && isBotUa(input.ua)) return false;
  if (input.accept && !input.accept.includes("text/html")) return false;
  return true;
}
