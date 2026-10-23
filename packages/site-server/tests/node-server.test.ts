import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import http from "node:http";
import { serve } from "../src/node-server";
import { writeNodePointer } from "../src/node-store";
import type { SitePointer } from "../src/types";

const pointer: SitePointer = {
  siteId: "site-1",
  publishId: "pub-1",
  state: "live",
  builtAt: "2026-01-01T00:00:00.000Z",
  plan: "free",
};

let rootDir: string;
let server: http.Server;
let port: number;

function fetchRaw(
  pathname: string,
  options: { headers?: Record<string, string> } = {},
) {
  return new Promise<{
    status: number;
    headers: http.IncomingHttpHeaders;
    body: string;
  }>((resolve, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        path: pathname,
        method: "GET",
        headers: options.headers ?? {},
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () =>
          resolve({ status: res.statusCode ?? 0, headers: res.headers, body }),
        );
      },
    );
    req.on("error", reject);
    req.end();
  });
}

beforeAll(async () => {
  rootDir = await mkdtemp(path.join(tmpdir(), "get-on-sites-"));
  const siteDir = path.join(
    rootDir,
    "sites",
    pointer.siteId,
    "v",
    pointer.publishId,
  );
  await mkdir(path.join(siteDir, "assets"), { recursive: true });
  await mkdir(path.join(rootDir, "_shared", "fonts"), { recursive: true });
  await writeFile(
    path.join(siteDir, "index.html"),
    "<html>rose bakery</html>",
    "utf8",
  );
  await mkdir(path.join(siteDir, "about"), { recursive: true });
  await writeFile(
    path.join(siteDir, "about", "index.html"),
    "<html>about</html>",
    "utf8",
  );
  await writeFile(
    path.join(rootDir, "_shared", "fonts", "a.woff2"),
    "font-bytes",
    "utf8",
  );
  await writeNodePointer(rootDir, "rosebakery.localhost", pointer);
  server = serve({ rootDir, port: 0 });
  await new Promise<void>((resolve) =>
    server.once("listening", () => resolve()),
  );
  const address = server.address();
  port = typeof address === "object" && address ? address.port : 0;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await rm(rootDir, { recursive: true, force: true });
});

describe("the local site server", () => {
  it("serves a published website for {name}.localhost", async () => {
    const response = await fetchRaw("/", {
      headers: { host: `rosebakery.localhost:${port}` },
    });
    expect(response.status).toBe(200);
    expect(response.body).toContain("rose bakery");
  });

  it("serves the shared fonts", async () => {
    const response = await fetchRaw("/fonts/a.woff2", {
      headers: { host: `rosebakery.localhost:${port}` },
    });
    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe(
      "public, max-age=31536000, immutable",
    );
  });

  it("shows the not found page for an unknown website", async () => {
    const response = await fetchRaw("/", {
      headers: { host: `unknown.localhost:${port}` },
    });
    expect(response.status).toBe(404);
    expect(response.body).toContain("We could not find this website");
  });

  it("refuses a raw traversal path", async () => {
    const response = await fetchRaw("/../secret", {
      headers: { host: `rosebakery.localhost:${port}` },
    });
    expect(response.status).toBe(400);
  });

  it("gzips a large page when the browser asks for it", async () => {
    const big = `<html>${"a".repeat(4000)}</html>`;
    await writeFile(
      path.join(
        rootDir,
        "sites",
        pointer.siteId,
        "v",
        pointer.publishId,
        "big.html",
      ),
      big,
      "utf8",
    );
    const response = await fetchRaw("/big.html", {
      headers: {
        host: `rosebakery.localhost:${port}`,
        "accept-encoding": "gzip",
      },
    });
    expect(response.status).toBe(200);
    expect(response.headers["content-encoding"]).toBe("gzip");
  });
});
