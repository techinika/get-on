import {
  fetchCloudflareSiteAnalytics,
  normalizeAnalyticsHostnames,
  normalizeAnalyticsRange,
  sha256Hex,
  verifyWorkerRequest,
} from "@get-on/site-server";
import type {
  AiRunOptions,
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

const MODEL_ID_RE = /^@[a-z0-9_-]+\/[a-z0-9._/-]+$/i;

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
  requireConfiguredSecret = false,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const secret = (env.WORKER_SHARED_SECRET ?? "").trim();
  if (!secret) {
    if (requireConfiguredSecret) {
      return { ok: false, status: 503, error: "WORKER_SHARED_SECRET_NOT_CONFIGURED" };
    }
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

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function streamToBytes(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.byteLength;
    }
  }
  const combined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return combined;
}

const DEFAULT_IMAGE_MODEL = "@cf/black-forest-labs/flux-1-schnell";

function cleanBase64Image(value: string): string {
  return value
    .replace(/^data:image\/[a-z0-9.+-]+;base64,/i, "")
    .replace(/\s+/g, "");
}

function binaryToBytes(value: unknown): Uint8Array | null {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  if (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((entry) => typeof entry === "number" && entry >= 0 && entry <= 255)
  ) {
    return new Uint8Array(value);
  }
  return null;
}

function extractNormalizedImage(value: unknown): string | null {
  if (typeof value === "string") {
    const cleaned = cleanBase64Image(value);
    return cleaned.length > 0 ? cleaned : null;
  }
  const bytes = binaryToBytes(value);
  if (bytes && bytes.length > 0) {
    return bytesToBase64(bytes);
  }
  return null;
}

async function normalizeModelRunResult(rawResult: unknown): Promise<Record<string, unknown>> {
  if (typeof ReadableStream !== "undefined" && rawResult instanceof ReadableStream) {
    const bytes = await streamToBytes(rawResult as ReadableStream<Uint8Array>);
    return { result: { image: bytesToBase64(bytes) } };
  }
  if (typeof Response !== "undefined" && rawResult instanceof Response) {
    const bytes = new Uint8Array(await rawResult.arrayBuffer());
    return { result: { image: bytesToBase64(bytes) } };
  }
  if (typeof Blob !== "undefined" && rawResult instanceof Blob) {
    const bytes = new Uint8Array(await rawResult.arrayBuffer());
    return { result: { image: bytesToBase64(bytes) } };
  }
  const directBytes = binaryToBytes(rawResult);
  if (directBytes) {
    return { result: { image: bytesToBase64(directBytes) } };
  }
  if (rawResult && typeof rawResult === "object") {
    const obj = rawResult as Record<string, unknown>;
    const inner =
      obj.result && typeof obj.result === "object"
        ? (obj.result as Record<string, unknown>)
        : obj;
    const usage =
      inner.usage && typeof inner.usage === "object"
        ? inner.usage
        : obj.usage && typeof obj.usage === "object"
          ? obj.usage
          : undefined;
    const maybeImage = extractNormalizedImage(inner.image ?? obj.image);
    if (maybeImage) {
      return {
        result: {
          ...(inner !== obj ? inner : obj),
          image: maybeImage,
        },
        ...(usage ? { usage } : {}),
      };
    }
    if ("result" in obj) {
      return obj;
    }
    return { result: obj, ...(usage ? { usage } : {}) };
  }
  return { result: { response: String(rawResult ?? "") } };
}

function buildAiRunOptions(
  gatewayIdRaw: unknown,
  metadataRaw: unknown,
  env: ApiWorkerEnv,
): AiRunOptions | undefined {
  const gatewayId =
    typeof gatewayIdRaw === "string" && gatewayIdRaw.trim()
      ? gatewayIdRaw.trim()
      : (env.AI_GATEWAY_ID ?? "").trim();
  if (!gatewayId) return undefined;

  const metadata =
    metadataRaw && typeof metadataRaw === "object" && !Array.isArray(metadataRaw)
      ? Object.fromEntries(
          Object.entries(metadataRaw as Record<string, unknown>)
            .filter(([, v]) => typeof v === "string" && v.length > 0)
            .map(([k, v]) => [k, String(v)]),
        )
      : undefined;

  return {
    gateway: {
      id: gatewayId,
      skipCache: true,
      collectLog: false,
      ...(metadata && Object.keys(metadata).length > 0 ? { metadata } : {}),
    },
  };
}

