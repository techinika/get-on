export type DomainsProviderKind = "fake" | "cloudflare";

export type DomainsConfig = {
  provider: DomainsProviderKind;
  cnameTarget: string;
  zoneId: string;
  apiToken: string;
  includedHostnames: number;
  maxPendingHostnames: number;
  providerRps: number;
  dohEndpoints: string[];
  rdapBootstrapUrl: string;
  rootDomain: string;
};

function trimmed(value: string | undefined): string {
  return (value ?? "").trim();
}

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(trimmed(value));
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export function readDomainsConfig(
  env: NodeJS.ProcessEnv = process.env,
): DomainsConfig {
  const requested = trimmed(env.DOMAINS_PROVIDER).toLowerCase();
  const provider: DomainsProviderKind =
    requested === "cloudflare" ? "cloudflare" : "fake";

  const dohEndpoints = trimmed(env.DOH_ENDPOINTS)
    .split(",")
    .map((endpoint) => endpoint.trim())
    .filter(Boolean);

  return {
    provider,
    cnameTarget: trimmed(env.CF_SAAS_CNAME_TARGET),
    zoneId: trimmed(env.CF_SAAS_ZONE_ID),
    apiToken: trimmed(env.CF_API_TOKEN_DOMAINS),
    includedHostnames: positiveInt(env.CF_SAAS_HOSTNAMES_INCLUDED, 100),
    maxPendingHostnames: positiveInt(env.DOMAINS_MAX_PENDING_HOSTNAMES, 200),
    providerRps: positiveInt(env.DOMAINS_PROVIDER_RPS, 3),
    dohEndpoints:
      dohEndpoints.length > 0
        ? dohEndpoints
        : [
            "https://cloudflare-dns.com/dns-query",
            "https://dns.google/resolve",
          ],
    rdapBootstrapUrl:
      trimmed(env.RDAP_BOOTSTRAP_URL) ||
      "https://data.iana.org/rdap/dns.json",
    rootDomain: trimmed(env.ROOT_DOMAIN) || "get-on.tech",
  };
}

export function requireCloudflareDomainsConfig(config: DomainsConfig): {
  zoneId: string;
  apiToken: string;
  cnameTarget: string;
} {
  if (!config.zoneId || !config.apiToken || !config.cnameTarget) {
    throw new Error("PROVIDER_NOT_CONFIGURED");
  }
  return {
    zoneId: config.zoneId,
    apiToken: config.apiToken,
    cnameTarget: config.cnameTarget,
  };
}
