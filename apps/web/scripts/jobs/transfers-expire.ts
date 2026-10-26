import { createAdminClient } from "@/lib/supabase/admin";
import { logTeamActivity } from "@/lib/activity/log";

async function main() {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { data: rows, error } = await admin
    .from("ownership_transfers")
    .select("id, project_id, from_team_id, to_email")
    .eq("status", "pending")
    .lte("expires_at", now)
    .limit(200);
  if (error) throw error;

  for (const row of rows ?? []) {
    const { error: updateError } = await admin
      .from("ownership_transfers")
      .update({ status: "expired", resolved_at: now })
      .eq("id", row.id)
      .eq("status", "pending");
    if (updateError) {
      console.error("transfer expire failed", row.id, updateError.message);
      continue;
    }
    const { data: project } = await admin
      .from("projects")
      .select("name")
      .eq("id", row.project_id)
      .maybeSingle();
    await logTeamActivity({
      teamId: row.from_team_id,
      actor: { userId: null, name: "Get-On", kind: "system" },
      event: "website_transfer_expired",
      summary: `The transfer of ${project?.name ?? "a website"} to ${row.to_email ?? "someone"} expired`,
      project: { id: row.project_id, name: project?.name ?? "Website" },
      target: { type: "transfer", id: row.id, name: row.to_email },
    });
  }

  console.log(`transfers-expire: ${rows?.length ?? 0} expired`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
