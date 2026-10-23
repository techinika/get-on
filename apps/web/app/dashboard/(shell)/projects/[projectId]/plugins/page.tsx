import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getShellData } from "@/lib/dashboard";
import { planLimits } from "@/lib/team";
import { PLUGIN_MANIFESTS } from "@get-on/plugins";
import { PluginsContent, type PluginCardData } from "@/components/project/plugins-content";

type Props = {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ enable?: string }>;
};

export default async function PluginsPage({ params, searchParams }: Props) {
  const { projectId } = await params;
  const query = await searchParams;
  const data = await getShellData();
  if (!data) redirect("/login");

  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", projectId)
    .eq("team_id", data.currentTeam.id)
    .maybeSingle();
  if (!project) notFound();

  const { data: installs } = await supabase
    .from("plugin_installs")
    .select("plugin_id, state")
    .eq("project_id", projectId);

  const installStates = new Map(
    (installs ?? []).map((row) => [String(row.plugin_id), String(row.state)]),
  );
  const plan = planLimits(data.currentTeam.planId);
  const used = [...installStates.values()].filter((state) => state === "active").length;

  const plugins: PluginCardData[] = PLUGIN_MANIFESTS.map((plugin) => {
    const state = installStates.get(plugin.id);
    const locked = plugin.status === "available" && data.currentTeam.planId === "free" && !plugin.freeOk;
    return {
      id: plugin.id,
      name: plugin.name,
      tagline: plugin.description,
      icon: plugin.icon,
      status: plugin.status,
      state: state === "active" ? "active" : state === "disabled" ? "disabled" : "absent",
      locked,
      mainRoute: plugin.nav[0]?.route,
      settingsRoute: plugin.settingsRoute,
    };
  });

  return (
    <PluginsContent
      projectId={project.id}
      projectName={project.name}
      teamName={data.currentTeam.name}
      plugins={plugins}
      used={used}
      limit={plan.maxPlugins}
      planName={plan.name}
      initialEnable={query.enable}
    />
  );
}
