import { planCatalogue, planFeatures, planLimits } from "./catalogue";
import { addDays, isBefore, maxDate, parseDate } from "./dates";
import { coverageSummary } from "./timeline";
import type {
  AccessGrant,
  PlanId,
  SubscriptionTerm,
  TeamAccess,
} from "./types";

export type AccessInput = {
  terms: readonly SubscriptionTerm[];
  grants: readonly AccessGrant[];
  now: Date;
  graceDays: number;
};

function activeGrants(grants: readonly AccessGrant[], now: Date): AccessGrant[] {
  return grants.filter((grant) => {
    if (grant.revokedAt) return false;
    if (isBefore(now, parseDate(grant.startsAt))) return false;
    if (grant.endsAt && !isBefore(now, parseDate(grant.endsAt))) return false;
    return true;
  });
}

function bestGrant(grants: readonly AccessGrant[]): AccessGrant | null {
  if (grants.length === 0) return null;
  return [...grants].sort((a, b) => {
    const rank = planCatalogue(b.planId).rank - planCatalogue(a.planId).rank;
    if (rank !== 0) return rank;
    return parseDate(b.startsAt).getTime() - parseDate(a.startsAt).getTime();
  })[0] ?? null;
}

/**
 * Resolve the effective plan at a point in time. Paid coverage wins, then a
 * grant, then grace on the most recent paid plan, then free. This function is
 * pure and never writes.
 */
export function resolveAccess(input: AccessInput): TeamAccess {
  const { terms, grants, now, graceDays } = input;
  const coverage = coverageSummary(terms, now);
  const paidTerm = coverage.activeTerm;
  const lastEnd = coverage.lastEnd ? parseDate(coverage.lastEnd) : null;

  if (paidTerm) {
    return {
      planId: paidTerm.planId,
      source: "paid",
      status: "active",
      paidThrough: coverage.paidThrough,
      graceEndsAt: lastEnd ? addDays(lastEnd, Math.max(0, graceDays)).toISOString() : null,
      currentTermId: paidTerm.id,
      grantId: null,
      limits: planLimits(paidTerm.planId),
      features: planFeatures(paidTerm.planId),
    };
  }

  const grant = bestGrant(activeGrants(grants, now));
  if (grant) {
    return {
      planId: grant.planId,
      source: "grant",
      status: "active",
      paidThrough: coverage.paidThrough,
      graceEndsAt: null,
      currentTermId: null,
      grantId: grant.id,
      limits: planLimits(grant.planId),
      features: planFeatures(grant.planId),
    };
  }

  if (lastEnd) {
    const graceEnd = addDays(lastEnd, Math.max(0, graceDays));
    if (isBefore(now, graceEnd)) {
      const latestPlan = latestEndedPlan(terms);
      return {
        planId: latestPlan,
        source: "grace",
        status: "grace",
        paidThrough: coverage.paidThrough,
        graceEndsAt: graceEnd.toISOString(),
        currentTermId: null,
        grantId: null,
        limits: planLimits(latestPlan),
        features: planFeatures(latestPlan),
      };
    }

    return {
      planId: "free",
      source: "lapsed",
      status: "lapsed",
      paidThrough: coverage.paidThrough,
      graceEndsAt: graceEnd.toISOString(),
      currentTermId: null,
      grantId: null,
      limits: planLimits("free"),
      features: planFeatures("free"),
    };
  }

  return {
    planId: "free",
    source: "free",
    status: "free",
    paidThrough: null,
    graceEndsAt: null,
    currentTermId: null,
    grantId: null,
    limits: planLimits("free"),
    features: planFeatures("free"),
  };
}

function latestEndedPlan(terms: readonly SubscriptionTerm[]): PlanId {
  const ended = terms
    .filter((term) => term.status !== "cancelled")
    .sort((a, b) => parseDate(b.endsAt).getTime() - parseDate(a.endsAt).getTime());
  return ended[0]?.planId ?? "free";
}

export type LimitName = keyof ReturnType<typeof planLimits>;

export type LimitCheck =
  | { allowed: true; unlimited: boolean; remaining: number | null; limit: null }
  | { allowed: boolean; unlimited: false; remaining: number; limit: number };

/**
 * `null` is unlimited. `0` is a real limit and always blocks.
 */
export function checkLimit(limit: number | null, used: number): LimitCheck {
  if (limit === null) {
    return { allowed: true, unlimited: true, remaining: null, limit: null };
  }
  const remaining = Math.max(0, limit - used);
  return {
    allowed: used < limit,
    unlimited: false,
    remaining,
    limit,
  };
}

export function hasRoom(limit: number | null, used: number): boolean {
  return checkLimit(limit, used).allowed;
}

export function canCreateWithAccess(
  access: TeamAccess,
  limitName: Exclude<LimitName, "backups" | "support" | "watermark" | "siteZipAllowed">,
  used: number,
): boolean {
  return hasRoom(access.limits[limitName], used);
}

export function accessMayWrite(access: TeamAccess): boolean {
  return access.status === "active" || access.status === "free";
}

export function accessIsPaid(access: TeamAccess): boolean {
  return access.source === "paid" || access.source === "grant";
}

export function accessLabel(access: TeamAccess): string {
  switch (access.status) {
    case "active":
      return access.source === "grant" ? "Free access" : "Active";
    case "grace":
      return "Grace period";
    case "lapsed":
      return "Paused";
    default:
      return "Free";
  }
}

export function remainingDays(access: TeamAccess, now: Date): number | null {
  if (access.status === "grace" && access.graceEndsAt) {
    return Math.max(0, Math.ceil((parseDate(access.graceEndsAt).getTime() - now.getTime()) / 86_400_000));
  }
  if (access.paidThrough) {
    return Math.max(0, Math.ceil((parseDate(access.paidThrough).getTime() - now.getTime()) / 86_400_000));
  }
  return null;
}

export function paidThroughDate(access: TeamAccess): Date | null {
  return access.paidThrough ? parseDate(access.paidThrough) : null;
}

export function latestEnd(terms: readonly SubscriptionTerm[]): Date | null {
  return maxDate(terms.map((term) => parseDate(term.endsAt)));
}

