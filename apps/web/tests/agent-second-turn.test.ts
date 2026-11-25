import { beforeEach, describe, expect, it, vi } from "vitest";

const insertedIdempotencyKeys: string[] = [];
const rpcCalls: Array<{ fn: string; params: Record<string, unknown> }> = [];
const seenKeys = new Set<string>();
let reqCounter = 0;

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === "ai_requests") {
        return {
          insert: (row: { idempotency_key: string }) => {
            const key = row.idempotency_key;
            insertedIdempotencyKeys.push(key);
            const duplicate = seenKeys.has(key);
            if (!duplicate) seenKeys.add(key);
            reqCounter += 1;
            const id = `req-${reqCounter}`;
            return {
              select: () => ({
                single: async () =>
                  duplicate
                    ? { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } }
                    : { data: { id }, error: null },
              }),
            };
          },
          update: () => ({
            eq: async () => ({ error: null }),
          }),
        };
      }
      return {
        update: () => ({ eq: async () => ({ error: null }) }),
      };
    },
    rpc: async (fn: string, params: Record<string, unknown>) => {
      rpcCalls.push({ fn, params });
      if (fn === "ai_settle") return { data: 1, error: null };
      return { data: null, error: null };
    },
  }),
}));

vi.mock("@/lib/agent/settings", () => ({
  getAssistantFeature: async () => ({
    enabled: true,
    turnCapCredits: 3,
    allowedRoles: ["owner", "admin"],
  }),
}));

vi.mock("@/lib/ai/settings", () => ({
  loadAiSettings: async () => ({
    enabled: true,
    imagesEnabled: true,
    gatewayId: "get-on-gw",
    moderationEnabled: false,
    creditNeurons: 100,
    dailyCapCredits: 5000,
  }),
  loadAiModels: async () => [
    {
      id: "model-writer",
      provider: "workers-ai",
      modelId: "@cf/meta/llama-3.1-8b-instruct",
      purposes: ["writer", "brief"],
      neuronsPerMInput: 250,
      neuronsPerMOutput: 750,
      neuronsPerImage: null,
      contextTokens: 32000,
      maxOutputTokens: 900,
      supportsJson: true,
      supportsVision: false,
      enabled: true,
      fallbackId: null,
      notes: null,
      verifiedAt: null,
    },
  ],
}));

vi.mock("@/lib/agent/conversations", () => ({
  listAgentMessages: async () => [
    {
      id: "m1",
      role: "user",
      content: "Hello",
      credits: 0,
      requestId: null,
      createdAt: "2026-11-25T16:00:00.000Z",
    },
  ],
}));

vi.mock("@/lib/ai/config", () => ({
  aiConfig: () => ({
    provider: "fake",
    enabled: true,
    imagesEnabled: true,
    accountId: "",
    apiToken: "",
    gatewayId: "get-on-gw",
    workerUrl: "",
    workerSecret: "",
    creditNeurons: 100,
    dailyCapCredits: 5000,
    usdPerNeuron: 0.000011,
  }),
}));

vi.mock("@/lib/ai/provider-factory", () => ({
  createAiProvider: () => ({
    id: "fake",
    chatWithTools: async () => ({
      text: "Here is your answer.",
      toolCalls: [],
      usage: { inputTokens: 10, outputTokens: 5 },
      modelId: "@cf/meta/llama-3.1-8b-instruct",
      raw: {},
    }),
  }),
}));

vi.mock("@/lib/ai/pipeline", () => ({
  moderateText: async () => ({ safe: true, categories: [] }),
}));

import { runAgentLoop } from "@/lib/agent/loop";

describe("agent second turn idempotency", () => {
  beforeEach(() => {
    insertedIdempotencyKeys.length = 0;
    rpcCalls.length = 0;
    seenKeys.clear();
    reqCounter = 0;
  });

  it("uses distinct idempotency keys across multiple turns in the same conversation", async () => {
    const first = await runAgentLoop({
      conversationId: "conv-123",
      teamId: "team-1",
      userId: "user-1",
      projectId: null,
      turnId: "msg-turn-1",
      tools: [],
      context: {
        route: "/dashboard",
        pageTitle: "Dashboard",
        projectName: "My Site",
        teamName: "Acme",
      },
    });

    const second = await runAgentLoop({
      conversationId: "conv-123",
      teamId: "team-1",
      userId: "user-1",
      projectId: null,
      turnId: "msg-turn-2",
      tools: [],
      context: {
        route: "/dashboard",
        pageTitle: "Dashboard",
        projectName: "My Site",
        teamName: "Acme",
      },
    });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(insertedIdempotencyKeys).toEqual([
      "conv-123:msg-turn-1:1",
      "conv-123:msg-turn-2:1",
    ]);
  });

  it("generates unique turn IDs automatically when turnId is omitted", async () => {
    const first = await runAgentLoop({
      conversationId: "conv-456",
      teamId: "team-1",
      userId: "user-1",
      projectId: null,
      tools: [],
      context: {
        route: "/dashboard",
        pageTitle: "Dashboard",
        projectName: "My Site",
        teamName: "Acme",
      },
    });

    const second = await runAgentLoop({
      conversationId: "conv-456",
      teamId: "team-1",
      userId: "user-1",
      projectId: null,
      tools: [],
      context: {
        route: "/dashboard",
        pageTitle: "Dashboard",
        projectName: "My Site",
        teamName: "Acme",
      },
    });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(insertedIdempotencyKeys).toHaveLength(2);
    expect(insertedIdempotencyKeys[0]).not.toBe(insertedIdempotencyKeys[1]);
  });
});
