import { afterEach, describe, expect, it, vi } from "vitest";
import { isAiError } from "@get-on/ai";
import { sha256Hex, verifyWorkerRequest } from "@get-on/site-server";
import { WorkersAiProvider } from "@/lib/ai/provider";

const config = {
  accountId: "account",
  apiToken: "token",
  gatewayId: "gateway",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Workers AI provider", () => {
  it("sends the required gateway safety headers", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        choices: [{ message: { content: "Hello" } }],
        usage: { prompt_tokens: 12, completion_tokens: 3 },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new WorkersAiProvider(config);
    const result = await provider.generateText({
      modelId: "@cf/meta/llama-3.2-3b-instruct",
      messages: [{ role: "user", content: "Hi" }],
      metadata: { team: "abc", task: "text.write", request: "req" },
    });

    expect(result.value).toBe("Hello");
    expect(result.usage).toEqual({ inputTokens: 12, outputTokens: 3 });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["cf-aig-gateway-id"]).toBe("gateway");
    expect(headers["cf-aig-skip-cache"]).toBe("true");
    expect(headers["cf-aig-collect-log-payload"]).toBe("false");
    expect(headers["cf-aig-max-attempts"]).toBe("1");
    expect(headers["cf-aig-metadata"]).toContain('"team":"abc"');
  });

  it("maps rate limits and provider errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(
          { errors: [{ code: 3036, message: "rate limited" }] },
          429,
        ),
      ),
    );
    await expect(
      new WorkersAiProvider(config).generateText({
        modelId: "model",
        messages: [{ role: "user", content: "Hi" }],
      }),
    ).rejects.toSatisfy(
      (error) => isAiError(error) && error.code === "AI_RATE_LIMIT",
    );

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ errors: [] }, 500)),
    );
    await expect(
      new WorkersAiProvider(config).generateText({
        modelId: "model",
        messages: [{ role: "user", content: "Hi" }],
      }),
    ).rejects.toSatisfy(
      (error) => isAiError(error) && error.code === "AI_PROVIDER_ERROR",
    );
  });

  it("parses structured JSON, including fenced output", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          choices: [{ message: { content: '```json\n{"title":"Hi"}\n```' } }],
          usage: { prompt_tokens: 20, completion_tokens: 5 },
        }),
      ),
    );
    const result = await new WorkersAiProvider(config).generateStructured({
      modelId: "model",
      messages: [{ role: "user", content: "Hi" }],
      schemaName: "Page",
      jsonSchema: { type: "object" },
    });
    expect(result.value).toEqual({ title: "Hi" });
  });

  it("calls the model-specific run endpoint for moderation and images", async () => {
    const moderationFetch = vi.fn(async () =>
      jsonResponse({ result: { response: "unsafe\nS1" } }),
    );
    vi.stubGlobal("fetch", moderationFetch);
    const moderation = await new WorkersAiProvider(config).moderate({
      modelId: "@cf/meta/llama-guard-3-8b",
      text: "Bad",
    });
    expect(moderation.safe).toBe(false);
    expect(moderation.categories).toContain("S1");
    const [moderationUrl, moderationInit] = moderationFetch.mock
      .calls[0] as unknown as [string, RequestInit];
    expect(moderationUrl).toContain("/ai/run/@cf/meta/llama-guard-3-8b");
    expect(JSON.parse(String(moderationInit.body))).toEqual({
      messages: [{ role: "user", content: "Bad" }],
    });

    const imageFetch = vi.fn(async () =>
      jsonResponse({ result: { image: "abc123" } }),
    );
    vi.stubGlobal("fetch", imageFetch);
    const image = await new WorkersAiProvider(config).generateImage({
      modelId: "@cf/black-forest-labs/flux-1-schnell",
      prompt: "A bakery",
      width: 512,
      height: 512,
      steps: 4,
    });
    expect(image.imageBase64).toBe("abc123");
    expect(image.usage.images).toBe(1);
    const [imageUrl, imageInit] = imageFetch.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(imageUrl).toContain(
      "/ai/run/@cf/black-forest-labs/flux-1-schnell",
    );
    expect(JSON.parse(String(imageInit.body))).toEqual({
      prompt: "A bakery",
      steps: 4,
    });
  });

  it("routes signed requests to Cloudflare API worker when workerUrl and workerSecret are set", async () => {
    const workerSecret = "shared-worker-secret-test";
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        choices: [{ message: { content: "Worker reply" } }],
        usage: { prompt_tokens: 9, completion_tokens: 4 },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new WorkersAiProvider({
      accountId: "",
      apiToken: "",
      gatewayId: "get-on-gw",
      workerUrl: "https://api.get-on.tech/",
      workerSecret,
    });

    const textResult = await provider.generateText({
      modelId: "@cf/meta/llama-3.2-3b-instruct",
      messages: [{ role: "user", content: "Hello" }],
      metadata: { team: "t1", task: "agent.chat" },
    });

    expect(textResult.value).toBe("Worker reply");
    expect(textResult.usage).toEqual({ inputTokens: 9, outputTokens: 4 });

    const [chatUrl, chatInit] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(chatUrl).toBe("https://api.get-on.tech/ai/v1/chat/completions");
    const chatHeaders = chatInit.headers as Record<string, string>;
    expect(chatHeaders["x-gs-host"]).toBe("api.get-on.tech");
    expect(chatHeaders["x-gs-ts"]).toBeTruthy();
    expect(chatHeaders["x-gs-sig"]).toBeTruthy();
    const chatBody = String(chatInit.body);
    const verifiedChat = await verifyWorkerRequest(workerSecret, {
      ts: chatHeaders["x-gs-ts"]!,
      host: chatHeaders["x-gs-host"]!,
      ip: chatHeaders["x-gs-ip"] ?? "",
      bodyHash: await sha256Hex(chatBody),
      sig: chatHeaders["x-gs-sig"]!,
    });
    expect(verifiedChat).toBe(true);
    expect(JSON.parse(chatBody)).toMatchObject({
      model: "@cf/meta/llama-3.2-3b-instruct",
      gatewayId: "get-on-gw",
      metadata: { team: "t1", task: "agent.chat" },
    });

    const runFetchMock = vi.fn(async () =>
      jsonResponse({ result: { response: "safe" } }),
    );
    vi.stubGlobal("fetch", runFetchMock);
    const guardResult = await provider.moderate({
      modelId: "@cf/meta/llama-guard-3-8b",
      text: "Check me",
    });
    expect(guardResult.safe).toBe(true);
    const [runUrl, runInit] = runFetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(runUrl).toBe("https://api.get-on.tech/ai/run");
    expect(JSON.parse(String(runInit.body))).toEqual({
      model: "@cf/meta/llama-guard-3-8b",
      inputs: { messages: [{ role: "user", content: "Check me" }] },
      gatewayId: "get-on-gw",
    });
  });
});

