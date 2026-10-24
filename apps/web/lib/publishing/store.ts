import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { BuiltFile } from "@get-on/publisher";
import {
  createNodeStore,
  sharedPath,
  sitePath,
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
  /** Flips the live pointer for a host name. */
  writePointer(hostname: string, pointer: SitePointer): Promise<void>;
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
      }
    },
    async writeShared(files) {
      await eachLimit(Object.entries(files), 6, ([filePath, file]) =>
        putObject(sharedKey(filePath), file),
      );
    },
    async getPointer(hostname) {
      const url = `${API}/accounts/${accountId}/storage/kv/namespaces/${encodeURIComponent(
        kvNamespaceId,
      )}/values/${encodeURIComponent(`host:${hostname}`)}`;
      const response = await fetch(url, { headers });
      if (response.status === 404) return null;
      if (!response.ok) {
        console.error(`[publish] could not read pointer ${hostname}: ${response.status}`);
        return null;
      }
      try {
        const parsed = JSON.parse(await response.text()) as SitePointer;
        return parsed?.siteId && parsed?.publishId ? parsed : null;
      } catch {
        return null;
      }
    },
    async writePointer(hostname, pointer) {
      const url = `${API}/accounts/${accountId}/storage/kv/namespaces/${encodeURIComponent(
        kvNamespaceId,
      )}/values/${encodeURIComponent(`host:${hostname}`)}`;
      const response = await fetch(url, {
        method: "PUT",
        headers: {
          ...headers,
          "Content-Type": "application/octet-stream",
        },
        body: JSON.stringify(pointer),
      });
      await readCloudflareResponse(response, "POINTER_WRITE_FAILED");
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
  };
}

export function createPublishStore(config: PublishConfig): PublishStore {
  return config.kind === "cloudflare"
    ? cloudflareStore(config)
    : localStore(config);
}
