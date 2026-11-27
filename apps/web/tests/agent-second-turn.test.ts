import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { AiError } from "@get-on/ai";

const insertedIdempotencyKeys: string[] = [];
const rpcCalls: Array<{ fn: string; params: Record<string, unknown> }> = [];
const updatedRequests: Array<{ id: string; patch: Record<string, unknown> }> = [];
const seenKeys = new Set<string>();
const chatQueue: Array<() => Promise<{
  text: string;
  toolCalls: Array<{ id: string; name: string; arguments: unknown }>;
  usage: { inputTokens?: number; outputTokens?: number; neurons?: number };
  modelId: string;
  raw?: unknown;
}>> = [];
let moderationEnabledMock = false;
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
          update: (patch: Record<string, unknown>) => ({
            eq: async (_col: string, id: string) => {
              updatedRequests.push({ id, patch });
              return { error: null };
            },
          }),
        };
      }
      return {
        update: () => ({ eq: async () => ({ error: null }) }),
      };
    },
    rpc: async (fn: string, params: Record<string, unknown>) => {
      rpcCalls.push({ fn, params });
      if (fn === "ai_settle") return { data: Number(params.p_actual ?? 1), error: null };
      return { data: null, error: null };
    },
  }),
}));

vi.mock("@/lib/agent/settings", () => ({
  getAssistantFeature: async () => ({
    enabled: true,
    turnCapCredits: 5,
    allowedRoles: ["owner", "admin"],
  }),
}));

