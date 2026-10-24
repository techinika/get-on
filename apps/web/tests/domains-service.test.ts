import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readDomainsConfig } from "@/lib/domains/config";
import type { DnsAnswer, DnsResolver } from "@/lib/domains/dns";
import { DomainError } from "@/lib/domains/errors";
import { FakeHostnameProvider } from "@/lib/domains/fake";
import { DomainService, type DomainPointerStore } from "@/lib/domains/service";
import type { DnsRecord, DnsRecordType } from "@/lib/domains/types";
import type { PublishConfig } from "@/lib/publishing/config";
import type { SitePointer } from "@get-on/site-server";

type Row = Record<string, unknown>;

function iso(offsetMs = 0): string {
  return new Date(Date.UTC(2026, 9, 25, 12, 0, 0) + offsetMs).toISOString();
}

class FakeTable {
  private filters: { column: string; value: unknown; negate: boolean }[] = [];
  private mode: "select" | "update" | "insert" = "select";
  private values: Row = {};

  constructor(
    private readonly db: FakeSupabase,
    private readonly table: string,
  ) {}

  select(columns?: string) {
    void columns;
    this.mode = "select";
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ column, value, negate: false });
    return this;
  }

  neq(column: string, value: unknown) {
    this.filters.push({ column, value, negate: true });
    return this;
  }

  limit(count: number) {
    void count;
    return this;
  }

  update(values: Row) {
    this.mode = "update";
    this.values = values;
    return this;
  }

  insert(values: Row) {
    this.mode = "insert";
    this.values = values;
    return this;
  }

  maybeSingle() {
    return this.run().then((result) => ({
      data: Array.isArray(result.data) ? result.data[0] ?? null : result.data,
      error: result.error,
    }));
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: unknown; error: null }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return this.run().then(onfulfilled, onrejected);
  }

  private matches(row: Row): boolean {
    return this.filters.every((filter) => {
      const equal = row[filter.column] === filter.value;
      return filter.negate ? !equal : equal;
    });
  }

  private async run(): Promise<{ data: unknown; error: null }> {
    const rows = this.db.rows[this.table] ?? [];
    if (this.mode === "insert") {
      rows.push({ ...this.values });
      this.db.rows[this.table] = rows;
      return { data: null, error: null };
    }
    if (this.mode === "update") {
      for (const row of rows) {
        if (this.matches(row)) Object.assign(row, this.values);
      }
      return { data: null, error: null };
    }
    return { data: rows.filter((row) => this.matches(row)), error: null };
  }
}

class FakeSupabase {
  rows: Record<string, Row[]> = {
    domains: [],
    domain_hostnames: [],
    domain_events: [],
    projects: [],
    released_hostnames: [],
  };

  from(table: string) {
    return new FakeTable(this, table);
  }

