import { createAdminClient } from "../../lib/supabase/admin";

async function main() {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("marketing_campaign_stats");
  if (error) throw error;
  const stats = (data ?? {}) as Record<string, number>;
  console.log(
    `[campaign-stats] sent=${stats.updated_sent ?? 0} failed=${stats.updated_failed ?? 0} suppressed=${stats.updated_suppressed ?? 0}`,
  );
}

main().catch((error) => {
  console.error("[campaign-stats] job failed", error);
  process.exitCode = 1;
});
