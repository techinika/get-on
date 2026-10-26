import { createAdminClient } from "../../lib/supabase/admin";
import { qualifyDueReferrals } from "../../lib/referral-rewards";

async function main() {
  const admin = createAdminClient();
  const result = await qualifyDueReferrals(admin);
  console.log(`[referrals] qualified=${result.qualified} failed=${result.failed}`);
  if (result.failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error("[referrals] job failed", error);
  process.exitCode = 1;
});
