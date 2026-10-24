export type StatsRange = "7d" | "30d" | "90d";

export type StatsSummary = {
  views: number;
  visitors: number;
  previousViews: number;
  previousVisitors: number;
  changeViewsPct: number | null;
  changeVisitorsPct: number | null;
};

export interface StatsStore {
  getSummary(projectId: string, statsSiteKey: string, range: StatsRange, tz: string): Promise<StatsSummary>;
}
