import type { SupabaseClient } from "@supabase/supabase-js";
import {
  readPublishConfig,
  siteHostname,
  type PublishConfig,
} from "@/lib/publishing/config";
import {
  createPublishStore,
  type PublishStore,
} from "@/lib/publishing/store";
import {
  readDomainsConfig,
  type DomainsConfig,
} from "./config";
import { DohResolver, checkCnameRecord, checkTxtRecord, dnsProviderHint, type DnsResolver } from "./dns";
import { DomainError, asDomainError, domainCodeFromMessage } from "./errors";
import {
  hostnameForLabel,
  isValidHostnameLabel,
  normalizeDomainInput,
} from "./normalize";
import { createHostnameProvider } from "./provider-factory";
import { screenDomain } from "./protected";
import { RdapClient } from "./rdap";
import { verificationName } from "./records";
import {
  DOMAIN_COLUMNS,
  HOSTNAME_COLUMNS,
  asDomain,
  asHostname,
  hostnameStatusFromProvider,
} from "./rows";
import type {
  Domain,
  DomainHostname,
  HostnameMode,
  HostnameRole,
  HostnameStatus,
  ProviderHostname,
} from "./types";
import type { HostnameProvider } from "./provider";

type SupabaseLike = SupabaseClient;

type ProjectRow = {
  id: string;
  subdomain: string;
  redirect_free_address: boolean;
};

export type DomainPointerStore = Pick<
  PublishStore,
  "getPointer" | "writePointer" | "writeHostPointer" | "deleteHostPointer"
>;

export type DomainServiceOptions = {
  supabase: SupabaseLike;
  provider?: HostnameProvider;
  resolver?: DnsResolver;
  rdap?: Pick<RdapClient, "lookup">;
  config?: DomainsConfig;
  pointers?: DomainPointerStore;
  publishConfig?: PublishConfig;
  healthCheck?: (hostname: string) => Promise<boolean>;
  now?: () => Date;
};

export type VerifyResult = {
  domain: Domain;
  status: "found" | "wrong" | "missing";
  records: string[];
};

export type StartDomainInput = {
  projectId: string;
  domain: string;
  displayName?: string;
};

export type AddAddressInput = {
  domainId: string;
  label: string;
  role: HostnameRole;
  mode: HostnameMode;
};

