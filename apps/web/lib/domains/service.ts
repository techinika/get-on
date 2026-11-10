import type { SupabaseClient } from "@supabase/supabase-js";
import { publishProject } from "@/lib/publishing/service";
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
  publish?: typeof publishProject;
  now?: () => Date;
};

export type VerifyResult = {
  domain: Domain;
  status: "found" | "wrong" | "missing";
  records: string[];
};

export type DnsCheck = {
  status: "found" | "wrong" | "missing";
  records: string[];
  target: string;
  error: string | null;
};

export type KvCheck = {
  exists: boolean;
  siteId: string | null;
  key: string;
};

export type HealthCheck = {
  ok: boolean;
  checkedAt: string | null;
};

export type ProviderCheck = {
  ok: boolean;
  status: string | null;
  error: string | null;
};

export type HostnameDiagnostic = {
  hostnameId: string;
  hostname: string;
  role: string;
  mode: string;
  status: string;
  providerId: string | null;
  providerStatus: string | null;
  sslStatus: string | null;
  dns: DnsCheck;
  provider: ProviderCheck;
  kv: KvCheck;
  health: HealthCheck;
  fixed: boolean;
  fixReason: string | null;
};

export type DomainDiagnosticSummary = {
  total: number;
  kvMissing: number;
  fixed: number;
  dnsMissing: number;
  healthy: number;
};

