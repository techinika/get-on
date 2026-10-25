import { AppPage } from "@/components/app/app-page";
import { AppCard } from "@/components/app/card";
import { InfoBox } from "@/components/app/info-box";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadAdminDomains } from "@/lib/admin-domains";
import { readDomainsConfig } from "@/lib/domains/config";
import { createHostnameProvider } from "@/lib/domains/provider-factory";

export const dynamic = "force-dynamic";

export default async function AdminOperationsPage() {
  const admin = createAdminClient();
  const rows = await loadAdminDomains(admin);
  const config = readDomainsConfig();
  const hosts = rows.flatMap((row) => row.hostnames);
  const pending = hosts.filter((host) => ["pending", "preparing", "active"].includes(host.status)).length;
  const attention = rows.filter((row) => ["attention", "stalled", "failed"].includes(row.domain.status)).length;
  const review = rows.filter((row) => row.domain.reviewState === "pending").length;

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
          <p className="mt-1 text-sm text-text-muted">{config.includedHostnames} included</p>
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
          <h2 className="text-[17px] font-semibold text-text">Costs</h2>
          <p className="mt-2 text-sm leading-5 text-text-muted">
            About {Math.max(0, hosts.length - config.includedHostnames)} hostnames beyond the included{" "}
            {config.includedHostnames}. Check Cloudflare for current pricing. The hard maximum is{" "}
            {config.includedHostnames + 49_900}.
          </p>
        </AppCard>
      </div>

      <InfoBox variant="info" className="mt-5">
        Job runs: <code className="font-mono text-xs">pnpm job:domains-poll</code> checks hostnames,{" "}
        <code className="font-mono text-xs">pnpm job:domains-health</code> checks live addresses, and{" "}
        <code className="font-mono text-xs">pnpm job:domains-plan</code> pauses or restores domains after a plan change, and{" "}
        <code className="font-mono text-xs">pnpm job:domains-cleanup</code> removes provider hostnames after the 7-day grace period.
      </InfoBox>
    </AppPage>
  );
}
