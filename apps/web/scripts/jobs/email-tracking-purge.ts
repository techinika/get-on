import { createAdminClient } from "../../lib/supabase/admin";

async function main() {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("email_tracking_purge");
  if (error) throw error;
  const result = (data ?? {}) as Record<string, number>;
  console.log(`[tracking] links=${result.links ?? 0} opens=${result.opens ?? 0}`);
}

main().catch((error) => {
  console.error("[tracking] job failed", error);
  process.exitCode = 1;
});
