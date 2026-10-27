import { createAdminClient } from "@/lib/supabase/admin";

async function main() {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { error: expireError } = await admin.rpc("expire_links_now", { p_now: now });
  if (expireError) {
    // The RPC does not exist yet; fall back to direct update.
    const { error } = await admin
      .from("tracked_links")
      .update({ revoked_at: now })
      .is("revoked_at", null)
      .lt("created_at", now);
    if (error) console.error("[links-expire] update failed:", error.message);
    else console.log("[links-expire] expired links updated.");
  } else {
    console.log("[links-expire] expired links updated via RPC.");
  }
}

main().catch((e) => {
  console.error("[links-expire] error:", e);
  process.exitCode = 1;
});
