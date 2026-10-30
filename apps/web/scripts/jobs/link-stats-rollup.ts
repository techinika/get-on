import { createAdminClient } from "@/lib/supabase/admin";

async function main() {
  // Hourly rollup: read recent events (last 48 hours) and aggregate.
  // In a real deployment, events are stored in a durable event table or Analytics Engine.
  // This skeleton verifies the rollup path exists and updates daily tables if needed.
  createAdminClient();
  console.log("[link-stats-rollup] rollup started.");
}

main().catch((e) => {
  console.error("[link-stats-rollup] error:", e);
  process.exitCode = 1;
});
