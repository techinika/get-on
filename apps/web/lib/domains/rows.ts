import type {
  Domain,
  DomainHostname,
  DomainRole,
  DomainStatus,
  DnsRecord,
  HostnameMode,
  HostnameRole,
  HostnameStatus,
  RegistrarInfo,
  ReviewState,
} from "./types";

export const DOMAIN_COLUMNS =
  "id, team_id, project_id, registrable, display_name, role, status, status_reason, verification_value, verification_started_at, verification_expires_at, verified_at, reverify_after, review_state, registrar, dns_provider_hint, last_checked_at, created_at, removed_at";

export const HOSTNAME_COLUMNS =
  "id, domain_id, project_id, hostname, label, role, mode, status, status_reason, provider_id, provider_status, ssl_status, verification_errors, ownership_txt, validation_txt, cname_target, cname_seen, cname_checked_at, waiting_since, next_poll_at, poll_attempts, live_at, attention_since, health_failures, last_health_at, created_at, removed_at";

type Row = Record<string, unknown>;

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function nullableText(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function record(value: unknown): Row {
  return value && typeof value === "object" ? (value as Row) : {};
}

function recordOrNull(value: unknown): DnsRecord | null {
  const row = record(value);
  if (typeof row.type !== "string" || typeof row.name !== "string") return null;
  if (typeof row.value !== "string") return null;
  return {
    type: row.type as DnsRecord["type"],
    name: row.name,
    value: row.value,
    ...(typeof row.ttl === "number" ? { ttl: row.ttl } : {}),
  };
}

function registrar(value: unknown): RegistrarInfo {
  const row = record(value);
  return {
    ...(typeof row.name === "string" ? { name: row.name } : {}),
    ...(typeof row.expiresAt === "string" ? { expiresAt: row.expiresAt } : {}),
    ...(Array.isArray(row.nameservers)
      ? {
          nameservers: row.nameservers.filter(
            (item): item is string => typeof item === "string",
          ),
        }
      : {}),
    ...(Array.isArray(row.status)
      ? {
          status: row.status.filter(
            (item): item is string => typeof item === "string",
          ),
        }
      : {}),
  };
}

export function asDomain(value: unknown): Domain {
  const row = record(value);
  return {
    id: text(row.id),
    teamId: text(row.team_id),
    projectId: nullableText(row.project_id),
    registrable: text(row.registrable),
    displayName: text(row.display_name),
    role: text(row.role, "primary") as DomainRole,
    status: text(row.status, "draft") as DomainStatus,
    statusReason: nullableText(row.status_reason),
    verificationValue: text(row.verification_value),
    verificationStartedAt: text(row.verification_started_at),
    verificationExpiresAt: text(row.verification_expires_at),
    verifiedAt: nullableText(row.verified_at),
    reverifyAfter: nullableText(row.reverify_after),
    reviewState: text(row.review_state, "none") as ReviewState,
    registrar: registrar(row.registrar),
    dnsProviderHint: nullableText(row.dns_provider_hint),
    lastCheckedAt: nullableText(row.last_checked_at),
    createdAt: text(row.created_at),
    removedAt: nullableText(row.removed_at),
  };
}

export function asHostname(value: unknown): DomainHostname {
  const row = record(value);
  return {
    id: text(row.id),
    domainId: text(row.domain_id),
    projectId: nullableText(row.project_id),
    hostname: text(row.hostname),
    label: text(row.label),
    role: text(row.role, "main") as HostnameRole,
    mode: text(row.mode, "switch_now") as HostnameMode,
    status: text(row.status, "pending") as HostnameStatus,
    statusReason: nullableText(row.status_reason),
    providerId: nullableText(row.provider_id),
    providerStatus: nullableText(row.provider_status),
    sslStatus: nullableText(row.ssl_status),
    verificationErrors: Array.isArray(row.verification_errors)
      ? row.verification_errors.filter(
          (item): item is string => typeof item === "string",
        )
      : [],
    ownershipTxt: recordOrNull(row.ownership_txt),
    validationTxt: recordOrNull(row.validation_txt),
    cnameTarget: text(row.cname_target),
    cnameSeen: row.cname_seen === true,
    cnameCheckedAt: nullableText(row.cname_checked_at),
    waitingSince: text(row.waiting_since),
    nextPollAt: nullableText(row.next_poll_at),
    pollAttempts: Number(row.poll_attempts ?? 0),
    liveAt: nullableText(row.live_at),
    attentionSince: nullableText(row.attention_since),
    healthFailures: Number(row.health_failures ?? 0),
    lastHealthAt: nullableText(row.last_health_at),
    createdAt: text(row.created_at),
    removedAt: nullableText(row.removed_at),
  };
}

export function hostnameStatusFromProvider(
  mode: HostnameMode,
  status: string,
  sslStatus: string,
): Exclude<HostnameStatus, "removed"> {
  const provider = status.toLowerCase();
  const ssl = sslStatus.toLowerCase();
  if (provider === "moved") return "moved";
  if (provider === "blocked") return "blocked";
  if (provider === "deleted") return "error";
  if (ssl === "active") {
    return mode === "prepare_first" ? "ready_to_switch" : "active";
  }
  if (mode === "prepare_first") return "preparing";
  if (provider === "active" || provider === "pending" || provider === "preparing") {
    return provider === "pending" ? "pending" : "preparing";
  }
  return "error";
}
