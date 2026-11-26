import { afterEach, describe, expect, it, vi } from "vitest";
import { FakeAiProvider, MODEL_SEEDS, modelFor } from "@get-on/ai";
import { aiConfig } from "@/lib/ai/config";
import { imagePrompt, runImageTask } from "@/lib/ai/image-pipeline";

const SAMPLE_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

const { mockAdminState } = vi.hoisted(() => ({
  mockAdminState: {
    aiModels: [] as Array<Record<string, unknown>>,
    disabledImageModels: [] as Array<Record<string, unknown>>,
  },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from(table: string) {
      if (table === "ai_settings") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  enabled: true,
                  images_enabled: true,
                  moderation_enabled: false,
                  credit_neurons: 100,
                  daily_cap_credits: 5000,
                  free_grant_credits: 25,
                  max_prompt_chars: 20000,
                  payload_retention_days: 30,
                  gateway_id: "get-on-gw",
                  default_language: "en",
                  assistant_enabled: true,
                  assistant_confirm_credits: 5,
                  assistant_turn_cap_credits: 3,
                },
              }),
            }),
          }),
        };
      }
      if (table === "team_members") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: { role: "owner" } }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === "projects") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: "proj-1",
                  team_id: "team-1",
                  deleted_at: null,
                  settings: { businessType: "Bakery", templateSlug: "bakery" },
                },
              }),
            }),
          }),
          update: () => ({
            eq: async () => ({ error: null }),
          }),
        };
      }
      if (table === "project_settings") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  brand_voice: {},
                  business_facts: [{ label: "Town", value: "Bristol" }],
                },
              }),
            }),
          }),
        };
      }
      if (table === "ai_requests") {
        return {
          select: () => ({
            eq: () => ({
              gte: async () => ({ count: 0 }),
            }),
          }),
          insert: () => ({
            select: () => ({
              single: async () => ({ data: { id: "req-img-1" }, error: null }),
            }),
          }),
          update: () => ({
            eq: async () => ({ error: null }),
          }),
        };
      }
      if (table === "ai_usage_daily" || table === "ai_usage_platform_daily") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: { credits: 0, requests: 0 } }),
              }),
              maybeSingle: async () => ({ data: { credits: 0, requests: 0 } }),
            }),
          }),
        };
      }
      if (table === "ai_models") {
        return {
          select: () => ({
            eq: () => ({
              order: async () => ({ data: mockAdminState.aiModels }),
            }),
            contains: () => ({
              limit: async () => ({ data: mockAdminState.disabledImageModels }),
            }),
          }),
        };
      }
      if (table === "ai_payloads") {
        return {
          upsert: async () => ({ error: null }),
        };
      }
      if (table === "media") {
        return {
          insert: () => ({
            select: () => ({
              single: async () => ({
                data: {
                  id: "media-1",
                  path: "proj-1/test-ai.webp",
                  filename: "AI picture.webp",
                  mime: "image/webp",
                  size_bytes: 42,
                  width: 1,
                  height: 1,
                  alt: "",
                  created_at: "2026-11-25T18:00:00Z",
                },
                error: null,
              }),
            }),
          }),
        };
      }
      return {
        select: () => ({ maybeSingle: async () => ({ data: null }) }),
      };
    },
    rpc: async (name: string) => {
      if (name === "billing_resolve_team") {
        return { data: { plan_id: "pro", status: "active" }, error: null };
      }
      if (name === "ai_settle") {
        return { data: 1, error: null };
      }
      return { data: null, error: null };
    },
    storage: {
      from: () => ({
        upload: async () => ({ error: null }),
        remove: async () => ({ error: null }),
        createSignedUrl: async () => ({
          data: { signedUrl: "https://cdn.example.com/signed.webp" },
        }),
      }),
    },
  }),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  mockAdminState.aiModels = [];
  mockAdminState.disabledImageModels = [];
});

