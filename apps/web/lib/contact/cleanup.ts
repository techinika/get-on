import { adminOrNull } from "@/lib/email/send";

const SPAM_RETENTION_DAYS = 30;

/** Removes spam messages older than 30 days. Safe to run repeatedly. */
export async function cleanupContactSpam(now = Date.now()): Promise<number> {
  const admin = adminOrNull();
  if (!admin) return 0;
  const before = new Date(now - SPAM_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await admin
    .from("contact_messages")
    .delete()
    .eq("status", "spam")
    .lt("created_at", before)
    .select("id");
  if (error) {
    console.error("[contact] spam cleanup failed", error);
    return 0;
  }
  return data?.length ?? 0;
}
