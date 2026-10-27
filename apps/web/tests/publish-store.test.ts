import { afterEach, describe, expect, it, vi } from "vitest";
import { createPublishStore } from "@/lib/publishing/store";
import type { PublishConfig } from "@/lib/publishing/config";
import type { SitePointer } from "@get-on/site-server";

const pointer: SitePointer = {
  siteId: "00000000-0000-4000-8000-000000000001",
  publishId: "00000000-0000-4000-8000-000000000002",
  state: "live",
  builtAt: "2026-10-26T00:00:00.000Z",
  plan: "pro",
  primaryHost: "www.example.com",
  freeHost: "rose.get-on.tech",
  redirectToPrimary: true,
};

const config: PublishConfig = {
  kind: "cloudflare",
  rootDomain: "get-on.tech",
  localRootDomain: "localhost",
  localPort: 8787,
  localDir: "/tmp/not-used",
  accountId: "account",
  apiToken: "token",
  kvNamespaceId: "namespace",
  r2Bucket: "bucket",
};

describe("Cloudflare publish store", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stores a complete pointer at the free host for older Workers", async () => {
    const puts: Array<{ key: string; body: string }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(String(input));
        const key = decodeURIComponent(url.pathname.split("/values/")[1] ?? "");
        puts.push({ key, body: String(init?.body ?? "") });
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }),
    );

    await createPublishStore(config).writePointer("rose.get-on.tech", pointer);

    const host = puts.find((item) => item.key === "host:rose.get-on.tech");
    const site = puts.find((item) => item.key === `site:${pointer.siteId}`);
    expect(host).toBeDefined();
    expect(site).toBeDefined();
    expect(JSON.parse(host!.body)).toEqual(pointer);
    expect(JSON.parse(site!.body)).toEqual(pointer);
  });
});
