import {
  DEFAULT_ROOT_DOMAIN,
  handleSiteRequest,
  parseHost,
  type SitePointer,
  type SiteStore,
} from "@get-on/site-server";
import type {
  CacheLike,
  ExecutionContextLike,
  WorkerEnv,
} from "./env";
import { createCloudflareStore } from "./store";

const CACHE_PREFIX = "__cache";

export type SiteWorkerOptions = {
  /** Injected in tests. In Cloudflare this defaults to `caches.default`. */
  cache?: CacheLike | null;
};

function defaultCache(): CacheLike | null {
  const globalCaches = (
    globalThis as { caches?: { default?: CacheLike } }
  ).caches;
  return globalCaches?.default ?? null;
}

function rawPathOf(requestUrl: string): string | undefined {
  const scheme = requestUrl.indexOf("://");
  if (scheme === -1) return undefined;
  const pathStart = requestUrl.indexOf("/", scheme + 3);
  if (pathStart === -1) return "/";
  let rest = requestUrl.slice(pathStart);
  const query = rest.indexOf("?");
  if (query !== -1) rest = rest.slice(0, query);
  return rest;
}

function cacheRequestFor(request: Request, publishId: string): Request {
  const url = new URL(request.url);
  const keyUrl = new URL(
    `/${CACHE_PREFIX}/${encodeURIComponent(publishId)}${url.pathname}`,
    url.origin,
  );
  keyUrl.search = url.search;
  const headers = new Headers();
  const acceptEncoding = request.headers.get("accept-encoding");
  if (acceptEncoding) headers.set("accept-encoding", acceptEncoding);
  return new Request(keyUrl, { method: "GET", headers });
}

function memoStore(base: SiteStore): SiteStore {
  let pointer: Promise<SitePointer | null> | null = null;
  return {
    ...base,
    getPointer(hostname: string): Promise<SitePointer | null> {
      if (pointer === null) {
        pointer = base.getPointer(hostname);
      }
      return pointer;
    },
  };
}

async function serve(
  request: Request,
  env: WorkerEnv,
  ctx: ExecutionContextLike | undefined,
  cache: CacheLike | null,
): Promise<Response> {
  const rootDomain = env.ROOT_DOMAIN || DEFAULT_ROOT_DOMAIN;
  const base = createCloudflareStore({
    kv: env.SITES_KV,
    bucket: env.SITES_BUCKET,
  });
  const store = memoStore(base);

  let key: Request | null = null;
  if (cache && (request.method === "GET" || request.method === "HEAD")) {
    const host = parseHost(request.headers.get("host"), rootDomain);
    if (host.ok) {
      const pointer = await store.getPointer(host.hostname);
      if (pointer?.state === "live") {
        key = cacheRequestFor(request, pointer.publishId);
      }
    }
  }

  if (cache && key) {
    const hit = await cache.match(key);
    if (hit) {
      if (request.method === "HEAD") {
        return new Response(null, { status: hit.status, headers: hit.headers });
      }
      return hit;
    }
  }

  const response = await handleSiteRequest(request, store, {
    rootDomain,
    rawPath: rawPathOf(request.url),
  });

  if (cache && key && request.method === "GET" && response.status === 200) {
    const copy = response.clone();
    ctx?.waitUntil(cache.put(key, copy).catch(() => undefined));
  }

  return response;
}

export function createSiteWorker(options: SiteWorkerOptions = {}) {
  const cache = options.cache === undefined ? defaultCache() : options.cache;
  return {
    async fetch(
      request: Request,
      env: WorkerEnv,
      ctx?: ExecutionContextLike,
    ): Promise<Response> {
      try {
        return await serve(request, env, ctx, cache);
      } catch {
        return new Response("Something went wrong", {
          status: 500,
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-store",
          },
        });
      }
    },
  };
}
