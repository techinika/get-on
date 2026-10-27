import { createHash } from "node:crypto";
import { readFile, readdir, stat, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { contentTypeFor } from "./content-type";
import type { SiteFile, SiteLink, SitePointer, SiteStore } from "./types";

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

/** The v2 host mapping and the full site pointer, kept in separate files. */
export function hostPointerPath(rootDir: string, hostname: string): string {
  return path.join(rootDir, "pointers", "hosts", `${hostname}.json`);
}

export function sitePointerPath(rootDir: string, siteId: string): string {
  return path.join(rootDir, "pointers", "sites", `${siteId}.json`);
}

export function sharedPath(rootDir: string, filePath: string): string {
  return path.join(rootDir, "_shared", filePath);
}

export function linkPath(rootDir: string, code: string): string {
  return path.join(rootDir, "links", `${code}.json`);
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
        const raw = await readFile(hostPointerPath(rootDir, hostname), "utf8");
        const mapping = JSON.parse(raw) as {
          v?: number;
          siteId?: string;
          planLapsed?: boolean;
          supportPaused?: boolean;
        };
        if (mapping.v !== 2 || typeof mapping.siteId !== "string") return null;
        const siteRaw = await readFile(
          sitePointerPath(rootDir, mapping.siteId),
          "utf8",
        );
        const pointer = JSON.parse(siteRaw) as SitePointer;
        if (
          !pointer ||
          typeof pointer !== "object" ||
          pointer.siteId !== mapping.siteId ||
          !pointer.publishId
        ) {
          return null;
        }
        if (mapping.supportPaused === true) {
          return { ...pointer, supportPaused: true };
        }
        return mapping.planLapsed === true
          ? { ...pointer, planLapsed: true }
          : pointer;
      } catch {
        // Fall through to the older full-pointer file.
      }

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

    async getLink(code: string): Promise<SiteLink | null> {
      if (!/^[a-z2-9]{7,10}$/.test(code)) return null;
      try {
        const raw = await readFile(linkPath(rootDir, code), "utf8");
        const parsed = JSON.parse(raw) as SiteLink;
        return parsed && parsed.v === 1 ? parsed : null;
      } catch {
        return null;
      }
    },
  };
}

/** Writes the live pointer for the free address, plus the v2 mapping. */
export async function writeNodePointer(
  rootDir: string,
  hostname: string,
  pointer: SitePointer,
): Promise<void> {
  const file = pointerPath(rootDir, hostname);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(pointer, null, 2)}\n`, "utf8");
  await writeNodeSitePointer(rootDir, pointer);
  await writeNodeHostPointer(rootDir, hostname, pointer.siteId);
}

export async function writeNodeSitePointer(
  rootDir: string,
  pointer: SitePointer,
): Promise<void> {
  const file = sitePointerPath(rootDir, pointer.siteId);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(pointer, null, 2)}\n`, "utf8");
}

/** Points a custom address at a website and keeps a full copy for older Workers. */
export async function writeNodeHostPointer(
  rootDir: string,
  hostname: string,
  siteId: string,
  options?: { planLapsed?: boolean; supportPaused?: boolean },
): Promise<void> {
  let full: Partial<SitePointer> = {};
  try {
    full = JSON.parse(
      await readFile(sitePointerPath(rootDir, siteId), "utf8"),
    ) as SitePointer;
  } catch {
    // The site pointer may not exist yet.
  }
  const file = hostPointerPath(rootDir, hostname);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(
    file,
    `${JSON.stringify(
      {
        ...full,
        v: 2,
        siteId,
        ...(options?.planLapsed ? { planLapsed: true } : {}),
        ...(options?.supportPaused ? { supportPaused: true } : {}),
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
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
