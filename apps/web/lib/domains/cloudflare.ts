import type { DomainsConfig } from "./config";
import { requireCloudflareDomainsConfig } from "./config";
import { ProviderError } from "./errors";
import type { CreateHostnameInput, HostnameProvider } from "./provider";
import type {
  DnsRecord,
  HostnameMode,
  ProviderHostname,
  ProviderPage,
  ProviderSetup,
  ProviderUsage,
} from "./types";

type CfTxt = {
  txt_name?: string;
  txt_value?: string;
  status?: string;
};

type CfError = {
  code?: number;
  message?: string;
};

type CfHostname = {
  id?: string;
  hostname?: string;
  status?: string;
  ssl?: {
    status?: string;
    validation_records?: CfTxt[];
    validation_errors?: CfError[];
  };
  ownership_verification?: {
    type?: string;
    name?: string;
    value?: string;
  };
  verification_errors?: CfError[];
};

type CfEnvelope<T> = {
  success?: boolean;
  result?: T;
  errors?: CfError[];
  result_info?: {
    page?: number;
    total_pages?: number;
    total_count?: number;
  };
};

type FetchLike = typeof fetch;

export type CloudflareOptions = {
  fetch?: FetchLike;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  timeoutMs?: number;
  retries?: number;
  maximumHostnames?: number;
};

const MAXIMUM_HOSTNAMES = 50000;

function sslSettings(mode: HostnameMode) {
  return {
    method: mode === "prepare_first" ? "txt" : "http",
    type: "dv",
    bundle_method: "ubiquitous",
    wildcard: false,
    settings: { min_tls_version: "1.2" },
  };
}

function txtRecord(record: CfTxt | undefined): DnsRecord | null {
  if (!record?.txt_name || !record.txt_value) return null;
  return { type: "TXT", name: record.txt_name, value: record.txt_value };
}

function errorsOf(...groups: (CfError[] | undefined)[]): string[] {
  const out: string[] = [];
  for (const group of groups) {
    for (const item of group ?? []) {
      const text = item.message ?? (item.code != null ? `Error ${item.code}` : "");
      if (text) out.push(text.slice(0, 200));
    }
  }
  return out;
}

function mapHostname(
  raw: CfHostname,
  mode: HostnameMode,
): ProviderHostname | null {
  if (!raw.id || !raw.hostname) return null;
  const validation = (raw.ssl?.validation_records ?? []).find(
    (record) => record.txt_name && record.txt_value,
  );
  return {
    id: raw.id,
    hostname: raw.hostname.toLowerCase(),
    mode,
    status: raw.status ?? "pending",
    sslStatus: raw.ssl?.status ?? "initializing",
    ownershipTxt: raw.ownership_verification
      ? {
          type: "TXT",
          name:
            raw.ownership_verification.name ??
            `_cf-custom-hostname.${raw.hostname}`,
          value: raw.ownership_verification.value ?? "",
        }
      : null,
    validationTxt: txtRecord(validation),
    verificationErrors: errorsOf(
      raw.verification_errors,
      raw.ssl?.validation_errors,
    ),
    rawStatus: `${raw.status ?? "pending"}/${raw.ssl?.status ?? "initializing"}`,
  };
}

/**
 * One HTTP client for Cloudflare for SaaS. Tokens never appear in errors or
 * logs, and the circuit breaker keeps a provider outage from becoming a queue
 * of slow requests.
 */
export class CloudflareHostnameProvider implements HostnameProvider {
  readonly name = "cloudflare";
  private readonly zoneId: string;
  private readonly apiToken: string;
  private readonly cnameTarget: string;
  private readonly includedHostnames: number;
  private readonly maximumHostnames: number;
  private readonly providerRps: number;
  private readonly fetchImpl: FetchLike;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly random: () => number;
  private readonly timeoutMs: number;
  private readonly retries: number;
  private nextSlot = 0;
  private failures = 0;
  private openUntil = 0;

