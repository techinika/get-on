/** Keep only the six digits an authenticator app shows. */
export function normalizeTotpCode(value: string): string {
  return value.replace(/\D/g, "").slice(0, 6);
}

/** Supabase returns SVG markup; turn it into a safe image source. */
export function totpQrSource(svg: string): string {
  const value = svg.trim();
  if (value.startsWith("data:image/")) return value;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(value)}`;
}
