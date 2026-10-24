import type {
  SitePause,
  SitePointer,
  SiteRedirect,
} from "@get-on/site-server";
import { readPublishConfig, siteHostname } from "./config";
import { createPublishStore } from "./store";

export type RedirectRow = {
  from_path: string;
  to_value: string | null;
  code: number | null;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function normaliseFrom(value: string): string {
  let path = value.trim().toLowerCase();
  if (!path.startsWith("/")) path = `/${path}`;
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  return path;
}

function validTarget(value: string): boolean {
  if (value.startsWith("/")) {
    return (
      !value.startsWith("//") &&
      !value.includes("\\") &&
      !value.includes("..") &&
      !/[\r\n]/.test(value)
    );
  }
  try {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      !/[\r\n]/.test(value)
    );
  } catch {
    return false;
  }
}

export function pauseFromSettings(value: unknown): SitePause | null {
  const maintenance = record(value);
  if (maintenance.enabled !== true) return null;
  return {
    title: text(maintenance.title, 60) || "We will be back soon",
    text:
      text(maintenance.text, 300) ||
      "This website is being updated. Please check again in a little while.",
    ...(typeof maintenance.since === "string"
      ? { since: maintenance.since }
      : {}),
  };
}

export function redirectsFromRows(rows: RedirectRow[]): SiteRedirect[] {
  const out: SiteRedirect[] = [];
  for (const row of rows) {
    const from = normaliseFrom(row.from_path);
    const to = (row.to_value ?? "").trim();
    if (!validTarget(to) || !from.startsWith("/") || from.length > 200) continue;
    const code = Number(row.code);
    out.push({
      from,
      to,
      code: code === 301 || code === 302 || code === 307 || code === 308 ? code : 301,
    });
  }
  return out;
}

export async function patchLivePointer(
  subdomain: string,
  patch: Partial<
    Pick<
      SitePointer,
      "pause" | "redirects" | "primaryHost" | "freeHost" | "redirectToPrimary"
    >
  >,
): Promise<boolean> {
  const config = readPublishConfig();
  const hostname = siteHostname(config, subdomain);
  const store = createPublishStore(config);
  const pointer = await store.getPointer(hostname);
  if (!pointer || pointer.state !== "live") return false;
  await store.writePointer(hostname, { ...pointer, ...patch });
  return true;
}
