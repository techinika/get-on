export function buildConsentScript(attrs: { gaId: string; consent: "ask" | "always" }) {
  const parts: string[] = [];
  parts.push(`<script src="/_gs/c.{hash}.js" defer data-ga="${escapeAttr(attrs.gaId)}" data-consent="${attrs.consent}"></script>`);
  return parts.join("\n");
}

function escapeAttr(s: string) {
  return s.replace(/"/g, "&quot;");
}
