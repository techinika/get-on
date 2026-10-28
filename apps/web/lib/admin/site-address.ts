/**
 * Public address helpers for staff screens. They read only environment
 * settings, never publishing clients or stored content.
 */

function trimmed(value: string | undefined): string {
  return (value ?? "").trim();
}

function localStore(): { local: boolean; port: number } {
  const requested = trimmed(process.env.PUBLISH_STORE).toLowerCase();
  const cloudflareReady = Boolean(
    trimmed(process.env.CLOUDFLARE_ACCOUNT_ID) &&
      trimmed(process.env.CLOUDFLARE_API_TOKEN) &&
      trimmed(process.env.CLOUDFLARE_KV_NAMESPACE_ID) &&
      trimmed(process.env.CLOUDFLARE_R2_BUCKET),
  );
  const local =
    requested === "local" ? true : requested === "cloudflare" ? false : !cloudflareReady;
  const port = Number(trimmed(process.env.PUBLISH_PORT) || 8787);
  return { local, port: Number.isFinite(port) ? port : 8787 };
}

export function adminSiteAddress(subdomain: string): string {
  const { local, port } = localStore();
  const root = local
    ? trimmed(process.env.LOCAL_ROOT_DOMAIN) || "localhost"
    : trimmed(process.env.ROOT_DOMAIN) || "get-on.tech";
  const hostname = `${subdomain}.${root}`.toLowerCase();
  return local ? `http://${hostname}:${port}` : `https://${hostname}`;
}

export function displayHostname(address: string): string {
  try {
    return new URL(address).host;
  } catch {
    return address.replace(/^https?:\/\//, "");
  }
}
