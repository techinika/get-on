import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createNodeStore,
  writeNodeHostPointer,
  writeNodePointer,
} from "../src/node-store";
import type { SitePointer } from "../src/types";

const pointer: SitePointer = {
  siteId: "site-1",
  publishId: "pub-1",
  state: "live",
  builtAt: "2026-01-01T00:00:00.000Z",
  plan: "basic",
  freeHost: "rose.localhost",
  primaryHost: "www.example.com",
  redirectToPrimary: true,
};

let rootDir: string | null = null;

afterEach(async () => {
  if (rootDir) await rm(rootDir, { recursive: true, force: true });
  rootDir = null;
});

describe("node store host pointers", () => {
  it("resolves a custom host to the site pointer", async () => {
    rootDir = await mkdtemp(path.join(tmpdir(), "get-on-store-"));
    await writeNodePointer(rootDir, pointer.freeHost!, pointer);
    await writeNodeHostPointer(rootDir, "www.example.com", pointer.siteId);

    const store = createNodeStore(rootDir);
    await expect(store.getPointer("www.example.com")).resolves.toMatchObject({
      siteId: "site-1",
      primaryHost: "www.example.com",
    });
  });

  it("keeps a full pointer copy in the custom host mapping", async () => {
    rootDir = await mkdtemp(path.join(tmpdir(), "get-on-store-"));
    await writeNodePointer(rootDir, pointer.freeHost!, pointer);
    await writeNodeHostPointer(rootDir, "www.example.com", pointer.siteId);

    const raw = await readFile(
      path.join(rootDir, "pointers", "hosts", "www.example.com.json"),
      "utf8",
    );
    expect(JSON.parse(raw)).toMatchObject({
      ...pointer,
      v: 2,
      siteId: pointer.siteId,
    });
  });

  it("prefers the site pointer over a stale full copy in the host mapping", async () => {
    rootDir = await mkdtemp(path.join(tmpdir(), "get-on-store-"));
    await writeNodePointer(rootDir, pointer.freeHost!, pointer);
    await writeNodeHostPointer(rootDir, "www.example.com", pointer.siteId);
    await writeNodePointer(rootDir, pointer.freeHost!, {
      ...pointer,
      publishId: "pub-2",
    });

    const store = createNodeStore(rootDir);
    await expect(store.getPointer("www.example.com")).resolves.toMatchObject({
      publishId: "pub-2",
    });
  });

  it("pauses only the host mapping marked as plan lapsed", async () => {
    rootDir = await mkdtemp(path.join(tmpdir(), "get-on-store-"));
    await writeNodePointer(rootDir, pointer.freeHost!, pointer);
    await writeNodeHostPointer(rootDir, "www.example.com", pointer.siteId, {
      planLapsed: true,
    });

    const store = createNodeStore(rootDir);
    await expect(store.getPointer("www.example.com")).resolves.toMatchObject({
      planLapsed: true,
    });
    await expect(store.getPointer("rose.localhost")).resolves.not.toMatchObject({
      planLapsed: true,
    });
  });

  it("pauses only the host mapping marked by support", async () => {
    rootDir = await mkdtemp(path.join(tmpdir(), "get-on-store-"));
    await writeNodePointer(rootDir, pointer.freeHost!, pointer);
    await writeNodeHostPointer(rootDir, "www.example.com", pointer.siteId, {
      supportPaused: true,
    });

    const store = createNodeStore(rootDir);
    await expect(store.getPointer("www.example.com")).resolves.toMatchObject({
      supportPaused: true,
    });
    await expect(store.getPointer("rose.localhost")).resolves.not.toMatchObject({
      supportPaused: true,
    });
  });
});