vi.mock("@/lib/ai/settings", () => ({
  loadAiSettings: async () => ({
    enabled: true,
    imagesEnabled: true,
    gatewayId: "get-on-gw",
    moderationEnabled: moderationEnabledMock,
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
    {
      id: "model-guard",
      provider: "workers-ai",
      modelId: "@cf/meta/llama-guard-3-8b",
      purposes: ["guard"],
      neuronsPerMInput: 200,
      neuronsPerMOutput: 200,
      neuronsPerImage: null,
      contextTokens: 8192,
      maxOutputTokens: 256,
      supportsJson: false,
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
    chatWithTools: async () => {
      const next = chatQueue.shift();
      if (next) return next();
      return {
        text: "Here is your answer.",
        toolCalls: [],
        usage: { inputTokens: 10, outputTokens: 5 },
        modelId: "@cf/meta/llama-3.1-8b-instruct",
        raw: {},
      };
    },
  }),
}));

vi.mock("@/lib/ai/pipeline", () => ({
  moderateText: async () => ({
    safe: true,
    categories: [],
    usage: { inputTokens: 15, outputTokens: 3, totalTokens: 18 },
  }),
}));

import { runAgentLoop } from "@/lib/agent/loop";

const baseContext = {
  route: "/dashboard",
  pageTitle: "Dashboard",
  projectName: "My Site",
  teamName: "Acme",
};

describe("agent second turn & credit safety", () => {
  beforeEach(() => {
    insertedIdempotencyKeys.length = 0;
    rpcCalls.length = 0;
    updatedRequests.length = 0;
    chatQueue.length = 0;
    seenKeys.clear();
    moderationEnabledMock = false;
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
      context: baseContext,
    });

    const second = await runAgentLoop({
      conversationId: "conv-123",
      teamId: "team-1",
      userId: "user-1",
      projectId: null,
      turnId: "msg-turn-2",
      tools: [],
      context: baseContext,
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
      context: baseContext,
    });

    const second = await runAgentLoop({
      conversationId: "conv-456",
      teamId: "team-1",
      userId: "user-1",
      projectId: null,
      tools: [],
      context: baseContext,
    });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(insertedIdempotencyKeys).toHaveLength(2);
    expect(insertedIdempotencyKeys[0]).not.toBe(insertedIdempotencyKeys[1]);
  });

  it("releases ALL reserved credits and charges 0 when step 2 of a multi-step turn fails", async () => {
    moderationEnabledMock = true;
    chatQueue.push(
      async () => ({
        text: "",
        toolCalls: [{ id: "tc-1", name: "lookup_site", arguments: {} }],
        usage: { inputTokens: 120, outputTokens: 25 },
        modelId: "@cf/meta/llama-3.1-8b-instruct",
      }),
      async () => {
        throw new AiError("AI_TIMEOUT");
      },
    );

    const res = await runAgentLoop({
      conversationId: "conv-fail",
      teamId: "team-1",
      userId: "user-1",
      projectId: null,
      turnId: "turn-fail-1",
      tools: [
        {
          name: "lookup_site",
          schema: z.object({}),
          description: "Inspect website",
          jsonSchema: { type: "object", properties: {} },
          execute: async () => ({ ok: true, data: { pages: 3 } }),
        },
      ],
      context: baseContext,
    });

    expect(res.ok).toBe(false);
    expect(res.credits).toBe(0);
    expect(rpcCalls.some((c) => c.fn === "ai_settle")).toBe(false);
    const releases = rpcCalls.filter((c) => c.fn === "ai_release");
    expect(releases).toHaveLength(2);

    const usageCalls = rpcCalls.filter((c) => c.fn === "ai_record_usage");
    expect(usageCalls.length).toBeGreaterThanOrEqual(1);
    expect(usageCalls.every((c) => c.params.p_credits === 0)).toBe(true);
    const totalNeurons = usageCalls.reduce((sum, c) => sum + Number(c.params.p_neurons ?? 0), 0);
    expect(totalNeurons).toBeGreaterThan(0);
  });

  it("records full token and neuron breakdown on succeeded turns and retries blank output", async () => {
    moderationEnabledMock = true;
    chatQueue.push(
      async () => ({
        text: "   ",
        toolCalls: [],
        usage: { inputTokens: 80, outputTokens: 2 },
        modelId: "@cf/meta/llama-3.1-8b-instruct",
      }),
      async () => ({
        text: "All done — your homepage headline is ready.",
        toolCalls: [],
        usage: { inputTokens: 90, outputTokens: 18 },
        modelId: "@cf/meta/llama-3.1-8b-instruct",
      }),
    );

    const res = await runAgentLoop({
      conversationId: "conv-ok",
      teamId: "team-1",
      userId: "user-1",
      projectId: null,
      turnId: "turn-ok-1",
      tools: [],
      context: baseContext,
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.text).toBe("All done — your homepage headline is ready.");
      expect(res.credits).toBeGreaterThan(0);
    }
    const settles = rpcCalls.filter((c) => c.fn === "ai_settle");
    expect(settles).toHaveLength(2);

    const req1Final = updatedRequests.find(
      (u) => u.id === "req-1" && u.patch.status === "succeeded",
    );
    expect(req1Final?.patch.usage).toMatchObject({
      inputTokens: 80,
      outputTokens: 2,
      moderationInputTokens: 15,
      moderationOutputTokens: 3,
      moderationTotalTokens: 18,
      totalTokens: 100,
    });
    expect(Number((req1Final?.patch.usage as Record<string, unknown>).totalNeurons)).toBeGreaterThan(0);
    if (res.ok) {
      expect(res.nextSteps.length).toBeGreaterThan(0);
    }
  });

  it("falls back to text-only completion when a tool call raises AI_PROVIDER_ERROR and returns nextSteps", async () => {
    chatQueue.push(
      async () => {
        throw new AiError("AI_PROVIDER_ERROR", { message: "tool schema rejected" });
      },
      async () => ({
        text: "I checked your project settings and can help you publish when ready.",
        toolCalls: [],
        usage: { inputTokens: 60, outputTokens: 16 },
        modelId: "@cf/meta/llama-3.1-8b-instruct",
      }),
    );

    const res = await runAgentLoop({
      conversationId: "conv-fallback",
      teamId: "team-1",
      userId: "user-1",
      projectId: "proj-1",
      turnId: "turn-fallback-1",
      tools: [
        {
          name: "lookup_site",
          schema: z.object({}),
          description: "Inspect website",
          jsonSchema: { type: "object", properties: {} },
          execute: async () => ({ ok: true, data: { pages: 3 } }),
        },
      ],
      context: baseContext,
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.text).toContain("publish when ready");
      expect(res.nextSteps.length).toBeGreaterThan(0);
      expect(res.nextSteps.some((step) => Boolean(step.prompt || step.href))).toBe(true);
    }
  });
});
