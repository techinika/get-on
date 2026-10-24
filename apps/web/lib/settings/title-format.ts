export function formatPageTitle(opts: {
  pageTitle?: string | null;
  siteTitle?: string | null;
  tagline?: string | null;
  format?: string;
  isHome?: boolean;
}) {
  const page = (opts.pageTitle || "").trim();
  const site = (opts.siteTitle || "").trim();
  const tagline = (opts.tagline || "").trim();
  const format = opts.format || "{page} | {site}";
  if (opts.isHome) {
    if (site && tagline) return `${site} | ${tagline}`.slice(0, 70);
    if (site) return site.slice(0, 70);
    return page.slice(0, 70);
  }
  let out = format;
  out = out.replace("{page}", page || site || "");
  out = out.replace("{site}", site || "");
  out = out.replace("{tagline}", tagline || "");
  return out.replace(/\s+\|\s+$/, "").replace(/^\s+\|\s+/, "").trim().slice(0, 70);
}
