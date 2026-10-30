export type SparklineTrend = "up" | "down" | "steady" | "new" | "collecting";

export type SparklineResult = {
  projectId: string;
  points: number[];
  trend: SparklineTrend;
};

type StatsResponse = {
  daily?: Array<{
    day?: string;
    views?: number | null;
  }>;
};

function computeTrend(points: number[]): SparklineTrend {
  if (points.length === 0) return "collecting";
  if (points.length === 1) return points[0] > 0 ? "new" : "collecting";

  const first = points[0];
  const last = points[points.length - 1];

  if (first === 0 && last > 0) return "new";
  if (last > first) return "up";
  if (last < first) return "down";
  return "steady";
}

export async function getSparklines(
  projectIds: string[],
  days: number
): Promise<SparklineResult[]> {
  return Promise.all(
    projectIds.map(async (projectId) => {
      try {
        const response = await fetch(
          `/api/projects/${projectId}/stats?range=${days}d`,
          { cache: "no-store" }
        );

        if (!response.ok) {
          return { projectId, points: [], trend: "collecting" as const };
        }

        const data = (await response.json()) as StatsResponse;
        const points = [...(data.daily ?? [])]
          .reverse()
          .map((row) => row.views ?? 0);

        return { projectId, points, trend: computeTrend(points) };
      } catch {
        return { projectId, points: [], trend: "collecting" as const };
      }
    })
  );
}
