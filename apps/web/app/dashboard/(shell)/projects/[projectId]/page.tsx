import { notFound } from "next/navigation";
import { Eye } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTeam, planLimits } from "@/lib/team";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Checklist } from "@/components/project/checklist";

export const instant = false;

type Params = { params: Promise<{ projectId: string }> };

type ProjectRow = {
  id: string;
  name: string;
  subdomain: string;
  status: string;
  settings: unknown;
};

type ProjectSettings = {
  contact?: { phone?: string; email?: string; address?: string };
  logoData?: string | null;
};

export default async function OverviewPage({ params }: Params) {
  const { projectId } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("projects")
    .select("id, name, subdomain, status, settings")
    .eq("id", projectId)
    .maybeSingle();

  const project = data as ProjectRow | null;
  if (!project) {
    notFound();
  }

  const { count: pageCount } = await supabase
    .from("pages")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId);

  const current = await getCurrentTeam();
  const plan = planLimits(current?.team.planId ?? "free");

  const settings = (project.settings ?? {}) as ProjectSettings;
  const contact = settings.contact ?? {};
  const detailsDone = Boolean(
    (contact.phone ?? "").trim() ||
      (contact.email ?? "").trim() ||
      (contact.address ?? "").trim() ||
      settings.logoData,
  );

  const used = pageCount ?? 0;
  const status = project.status === "published" ? "published" : "draft";

  return (
    <div>
      <h1 className="text-h1">Overview</h1>
      <p className="mt-2 text-base text-text-muted">
        Here is what to do next to get your website ready.
      </p>

      <Checklist
        projectId={project.id}
        subdomain={project.subdomain}
        detailsDone={detailsDone}
        customDomainAllowed={plan.customDomainAllowed}
      />

      <section aria-label="Website summary" className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="p-5">
          <p className="text-sm text-text-muted">Pages</p>
          <p className="mt-1 font-heading text-2xl font-bold">
            {used} of {plan.maxPagesPerSite ?? "unlimited"}
          </p>
          {plan.maxPagesPerSite !== null ? (
            <Progress
              value={plan.maxPagesPerSite > 0 ? (used / plan.maxPagesPerSite) * 100 : 0}
              label="Pages used"
              className="mt-3"
            />
          ) : null}
        </Card>

        <Card className="p-5">
          <p className="text-sm text-text-muted">Storage</p>
          <p className="mt-1 font-heading text-2xl font-bold">0 MB of {plan.storageMb} MB</p>
        </Card>

        <Card className="p-5">
          <p className="text-sm text-text-muted">Status</p>
          <div className="mt-1">
            {status === "published" ? (
              <Badge variant="live" dot className="h-9 px-4 text-base">
                Live
              </Badge>
            ) : (
              <Badge variant="draft" className="h-9 px-4 text-base">
                Draft
              </Badge>
            )}
          </div>
          <p className="mt-3 text-sm text-text-muted">
            {status === "published" ? "Visible to everyone" : "Not live yet"}
          </p>
        </Card>
      </section>

      <div className="mt-4 flex aspect-[16/10] max-h-[360px] w-full flex-col items-center justify-center rounded-card border border-border bg-surface-muted">
        <Eye size={32} strokeWidth={1.75} aria-hidden className="text-text-muted" />
        <p className="mt-3 text-base text-text-muted">Preview coming soon</p>
      </div>
    </div>
  );
}
