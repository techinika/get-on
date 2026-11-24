import { describe, expect, it } from "vitest";
import type { CacheLike, R2ObjectLike, WorkerEnv } from "../src/env";
import { createSiteWorker } from "../src/worker";

type FakeObject = R2ObjectLike;

function objectOf(
  text: string,
  contentType = "text/html; charset=utf-8",
): FakeObject {
  const bytes = new TextEncoder().encode(text);
  return {
    etag: "abc123",
    httpEtag: '"abc123"',
    size: bytes.byteLength,
    httpMetadata: { contentType },
    async arrayBuffer() {
      return bytes.buffer.slice(0) as ArrayBuffer;
    },
  };
}

class FakeKv {
  values = new Map<string, unknown>();
  async get(key: string, options?: { type?: "json"; cacheTtl?: number }) {
    void options;
    return this.values.get(key) ?? null;
  }
}

class FakeBucket {
  objects = new Map<string, FakeObject>();
  async get(key: string) {
    return this.objects.get(key) ?? null;
  }
}

class FakeCache implements CacheLike {
  entries = new Map<string, Response>();
  puts: string[] = [];
  async match(request: Request) {
    return this.entries.get(request.url)?.clone();
  }
  async put(request: Request, response: Response) {
    this.puts.push(request.url);
    this.entries.set(request.url, response.clone());
  }
}

function buildEnv(options: {
  hostname?: string;
  state?: "live" | "unpublished" | "suspended";
  publishId?: string;
  pointer?: boolean;
  files?: Record<string, FakeObject>;
}): WorkerEnv {
  const hostname = options.hostname ?? "rosebakery.get-on.tech";
  const kv = new FakeKv();
  if (options.pointer !== false) {
    kv.values.set(`host:${hostname}`, {
      siteId: "site-1",
      publishId: options.publishId ?? "pub-1",
      state: options.state ?? "live",
      builtAt: "2026-10-22T10:00:00.000Z",
      plan: "starter",
    });
  }
  const bucket = new FakeBucket();
  for (const [path, object] of Object.entries(options.files ?? {})) {
    bucket.objects.set(path, object);
  }
  return {
    SITES_KV: kv,
    SITES_BUCKET: bucket,
    ROOT_DOMAIN: "get-on.tech",
  };
}

function liveEnv(publishId = "pub-1") {
  return buildEnv({
    publishId,
    files: {
      [`sites/site-1/v/${publishId}/index.html`]: objectOf(
        "<!doctype html><title>Rose Bakery</title>",
      ),
      [`sites/site-1/v/${publishId}/assets/app.css`]: objectOf(
        ".gs-root{color:red}",
        "text/css; charset=utf-8",
      ),
    },
  });
}

function requestFor(
  host = "rosebakery.get-on.tech",
  path = "/",
  init: RequestInit = {},
) {
  return new Request(`https://${host}${path}`, {
    ...init,
    headers: { host, ...(init.headers as Record<string, string>) },
  });
}

function context() {
  const pending: Promise<unknown>[] = [];
  return {
    pending,
    ctx: {
      waitUntil(promise: Promise<unknown>) {
        pending.push(promise);
      },
    },
  };
}

