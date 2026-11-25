import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runAiJobs } from "@/lib/ai/jobs";
import { runDomainJob } from "@/lib/domains/admin-jobs";
import type { JobMode } from "@/lib/domains/ops-store";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminSupabaseConfigured } from "@/lib/supabase/fallback";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CRON_DOMAIN_MODES: JobMode[] = [
  "verify",
  "poll",
  "health",
  "plan",
  "cleanup",
];

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET || process.env.JOBS_SECRET || "";
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return false;
  const token = header.slice("Bearer ".length).trim();
  if (!token) return false;
  const expectedBuf = Buffer.from(secret, "utf8");
  const actualBuf = Buffer.from(token, "utf8");
  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}

async function handleCron(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!isAdminSupabaseConfigured()) {
    return NextResponse.json(
      { ok: false, error: "ADMIN_NOT_CONFIGURED" },
      { status: 503 },
    );
  }

  const admin = createAdminClient();
  const ai = await runAiJobs(admin, "all");

  const domains: Array<{
    mode: JobMode;
    ok: boolean;
    count: number;
    failed: number;
    error?: string;
  }> = [];
  for (const mode of CRON_DOMAIN_MODES) {
    const result = await runDomainJob(mode);
    domains.push({
      mode: result.mode,
      ok: result.ok,
      count: result.count,
      failed: result.failed,
      ...(result.error ? { error: result.error } : {}),
    });
  }

  const ok = ai.failed === 0 && domains.every((item) => item.ok);
  return NextResponse.json({ ok, ai, domains }, { status: ok ? 200 : 207 });
}

export async function GET(request: Request) {
  return handleCron(request);
}

export async function POST(request: Request) {
  return handleCron(request);
}
