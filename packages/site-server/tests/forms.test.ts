import { describe, expect, it } from "vitest";
import {
  PROBLEM_TEXTS,
  handleSiteRequest,
  sanitizeBackPath,
  sanitizeProblemCode,
  sha256Hex,
  signFormToken,
  signWorkerRequest,
  verifyFormToken,
  verifyWorkerRequest,
  type SiteFile,
  type SitePointer,
  type SiteStore,
} from "../index";

const encoder = new TextEncoder();
const SECRET = "test-secret";

function file(body: string): SiteFile {
  const bytes = encoder.encode(body);
  return {
    body: bytes,
    contentType: "text/html; charset=utf-8",
    etag: `"${bytes.length}-x"`,
    size: bytes.byteLength,
  };
}

function memoryStore(files: Record<string, SiteFile>, pointer?: SitePointer | null): SiteStore {
  return {
    async getPointer() {
      return pointer === undefined ? livePointer : pointer;
    },
    async getFile(_s, _p, path) {
      return files[path] ?? null;
    },
    async getSharedFile() {
      return null;
    },
  };
}

const livePointer: SitePointer = {
  siteId: "site-1",
  publishId: "pub-1",
  state: "live",
  builtAt: "2026-01-01T00:00:00.000Z",
  plan: "free",
};

describe("signFormToken / verifyFormToken", () => {
  it("round trips a payload", async () => {
    const token = await signFormToken(SECRET, { s: "site-1", f: "form123456", t: Date.now() });
    const result = await verifyFormToken([SECRET], token);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.s).toBe("site-1");
      expect(result.payload.f).toBe("form123456");
    }
  });

  it("rejects a tampered token", async () => {
    const token = await signFormToken(SECRET, { s: "site-1", f: "form123456", t: Date.now() });
    const tampered = token.slice(0, -2) + "aa";
    const result = await verifyFormToken([SECRET], tampered);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("signature");
  });

  it("rejects a malformed token", async () => {
    const result = await verifyFormToken([SECRET], "not-a-token");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("format");
  });

  it("rejects an expired token", async () => {
    const old = Date.now() - 8 * 24 * 60 * 60 * 1000;
    const token = await signFormToken(SECRET, { s: "site-1", f: "form123456", t: old });
    const result = await verifyFormToken([SECRET], token);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("expired");
  });

  it("accepts the previous secret during rotation", async () => {
    const token = await signFormToken("old-secret", { s: "s", f: "form123456", t: Date.now() });
    const result = await verifyFormToken(["new-secret", "old-secret"], token);
    expect(result.ok).toBe(true);
  });
});

describe("worker request signature", () => {
  it("verifies a fresh signature", async () => {
    const ts = String(Math.floor(Date.now() / 1000));
    const parts = { ts, host: "rose.get-on.tech", ip: "1.2.3.4", bodyHash: "abc" };
    const sig = await signWorkerRequest(SECRET, parts);
    expect(await verifyWorkerRequest(SECRET, { ...parts, sig })).toBe(true);
  });

  it("rejects an old signature", async () => {
    const ts = String(Math.floor(Date.now() / 1000) - 120);
    const parts = { ts, host: "rose.get-on.tech", ip: "1.2.3.4", bodyHash: "abc" };
    const sig = await signWorkerRequest(SECRET, parts);
    expect(await verifyWorkerRequest(SECRET, { ...parts, sig })).toBe(false);
  });

  it("rejects a wrong signature", async () => {
    const ts = String(Math.floor(Date.now() / 1000));
    expect(
      await verifyWorkerRequest(SECRET, { ts, host: "a", ip: "b", bodyHash: "c", sig: "00" }),
    ).toBe(false);
  });
});

describe("sanitizeBackPath", () => {
  it("keeps a safe path", () => {
    expect(sanitizeBackPath("/about-us")).toBe("/about-us");
  });
  it("falls back to root for junk", () => {
    expect(sanitizeBackPath("https://evil.test")).toBe("/");
    expect(sanitizeBackPath("//evil.test")).toBe("/");
    expect(sanitizeBackPath("javascript:alert(1)")).toBe("/");
    expect(sanitizeBackPath(null)).toBe("/");
  });
});

describe("sanitizeProblemCode", () => {
  it("keeps known codes and defaults the rest", () => {
    expect(sanitizeProblemCode("rate")).toBe("rate");
    expect(sanitizeProblemCode("nonsense")).toBe("unavailable");
    expect(sanitizeProblemCode(null)).toBe("unavailable");
  });
  it("has plain text for every code", () => {
    for (const code of ["invalid", "rate", "closed", "unavailable"]) {
      expect(PROBLEM_TEXTS[code]).toBeTruthy();
    }
  });
});