async function defaultHealthCheck(hostname: string): Promise<boolean> {
  try {
    const response = await fetch(`https://${hostname}/_gs/health`, {
      headers: { "Cache-Control": "no-store" },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return false;
    return (await response.text()).trim() === "ok";
  } catch {
    return false;
  }
}

function pollDelayMs(attempts: number): number {
  const minutes = Math.min(60, Math.max(1, 2 ** Math.min(attempts, 6)));
  return minutes * 60 * 1000;
}

/**
 * The server-side domain workflow. All rules that protect money, ownership or
 * routing are repeated here; the database and provider enforce them too.
 */
export class DomainService {
  private readonly supabase: SupabaseLike;
  private readonly provider: HostnameProvider;
  private readonly resolver: DnsResolver;
  private readonly rdap: Pick<RdapClient, "lookup">;
  private readonly config: DomainsConfig;
  private readonly pointers: DomainPointerStore;
  private readonly publishConfig: PublishConfig;
  private readonly healthCheck: (hostname: string) => Promise<boolean>;
  private readonly now: () => Date;

  constructor(options: DomainServiceOptions) {
    this.config = options.config ?? readDomainsConfig();
    this.supabase = options.supabase;
    this.provider = options.provider ?? createHostnameProvider(this.config);
    this.resolver =
      options.resolver ??
      new DohResolver({ endpoints: this.config.dohEndpoints });
    this.rdap =
      options.rdap ??
      new RdapClient({ bootstrapUrl: this.config.rdapBootstrapUrl });
    this.publishConfig = options.publishConfig ?? readPublishConfig();
    this.pointers = options.pointers ?? createPublishStore(this.publishConfig);
    this.healthCheck = options.healthCheck ?? defaultHealthCheck;
    this.now = options.now ?? (() => new Date());
  }

  private async rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
    const { data, error } = await this.supabase.rpc(name, args);
    if (error) throw new DomainError(domainCodeFromMessage(error.message));
    return data as T;
  }

  private async loadDomain(domainId: string): Promise<Domain> {
    const { data, error } = await this.supabase
      .from("domains")
      .select(DOMAIN_COLUMNS)
      .eq("id", domainId)
      .maybeSingle();
    if (error || !data) throw new DomainError("DOMAIN_NOT_CONNECTED");
    return asDomain(data);
  }

  private async loadHostname(hostnameId: string): Promise<DomainHostname> {
    const { data, error } = await this.supabase
      .from("domain_hostnames")
      .select(HOSTNAME_COLUMNS)
      .eq("id", hostnameId)
      .maybeSingle();
    if (error || !data) throw new DomainError("DOMAIN_NOT_CONNECTED");
    return asHostname(data);
  }

  private async loadProject(projectId: string): Promise<ProjectRow> {
    const { data, error } = await this.supabase
      .from("projects")
      .select("id, subdomain, redirect_free_address")
      .eq("id", projectId)
      .maybeSingle();
    if (error || !data) throw new DomainError("DOMAIN_NOT_CONNECTED");
    return {
      id: String(data.id),
      subdomain: String(data.subdomain),
      redirect_free_address: data.redirect_free_address !== false,
    };
  }

  private async updateDomain(
    domainId: string,
    values: Record<string, unknown>,
  ): Promise<void> {
    const { error } = await this.supabase
      .from("domains")
      .update(values)
      .eq("id", domainId);
    if (error) throw new Error("DOMAIN_SAVE_FAILED");
  }

  private async updateHostname(
    hostnameId: string,
    values: Record<string, unknown>,
  ): Promise<void> {
    const { error } = await this.supabase
      .from("domain_hostnames")
      .update(values)
      .eq("id", hostnameId);
    if (error) throw new Error("DOMAIN_SAVE_FAILED");
  }

  private async event(
    domainId: string,
    event: string,
    summary: string,
    hostnameId?: string,
  ): Promise<void> {
    await this.supabase.from("domain_events").insert({
      domain_id: domainId,
      hostname_id: hostnameId ?? null,
      event,
      summary,
    });
  }

  async startDomain(input: StartDomainInput): Promise<Domain> {
    const normalized = normalizeDomainInput(input.domain);
    if (!normalized.ok) {
      throw new DomainError(
        normalized.reason === "reserved" ? "DOMAIN_BLOCKED" : "DOMAIN_INVALID",
      );
    }

    const screening = screenDomain(normalized.domain.sld);
    if (screening.action === "block") throw new DomainError("DOMAIN_BLOCKED");

    const domainId = await this.rpc<string>("start_domain", {
      p_project_id: input.projectId,
      p_registrable: normalized.domain.registrable,
      p_display: input.displayName?.trim() || normalized.domain.registrable,
    });

    const [registrar, hint] = await Promise.all([
      this.rdap.lookup(normalized.domain.registrable).catch(() => null),
      dnsProviderHint(this.resolver, normalized.domain.registrable).catch(() => null),
    ]);

    const current = await this.loadDomain(domainId);
    const patch: Record<string, unknown> = {
      last_checked_at: this.now().toISOString(),
    };
    if (registrar) patch.registrar = registrar;
    if (hint) patch.dns_provider_hint = hint;
    if (screening.action === "review" && current.reviewState === "none") {
      patch.review_state = "pending";
      patch.status_reason = "review";
    }
    await this.updateDomain(domainId, patch);

    return this.loadDomain(domainId);
  }

  async verifyDomain(domainId: string): Promise<VerifyResult> {
    const domain = await this.loadDomain(domainId);
    if (domain.reviewState === "pending") {
      throw new DomainError("DOMAIN_REVIEW_PENDING");
    }

    const check = await checkTxtRecord(
      this.resolver,
      verificationName(domain.registrable),
      domain.verificationValue,
    );

    if (check.status === "found") {
      await this.rpc<void>("mark_domain_verified", { p_domain_id: domainId });
      await this.updateDomain(domainId, {
        last_checked_at: this.now().toISOString(),
      });
    } else {
      await this.updateDomain(domainId, {
        last_checked_at: this.now().toISOString(),
        ...(domain.status === "draft"
          ? { status: "awaiting_txt", status_reason: "txt_missing" }
          : {}),
      });
      await this.event(
        domainId,
        "txt_missing",
        check.status === "wrong"
          ? "Verification record found with a different value"
          : "Verification record not found",
      );
    }

    return {
      domain: await this.loadDomain(domainId),
      status: check.status,
      records: check.records,
    };
  }

  async addAddress(input: AddAddressInput): Promise<DomainHostname> {
    const domain = await this.loadDomain(input.domainId);
    if (domain.reviewState === "pending") {
      throw new DomainError("DOMAIN_REVIEW_PENDING");
    }
    if (!["verified", "connecting", "live", "attention", "stalled"].includes(domain.status)) {
      throw new DomainError("DOMAIN_NOT_VERIFIED");
    }

    const label = input.label.trim().toLowerCase();
    if (!isValidHostnameLabel(label)) throw new DomainError("DOMAIN_INVALID");
    if (input.role !== "main" && input.role !== "extra") {
      throw new DomainError("HOSTNAME_LIMIT");
    }
    if (input.mode !== "switch_now" && input.mode !== "prepare_first") {
      throw new DomainError("HOSTNAME_LIMIT");
    }

    const hostname = hostnameForLabel(label, domain.registrable);
    const cnameTarget = this.cnameTarget();
    const hostnameId = await this.rpc<string>("add_hostname", {
      p_domain_id: domain.id,
      p_label: label,
      p_role: input.role,
      p_mode: input.mode,
      p_max_pending: this.config.maxPendingHostnames,
    });

    try {
      const created = await this.provider.createHostname({
        hostname,
        mode: input.mode,
      });
      await this.updateHostname(hostnameId, {
        ...this.providerColumns(created),
        cname_target: cnameTarget,
        next_poll_at: new Date(this.now().getTime() + pollDelayMs(0)).toISOString(),
      });
    } catch (error) {
      await this.updateHostname(hostnameId, {
        status: "error",
        status_reason: "provider",
      });
      throw asDomainError(error);
    }

    return this.loadHostname(hostnameId);
  }

  private cnameTarget(): string {
    if (this.config.cnameTarget) return this.config.cnameTarget;
    if (this.config.provider === "cloudflare") {
      throw new DomainError("PROVIDER_NOT_CONFIGURED");
    }
    return `customers.${this.config.rootDomain}`;
  }

  private providerColumns(provider: ProviderHostname): Record<string, unknown> {
    return {
      provider_id: provider.id,
      provider_status: provider.status,
      ssl_status: provider.sslStatus,
      verification_errors: provider.verificationErrors,
      ownership_txt: provider.ownershipTxt,
      validation_txt: provider.validationTxt,
      status: hostnameStatusFromProvider(
        provider.mode,
        provider.status,
        provider.sslStatus,
      ),
    };
  }

  async refreshAddress(hostnameId: string): Promise<DomainHostname> {
    const host = await this.loadHostname(hostnameId);
    if (host.status === "removed") return host;

    const domain = await this.loadDomain(host.domainId);
    if (
      domain.status === "removing" ||
      domain.status === "removed" ||
      domain.status === "plan_lapsed" ||
      domain.status === "unassigned"
    ) {
      return host;
    }

    let providerStatus: Exclude<HostnameStatus, "removed"> = host.status;
    if (host.providerId) {
      try {
        const provider = await this.provider.getHostname(host.providerId, host.mode);
        if (provider) {
          providerStatus = hostnameStatusFromProvider(
            host.mode,
            provider.status,
            provider.sslStatus,
          );
          await this.updateHostname(host.id, {
            ...this.providerColumns(provider),
            poll_attempts: host.pollAttempts + 1,
            next_poll_at: new Date(
              this.now().getTime() + pollDelayMs(host.pollAttempts + 1),
            ).toISOString(),
          });
        }
      } catch {
        providerStatus = host.status;
      }
    }

    const cname = await checkCnameRecord(
      this.resolver,
      host.hostname,
      host.cnameTarget || this.cnameTarget(),
    ).catch(() => null);

    const checkedAt = this.now();
    if (cname == null) {
      await this.updateHostname(host.id, {
        status: host.status === "live" ? "live" : providerStatus,
        cname_checked_at: checkedAt.toISOString(),
      });
      return this.loadHostname(host.id);
    }

    const cnameSeen = cname.status === "found";
    const providerReady =
      providerStatus === "active" ||
      providerStatus === "ready_to_switch" ||
      providerStatus === "live";

    let nextStatus: HostnameStatus = providerStatus;
    if (providerStatus === "moved" || providerStatus === "blocked") {
      nextStatus = providerStatus;
    } else if (cnameSeen && providerReady) {
      nextStatus = "active";
    } else if (host.status === "live" && cname != null) {
      nextStatus = "moved";
    } else if (providerStatus === "active") {
      nextStatus = "active";
    } else if (providerStatus === "ready_to_switch") {
      nextStatus = "ready_to_switch";
    }

    const patch: Record<string, unknown> = {
      cname_seen: cnameSeen,
      cname_checked_at: checkedAt.toISOString(),
      status: nextStatus,
      ...(nextStatus === "moved" || nextStatus === "blocked"
        ? { attention_since: host.attentionSince ?? checkedAt.toISOString() }
        : {}),
    };

    let live = false;
    let project: ProjectRow | null = null;
    if (nextStatus === "active" && cnameSeen) {
      project = await this.loadProject(
        host.projectId ?? domain.projectId ?? "",
      );
      await this.pointers.writeHostPointer(host.hostname, project.id);
      const healthy = await this.healthCheck(host.hostname);
      patch.last_health_at = checkedAt.toISOString();
      if (healthy) {
        live = true;
        nextStatus = "live";
        patch.status = "live";
        patch.live_at = host.liveAt ?? checkedAt.toISOString();
        patch.status_reason = null;
        patch.health_failures = 0;
        await this.linkSitePointer(host, project);
      } else {
        patch.health_failures = host.healthFailures + 1;
        await this.pointers.deleteHostPointer(host.hostname).catch(() => undefined);
      }
    }

    await this.updateHostname(host.id, patch);

    if (live && project && host.status !== "live") {
      await this.event(
        domain.id,
        "hostname_live",
        "Website connected",
        host.id,
      );
    }

    await this.refreshDomainStatus(domain.id, checkedAt);
    return this.loadHostname(host.id);
  }

  private async refreshDomainStatus(
    domainId: string,
    checkedAt: Date,
  ): Promise<void> {
    const { data } = await this.supabase
      .from("domain_hostnames")
      .select("role, status, waiting_since")
      .eq("domain_id", domainId)
      .neq("status", "removed");
    const hosts = (data ?? []) as {
      role: string;
      status: string;
      waiting_since: string | null;
    }[];

    if (hosts.length === 0) {
      await this.updateDomain(domainId, {
        status: "verified",
        status_reason: null,
      });
      return;
    }

    const mainLive = hosts.some(
      (host) => host.role === "main" && host.status === "live",
    );
    const attention = hosts.find(
      (host) => host.status === "moved" || host.status === "blocked",
    );
    const oldest = hosts
      .filter((host) => host.status !== "live")
      .map((host) => new Date(host.waiting_since ?? checkedAt).getTime())
      .sort((a, b) => a - b)[0];

    if (mainLive) {
      await this.updateDomain(domainId, { status: "live", status_reason: null });
    } else if (attention) {
      await this.updateDomain(domainId, {
        status: "attention",
        status_reason: attention.status,
      });
    } else if (
      oldest != null &&
      checkedAt.getTime() - oldest > 14 * 24 * 60 * 60 * 1000
    ) {
      await this.updateDomain(domainId, { status: "stalled" });
    } else {
      await this.updateDomain(domainId, { status: "connecting" });
    }
  }

  private async linkSitePointer(
    host: DomainHostname,
    project: ProjectRow,
  ): Promise<void> {
    const freeHost = siteHostname(this.publishConfig, project.subdomain);
    const pointer = await this.pointers.getPointer(freeHost);
    if (!pointer) return;

    const primaryHost =
      host.role === "main" ? host.hostname : pointer.primaryHost ?? null;

    await this.pointers.writePointer(freeHost, {
      ...pointer,
      primaryHost,
      freeHost,
      redirectToPrimary: project.redirect_free_address,
    });
    await this.pointers.writeHostPointer(host.hostname, project.id);

    if (host.role === "main") {
      await this.supabase
        .from("projects")
        .update({ primary_host: host.hostname })
        .eq("id", project.id);
    }
  }

  async checkDomain(domainId: string): Promise<VerifyResult> {
    const domain = await this.loadDomain(domainId);
    if (domain.status === "draft" || domain.status === "awaiting_txt") {
      return this.verifyDomain(domainId);
    }

    const { data } = await this.supabase
      .from("domain_hostnames")
      .select("id")
      .eq("domain_id", domainId)
      .neq("status", "removed");
    for (const row of data ?? []) {
      await this.refreshAddress(String(row.id));
    }

    return {
      domain: await this.loadDomain(domainId),
      status: "found",
      records: [],
    };
  }


  async detachDomain(domainId: string): Promise<void> {
    const domain = await this.loadDomain(domainId);
    const { data } = await this.supabase
      .from("domain_hostnames")
      .select(HOSTNAME_COLUMNS)
      .eq("domain_id", domainId)
      .neq("status", "removed");
    const hostnames = (data ?? []).map(asHostname);

    await this.rpc<void>("detach_domain", { p_domain_id: domainId });

    for (const host of hostnames) {
      if (host.providerId) {
        try {
          await this.provider.deleteHostname(host.providerId);
        } catch {
          await this.supabase.from("released_hostnames").insert({
            provider_id: host.providerId,
            hostname: host.hostname,
            delete_after: new Date(
              this.now().getTime() + 7 * 24 * 60 * 60 * 1000,
            ).toISOString(),
            reason: "domain_detached",
          });
        }
      }
      await this.pointers.deleteHostPointer(host.hostname).catch(() => undefined);
      await this.updateHostname(host.id, {
        status: "removed",
        removed_at: this.now().toISOString(),
      });
    }

    await this.refreshPrimaryAddress(domain.projectId);
  }

  async reassignDomain(domainId: string, projectId: string): Promise<void> {
    const domain = await this.loadDomain(domainId);
    const oldProjectId = domain.projectId;
    const { data } = await this.supabase
      .from("domain_hostnames")
      .select(HOSTNAME_COLUMNS)
      .eq("domain_id", domainId)
      .neq("status", "removed");
    const hostnames = (data ?? []).map(asHostname);

    await this.rpc<void>("reassign_domain", {
      p_domain_id: domainId,
      p_project_id: projectId,
    });

    const project = await this.loadProject(projectId);
    for (const host of hostnames) {
      if (host.status === "live") {
        await this.pointers.writeHostPointer(host.hostname, project.id);
        await this.linkSitePointer(host, project);
      }
    }

    if (oldProjectId && oldProjectId !== projectId) {
      await this.refreshPrimaryAddress(oldProjectId);
    }
    await this.refreshDomainStatus(domain.id, this.now());
  }

  private async refreshPrimaryAddress(projectId: string | null): Promise<void> {
    if (!projectId) return;
    const { data: project } = await this.supabase
      .from("projects")
      .select("subdomain, redirect_free_address, primary_host")
      .eq("id", projectId)
      .maybeSingle();
    if (!project) return;

    const { data: others } = await this.supabase
      .from("domains")
      .select("id")
      .eq("project_id", projectId)
      .eq("status", "live");

    const candidates: string[] = [];
    for (const row of others ?? []) {
      const { data: main } = await this.supabase
        .from("domain_hostnames")
        .select("hostname")
        .eq("domain_id", row.id)
        .eq("role", "main")
        .eq("status", "live")
        .maybeSingle();
      if (main?.hostname) candidates.push(String(main.hostname));
    }

    const current =
      typeof project.primary_host === "string" ? project.primary_host : null;
    const replacement =
      current && candidates.includes(current) ? current : candidates[0] ?? null;

    const freeHost = siteHostname(this.publishConfig, String(project.subdomain));
    const pointer = await this.pointers.getPointer(freeHost);
    if (pointer) {
      await this.pointers.writePointer(freeHost, {
        ...pointer,
        primaryHost: replacement,
        freeHost,
        redirectToPrimary:
          replacement != null && project.redirect_free_address !== false,
      });
    }
    await this.supabase
      .from("projects")
      .update({ primary_host: replacement })
      .eq("id", projectId);
  }

  async setMainAddress(hostnameId: string): Promise<void> {
    const host = await this.loadHostname(hostnameId);
    const domain = await this.loadDomain(host.domainId);
    await this.rpc<void>("set_main_hostname", { p_hostname_id: hostnameId });

    if (host.projectId ?? domain.projectId) {
      const project = await this.loadProject(
        host.projectId ?? domain.projectId ?? "",
      );
      await this.linkSitePointer({ ...host, role: "main" }, project);
    }
  }

  async enforcePlan(teamId: string): Promise<number> {
    await this.rpc<void>("enforce_domain_plan", { p_team_id: teamId });

    const { data: domains } = await this.supabase
      .from("domains")
      .select("id, status, project_id")
      .eq("team_id", teamId)
      .neq("status", "removed");

    let paused = 0;
    const projects = new Set<string>();
    for (const row of domains ?? []) {
      const domainId = String(row.id);
      const projectId = row.project_id ? String(row.project_id) : null;
      if (!projectId) continue;
      projects.add(projectId);

      const { data: hosts } = await this.supabase
        .from("domain_hostnames")
        .select("hostname")
        .eq("domain_id", domainId)
        .eq("status", "live");
      for (const host of hosts ?? []) {
        const planLapsed = row.status === "plan_lapsed";
        await this.pointers.writeHostPointer(String(host.hostname), projectId, {
          planLapsed,
        });
        if (planLapsed) paused += 1;
      }
    }

    for (const projectId of projects) {
      await this.refreshPrimaryAddress(projectId);
    }
    return paused;
  }

  async blockDomain(domainId: string, reason: string): Promise<void> {
    const domain = await this.loadDomain(domainId);
    const { data } = await this.supabase
      .from("domain_hostnames")
      .select(HOSTNAME_COLUMNS)
      .eq("domain_id", domainId)
      .neq("status", "removed");
    const hostnames = (data ?? []).map(asHostname);

    await this.updateDomain(domainId, {
      status: "failed",
      status_reason: "blocked",
      review_state: "rejected",
    });

    for (const host of hostnames) {
      if (host.providerId) {
        try {
          await this.provider.deleteHostname(host.providerId);
        } catch {
          await this.supabase.from("released_hostnames").insert({
            provider_id: host.providerId,
            hostname: host.hostname,
            delete_after: new Date(
              this.now().getTime() + 7 * 24 * 60 * 60 * 1000,
            ).toISOString(),
            reason: "domain_blocked",
          });
        }
      }
      await this.pointers.deleteHostPointer(host.hostname).catch(() => undefined);
      await this.updateHostname(host.id, {
        status: "blocked",
        status_reason: "blocked",
        attention_since: this.now().toISOString(),
      });
    }

    await this.supabase.from("blocked_domains").upsert({
      hostname_pattern: domain.registrable,
      reason: reason.slice(0, 200),
    });
    await this.refreshPrimaryAddress(domain.projectId);
    await this.event(domainId, "blocked", reason.slice(0, 200));
  }

  async removeDomain(domainId: string): Promise<void> {
    const domain = await this.loadDomain(domainId);
    const { data } = await this.supabase
      .from("domain_hostnames")
      .select(HOSTNAME_COLUMNS)
      .eq("domain_id", domainId)
      .neq("status", "removed");
    const hostnames = (data ?? []).map(asHostname);

    await this.rpc<void>("begin_domain_removal", { p_domain_id: domainId });

    for (const host of hostnames) {
      if (host.providerId) {
        try {
          await this.provider.deleteHostname(host.providerId);
        } catch {
          await this.supabase.from("released_hostnames").insert({
            provider_id: host.providerId,
            hostname: host.hostname,
            delete_after: new Date(
              this.now().getTime() + 7 * 24 * 60 * 60 * 1000,
            ).toISOString(),
            reason: "domain_removed",
          });
        }
      }
      await this.pointers.deleteHostPointer(host.hostname).catch(() => undefined);
    }

    await this.rpc<void>("finish_domain_removal", { p_domain_id: domainId });
    await this.refreshPrimaryAddress(domain.projectId);
  }
}
