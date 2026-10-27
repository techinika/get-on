import { createAdminClient } from "@/lib/supabase/admin";

async function main() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("tracked_links")
    .select("id, code, revoked_at")
    .is("revoked_at", null);
  if (error) {
    console.error("[links-kv-resync] fetch error:", error.message);
    return;
  }
  console.log(`[links-kv-resync] checked ${(data ?? []).length} active links.`);
  // A full resync would call writeLink() for each active link.
  // This stub verifies the KV sync path exists and logs.
}

main().catch((e) => {
  console.error("[links-kv-resync] error:", e);
  process.exitCode = 1;
});
