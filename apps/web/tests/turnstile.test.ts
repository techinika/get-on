import { describe, expect, it, vi, afterEach } from "vitest";
import { verifyTurnstile } from "@/lib/security/turnstile";

const origSecret = process.env.TURNSTILE_SECRET_KEY;
const origSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

function setEnv(name: string, value: string | null | undefined) {
  if (value === null || value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

function env(secret: string | null | undefined, siteKey: string | null | undefined) {
  setEnv("TURNSTILE_SECRET_KEY", secret);
  setEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", siteKey);
}

function mockFetch(response: Response) {
  const fetch = vi.fn(async () => response);
  vi.stubGlobal("fetch", fetch as typeof globalThis.fetch);
  return fetch;
}

afterEach(() => {
  vi.unstubAllGlobals();
  setEnv("TURNSTILE_SECRET_KEY", origSecret);
  setEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", origSiteKey);
});

describe("verifyTurnstile", () => {
  it("skips verification when neither key is configured", async () => {
    env(null, null);
    const result = await verifyTurnstile("any-token");
    expect(result).toEqual({ ok: true });
  });

  it("skips verification when only the secret is configured (widget cannot render)", async () => {
    env("secret-key", null);
    const result = await verifyTurnstile("any-token");
    expect(result).toEqual({ ok: true });
  });

  it("skips verification when only the site key is configured (server cannot verify)", async () => {
    env(null, "site-key");
    const result = await verifyTurnstile("any-token");
    expect(result).toEqual({ ok: true });
  });

  it("returns missing when no token is provided and both keys are configured", async () => {
    env("secret-key", "site-key");
    const result = await verifyTurnstile(null);
    expect(result).toEqual({ ok: false, reason: "missing" });
  });

  it("verifies through Cloudflare when both keys are configured and the token is valid", async () => {
    env("secret-key", "site-key");
    const fetch = mockFetch(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const result = await verifyTurnstile("a-valid-token");
    expect(result).toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledTimes(1);
    const [, init] = fetch.mock.calls[0]!;
    expect((init?.body as URLSearchParams).get("secret")).toBe("secret-key");
    expect((init?.body as URLSearchParams).get("response")).toBe("a-valid-token");
  });

  it("returns failed when Cloudflare rejects the token", async () => {
    env("secret-key", "site-key");
    mockFetch(
      new Response(JSON.stringify({ success: false }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const result = await verifyTurnstile("a-bad-token");
    expect(result).toEqual({ ok: false, reason: "failed" });
  });

  it("returns failed when the action does not match", async () => {
    env("secret-key", "site-key");
    mockFetch(
      new Response(
        JSON.stringify({ success: true, action: "login" }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const result = await verifyTurnstile("a-token", { action: "signup" });
    expect(result).toEqual({ ok: false, reason: "failed" });
  });

  it("passes the documented test secret without calling Cloudflare", async () => {
    env("1x0000000000000000000000000000000AA", "site-key");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch as typeof globalThis.fetch);
    const result = await verifyTurnstile("test-token");
    expect(result).toEqual({ ok: true });
    expect(fetch).not.toHaveBeenCalled();
  });
});
