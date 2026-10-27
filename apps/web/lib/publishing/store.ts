import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { assertStyledHtml, type BuiltFile } from "@get-on/publisher";
import {
  createNodeStore,
  hostPointerPath,
  pointerPath,
  sharedPath,
  sitePath,
  writeNodeHostPointer,
  writeNodePointer,
} from "@get-on/site-server/node";
import type { SitePointer } from "@get-on/site-server";
import type { PublishConfig } from "./config";
import { requireCloudflareConfig } from "./config";

const API = "https://api.cloudflare.com/client/v4";

export type PublishStore = {
  kind: "cloudflare" | "local";
  /** Writes every file of one version and verifies the home page. */
  writeVersion(
    siteId: string,
    publishId: string,
    files: Record<string, BuiltFile>,
  ): Promise<void>;
  /** Writes files shared by every website, such as the fonts. */
  writeShared(files: Record<string, BuiltFile>): Promise<void>;
  /** The live pointer for a host name, or null when there is none. */
  getPointer(hostname: string): Promise<SitePointer | null>;
  /** Writes the free-address pointer and the site pointer it points at. */
  writePointer(hostname: string, pointer: SitePointer): Promise<void>;
  /** Points a custom address at a website without copying the full pointer. */
  writeHostPointer(
    hostname: string,
    siteId: string,
    options?: { planLapsed?: boolean; supportPaused?: boolean },
  ): Promise<void>;
  /** Removes the mapping for an address that is no longer connected. */
  deleteHostPointer(hostname: string): Promise<void>;
};

function r2Key(siteId: string, publishId: string, filePath: string): string {
  return `sites/${siteId}/v/${publishId}/${filePath}`;
}

function sharedKey(filePath: string): string {
  return `sites/_shared/${filePath}`;
}

/** Slashes stay literal, every other reserved character is encoded. */
function encodeObjectKey(key: string): string {
  return key.split("/").map(encodeURIComponent).join("/");
}

function bodyOf(file: BuiltFile): ArrayBuffer {
  const copy = new Uint8Array(file.body.byteLength);
  copy.set(file.body);
  return copy.buffer;
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

async function eachLimit<T>(
  items: T[],
  limit: number,
  run: (item: T) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        await run(items[index]!);
      }
    },
  );
  await Promise.all(workers);
}

type CloudflareResponse = { success?: boolean; errors?: { message?: string }[] };

async function readCloudflareResponse(
  response: Response,
  fallback: string,
): Promise<void> {
  const text = await response.text().catch(() => "");
  let parsed: CloudflareResponse | null = null;
  try {
    parsed = text ? (JSON.parse(text) as CloudflareResponse) : null;
  } catch {
    parsed = null;
  }
  if (!response.ok || parsed?.success === false) {
    const message = parsed?.errors?.[0]?.message;
    console.error(`[publish] ${fallback}: ${response.status} ${message ?? text.slice(0, 300)}`);
    throw new Error(fallback);
  }
}

