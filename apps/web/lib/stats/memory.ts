import { StatsRange, StatsStore, StatsSummary } from "./store";

export class MemoryStatsStore implements StatsStore {
  async getSummary(_projectId: string, _statsSiteKey: string, _range: StatsRange, _tz: string): Promise<StatsSummary> {
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
