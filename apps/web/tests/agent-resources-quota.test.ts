import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const mockState = {
  planId: "enterprise" as "free" | "basic" | "pro" | "enterprise",
  role: "owner" as const,
  quotaRpcData: {
    active_sites: 4,
    deleted_pending: 0,
    max_websites: null,
    max_members: null,
    max_deleted_pending: 3,
  } as unknown,
  aiBalanceData: { total: 4950 } as unknown,
  teamDayCount: 0,
  userHourCount: 0,
  subdomainAvailable: true,
  websites: [
    { id: "11111111-1111-4111-8111-111111111111", name: "Main Site", subdomain: "main-site", status: "published" },
    { id: "22222222-2222-4222-8222-222222222222", name: "Shop Site", subdomain: "shop-site", status: "draft" },
  ],
  pages: [
    { id: "33333333-3333-4333-8333-333333333333", title: "Home", path: "/", is_homepage: true, revision: 2 },
    { id: "44444444-4444-4444-8444-444444444444", title: "Pricing", path: "/pricing", is_homepage: false, revision: 1 },
  ],
  conversationProjectId: "11111111-1111-4111-8111-111111111111" as string | null,
};

function makeAdminMock() {
  return {
    rpc: async (fn: string) => {
      if (fn === "team_quota_usage") {
        return { data: mockState.quotaRpcData, error: null };
      }
      if (fn === "is_subdomain_available") {
        return { data: mockState.subdomainAvailable, error: null };
      }
      if (fn === "ai_balance") {
        return { data: mockState.aiBalanceData, error: null };
      }
      return { data: null, error: null };
    },
    from: (table: string) => {
      if (table === "agent_conversations") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: { project_id: mockState.conversationProjectId },
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === "pages") {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: async () => ({ data: mockState.pages, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === "projects") {
        return {
          select: (_cols: string, opts?: { count?: string; head?: boolean }) => {
            if (opts?.count === "exact") {
              const filters = new Set<string>();
              const chain = {
                eq: (col: string) => {
                  filters.add(col);
                  return chain;
                },
                is: () => Promise.resolve({ count: mockState.websites.length, error: null }),
                gte: () =>
                  Promise.resolve({
                    count: filters.has("created_by")
                      ? mockState.userHourCount
                      : mockState.teamDayCount,
                    error: null,
                  }),
              };
              return chain;
            }
            return {
              eq: () => ({
                is: () => ({
                  order: () => ({
                    limit: async () => ({ data: mockState.websites, error: null }),
                  }),
                }),
              }),
            };
          },
        };
      }
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      };
    },
  };
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => makeAdminMock(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => makeAdminMock(),
}));

vi.mock("@/lib/agent/auth", () => ({
  getAgentActor: async () => ({
    userId: "user-1",
    teamId: "team-1",
    teamName: "Enterprise Team",
    role: mockState.role,
    planId: mockState.planId,
  }),
  canUseAssistant: () => true,
}));

import {
  normalizeQuotaRow,
  reconcileQuotaWithPlan,
  resolveEffectiveQuota,
} from "@/lib/quotas";
import { validateCreateSiteInput } from "@/lib/agent/site-draft";
import { buildAgentPrompt } from "@/lib/agent/prompt";
import { getContext, getUsage, listTemplates } from "@/lib/agent/tools";

describe("quota normalization and Enterprise plan limits", () => {
  beforeEach(() => {
    mockState.planId = "enterprise";
    mockState.quotaRpcData = {
      active_sites: 4,
      deleted_pending: 0,
      max_websites: null,
      max_members: null,
      max_deleted_pending: 3,
    };
    mockState.aiBalanceData = { total: 4950 };
    mockState.teamDayCount = 0;
    mockState.userHourCount = 0;
    mockState.subdomainAvailable = true;
    mockState.conversationProjectId = "11111111-1111-4111-8111-111111111111";
  });

  it("preserves null unlimited limits instead of coercing them to zero", () => {
    const row = normalizeQuotaRow({
      active_sites: 6,
      deleted_pending: 1,
      max_websites: null,
      max_members: null,
      max_deleted_pending: 5,
    });
    expect(row).toEqual({
      active_sites: 6,
      deleted_pending: 1,
      max_websites: null,
      max_members: null,
      max_deleted_pending: 5,
    });

    const fromArray = normalizeQuotaRow([
      { active_sites: "3", deleted_pending: 0, max_websites: null, max_members: undefined },
    ]);
    expect(fromArray?.max_websites).toBeNull();
    expect(fromArray?.max_members).toBeNull();
    expect(fromArray?.active_sites).toBe(3);
  });

  it("reconciles stale SQL quota rows against the resolved Enterprise plan", () => {
    const staleFreeQuota = normalizeQuotaRow({
      active_sites: 4,
      deleted_pending: 0,
      max_websites: 1,
      max_members: 1,
      max_deleted_pending: 0,
    });
    const reconciled = reconcileQuotaWithPlan(staleFreeQuota, "enterprise");
    expect(reconciled.max_websites).toBeNull();
    expect(reconciled.max_members).toBeNull();
    expect(reconciled.active_sites).toBe(4);
  });

  it("falls back to counting active projects when team_quota_usage returns null", async () => {
    mockState.quotaRpcData = null;
    const quota = await resolveEffectiveQuota(
      makeAdminMock() as unknown as SupabaseClient,
      "team-1",
      "enterprise",
    );
    expect(quota.active_sites).toBe(2);
    expect(quota.max_websites).toBeNull();
  });

  it("allows site creation via AI on Enterprise even with multiple active sites", async () => {
    mockState.planId = "enterprise";
    mockState.quotaRpcData = {
      active_sites: 12,
      deleted_pending: 0,
      max_websites: null,
      max_members: null,
      max_deleted_pending: 3,
    };

    const result = await validateCreateSiteInput(
      {
        userId: "user-1",
        teamId: "team-1",
        teamName: "Enterprise Team",
        role: "owner",
        planId: "enterprise",
      },
      {
        name: "Enterprise Launch",
        address: "enterprise-launch",
        templateSlug: "starter",
      },
    );
    expect(result).toEqual({ ok: true, address: "enterprise-launch" });
  });

  it("still enforces website limits on Free plans", async () => {
    mockState.planId = "free";
    mockState.quotaRpcData = {
      active_sites: 1,
      deleted_pending: 0,
      max_websites: 1,
      max_members: 1,
      max_deleted_pending: 0,
    };

    const result = await validateCreateSiteInput(
      {
        userId: "user-1",
        teamId: "team-1",
        teamName: "Free Team",
        role: "owner",
        planId: "free",
      },
      {
        name: "Second Site",
        address: "second-site",
        templateSlug: "starter",
      },
    );
    expect(result).toEqual({ ok: false, code: "LIMIT_WEBSITES_REACHED" });
  });
});

