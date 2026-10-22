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
};

function toRequest(req: IncomingMessage): Request {
  const host = req.headers.host ?? "localhost";
  const url = new URL(req.url ?? "/", `http://${host}`);
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === "string") headers.set(key, value);
    else if (Array.isArray(value)) headers.set(key, value.join(", "));
  }
  return new Request(url, { method: req.method ?? "GET", headers });
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
    const request = toRequest(req);
    handleSiteRequest(request, store, { rootDomain, rawPath: rawPathOf(req) })
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
