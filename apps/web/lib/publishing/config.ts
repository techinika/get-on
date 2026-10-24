import path from "node:path";

export type PublishStoreKind = "cloudflare" | "local";

export type PublishConfig = {
  kind: PublishStoreKind;
  rootDomain: string;
  localRootDomain: string;
  localPort: number;
  localDir: string;
  accountId?: string;
  apiToken?: string;
  kvNamespaceId?: string;
  r2Bucket?: string;
};

function trimmed(value: string | undefined): string {
  return (value ?? "").trim();
}

/**
 * Publishing storage is Cloudflare when every credential is present, and the
 * local folder otherwise. `PUBLISH_STORE` can force either mode.
 */
export function readPublishConfig(
  env: NodeJS.ProcessEnv = process.env,
): PublishConfig {
  const accountId = trimmed(env.CLOUDFLARE_ACCOUNT_ID);
  const apiToken = trimmed(env.CLOUDFLARE_API_TOKEN);
  const kvNamespaceId = trimmed(env.CLOUDFLARE_KV_NAMESPACE_ID);
  const r2Bucket = trimmed(env.CLOUDFLARE_R2_BUCKET);

  const cloudflareReady = Boolean(
    accountId && apiToken && kvNamespaceId && r2Bucket,
  );
  const requested = trimmed(env.PUBLISH_STORE).toLowerCase();
  const kind: PublishStoreKind =
    requested === "local"
      ? "local"
      : requested === "cloudflare"
        ? "cloudflare"
        : cloudflareReady
          ? "cloudflare"
          : "local";

  const localPort = Number(trimmed(env.PUBLISH_PORT) || 8787);

  return {
    kind,
    rootDomain: trimmed(env.ROOT_DOMAIN) || "get-on.tech",
    localRootDomain: trimmed(env.LOCAL_ROOT_DOMAIN) || "localhost",
    localPort: Number.isFinite(localPort) ? localPort : 8787,
    localDir: path.resolve(
      /* turbopackIgnore: true */
      trimmed(env.LOCAL_SITES_DIR) || path.join(process.cwd(), ".local-sites"),
    ),
    accountId,
    apiToken,
    kvNamespaceId,
    r2Bucket,
  };
}

/** The host name whose live pointer serves this website. */
export function siteHostname(
  config: PublishConfig,
  subdomain: string,
): string {
  const root =
    config.kind === "local" ? config.localRootDomain : config.rootDomain;
  return `${subdomain}.${root}`.toLowerCase();
}

/** The address shown to the owner for this website. */
export function siteAddress(
  config: PublishConfig,
  subdomain: string,
): string {
  const hostname = siteHostname(config, subdomain);
  return config.kind === "local"
    ? `http://${hostname}:${config.localPort}`
    : `https://${hostname}`;
}

/** Throws a stable code instead of leaking which setting is missing. */
export function requireCloudflareConfig(config: PublishConfig): {
  accountId: string;
  apiToken: string;
  kvNamespaceId: string;
  r2Bucket: string;
} {
  if (
    config.kind !== "cloudflare" ||
    !config.accountId ||
    !config.apiToken ||
    !config.kvNamespaceId ||
    !config.r2Bucket
  ) {
    throw new Error("PUBLISH_NOT_CONFIGURED");
  }
  return {
    accountId: config.accountId,
    apiToken: config.apiToken,
    kvNamespaceId: config.kvNamespaceId,
    r2Bucket: config.r2Bucket,
  };
}
