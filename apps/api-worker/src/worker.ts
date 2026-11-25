import { sha256Hex, verifyWorkerRequest } from "@get-on/site-server";
import type {
  ApiWorkerEnv,
  ExecutionContextLike,
  JobMessageBody,
  MessageBatchLike,
  ScheduledControllerLike,
} from "./env.js";

const DEFAULT_CRON_JOBS = [
  "ai.monthly",
  "ai.expire",
  "ai.payloads",
  "domains.verify",
  "domains.poll",
  "domains.health",
  "domains.plan",
  "domains.cleanup",
];

const CRON_JOB_MAP: Record<string, string[]> = {
  "*/5 * * * *": ["domains.verify", "domains.poll", "ai.payloads"],
  "0 * * * *": ["domains.health", "ai.expire"],
  "0 1 * * *": DEFAULT_CRON_JOBS,
};

const SECURITY_HEADERS: Record<string, string> = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex",
};

function constantTimeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const aBytes = enc.encode(a);
  const bBytes = enc.encode(b);
  const maxLen = Math.max(aBytes.length, bBytes.length);
  let diff = aBytes.length ^ bBytes.length;
  for (let i = 0; i < maxLen; i += 1) {
    diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }
  return diff === 0;
}

function jsonResponse(
  status: number,
  body: Record<string, unknown>,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...SECURITY_HEADERS,
      ...extraHeaders,
    },
  });
}

function resolveBearerAuthorized(request: Request, env: ApiWorkerEnv): boolean {
  const secret = (env.CRON_SECRET || env.JOBS_SECRET || "").trim();
  if (!secret) return false;
  const auth = request.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return false;
  const token = auth.slice("Bearer ".length).trim();
  if (!token) return false;
  return constantTimeEqual(secret, token);
}

function jobsForCronExpression(cron: string): string[] {
  return CRON_JOB_MAP[cron.trim()] ?? DEFAULT_CRON_JOBS;
}

function appOriginOf(env: ApiWorkerEnv): string | null {
  const raw = (env.APP_ORIGIN ?? "").trim().replace(/\/+$/, "");
  return raw || null;
}

function cronSecretOf(env: ApiWorkerEnv): string {
  return (env.CRON_SECRET || env.JOBS_SECRET || "").trim();
}

async function verifySignedEdgePayload(
  request: Request,
  rawBody: string,
  env: ApiWorkerEnv,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const secret = (env.WORKER_SHARED_SECRET ?? "").trim();
  if (!secret) {
    return { ok: true };
  }
  const host = request.headers.get("x-gs-host") ?? "";
  const ip = request.headers.get("x-gs-ip") ?? "";
  const ts = request.headers.get("x-gs-ts") ?? "";
  const sig = request.headers.get("x-gs-sig") ?? "";
  if (!host || !ts || !sig) {
    return { ok: false, status: 401, error: "missing_worker_signature" };
  }
  const bodyHash = await sha256Hex(rawBody);
  const valid = await verifyWorkerRequest(secret, { ts, host, ip, bodyHash, sig });
  if (!valid) {
    return { ok: false, status: 403, error: "invalid_worker_signature" };
  }
  return { ok: true };
}

async function relaySignedPost(
  request: Request,
  upstreamPath: string,
  env: ApiWorkerEnv,
): Promise<Response> {
  const appOrigin = appOriginOf(env);
  if (!appOrigin) {
    return jsonResponse(503, { ok: false, error: "APP_ORIGIN_NOT_CONFIGURED" });
  }

  const rawBody = await request.text();
  const verified = await verifySignedEdgePayload(request, rawBody, env);
  if (!verified.ok) {
    return jsonResponse(verified.status, { ok: false, error: verified.error });
  }

  const forwardHeaders = new Headers();
  for (const name of [
    "content-type",
    "x-gs-host",
    "x-gs-ip",
    "x-gs-ua",
    "x-gs-ts",
    "x-gs-sig",
  ]) {
    const value = request.headers.get(name);
    if (value !== null) {
      forwardHeaders.set(name, value);
    }
  }

  try {
    const upstream = await fetch(`${appOrigin}${upstreamPath}`, {
      method: "POST",
      headers: forwardHeaders,
      body: rawBody,
    });
    const text = await upstream.text();
    const contentType = upstream.headers.get("content-type");
    return new Response(text, {
      status: upstream.status,
      headers: {
        ...(contentType ? { "Content-Type": contentType } : {}),
        ...SECURITY_HEADERS,
      },
    });
  } catch {
    return jsonResponse(503, { ok: false, error: "UPSTREAM_UNAVAILABLE" });
  }
}

