import { createAdminClient } from "../../lib/supabase/admin";
import { logTeamActivity } from "../../lib/activity/log";

async function main() {
  const admin = createAdminClient();
  const now = new Date();
  const { data: projects, error } = await admin
    .from("projects")
    .select("id, team_id, name, subdomain, purge_after, subdomain_hold_until")
    .not("deleted_at", "is", null)
    .lte("purge_after", now.toISOString())
    .limit(100);
  if (error) throw error;

  let purged = 0;
  let failed = 0;
  for (const project of projects ?? []) {
    const { data: media } = await admin
      .from("media")
      .select("path")
      .eq("project_id", project.id);
    const paths = (media ?? []).map((item) => item.path).filter(Boolean);
    if (paths.length > 0) {
      const { error: storageError } = await admin.storage.from("project-media").remove(paths);
      if (storageError) console.error(`[purge] media cleanup failed for ${project.id}`, storageError);
    }

    await logTeamActivity({
      teamId: project.team_id,
      actor: { userId: null, name: "Get-On", kind: "system" },
      event: "website_purged",
      summary: `The website ${project.name} was removed for good`,
      project: { id: project.id, name: project.name },
      meta: { subdomain: project.subdomain, purgedAt: now.toISOString() },
    });

    const holdUntil = project.subdomain_hold_until
      ? new Date(project.subdomain_hold_until)
      : new Date(now.getTime() + 30 * 864e5);
    if (holdUntil.getTime() > now.getTime()) {
      await admin
        .from("subdomain_holds")
        .upsert({ name: project.subdomain, hold_until: holdUntil.toISOString() }, { onConflict: "name" });
    }

    const { error: deleteError } = await admin.from("projects").delete().eq("id", project.id);
    if (deleteError) {
      failed += 1;
      console.error(`[purge] delete failed for ${project.id}`, deleteError);
      continue;
    }
    purged += 1;
  }

  console.log(`[purge] purged=${purged} failed=${failed}`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error("[purge] job failed", error);
  process.exitCode = 1;
});
