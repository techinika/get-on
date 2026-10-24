import { StatsRange, StatsStore, StatsSummary } from "./store";

export class MemoryStatsStore implements StatsStore {
  async getSummary(projectId: string, statsSiteKey: string, range: StatsRange, tz: string): Promise<StatsSummary> {
    void projectId;
    void statsSiteKey;
    void range;
    void tz;
    return {
      views: 0,
      visitors: 0,
      previousViews: 0,
      previousVisitors: 0,
      changeViewsPct: null,
      changeVisitorsPct: null,
    };
  }
}

export const memoryStatsStore = new MemoryStatsStore();