function mapAiErrorResponse(error: unknown): Response {
  const rec =
    error && typeof error === "object"
      ? (error as { status?: number; code?: string | number; message?: string; name?: string })
      : {};
  const message =
    typeof rec.message === "string" && rec.message
      ? rec.message
      : error instanceof Error
        ? error.message
        : "Workers AI request failed";
  const lower = message.toLowerCase();
  const isRateLimit =
    rec.status === 429 ||
    String(rec.code ?? "") === "3036" ||
    lower.includes("rate limit") ||
    lower.includes("too many requests");
  const isTimeout =
    rec.name === "AbortError" ||
    rec.name === "TimeoutError" ||
    lower.includes("timed out");
  const status = isRateLimit ? 429 : isTimeout ? 504 : rec.status && rec.status >= 400 ? rec.status : 502;
  return jsonResponse(status, {
    errors: [
      {
        code: rec.code ?? (isRateLimit ? 3036 : status),
        message,
      },
    ],
  });
}

function normalizeChatResponse(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object") {
    return { choices: [], usage: {} };
  }
  const obj = raw as Record<string, unknown>;
  if (Array.isArray(obj.choices)) {
    return obj;
  }
  const nested =
    obj.result && typeof obj.result === "object"
      ? (obj.result as Record<string, unknown>)
      : obj;

  const responseVal = nested.response;
  const content =
    typeof responseVal === "string"
      ? responseVal
      : responseVal && typeof responseVal === "object"
        ? JSON.stringify(responseVal)
        : typeof nested.content === "string"
          ? nested.content
          : "";
  const toolCalls = Array.isArray(nested.tool_calls) ? nested.tool_calls : undefined;
  const usage =
    nested.usage && typeof nested.usage === "object" ? nested.usage : obj.usage ?? {};

  return {
    choices: [
      {
        message: {
          role: "assistant",
          content,
          ...(toolCalls ? { tool_calls: toolCalls } : {}),
        },
      },
    ],
    usage,
  };
}

async function handleAiChatCompletions(
  request: Request,
  env: ApiWorkerEnv,
): Promise<Response> {
  if (!env.AI) {
    return jsonResponse(503, {
      errors: [{ code: "AI_BINDING_MISSING", message: "Cloudflare Workers AI binding is not configured." }],
    });
  }
  const rawBody = await request.text();
  const verified = await verifySignedEdgePayload(request, rawBody, env, true);
  if (!verified.ok) {
    return jsonResponse(verified.status, {
      errors: [{ code: verified.status, message: verified.error }],
    });
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return jsonResponse(400, { errors: [{ code: 400, message: "Invalid JSON body." }] });
  }

  const model = typeof parsed.model === "string" ? parsed.model.trim() : "";
  if (!model || !MODEL_ID_RE.test(model)) {
    return jsonResponse(400, { errors: [{ code: 400, message: "Invalid model identifier." }] });
  }

  const inputs: Record<string, unknown> = {
    messages: Array.isArray(parsed.messages) ? parsed.messages : [],
  };
  if (Array.isArray(parsed.tools) && parsed.tools.length > 0) inputs.tools = parsed.tools;
  if (parsed.tool_choice !== undefined) inputs.tool_choice = parsed.tool_choice;
  if (typeof parsed.max_tokens === "number") inputs.max_tokens = parsed.max_tokens;
  if (typeof parsed.temperature === "number") inputs.temperature = parsed.temperature;
  if (parsed.response_format && typeof parsed.response_format === "object") {
    inputs.response_format = parsed.response_format;
  }

  const runOptions = buildAiRunOptions(parsed.gatewayId, parsed.metadata, env);

  try {
    const rawResult = await env.AI.run(model, inputs, runOptions);
    return jsonResponse(200, normalizeChatResponse(rawResult));
  } catch (error) {
    return mapAiErrorResponse(error);
  }
}

