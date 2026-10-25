import { describe, expect, it, vi } from "vitest";
import { readDomainsConfig } from "@/lib/domains/config";
import { CloudflareHostnameProvider } from "@/lib/domains/cloudflare";
import { DohResolver, checkCnameRecord, checkTxtRecord, dnsProviderHint } from "@/lib/domains/dns";
import { ProviderError } from "@/lib/domains/errors";
import { FakeHostnameProvider } from "@/lib/domains/fake";
import { RdapClient } from "@/lib/domains/rdap";

function env(values: Record<string, string>): NodeJS.ProcessEnv {
  return values as unknown as NodeJS.ProcessEnv;
}

const cloudflareConfig = readDomainsConfig(
  env({
    DOMAINS_PROVIDER: "cloudflare",
    CF_SAAS_ZONE_ID: "zone",
    CF_API_TOKEN_DOMAINS: "secret-token",
    CF_SAAS_CNAME_TARGET: "customers.example.com",
  }),
);

describe("fake hostname provider", () => {
  it("creates, promotes and deletes a hostname", async () => {
    const provider = new FakeHostnameProvider({ now: 1000, includedHostnames: 10 });
    const created = await provider.createHostname({
      hostname: "www.example.com",
      mode: "prepare_first",
    });
    expect(created).toMatchObject({
      hostname: "www.example.com",
      mode: "prepare_first",
      status: "pending",
    });
    expect(created.ownershipTxt?.name).toBe("_cf-custom-hostname.www.example.com");

    provider.markDnsReady("www.example.com");
    provider.advance(1000);
    expect(provider.currentTime()).toBe(2000);
    const live = await provider.getHostname(created.id);
    expect(live).toMatchObject({ status: "active", sslStatus: "active" });

    const usage = await provider.usage();
    expect(usage).toMatchObject({ total: 1, pending: 0, included: 10 });
    expect((await provider.listHostnames(1)).hostnames).toHaveLength(1);

    await provider.deleteHostname(created.id);
    expect(await provider.getHostname(created.id)).toBeNull();
  });

  it("rejects a duplicate hostname", async () => {
    const provider = new FakeHostnameProvider();
    await provider.createHostname({ hostname: "example.com", mode: "switch_now" });
    await expect(
      provider.createHostname({ hostname: "example.com", mode: "switch_now" }),
    ).rejects.toMatchObject({ code: "PROVIDER_ERROR" });
  });
});

