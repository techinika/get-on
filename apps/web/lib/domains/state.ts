import type { DomainStatus, HostnameStatus } from "./types";

const DOMAIN_NEXT: Record<DomainStatus, readonly DomainStatus[]> = {
  draft: ["awaiting_txt", "verified", "failed", "removing"],
  awaiting_txt: ["draft", "verified", "failed", "removing"],
  verified: ["connecting", "unassigned", "removing"],
  connecting: ["live", "attention", "stalled", "verified", "removing"],
  live: ["attention", "plan_lapsed", "paused", "unassigned", "removing"],
  attention: ["live", "connecting", "stalled", "plan_lapsed", "paused", "unassigned", "removing"],
  stalled: ["live", "attention", "plan_lapsed", "paused", "unassigned", "removing"],
  plan_lapsed: ["live", "connecting", "attention", "stalled", "paused", "verified", "unassigned", "removing"],
  paused: ["live", "connecting", "attention", "stalled", "plan_lapsed", "verified", "unassigned", "removing"],
  unassigned: ["verified", "connecting", "removing"],
  removing: ["removed", "failed"],
  removed: [],
  failed: ["removing"],
};

const HOSTNAME_NEXT: Record<HostnameStatus, readonly HostnameStatus[]> = {
  pending: ["preparing", "active", "live", "moved", "blocked", "error", "removing"],
  preparing: ["ready_to_switch", "active", "live", "moved", "blocked", "error", "removing"],
  ready_to_switch: ["active", "live", "moved", "blocked", "error", "removing"],
  active: ["live", "moved", "blocked", "error", "removing"],
  live: ["moved", "blocked", "error", "removing"],
  moved: ["active", "live", "blocked", "error", "removing"],
  blocked: ["pending", "active", "live", "error", "removing"],
  error: ["pending", "active", "live", "moved", "blocked", "removing"],
  removing: ["removed"],
  removed: [],
};

export function canTransitionDomain(
  from: DomainStatus,
  to: DomainStatus,
): boolean {
  return from === to || DOMAIN_NEXT[from].includes(to);
}

export function canTransitionHostname(
  from: HostnameStatus,
  to: HostnameStatus,
): boolean {
  return from === to || HOSTNAME_NEXT[from].includes(to);
}

export function assertDomainTransition(
  from: DomainStatus,
  to: DomainStatus,
): void {
  if (!canTransitionDomain(from, to)) {
    throw new Error(`DOMAIN_TRANSITION_INVALID:${from}->${to}`);
  }
}

export function assertHostnameTransition(
  from: HostnameStatus,
  to: HostnameStatus,
): void {
  if (!canTransitionHostname(from, to)) {
    throw new Error(`HOSTNAME_TRANSITION_INVALID:${from}->${to}`);
  }
}

export function isTerminalDomain(status: DomainStatus): boolean {
  return status === "removed" || status === "failed";
}

export function isTerminalHostname(status: HostnameStatus): boolean {
  return status === "removed";
}

export function isLiveHostname(status: HostnameStatus): boolean {
  return status === "live";
}

export function isWaitingDomain(status: DomainStatus): boolean {
  return status === "draft" || status === "awaiting_txt" || status === "connecting" || status === "stalled";
}

export function isProblemDomain(status: DomainStatus): boolean {
  return status === "attention" || status === "stalled";
}

/** A domain is live when its main address is live. */
export function domainStatusFromHostnames(
  current: DomainStatus,
  hostnames: readonly { role: string; status: HostnameStatus }[],
): DomainStatus {
  if (current === "removing" || current === "removed" || current === "failed") {
    return current;
  }
  if (current === "plan_lapsed" || current === "paused") return current;
  if (hostnames.some((hostname) => hostname.role === "main" && hostname.status === "live")) {
    return "live";
  }
  if (hostnames.some((hostname) => hostname.status === "error" || hostname.status === "blocked")) {
    return "attention";
  }
  if (hostnames.some((hostname) => hostname.status === "moved")) {
    return "attention";
  }
  if (hostnames.length > 0) return "connecting";
  if (current === "live") return "connecting";
  return current;
}
