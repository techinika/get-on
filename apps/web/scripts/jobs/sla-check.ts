import { createAdminClient } from "../../lib/supabase/admin";

async function main() {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("support_sla_check");
  if (error) throw error;
  console.log(`[sla] breached=${Number(data ?? 0)}`);
}

main().catch((error) => {
  console.error("[sla] job failed", error);
  process.exitCode = 1;
});
