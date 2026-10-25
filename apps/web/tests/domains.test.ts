import { describe, expect, it } from "vitest";
import { readDomainsConfig } from "@/lib/domains/config";
import { domainErrorMessage, ProviderError, asDomainError } from "@/lib/domains/errors";
import {
  hostnameForLabel,
  hostnameLabel,
  isPlatformHost,
  isValidHostnameLabel,
  normalizeDomainInput,
  normalizeHostname,
  otherForm,
} from "@/lib/domains/normalize";
import {
  checkCaaRecords,
  checkHostnameDns,
  evaluateCaa,
} from "@/lib/domains/diagnostics";
import { screenDomain } from "@/lib/domains/protected";
import {
  caaRecords,
  cnameRecord,
  relativeName,
  verificationName,
  verificationRecord,
} from "@/lib/domains/records";
import {
  assertDomainTransition,
  assertHostnameTransition,
  canTransitionDomain,
  canTransitionHostname,
  domainStatusFromHostnames,
} from "@/lib/domains/state";

function env(values: Record<string, string>): NodeJS.ProcessEnv {
  return values as unknown as NodeJS.ProcessEnv;
}

describe("CAA diagnostics", () => {
  const record = (value: string) => ({ type: "CAA" as const, name: "example.com", value });

  it("accepts a CAA record that allows one of our authorities", () => {
    const result = evaluateCaa(
      [record('0 issue "letsencrypt.org"')],
      "example.com",
      "example.com",
    );
    expect(result.found).toBe(true);
    expect(result.blocking).toBe(false);
    expect(result.suggested).toEqual([]);
  });

  it("flags CAA records that block every allowed authority", () => {
    const result = evaluateCaa(
      [record('0 issue "digicert.com"')],
      "example.com",
      "example.com",
    );
    expect(result.blocking).toBe(true);
    expect(result.suggested).toHaveLength(3);
    expect(result.suggested[0]).toMatchObject({ type: "CAA", name: "@" });
  });

  it("ignores reports-only CAA records", () => {
    const result = evaluateCaa(
      [record('0 iodef "mailto:security@example.com"')],
      "example.com",
      "example.com",
    );
    expect(result.blocking).toBe(false);
  });

  it("finds a connection record that points somewhere else", async () => {
    const resolver = {
      async lookup(name: string, type: string) {
        if (type === "CNAME") {
          return {
            status: "ok" as const,
            records: [
              { type: "CNAME" as const, name, value: "old.example.net" },
            ],
          };
        }
        return { status: "ok" as const, records: [] };
      },
    };

    const result = await checkHostnameDns(
      resolver,
      "www.example.com",
      "customers.get-on.tech",
    );
    expect(result.cname).toBe("old.example.net");
    expect(result.wrongCname).toBe(true);
    expect(result.conflicts).toEqual([]);
  });

  it("finds old address records that block the connection record", async () => {
    const resolver = {
      async lookup(name: string, type: string) {
        if (type === "CNAME") {
          return { status: "ok" as const, records: [] };
        }
        if (type === "A") {
          return {
            status: "ok" as const,
            records: [
              { type: "A" as const, name, value: "203.0.113.10" },
            ],
          };
        }
        return { status: "ok" as const, records: [] };
      },
    };

    const result = await checkHostnameDns(
      resolver,
      "www.example.com",
      "customers.get-on.tech",
    );
    expect(result.conflicts).toEqual(["203.0.113.10"]);
    expect(result.wrongCname).toBe(false);
  });

  it("checks parents and follows a CNAME", async () => {
    const calls: string[] = [];
    const resolver = {
      async lookup(name: string) {
        calls.push(name);
        if (name === "www.example.com") {
          return {
            status: "ok" as const,
            records: [
              {
                type: "CNAME" as const,
                name,
                value: "target.example.net",
              },
            ],
          };
        }
        if (name === "target.example.net") {
          return {
            status: "ok" as const,
            records: [record('0 issue "pki.goog"')],
          };
        }
        return { status: "ok" as const, records: [] };
      },
    };

    const result = await checkCaaRecords(
      resolver,
      "www.example.com",
      "example.com",
    );
    expect(result.found).toBe(true);
    expect(result.blocking).toBe(false);
    expect(calls).toContain("www.example.com");
    expect(calls).toContain("target.example.net");
  });
});