  async rpc(name: string, args: Row): Promise<{ data: unknown; error: null }> {
    const domains = this.rows.domains!;
    const hosts = this.rows.domain_hostnames!;
    if (name === "start_domain") {
      const id = `dom-${domains.length + 1}`;
      domains.push({
        id,
        team_id: "team-1",
        project_id: args.p_project_id,
        registrable: args.p_registrable,
        display_name: args.p_display,
        role: "primary",
        status: "draft",
        status_reason: null,
        verification_value: "geton-verify=0123456789abcdef0123456789abcdef",
        verification_started_at: iso(),
        verification_expires_at: iso(14 * 86400000),
        verified_at: null,
        reverify_after: null,
        review_state: "none",
        registrar: {},
        dns_provider_hint: null,
        last_checked_at: null,
        created_at: iso(),
        removed_at: null,
      });
      this.rows.domain_events!.push({
        domain_id: id,
        event: "started",
        summary: "Domain setup started",
      });
      return { data: id, error: null };
    }
    if (name === "mark_domain_verified") {
      const domain = domains.find((row) => row.id === args.p_domain_id)!;
      domain.status = "verified";
      domain.verified_at = iso();
      domain.reverify_after = iso(90 * 86400000);
      return { data: null, error: null };
    }
    if (name === "add_hostname") {
      const domain = domains.find((row) => row.id === args.p_domain_id)!;
      const id = `host-${hosts.length + 1}`;
      const label = String(args.p_label);
      const hostname =
        label === "@"
          ? String(domain.registrable)
          : `${label}.${String(domain.registrable)}`;
      hosts.push({
        id,
        domain_id: args.p_domain_id,
        project_id: domain.project_id,
        hostname,
        label,
        role: args.p_role,
        mode: args.p_mode,
        status: "pending",
        status_reason: null,
        provider_id: null,
        provider_status: null,
        ssl_status: null,
        verification_errors: [],
        ownership_txt: null,
        validation_txt: null,
        cname_target: "",
        cname_seen: false,
        cname_checked_at: null,
        waiting_since: iso(),
        next_poll_at: null,
        poll_attempts: 0,
        live_at: null,
        attention_since: null,
        health_failures: 0,
        last_health_at: null,
        created_at: iso(),
        removed_at: null,
      });
      domain.status = "connecting";
      return { data: id, error: null };
    }
    if (name === "set_main_hostname") {
      const host = hosts.find((row) => row.id === args.p_hostname_id)!;
      for (const item of hosts) {
        if (item.domain_id === host.domain_id && item.id !== host.id) {
          item.role = "extra";
        }
      }
      host.role = "main";
      const project = this.rows.projects!.find((row) => row.id === host.project_id);
      if (project) project.primary_host = host.hostname;
      return { data: null, error: null };
    }
    if (name === "begin_domain_removal") {
      const domain = domains.find((row) => row.id === args.p_domain_id)!;
      domain.status = "removing";
      for (const host of hosts) {
        if (host.domain_id === domain.id) host.status = "removing";
      }
      return { data: null, error: null };
    }
    if (name === "finish_domain_removal") {
      const domain = domains.find((row) => row.id === args.p_domain_id)!;
      domain.status = "removed";
      domain.removed_at = iso();
      for (const host of hosts) {
        if (host.domain_id === domain.id) {
          host.status = "removed";
          host.removed_at = iso();
        }
      }
      return { data: null, error: null };
    }
    throw new Error(`unexpected rpc ${name}`);
  }
}

class FakeResolver implements DnsResolver {
  txt: DnsRecord[] = [];
  cname: DnsRecord[] = [];
  ns: DnsRecord[] = [];

  async lookup(_name: string, type: DnsRecordType): Promise<DnsAnswer> {
    if (type === "TXT") return { status: "ok", records: this.txt };
    if (type === "CNAME") return { status: "ok", records: this.cname };
    if (type === "NS") return { status: "ok", records: this.ns };
    return { status: "ok", records: [] };
  }
}

function memoryPointers(initial: SitePointer | null): {
  store: DomainPointerStore;
  site: { pointer: SitePointer | null; hosts: string[]; deleted: string[] };
} {
  const site = {
    pointer: initial,
    hosts: [] as string[],
    deleted: [] as string[],
  };
  return {
    site,
    store: {
      async getPointer(hostname) {
        return hostname === initial?.freeHost ? site.pointer : null;
      },
      async writePointer(_hostname, pointer) {
        site.pointer = pointer;
      },
      async writeHostPointer(hostname) {
        site.hosts.push(hostname);
      },
      async deleteHostPointer(hostname) {
        site.deleted.push(hostname);
      },
    },
  };
}

const publishConfig: PublishConfig = {
  kind: "local",
  rootDomain: "get-on.tech",
  localRootDomain: "localhost",
  localPort: 8787,
  localDir: "/tmp/get-on-tests",
};

const domainsConfig = readDomainsConfig({
  DOMAINS_PROVIDER: "fake",
  CF_SAAS_CNAME_TARGET: "customers.get-on.tech",
  ROOT_DOMAIN: "get-on.tech",
} as unknown as NodeJS.ProcessEnv);

function setup() {
  const db = new FakeSupabase();
  db.rows.projects!.push({
    id: "project-1",
    subdomain: "rose",
    redirect_free_address: true,
    primary_host: null,
  });
  const provider = new FakeHostnameProvider();
  const resolver = new FakeResolver();
  const pointers = memoryPointers({
    siteId: "project-1",
    publishId: "pub-1",
    state: "live",
    builtAt: iso(),
    plan: "basic",
    freeHost: "rose.localhost",
    redirectToPrimary: true,
  });
  const service = new DomainService({
    supabase: db as unknown as SupabaseClient,
    provider,
    resolver,
    config: domainsConfig,
    pointers: pointers.store,
    publishConfig,
    healthCheck: async () => true,
    now: () => new Date(iso()),
  });
  return { db, provider, resolver, pointers, service };
}

