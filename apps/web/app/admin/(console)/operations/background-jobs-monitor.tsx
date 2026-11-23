"use client";

import * as React from "react";
import { RefreshCw, Play, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { AppCard } from "@/components/app/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import type {
  JobMode,
  OpsMonitorSnapshot,
  WorkerStatusSummary,
} from "@/lib/domains/ops-store";

type SnapshotResponse =
  | ({
      ok: true;
      mode?: "supabase" | "local";
    } & OpsMonitorSnapshot)
  | { ok: false; error: string };

type RunResponse = {
  ok: boolean;
  error?: string;
  snapshot?: OpsMonitorSnapshot;
  results?: Array<{
    ok: boolean;
    mode: JobMode;
    count: number;
    failed: number;
    message: string;
    error?: string;
  }>;
};

function formatTime(value: string | null): string {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Never";
  return date.toLocaleString(undefined, {
    dateStyle: "short",
    timeStyle: "medium",
  });
}

function formatDuration(ms: number | null): string {
  if (ms === null || Number.isNaN(ms)) return "—";
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  const mins = Math.floor(ms / 60_000);
  const secs = Math.round((ms % 60_000) / 1000);
  return `${mins} min ${secs} s`;
}

function workerBadgeProps(status: WorkerStatusSummary["status"]): {
  variant: "live" | "danger" | "primary" | "neutral";
  label: string;
  dot: boolean;
} {
  switch (status) {
    case "running":
      return { variant: "primary", label: "Running", dot: true };
    case "healthy":
      return { variant: "live", label: "Healthy", dot: true };
    case "error":
      return { variant: "danger", label: "Error", dot: false };
    default:
      return { variant: "neutral", label: "Idle", dot: false };
  }
}

