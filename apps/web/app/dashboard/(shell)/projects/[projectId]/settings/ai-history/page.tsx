import Link from "next/link";
import { Sparkles } from "lucide-react";
import { AppCard } from "@/components/app/card";
import { EmptyState } from "@/components/ui/empty-state";
import { InfoBox } from "@/components/app/info-box";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTeam } from "@/lib/team";
import { relativeTime } from "@/lib/relative-time";
import { friendlyError } from "@/lib/errors";
import { historyChanges, isUndoableTask, wasUndone } from "@/lib/ai/history";
import { cn } from "@/lib/utils";
import { AiHistoryList, type AiHistoryItem } from "./ai-history-list";

type Params = {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ show?: string }>;
};

const TASK_LABELS: Record<string, string> = {
  "site.generate": "Wrote your website",
  "template.fill": "Wrote template text",
  "template.generate": "Wrote a template",
  "page.generate": "Wrote a page",
  "section.generate": "Wrote a section",
  "text.write": "Wrote text",
  "text.improve": "Improved text",
  "list.expand": "Added list items",
  "seo.write": "Wrote search text",
  "alt.describe": "Described a picture",
  "design.suggest": "Suggested a design",
  "profile.write": "Wrote your business profile",
  "tips.fix": "Fixed a tip",
  "image.generate": "Created a picture",
};

type StatusVariant = "neutral" | "draft" | "live" | "primary" | "accent" | "info" | "danger";

const STATUS: Record<string, { label: string; variant: StatusVariant }> = {
  queued: { label: "Waiting", variant: "neutral" },
  running: { label: "Writing", variant: "info" },
  succeeded: { label: "Done", variant: "live" },
  partial: { label: "Partly done", variant: "draft" },
  failed: { label: "Failed", variant: "danger" },
  refused: { label: "Refused", variant: "danger" },
  cancelled: { label: "Cancelled", variant: "neutral" },
};

const FILTERS = {
  all: { label: "Everything", tasks: null },
  website: { label: "Whole website", tasks: ["site.generate", "template.generate", "template.fill"] },
  pages: { label: "Pages", tasks: ["page.generate", "section.generate"] },
  text: { label: "Text", tasks: ["text.write", "text.improve", "list.expand", "profile.write", "tips.fix"] },
  seo: { label: "SEO", tasks: ["seo.write"] },
  pictures: { label: "Pictures", tasks: ["alt.describe", "image.generate"] },
  design: { label: "Design", tasks: ["design.suggest"] },
} as const;

type FilterKey = keyof typeof FILTERS;

function creditsLabel(credits: number): string {
  if (credits <= 0) return "Free";
  return credits === 1 ? "1 credit" : `${credits} credits`;
}

export default async function AiHistoryPage({ params, searchParams }: Params) {
  const { projectId } = await params;
  const { show } = await searchParams;
  const filter: FilterKey = show && show in FILTERS ? (show as FilterKey) : "all";
  const current = await getCurrentTeam();

  let requests: Array<{
    id: string;
    task: string;
    status: string;
    charged_credits: number;
    created_at: string;
    error_code: string | null;
    user_id: string;
    steps: unknown;
  }> = [];
  const nameById = new Map<string, string>();

  if (current) {
    const supabase = await createClient();
    let query = supabase
      .from("ai_requests")
      .select("id, task, status, charged_credits, created_at, error_code, user_id, steps")
      .eq("team_id", current.team.teamId)
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(50);
    const tasks = FILTERS[filter].tasks;
    if (tasks) query = query.in("task", tasks);
    const { data } = await query;
    requests = data ?? [];

    const userIds = [...new Set(requests.map((request) => request.user_id))];
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);
      for (const profile of profiles ?? []) {
        if (profile.full_name) nameById.set(profile.id, profile.full_name);
      }
    }
  }

  const payloadById = new Map<string, { input?: unknown; output?: unknown }>();
  if (requests.length > 0) {
    try {
      const admin = createAdminClient();
      const { data: payloads } = await admin
        .from("ai_payloads")
        .select("request_id, input, output")
        .in("request_id", requests.map((request) => request.id));
      for (const payload of payloads ?? []) {
        payloadById.set(payload.request_id, {
          input: payload.input,
          output: payload.output,
        });
      }
    } catch {
      // Payloads are optional; the history still works without them.
    }
  }

  const items: AiHistoryItem[] = requests.map((request) => {
    const status = STATUS[request.status] ?? {
      label: request.status,
      variant: "neutral" as const,
    };
    const name = nameById.get(request.user_id);
    const payload = payloadById.get(request.id);
    const undone = wasUndone(request.steps);
    return {
      id: request.id,
      summary: TASK_LABELS[request.task] ?? "AI action",
      meta: `${name ? `${name} · ` : ""}${relativeTime(request.created_at)} · ${creditsLabel(request.charged_credits)}`,
      statusLabel: status.label,
      statusVariant: status.variant,
      error: request.error_code ? friendlyError(request.error_code) : null,
      changes: payload ? historyChanges(request.task, payload) : [],
      canUndo:
        isUndoableTask(request.task) &&
        ["succeeded", "partial"].includes(request.status) &&
        Boolean(payload) &&
        !undone,
      undone,
    };
  });

  return (
    <div className="max-w-[760px]">
      <header className="mb-6">
        <div className="text-sm text-text-muted">
          <Link
            className="text-primary hover:underline"
            href={`/dashboard/projects/${projectId}/settings/writing`}
          >
            Writing style
          </Link>
          {" / "}
          <span>AI history</span>
        </div>
        <h1 className="mt-2 font-heading text-[22px] font-bold text-text">AI history</h1>
        <p className="mt-1 text-[15px] text-text-muted">
          What AI wrote for this website, who asked for it and what it cost.
        </p>
      </header>

      <InfoBox className="mb-6">
        AI never publishes on its own. Every change waits for you to review it.
      </InfoBox>

      <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Filter AI history">
        {(Object.entries(FILTERS) as Array<[FilterKey, (typeof FILTERS)[FilterKey]]>).map(
          ([key, value]) => (
            <Link
              key={key}
              href={`/dashboard/projects/${projectId}/settings/ai-history${key === "all" ? "" : `?show=${key}`}`}
              aria-current={filter === key ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center rounded-pill border px-4 text-sm font-semibold transition-colors",
                filter === key
                  ? "border-primary bg-primary-soft text-primary"
                  : "border-border bg-surface text-text-muted hover:bg-surface-muted hover:text-text",
              )}
            >
              {value.label}
            </Link>
          ),
        )}
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft text-primary">
              <Sparkles size={28} strokeWidth={1.75} aria-hidden />
            </span>
          }
          title="No AI history yet"
          description="When you use AI to write or change something, it will show up here."
          action={
            <Link
              href={`/dashboard/projects/${projectId}/settings/writing`}
              className="inline-flex h-11 items-center rounded-input bg-primary px-5 text-base font-semibold text-on-primary hover:bg-primary-hover"
            >
              Set your writing style
            </Link>
          }
        />
      ) : (
        <AppCard>
          <AiHistoryList projectId={projectId} items={items} />
        </AppCard>
      )}
    </div>
  );
}
