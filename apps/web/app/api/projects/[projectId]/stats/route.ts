import { NextResponse } from "next/server";
import {
  normalizeAnalyticsHostnames,
  normalizeAnalyticsRange,
  type SiteDailyPoint,
} from "@get-on/site-server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentTeam } from "@/lib/team";
import { readPublishConfig, siteHostname } from "@/lib/publishing/config";
import { getCloudflareSiteAnalytics } from "@/lib/stats/cloudflare";

type DailyStatRow = {
  day: string;
  views: number | null;
  visitors: number | null;
};

type DomainRow = {
  id: string;
  apex: string | null;
};

type DomainHostnameRow = {
  hostname: string | null;
};

function mergeDailySeries(
  cfDaily: SiteDailyPoint[],
  dbDaily: SiteDailyPoint[],
  limitDays: number,
): SiteDailyPoint[] {
  const byDay = new Map<string, SiteDailyPoint>();
  for (const row of dbDaily) {
    const day = row.day.slice(0, 10);
    if (!day) continue;
    byDay.set(day, { day, visitors: row.visitors, views: row.views });
  }
  for (const row of cfDaily) {
    const day = row.day.slice(0, 10);
    if (!day) continue;
    const prev = byDay.get(day);
    if (!prev || row.views > 0 || row.visitors > 0 || cfDaily.some((item) => item.views > 0 || item.visitors > 0)) {
      byDay.set(day, { day, visitors: row.visitors, views: row.views });
    }
  }
  return [...byDay.values()]
    .sort((a, b) => b.day.localeCompare(a.day))
    .slice(0, limitDays);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const current = await getCurrentTeam();
  if (!current) {
    return NextResponse.json({ error: "NOT_AUTHENTICATED" }, { status: 401 });
  }

  const url = new URL(request.url);
  const range = normalizeAnalyticsRange(url.searchParams.get("range"));
  const limitDays = range === "7d" ? 7 : range === "30d" ? 30 : 90;

  const supabase = await createClient();
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, subdomain, primary_host, status")
    .eq("id", projectId)
    .eq("team_id", current.team.teamId)
    .maybeSingle();

  if (projectError || !project) {
    return NextResponse.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
  }

  const [{ data: domainRows }, { data: settingsRow }] = await Promise.all([
    supabase
      .from("domains")
      .select("id, apex")
      .eq("project_id", projectId)
      .neq("status", "removed"),
    supabase
      .from("project_settings")
      .select("stats_enabled")
      .eq("project_id", projectId)
      .maybeSingle(),
  ]);

  if (settingsRow?.stats_enabled === false) {
    return NextResponse.json({
      ok: true,
      source: "disabled",
      range,
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
      status: "disabled",
    });
  }

  const publishConfig = readPublishConfig();
  const candidateHostnames: string[] = [
    siteHostname(publishConfig, String(project.subdomain)),
  ];
  if (typeof project.primary_host === "string" && project.primary_host.trim()) {
    candidateHostnames.push(project.primary_host.trim());
  }

  const domains = (domainRows ?? []) as DomainRow[];
  const domainIds = domains.map((d) => d.id).filter(Boolean);
  if (domainIds.length > 0) {
    const { data: hostRows } = await supabase
      .from("domain_hostnames")
      .select("hostname")
      .in("domain_id", domainIds)
      .neq("status", "removed");
    for (const row of (hostRows ?? []) as DomainHostnameRow[]) {
      if (row.hostname) candidateHostnames.push(row.hostname);
    }
  }
  const hostnames = normalizeAnalyticsHostnames(candidateHostnames);

  const admin = createAdminClient();
  const cutoffDate = new Date();
  cutoffDate.setUTCDate(cutoffDate.getUTCDate() - (limitDays - 1));
  const cutoffIso = cutoffDate.toISOString().slice(0, 10);

  const [cfResult, dbRes] = await Promise.all([
    getCloudflareSiteAnalytics({
      hostnames,
      range,
      rootDomain: publishConfig.rootDomain,
    }),
    admin
      .from("site_stats_daily")
      .select("views, visitors, day")
      .eq("project_id", projectId)
      .gte("day", cutoffIso)
      .order("day", { ascending: false })
      .limit(limitDays),
  ]);

  const dbDaily: SiteDailyPoint[] =
    !dbRes.error && Array.isArray(dbRes.data)
      ? (dbRes.data as DailyStatRow[]).map((row) => ({
          day: String(row.day).slice(0, 10),
          views: Number(row.views ?? 0) || 0,
          visitors: Number(row.visitors ?? 0) || 0,
        }))
      : [];

  const dbViews = dbDaily.reduce((sum, row) => sum + row.views, 0);
  const dbVisitors = dbDaily.reduce((sum, row) => sum + row.visitors, 0);

  const cfHasTraffic = cfResult.ok && (cfResult.views > 0 || cfResult.visitors > 0);
  const useDbFallback = (!cfResult.ok || (!cfHasTraffic && (dbViews > 0 || dbVisitors > 0)));

  const daily = cfResult.ok
    ? mergeDailySeries(cfResult.daily, dbDaily, limitDays)
    : dbDaily;

  const views = useDbFallback
    ? dbViews
    : range === "90d"
      ? daily.reduce((sum, row) => sum + row.views, 0)
      : cfResult.views;
  const visitors = useDbFallback
    ? dbVisitors
    : range === "90d"
      ? daily.reduce((sum, row) => sum + row.visitors, 0)
      : cfResult.visitors;

  const source =
    cfHasTraffic && range === "90d" && dbDaily.length > 0
      ? "mixed"
      : cfResult.ok && !useDbFallback
        ? "cloudflare"
        : dbViews > 0 || dbVisitors > 0
          ? "edge-ingest"
          : cfResult.ok
            ? "cloudflare"
            : "unconfigured";

  const status =
    source === "cloudflare" || source === "mixed"
      ? `Synced from Cloudflare Analytics (${cfResult.via})`
      : source === "edge-ingest"
        ? "Edge visit log"
        : "Collecting";

  return NextResponse.json({
    ok: true,
    source,
    range,
    visitors,
    views,
    previousVisitors: cfResult.ok ? cfResult.previousVisitors : null,
    previousViews: cfResult.ok ? cfResult.previousViews : null,
    daily,
    countries: cfResult.ok ? cfResult.countries : [],
    referrers: cfResult.ok ? cfResult.referrers : [],
    pages: cfResult.ok ? cfResult.pages : [],
    devices: cfResult.ok ? cfResult.devices : [],
    hostnames,
    status,
    ...(cfResult.errorCode ? { cloudflareError: cfResult.errorCode, cloudflareNotice: cfResult.errorMessage } : {}),
  });
}