describe("sites worker", () => {
  it("serves the index page with security headers", async () => {
    const worker = createSiteWorker({ cache: null });
    const response = await worker.fetch(requestFor(), liveEnv());

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "text/html; charset=utf-8",
    );
    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=60, stale-while-revalidate=300",
    );
    expect(response.headers.get("strict-transport-security")).toContain(
      "max-age=31536000",
    );
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(await response.text()).toContain("Rose Bakery");
  });

  it("serves an asset with a long cache", async () => {
    const worker = createSiteWorker({ cache: null });
    const response = await worker.fetch(
      requestFor("rosebakery.get-on.tech", "/assets/app.css"),
      liveEnv(),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=31536000, immutable",
    );
    expect(await response.text()).toBe(".gs-root{color:red}");
  });

  it("answers a matching etag with 304", async () => {
    const worker = createSiteWorker({ cache: null });
    const response = await worker.fetch(
      requestFor("rosebakery.get-on.tech", "/", {
        headers: { "if-none-match": '"abc123"' },
      }),
      liveEnv(),
    );

    expect(response.status).toBe(304);
    expect(await response.text()).toBe("");
  });

  it("answers HEAD without a body", async () => {
    const worker = createSiteWorker({ cache: null });
    const response = await worker.fetch(
      requestFor("rosebakery.get-on.tech", "/", { method: "HEAD" }),
      liveEnv(),
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
    expect(response.headers.get("content-length")).toBe(
      String("<title>Rose Bakery</title>".length + "<!doctype html>".length),
    );
  });

  it("returns the platform page for an unknown site", async () => {
    const worker = createSiteWorker({ cache: null });
    const response = await worker.fetch(
      requestFor("missing.get-on.tech"),
      buildEnv({ hostname: "missing.get-on.tech", pointer: false }),
    );

    expect(response.status).toBe(404);
    expect(response.headers.get("x-robots-tag")).toBe("noindex");
  });

  it("returns a suspended page and never caches it", async () => {
    const cache = new FakeCache();
    const worker = createSiteWorker({ cache });
    const response = await worker.fetch(
      requestFor(),
      buildEnv({ state: "suspended" }),
    );

    expect(response.status).toBe(403);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(cache.puts).toEqual([]);
  });

  it("returns not published for an unpublished site", async () => {
    const worker = createSiteWorker({ cache: null });
    const response = await worker.fetch(
      requestFor(),
      buildEnv({ state: "unpublished" }),
    );

    expect(response.status).toBe(404);
    expect(await response.text()).toContain("not live yet");
  });

  it("caches a live page under a key that contains the publish id", async () => {
    const cache = new FakeCache();
    const worker = createSiteWorker({ cache });
    const pending = context();

    const first = await worker.fetch(requestFor(), liveEnv(), pending.ctx);
    await Promise.all(pending.pending);

    expect(first.status).toBe(200);
    expect(cache.puts).toHaveLength(1);
    expect(cache.puts[0]).toContain("/pub-1/");

    const second = await worker.fetch(requestFor(), liveEnv(), pending.ctx);
    expect(second.status).toBe(200);
    expect(await second.text()).toContain("Rose Bakery");
    expect(cache.puts).toHaveLength(1);
  });

  it("uses a new cache key after a publish", async () => {
    const cache = new FakeCache();
    const worker = createSiteWorker({ cache });
    const pending = context();

    await worker.fetch(requestFor(), liveEnv("pub-1"), pending.ctx);
    await Promise.all(pending.pending);
    await worker.fetch(requestFor(), liveEnv("pub-2"), pending.ctx);
    await Promise.all(pending.pending);

    expect(cache.puts).toHaveLength(2);
    expect(cache.puts[1]).toContain("/pub-2/");
  });

  it("does not cache pages that are not found", async () => {
    const cache = new FakeCache();
    const worker = createSiteWorker({ cache });
    const pending = context();

    const response = await worker.fetch(
      requestFor("rosebakery.get-on.tech", "/missing"),
      liveEnv(),
      pending.ctx,
    );
    await Promise.all(pending.pending);

    expect(response.status).toBe(404);
    expect(cache.puts).toEqual([]);
  });

  it("refuses methods other than GET and HEAD", async () => {
    const worker = createSiteWorker({ cache: null });
    const response = await worker.fetch(
      requestFor("rosebakery.get-on.tech", "/", { method: "POST" }),
      liveEnv(),
    );

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET, HEAD");
  });
});


describe("tracked links", () => {
  it("redirects a short link without reading or filling the cache", async () => {
    const env = liveEnv();
    const kv = env.SITES_KV as FakeKv;
    kv.values.set("link:abcdefgh", {
      v: 1,
      siteId: "site-1",
      projectId: "site-1",
      targetPath: "/about",
      params: { utm_source: "qr" },
      active: true,
    });
    const cache = new FakeCache();
    cache.entries.set(
      "https://rosebakery.get-on.tech/__cache/pub-1/_l/abcdefgh",
      new Response("cached", { status: 200 }),
    );
    const worker = createSiteWorker({ cache });
    const response = await worker.fetch(requestFor("rosebakery.get-on.tech", "/_l/abcdefgh"), env);
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://rosebakery.get-on.tech/about?utm_source=qr",
    );
    expect(cache.puts).toHaveLength(0);
  });

  it("does not cache a revoked link page", async () => {
    const env = liveEnv();
    const kv = env.SITES_KV as FakeKv;
    kv.values.set("link:abcdefgh", {
      v: 1,
      siteId: "site-1",
      projectId: "site-1",
      targetPath: "/about",
      params: {},
      active: false,
    });
    const cache = new FakeCache();
    const worker = createSiteWorker({ cache });
    const response = await worker.fetch(requestFor("rosebakery.get-on.tech", "/_l/abcdefgh"), env);
    expect(response.status).toBe(410);
    expect(cache.puts).toHaveLength(0);
  });
});

