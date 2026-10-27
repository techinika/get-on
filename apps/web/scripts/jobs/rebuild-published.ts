import { createAdminClient } from "@/lib/supabase/admin";
import { RENDERER_CSS_VERSION } from "@get-on/renderer";
import {
  PublishError,
  rebuildPublishedSite,
  type PublishContext,
} from "@/lib/publishing/service";

type LiveRow = {
  id: string;
  project_id: string;
  content_revision: number;
  renderer_version: string | null;
  created_by: string | null;
  projects:
    | {
        id: string;
        name: string;
        subdomain: string;
        team_id: string;
        content_revision: number;
      }
    | {
        id: string;
        name: string;
        subdomain: string;
        team_id: string;
        content_revision: number;
      }[];
};

async function planIdFor(
  admin: ReturnType<typeof createAdminClient>,
  teamId: string,
): Promise<string> {
  const { data } = await admin.rpc("billing_resolve_team", { p_team: teamId });
  return String((data as { plan_id?: string } | null)?.plan_id ?? "free");
}

async function main(): Promise<void> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("publishes")
    .select(
      "id, project_id, content_revision, renderer_version, created_by, projects(id, name, subdomain, team_id, content_revision)",
    )
    .eq("status", "live")
    .or(`renderer_version.is.null,renderer_version.neq.${RENDERER_CSS_VERSION}`)
    .limit(100);
  if (error) throw error;

  const rows = (data ?? []) as unknown as LiveRow[];
  if (rows.length === 0) {
    console.log(`All live websites use renderer ${RENDERER_CSS_VERSION}.`);
    return;
  }

  let rebuilt = 0;
  let skipped = 0;
  for (const row of rows) {
    const project = Array.isArray(row.projects) ? row.projects[0] : row.projects;
    if (!project || !row.created_by) {
      skipped += 1;
      console.warn(`[rebuild] skipped ${row.project_id}: no project or author`);
      continue;
    }
    if (Number(project.content_revision) !== Number(row.content_revision)) {
      skipped += 1;
      console.warn(`[rebuild] skipped ${project.subdomain}: unpublished changes`);
      continue;
    }

    const ctx: PublishContext = {
      supabase: admin as unknown as PublishContext["supabase"],
      user: { id: row.created_by },
      team: {
        teamId: project.team_id,
        planId: await planIdFor(admin, project.team_id),
      },
      project: {
        id: project.id,
        name: project.name,
        subdomain: project.subdomain,
      },
      bypassRateLimit: true,
      force: true,
    };

    try {
      await rebuildPublishedSite(ctx);
      rebuilt += 1;
      console.log(`[rebuild] ${project.subdomain} -> ${RENDERER_CSS_VERSION}`);
    } catch (rebuildError) {
      if (rebuildError instanceof PublishError) {
        skipped += 1;
        console.warn(
          `[rebuild] skipped ${project.subdomain}: ${rebuildError.code}`,
        );
      } else {
        throw rebuildError;
      }
    }
  }

  console.log(`[rebuild] done: ${rebuilt} rebuilt, ${skipped} skipped.`);
}

main().catch((error) => {
  console.error("[rebuild] failed", error);
  process.exitCode = 1;
});
