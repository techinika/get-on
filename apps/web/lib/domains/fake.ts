import { ProviderError } from "./errors";
import type { HostnameProvider } from "./provider";
import type {
  HostnameMode,
  ProviderHealth,
  ProviderHostname,
  ProviderPage,
  ProviderSetup,
  ProviderUsage,
} from "./types";

type FakeRecord = ProviderHostname & {
  dnsReady: boolean;
};

export type FakeProviderOptions = {
  now?: number | (() => number);
  includedHostnames?: number;
  maximumHostnames?: number;
};

/**
 * Deterministic provider for development and tests. DNS is controlled with
 * markDnsReady(); the provider never pretends to know the public internet.
 */
export class FakeHostnameProvider implements HostnameProvider {
  readonly name = "fake";
  private readonly records = new Map<string, FakeRecord>();
  private readonly includedHostnames: number;
  private readonly maximumHostnames: number;
  private clock: number;
  private nextId = 1;

  constructor(options: FakeProviderOptions = {}) {
    this.clock =
      typeof options.now === "function"
        ? options.now()
        : (options.now ?? Date.now());
    this.includedHostnames = options.includedHostnames ?? 100;
    this.maximumHostnames = options.maximumHostnames ?? 50000;
  }

  async checkSetup(): Promise<ProviderSetup> {
    return { ok: true, problems: [] };
  }

  async createHostname(input: {
    hostname: string;
    mode: HostnameMode;
  }): Promise<ProviderHostname> {
    const hostname = input.hostname.toLowerCase();
    for (const record of this.records.values()) {
      if (record.hostname === hostname) {
        throw new ProviderError("PROVIDER_ERROR", { status: 409 });
      }
    }
    const id = `fake-${this.nextId++}`;
    const record: FakeRecord = {
      id,
      hostname,
      mode: input.mode,
      status: "pending",
      sslStatus:
        input.mode === "prepare_first" ? "pending_validation" : "initializing",
      ownershipTxt: {
        type: "TXT",
        name: `_cf-custom-hostname.${hostname}`,
        value: `fake-ownership-${id}`,
      },
      validationTxt: {
        type: "TXT",
        name: `_acme-challenge.${hostname}`,
        value: `fake-validation-${id}`,
      },
      verificationErrors: [],
      rawStatus: "pending",
      dnsReady: false,
    };
    this.records.set(id, record);
    return this.publicRecord(record);
  }

  async getHostname(
    id: string,
    mode?: HostnameMode,
  ): Promise<ProviderHostname | null> {
    const record = this.records.get(id);
    if (!record) return null;
    if (mode) record.mode = mode;
    this.refresh(record);
    return this.publicRecord(record);
  }

  async retryValidation(
    id: string,
    mode?: HostnameMode,
  ): Promise<ProviderHostname> {
    const record = this.records.get(id);
    if (!record) throw new ProviderError("PROVIDER_ERROR", { status: 404 });
    if (mode) record.mode = mode;
    this.refresh(record);
    return this.publicRecord(record);
  }

  async deleteHostname(id: string): Promise<void> {
    this.records.delete(id);
  }

  async listHostnames(page: number): Promise<ProviderPage> {
    const all = [...this.records.values()].map((record) => {
      this.refresh(record);
      return this.publicRecord(record);
    });
    const perPage = 50;
    const totalPages = Math.max(1, Math.ceil(all.length / perPage));
    const current = Math.max(1, Math.min(page, totalPages));
    return {
      hostnames: all.slice((current - 1) * perPage, current * perPage),
      page: current,
      totalPages,
    };
  }

  health(): ProviderHealth {
    return {
      totalRequests: 0,
      totalFailures: 0,
      consecutiveFailures: 0,
      circuitOpenUntil: null,
      lastFailureAt: null,
      lastSuccessAt: null,
    };
  }

  async usage(): Promise<ProviderUsage> {
    const all = [...this.records.values()];
    return {
      total: all.length,
      pending: all.filter(
        (record) => record.status === "pending" || record.status === "preparing",
      ).length,
      included: this.includedHostnames,
      maximum: this.maximumHostnames,
    };
  }

  currentTime(): number {
    return this.clock;
  }

  /** Test hook: pretend the CNAME and DNS validation records are visible. */
  markDnsReady(hostname: string, ready = true): void {
    for (const record of this.records.values()) {
      if (record.hostname === hostname.toLowerCase()) record.dnsReady = ready;
    }
  }

  /** Test hook: move the fake clock forward and promote ready hostnames. */
  advance(ms: number): void {
    this.clock += Math.max(0, ms);
    for (const record of this.records.values()) this.refresh(record);
  }

  private refresh(record: FakeRecord): void {
    if (record.dnsReady) {
      record.status = "active";
      record.sslStatus = "active";
    }
  }

  private publicRecord(record: FakeRecord): ProviderHostname {
    return {
      id: record.id,
      hostname: record.hostname,
      mode: record.mode,
      status: record.status,
      sslStatus: record.sslStatus,
      ownershipTxt: record.ownershipTxt,
      validationTxt: record.validationTxt,
      verificationErrors: [...record.verificationErrors],
      rawStatus: record.rawStatus,
    };
  }
}
