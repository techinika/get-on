import Link from "next/link";
import { AppPage } from "@/components/app/app-page";
import { AppCard } from "@/components/app/card";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { createAdminClient } from "@/lib/supabase/admin";
import { relativeTime } from "@/lib/relative-time";

export const dynamic = "force-dynamic";

type EmailRow = {
  id: string;
  kind: string | null;
  to_email: string | null;
  subject: string | null;
  status: "queued" | "sent" | "failed" | "suppressed";
  attempts: number;
  error: string | null;
  created_at: string;
  sent_at: string | null;
};

type SuppressionRow = {
  email: string;
  reason: "bounce" | "complaint" | "manual";
  detail: string | null;
  created_at: string;
};

function statusVariant(status: EmailRow["status"]) {
  if (status === "sent") return "live" as const;
  if (status === "failed") return "danger" as const;
  if (status === "suppressed") return "draft" as const;
  return "info" as const;
}

export default async function AdminEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const admin = createAdminClient();

  let query = admin
    .from("email_log")
    .select("id, kind, to_email, subject, status, attempts, error, created_at, sent_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (
    params.status === "sent" ||
    params.status === "queued" ||
    params.status === "failed" ||
    params.status === "suppressed"
  ) {
    query = query.eq("status", params.status);
  }

  const [{ data: logs }, { data: suppressions }, { count: queued }] = await Promise.all([
    query,
    admin
      .from("email_suppressions")
      .select("email, reason, detail, created_at")
      .order("created_at", { ascending: false })
      .limit(50),
    admin
      .from("email_log")
      .select("id", { count: "exact", head: true })
      .eq("status", "queued"),
  ]);

  const rows = (logs ?? []) as EmailRow[];
  const blocked = (suppressions ?? []) as SuppressionRow[];

  return (
    <AppPage width="wide">
      <PageHeader
        title="Email"
        description="Everything Get-On has tried to send."
        actions={
          <Link
            href="/admin"
            className="text-sm font-semibold text-primary hover:underline"
          >
            Back to admin
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 min-[768px]:grid-cols-3">
        <AppCard className="p-5">
          <p className="text-sm text-text-muted">Queued</p>
          <p className="text-stat-number mt-1 text-text">{queued ?? 0}</p>
        </AppCard>
        <AppCard className="p-5">
          <p className="text-sm text-text-muted">Blocked addresses</p>
          <p className="text-stat-number mt-1 text-text">{blocked.length}</p>
        </AppCard>
        <AppCard className="p-5">
          <p className="text-sm text-text-muted">Showing</p>
          <p className="text-stat-number mt-1 text-text">{rows.length}</p>
        </AppCard>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {[
          { label: "All", href: "/admin/email" },
          { label: "Queued", href: "/admin/email?status=queued" },
          { label: "Sent", href: "/admin/email?status=sent" },
          { label: "Failed", href: "/admin/email?status=failed" },
          { label: "Blocked", href: "/admin/email?status=suppressed" },
        ].map((item) => {
          const active =
            (item.href === "/admin/email" && !params.status) ||
            item.href.endsWith(`status=${params.status}`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                active
                  ? "flex h-9 items-center rounded-pill bg-primary px-3 text-sm font-semibold text-on-primary"
                  : "flex h-9 items-center rounded-pill bg-surface-muted px-3 text-sm font-semibold text-text-muted hover:bg-row-hover"
              }
            >
              {item.label}
            </Link>
          );
        })}
      </div>

      <section className="mt-4">
        <h2 className="sr-only">Email log</h2>
        {rows.length === 0 ? (
          <AppCard className="p-6">
            <p className="text-base text-text-muted">No email has been sent yet.</p>
          </AppCard>
        ) : (
          <div className="overflow-hidden rounded-card border border-border bg-surface">
            <ul className="divide-y divide-border">
              {rows.map((row) => (
                <li key={row.id} className="flex flex-col gap-2 p-4 min-[768px]:flex-row min-[768px]:items-start">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
                      <span className="text-sm font-semibold text-text">
                        {row.subject ?? "No subject"}
                      </span>
                    </div>
                    <p className="mt-1 break-all text-sm text-text-muted">
                      {row.to_email ?? "Unknown address"} · {row.kind ?? "email"}
                    </p>
                    {row.error ? (
                      <p className="mt-1 break-words text-sm text-danger-text">{row.error}</p>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-sm text-text-muted min-[768px]:text-right">
                    <p>{relativeTime(row.sent_at ?? row.created_at)}</p>
                    {row.attempts > 0 ? <p className="text-xs">Attempt {row.attempts}</p> : null}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-section-title text-text">Blocked addresses</h2>
        <p className="mt-1 text-sm text-text-muted">
          We do not email these addresses because they bounced or were marked as spam.
        </p>
        {blocked.length === 0 ? (
          <AppCard className="mt-3 p-6">
            <p className="text-base text-text-muted">No addresses are blocked.</p>
          </AppCard>
        ) : (
          <div className="mt-3 overflow-hidden rounded-card border border-border bg-surface">
            <ul className="divide-y divide-border">
              {blocked.map((row) => (
                <li key={row.email} className="flex flex-col gap-1 p-4 min-[768px]:flex-row min-[768px]:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="break-all text-sm font-semibold text-text">{row.email}</p>
                    <p className="text-sm text-text-muted">
                      {row.reason === "bounce"
                        ? "The address bounced."
                        : row.reason === "complaint"
                          ? "Marked as spam."
                          : "Blocked by a person."}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm text-text-muted">
                    {relativeTime(row.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </AppPage>
  );
}