export type DomainDiagnosticReport = {
  domainId: string;
  registrable: string;
  domainStatus: string;
  generatedAt: string;
  hostnames: HostnameDiagnostic[];
  summary: DomainDiagnosticSummary;
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
  private readonly publish: typeof publishProject;
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
    this.publish = options.publish ?? publishProject;
    this.now = options.now ?? (() => new Date());
  }

  private async rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
    const { data, error } = await this.supabase.rpc(name, args);
    if (error) {
      // Log the raw provider/database error before it is remapped to a stable
      // user-facing code, so the real cause is visible in server logs.
      console.error("[domains] rpc", name, "failed", String(error?.message ?? error));
      throw new DomainError(domainCodeFromMessage(error.message));
    }
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
    hostnameId?: string | null,
    meta?: Record<string, unknown>,
  ): Promise<void> {
    await this.supabase.from("domain_events").insert({
      domain_id: domainId,
      hostname_id: hostnameId ?? null,
      event,
      summary,
      meta: meta ?? null,
    });
  }

  /**
   * Records one step of the domain connection workflow: a console.log for live
   * debugging plus a row in domain_events so the full sequence is inspectable
   * later (kept and trimmed like every other domain event).
   */
  async logStep(
    domainId: string,
    hostnameId: string | null,
    event: string,
    summary: string,
    meta?: Record<string, unknown>,
  ): Promise<void> {
    const payload = {
      domainId,
      hostnameId,
      event,
      summary,
      meta,
      at: new Date().toISOString(),
    };
    console.log("[domains] step", JSON.stringify(payload));
    await this.event(domainId, event, summary, hostnameId, meta);
  }

  async startDomain(input: StartDomainInput): Promise<Domain> {
    await this.logStep(input.projectId, null, "domain_start", "Connection started", {
      input: input.domain,
      projectId: input.projectId,
    });

    const normalized = normalizeDomainInput(input.domain);
    if (!normalized.ok) {
      await this.logStep(input.projectId, null, "domain_start_failed", "Invalid domain input", {
        input: input.domain,
        reason: normalized.reason,
      });
      throw new DomainError(
        normalized.reason === "reserved" ? "DOMAIN_BLOCKED" : "DOMAIN_INVALID",
      );
    }

    await this.logStep(input.projectId, null, "domain_normalized", "Domain normalized", {
      registrable: normalized.domain.registrable,
      hostname: normalized.domain.hostname,
      subdomain: normalized.domain.subdomain,
    });

    const screening = screenDomain(normalized.domain.sld);
    if (screening.action === "block") {
      await this.logStep(input.projectId, null, "domain_blocked", "Domain blocked by screening", {
        sld: normalized.domain.sld,
        reason: screening.reason,
      });
      throw new DomainError("DOMAIN_BLOCKED");
    }

    await this.logStep(input.projectId, null, "domain_screened", "Domain passed screening", {
      sld: normalized.domain.sld,
      action: screening.action,
      reason: screening.reason ?? null,
    });

    const domainId = await this.rpc<string>("start_domain", {
      p_project_id: input.projectId,
      p_registrable: normalized.domain.registrable,
      p_display: input.displayName?.trim() || normalized.domain.registrable,
    });

    await this.logStep(domainId, null, "domain_created", "Domain record created in database", {
      registrable: normalized.domain.registrable,
    });

    const [registrar, hint] = await Promise.all([
      this.rdap.lookup(normalized.domain.registrable).catch(() => null),
      dnsProviderHint(this.resolver, normalized.domain.registrable).catch(() => null),
    ]);

    await this.logStep(domainId, null, "domain_lookup", "Registrar and DNS provider looked up", {
      registrar: registrar ?? null,
      dnsProviderHint: hint ?? null,
    });

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

    await this.logStep(domainId, null, "domain_updated", "Domain metadata saved", {
      reviewState: patch.review_state ?? current.reviewState,
      status: current.status,
    });

    return this.loadDomain(domainId);
  }

  async verifyDomain(domainId: string): Promise<VerifyResult> {
    const domain = await this.loadDomain(domainId);
    await this.logStep(domainId, null, "verify_start", "Verification check started", {
      registrable: domain.registrable,
      status: domain.status,
      reviewState: domain.reviewState,
    });
    if (domain.reviewState === "pending") {
      await this.logStep(domainId, null, "verify_blocked", "Verification blocked by pending review", {
        registrable: domain.registrable,
      });
      throw new DomainError("DOMAIN_REVIEW_PENDING");
    }

    const check = await checkTxtRecord(
      this.resolver,
      verificationName(domain.registrable),
      domain.verificationValue,
    );

    await this.logStep(domainId, null, "verify_txt_checked", "TXT verification record checked", {
      name: verificationName(domain.registrable),
      status: check.status,
      records: check.records,
    });

    if (check.status === "found") {
      await this.rpc<void>("mark_domain_verified", { p_domain_id: domainId });
      await this.updateDomain(domainId, {
        last_checked_at: this.now().toISOString(),
      });
      await this.logStep(domainId, null, "verify_verified", "Domain verified", {
        registrable: domain.registrable,
      });
    } else {
      await this.updateDomain(domainId, {
        last_checked_at: this.now().toISOString(),
        ...(domain.status === "draft"
          ? { status: "awaiting_txt", status_reason: "txt_missing" }
          : {}),
      });
      await this.logStep(domainId, null, "verify_txt_missing", "TXT verification record missing or wrong", {
        status: check.status,
        records: check.records,
        expected: domain.verificationValue,
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
    await this.logStep(domain.id, null, "add_address_start", "Address creation started", {
      domainId: domain.id,
      registrable: domain.registrable,
      label: input.label,
      role: input.role,
      mode: input.mode,
      status: domain.status,
    });
    if (domain.reviewState === "pending") {
      await this.logStep(domain.id, null, "add_address_blocked", "Address blocked by pending review", {
        domainId: domain.id,
        registrable: domain.registrable,
      });
      throw new DomainError("DOMAIN_REVIEW_PENDING");
    }
    if (!["verified", "connecting", "live", "attention", "stalled"].includes(domain.status)) {
      await this.logStep(domain.id, null, "add_address_blocked", "Address blocked: domain not verified", {
        domainId: domain.id,
        registrable: domain.registrable,
        status: domain.status,
      });
      throw new DomainError("DOMAIN_NOT_VERIFIED");
    }

    const label = input.label.trim().toLowerCase();
    if (!isValidHostnameLabel(label)) {
      await this.logStep(domain.id, null, "add_address_failed", "Invalid hostname label", {
        domainId: domain.id,
        registrable: domain.registrable,
        label: input.label,
      });
      throw new DomainError("DOMAIN_INVALID");
    }
    if (input.role !== "main" && input.role !== "extra") {
      await this.logStep(domain.id, null, "add_address_failed", "Invalid hostname role", {
        domainId: domain.id,
        registrable: domain.registrable,
        role: input.role,
      });
      throw new DomainError("HOSTNAME_LIMIT");
    }
    if (input.mode !== "switch_now" && input.mode !== "prepare_first") {
      await this.logStep(domain.id, null, "add_address_failed", "Invalid hostname mode", {
        domainId: domain.id,
        registrable: domain.registrable,
        mode: input.mode,
      });
      throw new DomainError("HOSTNAME_LIMIT");
    }

    const hostname = hostnameForLabel(label, domain.registrable);
    const cnameTarget = this.cnameTarget();
    await this.logStep(domain.id, null, "add_address_resolved", "Hostname and CNAME target resolved", {
      domainId: domain.id,
      registrable: domain.registrable,
      hostname,
      cnameTarget,
    });

    const hostnameId = await this.rpc<string>("add_hostname", {
      p_domain_id: domain.id,
      p_label: label,
      p_role: input.role,
      p_mode: input.mode,
      p_max_pending: this.config.maxPendingHostnames,
    });

    await this.logStep(domain.id, hostnameId, "address_created", "Address record created in database", {
      hostnameId,
      hostname,
      label,
      role: input.role,
      mode: input.mode,
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
      await this.logStep(domain.id, hostnameId, "address_provider_created", "Provider hostname created", {
        hostnameId,
        hostname,
        providerId: created.id,
        providerStatus: created.status,
        sslStatus: created.sslStatus,
      });
    } catch (error) {
      await this.updateHostname(hostnameId, {
        status: "error",
        status_reason: "provider",
      });
      await this.logStep(domain.id, hostnameId, "address_provider_failed", "Provider hostname creation failed", {
        hostnameId,
        hostname,
        error: error instanceof Error ? error.message : String(error),
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
    if (host.status === "removed") {
      await this.logStep(hostnameId, hostnameId, "refresh_removed", "Address already removed, skipping", {
        hostnameId,
        hostname: host.hostname,
      });
      return host;
    }

    const domain = await this.loadDomain(host.domainId);
    await this.logStep(domain.id, hostnameId, "refresh_start", "Address refresh started", {
      hostnameId,
      hostname: host.hostname,
      domainId: domain.id,
      status: host.status,
      providerId: host.providerId,
    });

    if (
      domain.status === "removing" ||
      domain.status === "removed" ||
      domain.status === "plan_lapsed" ||
      domain.status === "paused" ||
      domain.status === "unassigned"
    ) {
      await this.logStep(domain.id, hostnameId, "refresh_skipped", "Refresh skipped: domain not in a connectable state", {
        hostnameId,
        hostname: host.hostname,
        domainStatus: domain.status,
      });
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
          await this.logStep(domain.id, hostnameId, "refresh_provider", "Provider hostname polled", {
            hostnameId,
            hostname: host.hostname,
            providerId: host.providerId,
            providerStatus: provider.status,
            sslStatus: provider.sslStatus,
            mappedStatus: providerStatus,
          });
        }
      } catch {
        await this.logStep(domain.id, hostnameId, "refresh_provider_failed", "Provider hostname poll failed", {
          hostnameId,
          hostname: host.hostname,
          providerId: host.providerId,
        });
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
      await this.logStep(domain.id, hostnameId, "refresh_cname_unavailable", "CNAME check unavailable", {
        hostnameId,
        hostname: host.hostname,
        status: host.status === "live" ? "live" : providerStatus,
      });
      return this.loadHostname(host.id);
    }

    const cnameSeen = cname.status === "found";
    const providerReady =
      providerStatus === "active" ||
      providerStatus === "ready_to_switch" ||
      providerStatus === "live";

    await this.logStep(domain.id, hostnameId, "refresh_cname_checked", "CNAME record checked", {
      hostnameId,
      hostname: host.hostname,
      cnameSeen,
      cnameRecords: cname.records,
      target: host.cnameTarget || this.cnameTarget(),
      providerStatus,
      providerReady,
    });

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
        await this.logStep(domain.id, hostnameId, "address_live", "Address is live and healthy", {
          hostnameId,
          hostname: host.hostname,
          projectId: project.id,
          healthCheck: true,
        });
      } else {
        patch.health_failures = host.healthFailures + 1;
        await this.pointers.deleteHostPointer(host.hostname).catch(() => undefined);
        await this.logStep(domain.id, hostnameId, "address_health_failed", "Address active but health check failed", {
          hostnameId,
          hostname: host.hostname,
          projectId: project.id,
          healthFailures: patch.health_failures,
        });
      }
    }

    await this.updateHostname(host.id, patch);

    if (live && project && host.status !== "live") {
      await this.logStep(domain.id, hostnameId, "hostname_live", "Website connected", {
        hostnameId,
        hostname: host.hostname,
        projectId: project.id,
        role: host.role,
      });
      if (host.role === "main") {
        await this.autoPublishLiveDomain(domain.id, project.id);
      }
    }

    await this.refreshDomainStatus(domain.id, checkedAt);
    await this.logStep(domain.id, hostnameId, "refresh_done", "Address refresh complete", {
      hostnameId,
      hostname: host.hostname,
      nextStatus,
      live,
    });
    return this.loadHostname(host.id);
  }

  private async refreshDomainStatus(
    domainId: string,
    checkedAt: Date,
  ): Promise<void> {
    const { data: current } = await this.supabase
      .from("domains")
      .select("status")
      .eq("id", domainId)
      .maybeSingle();
    if (current?.status === "paused") return;

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

  async diagnoseDomain(domainId: string): Promise<DomainDiagnosticReport> {
    const domain = await this.loadDomain(domainId);
    const { data } = await this.supabase
      .from("domain_hostnames")
      .select(HOSTNAME_COLUMNS)
      .eq("domain_id", domainId)
      .neq("status", "removed");
    const hosts = (data ?? []).map(asHostname);

    const results: HostnameDiagnostic[] = [];
    for (const host of hosts) {
      const cnameTarget = host.cnameTarget || this.cnameTarget();
      let dns: DnsCheck = { status: "missing", records: [], target: cnameTarget, error: null };
      try {
        const check = await checkCnameRecord(this.resolver, host.hostname, cnameTarget);
        dns = { status: check.status, records: check.records, target: cnameTarget, error: null };
      } catch (error) {
        dns.error = error instanceof Error ? error.message : String(error);
      }

      let providerOk = false;
      let providerStatus: string | null = null;
      let providerError: string | null = null;
      if (host.providerId) {
        try {
          const provider = await this.provider.getHostname(host.providerId, host.mode);
          if (provider) {
            providerOk = true;
            providerStatus = provider.status;
          }
        } catch (error) {
          providerError = error instanceof Error ? error.message : String(error);
        }
      }

      let kvExists = false;
      let kvSiteId: string | null = null;
      try {
        const pointer = await this.pointers.getPointer(host.hostname);
        if (pointer) {
          kvExists = true;
          kvSiteId = pointer.siteId;
        }
      } catch {
        // treat as missing
      }

      const shouldHavePointer = host.status === "live" || host.status === "active";
      const canFix =
        !kvExists &&
        shouldHavePointer &&
        dns.status === "found" &&
        (providerOk || host.status === "live");

      let fixed = false;
      let fixReason: string | null = null;
      if (!kvExists && canFix) {
        const projectId = host.projectId ?? domain.projectId;
        if (projectId) {
          try {
            await this.pointers.writeHostPointer(host.hostname, projectId);
            fixed = true;
            fixReason = "Created missing KV host pointer.";
            kvExists = true;
            kvSiteId = projectId;
          } catch (error) {
            fixReason = `Could not create KV pointer: ${error instanceof Error ? error.message : String(error)}`;
          }
        } else {
          fixReason = "No project to point to.";
        }
      }

      let health: HealthCheck = { ok: false, checkedAt: null };
      if (kvExists) {
        try {
          const ok = await this.healthCheck(host.hostname);
          health = { ok, checkedAt: new Date().toISOString() };
        } catch {
          health = { ok: false, checkedAt: new Date().toISOString() };
        }
      }

      results.push({
        hostnameId: host.id,
        hostname: host.hostname,
        role: host.role,
        mode: host.mode,
        status: host.status,
        providerId: host.providerId,
        providerStatus: host.providerStatus,
        sslStatus: host.sslStatus,
        dns,
        provider: { ok: providerOk, status: providerStatus, error: providerError },
        kv: { exists: kvExists, siteId: kvSiteId, key: `host:${host.hostname}` },
        health,
        fixed,
        fixReason,
      });
    }

    const summary: DomainDiagnosticSummary = {
      total: results.length,
      kvMissing: results.filter((r) => !r.kv.exists).length,
      fixed: results.filter((r) => r.fixed).length,
      dnsMissing: results.filter((r) => r.dns.status === "missing").length,
      healthy: results.filter((r) => r.health.ok).length,
    };

    await this.event(domainId, "diagnostic_run", "Admin ran domain self-diagnostic", undefined, {
      hostnames: results.length,
      fixed: summary.fixed,
    });

    return {
      domainId: domain.id,
      registrable: domain.registrable,
      domainStatus: domain.status,
      generatedAt: new Date().toISOString(),
      hostnames: results,
      summary,
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

  /**
   * Rebuilds the live website so its canonical links use the new main address.
   * This never publishes unfinished draft changes.
   */
  private async autoPublishLiveDomain(
    domainId: string,
    projectId: string,
  ): Promise<void> {
    try {
      const [{ data: project }, { data: settings }, { data: domain }] =
        await Promise.all([
          this.supabase
            .from("projects")
            .select("id, name, subdomain, team_id")
            .eq("id", projectId)
            .maybeSingle(),
          this.supabase
            .from("project_settings")
            .select("auto_publish_on_domain")
            .eq("project_id", projectId)
            .maybeSingle(),
          this.supabase
            .from("domains")
            .select("created_by")
            .eq("id", domainId)
            .maybeSingle(),
        ]);
      if (!project || settings?.auto_publish_on_domain === false) return;

      const { data: hasChanges, error } = await this.supabase.rpc(
        "project_has_unpublished_changes",
        { p_project_id: projectId },
      );
      if (error || hasChanges !== false) return;

      const { data: access } = await this.supabase.rpc("billing_resolve_team", {
        p_team: project.team_id,
      });
      const planId = (access as { plan_id?: string } | null)?.plan_id;
      if (!planId || !domain?.created_by) return;

      await this.publish({
        supabase: this.supabase as unknown as Parameters<
          typeof publishProject
        >[0]["supabase"],
        user: { id: String(domain.created_by) },
        team: {
          teamId: String(project.team_id),
          planId: String(planId),
        },
        project: {
          id: String(project.id),
          name: String(project.name),
          subdomain: String(project.subdomain),
        },
        bypassRateLimit: true,
        force: true,
      });
      await this.event(
        domainId,
        "auto_published",
        "Website updated for the new address",
      );
    } catch (error) {
      console.error("[domains] auto publish failed", error);
      await this.event(
        domainId,
        "auto_publish_failed",
        "We could not update the website automatically",
      ).catch(() => undefined);
    }
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

  async expireUnverifiedDomains(): Promise<number> {
    const { data } = await this.supabase
      .from("domains")
      .select("id")
      .in("status", ["draft", "awaiting_txt"])
      .lt("verification_expires_at", this.now().toISOString())
      .limit(50);

    let expired = 0;
    for (const row of data ?? []) {
      const domainId = String(row.id);
      await this.updateDomain(domainId, {
        status: "removed",
        removed_at: this.now().toISOString(),
      });
      await this.event(domainId, "verification_expired", "Domain setup expired");
      expired += 1;
    }
    return expired;
  }

  async pauseDomain(domainId: string): Promise<void> {
    const domain = await this.loadDomain(domainId);
    if (domain.status === "paused") return;
    if (
      ["draft", "awaiting_txt", "unassigned", "removing", "removed", "failed"].includes(
        domain.status,
      )
    ) {
      throw new DomainError("DOMAIN_NOT_CONNECTED");
    }

    await this.updateDomain(domainId, {
      status: "paused",
      pause_previous_status: domain.status,
      status_reason: "support_pause",
    });
    if (domain.projectId) {
      const { data: hosts } = await this.supabase
        .from("domain_hostnames")
        .select("hostname, status")
        .eq("domain_id", domainId)
        .eq("status", "live");
      for (const host of hosts ?? []) {
        await this.pointers.writeHostPointer(
          String(host.hostname),
          domain.projectId,
          { supportPaused: true },
        );
      }
      await this.refreshPrimaryAddress(domain.projectId);
    }
    await this.event(domainId, "support_paused", "Domain paused by support");
  }

  async resumeDomain(domainId: string): Promise<void> {
    const { data } = await this.supabase
      .from("domains")
      .select("status, project_id, pause_previous_status")
      .eq("id", domainId)
      .maybeSingle();
    if (!data) throw new DomainError("DOMAIN_NOT_CONNECTED");
    if (data.status !== "paused") return;

    const previous = String(data.pause_previous_status ?? "connecting");
    await this.updateDomain(domainId, {
      status: previous,
      pause_previous_status: null,
      status_reason: null,
    });
    if (data.project_id) {
      const { data: hosts } = await this.supabase
        .from("domain_hostnames")
        .select("hostname, status")
        .eq("domain_id", domainId)
        .eq("status", "live");
      for (const host of hosts ?? []) {
        await this.pointers.writeHostPointer(
          String(host.hostname),
          String(data.project_id),
          { planLapsed: previous === "plan_lapsed", supportPaused: false },
        );
      }
      await this.refreshPrimaryAddress(String(data.project_id));
    }
    await this.event(domainId, "support_resumed", "Domain resumed by support");
  }

  async simulatePlanLapse(domainId: string): Promise<void> {
    const domain = await this.loadDomain(domainId);
    if (domain.status === "plan_lapsed") return;
    if (domain.status === "paused") throw new DomainError("DOMAIN_PAUSED");
    if (!domain.projectId) throw new DomainError("DOMAIN_NOT_CONNECTED");

    await this.updateDomain(domainId, {
      status: "plan_lapsed",
      plan_previous_status: domain.status,
      status_reason: "simulated",
    });
    const { data } = await this.supabase
      .from("domain_hostnames")
      .select("hostname, status")
      .eq("domain_id", domainId)
      .eq("status", "live");
    for (const host of data ?? []) {
      await this.pointers.writeHostPointer(String(host.hostname), domain.projectId, {
        planLapsed: true,
      });
    }
    await this.refreshPrimaryAddress(domain.projectId);
    await this.event(
      domainId,
      "plan_lapse_simulated",
      "Plan lapse simulated by support",
    );
  }

  async pauseDomainForPlan(domainId: string): Promise<void> {
    const domain = await this.loadDomain(domainId);
    if (domain.status === "plan_lapsed") return;
    if (!domain.projectId) throw new DomainError("DOMAIN_NOT_CONNECTED");
    if (
      [
        "draft",
        "awaiting_txt",
        "unassigned",
        "removing",
        "removed",
        "failed",
        "paused",
      ].includes(domain.status)
    ) {
      throw new DomainError("DOMAIN_NOT_CONNECTED");
    }

    await this.updateDomain(domainId, {
      status: "plan_lapsed",
      plan_previous_status: domain.status,
      status_reason: "plan",
    });
    const { data } = await this.supabase
      .from("domain_hostnames")
      .select("hostname, status")
      .eq("domain_id", domainId)
      .eq("status", "live");
    for (const host of data ?? []) {
      await this.pointers.writeHostPointer(String(host.hostname), domain.projectId, {
        planLapsed: true,
      });
    }
    await this.refreshPrimaryAddress(domain.projectId);
    await this.event(domainId, "plan_lapsed", "Domain paused because the plan lapsed");
  }

  async restorePlanLapse(domainId: string): Promise<void> {
    const { data } = await this.supabase
      .from("domains")
      .select("status, project_id, plan_previous_status")
      .eq("id", domainId)
      .maybeSingle();
    if (!data) throw new DomainError("DOMAIN_NOT_CONNECTED");
    if (data.status !== "plan_lapsed") return;

    await this.updateDomain(domainId, {
      status: String(data.plan_previous_status ?? "connecting"),
      plan_previous_status: null,
      status_reason: null,
    });
    if (data.project_id) {
      const { data: hosts } = await this.supabase
        .from("domain_hostnames")
        .select("hostname, status")
        .eq("domain_id", domainId)
        .eq("status", "live");
      for (const host of hosts ?? []) {
        await this.pointers.writeHostPointer(
          String(host.hostname),
          String(data.project_id),
          { planLapsed: false },
        );
      }
      await this.refreshPrimaryAddress(String(data.project_id));
    }
    await this.event(
      domainId,
      "plan_restore_simulated",
      "Plan restore simulated by support",
    );
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

  async removeAddress(hostnameId: string): Promise<void> {
    const host = await this.loadHostname(hostnameId);
    if (host.status === "removed") return;
    const domain = await this.loadDomain(host.domainId);

    if (host.role === "main") {
      const { data } = await this.supabase
        .from("domain_hostnames")
        .select(HOSTNAME_COLUMNS)
        .eq("domain_id", host.domainId)
        .neq("status", "removed");
      const replacement = (data ?? [])
        .map(asHostname)
        .find(
          (item) =>
            item.id !== host.id &&
            item.status === "live" &&
            item.role === "extra",
        );
      if (replacement) await this.setMainAddress(replacement.id);
    }

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
          reason: "address_removed",
        });
      }
    }
    await this.pointers.deleteHostPointer(host.hostname).catch(() => undefined);
    await this.updateHostname(host.id, {
      status: "removed",
      removed_at: this.now().toISOString(),
    });
    await this.refreshPrimaryAddress(host.projectId ?? domain.projectId);
    await this.refreshDomainStatus(domain.id, this.now());
    await this.event(domain.id, "hostname_removed", "Address removed", host.id);
  }

  async adminReassignHostname(
    hostnameId: string,
    projectId: string,
    adminId: string,
  ): Promise<void> {
    const host = await this.loadHostname(hostnameId);
    if (host.status === "removed") throw new DomainError("HOSTNAME_TAKEN");
    const source = await this.loadDomain(host.domainId);
    const sourceProjectId = host.projectId ?? source.projectId;
    let sourceReplacement: DomainHostname | null = null;
    if (host.role === "main") {
      const { data } = await this.supabase
        .from("domain_hostnames")
        .select(HOSTNAME_COLUMNS)
        .eq("domain_id", host.domainId)
        .neq("status", "removed");
      sourceReplacement =
        (data ?? [])
          .map(asHostname)
          .find(
            (item) =>
              item.id !== host.id &&
              item.status === "live" &&
              item.role === "extra",
          ) ?? null;
    }

    const targetDomainId = await this.rpc<string>("admin_reassign_hostname", {
      p_hostname_id: hostnameId,
      p_project_id: projectId,
      p_admin_id: adminId,
    });
    const project = await this.loadProject(projectId);

    if (host.status === "live") {
      await this.pointers.writeHostPointer(host.hostname, project.id);
      if (host.role === "main") {
        await this.linkSitePointer(
          { ...host, projectId: project.id, domainId: targetDomainId },
          project,
        );
      }
    } else {
      await this.pointers.deleteHostPointer(host.hostname).catch(() => undefined);
    }

    if (sourceReplacement) {
      await this.setMainAddress(sourceReplacement.id);
    }
    if (sourceProjectId && sourceProjectId !== projectId) {
      await this.refreshPrimaryAddress(sourceProjectId);
    }
    const { data: sourceRow } = await this.supabase
      .from("domains")
      .select("status")
      .eq("id", source.id)
      .maybeSingle();
    if (sourceRow?.status !== "removed") {
      await this.refreshDomainStatus(source.id, this.now());
    }
    await this.refreshDomainStatus(targetDomainId, this.now());
  }

  async deleteProviderHostname(hostnameId: string): Promise<void> {
    const host = await this.loadHostname(hostnameId);
    if (host.status === "removed") return;
    if (!host.providerId) throw new DomainError("PROVIDER_ERROR");
    const domain = await this.loadDomain(host.domainId);

    try {
      await this.provider.deleteHostname(host.providerId);
    } catch {
      await this.supabase.from("released_hostnames").upsert({
        provider_id: host.providerId,
        hostname: host.hostname,
        delete_after: this.now().toISOString(),
        reason: "support_delete",
      });
    }

    await this.pointers.deleteHostPointer(host.hostname).catch(() => undefined);
    await this.updateHostname(host.id, {
      status: "removed",
      removed_at: this.now().toISOString(),
    });
    await this.refreshPrimaryAddress(host.projectId ?? domain.projectId);
    await this.refreshDomainStatus(domain.id, this.now());
    await this.event(
      domain.id,
      "provider_hostname_deleted",
      "Provider hostname deleted by support",
      host.id,
    );
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
