import {
  fetchCloudflareSiteAnalytics,
  normalizeAnalyticsHostnames,
  resolveAnalyticsDateWindow,
  sha256Hex,
  signWorkerRequest,
  type CloudflareSiteAnalytics,
  type SiteAnalyticsRange,
} from "@get-on/site-server";

export type CloudflareStatsLookupOptions = {
  hostnames: string[];
  range?: SiteAnalyticsRange;
  from?: string;
  to?: string;
  rootDomain?: string;
  workerUrl?: string;
  workerSecret?: string;
  apiToken?: string;
  zoneId?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  now?: Date;
};

export type CloudflareStatsLookupResult = CloudflareSiteAnalytics & {
  via: "worker" | "direct" | "none";
};

function resolvedWorkerUrl(env: NodeJS.ProcessEnv = process.env): string {
  const explicit = (
    env.AI_WORKER_URL ||
    env.API_ORIGIN ||
    ""
  )
    .trim()
    .replace(/\/+$/, "");
  if (explicit) return explicit;
  const workerSecret = (env.WORKER_SHARED_SECRET ?? "").trim();
  const appOrigin = (env.APP_ORIGIN || env.NEXT_PUBLIC_SITE_URL || "").trim();
  if (workerSecret && /(?:^|\/\/)(?:www\.)?get-on\.tech(?:\/|$)/i.test(appOrigin)) {
    return "https://api.get-on.tech";
  }
  return "";
}

export async function getCloudflareSiteAnalytics(
  options: CloudflareStatsLookupOptions,
): Promise<CloudflareStatsLookupResult> {
  const resolvedWindow = resolveAnalyticsDateWindow({
    range: options.range,
    from: options.from,
    to: options.to,
    now: options.now,
  });
  const hostnames = normalizeAnalyticsHostnames(options.hostnames);

  if (!resolvedWindow.ok) {
    const todayIso = (options.now ?? new Date()).toISOString().slice(0, 10);
    return {
      ok: false,
      source: "cloudflare",
      via: "none",
      range: "custom",
      windowDays: 0,
      from: todayIso,
      to: todayIso,
      visitors: 0,
      views: 0,
      previousVisitors: null,
      previousViews: null,
      daily: [],
      countries: [],
      referrers: [],
      pages: [],
      devices: [],
      hostnames,
      errorCode: resolvedWindow.errorCode,
      errorMessage: resolvedWindow.errorMessage,
    };
  }

  const { range, from, to, windowDays, retentionLimited } = resolvedWindow;
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 9_000;
  const rootDomain = (options.rootDomain || process.env.ROOT_DOMAIN || "get-on.tech").trim();
  const workerUrl = (options.workerUrl ?? resolvedWorkerUrl()).trim().replace(/\/+$/, "");
  const workerSecret = (options.workerSecret ?? process.env.WORKER_SHARED_SECRET ?? "").trim();
  const apiToken = (
    options.apiToken ??
    process.env.CLOUDFLARE_ANALYTICS_API_TOKEN ??
    process.env.CLOUDFLARE_API_TOKEN ??
    process.env.CF_API_TOKEN_DOMAINS ??
    ""
  ).trim();
  const zoneId = (
    options.zoneId ??
    process.env.CLOUDFLARE_ZONE_ID ??
    process.env.CF_SAAS_ZONE_ID ??
    ""
  ).trim() || undefined;

  if (hostnames.length === 0) {
    return {
      ok: false,
      source: "cloudflare",
      via: "none",
      range,
      windowDays,
      from,
      to,
      ...(retentionLimited ? { retentionLimited: true } : {}),
      visitors: 0,
      views: 0,
      previousVisitors: null,
      previousViews: null,
      daily: [],
      countries: [],
      referrers: [],
      pages: [],
      devices: [],
      hostnames: [],
      errorCode: "NO_HOSTNAMES",
      errorMessage: "No hostnames configured for this website yet.",
    };
  }

  let workerErrorCode: string | undefined;
  let workerErrorMessage: string | undefined;

  if (workerUrl && workerSecret) {
    try {
      const targetUrl = `${workerUrl}/analytics/site`;
      const workerHost = new URL(targetUrl).host;
      const body = JSON.stringify({
        hostnames,
        range,
        ...(range === "custom" || options.from || options.to ? { from, to } : {}),
        ...(zoneId ? { zoneId } : {}),
        rootDomain,
      });
      const ts = String(Date.now());
      const bodyHash = await sha256Hex(body);
      const sig = await signWorkerRequest(workerSecret, {
        ts,
        host: workerHost,
        ip: "",
        bodyHash,
      });

      const res = await fetchImpl(targetUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-gs-host": workerHost,
          "x-gs-ip": "",
          "x-gs-ts": ts,
          "x-gs-sig": sig,
        },
        body,
        signal: AbortSignal.timeout(timeoutMs),
      });

      const parsed = (await res.json().catch(() => null)) as
        | (Partial<CloudflareSiteAnalytics> & { ok?: boolean; error?: string; message?: string })
        | null;

      if (res.ok && parsed?.ok === true) {
        return {
          ...(parsed as CloudflareSiteAnalytics),
          from: parsed.from ?? from,
          to: parsed.to ?? to,
          via: "worker",
        };
      }

      workerErrorCode = parsed?.error || parsed?.errorCode;
      workerErrorMessage = parsed?.message || parsed?.errorMessage;
    } catch {
      workerErrorCode = "WORKER_UNREACHABLE";
    }
  }

  if (apiToken) {
    const direct = await fetchCloudflareSiteAnalytics({
      apiToken,
      hostnames,
      range,
      ...(range === "custom" || options.from || options.to ? { from, to } : {}),
      zoneId,
      rootDomain,
      now: options.now,
      fetchImpl,
      timeoutMs,
    });
    return {
      ...direct,
      via: "direct",
    };
  }

  return {
    ok: false,
    source: "cloudflare",
    via: "none",
    range,
    windowDays,
    from,
    to,
    ...(retentionLimited ? { retentionLimited: true } : {}),
    visitors: 0,
    views: 0,
    previousVisitors: null,
    previousViews: null,
    daily: [],
    countries: [],
    referrers: [],
    pages: [],
    devices: [],
    hostnames,
    errorCode: workerErrorCode ?? "ANALYTICS_NOT_CONFIGURED",
    errorMessage:
      workerErrorMessage ??
      "Add CLOUDFLARE_ANALYTICS_API_TOKEN (or CLOUDFLARE_API_TOKEN with Zone Analytics Read) to enable Cloudflare visitor insights.",
  };
}