async function handleAiModelRun(
  request: Request,
  env: ApiWorkerEnv,
  modelFromPath?: string,
): Promise<Response> {
  if (!env.AI) {
    return jsonResponse(503, {
      errors: [{ code: "AI_BINDING_MISSING", message: "Cloudflare Workers AI binding is not configured." }],
    });
  }
  const rawBody = await request.text();
  const verified = await verifySignedEdgePayload(request, rawBody, env, true);
  if (!verified.ok) {
    return jsonResponse(verified.status, {
      errors: [{ code: verified.status, message: verified.error }],
    });
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return jsonResponse(400, { errors: [{ code: 400, message: "Invalid JSON body." }] });
  }

  const model = (
    (typeof parsed.model === "string" ? parsed.model : modelFromPath) ?? ""
  ).trim();
  if (!model || !MODEL_ID_RE.test(model)) {
    return jsonResponse(400, { errors: [{ code: 400, message: "Invalid model identifier." }] });
  }

  const inputs =
    parsed.inputs && typeof parsed.inputs === "object" && !Array.isArray(parsed.inputs)
      ? (parsed.inputs as Record<string, unknown>)
      : Object.fromEntries(
          Object.entries(parsed).filter(
            ([key]) => key !== "model" && key !== "gatewayId" && key !== "metadata",
          ),
        );

  const runOptions = buildAiRunOptions(parsed.gatewayId, parsed.metadata, env);

  try {
    const rawResult = await env.AI.run(model, inputs, runOptions);
    return jsonResponse(200, await normalizeModelRunResult(rawResult));
  } catch (error) {
    return mapAiErrorResponse(error);
  }
}

