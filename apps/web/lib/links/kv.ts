import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { linkPath } from "@get-on/site-server/node";
import { readPublishConfig, requireCloudflareConfig } from "@/lib/publishing/config";

const API = "https://api.cloudflare.com/client/v4";

export type LinkValue = {
  v: 1;
  siteId: string;
  projectId: string;
  targetPath: string;
  params: Record<string, string>;
  active: boolean;
};

function encodeObjectKey(key: string): string {
  return key.split("/").map(encodeURIComponent).join("/");
}

async function cloudflareWrite(code: string, value: LinkValue | null): Promise<void> {
  const config = readPublishConfig();
  const { accountId, apiToken, kvNamespaceId } = requireCloudflareConfig(config);
  const key = `link:${code}`;
  const url = `${API}/accounts/${accountId}/storage/kv/namespaces/${encodeURIComponent(
    kvNamespaceId,
  )}/values/${encodeObjectKey(key)}`;
  const response = await fetch(url, {
    method: value ? "PUT" : "DELETE",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      ...(value ? { "Content-Type": "application/octet-stream" } : {}),
    },
    body: value ? JSON.stringify(value) : undefined,
  });
  if (!response.ok && response.status !== 404) {
    throw new Error("LINK_WRITE_FAILED");
  }
}

export async function writeLink(code: string, value: LinkValue | null): Promise<void> {
  const config = readPublishConfig();
  if (config.kind === "cloudflare") {
    await cloudflareWrite(code, value);
    return;
  }
  const file = linkPath(config.localDir, code);
  if (!value) {
    await unlink(file).catch(() => undefined);
    return;
  }
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
