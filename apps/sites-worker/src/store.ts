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

export function sitePointerKey(siteId: string): string {
  return `site:${siteId}`;
}

function isState(value: unknown): value is SiteState {
  return (
    value === "live" || value === "unpublished" || value === "suspended"
  );
}

function parseHostMapping(value: unknown): { v: 2; siteId: string } | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (record.v !== 2 || typeof record.siteId !== "string") return null;
  if (!ID_RE.test(record.siteId)) return null;
  return { v: 2, siteId: record.siteId };
}

function parsePointer(value: unknown): SitePointer | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const siteId = typeof record.siteId === "string" ? record.siteId : "";
  const publishId =
    typeof record.publishId === "string" ? record.publishId : "";
  if (!ID_RE.test(siteId) || !ID_RE.test(publishId)) return null;
  if (!isState(record.state)) return null;
  const pointer: SitePointer = {
    siteId,
    publishId,
    state: record.state,
    builtAt: typeof record.builtAt === "string" ? record.builtAt : "",
    plan: typeof record.plan === "string" ? record.plan : "free",
  };
  if (typeof record.primaryHost === "string") pointer.primaryHost = record.primaryHost;
  if (typeof record.freeHost === "string") pointer.freeHost = record.freeHost;
  if (record.redirectToPrimary === true) pointer.redirectToPrimary = true;
  if (record.planLapsed === true) pointer.planLapsed = true;
  if (
    record.pause &&
    typeof record.pause === "object" &&
    typeof (record.pause as { title?: unknown }).title === "string" &&
    typeof (record.pause as { text?: unknown }).text === "string"
  ) {
    pointer.pause = record.pause as SitePointer["pause"];
  }
  if (Array.isArray(record.redirects)) {
    pointer.redirects = record.redirects.filter(
      (item): item is NonNullable<SitePointer["redirects"]>[number] =>
        Boolean(
          item &&
            typeof item === "object" &&
            typeof (item as { from?: unknown }).from === "string" &&
            typeof (item as { to?: unknown }).to === "string" &&
            typeof (item as { code?: unknown }).code === "number",
        ),
    );
  }
  return pointer;
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

      const direct = parsePointer(value);
      if (direct) return direct;

      const mapping = parseHostMapping(value);
      if (!mapping) return null;
      const site = await bindings.kv.get(sitePointerKey(mapping.siteId), {
        type: "json",
        cacheTtl: 60,
      });
      const pointer = parsePointer(site);
      return pointer?.siteId === mapping.siteId ? pointer : null;
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