describe("health, CSP, and interactive endpoints", () => {
  it("answers /_gs/health with 200 ok without touching the cache", async () => {
    const cache = new FakeCache();
    const env = buildEnv({ state: "unpublished" });
    const worker = createSiteWorker({ cache });
    const pending = context();
    const response = await worker.fetch(
      requestFor("rosebakery.get-on.tech", "/_gs/health"),
      env,
      pending.ctx,
    );
    await Promise.all(pending.pending);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("ok");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(cache.puts).toHaveLength(0);
  });

  it("includes strict self-hosted script CSP on HTML pages", async () => {
    const worker = createSiteWorker({ cache: null });
    const response = await worker.fetch(requestFor(), liveEnv());
    const csp = response.headers.get("content-security-policy") ?? "";
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("frame-src 'self' https://www.youtube-nocookie.com https://player.vimeo.com");
  });

  it("serves _plugins sandbox documents and JS assets with isolated CSP and SAMEORIGIN framing", async () => {
    const env = buildEnv({
      files: {
        "sites/site-1/v/pub-1/index.html": objectOf("<!doctype html><title>Rose Bakery</title>"),
        "sites/site-1/v/pub-1/_plugins/chat-widget/index.html": objectOf(
          '<!doctype html><script src="/_plugins/chat-widget/plugin-deadbeef.js" defer></script>',
          "text/html; charset=utf-8",
        ),
        "sites/site-1/v/pub-1/_plugins/weather-widget/net.html": objectOf(
          '<!doctype html><script src="/_plugins/weather-widget/plugin-cafebabe.js" defer></script>',
          "text/html; charset=utf-8",
        ),
        "sites/site-1/v/pub-1/_plugins/chat-widget/plugin-deadbeef.js": objectOf(
          '"use strict";',
          "text/javascript; charset=utf-8",
        ),
      },
    });
    const worker = createSiteWorker({ cache: null });

    const offlineRes = await worker.fetch(
      requestFor("rosebakery.get-on.tech", "/_plugins/chat-widget/index.html"),
      env,
    );
    expect(offlineRes.status).toBe(200);
    expect(offlineRes.headers.get("x-frame-options")).toBe("SAMEORIGIN");
    expect(offlineRes.headers.get("referrer-policy")).toBe("no-referrer");
    expect(offlineRes.headers.get("permissions-policy")).toContain("camera=()");
    expect(offlineRes.headers.get("x-robots-tag")).toBe("noindex");
    const offlineCsp = offlineRes.headers.get("content-security-policy") ?? "";
    expect(offlineCsp).toContain("frame-ancestors 'self'");
    expect(offlineCsp).toContain("script-src 'self'");
    expect(offlineCsp).toContain("connect-src 'none'");
    expect(offlineCsp).toContain("base-uri 'none'");
    expect(offlineCsp).toContain("form-action 'none'");

    const netRes = await worker.fetch(
      requestFor("rosebakery.get-on.tech", "/_plugins/weather-widget/net.html"),
      env,
    );
    expect(netRes.status).toBe(200);
    expect(netRes.headers.get("x-frame-options")).toBe("SAMEORIGIN");
    const netCsp = netRes.headers.get("content-security-policy") ?? "";
    expect(netCsp).toContain("frame-ancestors 'self'");
    expect(netCsp).toContain("connect-src https:");
    expect(netCsp).toContain("script-src 'self'");

    const jsRes = await worker.fetch(
      requestFor("rosebakery.get-on.tech", "/_plugins/chat-widget/plugin-deadbeef.js"),
      env,
    );
    expect(jsRes.status).toBe(200);
    expect(jsRes.headers.get("content-type")).toBe("text/javascript; charset=utf-8");
    expect(jsRes.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
  });

  it("issues signed form tokens and forwards signed submissions", async () => {
    const cache = new FakeCache();
    const env: WorkerEnv = {
      ...liveEnv(),
      FORM_TOKEN_SECRET: "form-secret-test-value",
      WORKER_SHARED_SECRET: "worker-secret-test-value",
      APP_ORIGIN: "https://app.get-on.tech",
    };
    const worker = createSiteWorker({ cache });

    const tokenRes = await worker.fetch(
      requestFor("rosebakery.get-on.tech", "/_forms/contact1/token"),
      env,
    );
    expect(tokenRes.status).toBe(200);
    const tokenBody = (await tokenRes.json()) as { ok: boolean; token: string };
    expect(tokenBody.ok).toBe(true);
    expect(tokenBody.token).toContain(".");
    expect(cache.puts).toHaveLength(0);

    const originalFetch = globalThis.fetch;
    let capturedUrl = "";
    let capturedSig = "";
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = String(input);
      const headers = new Headers(init?.headers);
      capturedSig = headers.get("x-gs-sig") ?? "";
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;

    try {
      const submitRes = await worker.fetch(
        requestFor("rosebakery.get-on.tech", "/_forms/contact1", {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            name: "Ada",
            email: "ada@example.com",
            message: "Hello there!",
            _t: tokenBody.token,
          }).toString(),
        }),
        env,
      );
      expect(submitRes.status).toBe(200);
      expect(capturedUrl).toBe("https://app.get-on.tech/api/public/forms/contact1");
      expect(capturedSig).toMatch(/^[a-f0-9]{64}$/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

