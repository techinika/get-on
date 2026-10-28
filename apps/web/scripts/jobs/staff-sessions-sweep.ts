import { createAdminClient } from "../../lib/supabase/admin";

async function main() {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("staff_sessions_sweep");
  if (error) throw error;
  const result = (data ?? {}) as Record<string, number>;
  console.log(
    `[staff-sessions] closed=${result.sessions_closed ?? 0} events=${result.events_purged ?? 0}`,
  );
}

main().catch((error) => {
  console.error("[staff-sessions] job failed", error);
  process.exitCode = 1;
});
