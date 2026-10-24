/**
 * Platform names are blocked. Well-known brands are reviewed rather than
 * blocked, because a small business can legitimately own a similar name.
 */
const PLATFORM_NAMES = new Set([
  "geton",
  "get-on",
  "getontech",
  "geton-tech",
]);

const PROTECTED_BRANDS = new Set([
  "google",
  "youtube",
  "facebook",
  "instagram",
  "whatsapp",
  "tiktok",
  "amazon",
  "apple",
  "microsoft",
  "windows",
  "office",
  "paypal",
  "stripe",
  "netflix",
  "cloudflare",
  "openai",
  "chatgpt",
  "linkedin",
  "twitter",
  "x",
  "github",
  "shopify",
  "wix",
  "squarespace",
  "godaddy",
  "namecheap",
  "vercel",
  "supabase",
  "bank",
  "banking",
  "pay",
  "wallet",
  "crypto",
  "government",
  "police",
  "tax",
  "irs",
]);

export type DomainScreening = {
  action: "allow" | "review" | "block";
  reason: string | null;
};

export function screenDomain(sld: string): DomainScreening {
  const name = sld.toLowerCase().replace(/[^a-z0-9-]/g, "");
  if (
    PLATFORM_NAMES.has(name) ||
    name.startsWith("geton") ||
    name.startsWith("get-on")
  ) {
    return { action: "block", reason: "platform" };
  }
  if (PROTECTED_BRANDS.has(name)) {
    return { action: "review", reason: "brand" };
  }
  return { action: "allow", reason: null };
}
