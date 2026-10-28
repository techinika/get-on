import { adminAlertEmail } from "@get-on/email";
import { sendEmail } from "../../lib/email/send";
import { createAdminClient } from "../../lib/supabase/admin";

type WeeklyData = {
  week_start?: string;
  new_teams?: number;
  new_websites?: number;
  published?: number;
  revenue_cents?: number;
  support_opened?: number;
  support_closed?: number;
  marketing_sent?: number;
  email_failed?: number;
};

function reportText(data: WeeklyData): string {
  return [
    `New teams: ${data.new_teams ?? 0}`,
    `New websites: ${data.new_websites ?? 0}`,
    `Published changes: ${data.published ?? 0}`,
    `Payments: $${((data.revenue_cents ?? 0) / 100).toFixed(2)}`,
    `Support opened: ${data.support_opened ?? 0}`,
    `Support closed: ${data.support_closed ?? 0}`,
    `Marketing emails sent: ${data.marketing_sent ?? 0}`,
    `Failed emails: ${data.email_failed ?? 0}`,
  ].join("\n");
}

async function main() {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("weekly_report");
  if (error) throw error;
  const report = (data ?? {}) as WeeklyData;
  if (!report.week_start) throw new Error("Weekly report did not return a week.");

  const { data: existing, error: readError } = await admin
    .from("weekly_reports")
    .select("emailed_at")
    .eq("week_start", report.week_start)
    .maybeSingle();
  if (readError) throw readError;
  if (existing?.emailed_at) {
    console.log(`[weekly] week=${report.week_start} already sent`);
    return;
  }

  const { data: staff, error: staffError } = await admin
    .from("platform_staff")
    .select("user_id,email")
    .eq("role", "super_admin")
    .eq("status", "active");
  if (staffError) throw staffError;

  let sent = 0;
  for (const member of staff ?? []) {
    let email = member.email?.trim();
    if (!email) {
      const { data: user } = await admin.auth.admin.getUserById(member.user_id);
      email = user.user?.email ?? undefined;
    }
    if (!email) continue;
    const message = adminAlertEmail({
      title: `Weekly report for ${report.week_start}`,
      message: reportText(report),
    });
    const result = await sendEmail({
      to: email,
      kind: "admin_weekly_report",
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
    if (result.status === "sent") sent += 1;
  }

  if (sent > 0) {
    await admin
      .from("weekly_reports")
      .update({ emailed_at: new Date().toISOString() })
      .eq("week_start", report.week_start);
  }
  console.log(`[weekly] week=${report.week_start} sent=${sent}`);
}

main().catch((error) => {
  console.error("[weekly] job failed", error);
  process.exitCode = 1;
});
