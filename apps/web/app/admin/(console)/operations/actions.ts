"use server";

import { revalidatePath } from "next/cache";
import { recordStaffAction, requireStaffAction } from "@/lib/admin";
import {
  JOB_LABELS,
  runDomainJob,
  type JobMode,
  type JobRunResult,
} from "@/lib/domains/admin-jobs";

export async function runDomainJobAction(mode: JobMode): Promise<JobRunResult> {
  await requireStaffAction("domain.recheck");
  const result = await runDomainJob(mode);

  await recordStaffAction({
    action: "domain.recheck",
    targetType: "domain_job",
    targetId: mode,
    details: { mode, count: result.count, failed: result.failed },
  });

  revalidatePath("/admin/operations");
  return result;
}

export type { JobMode, JobRunResult };
export { JOB_LABELS };
