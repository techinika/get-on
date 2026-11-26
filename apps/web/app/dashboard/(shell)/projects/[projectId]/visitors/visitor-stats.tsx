"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Compass,
  Eye,
  FileText,
  Globe2,
  MonitorSmartphone,
  RefreshCw,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppCard } from "@/components/app/card";
import { InfoBox } from "@/components/app/info-box";
import { StatCard } from "@/components/app/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  buildSevenDayVisitorTrend,
  formatDayShortUtc,
  type SevenDayTrendPoint,
} from "@/lib/stats/trend";
import { cn } from "@/lib/utils";

type RangeOption = "7d" | "30d" | "90d";

type DailyRow = {
  day: string;
  visitors: number;
  views: number;
};

type CountryRow = {
  code: string;
  name: string;
  visitors: number;
  views: number;
};

type ReferrerRow = {
  source: string;
  visitors: number;
  views: number;
};

type PageRow = {
  path: string;
  visitors: number;
  views: number;
};

type DeviceRow = {
  device: string;
  visitors: number;
  views: number;
};

type StatsResponse = {
  ok?: boolean;
  source?: string;
  range?: RangeOption;
  visitors: number;
  views: number;
  previousVisitors?: number | null;
  previousViews?: number | null;
  daily?: DailyRow[];
  countries?: CountryRow[];
  referrers?: ReferrerRow[];
  pages?: PageRow[];
  devices?: DeviceRow[];
  hostnames?: string[];
  status?: string;
  cloudflareError?: string;
  cloudflareNotice?: string;
};

const RANGES: Array<{ value: RangeOption; label: string }> = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
];

function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-US").format(Math.max(0, Math.round(n)));
}

function pctChangeHint(current: number, previous: number | null | undefined): string | undefined {
  if (previous == null) return undefined;
  if (previous === 0) {
    return current > 0 ? "Up from 0 in the previous 7 days" : "Same as previous 7 days";
  }
  const delta = Math.round(((current - previous) / previous) * 100);
  if (delta > 0) return `+${delta}% vs previous 7 days`;
  if (delta < 0) return `${delta}% vs previous 7 days`;
  return "No change vs previous 7 days";
}

function sharePct(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((part / total) * 100)));
}

function TrendTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{
    name?: string | number;
    value?: number | string;
    dataKey?: string | number;
  }>;
  label?: string | number;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const visitorsEntry = payload.find((item) => item.dataKey === "visitors");
  const viewsEntry = payload.find((item) => item.dataKey === "views");

  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-md">
      <p className="font-semibold text-text">{String(label ?? "")}</p>
      {visitorsEntry ? (
        <p className="mt-1 tabular-nums text-text-muted">
          Visitors:{" "}
          <span className="font-semibold text-text">
            {formatNumber(Number(visitorsEntry.value ?? 0))}
          </span>
        </p>
      ) : null}
      {viewsEntry ? (
        <p className="tabular-nums text-text-muted">
          Views:{" "}
          <span className="font-semibold text-text">
            {formatNumber(Number(viewsEntry.value ?? 0))}
          </span>
        </p>
      ) : null}
    </div>
  );
}