describe("domain service", () => {
  it("starts a domain, records the registrar and verifies the TXT value", async () => {
    const { service, resolver, db } = setup();
    resolver.ns = [{ type: "NS", name: "rosebakery.com", value: "ada.ns.cloudflare.com" }];

    const started = await service.startDomain({
      projectId: "project-1",
      domain: "https://www.RoseBakery.com/shop",
    });
    expect(started.registrable).toBe("rosebakery.com");
    expect(started.status).toBe("draft");
    expect(started.dnsProviderHint).toBe("Cloudflare");
    expect(db.rows.domain_events).toHaveLength(1);

    resolver.txt = [
      {
        type: "TXT",
        name: "_geton-verify.rosebakery.com",
        value: started.verificationValue,
      },
    ];
    const verified = await service.verifyDomain(started.id);
    expect(verified.status).toBe("found");
    expect(verified.domain.status).toBe("verified");
  });

  it("holds a brand domain for review before an address can be added", async () => {
    const { service } = setup();
    const started = await service.startDomain({
      projectId: "project-1",
      domain: "google.com",
    });
    expect(started.reviewState).toBe("pending");

    await expect(
      service.addAddress({
        domainId: started.id,
        label: "www",
        role: "main",
        mode: "switch_now",
      }),
    ).rejects.toMatchObject({ code: "DOMAIN_REVIEW_PENDING" });
  });

  it("creates the provider hostname and marks the address live after DNS and health", async () => {
    const { service, resolver, provider, pointers, db } = setup();
    const started = await service.startDomain({
      projectId: "project-1",
      domain: "rosebakery.com",
    });
    resolver.txt = [
      {
        type: "TXT",
        name: "_geton-verify.rosebakery.com",
        value: started.verificationValue,
      },
    ];
    await service.verifyDomain(started.id);

    const host = await service.addAddress({
      domainId: started.id,
      label: "www",
      role: "main",
      mode: "switch_now",
    });
    expect(host.hostname).toBe("www.rosebakery.com");
    expect(host.cnameTarget).toBe("customers.get-on.tech");
    expect(host.status).toBe("pending");

    provider.markDnsReady("www.rosebakery.com");
    resolver.cname = [
      {
        type: "CNAME",
        name: "www.rosebakery.com",
        value: "customers.get-on.tech",
      },
    ];
    const live = await service.refreshAddress(host.id);

    expect(live.status).toBe("live");
    expect(pointers.site.hosts).toContain("www.rosebakery.com");
    expect(pointers.site.pointer?.primaryHost).toBe("www.rosebakery.com");
    expect(pointers.site.pointer?.redirectToPrimary).toBe(true);
    expect(db.rows.projects?.[0]?.primary_host).toBe("www.rosebakery.com");
    expect(db.rows.domains?.[0]?.status).toBe("live");
  });

  it("removes provider hostnames and the KV mapping", async () => {
    const { service, resolver, provider, pointers, db } = setup();
    const started = await service.startDomain({
      projectId: "project-1",
      domain: "rosebakery.com",
    });
    resolver.txt = [
      {
        type: "TXT",
        name: "_geton-verify.rosebakery.com",
        value: started.verificationValue,
      },
    ];
    await service.verifyDomain(started.id);
    const host = await service.addAddress({
      domainId: started.id,
      label: "www",
      role: "main",
      mode: "switch_now",
    });

    await service.removeDomain(started.id);

    expect(pointers.site.deleted).toContain(host.hostname);
    expect(db.rows.domains?.[0]?.status).toBe("removed");
    await expect(provider.getHostname(host.providerId!)).resolves.toBeNull();
  });

  it("rejects a domain that the platform keeps for itself", async () => {
    const { service } = setup();
    await expect(
      service.startDomain({ projectId: "project-1", domain: "geton.tech" }),
    ).rejects.toBeInstanceOf(DomainError);
  });
});
