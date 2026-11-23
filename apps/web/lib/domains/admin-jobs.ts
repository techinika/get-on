import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminSupabaseConfigured } from "@/lib/supabase/fallback";
import { readDomainsConfig } from "@/lib/domains/config";
import { DomainService } from "@/lib/domains/service";
import { createHostnameProvider } from "@/lib/domains/provider-factory";
import { readPublishConfig, requireCloudflareConfig } from "@/lib/publishing/config";
import { createPublishStore } from "@/lib/publishing/store";
import { parseHost } from "@get-on/site-server";
import {
  ALL_JOB_MODES,
  JOB_LABELS,
  appendJobErrorLog,
  finishTrackedJob,
  recordTrackedRun,
  startTrackedJob,
  type JobMode,
  type ProviderHealthSnapshot,
} from "./ops-store";

const LIMIT = 50;

export { ALL_JOB_MODES, JOB_LABELS };
export type { JobMode };

export type JobRunResult = {
  ok: boolean;
  mode: JobMode;
  count: number;
  failed: number;
  message: string;
  error?: string;
};

type ProviderHealth = ProviderHealthSnapshot;

function nowIso(): string {
  return new Date().toISOString();
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

function buildService() {
  const admin = createAdminClient();
  const config = readDomainsConfig();
  const provider = createHostnameProvider(config);
  const service = new DomainService({
    supabase: admin,
    provider,
    config,
    publishConfig: readPublishConfig(),
  });
  return { admin, provider, service };
}

async function recordRun(
  admin: ReturnType<typeof createAdminClient>,
  job: string,
  started: number,
  status: "ok" | "error",
  count: number,
  failed: number,
  error: unknown,
  providerName: string | null,
  health: ProviderHealth | null,
): Promise<void> {
  const finished = Date.now();
  const startedAt = new Date(started).toISOString();
  const finishedAt = new Date(finished).toISOString();
  const formattedError =
    error instanceof Error
      ? error.message.slice(0, 500)
      : error
        ? String(error).slice(0, 500)
        : failed > 0
          ? `${failed} item(s) failed`
          : null;

  recordTrackedRun({
    job,
    status,
    startedAt,
    finishedAt,
    durationMs: finished - started,
    count,
    failed,
    error: formattedError,
    providerName,
    health,
  });

  if (!isAdminSupabaseConfigured()) {
    return;
  }

  try {
    await admin.from("domain_job_runs").insert({
      job,
      status,
      started_at: startedAt,
      finished_at: finishedAt,
      duration_ms: finished - started,
      count,
      error: formattedError,
      details: { provider: providerName ?? null, failed, health: health ?? null },
    });
    if (health && providerName && providerName !== "fake") {
      await admin.from("domain_provider_health").upsert({
        id: "default",
        provider: providerName,
        total_requests: health.totalRequests ?? 0,
        total_failures: health.totalFailures ?? 0,
        consecutive_failures: health.consecutiveFailures ?? 0,
        circuit_open_until: health.circuitOpenUntil ?? null,
        last_failure_at: health.lastFailureAt ?? null,
        last_success_at: health.lastSuccessAt ?? null,
        checked_at: finishedAt,
      });
    }
  } catch (writeError) {
    console.error("[operations] could not record job run", writeError);
  }
}

export async function runDomainJob(mode: JobMode): Promise<JobRunResult> {
  const started = Date.now();
  const runToken = startTrackedJob(mode);
  const { admin, provider, service } = buildService();
  const providerName = provider.name;

  let count = 0;
  let failed = 0;
  let message = "";
  let error: unknown = null;
  let health: ProviderHealth | null = null;

  try {
    switch (mode) {
      case "verify": {
        const cutoff = new Date(Date.now() - 60_000).toISOString();
        const { data } = await admin
          .from("domains")
          .select("id")
          .in("status", ["draft", "awaiting_txt"])
          .gt("verification_expires_at", nowIso())
          .or(`last_checked_at.is.null,last_checked_at.lt.${cutoff}`)
          .limit(LIMIT);
        for (const row of data ?? []) {
          try {
            await service.verifyDomain(String(row.id));
            count += 1;
          } catch (err) {
            failed += 1;
            appendJobErrorLog({
              job: mode,
              targetId: String(row.id),
              targetLabel: `domain:${row.id}`,
              message: errorMessage(err),
            });
            console.error(`[operations] verify ${row.id} failed`, err);
          }
        }
        message = `verified ${count} domain(s)`;
        break;
      }
      case "poll": {
        const { data } = await admin
          .from("domain_hostnames")
          .select("id")
          .in("status", ["pending", "preparing", "ready_to_switch", "active", "error", "moved"])
          .or(`next_poll_at.is.null,next_poll_at.lte.${nowIso()}`)
          .limit(LIMIT);
        for (const row of data ?? []) {
          try {
            await service.refreshAddress(String(row.id));
            count += 1;
          } catch (err) {
            failed += 1;
            appendJobErrorLog({
              job: mode,
              targetId: String(row.id),
              targetLabel: `hostname:${row.id}`,
              message: errorMessage(err),
            });
            console.error(`[operations] poll ${row.id} failed`, err);
          }
        }
        message = `polled ${count} address(es)`;
        break;
      }
      case "health": {
        const cutoff = new Date(Date.now() - 10 * 60_000).toISOString();
        const { data } = await admin
          .from("domain_hostnames")
          .select("id")
          .eq("status", "live")
          .or(`last_health_at.is.null,last_health_at.lt.${cutoff}`)
          .limit(100);
        for (const row of data ?? []) {
          try {
            await service.refreshAddress(String(row.id));
            count += 1;
          } catch (err) {
            failed += 1;
            appendJobErrorLog({
              job: mode,
              targetId: String(row.id),
              targetLabel: `hostname:${row.id}`,
              message: errorMessage(err),
            });
            console.error(`[operations] health ${row.id} failed`, err);
          }
        }
        message = `checked ${count} live address(es)`;
        break;
      }
      case "plan": {
        const { data } = await admin.from("teams").select("id");
        for (const row of data ?? []) {
          try {
            await service.enforcePlan(String(row.id));
            count += 1;
          } catch (err) {
            failed += 1;
            appendJobErrorLog({
              job: mode,
              targetId: String(row.id),
              targetLabel: `team:${row.id}`,
              message: errorMessage(err),
            });
            console.error(`[operations] plan ${row.id} failed`, err);
          }
        }
        message = `enforced ${count} team plan(s)`;
        break;
      }
      case "cleanup": {
        const expired = await service.expireUnverifiedDomains();
        count += expired;
        const cutoff = new Date().toISOString();
        const { data } = await admin
          .from("released_hostnames")
          .select("provider_id, hostname")
          .lte("delete_after", cutoff)
          .limit(LIMIT);
        const hostnames = data ?? [];
        for (const row of hostnames) {
          try {
            await provider.deleteHostname(String(row.provider_id));
            await admin.from("released_hostnames").delete().eq("provider_id", String(row.provider_id));
            count += 1;
          } catch (err) {
            failed += 1;
            appendJobErrorLog({
              job: mode,
              targetId: String(row.provider_id),
              targetLabel: String(row.hostname ?? row.provider_id),
              message: errorMessage(err),
            });
            console.error(`[operations] cleanup ${row.hostname} failed`, err);
          }
        }
        message = `expired or cleaned up ${count} item(s)`;
        break;
      }
      case "migrate-pointers": {
        const config = readPublishConfig();
        const store = createPublishStore(config);
        const hostnames: string[] = [];
        if (config.kind === "cloudflare") {
          const { accountId, apiToken, kvNamespaceId } = requireCloudflareConfig(config);
          let cursor: string | null = null;
          do {
            const url = new URL(
              `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${kvNamespaceId}/keys`,
            );
            url.searchParams.set("prefix", "host:");
            url.searchParams.set("limit", "1000");
            if (cursor) url.searchParams.set("cursor", cursor);
            const response = await fetch(url, {
              headers: { Authorization: ["Bearer", apiToken].join(" ") },
            });
            if (!response.ok) throw new Error("POINTER_LIST_FAILED");
            const payload = (await response.json()) as {
              result?: { name?: string }[];
              result_info?: { cursor?: string };
            };
            for (const item of payload.result ?? []) {
              if (item.name?.startsWith("host:")) hostnames.push(item.name.slice("host:".length));
            }
            cursor = payload.result_info?.cursor || null;
          } while (cursor);
        } else {
          const fs = await import("node:fs/promises");
          const path = await import("node:path");
          const dir = path.join(config.localDir, "pointers");
          const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
          for (const entry of entries) {
            if (entry.isFile() && entry.name.endsWith(".json")) {
              hostnames.push(entry.name.slice(0, -".json".length));
            }
          }
        }
        const rootDomain =
          config.kind === "local" ? config.localRootDomain : config.rootDomain;
        for (const hostname of hostnames) {
          try {
            const pointer = await store.getPointer(hostname);
            if (!pointer) continue;
            const parsed = parseHost(hostname, rootDomain);
            const isFreeHost = parsed.ok && !parsed.custom;
            if (isFreeHost) {
              await store.writePointer(hostname, pointer);
            } else {
              await store.writeSitePointer(pointer);
              await store.writeHostPointer(hostname, pointer.siteId, {
                planLapsed: pointer.planLapsed,
                supportPaused: pointer.supportPaused,
              });
            }
            count += 1;
          } catch (err) {
            failed += 1;
            appendJobErrorLog({
              job: mode,
              targetId: hostname,
              targetLabel: hostname,
              message: errorMessage(err),
            });
            console.error(`[operations] pointer ${hostname} failed`, err);
          }
        }
        message = `migrated ${count} pointer(s)`;
        break;
      }
    }
  } catch (err) {
    error = err;
    failed += 1;
    appendJobErrorLog({
      job: mode,
      targetId: null,
      targetLabel: "Worker execution",
      message: errorMessage(err),
    });
  } finally {
    finishTrackedJob(runToken);
  }

  try {
    health = provider.health();
  } catch {
    // health is optional
  }

  const status: "ok" | "error" = error || failed > 0 ? "error" : "ok";
  await recordRun(admin, mode, started, status, count, failed, error, providerName, health);

  return {
    ok: status === "ok",
    mode,
    count,
    failed,
    message,
    ...(error ? { error: errorMessage(error) } : {}),
  };
}