describe("handleSiteRequest form pipeline", () => {
  const files = {
    "index.html": file(
      `<form method="post" action="/_forms/form123456"><input name="_t" value="{{GS_FORM_TOKEN:form123456}}"><input name="_b" value="{{GS_PAGE_PATH}}"></form>`,
    ),
    "_forms/sent/index.html": file("<p>Sent {{GS_BACK}}</p>"),
    "_forms/problem/index.html": file("<p>{{GS_PROBLEM_TEXT}}</p>"),
  };

  it("fills the token and path placeholders on a page", async () => {
    const response = await handleSiteRequest(
      new Request("https://rose.get-on.tech/", { headers: { host: "rose.get-on.tech" } }),
      memoryStore(files),
      { formTokenSecret: SECRET },
    );
    const html = await response.text();
    expect(html).not.toContain("{{GS_FORM_TOKEN");
    expect(html).not.toContain("{{GS_PAGE_PATH}}");
    expect(html).toContain("v1.");
    const token = html.match(/value="(v1\.[^"]+)"/)?.[1];
    expect(token).toBeTruthy();
    const verified = await verifyFormToken([SECRET], token!);
    expect(verified.ok && verified.payload.f).toBe("form123456");
  });

  it("forwards a form post and redirects to the thank you page", async () => {
    let forwarded: { url: string; headers: Headers; body: string } | null = null;
    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
      forwarded = { url: String(url), headers: new Headers(init?.headers), body: String(init?.body) };
      return new Response("ok", { status: 200 });
    }) as typeof fetch;

    const response = await handleSiteRequest(
      new Request("https://rose.get-on.tech/_forms/form123456?b=/contact", {
        method: "POST",
        headers: {
          host: "rose.get-on.tech",
          "content-type": "application/x-www-form-urlencoded",
        },
        body: "name=Ada&message=Hi",
      }),
      memoryStore(files),
      {
        formTokenSecret: SECRET,
        workerSharedSecret: "wsecret",
        appOrigin: "https://app.get-on.tech",
        clientIp: "9.9.9.9",
        fetchImpl,
      },
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toContain("/_forms/sent");
    expect(forwarded!.url).toBe("https://app.get-on.tech/api/public/forms/form123456");
    expect(forwarded!.headers.get("x-gs-sig")).toBeTruthy();
    expect(forwarded!.headers.get("x-gs-host")).toBe("rose.get-on.tech");
  });

  it("redirects to the problem page when the app rejects the post", async () => {
    const fetchImpl = (async () => new Response("no", { status: 400 })) as typeof fetch;
    const response = await handleSiteRequest(
      new Request("https://rose.get-on.tech/_forms/form123456", {
        method: "POST",
        headers: {
          host: "rose.get-on.tech",
          "content-type": "application/x-www-form-urlencoded",
        },
        body: "a=b",
      }),
      memoryStore(files),
      {
        formTokenSecret: SECRET,
        workerSharedSecret: "wsecret",
        appOrigin: "https://app.get-on.tech",
        fetchImpl,
      },
    );
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toContain("/_forms/problem");
    expect(response.headers.get("location")).toContain("c=invalid");
  });

  it("rejects a post without the form content type", async () => {
    const response = await handleSiteRequest(
      new Request("https://rose.get-on.tech/_forms/form123456", {
        method: "POST",
        headers: { host: "rose.get-on.tech", "content-type": "application/json" },
        body: "{}",
      }),
      memoryStore(files),
      { formTokenSecret: SECRET, appOrigin: "https://app.get-on.tech" },
    );
    expect(response.status).toBe(415);
  });

  it("shows the problem text from the code on the problem page", async () => {
    const response = await handleSiteRequest(
      new Request("https://rose.get-on.tech/_forms/problem?c=rate", {
        headers: { host: "rose.get-on.tech" },
      }),
      memoryStore(files),
      { formTokenSecret: SECRET },
    );
    const html = await response.text();
    expect(html).toContain(PROBLEM_TEXTS.rate);
    expect(html).not.toContain("{{GS_PROBLEM_TEXT}}");
  });
});

describe("sha256Hex", () => {
  it("hashes a string", async () => {
    const hash = await sha256Hex("hello");
    expect(hash).toHaveLength(64);
    expect(hash).toBe("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
  });
});
