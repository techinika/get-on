import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Eye } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { AppPage } from "@/components/app/app-page";
import { RenderPage, SiteRoot, SiteHeader, SiteFooter } from "@get-on/renderer";
import { migrateContent } from "@get-on/blocks";
import { parseTheme } from "@/lib/publishing/build-input";
import { getCurrentTeam } from "@/lib/team";
import { AiSectionComposer } from "./ai-section-composer";
import { PageTextEditor, type PageTextField } from "./page-text-editor";
import { collectTemplateSlots, type PageRow } from "@/lib/ai/template-slots";

type Params = { params: Promise<{ projectId: string; pageId: string }> };

export default async function PageEditorPage({ params }: Params) {
  const { projectId, pageId } = await params;
  const [current, supabase] = await Promise.all([getCurrentTeam(), createClient()]);

  const [{ data: project }, { data: pageData }, { data: settingsRow }] =
    await Promise.all([
      supabase
        .from("projects")
        .select("id, subdomain, settings, name")
        .eq("id", projectId)
        .maybeSingle(),
      supabase
        .from("pages")
        .select("id, project_id, title, path, blocks")
        .eq("id", pageId)
        .eq("project_id", projectId)
        .maybeSingle(),
      supabase
        .from("project_settings")
        .select("theme")
        .eq("project_id", projectId)
        .maybeSingle(),
    ]);

  const page = pageData as
    | { id: string; project_id: string; title: string; path: string; blocks: unknown }
    | null;
  if (!page || !project) {
    notFound();
  }

  const content = migrateContent(page.blocks);
  const theme = parseTheme((settingsRow as { theme?: unknown } | null)?.theme);
  const projectSettings =
    project.settings && typeof project.settings === "object"
      ? (project.settings as Record<string, unknown>)
      : {};
  const contact = projectSettings.contact as
    | { phone?: string; email?: string; address?: string }
    | undefined;
  const socialLinks = Array.isArray(projectSettings.socialLinks)
    ? (projectSettings.socialLinks as { network?: string; url?: string }[])
        .filter((link) => typeof link?.url === "string" && typeof link?.network === "string")
        .map((link) => ({ network: String(link.network), url: String(link.url) }))
    : undefined;
  const hours = typeof projectSettings.hours === "string" ? projectSettings.hours : undefined;
  const businessType = typeof projectSettings.businessType === "string" ? projectSettings.businessType : undefined;
  const tagline = typeof projectSettings.tagline === "string" ? projectSettings.tagline : undefined;

  const header = (
    <SiteHeader
      businessName={String(project.name)}
      logoUrl={null}
      nav={[]}
      watermark={false}
      theme={theme}
      tagline={tagline}
      businessType={businessType}
      phone={typeof contact?.phone === "string" ? contact.phone : undefined}
    />
  );
  const footer = (
    <SiteFooter
      businessName={String(project.name)}
      phone={typeof contact?.phone === "string" ? contact.phone : undefined}
      email={typeof contact?.email === "string" ? contact.email : undefined}
      address={typeof contact?.address === "string" ? contact.address : undefined}
      hours={hours}
      nav={[]}
      showWatermark={false}
      theme={theme}
      tagline={tagline}
      socialLinks={socialLinks}
    />
  );

  return (
    <AppPage width="wide">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link
              href={`/dashboard/projects/${projectId}/pages`}
              className="inline-flex h-11 items-center gap-2 text-sm font-semibold text-primary"
            >
              <ArrowLeft size={14} strokeWidth={1.75} aria-hidden />
              Pages
            </Link>
            <h1 className="text-h1 mt-1">Editing: {page.title}</h1>
            <p className="mt-1 text-sm text-text-muted">
              Edit your page with the preview below. Make changes from Pages or use the design tools as you go.
            </p>
          </div>
          <Link
            href={`/dashboard/projects/${projectId}/publish`}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-input border-[1.5px] border-border-strong bg-surface px-5 text-base font-semibold text-text hover:bg-surface-muted"
          >
            Publish
          </Link>
        </div>

        <Card className="overflow-hidden p-0">
          <div className="flex items-center gap-2 border-b border-border px-4 py-2">
            <Eye size={16} strokeWidth={1.75} aria-hidden />
            <span className="text-sm font-semibold">Page preview</span>
          </div>
          <div className="bg-surface-muted p-4 md:p-6">
            <div className="mx-auto max-w-[1100px] overflow-hidden rounded-card border border-border bg-surface shadow-card">
              <SiteRoot theme={theme}>
                <RenderPage
                  content={content}
                  header={header}
                  footer={footer}
                  ctx={{
                    mode: "editor",
                    contactEnabled: false,
                    theme,
                    hours,
                    address: typeof contact?.address === "string" ? contact.address : undefined,
                    phone: typeof contact?.phone === "string" ? contact.phone : undefined,
                    email: typeof contact?.email === "string" ? contact.email : undefined,
                    socialLinks,
                  }}
                />
              </SiteRoot>
            </div>
          </div>
        </Card>

        {current &&
        ["owner", "admin", "editor"].includes(current.team.role) ? (
          <>
            <PageTextEditor
              projectId={projectId}
              pageId={pageId}
              fields={(() => {
                const blockTypeById = new Map<string, string>();
                const blocks = Array.isArray(content.blocks) ? content.blocks : [];
                for (const block of blocks) {
                  if (block && typeof block === "object" && "id" in block) {
                    blockTypeById.set(String((block as { id: string }).id), String((block as { type?: string }).type ?? "Block"));
                  }
                }
                const rows: PageRow[] = [{ id: page.id, blocks: page.blocks }];
                const plan = collectTemplateSlots(rows, { includeEmpty: true });
                const fields: PageTextField[] = [];
                for (const slot of plan.slots) {
                  const ref = plan.refs.get(slot.id);
                  if (!ref) continue;
                  const blockType = blockTypeById.get(ref.blockId) ?? "Block";
                  const pathKey = String(ref.path[ref.path.length - 1] ?? "text");
                  fields.push({
                    id: slot.id,
                    text: slot.text,
                    label: `${blockType} · ${pathKey}`,
                    maxLength: ref.maxLength,
                  });
                }
                return fields;
              })()}
            />
            <AiSectionComposer projectId={projectId} pageId={pageId} />
          </>
        ) : null}

        <Card className="p-6">
          <details className="group">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-input text-base font-semibold text-text outline-offset-2 hover:bg-surface-muted [&::-webkit-details-marker]:hidden">
              Blocks (developer view)
              <ArrowLeft
                size={18}
                strokeWidth={1.75}
                aria-hidden
                className="ml-auto text-text-muted transition-transform group-open:-rotate-90"
              />
            </summary>
            <pre className="mt-3 overflow-x-auto rounded-input bg-surface-muted p-4 text-sm text-text">
              {JSON.stringify(content.blocks, null, 2)}
            </pre>
          </details>
        </Card>
      </div>
    </AppPage>
  );
}
