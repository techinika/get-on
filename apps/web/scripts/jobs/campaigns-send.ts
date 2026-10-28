import { createAdminClient } from "../../lib/supabase/admin";

async function main() {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { data: campaigns, error } = await admin
    .from("marketing_campaigns")
    .select("id,name")
    .eq("status", "scheduled")
    .lte("scheduled_for", now)
    .order("scheduled_for", { ascending: true })
    .limit(10);
  if (error) throw error;

  let queued = 0;
  let skipped = 0;
  let paused = 0;
  for (const campaign of campaigns ?? []) {
    const { data, error: queueError } = await admin.rpc("marketing_campaign_queue", {
      p_campaign_id: campaign.id,
    });
    if (!queueError) {
      queued += Number((data as { queued?: number } | null)?.queued ?? 0);
      continue;
    }
    const message = queueError.message ?? "";
    if (message.includes("MARKETING_DAILY_CAP") || message.includes("MARKETING_PAUSED")) {
      skipped += 1;
      break;
    }
    paused += 1;
    await admin
      .from("marketing_campaigns")
      .update({
        status: "paused",
        paused_reason: message.slice(0, 300) || "The campaign could not be queued.",
        updated_at: new Date().toISOString(),
      })
      .eq("id", campaign.id)
      .eq("status", "scheduled");
    console.error(`[campaigns] paused ${campaign.id}: ${message}`);
  }

  console.log(`[campaigns] queued=${queued} skipped=${skipped} paused=${paused}`);
  if (paused > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error("[campaigns] job failed", error);
  process.exitCode = 1;
});
