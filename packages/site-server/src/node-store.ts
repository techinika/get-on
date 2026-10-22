import { createHash } from "node:crypto";
import { readFile, readdir, stat, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { contentTypeFor } from "./content-type";
import type { SiteFile, SitePointer, SiteStore } from "./types";

/**
 * The local folder that stands in for Cloudflare R2 and KV while developing.
 *
 * ```
 * .local-sites/
 *   pointers/{hostname}.json
 *   sites/{siteId}/v/{publishId}/index.html
 *   _shared/fonts/{name}.woff2
 * ```
 */
export function sitePath(
  rootDir: string,
  siteId: string,
  publishId: string,
): string {
  return path.join(rootDir, "sites", siteId, "v", publishId);
}

export function pointerPath(rootDir: string, hostname: string): string {
  return path.join(rootDir, "pointers", `${hostname}.json`);
}

export function sharedPath(rootDir: string, filePath: string): string {
  return path.join(rootDir, "_shared", filePath);
}

async function readSiteFile(filePath: string): Promise<SiteFile | null> {
  try {
    const info = await stat(filePath);
    if (!info.isFile()) return null;
    const body = await readFile(filePath);
    const bytes = new Uint8Array(body);
    return {
      body: bytes,
      contentType: contentTypeFor(filePath),
      etag: `"${createHash("sha256").update(bytes).digest("hex").slice(0, 32)}"`,
      size: bytes.byteLength,
    };
  } catch {
    return null;
  }
}

/** A store backed by a folder on disk. */
export function createNodeStore(rootDir: string): SiteStore {
  return {
    async getPointer(hostname: string): Promise<SitePointer | null> {
      try {
        const raw = await readFile(pointerPath(rootDir, hostname), "utf8");
        const parsed = JSON.parse(raw) as SitePointer;
        if (
          !parsed ||
          typeof parsed !== "object" ||
          !parsed.siteId ||
          !parsed.publishId
        ) {
          return null;
        }
        return parsed;
      } catch {
        return null;
      }
    },

    async getFile(
      siteId: string,
      publishId: string,
      filePath: string,
    ): Promise<SiteFile | null> {
      const safe = filePath.replace(/\.\.+/g, "");
      return readSiteFile(
        path.join(sitePath(rootDir, siteId, publishId), safe),
      );
    },

    async getSharedFile(filePath: string): Promise<SiteFile | null> {
      const safe = filePath.replace(/\.\.+/g, "");
      return readSiteFile(sharedPath(rootDir, safe));
    },
  };
}

/** Writes the live pointer for a host name. */
export async function writeNodePointer(
  rootDir: string,
  hostname: string,
  pointer: SitePointer,
): Promise<void> {
  const file = pointerPath(rootDir, hostname);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(pointer, null, 2)}\n`, "utf8");
}

/** Lists the files of one published version. */
export async function listVersionFiles(
  rootDir: string,
  siteId: string,
  publishId: string,
): Promise<string[]> {
  const base = sitePath(rootDir, siteId, publishId);
  const out: string[] = [];
  async function walk(dir: string, prefix: string) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const next = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(next, `${prefix}${entry.name}/`);
      else out.push(`${prefix}${entry.name}`);
    }
  }
  await walk(base, "");
  return out.sort();
}
