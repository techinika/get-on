import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { gzipSync } from "node:zlib";
import { createNodeStore } from "./node-store";
import { handleSiteRequest } from "./handle";

export type ServeOptions = {
  port?: number;
  rootDir: string;
  /** The root domain used while developing, "localhost" by default. */
  rootDomain?: string;
  formTokenSecret?: string;
  formTokenSecretPrevious?: string;
  workerSharedSecret?: string;
  appOrigin?: string;
};

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let length = 0;
    req.on("data", (chunk: Buffer) => {
      length += chunk.length;
      if (length > 64 * 1024) {
        reject(new Error("body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function toRequest(req: IncomingMessage, body?: Buffer): Request {
  const host = req.headers.host ?? "localhost";
  const url = new URL(req.url ?? "/", `http://${host}`);
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === "string") headers.set(key, value);
    else if (Array.isArray(value)) headers.set(key, value.join(", "));
  }
  return new Request(url, {
    method: req.method ?? "GET",
    headers,
    body: body && body.length > 0 ? (body as unknown as BodyInit) : undefined,
  });
}

/** The path as it arrived, before the URL parser tidied it up. */
function rawPathOf(req: IncomingMessage): string {
  const raw = req.url ?? "/";
  const queryAt = raw.indexOf("?");
  return queryAt === -1 ? raw : raw.slice(0, queryAt);
}

async function writeResponse(
  res: ServerResponse,
  response: Response,
  req: IncomingMessage,
) {
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });

  const buffer = response.body
    ? Buffer.from(await response.arrayBuffer())
    : null;
  const acceptsGzip = (req.headers["accept-encoding"] ?? "").includes("gzip");
  const compressible =
    buffer !== null &&
    buffer.byteLength > 512 &&
    !headers["content-encoding"] &&
    (headers["content-type"] ?? "").match(
      /^(text\/|application\/(json|xml|javascript))/,
    );

  if (buffer && acceptsGzip && compressible) {
    const gzipped = gzipSync(buffer);
    headers["content-encoding"] = "gzip";
    headers["content-length"] = String(gzipped.byteLength);
    res.writeHead(response.status, headers);
    res.end(req.method === "HEAD" ? undefined : gzipped);
    return;
  }

  if (buffer && headers["content-length"]) {
    headers["content-length"] = String(buffer.byteLength);
  }
  res.writeHead(response.status, headers);
  res.end(req.method === "HEAD" ? undefined : (buffer ?? undefined));
}

/**
 * A small Node server that serves published websites from a folder. It is
 * used by `pnpm dev:sites` and by the local end to end tests.
 */
export function serve(options: ServeOptions) {
  const port = options.port ?? 8787;
  const rootDomain = options.rootDomain ?? "localhost";
  const store = createNodeStore(options.rootDir);

  const server = createServer((req, res) => {
    const isFormPost =
      req.method === "POST" && /^\/_forms\/[A-Za-z0-9_-]{6,32}/.test(rawPathOf(req));
    const bodyPromise = isFormPost
      ? readBody(req).catch(() => Buffer.alloc(0))
      : Promise.resolve<Buffer | undefined>(undefined);

    bodyPromise
      .then((body) => {
        const request = toRequest(req, body);
        const clientIp =
          (req.headers["cf-connecting-ip"] as string | undefined) ??
          req.socket.remoteAddress ??
          "";
        return handleSiteRequest(request, store, {
          rootDomain,
          rawPath: rawPathOf(req),
          formTokenSecret: options.formTokenSecret,
          formTokenSecretPrevious: options.formTokenSecretPrevious,
          workerSharedSecret: options.workerSharedSecret,
          appOrigin: options.appOrigin,
          clientIp,
        });
      })
      .then((response) => writeResponse(res, response, req))
      .catch(() => {
        res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Something went wrong");
      });
  });

  server.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Published sites on http://{name}.localhost:${port}`);
  });

  return server;
}
