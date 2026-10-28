import { createAdminClient } from "../../lib/supabase/admin";

async function main() {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("report_refresh", { p_kind: null });
  if (error) throw error;
  const result = (data ?? {}) as { refreshed?: number };
  console.log(`[reports] refreshed=${result.refreshed ?? 0}`);
}

main().catch((error) => {
  console.error("[reports] job failed", error);
  process.exitCode = 1;
});
