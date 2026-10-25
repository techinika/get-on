import type { DnsResolver } from "./dns";
import { CAA_ISSUERS } from "./records";
import type { DnsRecord } from "./types";

export type CaaCheck = {
  found: boolean;
  blocking: boolean;
  records: DnsRecord[];
  suggested: DnsRecord[];
  source: string | null;
};

type CaaTag = { tag: string; value: string };

function parseTag(value: string): CaaTag | null {
  const match = value.match(/^\s*\d+\s+(issue|issuewild|iodef)\s+"([^"]*)"\s*$/i);
  if (!match) return null;
  return { tag: match[1]!.toLowerCase(), value: match[2]!.trim() };
}

function allowsUs(value: string): boolean {
  const issuer = value.split(";")[0]!.trim().toLowerCase().replace(/\.$/, "");
  if (!issuer) return false;
  return CAA_ISSUERS.some(
    (allowed) => issuer === allowed || issuer.endsWith(`.${allowed}`),
  );
}

function suggestedRecords(
  source: string,
  registrable: string,
): DnsRecord[] {
  const name =
    source === registrable
      ? "@"
      : source.endsWith(`.${registrable}`)
        ? source.slice(0, -(registrable.length + 1))
        : "@";
  return CAA_ISSUERS.map((issuer) => ({
    type: "CAA",
    name,
    value: `0 issue "${issuer}"`,
  }));
}

export function evaluateCaa(
  records: DnsRecord[],
  source: string,
  registrable: string,
): CaaCheck {
  const tags = records
    .filter((record) => record.type === "CAA")
    .map((record) => parseTag(record.value))
    .filter((tag): tag is CaaTag => tag != null);
  const issues = tags.filter(
    (tag) => tag.tag === "issue" || tag.tag === "issuewild",
  );
  const blocking =
    issues.length > 0 && !issues.some((tag) => allowsUs(tag.value));
  return {
    found: records.some((record) => record.type === "CAA"),
    blocking,
    records: records.filter((record) => record.type === "CAA"),
    suggested: blocking ? suggestedRecords(source, registrable) : [],
    source,
  };
}

/**
 * Checks CAA at the hostname and its parents. A CNAME is followed so a
 * customer's CAA records cannot silently block our certificate authority.
 */
export type HostnameDnsCheck = {
  hostname: string;
  cname: string | null;
  wrongCname: boolean;
  conflicts: string[];
};

function normalizeHost(value: string): string {
  return value.toLowerCase().replace(/\.$/, "");
}

export async function checkHostnameDns(
  resolver: DnsResolver,
  hostname: string,
  target: string,
): Promise<HostnameDnsCheck> {
  const empty = { status: "ok" as const, records: [] };
  const [cnameAnswer, aAnswer, aaaaAnswer] = await Promise.all([
    resolver.lookup(hostname, "CNAME").catch(() => empty),
    resolver.lookup(hostname, "A").catch(() => empty),
    resolver.lookup(hostname, "AAAA").catch(() => empty),
  ]);
  const cname =
    cnameAnswer.records.find((record) => record.type === "CNAME")?.value ?? null;
  const normalized = cname ? normalizeHost(cname) : null;
  const conflicts = normalized
    ? []
    : [...aAnswer.records, ...aaaaAnswer.records]
        .filter((record) => record.type === "A" || record.type === "AAAA")
        .map((record) => record.value);

  return {
    hostname,
    cname: normalized,
    wrongCname:
      normalized != null &&
      target.trim() !== "" &&
      normalized !== normalizeHost(target),
    conflicts,
  };
}

export async function checkCaaRecords(
  resolver: DnsResolver,
  hostname: string,
  registrable: string,
): Promise<CaaCheck> {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  const root = registrable.toLowerCase().replace(/\.$/, "");
  const hostLabels = host.split(".");
  const rootLabels = root.split(".");
  const depth = Math.max(0, hostLabels.length - rootLabels.length);

  for (let index = 0; index <= depth; index += 1) {
    const name = hostLabels.slice(index).join(".");
    const answer = await resolver.lookup(name, "CAA").catch(() => null);
    if (!answer) continue;

    const caa = answer.records.filter((record) => record.type === "CAA");
    if (caa.length > 0) return evaluateCaa(caa, name, root);

    const cname = answer.records.find((record) => record.type === "CNAME");
    if (!cname) continue;
    const target = cname.value.toLowerCase().replace(/\.$/, "");
    const targetAnswer = await resolver
      .lookup(target, "CAA")
      .catch(() => null);
    const targetCaa =
      targetAnswer?.records.filter((record) => record.type === "CAA") ?? [];
    if (targetCaa.length > 0) {
      return evaluateCaa(targetCaa, target, root);
    }
  }

  return {
    found: false,
    blocking: false,
    records: [],
    suggested: [],
    source: null,
  };
}
