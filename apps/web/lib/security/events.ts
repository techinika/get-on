import { createAdminClient } from "@/lib/supabase/admin";

export type SecurityCategory = "auth" | "second_factor" | "password" | "email" | "session" | "account" | "abuse";
export type SecuritySeverity = "info" | "notice" | "warning" | "critical";

export type SecurityEventInput = {
  userId?: string | null;
  teamId?: string | null;
  category: SecurityCategory;
  event: string;
  severity: SecuritySeverity;
  summary: string;
  ipHash?: string | null;
  uaFamily?: string | null;
  country?: string | null;
  meta?: Record<string, unknown>;
  visibleToUser?: boolean;
};

/**
 * Append-only security log. Never pass codes, tokens, passwords or full email
 * addresses in `summary` or `meta`. Logging must never break the request, so
 * failures are swallowed after a console warning.
 */
export async function recordSecurityEvent(input: SecurityEventInput): Promise<void> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("security_events").insert({
      user_id: input.userId ?? null,
      team_id: input.teamId ?? null,
      category: input.category,
      event: input.event,
      severity: input.severity,
      summary: input.summary.slice(0, 200),
      ip_hash: input.ipHash ?? null,
      ua_family: input.uaFamily ?? null,
      country: input.country ?? null,
      meta: input.meta ?? {},
      visible_to_user: input.visibleToUser ?? false,
    });
    if (error) console.warn("[security] event not recorded:", error.message);
  } catch (error) {
    console.warn("[security] event not recorded:", (error as Error)?.message ?? error);
  }
}
