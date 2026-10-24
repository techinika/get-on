export function normalizeFromPath(input: string) {
  let p = input.trim();
  if (!p.startsWith("/")) p = "/" + p;
  p = p.toLowerCase();
  if (p !== "/" && p.endsWith("/")) p = p.slice(0, -1);
  return p;
}

export function isValidFromPath(p: string) {
  if (p.length < 1 || p.length > 200) return false;
  if (p === "/") return true;
  if (p.endsWith("/")) return false;
  if (p.includes("..")) return false;
  return /^\/[a-z0-9/_.~%-]*$/.test(p);
}

export function isValidToPath(p: string) {
  if (!p) return false;
  if (p.startsWith("/")) return /^\/[a-z0-9/_.~%-]*$/.test(p) && p.length <= 500;
  try {
    const u = new URL(p);
    return u.protocol === "https:" && p.length <= 500;
  } catch {
    return false;
  }
}
