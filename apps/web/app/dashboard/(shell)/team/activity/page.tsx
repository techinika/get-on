import Link from "next/link";
import { redirect } from "next/navigation";
import { History } from "lucide-react";
import { AppPage } from "@/components/app/app-page";
import { PageHeader } from "@/components/app/page-header";
import { AppCard } from "@/components/app/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { getShellData } from "@/lib/dashboard";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { relativeTime } from "@/lib/relative-time";

type Params = {
  searchParams: Promise<{
    category?: string;
    project?: string;
    actor?: string;
    range?: string;
    q?: string;
    page?: string;
  }>;
};

const CATEGORY_CHIPS: Array<{ key: string; label: string; categories: string[] | null }> = [
  { key: "all", label: "All", categories: null },
  { key: "website", label: "Websites", categories: ["website"] },
  { key: "page", label: "Pages", categories: ["page"] },
  { key: "design", label: "Design", categories: ["design"] },
  { key: "pictures", label: "Pictures", categories: ["pictures"] },
  { key: "settings", label: "Settings", categories: ["settings"] },
  { key: "domain", label: "Domains", categories: ["domain"] },
  { key: "plugin", label: "Plugins", categories: ["plugin"] },
  { key: "template", label: "Templates", categories: ["template"] },
  { key: "backup", label: "Backups", categories: ["backup"] },
  { key: "ai", label: "AI", categories: ["ai"] },
  { key: "people", label: "People", categories: ["member", "invitation", "team", "referral"] },
  { key: "billing", label: "Billing", categories: ["billing"] },
  { key: "security", label: "Security", categories: ["security"] },
];

const PAGE_SIZE = 50;

function rangeDate(range: string | undefined): string | null {
  if (range === "7") return new Date(Date.now() - 7 * 864e5).toISOString();
  if (range === "30") return new Date(Date.now() - 30 * 864e5).toISOString();
  if (range === "90") return new Date(Date.now() - 90 * 864e5).toISOString();
  return null;
}

