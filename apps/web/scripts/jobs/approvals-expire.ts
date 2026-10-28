import { createAdminClient } from "../../lib/supabase/admin";
import { queueApprovalOutcome } from "../../lib/email/approval-notifications";

async function main() {
  const admin = createAdminClient();
  const { data: due, error: dueError } = await admin
    .from("approval_requests")
    .select("id")
    .in("status", ["pending", "approved"])
    .lte("expires_at", new Date().toISOString());
  if (dueError) throw dueError;

  const { data, error } = await admin.rpc("approval_expire");
  if (error) throw error;

  for (const row of due ?? []) {
    await queueApprovalOutcome(String(row.id));
  }
  console.log(`[approvals] expired=${Number(data ?? 0)} notified=${(due ?? []).length}`);
}

main().catch((error) => {
  console.error("[approvals] job failed", error);
  process.exitCode = 1;
});
