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

async function readRequestedJobs(request: Request): Promise<string[] | null> {
  const url = new URL(request.url);
  const queryJobs = [
    ...url.searchParams.getAll("job"),
    ...url.searchParams.getAll("jobs"),
  ]
    .flatMap((v) => v.split(","))
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);

  const bodyJobs: string[] = [];
  if (request.method === "POST") {
    try {
      const raw = await request.text();
      if (raw.trim()) {
        const parsed = JSON.parse(raw) as { job?: unknown; jobs?: unknown };
        if (typeof parsed.job === "string" && parsed.job.trim()) {
          bodyJobs.push(parsed.job.trim().toLowerCase());
        }
        if (Array.isArray(parsed.jobs)) {
          for (const item of parsed.jobs) {
            if (typeof item === "string" && item.trim()) {
              bodyJobs.push(item.trim().toLowerCase());
            }
          }
        }
      }
    } catch {
      // Ignore empty or non-JSON cron triggers and run full batch
    }
  }

  const combined = [...new Set([...queryJobs, ...bodyJobs])];
  return combined.length > 0 ? combined : null;
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

  const requested = await readRequestedJobs(request);
  const admin = createAdminClient();

  let ai = { monthly: 0, expired: 0, payloads: 0, failed: 0 };
  if (!requested || requested.includes("ai") || requested.includes("ai.all")) {
    ai = await runAiJobs(admin, "all");
  } else {
    const aiModes: Array<"monthly" | "expire" | "payloads"> = [];
    if (requested.includes("ai.monthly")) aiModes.push("monthly");
    if (requested.includes("ai.expire")) aiModes.push("expire");
    if (requested.includes("ai.payloads")) aiModes.push("payloads");
    for (const mode of aiModes) {
      const partial = await runAiJobs(admin, mode);
      ai.monthly += partial.monthly;
      ai.expired += partial.expired;
      ai.payloads += partial.payloads;
      ai.failed += partial.failed;
    }
  }

  const domainModes = !requested || requested.includes("domains") || requested.includes("domains.all")
    ? CRON_DOMAIN_MODES
    : CRON_DOMAIN_MODES.filter(
        (mode) => requested.includes(mode) || requested.includes(`domains.${mode}`),
      );

  const domains: Array<{
    mode: JobMode;
    ok: boolean;
    count: number;
    failed: number;
    error?: string;
  }> = [];
  for (const mode of domainModes) {
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
