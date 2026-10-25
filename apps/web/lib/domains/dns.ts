import { ProviderError } from "./errors";
import type { DnsRecord, DnsRecordType } from "./types";

type DohAnswer = {
  name?: string;
  type?: number;
  TTL?: number;
  data?: string;
};

type DohResponse = {
  Status?: number;
  Answer?: DohAnswer[];
};

const TYPE_BY_NUMBER: Record<number, DnsRecordType> = {
  1: "A",
  2: "NS",
  5: "CNAME",
  16: "TXT",
  28: "AAAA",
  257: "CAA",
};

const NUMBER_BY_TYPE: Partial<Record<DnsRecordType, number>> = {
  A: 1,
  CNAME: 5,
  TXT: 16,
  AAAA: 28,
  CAA: 257,
  NS: 2,
};

export type DnsAnswer = {
  status: "ok" | "nxdomain";
  records: DnsRecord[];
};

export type DnsResolver = {
  lookup(name: string, type: DnsRecordType): Promise<DnsAnswer>;
};

export type DohOptions = {
  endpoints?: string[];
  fetch?: typeof fetch;
  timeoutMs?: number;
};

function unquoteTxt(data: string): string {
  const parts = data.match(/"((?:\\.|[^"\\])*)"/g);
  if (!parts) return data.trim();
  return parts
    .map((part) => {
      try {
        return JSON.parse(part) as string;
      } catch {
        return part.slice(1, -1);
      }
    })
    .join("");
}

function mapAnswer(answer: DohAnswer): DnsRecord | null {
  const type = answer.type != null ? TYPE_BY_NUMBER[answer.type] : undefined;
  if (!type || !answer.data) return null;
  const value = type === "TXT" ? unquoteTxt(answer.data) : answer.data.trim();
  return {
    type,
    name: (answer.name ?? "").toLowerCase().replace(/\.$/, ""),
    value,
    ...(answer.TTL != null ? { ttl: answer.TTL } : {}),
  };
}

/**
 * DNS-over-HTTPS reader. It never touches the system resolver, so development
 * and production see the same public records.
 */
export class DohResolver implements DnsResolver {
  private readonly endpoints: string[];
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: DohOptions = {}) {
    this.endpoints =
      options.endpoints && options.endpoints.length > 0
        ? options.endpoints
        : [
            "https://cloudflare-dns.com/dns-query",
            "https://dns.google/resolve",
          ];
    this.fetchImpl = options.fetch ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 3000;
  }

  async lookup(name: string, type: DnsRecordType): Promise<DnsAnswer> {
    const typeNumber = NUMBER_BY_TYPE[type];
    if (typeNumber == null) throw new ProviderError("DNS_LOOKUP_FAILED");

    let lastError: unknown = null;
    for (const endpoint of this.endpoints) {
      try {
        const url = new URL(endpoint);
        url.searchParams.set("name", name.toLowerCase().replace(/\.$/, ""));
        url.searchParams.set("type", String(typeNumber));
        const response = await this.fetchImpl(url, {
          headers: { Accept: "application/dns-json" },
          signal: AbortSignal.timeout(this.timeoutMs),
        });
        if (!response.ok) {
          lastError = new Error(`DNS HTTP ${response.status}`);
          continue;
        }
        const payload = (await response.json()) as DohResponse;
        if (payload.Status === 3) return { status: "nxdomain", records: [] };
        if (payload.Status !== 0) {
          lastError = new Error(`DNS status ${payload.Status}`);
          continue;
        }
        return {
          status: "ok",
          records: (payload.Answer ?? [])
            .map(mapAnswer)
            .filter((record): record is DnsRecord => record != null),
        };
      } catch (error) {
        lastError = error;
      }
    }
    throw new ProviderError("DNS_LOOKUP_FAILED", {
      retryable: true,
      message: lastError instanceof Error ? lastError.message : undefined,
    });
  }
}

export type TxtCheck = {
  status: "found" | "wrong" | "missing";
  records: string[];
};

export async function checkTxtRecord(
  resolver: DnsResolver,
  name: string,
  expected: string,
): Promise<TxtCheck> {
  const answer = await resolver.lookup(name, "TXT");
  const values = answer.records.map((record) => record.value.trim());
  if (values.includes(expected.trim())) return { status: "found", records: values };
  return {
    status: values.length > 0 ? "wrong" : "missing",
    records: values,
  };
}

export type CnameCheck = {
  status: "found" | "wrong" | "missing";
  records: string[];
};

export async function checkCnameRecord(
  resolver: DnsResolver,
  name: string,
  target: string,
): Promise<CnameCheck> {
  const answer = await resolver.lookup(name, "CNAME");
  const values = answer.records.map((record) =>
    record.value.toLowerCase().replace(/\.$/, ""),
  );
  const wanted = target.toLowerCase().replace(/\.$/, "");
  if (values.includes(wanted)) return { status: "found", records: values };
  return {
    status: values.length > 0 ? "wrong" : "missing",
    records: values,
  };
}

export type DnsConflict = {
  type: DnsRecordType;
  value: string;
};

export async function findDnsConflicts(
  resolver: DnsResolver,
  hostname: string,
): Promise<DnsConflict[]> {
  const [a, aaaa, cname] = await Promise.all([
    resolver.lookup(hostname, "A"),
    resolver.lookup(hostname, "AAAA"),
    resolver.lookup(hostname, "CNAME"),
  ]);
  return [...a.records, ...aaaa.records, ...cname.records].map((record) => ({
    type: record.type,
    value: record.value,
  }));
}

const PROVIDER_HINTS: { match: RegExp; name: string }[] = [
  { match: /cloudflare/i, name: "Cloudflare" },
  { match: /googledomains|google\.com/i, name: "Google Domains" },
  { match: /namecheap/i, name: "Namecheap" },
  { match: /godaddy|domaincontrol/i, name: "GoDaddy" },
  { match: /squarespace/i, name: "Squarespace" },
  { match: /wix/i, name: "Wix" },
  { match: /hostinger/i, name: "Hostinger" },
  { match: /bluehost/i, name: "Bluehost" },
  { match: /ionos|1and1/i, name: "IONOS" },
  { match: /awsdns|route53/i, name: "Amazon Route 53" },
  { match: /azure|microsoft/i, name: "Microsoft Azure" },
  { match: /digitalocean/i, name: "DigitalOcean" },
];

export async function dnsProviderHint(
  resolver: DnsResolver,
  registrable: string,
): Promise<string | null> {
  try {
    const answer = await resolver.lookup(registrable, "NS");
    const nameservers = answer.records.map((record) => record.value.toLowerCase());
    const hint = PROVIDER_HINTS.find((entry) =>
      nameservers.some((nameserver) => entry.match.test(nameserver)),
    );
    return hint?.name ?? null;
  } catch {
    return null;
  }
}
