import { AppPage } from "@/components/app/app-page";
import { AppCard } from "@/components/app/card";
import { InfoBox } from "@/components/app/info-box";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadAdminDomains, loadDomainOps } from "@/lib/admin-domains";
import { readDomainsConfig } from "@/lib/domains/config";
import { createHostnameProvider } from "@/lib/domains/provider-factory";

export const dynamic = "force-dynamic";

const JOB_LABELS: Record<string, string> = {
  verify: "Verify domains",
  poll: "Poll addresses",
  health: "Check live addresses",
  plan: "Enforce plans",
  cleanup: "Cleanup",
  "migrate-pointers": "Migrate pointers",
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  return `${Math.floor(ms / 60_000)} min ${Math.round((ms % 60_000) / 1000)} s`;
}

export default async function AdminOperationsPage() {
  const admin = createAdminClient();
  const [rows, ops] = await Promise.all([
    loadAdminDomains(admin),
    loadDomainOps(admin),
  ]);
  const config = readDomainsConfig();
  const hosts = rows.flatMap((row) => row.hostnames);
  const pending = hosts.filter((host) => ["pending", "preparing", "active"].includes(host.status)).length;
  const attention = rows.filter((row) => ["attention", "stalled", "failed"].includes(row.domain.status)).length;
  const review = rows.filter((row) => row.domain.reviewState === "pending").length;
  const circuitOpen = ops.health?.circuitOpen ?? false;
  const errorRate =
    ops.health && ops.health.totalRequests > 0
      ? (ops.health.totalFailures / ops.health.totalRequests) * 100
      : 0;

  let providerName: string = config.provider;
  let setup: { ok: boolean; problems: string[] } = { ok: false, problems: [] };
  try {
    const provider = createHostnameProvider(config);
    providerName = provider.name;
    setup = await provider.checkSetup();
  } catch {
    setup = { ok: false, problems: ["The provider is not configured."] };
  }

  return (
    <AppPage width="default">
      <PageHeader
        title="Operations"
        description="Domain provider health, pending hostnames and checks."
      />

      <div className="grid grid-cols-1 gap-4 min-[768px]:grid-cols-2 min-[1024px]:grid-cols-4">
        <AppCard className="p-5">
          <p className="text-sm text-text-muted">Hostnames</p>
          <p className="text-stat-number mt-1 text-text">{hosts.length}</p>
          <p className="mt-1 text-sm text-text-muted">
            {config.includedHostnames} included · {config.maximumHostnames.toLocaleString()} maximum
          </p>
        </AppCard>
        <AppCard className="p-5">
          <p className="text-sm text-text-muted">Pending</p>
          <p className="text-stat-number mt-1 text-text">{pending}</p>
          <p className="mt-1 text-sm text-text-muted">of {config.maxPendingHostnames} allowed</p>
        </AppCard>
        <AppCard className="p-5">
          <p className="text-sm text-text-muted">Needs attention</p>
          <p className="text-stat-number mt-1 text-text">{attention}</p>
        </AppCard>
        <AppCard className="p-5">
          <p className="text-sm text-text-muted">Waiting for review</p>
          <p className="text-stat-number mt-1 text-text">{review}</p>
        </AppCard>
      </div>

      <div className="mt-5 grid gap-4 min-[768px]:grid-cols-2">
        <AppCard className="p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[17px] font-semibold text-text">Provider setup</h2>
            <Badge variant={setup.ok ? "live" : "danger"}>{setup.ok ? "Ready" : "Problem"}</Badge>
          </div>
          <p className="mt-1 text-sm text-text-muted">Using {providerName}.</p>
          {setup.problems.length > 0 ? (
            <ul className="mt-3 grid gap-1 text-sm text-danger-text">
              {setup.problems.map((problem) => <li key={problem}>{problem}</li>)}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-text-muted">Everything looks ready.</p>
          )}
        </AppCard>

        <AppCard className="p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[17px] font-semibold text-text">Provider health</h2>
            <Badge variant={circuitOpen ? "danger" : ops.health ? "live" : "neutral"}>
              {circuitOpen ? "Circuit open" : ops.health ? "Connected" : "No data"}
            </Badge>
          </div>
          {ops.health ? (
            <>
              <p className="mt-1 text-sm text-text-muted">
                {ops.health.provider} · {ops.health.totalRequests.toLocaleString()} requests ·{" "}
                {ops.health.totalFailures.toLocaleString()} failed ({errorRate.toFixed(1)}%)
              </p>
              <p className="mt-1 text-xs text-text-muted">
                Counts are from the last job that called the provider.
              </p>
              <dl className="mt-3 grid gap-1 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <dt className="text-text-muted">Consecutive failures</dt>
                  <dd className="text-text">{ops.health.consecutiveFailures} of 5</dd>
                </div>
                <div className="flex flex-wrap justify-between gap-2">
                  <dt className="text-text-muted">Last success</dt>
                  <dd className="text-text">{formatDate(ops.health.lastSuccessAt)}</dd>
                </div>
                <div className="flex flex-wrap justify-between gap-2">
                  <dt className="text-text-muted">Last failure</dt>
                  <dd className="text-text">{formatDate(ops.health.lastFailureAt)}</dd>
                </div>
                <div className="flex flex-wrap justify-between gap-2">
                  <dt className="text-text-muted">Circuit open until</dt>
                  <dd className="text-text">{formatDate(ops.health.circuitOpenUntil)}</dd>
                </div>
                <div className="flex flex-wrap justify-between gap-2">
                  <dt className="text-text-muted">Recorded</dt>
                  <dd className="text-text">{formatDate(ops.health.checkedAt)}</dd>
                </div>
              </dl>
            </>
          ) : (
            <p className="mt-3 text-sm text-text-muted">
              No job has recorded provider health yet. Run a domain job to collect it.
            </p>
          )}
        </AppCard>
      </div>

      {hosts.length >= config.includedHostnames * 0.8 ||
      pending >= config.maxPendingHostnames * 0.8 ? (
        <InfoBox variant="warning" className="mt-5">
          {hosts.length >= config.includedHostnames * 0.8
            ? `${hosts.length} hostnames are close to the included ${config.includedHostnames}. Check Cloudflare pricing before adding more. `
            : ""}
          {pending >= config.maxPendingHostnames * 0.8
            ? `${pending} addresses are waiting, close to the ${config.maxPendingHostnames} limit. New addresses may be refused.`
            : ""}
        </InfoBox>
      ) : null}

      <AppCard className="mt-5 p-5">
        <h2 className="text-[17px] font-semibold text-text">Last job runs</h2>
        <p className="mt-1 text-sm text-text-muted">
          The latest run of each domain job. Every run is recorded with its duration and result.
        </p>
        {ops.runs.length === 0 ? (
          <p className="mt-3 text-sm text-text-muted">No job runs recorded yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {ops.runs.map((run) => (
              <li key={run.id} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-text">
                      {JOB_LABELS[run.job] ?? run.job}
                    </span>
                    <Badge variant={run.status === "ok" ? "live" : "danger"}>
                      {run.status === "ok" ? "OK" : "Failed"}
                    </Badge>
                    <span className="text-sm text-text-muted">
                      {run.count.toLocaleString()} processed · {formatDuration(run.durationMs)}
                    </span>
                  </div>
                  <span className="text-xs text-text-muted">{formatDate(run.startedAt)}</span>
                </div>
                {run.error ? (
                  <p className="mt-1 break-words text-sm text-danger-text">{run.error}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </AppCard>

      <AppCard className="mt-5 p-5">
        <h2 className="text-[17px] font-semibold text-text">Costs</h2>
        <p className="mt-2 text-sm leading-5 text-text-muted">
          About {Math.max(0, hosts.length - config.includedHostnames)} hostnames beyond the included{" "}
          {config.includedHostnames}. Check Cloudflare for current pricing. The hard maximum is{" "}
          {config.maximumHostnames.toLocaleString()} hostnames, including the included{" "}
          {config.includedHostnames}.
        </p>
      </AppCard>

      <InfoBox variant="info" className="mt-5">
        Job runs: <code className="font-mono text-xs">pnpm job:domains-poll</code> checks hostnames,{" "}
        <code className="font-mono text-xs">pnpm job:domains-health</code> checks live addresses,{" "}
        <code className="font-mono text-xs">pnpm job:domains-plan</code> pauses or restores domains after a plan change, and{" "}
        <code className="font-mono text-xs">pnpm job:domains-cleanup</code> removes provider hostnames after the 7-day grace period.
      </InfoBox>
    </AppPage>
  );
}
