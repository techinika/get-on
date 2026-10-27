import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyWorkerRequest } from "@get-on/site-server/forms";

export const runtime = "nodejs";

const DEFAULT_WHITELIST = new Set([
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
  "utm_id", "ref", "fbclid", "gclid", "msclkid", "ttclid", "gs_link",
]);

function sanitizeValue(value: string): string | null {
  const text = value.trim();
  if (!text) return null;
  if (/[\r\n]/.test(text)) return null;
  // Redact values that look like personal identifiers.
  const looksPersonal = /[@.]/.test(text) && /[0-9]{7,}/.test(text);
  return looksPersonal ? "__redacted" : text.slice(0, 200);
}

function sanitizeKey(key: string): string | null {
  const k = key.trim().toLowerCase();
  if (!k || k.length > 80) return null;
  return /^[a-z0-9_]+$/.test(k) ? k : null;
}

export async function POST(request: Request) {
  const secret = process.env.WORKER_SHARED_SECRET ?? process.env.FORM_TOKEN_SECRET ?? "";
  const tsHeader = request.headers.get("x-gs-ts") ?? "";
  const sigHeader = request.headers.get("x-gs-sig") ?? "";
  const hostHeader = request.headers.get("x-gs-host") ?? "";
  const ipHeader = request.headers.get("x-gs-ip") ?? "";

  const ok = await verifyWorkerRequest(secret, {
    ts: tsHeader,
    host: hostHeader,
    ip: ipHeader,
    bodyHash: "", // we don't verify body hash in this minimal version
    sig: sigHeader,
  }).catch(() => false);
  // The minimal version skips the body hash verification. A production
  // version should include the body hash. For now we rely on the secret.
  if (!ok && secret) {
    // When secret exists but verification fails, reject.
    return NextResponse.json({ error: "NOT_AUTHENTICATED" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }
  const payload = body as { kind?: unknown; siteId?: unknown; projectId?: unknown; date?: unknown; path?: unknown; linkCode?: unknown; params?: unknown; visitorHash?: unknown };
  if (payload.kind !== "view" && payload.kind !== "click") {
    return NextResponse.json({ error: "INVALID_KIND" }, { status: 400 });
  }
  const admin = createAdminClient();
  const { data: whitelistRows } = await admin
    .from("stats_param_whitelist")
    .select("param_key")
    .eq("enabled", true)
    .limit(50);
  const allowed = new Set(DEFAULT_WHITELIST);
  if (whitelistRows) allowed.clear();
  if (Array.isArray(whitelistRows)) {
    for (const row of whitelistRows) {
      if (typeof row.param_key === "string") allowed.add(row.param_key);
    }
  }

  const params: Record<string, string> = {};
  if (payload.params && typeof payload.params === "object" && payload.params !== null) {
    for (const [rawKey, rawValue] of Object.entries(payload.params)) {
      const key = sanitizeKey(rawKey);
      if (!key) continue;
      const mappedKey =
        key === "ref" || key === "source" ? (allowed.has("utm_source") ? "utm_source" : null) :
        key === "utm_id" ? (allowed.has("utm_id") ? "utm_id" : null) :
        allowed.has(key) ? key : null;
      if (!mappedKey) continue;
      const valueStr = typeof rawValue === "string" ? rawValue : String(rawValue ?? "");
      const cleanValue = sanitizeValue(valueStr);
      if (cleanValue !== null) {
        params[mappedKey] = cleanValue;
      }
    }
  }

  const linkCode = payload.linkCode ? (typeof payload.linkCode === "string" ? payload.linkCode.slice(0, 20) : null) : null;
  const siteId = typeof payload.siteId === "string" ? payload.siteId : null;
  const projectId = typeof payload.projectId === "string" ? payload.projectId : siteId;
  const pathStr = typeof payload.path === "string" ? payload.path.slice(0, 500) : "/";
  const dateStr = payload.date ? new Date(String(payload.date)).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
  const visitorHashStr = typeof payload.visitorHash === "string" ? payload.visitorHash.slice(0, 128) : null;

  try {
    await admin.rpc("record_stats_event", {
      p_project: projectId ?? "",
      p_date: dateStr,
      p_visitor_hash: visitorHashStr ?? "",
      p_path: pathStr,
      p_link_id: linkCode,
      p_params: params,
      p_kind: payload.kind,
    });
  } catch {
    return NextResponse.json({ error: "STATS_INGEST_FAILED" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
