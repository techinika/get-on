import { createAdminClient } from "../../lib/supabase/admin";
import { logTeamActivity } from "../../lib/activity/log";

async function main() {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { data: expired, error } = await admin
    .from("team_invitations")
    .select("id, team_id, email, role")
    .eq("status", "pending")
    .lt("expires_at", now)
    .limit(500);
  if (error) throw error;

  let count = 0;
  for (const invitation of expired ?? []) {
    const { error: updateError } = await admin
      .from("team_invitations")
      .update({ status: "expired", resolved_at: now })
      .eq("id", invitation.id)
      .eq("status", "pending");
    if (updateError) continue;
    count += 1;
    await logTeamActivity({
      teamId: invitation.team_id,
      actor: { userId: null, name: "Get-On", kind: "system" },
      event: "invite_expired",
      summary: `The invitation to ${invitation.email} expired`,
      target: { type: "invitation", id: invitation.id, name: invitation.email },
      meta: { role: invitation.role },
    });
  }
  console.log(`[invitations] expired=${count}`);
}

main().catch((error) => {
  console.error("[invitations] job failed", error);
  process.exitCode = 1;
});
