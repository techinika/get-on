export type DailyVisitorPoint = {
  day: string;
  visitors: number;
  views: number;
};

export type VisitorTrendPoint = {
  day: string;
  label: string;
  visitors: number;
  views: number;
};

export type SevenDayTrendPoint = VisitorTrendPoint;

const ISO_DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseUtcDay(raw: string | undefined): Date | null {
  if (!raw || !ISO_DAY_RE.test(raw)) return null;
  const parsed = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  if (parsed.toISOString().slice(0, 10) !== raw) return null;
  return parsed;
}

export function formatDayShortUtc(day: string): string {
  const parsed = new Date(`${day.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return day;
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Builds a continuous chronological series of visitor and view counts for either
 * an explicit [from, to] UTC date window (up to 90 days) or a trailing `days` window.
 */
export function buildVisitorTrendSeries(
  daily: DailyVisitorPoint[],
  options: {
    from?: string;
    to?: string;
    days?: number;
    now?: Date;
  } = {},
): VisitorTrendPoint[] {
  const byDay = new Map<string, { visitors: number; views: number }>();
  for (const row of daily) {
    const day = String(row.day ?? "").slice(0, 10);
    if (!ISO_DAY_RE.test(day)) continue;
    const prev = byDay.get(day) ?? { visitors: 0, views: 0 };
    prev.visitors += Math.max(0, Number(row.visitors ?? 0) || 0);
    prev.views += Math.max(0, Number(row.views ?? 0) || 0);
    byDay.set(day, prev);
  }

  const now = options.now ?? new Date();
  const parsedFrom = parseUtcDay(options.from);
  const parsedTo = parseUtcDay(options.to);

  let startUtc: Date;
  let totalDays: number;

  if (parsedFrom && parsedTo && parsedFrom.getTime() <= parsedTo.getTime()) {
    const span = Math.round((parsedTo.getTime() - parsedFrom.getTime()) / 86_400_000) + 1;
    totalDays = Math.min(90, Math.max(1, span));
    startUtc = parsedFrom;
  } else {
    totalDays = Math.min(90, Math.max(1, Math.round(options.days ?? 7)));
    const endUtc =
      parsedTo ??
      new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    startUtc = new Date(endUtc);
    startUtc.setUTCDate(endUtc.getUTCDate() - (totalDays - 1));
  }

  const points: VisitorTrendPoint[] = [];
  for (let offset = 0; offset < totalDays; offset += 1) {
    const d = new Date(startUtc);
    d.setUTCDate(startUtc.getUTCDate() + offset);
    const day = d.toISOString().slice(0, 10);
    const metrics = byDay.get(day) ?? { visitors: 0, views: 0 };
    points.push({
      day,
      label: formatDayShortUtc(day),
      visitors: metrics.visitors,
      views: metrics.views,
    });
  }
  return points;
}

/**
 * Builds a continuous 7-day chronological series of visitor and view counts
 * ending on the reference date (defaulting to today UTC).
 */
export function buildSevenDayVisitorTrend(
  daily: DailyVisitorPoint[],
  now: Date = new Date(),
): SevenDayTrendPoint[] {
  return buildVisitorTrendSeries(daily, { days: 7, now });
}
