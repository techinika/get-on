export const DOMAIN_STATUSES = [
  "draft",
  "awaiting_txt",
  "verified",
  "connecting",
  "live",
  "attention",
  "stalled",
  "plan_lapsed",
  "paused",
  "unassigned",
  "removing",
  "removed",
  "failed",
] as const;

export type DomainStatus = (typeof DOMAIN_STATUSES)[number];

export const HOSTNAME_STATUSES = [
  "pending",
  "preparing",
  "ready_to_switch",
  "active",
  "live",
  "moved",
  "blocked",
  "error",
  "removing",
  "removed",
] as const;

export type HostnameStatus = (typeof HOSTNAME_STATUSES)[number];

export type DomainRole = "primary" | "alias";
export type HostnameRole = "main" | "extra";
export type HostnameMode = "switch_now" | "prepare_first";
export type ReviewState = "none" | "pending" | "approved" | "rejected";

export type Domain = {
  id: string;
  teamId: string;
  projectId: string | null;
  registrable: string;
  displayName: string;
  role: DomainRole;
  status: DomainStatus;
  statusReason: string | null;
  verificationValue: string;
  verificationStartedAt: string;
  verificationExpiresAt: string;
  verifiedAt: string | null;
  reverifyAfter: string | null;
  reviewState: ReviewState;
  registrar: RegistrarInfo;
  dnsProviderHint: string | null;
  lastCheckedAt: string | null;
  createdAt: string;
  removedAt: string | null;
};

export type DomainHostname = {
  id: string;
  domainId: string;
  projectId: string | null;
  hostname: string;
  label: string;
  role: HostnameRole;
  mode: HostnameMode;
  status: HostnameStatus;
  statusReason: string | null;
  providerId: string | null;
  providerStatus: string | null;
  sslStatus: string | null;
  verificationErrors: string[];
  ownershipTxt: DnsRecord | null;
  validationTxt: DnsRecord | null;
  cnameTarget: string;
  cnameSeen: boolean;
  cnameCheckedAt: string | null;
  waitingSince: string;
  nextPollAt: string | null;
  pollAttempts: number;
  liveAt: string | null;
  attentionSince: string | null;
  healthFailures: number;
  lastHealthAt: string | null;
  createdAt: string;
  removedAt: string | null;
};

export type RegistrarInfo = {
  name?: string;
  expiresAt?: string;
  nameservers?: string[];
  status?: string[];
};

export type DnsRecordType = "TXT" | "CNAME" | "A" | "AAAA" | "CAA" | "NS";

export type DnsRecord = {
  type: DnsRecordType;
  name: string;
  value: string;
  ttl?: number;
};

export type ProviderHostname = {
  id: string;
  hostname: string;
  mode: HostnameMode;
  status: string;
  sslStatus: string;
  ownershipTxt: DnsRecord | null;
  validationTxt: DnsRecord | null;
  verificationErrors: string[];
  rawStatus?: string;
};

export type ProviderSetup = {
  ok: boolean;
  problems: string[];
};

export type ProviderUsage = {
  total: number;
  pending: number;
  included: number;
  maximum: number;
};

export type ProviderPage = {
  hostnames: ProviderHostname[];
  page: number;
  totalPages: number;
};
