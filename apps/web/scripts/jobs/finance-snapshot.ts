import { createAdminClient } from "../../lib/supabase/admin";

async function main() {
  const month = process.argv[2];
  if (month && !/^\d{4}-\d{2}-\d{2}$/.test(month)) {
    throw new Error("Month must look like 2026-10-01.");
  }
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("finance_snapshot", { p_month: month ?? null });
  if (error) throw error;
  const result = (data ?? {}) as { month?: string };
  console.log(`[finance] month=${result.month ?? "current"}`);
}

main().catch((error) => {
  console.error("[finance] job failed", error);
  process.exitCode = 1;
});
