import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getShellData } from "@/lib/dashboard";
import { parseContactSettings } from "@/lib/contact/settings";
import {
  ContactSettings,
  type FormPage,
  type RecipientRow,
} from "@/components/project/contact-settings";

type Props = { params: Promise<{ projectId: string }> };

type Block = { id?: unknown; type?: unknown; props?: { variation?: unknown } };

function formsOnPages(
  pages: Array<{ id: string; title: string; path: string; blocks: unknown }>,
): FormPage[] {
  const found: FormPage[] = [];
  for (const page of pages) {
    const blocks = Array.isArray(page.blocks)
      ? page.blocks
      : Array.isArray((page.blocks as { blocks?: unknown[] } | null)?.blocks)
        ? ((page.blocks as { blocks: unknown[] }).blocks)
        : [];
    for (const block of blocks as Block[]) {
      if (block?.type !== "contact-form") continue;
      const blockId = typeof block.id === "string" ? block.id : "form";
      found.push({
        pageId: page.id,
        pageTitle: page.title,
        path: page.path,
        blockId,
      });
    }
  }
  return found;
}

export default async function ContactPluginPage({ params }: Props) {
  const { projectId } = await params;
  const data = await getShellData();
  if (!data) redirect("/login");

  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, name, team_id")
    .eq("id", projectId)
    .eq("team_id", data.currentTeam.id)
    .maybeSingle();
  if (!project) notFound();

  const [{ data: settingsRow }, { data: install }, { data: recipients }, { data: pages }, { data: team }] =
    await Promise.all([
      supabase
        .from("project_settings")
        .select("contact_settings")
        .eq("project_id", projectId)
        .maybeSingle(),
      supabase
        .from("plugin_installs")
        .select("state")
        .eq("project_id", projectId)
        .eq("plugin_id", "contact")
        .maybeSingle(),
      supabase
        .from("contact_recipients")
        .select("id, email, verified_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true }),
      supabase
        .from("pages")
        .select("id, title, path, blocks")
        .eq("project_id", projectId)
        .order("position", { ascending: true }),
      supabase.from("teams").select("owner_id").eq("id", project.team_id).maybeSingle(),
    ]);

  let ownerEmail = data.user.email;
  try {
    const admin = createAdminClient();
    if (team?.owner_id) {
      const owner = await admin.auth.admin.getUserById(String(team.owner_id));
      ownerEmail = owner?.data?.user?.email ?? ownerEmail;
    }
  } catch {
    // Fall back to the signed-in user's address.
  }

  const rows: RecipientRow[] = (recipients ?? []).map((row) => ({
    id: String(row.id),
    email: String(row.email),
    verified: Boolean(row.verified_at),
  }));

  return (
    <ContactSettings
      projectId={project.id}
      projectName={project.name}
      teamName={data.currentTeam.name}
      ownerEmail={ownerEmail ?? ""}
      initialSettings={parseContactSettings(settingsRow?.contact_settings)}
      recipients={rows}
      formPages={formsOnPages((pages ?? []) as Array<{ id: string; title: string; path: string; blocks: unknown }>)}
      active={install?.state === "active"}
      planId={data.currentTeam.planId}
    />
  );
}
