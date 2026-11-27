export type SiteAnalyticsRange = "7d" | "30d" | "90d" | "custom";

export type SiteDailyPoint = {
  day: string;
  visitors: number;
  views: number;
};

export type SiteCountryPoint = {
  code: string;
  name: string;
  visitors: number;
  views: number;
};

export type SiteReferrerPoint = {
  source: string;
  visitors: number;
  views: number;
};

export type SitePagePoint = {
  path: string;
  visitors: number;
  views: number;
};

export type SiteDevicePoint = {
  device: string;
  visitors: number;
  views: number;
};

export type CloudflareSiteAnalytics = {
  ok: boolean;
  source: "cloudflare";
  range: SiteAnalyticsRange;
  windowDays: number;
  from: string;
  to: string;
  retentionLimited?: boolean;
  visitors: number;
  views: number;
  previousVisitors: number | null;
  previousViews: number | null;
  daily: SiteDailyPoint[];
  countries: SiteCountryPoint[];
  referrers: SiteReferrerPoint[];
  pages: SitePagePoint[];
  devices: SiteDevicePoint[];
  hostnames: string[];
  errorCode?: string;
  errorMessage?: string;
};

export type FetchCloudflareSiteAnalyticsInput = {
  apiToken: string;
  hostnames: string[];
  range?: SiteAnalyticsRange;
  from?: string;
  to?: string;
  zoneId?: string;
  rootDomain?: string;
  now?: Date;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

const HOSTNAME_RE =
  /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

const INTERNAL_PATH_PREFIXES = [
  "/_gs/",
  "/_forms/",
  "/_plugins/",
  "/_l/",
  "/_shared/",
  "/cdn-cgi/",
];

const ZONE_CACHE_TTL_MS = 60 * 60 * 1000;
const zoneIdCache = new Map<string, { id: string; expiresAt: number }>();

let regionDisplayNames: Intl.DisplayNames | null = null;
function countryNameFor(rawCode: string): { code: string; name: string } {
  const code = rawCode.trim().toUpperCase();
  if (!code || code === "XX" || code === "T1") {
    return { code: "XX", name: "Unknown" };
  }
  try {
    if (!regionDisplayNames && typeof Intl !== "undefined" && Intl.DisplayNames) {
      regionDisplayNames = new Intl.DisplayNames(["en"], { type: "region" });
    }
    const label = regionDisplayNames?.of(code);
    return { code, name: label && label !== code ? label : code };
  } catch {
    return { code, name: code };
  }
}

export function normalizeAnalyticsRange(raw: string | null | undefined): SiteAnalyticsRange {
  if (raw === "7d" || raw === "30d" || raw === "90d" || raw === "custom") return raw;
  return "30d";
}

const ISO_DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseIsoUtcDay(raw: string | null | undefined): Date | null {
  const cleaned = (raw ?? "").trim();
  if (!ISO_DAY_RE.test(cleaned)) return null;
  const date = new Date(`${cleaned}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  if (date.toISOString().slice(0, 10) !== cleaned) return null;
  return date;
}

export type ResolvedAnalyticsWindow =
  | {
      ok: true;
      range: SiteAnalyticsRange;
      from: string;
      to: string;
      windowDays: number;
      startDate: Date;
      endExclusive: Date;
      cfStartDate: Date;
      cfEndExclusive: Date;
      retentionLimited: boolean;
      beyondRetentionOnly: boolean;
    }
  | {
      ok: false;
      errorCode: "INVALID_DATE_RANGE";
      errorMessage: string;
    };

export function resolveAnalyticsDateWindow(input: {
  range?: string | null;
  from?: string | null;
  to?: string | null;
  now?: Date;
}): ResolvedAnalyticsWindow {
  const now = input.now ?? new Date();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const todayIso = isoDayOf(todayUtc);
  const hasFrom = Boolean(input.from?.trim());
  const hasTo = Boolean(input.to?.trim());
  const requestedRange = normalizeAnalyticsRange(input.range);

  let fromDate: Date;
  let toDate: Date;
  let effectiveRange: SiteAnalyticsRange;

  if (hasFrom || hasTo || requestedRange === "custom") {
    const parsedFrom = parseIsoUtcDay(input.from);
    const parsedTo = hasTo ? parseIsoUtcDay(input.to) : todayUtc;
    if (!parsedFrom || !parsedTo) {
      return {
        ok: false,
        errorCode: "INVALID_DATE_RANGE",
        errorMessage: "Please enter valid YYYY-MM-DD start and end dates.",
      };
    }
    toDate = parsedTo.getTime() > todayUtc.getTime() ? todayUtc : parsedTo;
    fromDate = parsedFrom;
    if (fromDate.getTime() > toDate.getTime()) {
      return {
        ok: false,
        errorCode: "INVALID_DATE_RANGE",
        errorMessage: "Start date must be on or before the end date.",
      };
    }
    const spanDays = Math.round((toDate.getTime() - fromDate.getTime()) / 86_400_000) + 1;
    if (spanDays > 90) {
      return {
        ok: false,
        errorCode: "INVALID_DATE_RANGE",
        errorMessage: "Date range cannot exceed 90 days.",
      };
    }
    effectiveRange = "custom";
  } else {
    const presetDays = requestedRange === "7d" ? 7 : requestedRange === "90d" ? 90 : 30;
    toDate = todayUtc;
    fromDate = shiftUtcDays(todayUtc, -(presetDays - 1));
    effectiveRange = requestedRange;
  }

  const from = isoDayOf(fromDate);
  const to = isoDayOf(toDate);
  const windowDays = Math.max(1, Math.round((toDate.getTime() - fromDate.getTime()) / 86_400_000) + 1);
  const endExclusive = shiftUtcDays(toDate, 1);

  // Cloudflare httpRequestsAdaptiveGroups retains ~30 days on Free/Pro plans.
  const earliestCfDate = shiftUtcDays(todayUtc, -29);
  const retentionLimited = fromDate.getTime() < earliestCfDate.getTime();
  const cfStartDate = retentionLimited ? earliestCfDate : fromDate;
  const beyondRetentionOnly = cfStartDate.getTime() >= endExclusive.getTime();

  return {
    ok: true,
    range: effectiveRange,
    from: from <= todayIso ? from : todayIso,
    to,
    windowDays,
    startDate: fromDate,
    endExclusive,
    cfStartDate,
    cfEndExclusive: endExclusive,
    retentionLimited,
    beyondRetentionOnly,
  };
}

export function normalizeAnalyticsHostnames(rawHostnames: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of rawHostnames) {
    const cleaned = item.trim().toLowerCase().split(":")[0] ?? "";
    if (!cleaned || !HOSTNAME_RE.test(cleaned)) continue;
    if (seen.has(cleaned)) continue;
    seen.add(cleaned);
    out.push(cleaned);
    if (out.length >= 20) break;
  }
  return out;
}

export function normalizeReferrerSource(
  rawRefererHost: string | null | undefined,
  ownHostnames: string[],
): string {
  const cleaned = (rawRefererHost ?? "")
    .trim()
    .toLowerCase()
    .replace(/\.+$/, "");
  if (!cleaned) return "Direct";
  const ownSet = new Set(ownHostnames.map((h) => h.toLowerCase()));
  if (ownSet.has(cleaned)) return "Direct";
  const bare = cleaned.startsWith("www.") ? cleaned.slice(4) : cleaned;
  if (!bare || ownSet.has(bare)) return "Direct";
  if (bare === "t.co" || bare === "twitter.com") return "x.com";
  if (bare === "l.instagram.com") return "instagram.com";
  if (bare === "l.facebook.com" || bare === "lm.facebook.com" || bare === "m.facebook.com") {
    return "facebook.com";
  }
  if (bare === "lnkd.in") return "linkedin.com";
  if (bare === "youtu.be") return "youtube.com";
  return bare;
}

function normalizeDeviceLabel(rawDevice: string | null | undefined): string {
  const cleaned = (rawDevice ?? "").trim().toLowerCase();
  if (!cleaned) return "Other";
  if (cleaned === "desktop") return "Desktop";
  if (cleaned === "mobile") return "Mobile";
  if (cleaned === "tablet") return "Tablet";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function isInternalPagePath(path: string): boolean {
  return INTERNAL_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));
}

function isoDayOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function shiftUtcDays(base: Date, deltaDays: number): Date {
  const copy = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()));
  copy.setUTCDate(copy.getUTCDate() + deltaDays);
  return copy;
}

function emptyResult(
  range: SiteAnalyticsRange,
  windowDays: number,
  from: string,
  to: string,
  hostnames: string[],
  errorCode?: string,
  errorMessage?: string,
  retentionLimited?: boolean,
): CloudflareSiteAnalytics {
  return {
    ok: !errorCode,
    source: "cloudflare",
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
    ...(errorCode ? { errorCode } : {}),
    ...(errorMessage ? { errorMessage } : {}),
  };
}

export async function resolveCloudflareZoneId(input: {
  apiToken: string;
  rootDomain?: string;
  explicitZoneId?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<string | null> {
  const explicit = (input.explicitZoneId ?? "").trim();
  if (explicit) return explicit;

  const zoneDomain = (input.rootDomain ?? "get-on.tech").trim().toLowerCase();
  if (!zoneDomain) return null;

  const cached = zoneIdCache.get(zoneDomain);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.id;
  }

  const fetchImpl = input.fetchImpl ?? fetch;
  try {
    const res = await fetchImpl(
      `https://api.cloudflare.com/client/v4/zones?name=${encodeURIComponent(zoneDomain)}&status=active&per_page=1`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${input.apiToken}`,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(input.timeoutMs ?? 8000),
      },
    );
    if (!res.ok) return null;
    const json = (await res.json().catch(() => null)) as {
      success?: boolean;
      result?: Array<{ id?: string }>;
    } | null;
    const zoneId = json?.success !== false ? json?.result?.[0]?.id?.trim() : undefined;
    if (!zoneId) return null;
    zoneIdCache.set(zoneDomain, {
      id: zoneId,
      expiresAt: Date.now() + ZONE_CACHE_TTL_MS,
    });
    return zoneId;
  } catch {
    return null;
  }
}