describe("AI image prompt and generation", () => {
  it("keeps safety rules and business facts in the prompt", () => {
    const prompt = imagePrompt("a warm photo of a bakery counter", {
      brandVoice: {},
      businessType: "Bakery",
      templateSlug: null,
      businessFacts: [{ label: "Town", value: "Bristol" }],
    });
    expect(prompt).toContain("No text, logos, watermarks");
    expect(prompt).toContain("Town: Bristol");
    expect(prompt).toContain("a warm photo of a bakery counter");
  });

  it("caps the prompt for the image model", () => {
    const prompt = imagePrompt("x".repeat(5000), {
      brandVoice: {},
      businessType: null,
      templateSlug: null,
      businessFacts: [],
    });
    expect(prompt.length).toBeLessThanOrEqual(2000);
  });

  it("includes an enabled Flux image seed and prevents image lookups from picking a text model", () => {
    const seededImage = modelFor("image", {}, MODEL_SEEDS);
    expect(seededImage?.modelId).toBe("@cf/black-forest-labs/flux-1-schnell");

    const textOnly = MODEL_SEEDS.filter((model) => !model.purposes.includes("image"));
    expect(modelFor("image", {}, textOnly)).toBeNull();
    expect(modelFor("vision", {}, textOnly.filter((m) => !m.purposes.includes("vision")))).toBeNull();
  });

  it("returns valid decodable PNG bytes from FakeAiProvider.generateImage", async () => {
    const result = await new FakeAiProvider().generateImage({
      modelId: "@cf/black-forest-labs/flux-1-schnell",
      prompt: "Fresh sourdough loaves",
    });
    const decoded = Buffer.from(result.imageBase64, "base64");
    expect(decoded.length).toBeGreaterThan(20);
    expect(decoded.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))).toBe(true);
  });

  it("defaults AI_IMAGES_ENABLED on unless false and infers api.get-on.tech when WORKER_SHARED_SECRET is set", () => {
    vi.stubEnv("AI_PROVIDER", "workers-ai");
    vi.stubEnv("AI_IMAGES_ENABLED", "");
    vi.stubEnv("AI_WORKER_URL", "");
    vi.stubEnv("API_ORIGIN", "");
    vi.stubEnv("APP_ORIGIN", "https://get-on.tech");
    vi.stubEnv("WORKER_SHARED_SECRET", "prod-secret");

    const cfg = aiConfig();
    expect(cfg.imagesEnabled).toBe(true);
    expect(cfg.workerUrl).toBe("https://api.get-on.tech");

    vi.stubEnv("AI_IMAGES_ENABLED", "false");
    expect(aiConfig().imagesEnabled).toBe(false);
  });

  it("falls back to seeded Flux model when ai_models has no image row and routes through api-worker", async () => {
    vi.stubEnv("AI_PROVIDER", "workers-ai");
    vi.stubEnv("AI_IMAGES_ENABLED", "");
    vi.stubEnv("AI_WORKER_URL", "https://api.get-on.tech");
    vi.stubEnv("WORKER_SHARED_SECRET", "worker-secret");

    // Simulate ai_models table containing only writer/guard models
    mockAdminState.aiModels = [
      {
        id: "writer-fast",
        provider: "workers-ai",
        model_id: "@cf/meta/llama-3.2-3b-instruct",
        purposes: ["writer", "brief"],
        neurons_per_m_input: 250,
        neurons_per_m_output: 750,
        neurons_per_image: null,
        context_tokens: 32000,
        max_output_tokens: 4096,
        supports_json: true,
        supports_vision: false,
        enabled: true,
        fallback_id: null,
        notes: null,
        verified_at: null,
      },
    ];

    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          result: { image: `data:image/png;base64,${SAMPLE_PNG_BASE64}` },
          mime: "image/png",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const outcome = await runImageTask({
      teamId: "team-1",
      userId: "user-1",
      projectId: "proj-1",
      prompt: "Warm bakery display counter",
    });

    expect(outcome.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.get-on.tech/ai/images/generate");
    const parsedBody = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(parsedBody.model).toBe("@cf/black-forest-labs/flux-1-schnell");
  });
});

