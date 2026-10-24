import type { RegistrarInfo } from "./types";

type RdapBootstrap = {
  services?: [string[], string[]][];
};

type RdapEntity = {
  roles?: string[];
  vcardArray?: [string, unknown[][]];
  entities?: RdapEntity[];
};

type RdapResponse = {
  ldhName?: string;
  status?: string[];
  nameservers?: { ldhName?: string }[];
  events?: { eventAction?: string; eventDate?: string }[];
  entities?: RdapEntity[];
};

export type RdapOptions = {
  bootstrapUrl?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
  now?: () => number;
  cacheMs?: number;
};

function registrarName(entity: RdapEntity): string | null {
  const entries = entity.vcardArray?.[1] ?? [];
  for (const entry of entries) {
    if (entry[0] === "fn" && typeof entry[3] === "string" && entry[3].trim()) {
      return entry[3].trim();
    }
  }
  return null;
}

function findRegistrar(entities: RdapEntity[] | undefined): string | null {
  for (const entity of entities ?? []) {
    if (entity.roles?.includes("registrar")) {
      const name = registrarName(entity);
      if (name) return name;
    }
    const nested = findRegistrar(entity.entities);
    if (nested) return nested;
  }
  return null;
}

/**
 * Registrar and expiry lookup. This is non-blocking: a slow or missing RDAP
 * service must never stop a customer from connecting a domain.
 */
export class RdapClient {
  private readonly bootstrapUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly now: () => number;
  private readonly cacheMs: number;
  private cache: { at: number; services: [string[], string[]][] } | null = null;

  constructor(options: RdapOptions = {}) {
    this.bootstrapUrl =
      options.bootstrapUrl ?? "https://data.iana.org/rdap/dns.json";
    this.fetchImpl = options.fetch ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 4000;
    this.now = options.now ?? (() => Date.now());
    this.cacheMs = options.cacheMs ?? 24 * 60 * 60 * 1000;
  }

  async lookup(registrable: string): Promise<RegistrarInfo | null> {
    try {
      const tld = registrable.toLowerCase().split(".").pop();
      if (!tld) return null;
      const services = await this.services();
      const service = services.find(([tlds]) =>
        tlds.map((item) => item.toLowerCase()).includes(tld),
      );
      const base = service?.[1]?.[0];
      if (!base) return null;

      const response = await this.fetchImpl(
        `${base.replace(/\/$/, "")}/domain/${encodeURIComponent(registrable)}`,
        {
          headers: { Accept: "application/rdap+json, application/json" },
          signal: AbortSignal.timeout(this.timeoutMs),
        },
      );
      if (!response.ok) return null;
      const payload = (await response.json()) as RdapResponse;
      const expiration = payload.events?.find(
        (event) => event.eventAction === "expiration",
      )?.eventDate;
      return {
        ...(findRegistrar(payload.entities)
          ? { name: findRegistrar(payload.entities) ?? undefined }
          : {}),
        ...(expiration ? { expiresAt: expiration } : {}),
        ...(payload.nameservers
          ? {
              nameservers: payload.nameservers
                .map((server) => server.ldhName?.toLowerCase())
                .filter((server): server is string => Boolean(server)),
            }
          : {}),
        ...(payload.status ? { status: payload.status } : {}),
      };
    } catch {
      return null;
    }
  }

  private async services(): Promise<[string[], string[]][]> {
    const now = this.now();
    if (this.cache && now - this.cache.at < this.cacheMs) {
      return this.cache.services;
    }
    const response = await this.fetchImpl(this.bootstrapUrl, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!response.ok) throw new Error("RDAP_BOOTSTRAP_FAILED");
    const payload = (await response.json()) as RdapBootstrap;
    const services = (payload.services ?? []).filter(
      (service) =>
        Array.isArray(service[0]) &&
        Array.isArray(service[1]) &&
        service[0].length > 0 &&
        service[1].length > 0,
    );
    this.cache = { at: now, services };
    return services;
  }
}