const SITE_VISITOR_GRAPHQL = `
query SiteVisitorAnalytics(
  $zoneTag: String!
  $filter: ZoneHttpRequestsAdaptiveGroupsFilter_InputObject
  $dailyFilter: ZoneHttpRequestsAdaptiveGroupsFilter_InputObject
) {
  viewer {
    zones(filter: { zoneTag: $zoneTag }) {
      daily: httpRequestsAdaptiveGroups(limit: 100, filter: $dailyFilter) {
        count
        sum {
          visits
        }
        dimensions {
          date
        }
      }
      countries: httpRequestsAdaptiveGroups(
        limit: 30
        filter: $filter
        orderBy: [sum_visits_DESC]
      ) {
        count
        sum {
          visits
        }
        dimensions {
          clientCountryName
        }
      }
      referrers: httpRequestsAdaptiveGroups(
        limit: 30
        filter: $filter
        orderBy: [sum_visits_DESC]
      ) {
        count
        sum {
          visits
        }
        dimensions {
          clientRefererHost
        }
      }
      pages: httpRequestsAdaptiveGroups(
        limit: 50
        filter: $filter
        orderBy: [count_DESC]
      ) {
        count
        sum {
          visits
        }
        dimensions {
          clientRequestPath
        }
      }
      devices: httpRequestsAdaptiveGroups(
        limit: 10
        filter: $filter
        orderBy: [sum_visits_DESC]
      ) {
        count
        sum {
          visits
        }
        dimensions {
          clientDeviceType
        }
      }
    }
  }
}
`.trim();

