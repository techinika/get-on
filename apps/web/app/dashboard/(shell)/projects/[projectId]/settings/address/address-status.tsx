import { Badge } from "@/components/ui/badge";
import type { DomainStatus, HostnameStatus } from "@/lib/domains/types";

const DOMAIN: Record<
  DomainStatus,
  { label: string; variant: "neutral" | "draft" | "live" | "info" | "accent" | "danger" }
> = {
  draft: { label: "Not finished", variant: "neutral" },
  awaiting_txt: { label: "Waiting for verification", variant: "draft" },
  verified: { label: "Verified", variant: "info" },
  connecting: { label: "Connecting", variant: "info" },
  live: { label: "Live", variant: "live" },
  attention: { label: "Needs attention", variant: "draft" },
  stalled: { label: "Not connected yet", variant: "neutral" },
  plan_lapsed: { label: "Paused", variant: "accent" },
  paused: { label: "Paused", variant: "accent" },
  unassigned: { label: "Not used by a website", variant: "neutral" },
  removing: { label: "Removing", variant: "neutral" },
  removed: { label: "Removed", variant: "danger" },
  failed: { label: "Could not connect", variant: "danger" },
};

const HOSTNAME: Record<
  HostnameStatus,
  { label: string; variant: "neutral" | "draft" | "live" | "info" | "danger" }
> = {
  pending: { label: "Waiting for the connection record", variant: "draft" },
  preparing: { label: "Preparing", variant: "info" },
  ready_to_switch: { label: "Ready to switch", variant: "live" },
  active: { label: "Almost live", variant: "info" },
  live: { label: "Live", variant: "live" },
  moved: { label: "Record changed", variant: "draft" },
  blocked: { label: "Blocked", variant: "danger" },
  error: { label: "Problem", variant: "danger" },
  removing: { label: "Removing", variant: "neutral" },
  removed: { label: "Removed", variant: "neutral" },
};

export function DomainStatusBadge({ status }: { status: DomainStatus }) {
  const item = DOMAIN[status];
  return (
    <Badge variant={item.variant} dot={status === "live"}>
      {item.label}
    </Badge>
  );
}

export function HostnameStatusBadge({ status }: { status: HostnameStatus }) {
  const item = HOSTNAME[status];
  return (
    <Badge variant={item.variant} dot={status === "live"}>
      {item.label}
    </Badge>
  );
}