async function relayWebhookPost(
  request: Request,
  upstreamPath: string,
  env: ApiWorkerEnv,
): Promise<Response> {
  const appOrigin = appOriginOf(env);
  if (!appOrigin) {
    return jsonResponse(503, { ok: false, error: "APP_ORIGIN_NOT_CONFIGURED" });
  }

  const rawBody = await request.text();
  const forwardHeaders = new Headers();
  for (const [key, value] of request.headers.entries()) {
    const lower = key.toLowerCase();
    if (
      lower === "content-type" ||
      lower.startsWith("x-amz-sns-") ||
      lower === "user-agent"
    ) {
      forwardHeaders.set(key, value);
    }
  }

  try {
    const upstream = await fetch(`${appOrigin}${upstreamPath}`, {
      method: "POST",
      headers: forwardHeaders,
      body: rawBody,
    });
    const text = await upstream.text();
    const contentType = upstream.headers.get("content-type");
    return new Response(text, {
      status: upstream.status,
      headers: {
        ...(contentType ? { "Content-Type": contentType } : {}),
        ...SECURITY_HEADERS,
      },
    });
  } catch {
    return jsonResponse(503, { ok: false, error: "UPSTREAM_UNAVAILABLE" });
  }
}

async function dispatchJobsToOrigin(
  env: ApiWorkerEnv,
  jobs: string[],
  payload?: Record<string, unknown>,
): Promise<{ status: number; body: string; ok: boolean; retryable: boolean }> {
  const appOrigin = appOriginOf(env);
  const secret = cronSecretOf(env);
  if (!appOrigin || !secret) {
    return {
      status: 503,
      body: JSON.stringify({ ok: false, error: "CRON_UPSTREAM_NOT_CONFIGURED" }),
      ok: false,
      retryable: true,
    };
  }
  try {
    const res = await fetch(`${appOrigin}/api/cron/jobs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({
        jobs,
        ...(payload ? { payload } : {}),
      }),
    });
    const body = await res.text();
    const ok = res.status >= 200 && res.status < 300;
    const retryable = res.status === 429 || res.status >= 500;
    return { status: res.status, body, ok, retryable };
  } catch {
    return {
      status: 503,
      body: JSON.stringify({ ok: false, error: "CRON_UPSTREAM_UNREACHABLE" }),
      ok: false,
      retryable: true,
    };
  }
}

export function createApiWorker() {
  return {
    async fetch(
      request: Request,
      env: ApiWorkerEnv,
      _ctx?: ExecutionContextLike,
    ): Promise<Response> {
      const url = new URL(request.url);
      const pathname = url.pathname.replace(/\/+$/, "") || "/";

      if (pathname === "/health" || pathname === "/_gs/health") {
        if (request.method !== "GET" && request.method !== "HEAD") {
          return new Response("Method not allowed", {
            status: 405,
            headers: { Allow: "GET, HEAD", ...SECURITY_HEADERS },
          });
        }
        return jsonResponse(200, { ok: true, service: "get-on-api" }, {
          "Content-Type": "application/json; charset=utf-8",
        });
      }

      if (pathname.startsWith("/api/public/forms/")) {
        if (request.method !== "POST") {
          return jsonResponse(405, { ok: false, error: "METHOD_NOT_ALLOWED" }, { Allow: "POST" });
        }
        const formId = pathname.slice("/api/public/forms/".length);
        if (!formId || formId.includes("/")) {
          return jsonResponse(404, { ok: false, error: "FORM_NOT_FOUND" });
        }
        return relaySignedPost(request, `/api/public/forms/${encodeURIComponent(formId)}`, env);
      }

      if (pathname === "/api/stats/ingest") {
        if (request.method !== "POST") {
          return jsonResponse(405, { ok: false, error: "METHOD_NOT_ALLOWED" }, { Allow: "POST" });
        }
        return relaySignedPost(request, "/api/stats/ingest", env);
      }

      if (pathname === "/webhooks/ses" || pathname === "/api/webhooks/ses") {
        if (request.method !== "POST") {
          return jsonResponse(405, { ok: false, error: "METHOD_NOT_ALLOWED" }, { Allow: "POST" });
        }
        return relayWebhookPost(request, "/api/webhooks/ses", env);
      }

      if (
        pathname === "/cron/trigger" ||
        pathname === "/jobs/run" ||
        pathname === "/queues/enqueue"
      ) {
        if (request.method !== "POST") {
          return jsonResponse(405, { ok: false, error: "METHOD_NOT_ALLOWED" }, { Allow: "POST" });
        }
        if (!resolveBearerAuthorized(request, env)) {
          return jsonResponse(401, { ok: false, error: "UNAUTHORIZED" });
        }

        let parsed: { jobs?: unknown; async?: unknown; payload?: unknown } = {};
        try {
          const text = await request.text();
          if (text.trim()) {
            parsed = JSON.parse(text) as typeof parsed;
          }
        } catch {
          return jsonResponse(400, { ok: false, error: "INVALID_JSON" });
        }

        const requestedJobs = Array.isArray(parsed.jobs)
          ? parsed.jobs.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
          : DEFAULT_CRON_JOBS;
        const jobs = requestedJobs.length > 0 ? requestedJobs : DEFAULT_CRON_JOBS;
        const payload =
          parsed.payload && typeof parsed.payload === "object" && !Array.isArray(parsed.payload)
            ? (parsed.payload as Record<string, unknown>)
            : undefined;
        const shouldQueue = parsed.async !== false && Boolean(env.JOBS_QUEUE);

        if (shouldQueue && env.JOBS_QUEUE) {
          const now = new Date().toISOString();
          await env.JOBS_QUEUE.sendBatch(
            jobs.map((job) => ({
              body: {
                job,
                ...(payload ? { payload } : {}),
                enqueuedAt: now,
              },
            })),
          );
          return jsonResponse(202, { ok: true, queued: jobs });
        }

        const result = await dispatchJobsToOrigin(env, jobs, payload);
        return new Response(result.body, {
          status: result.status,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            ...SECURITY_HEADERS,
          },
        });
      }

      return jsonResponse(404, { ok: false, error: "NOT_FOUND" });
    },

    async scheduled(
      controller: ScheduledControllerLike,
      env: ApiWorkerEnv,
      ctx?: ExecutionContextLike,
    ): Promise<void> {
      const jobs = jobsForCronExpression(controller.cron);
      const enqueuedAt = new Date(controller.scheduledTime || Date.now()).toISOString();
      const work = async () => {
        if (env.JOBS_QUEUE) {
          await env.JOBS_QUEUE.sendBatch(
            jobs.map((job) => ({
              body: {
                job,
                cron: controller.cron,
                enqueuedAt,
              },
            })),
          );
          return;
        }
        await dispatchJobsToOrigin(env, jobs, { cron: controller.cron });
      };
      const promise = work();
      if (ctx?.waitUntil) {
        ctx.waitUntil(promise);
      }
      await promise;
    },

    async queue(
      batch: MessageBatchLike<JobMessageBody>,
      env: ApiWorkerEnv,
      _ctx?: ExecutionContextLike,
    ): Promise<void> {
      for (const message of batch.messages) {
        const job = typeof message.body?.job === "string" ? message.body.job.trim() : "";
        if (!job) {
          message.ack();
          continue;
        }
        const result = await dispatchJobsToOrigin(env, [job], message.body?.payload);
        if (result.ok || !result.retryable) {
          message.ack();
        } else {
          message.retry();
        }
      }
    },
  };
}