describe("assistant prompt and resource tools", () => {
  beforeEach(() => {
    mockState.planId = "enterprise";
    mockState.quotaRpcData = {
      active_sites: 4,
      deleted_pending: 0,
      max_websites: null,
      max_members: null,
      max_deleted_pending: 3,
    };
    mockState.aiBalanceData = { total: 4950 };
    mockState.conversationProjectId = "11111111-1111-4111-8111-111111111111";
  });

  it("includes plan, credits, websites, pages, and unlimited limits in the prompt", () => {
    const prompt = buildAgentPrompt(
      [
        {
          id: "m1",
          role: "user",
          content: "Can I create another website?",
          credits: 0,
          requestId: null,
          createdAt: "2026-11-27T00:00:00.000Z",
        },
      ],
      {
        route: "/dashboard",
        pageTitle: "Websites",
        projectName: "Main Site",
        projectId: "11111111-1111-4111-8111-111111111111",
        teamName: "Enterprise Team",
        planId: "enterprise",
        planName: "Enterprise",
        credits: 4950,
        activeWebsites: 4,
        maxWebsites: null,
        maxPagesPerSite: null,
        maxPlugins: null,
        storageMb: null,
        customDomainAllowed: true,
        websites: mockState.websites,
        pages: mockState.pages.map((p) => ({
          id: p.id,
          title: p.title,
          path: p.path,
          isHomepage: p.is_homepage,
          revision: p.revision,
        })),
      },
    );

    expect(prompt).toContain("Plan: Enterprise (enterprise)");
    expect(prompt).toContain("AI credits remaining: 4950");
    expect(prompt).toContain("Websites: 4 of unlimited");
    expect(prompt).toContain("Pages per website limit: unlimited");
    expect(prompt).toContain("Plugins per website limit: unlimited");
    expect(prompt).toContain("Storage limit: unlimited");
    expect(prompt).toContain("Custom domains allowed: yes");
    expect(prompt).toContain("Main Site (main-site.get-on.tech, published, id:11111111-1111-4111-8111-111111111111)");
    expect(prompt).toContain("Home (/, homepage, id:33333333-3333-4333-8333-333333333333, rev:2)");
  });

  it("returns accurate team resources in get_context, get_usage, and list_templates", async () => {
    const toolCtx = {
      admin: makeAdminMock() as never,
      teamId: "team-1",
      userId: "user-1",
      conversationId: "conv-1",
      actorUserId: "user-1",
      route: "/dashboard/projects/11111111-1111-4111-8111-111111111111",
    };

    const ctxResult = await getContext.execute({}, toolCtx);
    expect(ctxResult.ok).toBe(true);
    if (ctxResult.ok) {
      expect(ctxResult.data.route).toBe("/dashboard/projects/11111111-1111-4111-8111-111111111111");
      expect(ctxResult.data.plan).toBe("enterprise");
      expect(ctxResult.data.planName).toBe("Enterprise");
      expect(ctxResult.data.credits).toBe(4950);
      expect(ctxResult.data.usage).toEqual({ activeWebsites: 4, maxWebsites: null });
      expect(ctxResult.data.limits.maxWebsites).toBeNull();
      expect(ctxResult.data.limits.maxPages).toBeNull();
      expect(ctxResult.data.limits.maxPlugins).toBeNull();
      expect(ctxResult.data.websites).toHaveLength(2);
      expect(ctxResult.data.pages).toHaveLength(2);
    }

    const usageResult = await getUsage.execute({}, toolCtx);
    expect(usageResult.ok).toBe(true);
    if (usageResult.ok) {
      expect(usageResult.data.plan).toBe("enterprise");
      expect(usageResult.data.planName).toBe("Enterprise");
      expect(usageResult.data.credits).toBe(4950);
      expect(usageResult.data.activeWebsites).toBe(4);
      expect(usageResult.data.maxWebsites).toBeNull();
      expect(usageResult.data.maxPagesPerSite).toBeNull();
      expect(usageResult.data.maxPlugins).toBeNull();
    }

    const templatesResult = await listTemplates.execute({}, toolCtx);
    expect(templatesResult.ok).toBe(true);
    if (templatesResult.ok) {
      expect(templatesResult.data.templates.length).toBeGreaterThan(0);
      expect(templatesResult.data.templates.every((t) => t.available === true && typeof t.planMin === "string")).toBe(true);
    }
  });
});
