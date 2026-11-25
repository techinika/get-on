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
});
