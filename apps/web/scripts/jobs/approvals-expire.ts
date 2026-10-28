import { createAdminClient } from "../../lib/supabase/admin";

async function main() {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("approval_expire");
  if (error) throw error;
  console.log(`[approvals] expired=${Number(data ?? 0)}`);
}

main().catch((error) => {
  console.error("[approvals] job failed", error);
  process.exitCode = 1;
});