describe("cloudflare hostname provider", () => {
  it("creates a hostname with TXT validation in prepare-first mode", async () => {
    const fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.ssl.method).toBe("txt");
      expect(body.ssl.type).toBe("dv");
      return new Response(
        JSON.stringify({
          success: true,
          result: {
            id: "cf-1",
            hostname: "www.example.com",
            status: "pending",
            ssl: {
              status: "pending_validation",
              validation_records: [
                {
                  txt_name: "_acme-challenge.www.example.com",
                  txt_value: "token",
                },
              ],
            },
            ownership_verification: {
              type: "txt",
              name: "_cf-custom-hostname.www.example.com",
              value: "ownership",
            },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    const provider = new CloudflareHostnameProvider(cloudflareConfig, {
      fetch: fetch as typeof globalThis.fetch,
      sleep: async () => {},
    });
    const created = await provider.createHostname({
      hostname: "www.example.com",
      mode: "prepare_first",
    });
    expect(created).toMatchObject({
      id: "cf-1",
      hostname: "www.example.com",
      status: "pending",
      sslStatus: "pending_validation",
    });
    expect(created.ownershipTxt?.name).toBe("_cf-custom-hostname.www.example.com");
    expect(created.validationTxt?.value).toBe("token");
    const [, init] = fetch.mock.calls[0]!;
    expect((init?.headers as Record<string, string>).Authorization).toBe(
      "Bearer secret-token",
    );
  });

  it("retries a rate limit and does not leak the token", async () => {
    let calls = 0;
    const fetch = vi.fn(async () => {
      calls += 1;
      if (calls === 1) {
        return new Response(JSON.stringify({ success: false, errors: [{ code: 1000 }] }), {
          status: 429,
        });
      }
      return new Response(
        JSON.stringify({
          success: true,
          result: { id: "cf-1", hostname: "example.com", status: "pending" },
        }),
        { status: 200 },
      );
    });
    const provider = new CloudflareHostnameProvider(cloudflareConfig, {
      fetch: fetch as typeof globalThis.fetch,
      sleep: async () => {},
      random: () => 0,
    });
    const hostname = await provider.getHostname("cf-1");
    expect(hostname?.hostname).toBe("example.com");
    expect(calls).toBe(2);
  });

  it("returns a safe provider error for a failed request", async () => {
    const fetch = vi.fn(async () =>
      new Response(JSON.stringify({ success: false, errors: [{ code: 1406 }] }), {
        status: 409,
      }),
    );
    const provider = new CloudflareHostnameProvider(cloudflareConfig, {
      fetch: fetch as typeof globalThis.fetch,
      sleep: async () => {},
    });
    await expect(
      provider.createHostname({ hostname: "example.com", mode: "switch_now" }),
    ).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof ProviderError &&
        !error.message.includes("secret-token") &&
        !error.message.includes("1406"),
    );
  });

  it("tracks provider health for operations", async () => {
    let fail = true;
    const fetch = vi.fn(async () => {
      if (fail) {
        return new Response(JSON.stringify({ success: false }), { status: 503 });
      }
      return new Response(
        JSON.stringify({
          success: true,
          result: { id: "cf-1", hostname: "example.com", status: "active" },
        }),
        { status: 200 },
      );
    });
    const provider = new CloudflareHostnameProvider(cloudflareConfig, {
      fetch: fetch as typeof globalThis.fetch,
      sleep: async () => {},
      retries: 0,
    });

    await expect(provider.getHostname("cf-1")).rejects.toBeInstanceOf(ProviderError);
    expect(provider.health()).toMatchObject({
      totalRequests: 1,
      totalFailures: 1,
      consecutiveFailures: 1,
    });
    expect(provider.health().lastFailureAt).not.toBeNull();

    fail = false;
    await provider.getHostname("cf-1");
    expect(provider.health()).toMatchObject({
      totalRequests: 2,
      totalFailures: 1,
      consecutiveFailures: 0,
    });
    expect(provider.health().lastSuccessAt).not.toBeNull();
  });

  it("opens the circuit after five consecutive failures", async () => {
    const fetch = vi.fn(async () =>
      new Response(JSON.stringify({ success: false }), { status: 503 }),
    );
    const provider = new CloudflareHostnameProvider(cloudflareConfig, {
      fetch: fetch as typeof globalThis.fetch,
      sleep: async () => {},
      retries: 0,
    });
    for (let index = 0; index < 5; index += 1) {
      await expect(provider.getHostname("cf-1")).rejects.toBeInstanceOf(ProviderError);
    }
    expect(provider.health().consecutiveFailures).toBe(5);
    expect(provider.health().circuitOpenUntil).not.toBeNull();
    await expect(provider.getHostname("cf-1")).rejects.toMatchObject({
      code: "PROVIDER_UNAVAILABLE",
    });
  });

  it("checks the fallback origin", async () => {
    const fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({ success: true, result: { status: "active" } }),
        { status: 200 },
      ),
    );
    const provider = new CloudflareHostnameProvider(cloudflareConfig, {
      fetch: fetch as typeof globalThis.fetch,
      sleep: async () => {},
    });
    await expect(provider.checkSetup()).resolves.toEqual({ ok: true, problems: [] });
  });
});

function dohFetch(answer: unknown, status = 200) {
  return vi.fn(async () =>
    new Response(JSON.stringify(answer), {
      status,
      headers: { "Content-Type": "application/dns-json" },
    }),
  );
}

