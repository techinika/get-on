import { createAdminClient } from "../../lib/supabase/admin";

async function main() {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("consent_audit");
  if (error) throw error;
  const result = (data ?? {}) as Record<string, number>;
  console.log(
    `[consent] mismatched=${result.mismatched ?? 0} disabled=${result.disabled ?? 0}`,
  );
}

main().catch((error) => {
  console.error("[consent] job failed", error);
  process.exitCode = 1;
});
