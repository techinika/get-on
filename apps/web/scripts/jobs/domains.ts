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

type Mode =
  | "verify"
  | "poll"
  | "health"
  | "plan"
  | "migrate-pointers"
  | "cleanup"
  | "all";

const LIMIT = 50;

function nowIso(): string {
  return new Date().toISOString();
}

function service() {
  const admin = createAdminClient();
  const config = readDomainsConfig();
  return {
    admin,
    service: new DomainService({
      supabase: admin,
      provider: createHostnameProvider(config),
      config,
      publishConfig: readPublishConfig(),
    }),
  };
}

async function verifyDomains(): Promise<number> {
  const { admin, service: domains } = service();
  const cutoff = new Date(Date.now() - 60_000).toISOString();
  const { data } = await admin
    .from("domains")
    .select("id")
    .in("status", ["draft", "awaiting_txt"])
    .gt("verification_expires_at", nowIso())
    .or(`last_checked_at.is.null,last_checked_at.lt.${cutoff}`)
    .limit(LIMIT);

  let checked = 0;
  for (const row of data ?? []) {
    try {
      await domains.verifyDomain(String(row.id));
      checked += 1;
    } catch (error) {
      console.error(`[domains] verify ${row.id} failed`, error);
    }
  }
  return checked;
}

async function pollHostnames(): Promise<number> {
  const { admin, service: domains } = service();
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
  for (const row of data ?? []) {
    try {
      await domains.refreshAddress(String(row.id));
      checked += 1;
    } catch (error) {
      console.error(`[domains] poll ${row.id} failed`, error);
    }
  }
  return checked;
}

async function checkHealth(): Promise<number> {
  const { admin, service: domains } = service();
  const cutoff = new Date(Date.now() - 10 * 60_000).toISOString();
  const { data } = await admin
    .from("domain_hostnames")
    .select("id")
    .eq("status", "live")
    .or(`last_health_at.is.null,last_health_at.lt.${cutoff}`)
    .limit(100);

  let checked = 0;
  for (const row of data ?? []) {
    try {
      await domains.refreshAddress(String(row.id));
      checked += 1;
    } catch (error) {
      console.error(`[domains] health ${row.id} failed`, error);
    }
  }
  return checked;
}

async function enforcePlans(): Promise<number> {
  const { admin, service: domains } = service();
  const { data } = await admin.from("teams").select("id");
  let changed = 0;
  for (const row of data ?? []) {
    try {
      await domains.enforcePlan(String(row.id));
      changed += 1;
    } catch (error) {
      console.error(`[domains] plan ${row.id} failed`, error);
    }
  }
  return changed;
}

async function retryReleasedHostnames(): Promise<number> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("released_hostnames")
    .select("provider_id, hostname")
    .lte("delete_after", nowIso())
    .limit(LIMIT);
  if (!data || data.length === 0) return 0;

  const provider = createHostnameProvider(readDomainsConfig());
  let deleted = 0;
  for (const row of data) {
    try {
      await provider.deleteHostname(String(row.provider_id));
      await admin
        .from("released_hostnames")
        .delete()
        .eq("provider_id", String(row.provider_id));
      deleted += 1;
    } catch (error) {
      console.error(`[domains] cleanup ${row.hostname} failed`, error);
    }
  }
  return deleted;
}

async function migratePointers(): Promise<number> {
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

  let migrated = 0;
  for (const hostname of hostnames) {
    try {
      const pointer = await store.getPointer(hostname);
      if (!pointer) continue;
      await store.writePointer(hostname, pointer);
      migrated += 1;
    } catch (error) {
      console.error(`[domains] pointer ${hostname} failed`, error);
    }
  }
  return migrated;
}

async function main() {
  const mode = (process.argv[2] ?? "all") as Mode;
  if (!["verify", "poll", "health", "plan", "migrate-pointers", "cleanup", "all"].includes(mode)) {
    console.error(`Unknown domain job: ${mode}`);
    process.exit(1);
  }

  if (mode === "verify" || mode === "all") {
    console.log(`[domains] verified ${await verifyDomains()} domain(s)`);
  }
  if (mode === "poll" || mode === "all") {
    console.log(`[domains] polled ${await pollHostnames()} address(es)`);
  }
  if (mode === "health" || mode === "all") {
    console.log(`[domains] checked ${await checkHealth()} live address(es)`);
  }
  if (mode === "plan" || mode === "all") {
    console.log(`[domains] enforced ${await enforcePlans()} team plan(s)`);
  }
  if (mode === "cleanup" || mode === "all") {
    console.log(`[domains] cleaned up ${await retryReleasedHostnames()} hostname(s)`);
  }
  if (mode === "migrate-pointers") {
    console.log(`[domains] migrated ${await migratePointers()} pointer(s)`);
  }
}

void main().catch((error) => {
  console.error("[domains] job failed", error);
  process.exit(1);
});
