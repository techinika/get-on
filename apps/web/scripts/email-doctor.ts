import { createAdminClient } from "../lib/supabase/admin";
import { readTransport } from "@get-on/email";

type Check = { name: string; status: "PASS" | "WARN" | "FAIL" | "INFO"; hint?: string; detail?: string };

const checks: Check[] = [];
let failed = 0;

function check(name: string, status: "PASS" | "WARN" | "FAIL" | "INFO", hint?: string, detail?: string) {
  checks.push({ name, status, hint, detail });
  if (status === "FAIL") failed += 1;
}

async function main() {
  const sendTo = process.argv.find((a) => a.startsWith("--send-to="))?.split("=", 2)[1];

  // 1. Configuration validation (variable names only, never values).
  const required = [
    "EMAIL_PROVIDER / EMAIL_TRANSPORT",
    "AWS_REGION",
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "SES_CONFIGURATION_SET_TRANSACTIONAL",
    "SES_CONFIGURATION_SET_BILLING",
    "SES_CONFIGURATION_SET_MARKETING",
    "SES_SNS_TOPIC_ARN",
    "APP_ORIGIN",
  ];
  const missing: string[] = [];
  const envFor = (name: string) =>
    name === "EMAIL_PROVIDER / EMAIL_TRANSPORT"
      ? (process.env.EMAIL_PROVIDER ?? process.env.EMAIL_TRANSPORT)
      : process.env[name.replace(/ \/.*$/, "")];
  for (const name of required) {
    if (!envFor(name)) missing.push(name);
  }
  check(
    "Configuration variables",
    missing.length === 0 ? "PASS" : "FAIL",
    missing.length ? `Set these variables: ${missing.join(", ")}` : undefined,
  );

  // 2. Transport value.
  const transport = readTransport();
  const transportLabel = transport === null ? "auto (SMTP transactional, SES batches)" : transport;
  check(
    "Transport",
    transport === null || transport === "ses" || transport === "smtp" ? "PASS" : "FAIL",
    transport === null
      ? undefined
      : transport === "console" || transport === "memory"
        ? "Transport is dev-only. Set EMAIL_PROVIDER=smtp or ses for real delivery."
        : undefined,
    `readTransport() => ${transportLabel}`,
  );

  // 3. SES credential presence (names only; never log the values).
  const hasCreds = Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.AWS_REGION);
  check(
    "SES credentials",
    hasCreds ? "PASS" : "FAIL",
    !hasCreds
      ? "AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY and AWS_REGION are not all set. Real delivery is impossible without them."
      : undefined,
  );

  if (hasCreds) {
    check(
      "SES production/sandbox",
      "INFO",
      "This build cannot call SES directly. Verify in the AWS console that the account has production access and sending is enabled (see docs/ses-setup.md §4).",
    );
    check(
      "Sender identities",
      "INFO",
      "Verify contact.get-on.tech (and get-on.tech) DKIM/SPF/DMARC and the from identities no-reply@contact.get-on.tech and billing@contact.get-on.tech in SES (see docs/ses-setup.md §1-3).",
    );
    check(
      "Configuration sets",
      "INFO",
      "Create gs-transactional, gs-billing and gs-marketing in SES and subscribe them to the SNS topic used by /api/webhooks/ses (see docs/ses-setup.md §5).",
    );
    check(
      "SNS topic + webhook",
      "INFO",
      "Confirm SES_SNS_TOPIC_ARN matches the live topic and that /api/webhooks/ses receives Delivery/Bounce/Complaint/Reject events (see docs/ses-setup.md §6).",
    );
  } else {
    check("SES production/sandbox", "FAIL", "No SES credentials configured.");
    check("Sender identities", "FAIL", "No SES credentials configured.");
    check("Configuration sets", "FAIL", "No SES credentials configured.");
    check("SNS topic + webhook", "FAIL", "No SES credentials configured.");
  }

  // 4. Outbox health.
  try {
    const admin = createAdminClient();
    const { data: oldest } = await admin
      .from("notification_outbox")
      .select("created_at,status")
      .eq("status", "queued")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    const { count: dead } = await admin
      .from("notification_outbox")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed");
    const { count: sending } = await admin
      .from("notification_outbox")
      .select("id", { count: "exact", head: true })
      .eq("status", "sending");
    let oldestAge: number | null = null;
    let oldestWarn = false;
    if (oldest?.created_at) {
      oldestAge = Date.now() - new Date(String(oldest.created_at)).getTime();
      oldestWarn = oldestAge > 5 * 60 * 1000;
    }
    check(
      "Outbox queue",
      oldestWarn || (dead ?? 0) > 0 ? "WARN" : "PASS",
      oldestWarn
        ? "The oldest queued email is older than 5 minutes. Run pnpm job:notifications or check that the cron Worker is deployed and JOBS_SECRET is correct."
        : undefined,
      `queued=${oldest ? "1" : "0"}, oldestAgeMs=${oldestAge}, failed=${dead ?? 0}, stuckSending=${sending ?? 0}`,
    );
  } catch (error) {
    check("Outbox queue", "FAIL", "Could not query notification_outbox. Is the email outbox migration applied?", String((error as Error).message));
  }

  // 5. Optional real test email.
  if (sendTo) {
    check(
      "Test email",
      "INFO",
      `Would send a traced test email to ${sendTo}. Real SES delivery requires EMAIL_PROVIDER=ses and valid credentials; run against a live environment to verify end to end.`,
    );
  }

  // Summary.
  console.log("\n=== email:doctor ===");
  for (const c of checks) {
    const mark = c.status === "PASS" ? "PASS" : c.status === "WARN" ? "WARN" : c.status === "INFO" ? "INFO" : "FAIL";
    console.log(`[${mark}] ${c.name}`);
    if (c.detail) console.log(`     ${c.detail}`);
    if (c.hint) console.log(`     hint: ${c.hint}`);
  }
  console.log(`\n${failed === 0 ? "All checks passed." : failed + " check(s) failed. See hints above."}\n`);
  process.exitCode = failed === 0 ? 0 : 1;
}

main().catch((error) => {
  console.error("email:doctor failed", error);
  process.exitCode = 1;
});
