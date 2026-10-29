import { createAdminClient } from "@/lib/supabase/admin";

export async function rateLimit(key: string, policy: RateLimitPolicy): Promise<RateLimitResult> {
  const admin = createAdminClient();
  const now = Date.now();
  // Read current state.
  const { data } = await admin.from("rate_limits").select("window_start,count,blocked_until").eq("key", key).maybeSingle();
  const state: BucketState | null = data
    ? {
        windowStart: new Date(String(data.window_start)).getTime(),
        count: Number(data.count ?? 0),
        blockedUntil: data.blocked_until ? new Date(String(data.blocked_until)).getTime() : null,
      }
    : null;

  const { state: next, result } = decide(now, state, policy);

  await admin.from("rate_limits").upsert(
    {
      key,
      window_start: new Date(next.windowStart).toISOString(),
      count: next.count,
      blocked_until: next.blockedUntil ? new Date(next.blockedUntil).toISOString() : null,
    },
    { onConflict: "key" },
  );

  return result;
}
export type RateLimitPolicy = {
  limit: number;
  windowSeconds: number;
  blockSeconds?: number;
};

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfter: number;
};

export type BucketState = {
  windowStart: number; // ms
  count: number;
  blockedUntil: number | null; // ms
};

/**
 * Pure decision function for a token-bucket style rate limit.
 * Returns the new bucket state and the decision.
 */
export function decide(
  now: number,
  state: BucketState | null,
  policy: RateLimitPolicy,
): { state: BucketState; result: RateLimitResult } {
  const windowMs = policy.windowSeconds * 1000;
  const blockMs = (policy.blockSeconds ?? policy.windowSeconds) * 1000;

  let s: BucketState;
  if (!state) {
    s = { windowStart: now, count: 0, blockedUntil: null };
  } else if (state.blockedUntil && state.blockedUntil > now) {
    return {
      state,
      result: { ok: false, remaining: 0, retryAfter: Math.ceil((state.blockedUntil - now) / 1000) },
    };
  } else if (now - state.windowStart >= windowMs) {
    s = { windowStart: now, count: 0, blockedUntil: null };
  } else {
    s = { ...state, blockedUntil: state.blockedUntil && state.blockedUntil <= now ? null : state.blockedUntil };
  }

  s.count += 1;
  if (s.count > policy.limit) {
    s.blockedUntil = now + blockMs;
    return {
      state: s,
      result: { ok: false, remaining: 0, retryAfter: Math.ceil(blockMs / 1000) },
    };
  }
  return {
    state: s,
    result: { ok: true, remaining: Math.max(0, policy.limit - s.count), retryAfter: 0 },
  };
}