type GraphqlGroupRow = {
  count?: number;
  sum?: { visits?: number };
  dimensions?: {
    date?: string;
    clientCountryName?: string;
    clientRefererHost?: string;
    clientRequestPath?: string;
    clientDeviceType?: string;
  };
};

type GraphqlZoneNode = {
  daily?: GraphqlGroupRow[];
  countries?: GraphqlGroupRow[];
  referrers?: GraphqlGroupRow[];
  pages?: GraphqlGroupRow[];
  devices?: GraphqlGroupRow[];
};

export async function fetchCloudflareSiteAnalytics(
  input: FetchCloudflareSiteAnalyticsInput,
): Promise<CloudflareSiteAnalytics> {
  const now = input.now ?? new Date();
  const resolvedWindow = resolveAnalyticsDateWindow({
    range: input.range,
    from: input.from,
    to: input.to,
    now,
  });
  const hostnames = normalizeAnalyticsHostnames(input.hostnames);
  if (!resolvedWindow.ok) {
    const todayIso = isoDayOf(now);
    return emptyResult(
      "custom",
      0,
      todayIso,
      todayIso,
      hostnames,
      resolvedWindow.errorCode,
      resolvedWindow.errorMessage,
    );
  }

  const {
    range,
    from,
    to,
    windowDays,
    endExclusive,
    cfStartDate,
    cfEndExclusive,
    retentionLimited,
    beyondRetentionOnly,
  } = resolvedWindow;
  const apiToken = (input.apiToken ?? "").trim();

  if (hostnames.length === 0) {
    return emptyResult(
      range,
      windowDays,
      from,
      to,
      hostnames,
      "NO_HOSTNAMES",
      "No site hostnames to query.",
      retentionLimited,
    );
  }
  if (!apiToken) {
    return emptyResult(
      range,
      windowDays,
      from,
      to,
      hostnames,
      "ANALYTICS_NOT_CONFIGURED",
      "Cloudflare analytics token is not configured.",
      retentionLimited,
    );
  }

  const fetchImpl = input.fetchImpl ?? fetch;
  const timeoutMs = input.timeoutMs ?? 10_000;
  const zoneId = await resolveCloudflareZoneId({
    apiToken,
    explicitZoneId: input.zoneId,
    rootDomain: input.rootDomain,
    fetchImpl,
    timeoutMs: Math.min(timeoutMs, 6_000),
  });
  if (!zoneId) {
    return emptyResult(
      range,
      windowDays,
      from,
      to,
      hostnames,
      "ZONE_NOT_CONFIGURED",
      "Cloudflare zone ID could not be resolved.",
      retentionLimited,
    );
  }

  if (beyondRetentionOnly) {
    return emptyResult(
      range,
      windowDays,
      from,
      to,
      hostnames,
      undefined,
      undefined,
      true,
    );
  }

  const cfSpanDays = Math.max(
    1,
    Math.round((cfEndExclusive.getTime() - cfStartDate.getTime()) / 86_400_000),
  );
  const comparePrevious =
    !retentionLimited &&
    (range === "7d" || (range === "custom" && windowDays <= 14));
  const previousStartDate = shiftUtcDays(cfStartDate, -windowDays);
  const earliestAllowed = shiftUtcDays(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())), -29);
  const canComparePrevious =
    comparePrevious && previousStartDate.getTime() >= earliestAllowed.getTime();
  const dailyStartDate = canComparePrevious ? previousStartDate : cfStartDate;

  const currentStartDay = isoDayOf(cfStartDate);
  const previousStartDay = isoDayOf(dailyStartDate);
  const endDayInclusive = to;

  const filter = {
    datetime_geq: cfStartDate.toISOString(),
    datetime_lt: cfEndExclusive.toISOString(),
    clientRequestHTTPHost_in: hostnames,
    requestSource: "eyeball",
    edgeResponseContentTypeName: "html",
  };
  const dailyFilter = {
    datetime_geq: dailyStartDate.toISOString(),
    datetime_lt: cfEndExclusive.toISOString(),
    clientRequestHTTPHost_in: hostnames,
    requestSource: "eyeball",
    edgeResponseContentTypeName: "html",
  };

  let response: Response;
  try {
    response = await fetchImpl("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: SITE_VISITOR_GRAPHQL,
        variables: {
          zoneTag: zoneId,
          filter,
          dailyFilter,
        },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    return emptyResult(
      range,
      windowDays,
      from,
      to,
      hostnames,
      "CLOUDFLARE_UNREACHABLE",
      "Could not reach Cloudflare Analytics.",
      retentionLimited,
    );
  }

  const payload = (await response.json().catch(() => null)) as {
    data?: { viewer?: { zones?: GraphqlZoneNode[] } };
    errors?: Array<{ message?: string; extensions?: { code?: string } }>;
  } | null;

  if (!response.ok || (payload?.errors && payload.errors.length > 0)) {
    const firstMsg = payload?.errors?.[0]?.message ?? `HTTP ${response.status}`;
    const lower = firstMsg.toLowerCase();
    const isAuth =
      response.status === 401 ||
      response.status === 403 ||
      lower.includes("not authorized") ||
      lower.includes("authentication") ||
      lower.includes("does not have access");
    return emptyResult(
      range,
      windowDays,
      from,
      to,
      hostnames,
      isAuth ? "CLOUDFLARE_UNAUTHORIZED" : "CLOUDFLARE_GRAPHQL_ERROR",
      isAuth
        ? "Cloudflare token needs Zone Analytics Read access."
        : "Cloudflare Analytics query could not be completed.",
      retentionLimited,
    );
  }

  const zone = payload?.data?.viewer?.zones?.[0];
  if (!zone) {
    return emptyResult(range, windowDays, from, to, hostnames, undefined, undefined, retentionLimited);
  }

  const dailyBuckets = new Map<string, { visitors: number; views: number }>();
  for (let i = 0; i < cfSpanDays; i += 1) {
    const day = isoDayOf(shiftUtcDays(cfStartDate, i));
    dailyBuckets.set(day, { visitors: 0, views: 0 });
  }

  let totalVisitors = 0;
  let totalViews = 0;
  let previousVisitors = canComparePrevious ? 0 : null;
  let previousViews = canComparePrevious ? 0 : null;

  for (const row of zone.daily ?? []) {
    const day = String(row.dimensions?.date ?? "").slice(0, 10);
    if (!day) continue;
    const views = Number(row.count ?? 0) || 0;
    const visitors = Number(row.sum?.visits ?? 0) || 0;
    if (day >= currentStartDay && day <= endDayInclusive) {
      const existing = dailyBuckets.get(day) ?? { visitors: 0, views: 0 };
      existing.visitors += visitors;
      existing.views += views;
      dailyBuckets.set(day, existing);
      totalVisitors += visitors;
      totalViews += views;
    } else if (canComparePrevious && day >= previousStartDay && day < currentStartDay) {
      previousVisitors = (previousVisitors ?? 0) + visitors;
      previousViews = (previousViews ?? 0) + views;
    }
  }

  const daily: SiteDailyPoint[] = [...dailyBuckets.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([day, val]) => ({
      day,
      visitors: val.visitors,
      views: val.views,
    }));

  const countryMap = new Map<string, SiteCountryPoint>();
  for (const row of zone.countries ?? []) {
    const { code, name } = countryNameFor(String(row.dimensions?.clientCountryName ?? ""));
    const views = Number(row.count ?? 0) || 0;
    const visitors = Number(row.sum?.visits ?? 0) || 0;
    if (views <= 0 && visitors <= 0) continue;
    const prev = countryMap.get(code) ?? { code, name, visitors: 0, views: 0 };
    prev.visitors += visitors;
    prev.views += views;
    countryMap.set(code, prev);
  }
  const countries = [...countryMap.values()]
    .sort((a, b) => b.visitors - a.visitors || b.views - a.views)
    .slice(0, 15);

  const referrerMap = new Map<string, SiteReferrerPoint>();
  for (const row of zone.referrers ?? []) {
    const source = normalizeReferrerSource(row.dimensions?.clientRefererHost, hostnames);
    const views = Number(row.count ?? 0) || 0;
    const visitors = Number(row.sum?.visits ?? 0) || 0;
    if (views <= 0 && visitors <= 0) continue;
    const prev = referrerMap.get(source) ?? { source, visitors: 0, views: 0 };
    prev.visitors += visitors;
    prev.views += views;
    referrerMap.set(source, prev);
  }
  const referrers = [...referrerMap.values()]
    .sort((a, b) => b.visitors - a.visitors || b.views - a.views)
    .slice(0, 15);

  const pageMap = new Map<string, SitePagePoint>();
  for (const row of zone.pages ?? []) {
    const path = String(row.dimensions?.clientRequestPath ?? "/").trim() || "/";
    if (isInternalPagePath(path)) continue;
    const views = Number(row.count ?? 0) || 0;
    const visitors = Number(row.sum?.visits ?? 0) || 0;
    if (views <= 0 && visitors <= 0) continue;
    const prev = pageMap.get(path) ?? { path, visitors: 0, views: 0 };
    prev.visitors += visitors;
    prev.views += views;
    pageMap.set(path, prev);
  }
  const pages = [...pageMap.values()]
    .sort((a, b) => b.views - a.views || b.visitors - a.visitors)
    .slice(0, 15);

  const deviceMap = new Map<string, SiteDevicePoint>();
  for (const row of zone.devices ?? []) {
    const device = normalizeDeviceLabel(row.dimensions?.clientDeviceType);
    const views = Number(row.count ?? 0) || 0;
    const visitors = Number(row.sum?.visits ?? 0) || 0;
    if (views <= 0 && visitors <= 0) continue;
    const prev = deviceMap.get(device) ?? { device, visitors: 0, views: 0 };
    prev.visitors += visitors;
    prev.views += views;
    deviceMap.set(device, prev);
  }
  const devices = [...deviceMap.values()].sort(
    (a, b) => b.visitors - a.visitors || b.views - a.views,
  );

  // Fallback totals if daily groups had none while breakdown groups had data
  if (totalViews === 0 && totalVisitors === 0) {
    totalViews = countries.reduce((sum, item) => sum + item.views, 0);
    totalVisitors = countries.reduce((sum, item) => sum + item.visitors, 0);
  }

  return {
    ok: true,
    source: "cloudflare",
    range,
    windowDays,
    from,
    to,
    ...(retentionLimited ? { retentionLimited: true } : {}),
    visitors: totalVisitors,
    views: totalViews,
    previousVisitors,
    previousViews,
    daily,
    countries,
    referrers,
    pages,
    devices,
    hostnames,
  };
}