function SevenDayVisitorTrendChart({
  daily,
  previousVisitors,
}: {
  daily: DailyRow[];
  previousVisitors?: number | null;
}) {
  const data = useMemo<SevenDayTrendPoint[]>(
    () => buildSevenDayVisitorTrend(daily),
    [daily],
  );
  const sevenDayTotal = useMemo(
    () => data.reduce((sum, item) => sum + item.visitors, 0),
    [data],
  );
  const trendHint = pctChangeHint(sevenDayTotal, previousVisitors);

  return (
    <AppCard className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp size={18} strokeWidth={1.75} className="text-primary" aria-hidden />
            <h3 className="text-[16px] font-semibold text-text">7-day visitor trend</h3>
          </div>
          <p className="mt-0.5 text-sm text-text-muted">
            {formatNumber(sevenDayTotal)} visitors over the last 7 days
            {trendHint ? ` · ${trendHint}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs text-text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-primary" aria-hidden />
            Daily visitors
          </span>
        </div>
      </div>

      <div
        className="mt-4 h-[220px] w-full"
        role="img"
        aria-label="7-day trend of website visitor counts"
      >
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 640, height: 220 }}>
          <AreaChart data={data} margin={{ top: 10, right: 12, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="gsVisitorsAreaFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.28} />
                <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="label"
              tick={{ fill: "var(--text-muted)", fontSize: 12 }}
              axisLine={{ stroke: "var(--border)" }}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: "var(--text-muted)", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={48}
            />
            <Tooltip content={<TrendTooltip />} />
            <Area
              type="monotone"
              dataKey="visitors"
              name="Visitors"
              stroke="var(--primary)"
              strokeWidth={2.5}
              fill="url(#gsVisitorsAreaFill)"
              activeDot={{ r: 5, fill: "var(--primary)", stroke: "var(--surface)", strokeWidth: 2 }}
              dot={{ r: 3, fill: "var(--primary)" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </AppCard>
  );
}

function RangeTrafficChart({ daily, rangeLabel }: { daily: DailyRow[]; rangeLabel: string }) {
  const data = useMemo(
    () =>
      [...daily].reverse().map((row) => ({
        day: row.day,
        label: formatDayShortUtc(row.day),
        visitors: row.visitors,
        views: row.views,
      })),
    [daily],
  );

  if (data.length === 0) return null;

  return (
    <AppCard className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-[16px] font-semibold text-text">Daily traffic ({rangeLabel})</h3>
          <p className="text-sm text-text-muted">Visitors and page views across the selected period</p>
        </div>
        <div className="flex items-center gap-4 text-xs text-text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-primary" aria-hidden />
            Visitors
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-primary/35" aria-hidden />
            Views
          </span>
        </div>
      </div>

      <div className="mt-4 h-[210px] w-full">
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 640, height: 210 }}>
          <BarChart data={data} margin={{ top: 10, right: 12, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="label"
              tick={{ fill: "var(--text-muted)", fontSize: 11 }}
              axisLine={{ stroke: "var(--border)" }}
              tickLine={false}
              minTickGap={24}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: "var(--text-muted)", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={48}
            />
            <Tooltip content={<TrendTooltip />} />
            <Bar dataKey="views" name="Views" fill="var(--primary)" fillOpacity={0.28} radius={[4, 4, 0, 0]} />
            <Bar dataKey="visitors" name="Visitors" fill="var(--primary)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </AppCard>
  );
}

export function VisitorStats({ projectId }: { projectId: string }) {
  const [range, setRange] = useState<RangeOption>("30d");
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  const requestKey = `${projectId}:${range}:${refreshTick}`;
  const loading = loadedKey !== requestKey;

  useEffect(() => {
    let cancelled = false;

    fetch(
      `/api/projects/${encodeURIComponent(projectId)}/stats?range=${range}`,
      { cache: "no-store" },
    )
      .then((response) => response.json() as Promise<StatsResponse>)
      .then((data) => {
        if (cancelled) return;
        setStats(data);
        setLoadedKey(requestKey);
      })
      .catch(() => {
        if (cancelled) return;
        setStats({
          visitors: 0,
          views: 0,
          daily: [],
          countries: [],
          referrers: [],
          pages: [],
          devices: [],
          status: "Could not load analytics",
        });
        setLoadedKey(requestKey);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId, range, requestKey]);

  const countries = stats?.countries ?? [];
  const referrers = stats?.referrers ?? [];
  const pages = stats?.pages ?? [];
  const devices = stats?.devices ?? [];
  const daily = stats?.daily ?? [];
  const hostnames = stats?.hostnames ?? [];

  const totalVisitors = stats?.visitors ?? 0;
  const totalViews = stats?.views ?? 0;
  const countryBasis = Math.max(
    1,
    countries.reduce((sum, item) => sum + (item.visitors || item.views), 0),
  );
  const referrerBasis = Math.max(
    1,
    referrers.reduce((sum, item) => sum + (item.visitors || item.views), 0),
  );
  const pageBasis = Math.max(
    1,
    pages.reduce((sum, item) => sum + item.views, 0),
  );
  const deviceBasis = Math.max(
    1,
    devices.reduce((sum, item) => sum + (item.visitors || item.views), 0),
  );

  const topCountry = countries[0] ? countries[0].name : "No data yet";
  const topReferrer = referrers[0] ? referrers[0].source : "No data yet";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Time range"
            className="inline-flex rounded-input border border-border bg-surface p-1"
          >
            {RANGES.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setRange(opt.value)}
                aria-pressed={range === opt.value}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  range === opt.value
                    ? "bg-primary text-on-primary"
                    : "text-text-muted hover:text-text",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {stats?.source === "cloudflare" || stats?.source === "mixed" ? (
            <Badge variant="live" dot>
              Cloudflare Analytics
            </Badge>
          ) : stats?.status ? (
            <Badge variant="draft">{stats.status}</Badge>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {hostnames.length > 0 ? (
            <span className="hidden text-xs text-text-muted sm:inline">
              {hostnames.join(", ")}
            </span>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            loading={loading}
            onClick={() => setRefreshTick((tick) => tick + 1)}
          >
            {!loading ? <RefreshCw size={15} strokeWidth={1.75} aria-hidden /> : null}
            Refresh
          </Button>
        </div>
      </div>

      {stats?.cloudflareNotice ? (
        <InfoBox variant="info">{stats.cloudflareNotice}</InfoBox>
      ) : null}

      {loading && !stats ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <AppCard key={index} className="h-[104px] animate-pulse bg-surface-muted p-4" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Visitors"
              value={formatNumber(totalVisitors)}
              icon={<Users size={18} strokeWidth={1.75} />}
              hint={pctChangeHint(totalVisitors, stats?.previousVisitors)}
            />
            <StatCard
              label="Page views"
              value={formatNumber(totalViews)}
              icon={<Eye size={18} strokeWidth={1.75} />}
              hint={pctChangeHint(totalViews, stats?.previousViews)}
            />
            <StatCard
              label="Top country"
              value={topCountry}
              icon={<Globe2 size={18} strokeWidth={1.75} />}
              hint={
                countries[0]
                  ? `${sharePct(countries[0].visitors || countries[0].views, countryBasis)}% of visitors`
                  : "Waiting for country data"
              }
            />
            <StatCard
              label="Top source"
              value={topReferrer}
              icon={<Compass size={18} strokeWidth={1.75} />}
              hint={
                referrers[0]
                  ? `${sharePct(referrers[0].visitors || referrers[0].views, referrerBasis)}% of traffic`
                  : "Waiting for referrer data"
              }
            />
          </div>

          <SevenDayVisitorTrendChart
            daily={daily}
            previousVisitors={stats?.previousVisitors}
          />

          {totalVisitors === 0 && totalViews === 0 ? (
            <AppCard className="p-6">
              <h3 className="text-[17px] font-semibold text-text">No visitors recorded yet</h3>
              <p className="mt-1.5 text-[15px] text-text-muted">
                As soon as people open your live website{hostnames[0] ? ` (${hostnames[0]})` : ""}, Cloudflare visits, countries, and referral sources will appear here.
              </p>
            </AppCard>
          ) : (
            <>
              {range !== "7d" ? (
                <RangeTrafficChart
                  daily={daily}
                  rangeLabel={range === "30d" ? "Last 30 days" : "Last 90 days"}
                />
              ) : null}

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <AppCard className="p-6">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h3 className="text-[16px] font-semibold text-text">
                        Where visitors come from (Countries)
                      </h3>
                      <p className="text-sm text-text-muted">
                        Geographic regions reaching your website via Cloudflare edge
                      </p>
                    </div>
                    <Globe2 size={18} className="shrink-0 text-text-muted" aria-hidden />
                  </div>

                  {countries.length === 0 ? (
                    <p className="mt-5 text-sm text-text-muted">
                      No country data available for this date range yet.
                    </p>
                  ) : (
                    <ul className="mt-5 flex flex-col gap-3.5">
                      {countries.map((item) => {
                        const metric = item.visitors || item.views;
                        const pct = sharePct(metric, countryBasis);
                        return (
                          <li key={item.code} className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between gap-3 text-sm">
                              <span className="flex items-center gap-2 font-medium text-text">
                                <span className="inline-flex min-w-7 items-center justify-center rounded bg-surface-muted px-1.5 py-0.5 text-[11px] font-semibold text-text-muted">
                                  {item.code}
                                </span>
                                {item.name}
                              </span>
                              <span className="tabular-nums text-text-muted">
                                {formatNumber(item.visitors)} visitors · {formatNumber(item.views)} views ({pct}%)
                              </span>
                            </div>
                            <Progress value={pct} label={`${item.name}: ${pct}%`} />
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </AppCard>

                <AppCard className="p-6">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h3 className="text-[16px] font-semibold text-text">
                        Where visitors come from (Sources)
                      </h3>
                      <p className="text-sm text-text-muted">
                        Referring websites, search engines, social links, or direct visits
                      </p>
                    </div>
                    <Compass size={18} className="shrink-0 text-text-muted" aria-hidden />
                  </div>

                  {referrers.length === 0 ? (
                    <p className="mt-5 text-sm text-text-muted">
                      No referral source data available for this date range yet.
                    </p>
                  ) : (
                    <ul className="mt-5 flex flex-col gap-3.5">
                      {referrers.map((item) => {
                        const metric = item.visitors || item.views;
                        const pct = sharePct(metric, referrerBasis);
                        return (
                          <li key={item.source} className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between gap-3 text-sm">
                              <span className="truncate font-medium text-text">{item.source}</span>
                              <span className="shrink-0 tabular-nums text-text-muted">
                                {formatNumber(item.visitors)} visitors · {formatNumber(item.views)} views ({pct}%)
                              </span>
                            </div>
                            <Progress value={pct} label={`${item.source}: ${pct}%`} />
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </AppCard>
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <AppCard className="p-6">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h3 className="text-[16px] font-semibold text-text">Most visited pages</h3>
                      <p className="text-sm text-text-muted">Top HTML paths on your site</p>
                    </div>
                    <FileText size={18} className="shrink-0 text-text-muted" aria-hidden />
                  </div>

                  {pages.length === 0 ? (
                    <p className="mt-5 text-sm text-text-muted">No page breakdown recorded yet.</p>
                  ) : (
                    <ul className="mt-5 flex flex-col gap-3">
                      {pages.map((item) => {
                        const pct = sharePct(item.views, pageBasis);
                        return (
                          <li key={item.path} className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between gap-3 text-sm">
                              <span className="truncate font-mono text-[13px] text-text">
                                {item.path}
                              </span>
                              <span className="shrink-0 tabular-nums text-text-muted">
                                {formatNumber(item.views)} views ({pct}%)
                              </span>
                            </div>
                            <Progress value={pct} label={`${item.path}: ${pct}%`} />
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </AppCard>

                <AppCard className="p-6">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h3 className="text-[16px] font-semibold text-text">Devices</h3>
                      <p className="text-sm text-text-muted">Desktop, mobile, and tablet split</p>
                    </div>
                    <MonitorSmartphone size={18} className="shrink-0 text-text-muted" aria-hidden />
                  </div>

                  {devices.length === 0 ? (
                    <p className="mt-5 text-sm text-text-muted">No device breakdown recorded yet.</p>
                  ) : (
                    <ul className="mt-5 flex flex-col gap-3.5">
                      {devices.map((item) => {
                        const metric = item.visitors || item.views;
                        const pct = sharePct(metric, deviceBasis);
                        return (
                          <li key={item.device} className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between gap-3 text-sm">
                              <span className="font-medium text-text">{item.device}</span>
                              <span className="tabular-nums text-text-muted">
                                {formatNumber(item.visitors)} visitors · {pct}%
                              </span>
                            </div>
                            <Progress value={pct} label={`${item.device}: ${pct}%`} />
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </AppCard>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
