import {
  contentTypeFor,
  type SiteFile,
  type SitePointer,
  type SiteState,
  type SiteStore,
} from "@get-on/site-server";
import type { KVLike, R2BucketLike } from "./env";

const ID_RE = /^[A-Za-z0-9_-]{1,128}$/;

export function pointerKey(hostname: string): string {
  return `host:${hostname}`;
}

function isState(value: unknown): value is SiteState {
  return (
    value === "live" || value === "unpublished" || value === "suspended"
  );
}

function parsePointer(value: unknown): SitePointer | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const siteId = typeof record.siteId === "string" ? record.siteId : "";
  const publishId =
    typeof record.publishId === "string" ? record.publishId : "";
  if (!ID_RE.test(siteId) || !ID_RE.test(publishId)) return null;
  if (!isState(record.state)) return null;
  return {
    siteId,
    publishId,
    state: record.state,
    builtAt: typeof record.builtAt === "string" ? record.builtAt : "",
    plan: typeof record.plan === "string" ? record.plan : "free",
  };
}

function safePath(path: string): string | null {
  if (!path) return null;
  if (path.startsWith("/")) return null;
  if (path.includes("..")) return null;
  if (path.includes("\\")) return null;
  if (path.includes("\0")) return null;
  return path;
}

export function versionKey(
  siteId: string,
  publishId: string,
  path: string,
): string {
  return `sites/${siteId}/v/${publishId}/${path}`;
}

export function sharedKey(path: string): string {
  return `sites/_shared/${path}`;
}

async function readFile(
  bucket: R2BucketLike,
  key: string,
  path: string,
): Promise<SiteFile | null> {
  const object = await bucket.get(key);
  if (!object) return null;
  const body = new Uint8Array(await object.arrayBuffer());
  const etag = object.httpEtag ?? `"${object.etag.replace(/^"|"$/g, "")}"`;
  return {
    body,
    contentType: object.httpMetadata?.contentType ?? contentTypeFor(path),
    etag,
    size: object.size ?? body.byteLength,
  };
}

/** A store backed by R2 for files and KV for the live pointers. */
export function createCloudflareStore(
  bindings: { kv: KVLike; bucket: R2BucketLike },
): SiteStore {
  return {
    async getPointer(hostname: string): Promise<SitePointer | null> {
      if (!hostname) return null;
      const value = await bindings.kv.get(pointerKey(hostname), {
        type: "json",
        cacheTtl: 60,
      });
      return parsePointer(value);
    },

    async getFile(
      siteId: string,
      publishId: string,
      filePath: string,
    ): Promise<SiteFile | null> {
      if (!ID_RE.test(siteId) || !ID_RE.test(publishId)) return null;
      const path = safePath(filePath);
      if (!path) return null;
      return readFile(
        bindings.bucket,
        versionKey(siteId, publishId, path),
        path,
      );
    },

    async getSharedFile(filePath: string): Promise<SiteFile | null> {
      const path = safePath(filePath);
      if (!path) return null;
      return readFile(bindings.bucket, sharedKey(path), path);
    },
  };
}