  constructor(config: DomainsConfig, options: CloudflareOptions = {}) {
    const required = requireCloudflareDomainsConfig(config);
    this.zoneId = required.zoneId;
    this.apiToken = required.apiToken;
    this.cnameTarget = required.cnameTarget;
    this.includedHostnames = config.includedHostnames;
    this.maximumHostnames = options.maximumHostnames ?? MAXIMUM_HOSTNAMES;
    this.providerRps = config.providerRps;
    this.fetchImpl = options.fetch ?? fetch;
    this.sleep =
      options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.random = options.random ?? Math.random;
    this.timeoutMs = options.timeoutMs ?? 10000;
    this.retries = options.retries ?? 3;
  }

  async checkSetup(): Promise<ProviderSetup> {
    const problems: string[] = [];
    if (!this.cnameTarget) problems.push("The connection target is not set.");
    try {
      const result = await this.request<{ status?: string }>(
        `/zones/${encodeURIComponent(this.zoneId)}/custom_hostnames/fallback_origin`,
      );
      if (result?.status !== "active") {
        problems.push("The fallback origin is not active.");
      }
    } catch {
      problems.push("We could not check the fallback origin.");
    }
    return { ok: problems.length === 0, problems };
  }

  async createHostname(input: CreateHostnameInput): Promise<ProviderHostname> {
    const raw = await this.request<CfHostname>(
      `/zones/${encodeURIComponent(this.zoneId)}/custom_hostnames`,
      {
        method: "POST",
        body: JSON.stringify({
          hostname: input.hostname.toLowerCase(),
          ssl: sslSettings(input.mode),
        }),
      },
    );
    const hostname = raw ? mapHostname(raw, input.mode) : null;
    if (!hostname) throw new ProviderError("PROVIDER_ERROR");
    return hostname;
  }

  async getHostname(
    id: string,
    mode: HostnameMode = "switch_now",
  ): Promise<ProviderHostname | null> {
    const raw = await this.request<CfHostname>(
      `/zones/${encodeURIComponent(this.zoneId)}/custom_hostnames/${encodeURIComponent(id)}`,
      { notFound: true },
    );
    return raw ? mapHostname(raw, mode) : null;
  }

