import { beforeEach, describe, expect, it } from "vitest";
import {
  QUICK_FIND_TTL_MS,
  clearQuickFindCache,
  getCachedQuickFind,
  invalidateQuickFindCache,
  quickFindKey,
  setCachedQuickFind,
} from "@/lib/quick-find-cache";

const payload = {
  websites: [{ id: "w1", title: "Rose Bakery", href: "/dashboard/projects/w1", icon: "website" as const }],
  pages: [],
};

describe("quick find cache", () => {
  beforeEach(() => {
    clearQuickFindCache();
  });

  it("returns the payload that was cached", () => {
    const key = quickFindKey("team-1");
    setCachedQuickFind(key, payload);
    expect(getCachedQuickFind(key)).toEqual(payload);
  });

  it("keeps the payload for 60 seconds", () => {
    const key = quickFindKey("team-1");
    setCachedQuickFind(key, payload, 1_000);
    expect(getCachedQuickFind(key, 1_000 + QUICK_FIND_TTL_MS - 1)).toEqual(payload);
  });

  it("drops the payload once it is older than 60 seconds", () => {
    const key = quickFindKey("team-1");
    setCachedQuickFind(key, payload, 1_000);
    expect(getCachedQuickFind(key, 1_000 + QUICK_FIND_TTL_MS)).toBeNull();
  });

  it("keeps the team and the project apart", () => {
    const team = quickFindKey("team-1");
    const project = quickFindKey("team-1", "project-1");
    setCachedQuickFind(team, payload);
    setCachedQuickFind(project, payload);
    expect(getCachedQuickFind(team)).toEqual(payload);
    expect(getCachedQuickFind(project)).toEqual(payload);
  });

  it("drops the results of a team after a change", () => {
    const team = quickFindKey("team-1");
    const project = quickFindKey("team-1", "project-1");
    const other = quickFindKey("team-2");
    setCachedQuickFind(team, payload);
    setCachedQuickFind(project, payload);
    setCachedQuickFind(other, payload);

    invalidateQuickFindCache("team-1");

    expect(getCachedQuickFind(team)).toBeNull();
    expect(getCachedQuickFind(project)).toBeNull();
    expect(getCachedQuickFind(other)).toEqual(payload);
  });

  it("drops everything when no team is given", () => {
    setCachedQuickFind(quickFindKey("team-1"), payload);
    setCachedQuickFind(quickFindKey("team-2"), payload);
    invalidateQuickFindCache();
    expect(getCachedQuickFind(quickFindKey("team-1"))).toBeNull();
    expect(getCachedQuickFind(quickFindKey("team-2"))).toBeNull();
  });
});
