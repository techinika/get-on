import { createAdminClient } from "../../lib/supabase/admin";

async function main() {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("release_subdomain_holds");
  if (error) throw error;
  console.log(`[subdomains] released=${Number(data ?? 0)}`);
}

main().catch((error) => {
  console.error("[subdomains] job failed", error);
  process.exitCode = 1;
});