describe("domain input", () => {
  it("normalises a pasted URL and suggests the subdomain", () => {
    const result = normalizeDomainInput(" https://Shop.Example.co.uk/path?q=1 ");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.domain.registrable).toBe("example.co.uk");
    expect(result.domain.hostname).toBe("shop.example.co.uk");
    expect(result.domain.suggestedLabel).toBe("shop");
    expect(result.domain.sld).toBe("example");
  });

  it("keeps a bare domain and its punycode form", () => {
    const result = normalizeDomainInput("bücher.de");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.domain.registrable).toBe("xn--bcher-kva.de");
    expect(result.domain.unicodeHost).toBe("bücher.de");
    expect(result.domain.suggestedLabel).toBeNull();
  });

  it("rejects IPs, public suffixes, reserved names and bad labels", () => {
    expect(normalizeDomainInput("192.168.1.1")).toMatchObject({ ok: false, reason: "ip" });
    expect(normalizeDomainInput("co.uk")).toMatchObject({ ok: false, reason: "public-suffix" });
    expect(normalizeDomainInput("example.com")).toMatchObject({ ok: false, reason: "reserved" });
    expect(normalizeDomainInput("foo_bar.com")).toMatchObject({ ok: false, reason: "invalid" });
    expect(normalizeDomainInput("-bad.com")).toMatchObject({ ok: false, reason: "invalid" });
  });

  it("normalises Host headers and recognises platform hosts", () => {
    expect(normalizeHostname("WWW.Example.COM.:443")).toBe("www.example.com");
    expect(normalizeHostname("localhost:3000")).toBe("localhost");
    expect(normalizeHostname("127.0.0.1")).toBeNull();
    expect(isPlatformHost("www.get-on.tech", "get-on.tech")).toBe(true);
    expect(isPlatformHost("get-on.tech", "get-on.tech")).toBe(true);
    expect(isPlatformHost("notget-on.tech", "get-on.tech")).toBe(false);
  });

  it("maps labels and sibling addresses", () => {
    expect(hostnameForLabel("@", "example.com")).toBe("example.com");
    expect(hostnameForLabel("www", "example.com")).toBe("www.example.com");
    expect(hostnameLabel("www.example.com", "example.com")).toBe("www");
    expect(hostnameLabel("example.com", "example.com")).toBe("@");
    expect(hostnameLabel("a.b.example.com", "example.com")).toBeNull();
    expect(otherForm("www.example.com", "example.com")).toBe("example.com");
    expect(otherForm("example.com", "example.com")).toBe("www.example.com");
    expect(otherForm("shop.example.com", "example.com")).toBeNull();
    expect(isValidHostnameLabel("shop")).toBe(true);
    expect(isValidHostnameLabel("mail")).toBe(false);
    expect(isValidHostnameLabel("_geton-verify")).toBe(false);
  });
});

describe("domain records", () => {
  it("builds the TXT and CNAME records customers add", () => {
    expect(verificationName("example.com")).toBe("_geton-verify.example.com");
    expect(verificationRecord("example.com", "abc")).toEqual({
      type: "TXT",
      name: "_geton-verify.example.com",
      value: "geton-verify=abc",
    });
    expect(cnameRecord("www.example.com", "example.com", "customers.get-on.tech")).toEqual({
      type: "CNAME",
      name: "www",
      value: "customers.get-on.tech",
    });
    expect(relativeName("example.com", "example.com")).toBe("@");
    expect(caaRecords("www.example.com")[0]).toMatchObject({ type: "CAA", name: "@" });
  });
});

