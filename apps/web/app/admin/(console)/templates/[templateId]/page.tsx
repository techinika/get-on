import Link from "next/link";
import { notFound } from "next/navigation";
import { AppPage } from "@/components/app/app-page";
import { AppCard } from "@/components/app/card";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { RequestApprovalLink } from "@/components/admin/request-approval-link";
import { requireStaffAction } from "@/lib/admin";
import { getSystemTemplate } from "@/lib/templates/admin";
import { relativeTime } from "@/lib/relative-time";

export const dynamic = "force-dynamic";

function exact(value: string | null | undefined): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

function bytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function AdminTemplatePage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  await requireStaffAction("template.system.manage");
  const { templateId } = await params;
  const detail = await getSystemTemplate(templateId);
  if (!detail) notFound();

  const { template, versions } = detail;

  return (
    <AppPage width="default">
      <PageHeader
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Templates", href: "/admin/templates" },
          { label: template.name },
        ]}
        title={template.name}
        description={template.tagline || template.slug}
        actions={
          <Link
            href="/admin/templates"
            className={buttonVariants({ variant: "ghost", size: "md" })}
          >
            All templates
          </Link>
        }
      />

      <div className="flex flex-col gap-6">
        <AppCard className="p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={
                template.status === "published"
                  ? "live"
                  : template.status === "archived"
                    ? "neutral"
                    : "draft"
              }
            >
              {template.status === "published"
                ? "Published"
                : template.status === "archived"
                  ? "Archived"
                  : "Draft"}
            </Badge>
            {template.is_default ? <Badge variant="info">Default</Badge> : null}
            <span className="text-sm text-text-muted">
              {template.current_version === null
                ? "No live version"
                : `Live version ${template.current_version}`}
            </span>
          </div>

          <p className="mt-4 text-[15px] leading-6 text-text-muted">
            {template.description || "No description saved."}
          </p>

          <dl className="mt-4 grid grid-cols-1 gap-3 min-[640px]:grid-cols-3">
            <div>
              <dt className="text-label-caps text-text-muted">Category</dt>
              <dd className="mt-1 text-sm font-medium capitalize text-text">
                {template.category.replace(/_/g, " ")}
              </dd>
            </div>
            <div>
              <dt className="text-label-caps text-text-muted">Minimum plan</dt>
              <dd className="mt-1 text-sm font-medium capitalize text-text">
                {template.plan_min}
              </dd>
            </div>
            <div>
              <dt className="text-label-caps text-text-muted">Updated</dt>
              <dd className="mt-1 text-sm font-medium text-text">
                {relativeTime(template.updated_at)}
              </dd>
            </div>
          </dl>
        </AppCard>

        <section>
          <h2 className="text-section-title text-text">Versions</h2>
          <AppCard className="mt-3 px-5">
            {versions.length === 0 ? (
              <p className="py-4 text-sm text-text-muted">
                No versions are saved yet. Sync from code on the templates list.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {versions.map((version) => {
                  const live = version.is_current && template.status === "published";
                  return (
                    <li
                      key={version.id}
                      className="flex flex-wrap items-start justify-between gap-3 py-4"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[15px] font-semibold text-text">
                            Version {version.version}
                          </span>
                          {live ? (
                            <Badge variant="live">Live</Badge>
                          ) : version.is_current ? (
                            <Badge variant="draft">Saved as live</Badge>
                          ) : (
                            <Badge variant="neutral">Draft</Badge>
                          )}
                        </div>
                        <p className="mt-1 text-[13px] text-text-muted">
                          {version.page_count} page
                          {version.page_count === 1 ? "" : "s"} ·{" "}
                          {version.block_count} section
                          {version.block_count === 1 ? "" : "s"} ·{" "}
                          {version.asset_count} picture
                          {version.asset_count === 1 ? "" : "s"} ·{" "}
                          {bytes(version.bytes)}
                        </p>
                        <p className="mt-1 text-[13px] text-text-muted">
                          Saved {exact(version.created_at)} ·{" "}
                          <span className="font-mono">
                            {version.package_hash.slice(0, 12)}
                          </span>
                        </p>
                      </div>

                      <div>
                        {live ? null : (
                          <RequestApprovalLink
                            kind="template_publish"
                            targetId={template.id}
                            versionId={version.id}
                            label="Request publish"
                            size="sm"
                          />
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </AppCard>
        </section>

        <p className="text-[13px] text-text-muted">
          Publishing a version needs a reason and another Super admin&apos;s
          approval. The request appears in Approvals.
        </p>
      </div>
    </AppPage>
  );
}
