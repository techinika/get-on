import { mkdir, readFile, writeFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import {
  contentTypeFor,
  handleSiteRequest,
  type SiteFile,
  type SiteLink,
  type SitePointer,
  type SiteStore,
} from "./index";

export function sitePath(dir: string, siteId: string, publishId: string): string {
  return path.join(dir, "sites", siteId, "v", publishId);
}

export function pointerPath(dir: string, hostname: string): string {
  return path.join(dir, "pointers", `${hostname}.json`);
}

export function hostPointerPath(dir: string, hostname: string): string {
  return path.join(dir, "host-pointers", `${hostname}.json`);
}

export function sitePointerPath(dir: string, siteId: string): string {
  return path.join(dir, "sites", siteId, "pointer.json");
}

export function sharedPath(dir: string, filePath: string): string {
  return path.join(dir, "_shared", filePath);
}

export function linkPath(dir: string, siteIdOrSlug: string, slug?: string): string {
  if (slug !== undefined) {
    return path.join(dir, "sites", siteIdOrSlug, "links", `${slug}.json`);
  }
  return path.join(dir, "links", `${siteIdOrSlug}.json`);
}

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function safeRelative(filePath: string): string | null {
  if (!filePath || filePath.startsWith("/") || filePath.includes("..") || filePath.includes("\\")) {
    return null;
  }
  return filePath;
}

export function createNodeStore(dir: string): SiteStore {
  const readStoredFile = async (absPath: string, relPath: string): Promise<SiteFile | null> => {
    try {
      const buf = await readFile(absPath);
      const bytes = new Uint8Array(buf);
      return {
        body: bytes,
        contentType: contentTypeFor(relPath),
        size: bytes.byteLength,
      };
    } catch {
      return null;
    }
  };

  return {
    async getPointer(hostname: string): Promise<SitePointer | null> {
      const hostMapping = await readJson<{
        v?: number;
        siteId?: string;
        planLapsed?: boolean;
        supportPaused?: boolean;
      }>(hostPointerPath(dir, hostname));
      if (hostMapping?.siteId) {
        const full = await readJson<SitePointer>(sitePointerPath(dir, hostMapping.siteId));
        if (full) {
          return {
            ...full,
            ...(hostMapping.planLapsed ? { planLapsed: true } : {}),
            ...(hostMapping.supportPaused ? { supportPaused: true } : {}),
          };
        }
      }
      return readJson<SitePointer>(pointerPath(dir, hostname));
    },

    async getFile(siteId: string, publishId: string, filePath: string): Promise<SiteFile | null> {
      const safe = safeRelative(filePath);
      if (!safe) return null;
      return readStoredFile(path.join(sitePath(dir, siteId, publishId), safe), safe);
    },

    async getSharedFile(filePath: string): Promise<SiteFile | null> {
      const safe = safeRelative(filePath);
      if (!safe) return null;
      return readStoredFile(sharedPath(dir, safe), safe);
    },

    async getLink(code: string): Promise<SiteLink | null> {
      if (!/^[a-z2-9]{7,10}$/.test(code)) return null;
      return readJson<SiteLink>(linkPath(dir, code));
    },

    async getObject(key: string): Promise<SiteFile | null> {
      const normalized = key.startsWith("sites/_shared/")
        ? sharedPath(dir, key.slice("sites/_shared/".length))
        : path.join(dir, key);
      return readStoredFile(normalized, normalized);
    },
  };
}

export async function writeNodeSitePointer(
  dir: string,
  pointer: SitePointer,
): Promise<void> {
  const target = sitePointerPath(dir, pointer.siteId);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, JSON.stringify(pointer, null, 2), "utf8");
}

export async function writeNodePointer(
  dir: string,
  hostname: string,
  pointer: SitePointer,
): Promise<void> {
  await writeNodeSitePointer(dir, pointer);
  const target = pointerPath(dir, hostname);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, JSON.stringify(pointer, null, 2), "utf8");
}

export async function writeNodeHostPointer(
  dir: string,
  hostname: string,
  siteId: string,
  options?: { planLapsed?: boolean; supportPaused?: boolean },
): Promise<void> {
  const target = hostPointerPath(dir, hostname);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(
    target,
    JSON.stringify(
      {
        v: 2,
        siteId,
        ...(options?.planLapsed ? { planLapsed: true } : {}),
        ...(options?.supportPaused ? { supportPaused: true } : {}),
      },
      null,
      2,
    ),
    "utf8",
  );
}

export function serve(options: {
  dir?: string;
  rootDir?: string;
  port?: number;
  rootDomain?: string;
  appOrigin?: string;
  formTokenSecret?: string;
  workerSharedSecret?: string;
}) {
  const dir = options.dir ?? options.rootDir ?? ".";
  const store = createNodeStore(dir);
  const port = options.port ?? 8787;
  const server = http.createServer(async (req, res) => {
    const host = req.headers.host ?? `localhost:${port}`;
    const url = new URL(req.url ?? "/", `http://${host}`);
    const method = req.method ?? "GET";
    let bodyBuf: Buffer | undefined;
    if (method !== "GET" && method !== "HEAD") {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      bodyBuf = Buffer.concat(chunks);
    }
    const request = new Request(url.toString(), {
      method,
      headers: req.headers as Record<string, string>,
      ...(bodyBuf !== undefined ? { body: new Uint8Array(bodyBuf) } : {}),
    });
    const response = await handleSiteRequest(request, store, {
      rootDomain: options.rootDomain,
      appOrigin: options.appOrigin,
      formTokenSecret: options.formTokenSecret,
      workerSharedSecret: options.workerSharedSecret,
    });
    res.statusCode = response.status;
    response.headers.forEach((value, key) => res.setHeader(key, value));
    const buf = Buffer.from(await response.arrayBuffer());
    res.end(buf);
  });
  server.listen(port);
  return server;
}
