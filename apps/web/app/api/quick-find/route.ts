import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTeam } from "@/lib/team";
import { rankItems, type QuickFindItem } from "@/lib/quick-find";
import {
  getCachedQuickFind,
  setCachedQuickFind,
  quickFindKey,
} from "@/lib/quick-find-cache";

export const dynamic = "force-dynamic";

const GO_TO: QuickFindItem[] = [
  { id: "go-websites", title: "Websites", href: "/dashboard", icon: "link" },
  { id: "go-team", title: "Team", href: "/dashboard/team", icon: "link" },
  { id: "go-plan", title: "Plan and billing", href: "/dashboard/plan", icon: "link" },
  { id: "go-account", title: "Account", href: "/dashboard/account", icon: "link" },
  { id: "go-demo", title: "Request a demo", href: "/request-demo", icon: "link" },
];

/**
 * Quick find data source (spec §5.9). One lightweight request returns the
 * websites of the current team, the pages of the current project and the
 * "Go to" destinations.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim();
  const projectId = url.searchParams.get("projectId");

  const current = await getCurrentTeam();
  if (!current) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  const supabase = await createClient();

  const cacheKey = quickFindKey(current.team.teamId, projectId);
  let cached = getCachedQuickFind(cacheKey);
  if (!cached) {
    const { data: projects } = await supabase
      .from("projects")
      .select("id, name, subdomain")
      .eq("team_id", current.team.teamId)
      .order("created_at", { ascending: false });

    const websites: QuickFindItem[] = (projects ?? []).map((project) => ({
      id: project.id,
      title: project.name,
      detail: `${project.subdomain}.get-on.tech`,
      href: `/dashboard/projects/${project.id}`,
      icon: "website",
    }));

    let pages: QuickFindItem[] = [];
    if (projectId) {
      const { data } = await supabase
        .from("pages")
        .select("id, title, path, project_id")
        .eq("project_id", projectId)
        .order("position", { ascending: true });

      pages = (data ?? []).map((page) => ({
        id: page.id,
        title: page.title,
        detail: page.path,
        href: `/dashboard/projects/${page.project_id}/pages/${page.id}`,
        icon: "page",
      }));
    }

    cached = { websites, pages };
    setCachedQuickFind(cacheKey, cached);
  }

  return NextResponse.json({
    websites: rankItems(query, cached.websites),
    pages: rankItems(query, cached.pages),
    goTo: rankItems(query, GO_TO),
  });
}
