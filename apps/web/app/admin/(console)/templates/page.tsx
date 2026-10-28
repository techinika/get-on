import Link from "next/link";
import { AppPage } from "@/components/app/app-page";
import { AppCard } from "@/components/app/card";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { requireStaffAction } from "@/lib/admin";
import { listSystemTemplates } from "@/lib/templates/admin";
import { relativeTime } from "@/lib/relative-time";
import { syncTemplatesAction } from "./actions";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ saved?: string; error?: string }> };

export default async function AdminTemplatesPage({ searchParams }: Props) {
  await requireStaffAction("template.system.manage");
  const params = await searchParams;
  const templates = await listSystemTemplates();

  return (
    <AppPage width="wide">
      <PageHeader
        title="Templates"
        description="Platform-owned templates and the version each website receives."
        actions={
          <>
            <form action={syncTemplatesAction}>
              <Button type="submit" variant="secondary">
                Sync from code
              </Button>
            </form>
            <Link
              href="/admin"
              className={buttonVariants({ variant: "ghost", size: "md" })}
            >
              Back to admin
            </Link>
          </>
        }
      />

      {params.saved ? (
        <p className="mb-4 rounded-card bg-success-soft p-3 text-sm text-success-text">
          {params.saved}
        </p>
      ) : null}
      {params.error ? (
        <p className="mb-4 rounded-card bg-danger-soft p-3 text-sm text-danger-text">
          {params.error}
        </p>
      ) : null}

      {templates.length === 0 ? (
        <AppCard className="p-6">
          <p className="text-base font-semibold text-text">No templates yet.</p>
          <p className="mt-1 text-sm text-text-muted">
            Sync from code to save the current template packages as drafts.
          </p>
        </AppCard>
      ) : (
        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full min-w-[980px] border-collapse text-left">
            <thead>
              <tr className="border-b border-border text-xs font-bold uppercase tracking-wide text-text-muted">
                <th className="px-4 py-3">Template</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Live version</th>
                <th className="px-4 py-3">Saved versions</th>
                <th className="px-4 py-3">Pages</th>
                <th className="px-4 py-3">Used</th>
                <th className="px-4 py-3">Updated</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((template) => (
                <tr key={template.id} className="border-b border-border last:border-b-0">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/templates/${template.id}`}
                      className="text-[15px] font-semibold text-primary hover:underline"
                    >
                      {template.name}
                    </Link>
                    <p className="mt-0.5 font-mono text-xs text-text-muted">
                      {template.slug}
                    </p>
                    {template.is_default ? (
                      <Badge variant="info" className="mt-1">
                        Default
                      </Badge>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
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
                  </td>
                  <td className="px-4 py-3 text-sm text-text">
                    {template.current_version === null
                      ? "Not published"
                      : `Version ${template.current_version}`}
                  </td>
                  <td className="px-4 py-3 text-sm text-text-muted">
                    {template.version_count}
                  </td>
                  <td className="px-4 py-3 text-sm text-text-muted">
                    {template.page_count}
                  </td>
                  <td className="px-4 py-3 text-sm text-text-muted">
                    {template.uses_count}
                  </td>
                  <td className="px-4 py-3 text-sm text-text-muted">
                    {relativeTime(template.updated_at)}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/templates/${template.id}`}
                      className="text-sm font-semibold text-primary hover:underline"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-[13px] text-text-muted">
        Syncing saves the current code package as a draft version. Publishing a
        version needs another Super admin&apos;s approval.
      </p>
    </AppPage>
  );
}
