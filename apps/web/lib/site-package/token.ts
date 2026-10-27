import { createHmac, timingSafeEqual } from "node:crypto";

export type DownloadKind = "export" | "backup";

type DownloadPayload = {
  v: 1;
  kind: DownloadKind;
  id: string;
  projectId: string;
  exp: number;
};

function secret(): string {
  return (
    process.env.DOWNLOAD_TOKEN_SECRET ??
    process.env.FORM_TOKEN_SECRET ??
    "dev-download-token-secret-change-me"
  );
}

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function signature(body: string): string {
  return createHmac("sha256", secret()).update(`download.${body}`).digest("base64url");
}

export function signDownloadToken(
  kind: DownloadKind,
  id: string,
  projectId: string,
  ttlSeconds = 15 * 60,
): string {
  const payload: DownloadPayload = {
    v: 1,
    kind,
    id,
    projectId,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const body = encode(payload);
  return `${body}.${signature(body)}`;
}

export function verifyDownloadToken(token: string): DownloadPayload | null {
  const [body, supplied] = token.split(".");
  if (!body || !supplied) return null;
  const expected = signature(body);
  const left = Buffer.from(expected);
  const right = Buffer.from(supplied);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as DownloadPayload;
    if (payload.v !== 1 || !payload.id || !payload.projectId) return null;
    if (!Number.isInteger(payload.exp) || payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (payload.kind !== "export" && payload.kind !== "backup") return null;
    return payload;
  } catch {
    return null;
  }
}
