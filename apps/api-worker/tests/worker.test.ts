import { afterEach, describe, expect, it, vi } from "vitest";
import { sha256Hex, signWorkerRequest } from "@get-on/site-server";
import { createApiWorker } from "../src/worker.js";
import type {
  ApiWorkerEnv,
  JobMessageBody,
  MessageBatchLike,
  MessageLike,
  QueueLike,
  ScheduledControllerLike,
} from "../src/env.js";

describe("api-worker", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("responds ok on GET and HEAD /health", async () => {
    const worker = createApiWorker();
    const res = await worker.fetch(new Request("https://api.get-on.tech/health"), {});
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ ok: true, service: "get-on-api" });

    const head = await worker.fetch(
      new Request("https://api.get-on.tech/_gs/health", { method: "HEAD" }),
      {},
    );
    expect(head.status).toBe(200);
  });

  it("rejects unauthorized /cron/trigger requests with 401", async () => {
    const worker = createApiWorker();
    const env: ApiWorkerEnv = { CRON_SECRET: "top-secret" };

    const missingAuth = await worker.fetch(
      new Request("https://api.get-on.tech/cron/trigger", { method: "POST" }),
      env,
    );
    expect(missingAuth.status).toBe(401);

    const wrongAuth = await worker.fetch(
      new Request("https://api.get-on.tech/cron/trigger", {
        method: "POST",
        headers: { authorization: "Bearer wrong-secret" },
      }),
      env,
    );
    expect(wrongAuth.status).toBe(401);
  });

  it("verifies x-gs-sig on /api/public/forms/:formId and relays to APP_ORIGIN", async () => {
    const worker = createApiWorker();
    const secret = "worker-shared-secret";
    const body = "name=Jane&email=jane%40example.com";
    const ts = String(Date.now());
    const host = "mysite.get-on.tech";
    const ip = "203.0.113.5";
    const bodyHash = await sha256Hex(body);
    const sig = await signWorkerRequest(secret, { ts, host, ip, bodyHash });

    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const env: ApiWorkerEnv = {
      APP_ORIGIN: "https://get-on.tech",
      WORKER_SHARED_SECRET: secret,
    };

    const badSigRes = await worker.fetch(
      new Request("https://api.get-on.tech/api/public/forms/contact123", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          "x-gs-host": host,
          "x-gs-ip": ip,
          "x-gs-ts": ts,
          "x-gs-sig": "invalid-sig",
        },
        body,
      }),
      env,
    );
    expect(badSigRes.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();

    const okRes = await worker.fetch(
      new Request("https://api.get-on.tech/api/public/forms/contact123", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          "x-gs-host": host,
          "x-gs-ip": ip,
          "x-gs-ts": ts,
          "x-gs-sig": sig,
        },
        body,
      }),
      env,
    );
    expect(okRes.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://get-on.tech/api/public/forms/contact123");
    const forwardedHeaders = new Headers(init.headers);
    expect(forwardedHeaders.get("x-gs-sig")).toBe(sig);
    expect(forwardedHeaders.get("x-gs-host")).toBe(host);
    expect(init.body).toBe(body);
  });

  it("relays /api/stats/ingest and /webhooks/ses to APP_ORIGIN", async () => {
    const worker = createApiWorker();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 202 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const env: ApiWorkerEnv = { APP_ORIGIN: "https://get-on.tech" };

    const statsRes = await worker.fetch(
      new Request("https://api.get-on.tech/api/stats/ingest", {
        method: "POST",
        headers: { "content-type": "application/json", "x-gs-host": "demo.get-on.tech" },
        body: JSON.stringify({ kind: "view", siteId: "s1", path: "/" }),
      }),
      env,
    );
    expect(statsRes.status).toBe(202);
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe(
      "https://get-on.tech/api/stats/ingest",
    );

    const sesRes = await worker.fetch(
      new Request("https://api.get-on.tech/webhooks/ses", {
        method: "POST",
        headers: {
          "content-type": "text/plain; charset=UTF-8",
          "x-amz-sns-message-type": "Notification",
        },
        body: JSON.stringify({ Type: "Notification", Message: "{}" }),
      }),
      env,
    );
    expect(sesRes.status).toBe(202);
    expect((fetchMock.mock.calls[1] as unknown as [string])[0]).toBe(
      "https://get-on.tech/api/webhooks/ses",
    );
  });

  it("enqueues cron jobs onto JOBS_QUEUE in scheduled() and falls back to HTTP without queue", async () => {
    const worker = createApiWorker();
    const sendBatch = vi.fn(async () => undefined);
    const queue: QueueLike<JobMessageBody> = {
      send: vi.fn(async () => undefined),
      sendBatch,
    };
    const waitUntil = vi.fn();

    await worker.scheduled(
      { cron: "*/5 * * * *", scheduledTime: 1_700_000_000_000 } satisfies ScheduledControllerLike,
      { JOBS_QUEUE: queue },
      { waitUntil },
    );
    expect(sendBatch).toHaveBeenCalledTimes(1);
    const batchArg = (sendBatch.mock.calls[0] as unknown as [Array<{ body: JobMessageBody }>])[0];
    expect(batchArg.map((item) => item.body.job)).toEqual([
      "domains.verify",
      "domains.poll",
      "ai.payloads",
    ]);

    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await worker.scheduled(
      { cron: "0 * * * *", scheduledTime: 1_700_000_000_000 } satisfies ScheduledControllerLike,
      { APP_ORIGIN: "https://get-on.tech", CRON_SECRET: "cron-secret" },
      { waitUntil },
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://get-on.tech/api/cron/jobs");
    expect(JSON.parse(String(init.body)).jobs).toEqual(["domains.health", "ai.expire"]);
  });

  it("acks successful queue jobs and retries transient failures", async () => {
    const worker = createApiWorker();
    const okAck = vi.fn();
    const okRetry = vi.fn();
    const failAck = vi.fn();
    const failRetry = vi.fn();

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: false }), { status: 503 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const messages: MessageLike<JobMessageBody>[] = [
      {
        id: "m1",
        timestamp: new Date(),
        attempts: 1,
        body: { job: "domains.verify" },
        ack: okAck,
        retry: okRetry,
      },
      {
        id: "m2",
        timestamp: new Date(),
        attempts: 1,
        body: { job: "ai.monthly" },
        ack: failAck,
        retry: failRetry,
      },
    ];

    const batch: MessageBatchLike<JobMessageBody> = {
      queue: "get-on-jobs",
      messages,
      ackAll: vi.fn(),
      retryAll: vi.fn(),
    };

    await worker.queue(batch, {
      APP_ORIGIN: "https://get-on.tech",
      CRON_SECRET: "cron-secret",
    });

    expect(okAck).toHaveBeenCalledTimes(1);
    expect(okRetry).not.toHaveBeenCalled();
    expect(failRetry).toHaveBeenCalledTimes(1);
    expect(failAck).not.toHaveBeenCalled();
  });

  it("requires valid worker signatures on /ai/v1/chat/completions and /ai/run", async () => {
    const worker = createApiWorker();
    const runMock = vi.fn(async () => ({
      response: "Hello from edge AI",
      tool_calls: [{ id: "tc_1", function: { name: "site_info", arguments: "{}" } }],
      usage: { prompt_tokens: 15, completion_tokens: 6 },
    }));

    const missingBinding = await worker.fetch(
      new Request("https://api.get-on.tech/ai/v1/chat/completions", {
        method: "POST",
        body: JSON.stringify({ model: "@cf/meta/llama-3.2-3b-instruct", messages: [] }),
      }),
      { WORKER_SHARED_SECRET: "secret" },
    );
    expect(missingBinding.status).toBe(503);

    const env: ApiWorkerEnv = {
      WORKER_SHARED_SECRET: "ai-worker-secret",
      AI_GATEWAY_ID: "env-gateway",
      AI: { run: runMock },
    };

    const unsignedRes = await worker.fetch(
      new Request("https://api.get-on.tech/ai/v1/chat/completions", {
        method: "POST",
        body: JSON.stringify({ model: "@cf/meta/llama-3.2-3b-instruct", messages: [] }),
      }),
      env,
    );
    expect(unsignedRes.status).toBe(401);

    const payload = JSON.stringify({
      model: "@cf/meta/llama-3.2-3b-instruct",
      messages: [{ role: "user", content: "Hi" }],
      metadata: { team: "team-1" },
    });
    const ts = String(Date.now());
    const host = "api.get-on.tech";
    const bodyHash = await sha256Hex(payload);

    const badSigRes = await worker.fetch(
      new Request("https://api.get-on.tech/ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-gs-host": host,
          "x-gs-ip": "",
          "x-gs-ts": ts,
          "x-gs-sig": "invalid",
        },
        body: payload,
      }),
      env,
    );
    expect(badSigRes.status).toBe(403);
    expect(runMock).not.toHaveBeenCalled();

    const sig = await signWorkerRequest("ai-worker-secret", { ts, host, ip: "", bodyHash });
    const okRes = await worker.fetch(
      new Request("https://api.get-on.tech/ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-gs-host": host,
          "x-gs-ip": "",
          "x-gs-ts": ts,
          "x-gs-sig": sig,
        },
        body: payload,
      }),
      env,
    );
    expect(okRes.status).toBe(200);
    expect(await okRes.json()).toEqual({
      choices: [
        {
          message: {
            role: "assistant",
            content: "Hello from edge AI",
            tool_calls: [{ id: "tc_1", function: { name: "site_info", arguments: "{}" } }],
          },
        },
      ],
      usage: { prompt_tokens: 15, completion_tokens: 6 },
    });
    expect(runMock).toHaveBeenCalledWith(
      "@cf/meta/llama-3.2-3b-instruct",
      { messages: [{ role: "user", content: "Hi" }] },
      {
        gateway: {
          id: "env-gateway",
          skipCache: true,
          collectLog: false,
          metadata: { team: "team-1" },
        },
      },
    );
  });

  it("omits gateway options when no gateway id exists and base64-encodes binary image streams on /ai/run", async () => {
    const worker = createApiWorker();
    const bytes = new Uint8Array([137, 80, 78, 71]);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    });
    const runMock = vi.fn(async () => stream);
    const secret = "ai-worker-secret-2";
    const env: ApiWorkerEnv = {
      WORKER_SHARED_SECRET: secret,
      AI: { run: runMock },
    };

    const payload = JSON.stringify({
      model: "@cf/black-forest-labs/flux-1-schnell",
      inputs: { prompt: "Bakery storefront", steps: 4 },
    });
    const ts = String(Date.now());
    const host = "api.get-on.tech";
    const bodyHash = await sha256Hex(payload);
    const sig = await signWorkerRequest(secret, { ts, host, ip: "", bodyHash });

    const res = await worker.fetch(
      new Request("https://api.get-on.tech/ai/run", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-gs-host": host,
          "x-gs-ip": "",
          "x-gs-ts": ts,
          "x-gs-sig": sig,
        },
        body: payload,
      }),
      env,
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      result: { image: "iVBORw==" },
    });
    expect(runMock).toHaveBeenCalledWith(
      "@cf/black-forest-labs/flux-1-schnell",
      { prompt: "Bakery storefront", steps: 4 },
      undefined,
    );
  });

  it("handles signed /ai/images/generate requests and normalizes Response, byte array, and data-URI outputs", async () => {
    const worker = createApiWorker();
    const secret = "ai-image-worker-secret";
    const pngBytes = new Uint8Array([137, 80, 78, 71]);
    const runMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(pngBytes, { status: 200 }))
      .mockResolvedValueOnce({ image: "data:image/jpeg;base64,/9j/4AAQ" })
      .mockResolvedValueOnce({ result: { image: [137, 80, 78, 71] } });

    const env: ApiWorkerEnv = {
      WORKER_SHARED_SECRET: secret,
      AI_GATEWAY_ID: "gw-images",
      AI: { run: runMock },
    };

    const unsignedRes = await worker.fetch(
      new Request("https://api.get-on.tech/ai/images/generate", {
        method: "POST",
        body: JSON.stringify({ prompt: "Fresh croissants" }),
      }),
      env,
    );
    expect(unsignedRes.status).toBe(401);

    const signAndPost = async (bodyObj: Record<string, unknown>) => {
      const body = JSON.stringify(bodyObj);
      const ts = String(Date.now());
      const host = "api.get-on.tech";
      const sig = await signWorkerRequest(secret, {
        ts,
        host,
        ip: "",
        bodyHash: await sha256Hex(body),
      });
      return worker.fetch(
        new Request("https://api.get-on.tech/ai/images/generate", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-gs-host": host,
            "x-gs-ip": "",
            "x-gs-ts": ts,
            "x-gs-sig": sig,
          },
          body,
        }),
        env,
      );
    };

    const fluxRes = await signAndPost({
      prompt: "Fresh croissants",
      steps: 4,
      width: 1024,
      height: 1024,
      metadata: { task: "image.generate" },
    });
    expect(fluxRes.status).toBe(200);
    expect(await fluxRes.json()).toEqual({
      result: { image: "iVBORw==" },
      mime: "image/jpeg",
      model: "@cf/black-forest-labs/flux-1-schnell",
    });
    expect(runMock).toHaveBeenNthCalledWith(
      1,
      "@cf/black-forest-labs/flux-1-schnell",
      { prompt: "Fresh croissants", steps: 4 },
      {
        gateway: {
          id: "gw-images",
          skipCache: true,
          collectLog: false,
          metadata: { task: "image.generate" },
        },
      },
    );

    const sdRes = await signAndPost({
      model: "@cf/stabilityai/stable-diffusion-xl-base-1.0",
      prompt: "Minimalist studio",
      steps: 12,
      width: 768,
      height: 768,
    });
    expect(sdRes.status).toBe(200);
    expect(await sdRes.json()).toEqual({
      result: { image: "/9j/4AAQ" },
      mime: "image/jpeg",
      model: "@cf/stabilityai/stable-diffusion-xl-base-1.0",
    });
    expect(runMock).toHaveBeenNthCalledWith(
      2,
      "@cf/stabilityai/stable-diffusion-xl-base-1.0",
      { prompt: "Minimalist studio", num_steps: 12, width: 768, height: 768 },
      {
        gateway: {
          id: "gw-images",
          skipCache: true,
          collectLog: false,
        },
      },
    );

    const arrayBytesRes = await signAndPost({
      prompt: "Coffee bar",
      steps: 4,
    });
    expect(arrayBytesRes.status).toBe(200);
    expect(await arrayBytesRes.json()).toEqual({
      result: { image: "iVBORw==" },
      mime: "image/jpeg",
      model: "@cf/black-forest-labs/flux-1-schnell",
    });
  });

  it("serves signed /analytics/site queries from Cloudflare GraphQL Analytics", async () => {
    const worker = createApiWorker();
    const secret = "analytics-worker-secret";
    const env: ApiWorkerEnv = {
      WORKER_SHARED_SECRET: secret,
      CLOUDFLARE_ANALYTICS_API_TOKEN: "cf-analytics-token",
      ROOT_DOMAIN: "get-on.tech",
    };

    const unsigned = await worker.fetch(
      new Request("https://api.get-on.tech/analytics/site", {
        method: "POST",
        body: JSON.stringify({ hostnames: ["rosebakery.get-on.tech"], range: "7d" }),
      }),
      env,
    );
    expect(unsigned.status).toBe(401);

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/client/v4/zones?")) {
        return new Response(
          JSON.stringify({ success: true, result: [{ id: "zone-auto-123" }] }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url.includes("/client/v4/graphql")) {
        const body = JSON.parse(String(init?.body)) as {
          variables: { zoneTag: string; filter: { clientRequestHTTPHost_in: string[] } };
        };
        expect(body.variables.zoneTag).toBe("zone-auto-123");
        expect(body.variables.filter.clientRequestHTTPHost_in).toEqual([
          "rosebakery.get-on.tech",
          "rosebakery.com",
        ]);
        const today = new Date().toISOString().slice(0, 10);
        return new Response(
          JSON.stringify({
            data: {
              viewer: {
                zones: [
                  {
                    daily: [
                      { count: 14, sum: { visits: 9 }, dimensions: { date: today } },
                    ],
                    countries: [
                      { count: 10, sum: { visits: 6 }, dimensions: { clientCountryName: "KE" } },
                      { count: 4, sum: { visits: 3 }, dimensions: { clientCountryName: "US" } },
                    ],
                    referrers: [
                      { count: 6, sum: { visits: 4 }, dimensions: { clientRefererHost: "" } },
                      { count: 5, sum: { visits: 3 }, dimensions: { clientRefererHost: "www.google.com" } },
                      { count: 3, sum: { visits: 2 }, dimensions: { clientRefererHost: "t.co" } },
                    ],
                    pages: [
                      { count: 11, sum: { visits: 7 }, dimensions: { clientRequestPath: "/" } },
                      { count: 2, sum: { visits: 2 }, dimensions: { clientRequestPath: "/_gs/stats" } },
                      { count: 3, sum: { visits: 2 }, dimensions: { clientRequestPath: "/menu" } },
                    ],
                    devices: [
                      { count: 9, sum: { visits: 6 }, dimensions: { clientDeviceType: "mobile" } },
                      { count: 5, sum: { visits: 3 }, dimensions: { clientDeviceType: "desktop" } },
                    ],
                  },
                ],
              },
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response("Not found", { status: 404 });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const body = JSON.stringify({
      hostnames: ["rosebakery.get-on.tech", "rosebakery.com"],
      range: "7d",
    });
    const ts = String(Date.now());
    const host = "api.get-on.tech";
    const sig = await signWorkerRequest(secret, {
      ts,
      host,
      ip: "",
      bodyHash: await sha256Hex(body),
    });

    const res = await worker.fetch(
      new Request("https://api.get-on.tech/analytics/site", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-gs-host": host,
          "x-gs-ip": "",
          "x-gs-ts": ts,
          "x-gs-sig": sig,
        },
        body,
      }),
      env,
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      ok: boolean;
      visitors: number;
      views: number;
      countries: Array<{ code: string; name: string; visitors: number }>;
      referrers: Array<{ source: string; visitors: number }>;
      pages: Array<{ path: string }>;
      devices: Array<{ device: string }>;
    };
    expect(json.ok).toBe(true);
    expect(json.visitors).toBe(9);
    expect(json.views).toBe(14);
    expect(json.countries[0]).toMatchObject({ code: "KE", name: "Kenya", visitors: 6 });
    expect(json.referrers.map((r) => r.source)).toEqual(["Direct", "google.com", "x.com"]);
    expect(json.pages.map((p) => p.path)).toEqual(["/", "/menu"]);
    expect(json.devices.map((d) => d.device)).toEqual(["Mobile", "Desktop"]);
  });
});