export default async function TeamActivityPage({ searchParams }: Params) {
  const data = await getShellData();
  if (!data) redirect("/login");
  if (!can(data.currentTeam.role as "owner" | "admin" | "editor" | "viewer", "team.activity")) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const category = CATEGORY_CHIPS.find((chip) => chip.key === params.category) ?? CATEGORY_CHIPS[0]!;
  const page = Math.max(1, Number(params.page ?? "1") || 1);
  const since = rangeDate(params.range);
  const supabase = await createClient();

  let query = supabase
    .from("team_activity")
    .select("id, occurred_at, first_at, last_at, count, actor_user_id, actor_name, actor_role, category, event, summary, project_id, project_name, target_type, target_id, target_name, meta, client")
    .eq("team_id", data.currentTeam.id)
    .order("occurred_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (category.categories) query = query.in("category", category.categories);
  if (params.project) query = query.eq("project_id", params.project);
  if (params.actor === "system") query = query.neq("actor_kind", "user");
  else if (params.actor) query = query.eq("actor_user_id", params.actor);
  if (since) query = query.gte("occurred_at", since);
  if (params.q) query = query.ilike("summary", `%${params.q.slice(0, 80)}%`);

  const [{ data: rows }, { data: projects }, { data: members }] = await Promise.all([
    query,
    supabase
      .from("projects")
      .select("id, name, deleted_at")
      .eq("team_id", data.currentTeam.id)
      .order("name", { ascending: true }),
    supabase
      .from("team_members")
      .select("user_id, status")
      .eq("team_id", data.currentTeam.id),
  ]);

  const memberIds = (members ?? []).map((member) => member.user_id);
  const { data: profiles } = memberIds.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", memberIds)
    : { data: [] };
  const nameById = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name ?? profile.email ?? "Former member"]));

  const activeProjects = (projects ?? []).filter((project) => !project.deleted_at);
  const deletedProjects = (projects ?? []).filter((project) => project.deleted_at);
  const hasMore = (rows ?? []).length === PAGE_SIZE;
  const base = `/dashboard/team/activity`;

  function href(overrides: Record<string, string | undefined>) {
    const next = new URLSearchParams();
    const merged = { ...params, ...overrides };
    for (const [key, value] of Object.entries(merged)) {
      if (value && key !== "page") next.set(key, value);
    }
    if (overrides.page) next.set("page", overrides.page);
    const qs = next.toString();
    return qs ? `${base}?${qs}` : base;
  }

  return (
    <AppPage width="wide">
      <PageHeader
        title="Team activity"
        description={`Everything that happens in ${data.currentTeam.name}, even on websites that were deleted.`}
        breadcrumbs={[{ label: data.currentTeam.name, href: "/dashboard" }, { label: "Activity" }]}
        actions={
          <Link
            href={`${base}/export?${new URLSearchParams(
              Object.entries(params).filter(([, value]) => Boolean(value)) as string[][],
            ).toString()}`}
            className="inline-flex h-11 items-center rounded-input border-[1.5px] border-border-strong bg-surface px-5 text-base font-semibold text-text hover:bg-surface-muted"
          >
            Export
          </Link>
        }
      />

      <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Filter by category">
        {CATEGORY_CHIPS.map((chip) => (
          <Link
            key={chip.key}
            href={href({ category: chip.key === "all" ? undefined : chip.key, page: undefined })}
            aria-current={category.key === chip.key ? "page" : undefined}
            className={cn(
              "inline-flex min-h-9 items-center rounded-pill border px-3.5 text-sm font-semibold",
              category.key === chip.key
                ? "border-primary bg-primary-soft text-primary"
                : "border-border bg-surface text-text-muted hover:bg-surface-muted hover:text-text",
            )}
          >
            {chip.label}
          </Link>
        ))}
      </div>

      <AppCard className="mb-5 p-4">
        <form method="get" className="flex flex-wrap items-end gap-3">
          {params.category ? <input type="hidden" name="category" value={params.category} /> : null}
          <label className="flex flex-col gap-1 text-sm font-semibold text-text">
            Website
            <select name="project" defaultValue={params.project ?? ""} className="h-11 min-w-[180px] rounded-input border-[1.5px] border-border-strong bg-surface px-3 text-sm text-text">
              <option value="">All websites</option>
              {activeProjects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
              {deletedProjects.length > 0 ? (
                <optgroup label="Deleted websites">
                  {deletedProjects.map((project) => (
                    <option key={project.id} value={project.id}>{project.name} (deleted)</option>
                  ))}
                </optgroup>
              ) : null}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-text">
            Person
            <select name="actor" defaultValue={params.actor ?? ""} className="h-11 min-w-[160px] rounded-input border-[1.5px] border-border-strong bg-surface px-3 text-sm text-text">
              <option value="">Everyone</option>
              {(members ?? []).map((member) => (
                <option key={member.user_id} value={member.user_id}>
                  {nameById.get(member.user_id) ?? "Former member"}
                </option>
              ))}
              <option value="system">Get-On support and system</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-text">
            Dates
            <select name="range" defaultValue={params.range ?? ""} className="h-11 rounded-input border-[1.5px] border-border-strong bg-surface px-3 text-sm text-text">
              <option value="">All time</option>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
            </select>
          </label>
          <label className="flex min-w-[180px] flex-1 flex-col gap-1 text-sm font-semibold text-text">
            Search
            <input
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="Search activity"
              className="h-11 rounded-input border-[1.5px] border-border-strong bg-surface px-3 text-sm text-text"
            />
          </label>
          <button type="submit" className="inline-flex h-11 items-center rounded-input bg-primary px-5 text-sm font-semibold text-on-primary hover:bg-primary-hover">
            Apply
          </button>
          <Link href={base} className="inline-flex h-11 items-center rounded-input px-3 text-sm font-semibold text-text-muted hover:text-text">
            Clear filters
          </Link>
        </form>
      </AppCard>

      {params.project && deletedProjects.some((project) => project.id === params.project) ? (
        <div className="mb-5 rounded-info bg-warning-soft p-4 text-sm text-warning-text">
          This website was deleted. Its history stays here. Restore it from the Recently deleted card if there is room.
        </div>
      ) : null}

      {!rows || rows.length === 0 ? (
        <EmptyState
          icon={<History size={40} aria-hidden />}
          title="No activity matches"
          description="Try a different filter or search. We keep activity for 730 days."
        />
      ) : (
        <AppCard className="overflow-hidden p-0">
          <ul className="divide-y divide-border">
            {rows.map((row) => {
              const isDeletedProject = deletedProjects.some((project) => project.id === row.project_id);
              return (
                <li key={row.id} className="flex min-h-16 items-start gap-3 px-5 py-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-input bg-surface-muted text-text-muted">
                    <History size={18} aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[15px] font-semibold text-text">{row.summary}</p>
                      {row.actor_user_id === data.user.id ? <Badge>You</Badge> : null}
                      {row.count > 1 ? <Badge>{row.count} times</Badge> : null}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-text-muted">
                      {row.project_name ? (
                        <span>
                          {row.project_name}
                          {isDeletedProject ? (
                            <Link href="/dashboard#recently-deleted" className="ml-1">
                              <Badge variant="danger">Deleted</Badge>
                            </Link>
                          ) : null}
                        </span>
                      ) : null}
                      <span>{relativeTime(row.occurred_at)}</span>
                      {row.client ? <span>from {row.client}</span> : null}
                    </div>
                    <details className="mt-2">
                      <summary className="w-fit cursor-pointer text-[13px] font-semibold text-primary">
                        Details
                      </summary>
                      <dl className="mt-2 grid gap-1.5 text-[13px] sm:grid-cols-[160px_1fr]">
                        <dt className="text-text-muted">Who</dt>
                        <dd className="text-text">{row.actor_name}{row.actor_role ? ` · ${row.actor_role}` : ""}</dd>
                        {row.target_name ? (
                          <>
                            <dt className="text-text-muted">What</dt>
                            <dd className="text-text">{row.target_name}</dd>
                          </>
                        ) : null}
                        {row.meta && Object.keys(row.meta as Record<string, unknown>).length > 0 ? (
                          <>
                            <dt className="text-text-muted">More</dt>
                            <dd className="text-text">
                              {Object.entries(row.meta as Record<string, unknown>).map(([key, value]) => (
                                <span key={key} className="mr-3 inline-block">
                                  {key.replaceAll("_", " ")}: {String(value)}
                                </span>
                              ))}
                            </dd>
                          </>
                        ) : null}
                      </dl>
                    </details>
                  </div>
                </li>
              );
            })}
          </ul>
        </AppCard>
      )}

      <div className="mt-5 flex items-center justify-between gap-3">
        <p className="text-sm text-text-muted">
          {hasMore ? "There is more." : "That is everything we have."}
        </p>
        {hasMore ? (
          <Link
            href={href({ page: String(page + 1) })}
            className="inline-flex h-11 items-center rounded-input border-[1.5px] border-border-strong bg-surface px-5 text-sm font-semibold text-text hover:bg-surface-muted"
          >
            Show more
          </Link>
        ) : null}
      </div>
    </AppPage>
  );
}