export function BackgroundJobsMonitor({
  initialSnapshot,
}: {
  initialSnapshot: OpsMonitorSnapshot;
}) {
  const { toast } = useToast();
  const [snapshot, setSnapshot] = React.useState<OpsMonitorSnapshot>(initialSnapshot);
  const [live, setLive] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [runningTarget, setRunningTarget] = React.useState<JobMode | "all" | null>(null);
  const [errorFilter, setErrorFilter] = React.useState<string>("all");
  const [fetchError, setFetchError] = React.useState<string | null>(null);

  const fetchSnapshot = React.useCallback(async (silent = true) => {
    if (!silent) setRefreshing(true);
    try {
      const response = await fetch("/api/admin/operations/jobs", {
        cache: "no-store",
      });
      const payload = (await response.json()) as SnapshotResponse;
      if (!response.ok || !payload.ok) {
        setFetchError(
          "error" in payload ? payload.error : "Could not load background job status.",
        );
        return;
      }
      setSnapshot({
        counts: payload.counts,
        health: payload.health,
        workers: payload.workers,
        runs: payload.runs,
        errorLogs: payload.errorLogs,
        running: payload.running,
        updatedAt: payload.updatedAt,
      });
      setFetchError(null);
    } catch {
      if (!silent) {
        setFetchError("Could not reach background jobs monitor endpoint.");
      }
    } finally {
      if (!silent) setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    if (!live) return;
    const interval = setInterval(() => {
      void fetchSnapshot(true);
    }, 5000);
    return () => clearInterval(interval);
  }, [live, fetchSnapshot]);

  async function triggerJob(mode: JobMode | "all") {
    if (runningTarget !== null) return;
    setRunningTarget(mode);
    try {
      const response = await fetch("/api/admin/operations/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const payload = (await response.json()) as RunResponse;
      if (payload.snapshot) {
        setSnapshot(payload.snapshot);
      } else {
        await fetchSnapshot(true);
      }

      if (!response.ok) {
        toast(payload.error ?? "Background worker run failed.", "error");
        return;
      }

      if (mode === "all") {
        const failedCount = (payload.results ?? []).filter((r) => !r.ok).length;
        toast(
          failedCount === 0
            ? "All 6 domain workers finished cleanly."
            : `${failedCount} domain worker(s) reported errors.`,
          failedCount === 0 ? "success" : "error",
        );
      } else {
        const single = payload.results?.[0];
        toast(
          single?.ok
            ? `${single.mode}: ${single.message}`
            : `Worker ${mode} failed: ${single?.error ?? single?.message ?? "Unknown error"}`,
          single?.ok ? "success" : "error",
        );
      }
    } catch {
      toast("Failed to execute domain background worker.", "error");
    } finally {
      setRunningTarget(null);
    }
  }

  const runningCount = snapshot.running.length;
  const healthyCount = snapshot.workers.filter((w) => w.status === "healthy").length;
  const failingCount = snapshot.workers.filter((w) => w.status === "error").length;
  const filteredErrors =
    errorFilter === "all"
      ? snapshot.errorLogs
      : snapshot.errorLogs.filter((entry) => entry.job === errorFilter);

  return (
    <div className="space-y-5">
      <AppCard className="p-5">
        <div className="flex flex-col gap-4 min-[768px]:flex-row min-[768px]:items-center min-[768px]:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[17px] font-semibold text-text">
                Domain Background Workers
              </h2>
              <Badge variant={live ? "live" : "neutral"} dot={live}>
                {live ? "Live polling (5s)" : "Polling paused"}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-text-muted">
              Real-time execution state, throughput and error stream for domain maintenance workers.
              Last updated {formatTime(snapshot.updatedAt)}.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Switch
              checked={live}
              onCheckedChange={setLive}
              label="Auto-refresh"
              className="min-h-0"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              loading={refreshing}
              onClick={() => void fetchSnapshot(false)}
            >
              <RefreshCw size={15} strokeWidth={1.75} aria-hidden />
              Refresh
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              loading={runningTarget === "all"}
              loadingLabel="Running all..."
              disabled={runningTarget !== null}
              onClick={() => void triggerJob("all")}
            >
              <Play size={15} strokeWidth={1.75} aria-hidden />
              Run all workers
            </Button>
          </div>
        </div>

        {fetchError ? (
          <p role="alert" className="mt-3 text-sm text-danger-text">
            {fetchError}
          </p>
        ) : null}
      </AppCard>

      <div className="grid grid-cols-1 gap-4 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-4">
        <AppCard className="p-4">
          <p className="text-sm text-text-muted">Running now</p>
          <p className="text-stat-number mt-1 text-text">{runningCount}</p>
          <p className="mt-1 text-xs text-text-muted">of {snapshot.workers.length} registered workers</p>
        </AppCard>
        <AppCard className="p-4">
          <p className="text-sm text-text-muted">Healthy</p>
          <p className="text-stat-number mt-1 text-success-text">{healthyCount}</p>
          <p className="mt-1 text-xs text-text-muted">Completed last run cleanly</p>
        </AppCard>
        <AppCard className="p-4">
          <p className="text-sm text-text-muted">With errors</p>
          <p className="text-stat-number mt-1 text-danger-text">{failingCount}</p>
          <p className="mt-1 text-xs text-text-muted">Workers failing on latest run</p>
        </AppCard>
        <AppCard className="p-4">
          <p className="text-sm text-text-muted">Recorded error logs</p>
          <p className="text-stat-number mt-1 text-text">{snapshot.errorLogs.length}</p>
          <p className="mt-1 text-xs text-text-muted">Captured item & worker errors</p>
        </AppCard>
      </div>

      <div className="grid grid-cols-1 gap-4 min-[768px]:grid-cols-2">
        {snapshot.workers.map((worker) => {
          const badge = workerBadgeProps(worker.status);
          const isRunning = runningTarget === worker.mode || runningTarget === "all";
          return (
            <AppCard key={worker.mode} className="flex flex-col justify-between p-5">
              <div>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[16px] font-semibold text-text">{worker.label}</h3>
                      <code className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-xs text-text-muted">
                        {worker.mode}
                      </code>
                    </div>
                    <p className="mt-1 text-sm text-text-muted">{worker.description}</p>
                  </div>
                  <Badge variant={badge.variant} dot={badge.dot}>
                    {badge.label}
                  </Badge>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 rounded-card border border-border bg-surface-muted p-3 text-xs">
                  <div>
                    <dt className="text-text-muted">Last run</dt>
                    <dd className="mt-0.5 font-medium text-text">
                      {worker.status === "running"
                        ? formatTime(worker.activeStartedAt)
                        : formatTime(worker.lastRunAt)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-text-muted">Duration</dt>
                    <dd className="mt-0.5 font-medium text-text">
                      {formatDuration(worker.lastDurationMs)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-text-muted">Last processed / failed</dt>
                    <dd className="mt-0.5 font-medium text-text">
                      {worker.lastCount.toLocaleString()} ok ·{" "}
                      <span className={worker.lastFailed > 0 ? "text-danger-text" : undefined}>
                        {worker.lastFailed.toLocaleString()} failed
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-text-muted">History</dt>
                    <dd className="mt-0.5 font-medium text-text">
                      {worker.totalRuns} run{worker.totalRuns === 1 ? "" : "s"} ·{" "}
                      {worker.totalFailures} failure{worker.totalFailures === 1 ? "" : "s"}
                    </dd>
                  </div>
                </dl>

                {worker.lastError ? (
                  <p className="mt-3 break-words rounded-input border border-danger/30 bg-danger-soft px-3 py-2 text-xs text-danger-text">
                    {worker.lastError}
                  </p>
                ) : null}
              </div>

              <div className="mt-4 flex items-center justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  loading={isRunning}
                  loadingLabel="Running..."
                  disabled={runningTarget !== null}
                  onClick={() => void triggerJob(worker.mode)}
                >
                  <Play size={14} strokeWidth={1.75} aria-hidden />
                  Run worker
                </Button>
              </div>
            </AppCard>
          );
        })}
      </div>

      <AppCard className="p-5">
        <div className="flex flex-col gap-3 min-[768px]:flex-row min-[768px]:items-center min-[768px]:justify-between">
          <div>
            <h2 className="text-[17px] font-semibold text-text">Error Logs</h2>
            <p className="mt-1 text-sm text-text-muted">
              Per-item and worker-level failures captured across recent runs.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="job-error-filter" className="text-xs font-medium text-text-muted">
              Worker:
            </label>
            <select
              id="job-error-filter"
              value={errorFilter}
              onChange={(event) => setErrorFilter(event.target.value)}
              className="h-9 rounded-input border border-border bg-surface px-2.5 text-sm text-text"
            >
              <option value="all">All workers ({snapshot.errorLogs.length})</option>
              {snapshot.workers.map((worker) => (
                <option key={worker.mode} value={worker.mode}>
                  {worker.label} ({snapshot.errorLogs.filter((e) => e.job === worker.mode).length})
                </option>
              ))}
            </select>
          </div>
        </div>

        {filteredErrors.length === 0 ? (
          <div className="mt-4 flex items-center gap-2 rounded-card border border-border bg-surface-muted px-4 py-3 text-sm text-text-muted">
            <CheckCircle2 size={16} className="shrink-0 text-success-text" aria-hidden />
            No domain worker errors recorded for this filter.
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {filteredErrors.map((entry) => (
              <li key={entry.id} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <AlertTriangle size={15} className="shrink-0 text-danger-text" aria-hidden />
                    <code className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-xs text-text">
                      {entry.job}
                    </code>
                    {entry.targetLabel ? (
                      <span className="text-xs font-medium text-text-muted">
                        {entry.targetLabel}
                      </span>
                    ) : null}
                    <Badge variant={entry.severity === "error" ? "danger" : "draft"}>
                      {entry.severity}
                    </Badge>
                  </div>
                  <span className="text-xs text-text-muted">{formatTime(entry.timestamp)}</span>
                </div>
                <p className="mt-1.5 break-words font-mono text-xs text-danger-text">
                  {entry.message}
                </p>
              </li>
            ))}
          </ul>
        )}
      </AppCard>

      <AppCard className="p-5">
        <div className="flex items-center gap-2">
          <Clock size={17} strokeWidth={1.75} className="text-text-muted" aria-hidden />
          <h2 className="text-[17px] font-semibold text-text">Recent Executions</h2>
        </div>
        <p className="mt-1 text-sm text-text-muted">
          Chronological execution log across all domain background workers.
        </p>
        {snapshot.runs.length === 0 ? (
          <p className="mt-3 text-sm text-text-muted">
            No worker runs recorded yet. Trigger a worker above to collect execution telemetry.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {snapshot.runs.slice(0, 20).map((run) => (
              <li key={run.id} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-text">{run.job}</span>
                    <Badge variant={run.status === "ok" ? "live" : "danger"}>
                      {run.status === "ok" ? "OK" : "Failed"}
                    </Badge>
                    <span className="text-xs text-text-muted">
                      {run.count.toLocaleString()} processed · {run.failed.toLocaleString()} failed ·{" "}
                      {formatDuration(run.duration_ms)}
                      {run.details?.provider ? ` · ${run.details.provider}` : ""}
                    </span>
                  </div>
                  <span className="text-xs text-text-muted">{formatTime(run.started_at)}</span>
                </div>
                {run.error ? (
                  <p className="mt-1 break-words text-xs text-danger-text">{run.error}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </AppCard>
    </div>
  );
}
