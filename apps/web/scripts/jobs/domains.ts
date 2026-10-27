import { readdir } from "node:fs/promises";
import path from "node:path";
import { createAdminClient } from "../../lib/supabase/admin";
import { readDomainsConfig } from "../../lib/domains/config";
import { DomainService } from "../../lib/domains/service";
import { createHostnameProvider } from "../../lib/domains/provider-factory";
import {
  readPublishConfig,
  requireCloudflareConfig,
} from "../../lib/publishing/config";
import { createPublishStore } from "../../lib/publishing/store";
import { parseHost } from "@get-on/site-server";
import type { ProviderHealth } from "../../lib/domains/types";

type Mode =
  | "verify"
  | "poll"
  | "health"
  | "plan"
  | "migrate-pointers"
  | "cleanup"
  | "all";

const LIMIT = 50;

type JobOutcome = {
  count: number;
  failed?: number;
  health?: ProviderHealth;
  provider?: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

function service() {
  const admin = createAdminClient();
  const config = readDomainsConfig();
  const provider = createHostnameProvider(config);
  return {
    admin,
    provider,
    service: new DomainService({
      supabase: admin,
      provider,
      config,
      publishConfig: readPublishConfig(),
    }),
  };
}

async function verifyDomains(): Promise<JobOutcome> {
  const { admin, provider, service: domains } = service();
  const cutoff = new Date(Date.now() - 60_000).toISOString();
  const { data } = await admin
    .from("domains")
    .select("id")
    .in("status", ["draft", "awaiting_txt"])
    .gt("verification_expires_at", nowIso())
    .or(`last_checked_at.is.null,last_checked_at.lt.${cutoff}`)
    .limit(LIMIT);

  let checked = 0;
  let failed = 0;
  for (const row of data ?? []) {
    try {
      await domains.verifyDomain(String(row.id));
      checked += 1;
    } catch (error) {
      failed += 1;
      console.error(`[domains] verify ${row.id} failed`, error);
    }
  }
  return { count: checked, failed, health: provider.health(), provider: provider.name };
}

async function pollHostnames(): Promise<JobOutcome> {
  const { admin, provider, service: domains } = service();
  const { data } = await admin
    .from("domain_hostnames")
    .select("id")
    .in("status", [
      "pending",
      "preparing",
      "ready_to_switch",
      "active",
      "error",
      "moved",
    ])
    .or(`next_poll_at.is.null,next_poll_at.lte.${nowIso()}`)
    .limit(LIMIT);

  let checked = 0;
  let failed = 0;
  for (const row of data ?? []) {
    try {
      await domains.refreshAddress(String(row.id));
      checked += 1;
    } catch (error) {
      failed += 1;
      console.error(`[domains] poll ${row.id} failed`, error);
    }
  }
  return { count: checked, failed, health: provider.health(), provider: provider.name };
}

async function checkHealth(): Promise<JobOutcome> {
  const { admin, provider, service: domains } = service();
  const cutoff = new Date(Date.now() - 10 * 60_000).toISOString();
  const { data } = await admin
    .from("domain_hostnames")
    .select("id")
    .eq("status", "live")
    .or(`last_health_at.is.null,last_health_at.lt.${cutoff}`)
    .limit(100);

  let checked = 0;
  let failed = 0;
  for (const row of data ?? []) {
    try {
      await domains.refreshAddress(String(row.id));
      checked += 1;
    } catch (error) {
      failed += 1;
      console.error(`[domains] health ${row.id} failed`, error);
    }
  }
  return { count: checked, failed, health: provider.health(), provider: provider.name };
}

async function enforcePlans(): Promise<JobOutcome> {
  const { admin, provider, service: domains } = service();
  const { data } = await admin.from("teams").select("id");
  let changed = 0;
  let failed = 0;
  for (const row of data ?? []) {
    try {
      await domains.enforcePlan(String(row.id));
      changed += 1;
    } catch (error) {
      failed += 1;
      console.error(`[domains] plan ${row.id} failed`, error);
    }
  }
  return { count: changed, failed, health: provider.health(), provider: provider.name };
}

async function expireDrafts(): Promise<number> {
  const { service: domains } = service();
  return domains.expireUnverifiedDomains();
}

async function cleanupDomains(): Promise<JobOutcome> {
  const expired = await expireDrafts();
  const released = await retryReleasedHostnames();
  return {
    count: expired + released.count,
    failed: released.failed,
    health: released.health,
    provider: released.provider,
  };
}

async function retryReleasedHostnames(): Promise<JobOutcome> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("released_hostnames")
    .select("provider_id, hostname")
    .lte("delete_after", nowIso())
    .limit(LIMIT);
  if (!data || data.length === 0) {
    const provider = createHostnameProvider(readDomainsConfig());
    return { count: 0, health: provider.health(), provider: provider.name };
  }

  const provider = createHostnameProvider(readDomainsConfig());
  let deleted = 0;
  let failed = 0;
  for (const row of data) {
    try {
      await provider.deleteHostname(String(row.provider_id));
      await admin
        .from("released_hostnames")
        .delete()
        .eq("provider_id", String(row.provider_id));
      deleted += 1;
    } catch (error) {
      failed += 1;
      console.error(`[domains] cleanup ${row.hostname} failed`, error);
    }
  }
  return { count: deleted, failed, health: provider.health(), provider: provider.name };
}

