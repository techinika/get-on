import type { DnsRecord } from "./types";

export const VERIFICATION_LABEL = "_geton-verify";
export const CAA_ISSUERS = ["pki.goog", "letsencrypt.org", "ssl.com"] as const;

export function verificationName(registrable: string): string {
  return `${VERIFICATION_LABEL}.${registrable}`;
}

export function verificationValue(token: string): string {
  return token.startsWith("geton-verify=") ? token : `geton-verify=${token}`;
}

export function relativeName(hostname: string, registrable: string): string {
  if (hostname === registrable) return "@";
  if (hostname.endsWith(`.${registrable}`)) {
    return hostname.slice(0, -(registrable.length + 1));
  }
  return hostname;
}

export function verificationRecord(
  registrable: string,
  token: string,
): DnsRecord {
  return {
    type: "TXT",
    name: verificationName(registrable),
    value: verificationValue(token),
  };
}

export function cnameRecord(
  hostname: string,
  registrable: string,
  target: string,
): DnsRecord {
  return {
    type: "CNAME",
    name: relativeName(hostname, registrable),
    value: target,
  };
}

export function caaRecords(hostname: string): DnsRecord[] {
  return CAA_ISSUERS.map((issuer) => ({
    type: "CAA",
    name: relativeName(hostname, hostname),
    value: `0 issue "${issuer}"`,
  }));
}

export function recordFullName(record: DnsRecord, registrable: string): string {
  if (record.name === "@") return registrable;
  return `${record.name}.${registrable}`;
}