async function handleAiImageGenerate(
  request: Request,
  env: ApiWorkerEnv,
): Promise<Response> {
  if (!env.AI) {
    return jsonResponse(503, {
      errors: [{ code: "AI_BINDING_MISSING", message: "Cloudflare Workers AI binding is not configured." }],
    });
  }
  const rawBody = await request.text();
  const verified = await verifySignedEdgePayload(request, rawBody, env, true);
  if (!verified.ok) {
    return jsonResponse(verified.status, {
      errors: [{ code: verified.status, message: verified.error }],
    });
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return jsonResponse(400, { errors: [{ code: 400, message: "Invalid JSON body." }] });
  }

  const rawModel = typeof parsed.model === "string" ? parsed.model.trim() : "";
  const model = rawModel || DEFAULT_IMAGE_MODEL;
  if (!MODEL_ID_RE.test(model)) {
    return jsonResponse(400, { errors: [{ code: 400, message: "Invalid model identifier." }] });
  }

  const rawInputs =
    parsed.inputs && typeof parsed.inputs === "object" && !Array.isArray(parsed.inputs)
      ? (parsed.inputs as Record<string, unknown>)
      : parsed;
  const prompt = typeof rawInputs.prompt === "string" ? rawInputs.prompt.trim() : "";
  if (!prompt || prompt.length > 4000) {
    return jsonResponse(400, {
      errors: [{ code: 400, message: "A valid image prompt (1-4000 chars) is required." }],
    });
  }

  const isFlux = model.toLowerCase().includes("flux");
  const inputs: Record<string, unknown> = { prompt };
  const stepsVal =
    typeof rawInputs.steps === "number" && Number.isFinite(rawInputs.steps)
      ? Math.max(1, Math.min(20, Math.round(rawInputs.steps)))
      : undefined;
  const numStepsVal =
    typeof rawInputs.num_steps === "number" && Number.isFinite(rawInputs.num_steps)
      ? Math.max(1, Math.min(20, Math.round(rawInputs.num_steps)))
      : stepsVal;

  if (isFlux) {
    if (stepsVal !== undefined) {
      inputs.steps = Math.min(8, stepsVal);
    }
  } else {
    if (numStepsVal !== undefined) inputs.num_steps = numStepsVal;
    if (typeof rawInputs.width === "number" && Number.isFinite(rawInputs.width)) {
      inputs.width = Math.max(256, Math.min(2048, Math.round(rawInputs.width)));
    }
    if (typeof rawInputs.height === "number" && Number.isFinite(rawInputs.height)) {
      inputs.height = Math.max(256, Math.min(2048, Math.round(rawInputs.height)));
    }
  }

  const runOptions = buildAiRunOptions(parsed.gatewayId, parsed.metadata, env);

  try {
    const rawResult = await env.AI.run(model, inputs, runOptions);
    if (typeof rawResult === "string") {
      const cleaned = cleanBase64Image(rawResult);
      if (!cleaned) {
        return jsonResponse(502, {
          errors: [{ code: "AI_BAD_RESULT", message: "Image model returned empty output." }],
        });
      }
      return jsonResponse(200, {
        result: { image: cleaned },
        mime: "image/jpeg",
        model,
      });
    }

    const normalized = await normalizeModelRunResult(rawResult);
    const resultObj =
      normalized.result && typeof normalized.result === "object"
        ? (normalized.result as Record<string, unknown>)
        : {};
    const image = extractNormalizedImage(resultObj.image);
    if (!image) {
      return jsonResponse(502, {
        errors: [{ code: "AI_BAD_RESULT", message: "Image model returned empty output." }],
      });
    }
    return jsonResponse(200, {
      result: { image },
      mime: "image/jpeg",
      model,
      ...(normalized.usage && typeof normalized.usage === "object"
        ? { usage: normalized.usage }
        : resultObj.usage && typeof resultObj.usage === "object"
          ? { usage: resultObj.usage }
          : {}),
    });
  } catch (error) {
    return mapAiErrorResponse(error);
  }
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

async function handleAnalyticsSite(
  request: Request,
  env: ApiWorkerEnv,
): Promise<Response> {
  const rawBody = await request.text();
  const verified = await verifySignedEdgePayload(request, rawBody, env, true);
  if (!verified.ok) {
    return jsonResponse(verified.status, {
      ok: false,
      error: verified.error,
    });
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return jsonResponse(400, { ok: false, error: "INVALID_JSON" });
  }

  const hostnames = normalizeAnalyticsHostnames(
    Array.isArray(parsed.hostnames)
      ? parsed.hostnames.filter((v): v is string => typeof v === "string")
      : [],
  );
  if (hostnames.length === 0) {
    return jsonResponse(400, { ok: false, error: "NO_HOSTNAMES" });
  }

  const apiToken = (
    env.CLOUDFLARE_ANALYTICS_API_TOKEN ||
    env.CLOUDFLARE_API_TOKEN ||
    env.CF_API_TOKEN_DOMAINS ||
    ""
  ).trim();
  if (!apiToken) {
    return jsonResponse(503, { ok: false, error: "ANALYTICS_NOT_CONFIGURED" });
  }

  const range = normalizeAnalyticsRange(
    typeof parsed.range === "string" ? parsed.range : undefined,
  );
  const zoneId =
    typeof parsed.zoneId === "string" && parsed.zoneId.trim()
      ? parsed.zoneId.trim()
      : (env.CLOUDFLARE_ZONE_ID || env.CF_SAAS_ZONE_ID || "").trim() || undefined;
  const rootDomain =
    typeof parsed.rootDomain === "string" && parsed.rootDomain.trim()
      ? parsed.rootDomain.trim()
      : (env.ROOT_DOMAIN ?? "get-on.tech").trim();

  const analytics = await fetchCloudflareSiteAnalytics({
    apiToken,
    hostnames,
    range,
    zoneId,
    rootDomain,
  });

  if (!analytics.ok) {
    const status =
      analytics.errorCode === "CLOUDFLARE_UNAUTHORIZED"
        ? 403
        : analytics.errorCode === "ANALYTICS_NOT_CONFIGURED" ||
            analytics.errorCode === "ZONE_NOT_CONFIGURED"
          ? 503
          : 502;
    return jsonResponse(status, {
      ok: false,
      error: analytics.errorCode ?? "CLOUDFLARE_GRAPHQL_ERROR",
      message: analytics.errorMessage,
    });
  }

  return jsonResponse(200, analytics as unknown as Record<string, unknown>);
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
        return jsonResponse(200, { ok: true, service: "get-on-api" });
      }

      if (pathname === "/ai/v1/chat/completions") {
        if (request.method !== "POST") {
          return jsonResponse(405, { ok: false, error: "METHOD_NOT_ALLOWED" }, { Allow: "POST" });
        }
        return handleAiChatCompletions(request, env);
      }

      if (pathname === "/ai/images/generate") {
        if (request.method !== "POST") {
          return jsonResponse(405, { ok: false, error: "METHOD_NOT_ALLOWED" }, { Allow: "POST" });
        }
        return handleAiImageGenerate(request, env);
      }

      if (pathname === "/ai/run" || pathname.startsWith("/ai/run/")) {
        if (request.method !== "POST") {
          return jsonResponse(405, { ok: false, error: "METHOD_NOT_ALLOWED" }, { Allow: "POST" });
        }
        const modelFromPath =
          pathname.length > "/ai/run/".length ? pathname.slice("/ai/run/".length) : undefined;
        return handleAiModelRun(request, env, modelFromPath);
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

      if (pathname === "/analytics/site") {
        if (request.method !== "POST") {
          return jsonResponse(405, { ok: false, error: "METHOD_NOT_ALLOWED" }, { Allow: "POST" });
        }
        return handleAnalyticsSite(request, env);
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
