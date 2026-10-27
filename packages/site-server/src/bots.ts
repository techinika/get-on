const BOT_PATTERNS = [
  /bot/i,
  /crawler/i,
  /spider/i,
  /slurp/i,
  /bing/i,
  /googlebot/i,
  /baidu/i,
  /yandex/i,
  /duckduck/i,
  /headless/i,
  /phantom/i,
  /wget/i,
  /curl/i,
  /httpclient/i,
  /python/i,
  /java\//i,
  /libwww/i,
  /ahrefs/i,
  /semrush/i,
  /mj12bot/i,
  /dotbot/i,
  /petalbot/i,
  /screaming/i,
  /uptime/i,
  /pingdom/i,
  /monitor/i,
];

export function isBot(userAgent: string | null | undefined): boolean {
  if (!userAgent) return true;
  const ua = userAgent.toLowerCase();
  for (const pattern of BOT_PATTERNS) {
    if (pattern.test(ua)) return true;
  }
  return false;
}

export function isCountableRequest(req: {
  method?: string;
  headers: Headers | Record<string, string | undefined>;
  path?: string;
  userAgent?: string | null;
}): boolean {
  const method = (req.method || "GET").toUpperCase();
  if (method !== "GET") return false;
  const headers = req.headers;
  const get = (k: string) => {
    if (headers instanceof Headers) return headers.get(k);
    const key = Object.keys(headers).find((h) => h.toLowerCase() === k.toLowerCase());
    return key ? headers[key] : null;
  };
  const purpose = get("sec-purpose") || get("purpose");
  if (purpose && purpose.toLowerCase().includes("prefetch")) return false;
  const dnt = get("dnt");
  const gpc = get("sec-gpc");
  if (dnt === "1" || gpc === "1") return false;
  if (isBot(req.userAgent || get("user-agent"))) return false;
  const accept = get("accept") || "";
  if (!accept.includes("text/html")) return false;
  const path = req.path || "/";
  if (path.startsWith("/_forms")) return false;
  if (path.startsWith("/_gs/")) return false;
  if (path.startsWith("/_l/")) return false;
  return true;
}
