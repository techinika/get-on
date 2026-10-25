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
  private filters: {
    column: string;
    value: unknown;
    negate: boolean;
    list?: boolean;
    lessThan?: boolean;
  }[] = [];
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

  in(column: string, values: unknown[]) {
    this.filters.push({ column, value: values, negate: false, list: true });
    return this;
  }

  lt(column: string, value: unknown) {
    this.filters.push({ column, value, negate: false, lessThan: true });
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

  upsert(values: Row) {
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
      if (filter.list) {
        const equal = (filter.value as unknown[]).includes(row[filter.column]);
        return filter.negate ? !equal : equal;
      }
      if (filter.lessThan) {
        return String(row[filter.column] ?? "") < String(filter.value);
      }
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
  unpublished = true;
  rows: Record<string, Row[]> = {
    domains: [],
    domain_hostnames: [],
    domain_events: [],
    projects: [],
    project_settings: [],
    released_hostnames: [],
  };

  from(table: string) {
    return new FakeTable(this, table);
  }

  async rpc(
    name: string,
    args: Row,
  ): Promise<{ data: unknown; error: { message: string } | null }> {
    const domains = this.rows.domains!;
    const hosts = this.rows.domain_hostnames!;
    if (name === "start_domain") {
      const existing = domains.find(
        (row) =>
          row.team_id === "team-1" &&
          row.registrable === args.p_registrable &&
          !["removed", "failed"].includes(String(row.status)),
      );
      if (existing) {
        if (existing.project_id && existing.project_id !== args.p_project_id) {
          return { data: null, error: { message: "DOMAIN_ALREADY_CONNECTED" } };
        }
        if (!existing.project_id) {
          existing.project_id = args.p_project_id;
          if (existing.status === "unassigned") existing.status = "verified";
        }
        return { data: existing.id, error: null };
      }
      const id = `dom-${domains.length + 1}`;
      domains.push({
        id,
        team_id: "team-1",
        project_id: args.p_project_id,
        registrable: args.p_registrable,
        display_name: args.p_display,
        created_by: "user-1",
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
      const pending = hosts.filter(
        (row) => row.status !== "live" && row.status !== "removed",
      ).length;
      if (pending >= Number(args.p_max_pending)) {
        return { data: null, error: { message: "HOSTNAME_LIMIT" } };
      }
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
    if (name === "project_has_unpublished_changes") {
      return { data: this.unpublished, error: null };
    }
    if (name === "enforce_domain_plan") {
      for (const domain of domains) {
        if (domain.team_id === args.p_team_id && domain.project_id) {
          domain.status = "plan_lapsed";
          domain.status_reason = "plan";
        }
      }
      return { data: null, error: null };
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
    if (name === "reassign_domain") {
      const domain = domains.find((row) => row.id === args.p_domain_id)!;
      domain.project_id = args.p_project_id;
      domain.status = "connecting";
      for (const host of hosts) {
        if (host.domain_id === domain.id) host.project_id = args.p_project_id;
      }
      return { data: null, error: null };
    }
    if (name === "detach_domain") {
      const domain = domains.find((row) => row.id === args.p_domain_id)!;
      domain.project_id = null;
      domain.status = "unassigned";
      for (const host of hosts) {
        if (host.domain_id === domain.id) host.project_id = null;
      }
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
  failCname = false;

  async lookup(_name: string, type: DnsRecordType): Promise<DnsAnswer> {
    if (type === "TXT") return { status: "ok", records: this.txt };
    if (type === "CNAME") {
      if (this.failCname) throw new Error("DNS unavailable");
      return { status: "ok", records: this.cname };
    }
    if (type === "NS") return { status: "ok", records: this.ns };
    return { status: "ok", records: [] };
  }
}

function memoryPointers(initial: SitePointer | null): {
  store: DomainPointerStore;
  site: {
    pointer: SitePointer | null;
    hosts: string[];
    planLapsed: Record<string, boolean>;
    supportPaused: Record<string, boolean>;
    deleted: string[];
  };
} {
  const site = {
    pointer: initial,
    hosts: [] as string[],
    planLapsed: {} as Record<string, boolean>,
    supportPaused: {} as Record<string, boolean>,
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
      async writeHostPointer(hostname, _siteId, options) {
        site.hosts.push(hostname);
        site.planLapsed[hostname] = options?.planLapsed === true;
        site.supportPaused[hostname] = options?.supportPaused === true;
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

function setup(
  config = domainsConfig,
  publish?: ConstructorParameters<typeof DomainService>[0]["publish"],
) {
  const db = new FakeSupabase();
  db.rows.projects!.push({
    id: "project-1",
    name: "Rose Bakery",
    team_id: "team-1",
    subdomain: "rose",
    redirect_free_address: true,
    primary_host: null,
  });
  db.rows.project_settings!.push({
    project_id: "project-1",
    auto_publish_on_domain: false,
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
    config,
    pointers: pointers.store,
    publishConfig,
    healthCheck: async () => true,
    ...(publish ? { publish } : {}),
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

  it("refuses to start a domain that another website already uses", async () => {
    const { service, db } = setup();
    db.rows.projects!.push({
      id: "project-2",
      subdomain: "other",
      redirect_free_address: true,
      primary_host: null,
    });
    await service.startDomain({ projectId: "project-1", domain: "rosebakery.com" });

    await expect(
      service.startDomain({ projectId: "project-2", domain: "rosebakery.com" }),
    ).rejects.toMatchObject({ code: "DOMAIN_ALREADY_CONNECTED" });
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

  it("updates the website for a new main address when there are no draft changes", async () => {
    const calls: unknown[] = [];
    const { service, resolver, provider, db } = setup(domainsConfig, async (ctx) => {
      calls.push(ctx);
      return {
        publishId: "pub-2",
        status: "live",
        url: "https://www.rosebakery.com",
        warnings: [],
        pagesCount: 1,
        sizeBytes: 10,
      };
    });
    db.unpublished = false;
    db.rows.project_settings![0]!.auto_publish_on_domain = true;
    db.rows.teams = [{ id: "team-1", plan_id: "basic" }];

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
    provider.markDnsReady(host.hostname);
    resolver.cname = [
      {
        type: "CNAME",
        name: host.hostname,
        value: "customers.get-on.tech",
      },
    ];

    await service.refreshAddress(host.id);

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      force: true,
      user: { id: "user-1" },
      team: { teamId: "team-1", planId: "basic" },
      project: { id: "project-1", subdomain: "rose" },
    });
    expect(db.rows.domain_events).toContainEqual(
      expect.objectContaining({ event: "auto_published" }),
    );
  });

  it("does not update the website when the owner has draft changes", async () => {
    const calls: unknown[] = [];
    const { service, resolver, provider, db } = setup(domainsConfig, async (ctx) => {
      calls.push(ctx);
      return {
        publishId: "pub-2",
        status: "live",
        url: "",
        warnings: [],
        pagesCount: 1,
        sizeBytes: 10,
      };
    });
    db.unpublished = true;
    db.rows.project_settings![0]!.auto_publish_on_domain = true;
    db.rows.teams = [{ id: "team-1", plan_id: "basic" }];

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
    provider.markDnsReady(host.hostname);
    resolver.cname = [
      {
        type: "CNAME",
        name: host.hostname,
        value: "customers.get-on.tech",
      },
    ];

    await service.refreshAddress(host.id);

    expect(calls).toHaveLength(0);
  });

  it("stops adding hostnames when the provider pending cap is reached", async () => {
    const { service, db, resolver } = setup({ ...domainsConfig, maxPendingHostnames: 1 });
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
    db.rows.domain_hostnames!.push({
      id: "host-existing",
      domain_id: started.id,
      project_id: "project-1",
      hostname: "shop.rosebakery.com",
      label: "shop",
      role: "extra",
      status: "pending",
    });

    await expect(
      service.addAddress({
        domainId: started.id,
        label: "www",
        role: "main",
        mode: "switch_now",
      }),
    ).rejects.toMatchObject({ code: "HOSTNAME_LIMIT" });
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

  it("does not go live before the provider is ready", async () => {
    const { service, resolver } = setup();
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
    resolver.cname = [
      {
        type: "CNAME",
        name: "www.rosebakery.com",
        value: "customers.get-on.tech",
      },
    ];

    const checked = await service.refreshAddress(host.id);

    expect(checked.status).not.toBe("live");
  });

  it("keeps the domain live when an extra address is still pending", async () => {
    const { service, resolver, provider, pointers } = setup();
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
    const main = await service.addAddress({
      domainId: started.id,
      label: "www",
      role: "main",
      mode: "switch_now",
    });
    provider.markDnsReady(main.hostname);
    resolver.cname = [
      {
        type: "CNAME",
        name: main.hostname,
        value: "customers.get-on.tech",
      },
    ];
    await service.refreshAddress(main.id);

    const extra = await service.addAddress({
      domainId: started.id,
      label: "shop",
      role: "extra",
      mode: "switch_now",
    });
    const checked = await service.refreshAddress(extra.id);

    expect(checked.status).not.toBe("live");
    expect(pointers.site.pointer?.primaryHost).toBe(main.hostname);
    expect((await service.checkDomain(started.id)).domain.status).toBe("live");
  });

  it("keeps a live address live when the DNS lookup fails", async () => {
    const { service, resolver, provider, pointers } = setup();
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
    provider.markDnsReady(host.hostname);
    resolver.cname = [
      {
        type: "CNAME",
        name: host.hostname,
        value: "customers.get-on.tech",
      },
    ];
    await service.refreshAddress(host.id);

    resolver.failCname = true;
    const checked = await service.refreshAddress(host.id);

    expect(checked.status).toBe("live");
    expect(pointers.site.deleted).not.toContain(host.hostname);
    expect((await service.checkDomain(started.id)).domain.status).toBe("live");
  });

  it("promotes another live domain when the main one is removed", async () => {
    const { service, resolver, provider, pointers, db } = setup();
    resolver.cname = [
      {
        type: "CNAME",
        name: "www.example.com",
        value: "customers.get-on.tech",
      },
    ];

    async function connect(domain: string) {
      const started = await service.startDomain({
        projectId: "project-1",
        domain,
      });
      resolver.txt = [
        {
          type: "TXT",
          name: `_geton-verify.${domain}`,
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
      provider.markDnsReady(host.hostname);
      await service.refreshAddress(host.id);
      return { domain: started, host };
    }

    const first = await connect("rosebakery.com");
    const second = await connect("rosebakery.co");
    expect(db.rows.projects?.[0]?.primary_host).toBe(second.host.hostname);

    await service.removeDomain(first.domain.id);

    expect(db.rows.projects?.[0]?.primary_host).toBe(second.host.hostname);
    expect(pointers.site.pointer?.primaryHost).toBe(second.host.hostname);
    expect(pointers.site.pointer?.redirectToPrimary).toBe(true);
  });

  it("removes one address without removing the domain", async () => {
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
    const main = await service.addAddress({
      domainId: started.id,
      label: "www",
      role: "main",
      mode: "switch_now",
    });
    const extra = await service.addAddress({
      domainId: started.id,
      label: "@",
      role: "extra",
      mode: "switch_now",
    });
    resolver.cname = [
      { type: "CNAME", name: main.hostname, value: "customers.get-on.tech" },
      { type: "CNAME", name: extra.hostname, value: "customers.get-on.tech" },
    ];
    provider.markDnsReady(main.hostname);
    provider.markDnsReady(extra.hostname);
    await service.refreshAddress(main.id);
    await service.refreshAddress(extra.id);
    expect(db.rows.projects?.[0]?.primary_host).toBe(main.hostname);

    await service.removeAddress(extra.id);

    const removed = db.rows.domain_hostnames?.find((row) => row.id === extra.id);
    expect(removed?.status).toBe("removed");
    expect(pointers.site.deleted).toContain(extra.hostname);
    expect(db.rows.projects?.[0]?.primary_host).toBe(main.hostname);
    expect(db.rows.domains?.[0]?.status).toBe("live");
  });

  it("promotes the extra address when the main one is removed", async () => {
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
    const main = await service.addAddress({
      domainId: started.id,
      label: "www",
      role: "main",
      mode: "switch_now",
    });
    const extra = await service.addAddress({
      domainId: started.id,
      label: "@",
      role: "extra",
      mode: "switch_now",
    });
    resolver.cname = [
      { type: "CNAME", name: main.hostname, value: "customers.get-on.tech" },
      { type: "CNAME", name: extra.hostname, value: "customers.get-on.tech" },
    ];
    provider.markDnsReady(main.hostname);
    provider.markDnsReady(extra.hostname);
    await service.refreshAddress(main.id);
    await service.refreshAddress(extra.id);

    await service.removeAddress(main.id);

    const removed = db.rows.domain_hostnames?.find((row) => row.id === main.id);
    const promoted = db.rows.domain_hostnames?.find((row) => row.id === extra.id);
    expect(removed?.status).toBe("removed");
    expect(promoted?.role).toBe("main");
    expect(db.rows.projects?.[0]?.primary_host).toBe(extra.hostname);
    expect(pointers.site.pointer?.primaryHost).toBe(extra.hostname);
    expect(db.rows.domains?.[0]?.status).toBe("live");
  });

  it("pauses only the lapsed addresses and frees the free address", async () => {
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
    provider.markDnsReady(host.hostname);
    resolver.cname = [
      {
        type: "CNAME",
        name: host.hostname,
        value: "customers.get-on.tech",
      },
    ];
    await service.refreshAddress(host.id);

    await service.enforcePlan("team-1");

    expect(db.rows.domains?.[0]?.status).toBe("plan_lapsed");
    expect(pointers.site.planLapsed[host.hostname]).toBe(true);
    expect(pointers.site.deleted).not.toContain(host.hostname);
    expect(pointers.site.pointer?.primaryHost).toBeNull();
    expect(pointers.site.pointer?.redirectToPrimary).toBe(false);
    expect(db.rows.projects?.[0]?.primary_host).toBeNull();
  });

  it("expires unfinished domain setups after their verification window", async () => {
    const { service, db } = setup();
    const started = await service.startDomain({
      projectId: "project-1",
      domain: "rosebakery.com",
    });
    expect(started.status).toBe("draft");
    db.rows.domains![0]!.verification_expires_at = iso(-60_000);

    expect(await service.expireUnverifiedDomains()).toBe(1);

    expect(db.rows.domains?.[0]?.status).toBe("removed");
    expect(db.rows.domains?.[0]?.removed_at).toBe(iso());
    expect(db.rows.domain_events).toContainEqual(
      expect.objectContaining({ event: "verification_expired" }),
    );
  });

  it("pauses and resumes a live website from support", async () => {
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
    provider.markDnsReady(host.hostname);
    resolver.cname = [
      {
        type: "CNAME",
        name: host.hostname,
        value: "customers.get-on.tech",
      },
    ];
    await service.refreshAddress(host.id);

    await service.pauseDomain(started.id);

    expect(db.rows.domains?.[0]?.status).toBe("paused");
    expect(pointers.site.supportPaused[host.hostname]).toBe(true);
    expect(db.rows.projects?.[0]?.primary_host).toBeNull();

    await service.resumeDomain(started.id);

    expect(db.rows.domains?.[0]?.status).toBe("live");
    expect(pointers.site.supportPaused[host.hostname]).toBe(false);
    expect(db.rows.projects?.[0]?.primary_host).toBe(host.hostname);
  });

  it("simulates and restores a plan lapse", async () => {
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
    provider.markDnsReady(host.hostname);
    resolver.cname = [
      {
        type: "CNAME",
        name: host.hostname,
        value: "customers.get-on.tech",
      },
    ];
    await service.refreshAddress(host.id);

    await service.simulatePlanLapse(started.id);

    expect(db.rows.domains?.[0]?.status).toBe("plan_lapsed");
    expect(pointers.site.planLapsed[host.hostname]).toBe(true);
    expect(db.rows.projects?.[0]?.primary_host).toBeNull();

    await service.restorePlanLapse(started.id);

    expect(db.rows.domains?.[0]?.status).toBe("live");
    expect(pointers.site.planLapsed[host.hostname]).toBe(false);
    expect(db.rows.projects?.[0]?.primary_host).toBe(host.hostname);
    expect(pointers.site.pointer?.redirectToPrimary).toBe(true);
  });

  it("blocks a domain, removes serving and frees the primary address", async () => {
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
    provider.markDnsReady(host.hostname);
    resolver.cname = [
      {
        type: "CNAME",
        name: host.hostname,
        value: "customers.get-on.tech",
      },
    ];
    await service.refreshAddress(host.id);

    await service.blockDomain(started.id, "Reported for abuse");

    expect(db.rows.domains?.[0]?.status).toBe("failed");
    expect(db.rows.domains?.[0]?.review_state).toBe("rejected");
    expect(db.rows.domain_hostnames?.[0]?.status).toBe("blocked");
    expect(pointers.site.deleted).toContain(host.hostname);
    expect(db.rows.projects?.[0]?.primary_host).toBeNull();
    await expect(provider.getHostname(host.providerId!)).resolves.toBeNull();
  });

  it("deletes a provider hostname from support and stops serving it", async () => {
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
    provider.markDnsReady(host.hostname);
    resolver.cname = [
      {
        type: "CNAME",
        name: host.hostname,
        value: "customers.get-on.tech",
      },
    ];
    await service.refreshAddress(host.id);

    await service.deleteProviderHostname(host.id);

    expect(db.rows.domain_hostnames?.[0]?.status).toBe("removed");
    expect(db.rows.domains?.[0]?.status).toBe("verified");
    expect(db.rows.projects?.[0]?.primary_host).toBeNull();
    expect(pointers.site.deleted).toContain(host.hostname);
    expect(pointers.site.pointer?.primaryHost).toBeNull();
    expect(await provider.getHostname(host.providerId!, host.mode)).toBeNull();
  });

  it("lets a disconnected domain be used by a website again", async () => {
    const { service, resolver, provider } = setup();
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
    provider.markDnsReady(host.hostname);
    resolver.cname = [
      {
        type: "CNAME",
        name: host.hostname,
        value: "customers.get-on.tech",
      },
    ];
    await service.refreshAddress(host.id);

    await service.detachDomain(started.id);
    expect((await service.checkDomain(started.id)).domain.status).toBe(
      "unassigned",
    );

    await service.reassignDomain(started.id, "project-1");

    const result = await service.checkDomain(started.id);
    expect(result.domain.status).toBe("verified");
    expect(result.domain.projectId).toBe("project-1");
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
