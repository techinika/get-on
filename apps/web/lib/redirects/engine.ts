export function normalizeRedirectPath(p: string) {
  let s = p.trim().toLowerCase();
  if (!s.startsWith("/")) s = "/" + s;
  if (s.length > 1 && s.endsWith("/")) s = s.slice(0, -1);
  return s;
}

export function isValidRedirectPath(p: string) {
  const s = normalizeRedirectPath(p);
  if (s.length < 1 || s.length > 200) return false;
  if (!/^\/[a-z0-9/_.~%-]*$/.test(s)) return false;
  if (s.includes("..")) return false;
  return true;
}