function cloudflareStore(config: PublishConfig): PublishStore {
  const { accountId, apiToken, kvNamespaceId, r2Bucket } =
    requireCloudflareConfig(config);
  const headers = { Authorization: `Bearer ${apiToken}` };

  async function putObject(key: string, file: BuiltFile): Promise<void> {
    const url = `${API}/accounts/${accountId}/r2/buckets/${encodeURIComponent(
      r2Bucket,
    )}/objects/${encodeObjectKey(key)}`;
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        ...headers,
        "Content-Type": file.contentType || "application/octet-stream",
      },
      body: bodyOf(file),
    });
    await readCloudflareResponse(response, "UPLOAD_FAILED");
  }

  async function getObject(key: string): Promise<Uint8Array> {
    const url = `${API}/accounts/${accountId}/r2/buckets/${encodeURIComponent(
      r2Bucket,
    )}/objects/${encodeObjectKey(key)}`;
    const response = await fetch(url, { headers });
    if (!response.ok) {
      console.error(`[publish] could not verify ${key}: ${response.status}`);
      throw new Error("UPLOAD_FAILED");
    }
    return new Uint8Array(await response.arrayBuffer());
  }

  return {
    kind: "cloudflare",
    async writeVersion(siteId, publishId, files) {
      const entries = Object.entries(files);
      await eachLimit(entries, 6, ([filePath, file]) =>
        putObject(r2Key(siteId, publishId, filePath), file),
      );

      const home = files["index.html"];
      if (home) {
        const stored = await getObject(r2Key(siteId, publishId, "index.html"));
        if (!sameBytes(stored, home.body)) {
          throw new Error("UPLOAD_VERIFY_FAILED");
        }
        try {
          assertStyledHtml(new TextDecoder().decode(stored));
        } catch {
          throw new Error("UPLOAD_VERIFY_FAILED");
        }
      }
    },
    async writeShared(files) {
      await eachLimit(Object.entries(files), 6, ([filePath, file]) =>
        putObject(sharedKey(filePath), file),
      );
    },
    async getPointer(hostname) {
      const read = async (key: string): Promise<unknown> => {
        const url = `${API}/accounts/${accountId}/storage/kv/namespaces/${encodeURIComponent(
          kvNamespaceId,
        )}/values/${encodeURIComponent(key)}`;
        const response = await fetch(url, { headers });
        if (response.status === 404) return null;
        if (!response.ok) {
          console.error(`[publish] could not read ${key}: ${response.status}`);
          return null;
        }
        try {
          return JSON.parse(await response.text()) as unknown;
        } catch {
          return null;
        }
      };

      const value = await read(`host:${hostname}`);
      if (
        value &&
        typeof value === "object" &&
        "siteId" in value &&
        "publishId" in value
      ) {
        return value as SitePointer;
      }
      if (
        !value ||
        typeof value !== "object" ||
        !("v" in value) ||
        (value as { v?: unknown }).v !== 2 ||
        typeof (value as { siteId?: unknown }).siteId !== "string"
      ) {
        return null;
      }
      const mapping = value as unknown as {
        siteId: string;
        planLapsed?: boolean;
        supportPaused?: boolean;
      };
      const site = await read(`site:${mapping.siteId}`);
      if (!site || typeof site !== "object") return null;
      const pointer = site as SitePointer;
      if (pointer.siteId !== mapping.siteId || !pointer.publishId) return null;
      if (mapping.supportPaused === true) {
        return { ...pointer, supportPaused: true };
      }
      return mapping.planLapsed === true
        ? { ...pointer, planLapsed: true }
        : pointer;
    },
    async writePointer(hostname, pointer) {
      const put = async (key: string, value: unknown): Promise<void> => {
        const url = `${API}/accounts/${accountId}/storage/kv/namespaces/${encodeURIComponent(
          kvNamespaceId,
        )}/values/${encodeURIComponent(key)}`;
        const response = await fetch(url, {
          method: "PUT",
          headers: {
            ...headers,
            "Content-Type": "application/octet-stream",
          },
          body: JSON.stringify(value),
        });
        await readCloudflareResponse(response, "POINTER_WRITE_FAILED");
      };

      await put(`site:${pointer.siteId}`, pointer);
      // Keep the full pointer at the free host too. Older Workers read this
      // key directly, and it makes the KV value self-contained for debugging.
      await put(`host:${hostname}`, pointer);
    },
    async writeHostPointer(hostname, siteId, options) {
      const url = `${API}/accounts/${accountId}/storage/kv/namespaces/${encodeURIComponent(
        kvNamespaceId,
      )}/values/${encodeURIComponent(`host:${hostname}`)}`;
      const response = await fetch(url, {
        method: "PUT",
        headers: {
          ...headers,
          "Content-Type": "application/octet-stream",
        },
        body: JSON.stringify({
          v: 2,
          siteId,
          ...(options?.planLapsed ? { planLapsed: true } : {}),
          ...(options?.supportPaused ? { supportPaused: true } : {}),
        }),
      });
      await readCloudflareResponse(response, "POINTER_WRITE_FAILED");
    },
    async deleteHostPointer(hostname) {
      const url = `${API}/accounts/${accountId}/storage/kv/namespaces/${encodeURIComponent(
        kvNamespaceId,
      )}/values/${encodeURIComponent(`host:${hostname}`)}`;
      const response = await fetch(url, { method: "DELETE", headers });
      if (response.status === 404) return;
      await readCloudflareResponse(response, "POINTER_DELETE_FAILED");
    },
  };
}

function localStore(config: PublishConfig): PublishStore {
  const reader = createNodeStore(config.localDir);

  async function writeFileAt(filePath: string, file: BuiltFile): Promise<void> {
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, file.body);
  }

  return {
    kind: "local",
    async writeVersion(siteId, publishId, files) {
      const base = sitePath(config.localDir, siteId, publishId);
      await eachLimit(Object.entries(files), 6, ([filePath, file]) =>
        writeFileAt(path.join(base, filePath), file),
      );

      const home = files["index.html"];
      if (home) {
        const stored = new Uint8Array(await readFile(path.join(base, "index.html")));
        if (!sameBytes(stored, home.body)) {
          throw new Error("UPLOAD_VERIFY_FAILED");
        }
        try {
          assertStyledHtml(new TextDecoder().decode(stored));
        } catch {
          throw new Error("UPLOAD_VERIFY_FAILED");
        }
      }
    },
    async writeShared(files) {
      await eachLimit(Object.entries(files), 6, ([filePath, file]) =>
        writeFileAt(sharedPath(config.localDir, filePath), file),
      );
    },
    async getPointer(hostname) {
      return reader.getPointer(hostname);
    },
    async writePointer(hostname, pointer) {
      await writeNodePointer(config.localDir, hostname, pointer);
    },
    async writeHostPointer(hostname, siteId, options) {
      await unlink(pointerPath(config.localDir, hostname)).catch(() => undefined);
      await writeNodeHostPointer(config.localDir, hostname, siteId, options);
    },
    async deleteHostPointer(hostname) {
      await unlink(pointerPath(config.localDir, hostname)).catch(() => undefined);
      await unlink(hostPointerPath(config.localDir, hostname)).catch(
        () => undefined,
      );
    },
  };
}

export function createPublishStore(config: PublishConfig): PublishStore {
  return config.kind === "cloudflare"
    ? cloudflareStore(config)
    : localStore(config);
}
