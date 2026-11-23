import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  getDomainOps,
  recordStaffAction,
  requireStaffAction,
  StaffError,
} from "@/lib/admin";
import { isSupabaseConfigured } from "@/lib/supabase/fallback";
import {
  ALL_JOB_MODES,
  getOpsSnapshot,
  type JobMode,
} from "@/lib/domains/ops-store";
import { runDomainJob, type JobRunResult } from "@/lib/domains/admin-jobs";

export const dynamic = "force-dynamic";

function isJobMode(value: unknown): value is JobMode {
  return (
    typeof value === "string" &&
    (ALL_JOB_MODES as string[]).includes(value)
  );
}

function statusForError(error: unknown): number {
  if (error instanceof StaffError) {
    if (error.code === "NOT_STAFF" || error.code === "STAFF_MFA_REQUIRED") {
      return 401;
    }
    if (error.code === "STAFF_NOT_ALLOWED") return 403;
  }
  return 500;
}

export async function GET() {
  try {
    await requireStaffAction("domain.recheck");
    const ops = await getDomainOps();
    const snapshot = getOpsSnapshot(ops);
    return NextResponse.json({
      ok: true,
      mode: isSupabaseConfigured() ? "supabase" : "local",
      ...snapshot,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Could not load job status",
      },
      { status: statusForError(error) },
    );
  }
}

export async function POST(request: Request) {
  try {
    await requireStaffAction("domain.recheck");
    const body = (await request.json().catch(() => ({}))) as {
      mode?: unknown;
    };

    const requested = body.mode;
    if (requested !== "all" && !isJobMode(requested)) {
      return NextResponse.json(
        { ok: false, error: "Invalid background job mode." },
        { status: 400 },
      );
    }

    const modesToRun: JobMode[] =
      requested === "all" ? ALL_JOB_MODES : [requested];

    const results: JobRunResult[] = [];
    for (const mode of modesToRun) {
      const result = await runDomainJob(mode);
      results.push(result);
    }

    await recordStaffAction({
      action: "domain.recheck",
      targetType: "domain_job",
      targetId: String(requested),
      details: {
        mode: requested,
        results: results.map((r) => ({
          mode: r.mode,
          ok: r.ok,
          count: r.count,
          failed: r.failed,
        })),
      },
    });

    revalidatePath("/admin/operations");
    const ops = await getDomainOps();
    const snapshot = getOpsSnapshot(ops);

    return NextResponse.json({
      ok: results.every((r) => r.ok),
      results,
      snapshot,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to run job",
      },
      { status: statusForError(error) },
    );
  }
}
