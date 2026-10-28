const LINK_PATTERN = /href="([^"]+)"/g;

/** Returns an http(s) origin with no path, or null when tracking is off. */
export function trackingOrigin(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

function decodeAttribute(value: string): string {
  return value.replace(/&amp;/g, "&").replace(/&quot;/g, '"');
}

function isTrackable(value: string, unsubscribeUrl: string): boolean {
  if (value === unsubscribeUrl) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

/** Unique, trackable http(s) links in the rendered HTML, in first-seen order. */
export function trackableLinks(html: string, unsubscribeUrl: string): string[] {
  const seen = new Set<string>();
  for (const match of html.matchAll(LINK_PATTERN)) {
    const value = decodeAttribute(match[1] ?? "");
    if (value && isTrackable(value, unsubscribeUrl)) seen.add(value);
  }
  return [...seen];
}

/**
 * Replaces only the links in `replacements`. A link left out of the map keeps
 * its original address, so a failed insert cannot break the message.
 */
export function rewriteTrackedLinks(html: string, replacements: Map<string, string>): string {
  if (replacements.size === 0) return html;
  return html.replace(LINK_PATTERN, (whole, raw: string) => {
    const value = decodeAttribute(raw);
    const replacement = replacements.get(value);
    return replacement ? `href="${replacement}"` : whole;
  });
}

/** Adds the open pixel just before the closing body tag. */
export function addOpenPixel(html: string, url: string): string {
  const pixel = `<img src="${url}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;opacity:0;">`;
  return html.includes("</body>")
    ? html.replace("</body>", `${pixel}</body>`)
    : `${html}${pixel}`;
}
