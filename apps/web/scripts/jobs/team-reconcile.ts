import { createAdminClient } from "../../lib/supabase/admin";

async function main() {
  const admin = createAdminClient();
  const { data: teams, error } = await admin.from("teams").select("id").limit(5000);
  if (error) throw error;

  let changed = 0;
  let failed = 0;
  for (const team of teams ?? []) {
    const { data, error: rpcError } = await admin.rpc("enforce_seat_plan", { p_team: team.id });
    if (rpcError) {
      failed += 1;
      continue;
    }
    if (data && typeof data === "object" && (data as { paused?: number }).paused) changed += 1;
  }
  console.log(`[teams] checked=${teams?.length ?? 0} changed=${changed} failed=${failed}`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error("[teams] job failed", error);
  process.exitCode = 1;
});