  async retryValidation(
    id: string,
    mode: HostnameMode = "switch_now",
  ): Promise<ProviderHostname> {
    const raw = await this.request<CfHostname>(
      `/zones/${encodeURIComponent(this.zoneId)}/custom_hostnames/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        body: JSON.stringify({ ssl: sslSettings(mode) }),
      },
    );
    const hostname = raw ? mapHostname(raw, mode) : null;
    if (!hostname) throw new ProviderError("PROVIDER_ERROR");
    return hostname;
  }

  async deleteHostname(id: string): Promise<void> {
    await this.request(
      `/zones/${encodeURIComponent(this.zoneId)}/custom_hostnames/${encodeURIComponent(id)}`,
      { method: "DELETE", notFound: true },
    );
  }

  async listHostnames(page: number): Promise<ProviderPage> {
    const result = await this.requestWithInfo<CfHostname[]>(
      `/zones/${encodeURIComponent(this.zoneId)}/custom_hostnames?page=${Math.max(
        1,
        page,
      )}&per_page=50`,
    );
    return {
      hostnames: (result.result ?? [])
        .map((raw) => mapHostname(raw, "switch_now"))
        .filter((hostname): hostname is ProviderHostname => hostname != null),
      page: result.info.page,
      totalPages: result.info.totalPages,
    };
  }

  async usage(): Promise<ProviderUsage> {
    let total = 0;
    let pending = 0;
    let page = 1;
    let totalPages = 1;
    while (page <= totalPages && page <= 200) {
      const result = await this.listHostnames(page);
      total += result.hostnames.length;
      pending += result.hostnames.filter(
        (hostname) =>
          hostname.status === "pending" ||
          hostname.status === "active_redeploying" ||
          hostname.sslStatus.startsWith("pending"),
      ).length;
      totalPages = result.totalPages;
      page += 1;
    }
    return {
      total,
      pending,
      included: this.includedHostnames,
      maximum: this.maximumHostnames,
    };
  }

  private async request<T>(
    path: string,
    options: {
      method?: string;
      body?: string;
      notFound?: boolean;
    } = {},
  ): Promise<T | null> {
    const result = await this.requestWithInfo<T>(path, options);
    return result.result;
  }

  private async requestWithInfo<T>(
    path: string,
    options: {
      method?: string;
      body?: string;
      notFound?: boolean;
    } = {},
  ): Promise<{
    result: T | null;
    info: { page: number; totalPages: number; total: number };
  }> {
    if (Date.now() < this.openUntil) {
      throw new ProviderError("PROVIDER_UNAVAILABLE");
    }

    let lastError: ProviderError | null = null;
    for (let attempt = 0; attempt <= this.retries; attempt += 1) {
      await this.takeSlot();
      try {
        const response = await this.fetchImpl(
          `https://api.cloudflare.com/client/v4${path}`,
          {
            method: options.method ?? "GET",
            headers: {
              Authorization: `Bearer ${this.apiToken}`,
              "Content-Type": "application/json",
            },
            body: options.body,
            signal: AbortSignal.timeout(this.timeoutMs),
          },
        );

        if (response.status === 404 && options.notFound) {
          return {
            result: null,
            info: { page: 1, totalPages: 1, total: 0 },
          };
        }

        const payload = (await response.json().catch(() => null)) as
          | CfEnvelope<T>
          | null;

        if (response.ok && payload?.success !== false) {
          this.failures = 0;
          return {
            result: payload?.result ?? null,
            info: {
              page: payload?.result_info?.page ?? 1,
              totalPages: payload?.result_info?.total_pages ?? 1,
              total: payload?.result_info?.total_count ?? 0,
            },
          };
        }

        const error = this.providerError(response.status, payload?.errors);
        if (response.status === 429 || response.status >= 500) {
          lastError = error;
          if (attempt < this.retries) {
            await this.backoff(attempt, response.headers.get("retry-after"));
            continue;
          }
        }
        throw error;
      } catch (error) {
        if (error instanceof ProviderError) {
          if (!error.retryable) {
            this.recordFailure();
            throw error;
          }
          lastError = error;
        } else {
          lastError = new ProviderError("PROVIDER_UNAVAILABLE", {
            retryable: true,
          });
        }
        if (attempt >= this.retries) break;
        await this.backoff(attempt, null);
      }
    }

    this.recordFailure();
    throw lastError ?? new ProviderError("PROVIDER_UNAVAILABLE");
  }

  private providerError(status: number, errors: CfError[] | undefined): ProviderError {
    if (status === 429) {
      return new ProviderError("PROVIDER_RATE_LIMITED", {
        status,
        retryable: true,
      });
    }
    if (status >= 500) {
      return new ProviderError("PROVIDER_UNAVAILABLE", {
        status,
        retryable: true,
      });
    }
    const codes = (errors ?? []).map((item) => item.code).filter(Boolean);
    const retryable = codes.some((code) => code === 1000 || code === 10000);
    return new ProviderError("PROVIDER_ERROR", {
      status,
      retryable,
    });
  }

  private recordFailure(): void {
    this.failures += 1;
    if (this.failures >= 5) {
      this.openUntil = Date.now() + 60_000;
    }
  }

  private async takeSlot(): Promise<void> {
    const now = Date.now();
    const wait = Math.max(0, this.nextSlot - now);
    this.nextSlot = Math.max(now, this.nextSlot) + 1000 / Math.max(1, this.rps());
    if (wait > 0) await this.sleep(wait);
  }

  private rps(): number {
    return this.providerRps;
  }

  private async backoff(attempt: number, retryAfter: string | null): Promise<void> {
    const header = retryAfter ? Number(retryAfter) : NaN;
    const base = Number.isFinite(header) && header > 0 ? header * 1000 : 250 * 2 ** attempt;
    const jitter = Math.floor(this.random() * 250);
    await this.sleep(Math.min(base + jitter, 10_000));
  }
}