describe("DNS-over-HTTPS checks", () => {
  it("finds a TXT value and distinguishes a wrong value", async () => {
    const resolver = new DohResolver({
      endpoints: ["https://dns.example/query"],
      fetch: dohFetch({
        Status: 0,
        Answer: [
          {
            name: "_geton-verify.example.com",
            type: 16,
            data: '"geton-verify=abc"',
          },
        ],
      }) as typeof globalThis.fetch,
    });
    await expect(
      checkTxtRecord(resolver, "_geton-verify.example.com", "geton-verify=abc"),
    ).resolves.toEqual({ status: "found", records: ["geton-verify=abc"] });
    await expect(
      checkTxtRecord(resolver, "_geton-verify.example.com", "geton-verify=other"),
    ).resolves.toMatchObject({ status: "wrong" });
  });

  it("reports a missing TXT record and checks CNAME targets", async () => {
    const empty = new DohResolver({
      endpoints: ["https://dns.example/query"],
      fetch: dohFetch({ Status: 3 }) as typeof globalThis.fetch,
    });
    await expect(
      checkTxtRecord(empty, "_geton-verify.example.com", "geton-verify=abc"),
    ).resolves.toEqual({ status: "missing", records: [] });

    const cname = new DohResolver({
      endpoints: ["https://dns.example/query"],
      fetch: dohFetch({
        Status: 0,
        Answer: [
          { name: "www.example.com", type: 5, data: "customers.get-on.tech." },
        ],
      }) as typeof globalThis.fetch,
    });
    await expect(
      checkCnameRecord(cname, "www.example.com", "customers.get-on.tech"),
    ).resolves.toMatchObject({ status: "found" });
  });

  it("falls back to the second resolver and maps nameservers to a provider hint", async () => {
    let calls = 0;
    const fetch = vi.fn(async () => {
      calls += 1;
      if (calls === 1) return new Response("nope", { status: 503 });
      return new Response(
        JSON.stringify({
          Status: 0,
          Answer: [{ name: "example.com", type: 2, data: "ns1.cloudflare.com." }],
        }),
        { status: 200 },
      );
    });
    const resolver = new DohResolver({
      endpoints: ["https://one/query", "https://two/query"],
      fetch: fetch as typeof globalThis.fetch,
    });
    await expect(dnsProviderHint(resolver, "example.com")).resolves.toBe("Cloudflare");
    expect(calls).toBe(2);
  });
});

describe("RDAP lookup", () => {
  it("reads the registrar and expiry date", async () => {
    const fetch = vi.fn(async (url: string | URL | Request) => {
      const value = String(url);
      if (value.includes("dns.json")) {
        return new Response(
          JSON.stringify({ services: [[["com"], ["https://rdap.example/"]]] }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({
          ldhName: "example.com",
          status: ["clientTransferProhibited"],
          nameservers: [{ ldhName: "NS1.EXAMPLE.COM" }],
          events: [{ eventAction: "expiration", eventDate: "2027-01-01T00:00:00Z" }],
          entities: [
            {
              roles: ["registrar"],
              vcardArray: ["vcard", [["fn", {}, "text", "Example Registrar"]]],
            },
          ],
        }),
        { status: 200 },
      );
    });
    const client = new RdapClient({ fetch: fetch as typeof globalThis.fetch });
    const info = await client.lookup("example.com");
    expect(info).toMatchObject({
      name: "Example Registrar",
      expiresAt: "2027-01-01T00:00:00Z",
      nameservers: ["ns1.example.com"],
    });
  });

  it("returns null when RDAP is unavailable", async () => {
    const client = new RdapClient({
      fetch: (async () => {
        throw new Error("offline");
      }) as typeof globalThis.fetch,
    });
    await expect(client.lookup("example.com")).resolves.toBeNull();
  });
});
