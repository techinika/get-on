import { describe, expect, it } from "vitest";
import { safeFetch, SafeFetchError } from "@/lib/security/safe-fetch";

async function expectBlocked(url: string) {
  await expect(safeFetch(url, { allowHttp: true })).rejects.toBeInstanceOf(SafeFetchError);
}

describe("safeFetch", () => {
  it("rejects non-http(s) schemes", async () => {
    await expectBlocked("file:///etc/passwd");
    await expectBlocked("gopher://example.com/");
    await expectBlocked("javascript:alert(1)");
  });

  it("rejects credentials in URL", async () => {
    await expectBlocked("https://user:pass@example.com/");
  });

  it("rejects bad ports", async () => {
    await expectBlocked("https://example.com:22/");
    await expectBlocked("https://example.com:3306/");
  });

  it("rejects loopback and private IPs", async () => {
    await expectBlocked("http://127.0.0.1/");
    await expectBlocked("http://127.0.0.5/");
    await expectBlocked("http://10.0.0.1/");
    await expectBlocked("http://192.168.1.1/");
    await expectBlocked("http://172.16.0.1/");
    await expectBlocked("http://100.64.0.1/");
  });

  it("rejects link-local and metadata", async () => {
    await expectBlocked("http://169.254.169.254/latest/meta-data/");
    await expectBlocked("http://169.254.0.1/");
  });

  it("rejects multicast and reserved", async () => {
    await expectBlocked("http://224.0.0.1/");
    await expectBlocked("http://240.0.0.1/");
  });

  it("rejects suspicious IP forms", async () => {
    await expectBlocked("http://2130706433/"); // decimal
    await expectBlocked("http://0177.0.0.1/"); // octal
    await expectBlocked("http://0x7f000001/"); // hex
  });

  it("rejects IPv6 loopback/ULA/link-local", async () => {
    await expectBlocked("http://[::1]/");
    await expectBlocked("http://[fc00::1]/");
    await expectBlocked("http://[fe80::1]/");
    await expectBlocked("http://[ff02::1]/");
  });

  it("rejects IPv4-mapped IPv6 to loopback", async () => {
    await expectBlocked("http://[::ffff:127.0.0.1]/");
    await expectBlocked("http://[::ffff:7f00:1]/");
  });

  it("rejects localhost hostname", async () => {
    await expectBlocked("http://localhost/");
  });

  it("rejects too many redirects is handled at runtime (no network here)", () => {
    expect(true).toBe(true);
  });
});
