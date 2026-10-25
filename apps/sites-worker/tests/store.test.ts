import { describe, expect, it } from "vitest";
import type { R2ObjectLike } from "../src/env";
import {
  createCloudflareStore,
  pointerKey,
  sharedKey,
  versionKey,
} from "../src/store";

type FakeObject = R2ObjectLike;

function objectOf(
  text: string,
  options: { contentType?: string; etag?: string } = {},
): FakeObject {
  const bytes = new TextEncoder().encode(text);
  const etag = options.etag ?? "abc123";
  return {
    etag,
    httpEtag: `"${etag}"`,
    size: bytes.byteLength,
    httpMetadata: options.contentType
      ? { contentType: options.contentType }
      : undefined,
    async arrayBuffer() {
      return bytes.buffer.slice(0) as ArrayBuffer;
    },
  };
}

function fakeKv(values: Record<string, unknown> = {}) {
  const calls: { key: string; options?: unknown }[] = [];
  return {
    calls,
    async get(key: string, options?: { type?: "json"; cacheTtl?: number }) {
      calls.push({ key, options });
      return values[key] ?? null;
    },
  };
}

function fakeBucket(objects: Record<string, FakeObject> = {}) {
  const calls: string[] = [];
  return {
    calls,
    async get(key: string) {
      calls.push(key);
      return objects[key] ?? null;
    },
  };
}

const pointer = {
  siteId: "site-1",
  publishId: "pub-1",
  state: "live",
  builtAt: "2026-10-22T10:00:00.000Z",
  plan: "starter",
};

describe("cloudflare store", () => {
  it("builds the KV and R2 keys", () => {
    expect(pointerKey("shop.get-on.tech")).toBe("host:shop.get-on.tech");
    expect(versionKey("s1", "p1", "index.html")).toBe(
      "sites/s1/v/p1/index.html",
    );
    expect(sharedKey("fonts/inter.woff2")).toBe(
      "sites/_shared/fonts/inter.woff2",
    );
  });

  it("reads a live pointer with a short cache", async () => {
    const kv = fakeKv({ "host:shop.get-on.tech": pointer });
    const store = createCloudflareStore({
      kv,
      bucket: fakeBucket(),
    });

    await expect(store.getPointer("shop.get-on.tech")).resolves.toEqual(
      pointer,
    );
    expect(kv.calls).toEqual([
      {
        key: "host:shop.get-on.tech",
        options: { type: "json", cacheTtl: 60 },
      },
    ]);
  });

  it("rejects a pointer with an unknown state", async () => {
    const kv = fakeKv({
      "host:shop.get-on.tech": { ...pointer, state: "deleted" },
    });
    const store = createCloudflareStore({ kv, bucket: fakeBucket() });

    await expect(store.getPointer("shop.get-on.tech")).resolves.toBeNull();
  });

  it("rejects a pointer with unsafe ids", async () => {
    const kv = fakeKv({
      "host:shop.get-on.tech": { ...pointer, siteId: "../other" },
    });
    const store = createCloudflareStore({ kv, bucket: fakeBucket() });

    await expect(store.getPointer("shop.get-on.tech")).resolves.toBeNull();
  });

  it("returns null for a host without a pointer", async () => {
    const store = createCloudflareStore({
      kv: fakeKv(),
      bucket: fakeBucket(),
    });

    await expect(store.getPointer("missing.get-on.tech")).resolves.toBeNull();
  });

  it("reads a file from the published version", async () => {
    const bucket = fakeBucket({
      "sites/site-1/v/pub-1/index.html": objectOf("<h1>Hello</h1>", {
        contentType: "text/html; charset=utf-8",
      }),
    });
    const store = createCloudflareStore({ kv: fakeKv(), bucket });

    const file = await store.getFile("site-1", "pub-1", "index.html");

    expect(file?.contentType).toBe("text/html; charset=utf-8");
    expect(file?.etag).toBe('"abc123"');
    expect(file?.size).toBe("<h1>Hello</h1>".length);
    expect(new TextDecoder().decode(file?.body)).toBe("<h1>Hello</h1>");
    expect(bucket.calls).toEqual(["sites/site-1/v/pub-1/index.html"]);
  });

  it("falls back to the content type from the file name", async () => {
    const bucket = fakeBucket({
      "sites/site-1/v/pub-1/assets/app.js": objectOf("console.log(1)"),
    });
    const store = createCloudflareStore({ kv: fakeKv(), bucket });

    await expect(
      store.getFile("site-1", "pub-1", "assets/app.js"),
    ).resolves.toMatchObject({ contentType: "text/javascript; charset=utf-8" });
  });

  it("reads a shared font", async () => {
    const bucket = fakeBucket({
      "sites/_shared/fonts/inter-400-abcd.woff2": objectOf("font", {
        contentType: "font/woff2",
      }),
    });
    const store = createCloudflareStore({ kv: fakeKv(), bucket });

    const file = await store.getSharedFile!("fonts/inter-400-abcd.woff2");

    expect(file?.contentType).toBe("font/woff2");
    expect(bucket.calls).toEqual([
      "sites/_shared/fonts/inter-400-abcd.woff2",
    ]);
  });

  it("returns null for a missing file", async () => {
    const store = createCloudflareStore({
      kv: fakeKv(),
      bucket: fakeBucket(),
    });

    await expect(
      store.getFile("site-1", "pub-1", "missing.html"),
    ).resolves.toBeNull();
  });

  it("refuses paths that could escape the version", async () => {
    const bucket = fakeBucket();
    const store = createCloudflareStore({ kv: fakeKv(), bucket });

    await expect(
      store.getFile("site-1", "pub-1", "../other/index.html"),
    ).resolves.toBeNull();
    await expect(
      store.getFile("site-1", "pub-1", "/index.html"),
    ).resolves.toBeNull();
    await expect(
      store.getSharedFile!("fonts/../../secret"),
    ).resolves.toBeNull();
    expect(bucket.calls).toEqual([]);
  });
});

describe("v2 pointers", () => {
  it("resolves a host mapping to the full site pointer", async () => {
    const kv = fakeKv({
      "host:www.example.com": { v: 2, siteId: "site-1" },
      "site:site-1": { ...pointer, primaryHost: "www.example.com" },
    });
    const store = createCloudflareStore({ kv, bucket: fakeBucket() });

    await expect(store.getPointer("www.example.com")).resolves.toMatchObject({
      siteId: "site-1",
      primaryHost: "www.example.com",
    });
  });

  it("overlays planLapsed from the host mapping only", async () => {
    const kv = fakeKv({
      "host:www.example.com": {
        v: 2,
        siteId: "site-1",
        planLapsed: true,
      },
      "site:site-1": { ...pointer, primaryHost: "www.example.com" },
    });
    const store = createCloudflareStore({ kv, bucket: fakeBucket() });

    await expect(store.getPointer("www.example.com")).resolves.toMatchObject({
      planLapsed: true,
      primaryHost: "www.example.com",
    });
  });

  it("refuses a mapping that points at a missing site", async () => {
    const kv = fakeKv({ "host:www.example.com": { v: 2, siteId: "site-1" } });
    const store = createCloudflareStore({ kv, bucket: fakeBucket() });

    await expect(store.getPointer("www.example.com")).resolves.toBeNull();
  });

  it("refuses a site pointer for another website", async () => {
    const kv = fakeKv({
      "host:www.example.com": { v: 2, siteId: "site-1" },
      "site:site-1": { ...pointer, siteId: "site-2" },
    });
    const store = createCloudflareStore({ kv, bucket: fakeBucket() });

    await expect(store.getPointer("www.example.com")).resolves.toBeNull();
  });
});
