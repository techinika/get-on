export type DailyVisitorPoint = {
  day: string;
  visitors: number;
  views: number;
};

export type SevenDayTrendPoint = {
  day: string;
  label: string;
  visitors: number;
  views: number;
};

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
 * Builds a continuous 7-day chronological series of visitor and view counts
 * ending on the reference date (defaulting to today UTC).
 */
export function buildSevenDayVisitorTrend(
  daily: DailyVisitorPoint[],
  now: Date = new Date(),
): SevenDayTrendPoint[] {
  const byDay = new Map<string, { visitors: number; views: number }>();
  for (const row of daily) {
    const day = String(row.day ?? "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    const prev = byDay.get(day) ?? { visitors: 0, views: 0 };
    prev.visitors += Math.max(0, Number(row.visitors ?? 0) || 0);
    prev.views += Math.max(0, Number(row.views ?? 0) || 0);
    byDay.set(day, prev);
  }

  const endUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const points: SevenDayTrendPoint[] = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const d = new Date(endUtc);
    d.setUTCDate(endUtc.getUTCDate() - offset);
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
