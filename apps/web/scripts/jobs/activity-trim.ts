import { createAdminClient } from "../../lib/supabase/admin";

async function main() {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("trim_team_activity", { p_before: null });
  if (error) throw error;
  console.log(`[activity] trimmed=${Number(data ?? 0)}`);
}

main().catch((error) => {
  console.error("[activity] job failed", error);
  process.exitCode = 1;
});