describe("domain state machines", () => {
  it("allows the documented domain path", () => {
    expect(canTransitionDomain("draft", "verified")).toBe(true);
    expect(canTransitionDomain("verified", "connecting")).toBe(true);
    expect(canTransitionDomain("connecting", "live")).toBe(true);
    expect(canTransitionDomain("live", "attention")).toBe(true);
    expect(canTransitionDomain("plan_lapsed", "live")).toBe(true);
    expect(canTransitionDomain("removed", "live")).toBe(false);
    expect(() => assertDomainTransition("removed", "live")).toThrow(
      "DOMAIN_TRANSITION_INVALID",
    );
  });

  it("allows the documented hostname path", () => {
    expect(canTransitionHostname("pending", "live")).toBe(true);
    expect(canTransitionHostname("preparing", "ready_to_switch")).toBe(true);
    expect(canTransitionHostname("ready_to_switch", "active")).toBe(true);
    expect(canTransitionHostname("live", "moved")).toBe(true);
    expect(canTransitionHostname("removed", "live")).toBe(false);
    expect(() => assertHostnameTransition("removed", "live")).toThrow(
      "HOSTNAME_TRANSITION_INVALID",
    );
  });

  it("derives the domain status from its addresses", () => {
    expect(
      domainStatusFromHostnames("connecting", [{ role: "main", status: "live" }]),
    ).toBe("live");
    expect(
      domainStatusFromHostnames("connecting", [{ role: "main", status: "moved" }]),
    ).toBe("attention");
    expect(domainStatusFromHostnames("connecting", [])).toBe("connecting");
    expect(
      domainStatusFromHostnames("plan_lapsed", [{ role: "main", status: "live" }]),
    ).toBe("plan_lapsed");
  });
});

describe("domain errors and screening", () => {
  it("maps stable codes to plain language", () => {
    expect(domainErrorMessage("HOSTNAME_TAKEN")).toContain("already connected");
    expect(domainErrorMessage("DOMAIN_LIMIT_REACHED", { plan: "Basic", limit: 1 })).toBe(
      "Your Basic plan includes 1 domain for each website.",
    );
    const wrapped = asDomainError(new ProviderError("PROVIDER_UNAVAILABLE"));
    expect(wrapped.code).toBe("PROVIDER_UNAVAILABLE");
  });

  it("blocks platform names and reviews known brands", () => {
    expect(screenDomain("geton").action).toBe("block");
    expect(screenDomain("google").action).toBe("review");
    expect(screenDomain("rosebakery").action).toBe("allow");
  });
});

describe("domains config", () => {
  it("defaults to the fake provider", () => {
    const config = readDomainsConfig(env({}));
    expect(config.provider).toBe("fake");
    expect(config.includedHostnames).toBe(100);
    expect(config.maximumHostnames).toBe(50_000);
    expect(config.dohEndpoints).toHaveLength(2);
  });

  it("reads Cloudflare and comma separated DNS endpoints", () => {
    const config = readDomainsConfig(
      env({
        DOMAINS_PROVIDER: "cloudflare",
        CF_SAAS_ZONE_ID: "zone",
        CF_API_TOKEN_DOMAINS: "token",
        CF_SAAS_CNAME_TARGET: "customers.example.com",
        CF_SAAS_HOSTNAMES_INCLUDED: "50",
        CF_SAAS_MAX_HOSTNAMES: "40000",
        DOMAINS_MAX_PENDING_HOSTNAMES: "10",
        DOMAINS_PROVIDER_RPS: "2",
        DOH_ENDPOINTS: "https://one/dns-query, https://two/resolve",
      }),
    );
    expect(config.provider).toBe("cloudflare");
    expect(config.cnameTarget).toBe("customers.example.com");
    expect(config.includedHostnames).toBe(50);
    expect(config.maximumHostnames).toBe(40_000);
    expect(config.maxPendingHostnames).toBe(10);
    expect(config.dohEndpoints).toEqual(["https://one/dns-query", "https://two/resolve"]);
  });
});