async function migratePointers(): Promise<JobOutcome> {
  const config = readPublishConfig();
  const store = createPublishStore(config);
  const hostnames: string[] = [];

  if (config.kind === "cloudflare") {
    const { accountId, apiToken, kvNamespaceId } =
      requireCloudflareConfig(config);
    let cursor: string | null = null;
    do {
      const url = new URL(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${kvNamespaceId}/keys`,
      );
      url.searchParams.set("prefix", "host:");
      url.searchParams.set("limit", "1000");
      if (cursor) url.searchParams.set("cursor", cursor);
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${apiToken}` },
      });
      if (!response.ok) throw new Error("POINTER_LIST_FAILED");
      const payload = (await response.json()) as {
        result?: { name?: string }[];
        result_info?: { cursor?: string };
      };
      for (const item of payload.result ?? []) {
        if (item.name?.startsWith("host:")) {
          hostnames.push(item.name.slice("host:".length));
        }
      }
      cursor = payload.result_info?.cursor || null;
    } while (cursor);
  } else {
    const dir = path.join(config.localDir, "pointers");
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(".json")) {
        hostnames.push(entry.name.slice(0, -".json".length));
      }
    }
  }

  const rootDomain =
    config.kind === "local" ? config.localRootDomain : config.rootDomain;

  let migrated = 0;
  let failed = 0;
  for (const hostname of hostnames) {
    try {
      const pointer = await store.getPointer(hostname);
      if (!pointer) continue;
      const parsed = parseHost(hostname, rootDomain);
      const isFreeHost = parsed.ok && !parsed.custom;
      if (isFreeHost) {
        // Older Workers read the free host directly, so keep it self-contained.
        await store.writePointer(hostname, pointer);
      } else {
        // Custom addresses must point at the site pointer, otherwise a later
        // publish would update `site:` while this host kept an old publishId.
        await store.writeSitePointer(pointer);
        await store.writeHostPointer(hostname, pointer.siteId, {
          planLapsed: pointer.planLapsed,
          supportPaused: pointer.supportPaused,
        });
      }
      migrated += 1;
    } catch (error) {
      failed += 1;
      console.error(`[domains] pointer ${hostname} failed`, error);
    }
  }
  return { count: migrated, failed };
}

async function recordRun(
  job: string,
  startedAt: string,
  started: number,
  status: "ok" | "error",
  outcome: JobOutcome | null,
  error: unknown,
): Promise<void> {
  try {
    const admin = createAdminClient();
    const finished = Date.now();
    const failed = outcome?.failed ?? 0;
    await admin.from("domain_job_runs").insert({
      job,
      status: failed > 0 ? "error" : status,
      started_at: startedAt,
      finished_at: new Date(finished).toISOString(),
      duration_ms: finished - started,
      count: outcome?.count ?? 0,
      error:
        error instanceof Error
          ? error.message.slice(0, 500)
          : error
            ? String(error).slice(0, 500)
            : failed > 0
              ? `${failed} item(s) failed`
              : null,
      details: {
        provider: outcome?.provider ?? null,
        failed,
        health: outcome?.health ?? null,
      },
    });
    if (
      outcome?.health &&
      outcome.provider &&
      (outcome.provider === "fake" || outcome.health.totalRequests > 0)
    ) {
      await admin.from("domain_provider_health").upsert({
        id: "default",
        provider: outcome.provider,
        total_requests: outcome.health.totalRequests,
        total_failures: outcome.health.totalFailures,
        consecutive_failures: outcome.health.consecutiveFailures,
        circuit_open_until: outcome.health.circuitOpenUntil,
        last_failure_at: outcome.health.lastFailureAt,
        last_success_at: outcome.health.lastSuccessAt,
        checked_at: new Date().toISOString(),
      });
    }
  } catch (writeError) {
    console.error("[domains] could not record job run", writeError);
  }
}

async function runJob(
  job: string,
  work: () => Promise<JobOutcome>,
): Promise<JobOutcome> {
  const started = Date.now();
  const startedAt = new Date(started).toISOString();
  try {
    const outcome = await work();
    await recordRun(job, startedAt, started, "ok", outcome, null);
    return outcome;
  } catch (error) {
    await recordRun(job, startedAt, started, "error", null, error);
    throw error;
  }
}

async function main() {
  const mode = (process.argv[2] ?? "all") as Mode;
  if (!["verify", "poll", "health", "plan", "migrate-pointers", "cleanup", "all"].includes(mode)) {
    console.error(`Unknown domain job: ${mode}`);
    process.exit(1);
  }

  const runners: Record<Exclude<Mode, "all">, { run: () => Promise<JobOutcome>; message: (count: number) => string }> = {
    verify: { run: verifyDomains, message: (count) => `verified ${count} domain(s)` },
    poll: { run: pollHostnames, message: (count) => `polled ${count} address(es)` },
    health: { run: checkHealth, message: (count) => `checked ${count} live address(es)` },
    plan: { run: enforcePlans, message: (count) => `enforced ${count} team plan(s)` },
    cleanup: { run: cleanupDomains, message: (count) => `expired or cleaned up ${count} item(s)` },
    "migrate-pointers": { run: migratePointers, message: (count) => `migrated ${count} pointer(s)` },
  };

  const jobs: Exclude<Mode, "all">[] =
    mode === "all"
      ? ["verify", "poll", "health", "plan", "cleanup"]
      : [mode];

  let failed = 0;
  for (const job of jobs) {
    const runner = runners[job];
    const outcome = await runJob(job, runner.run);
    failed += outcome.failed ?? 0;
    console.log(`[domains] ${runner.message(outcome.count)}`);
  }
  if (failed > 0) process.exitCode = 1;
}
void main().catch((error) => {
  console.error("[domains] job failed", error);
  process.exit(1);
});
