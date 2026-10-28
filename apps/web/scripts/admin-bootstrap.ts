import { createAdminClient } from "../lib/supabase/admin";

function readEmail(): string {
  const args = process.argv.slice(2);
  const inline = args.find((arg) => arg.startsWith("--email="));
  const index = args.indexOf("--email");
  const value = inline?.slice("--email=".length) ?? (index >= 0 ? args[index + 1] : "");
  const email = String(value || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    throw new Error("Use --email <address> with a confirmed account.");
  }
  return email;
}

async function main() {
  const email = readEmail();
  const allowAdditional = process.argv.includes("--allow-additional");
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("bootstrap_super_admin", {
    p_email: email,
    p_allow_additional: allowAdditional,
  });
  if (error) {
    if (error.message.includes("USER_NOT_FOUND")) {
      throw new Error(
        `No confirmed account for ${email}. Sign up and confirm the email first.`,
      );
    }
    if (error.message.includes("SUPER_ADMIN_EXISTS")) {
      throw new Error(
        "A super admin already exists. Pass --allow-additional only when you mean to add another.",
      );
    }
    throw error;
  }
  console.log(`[staff] ${email} is now a super admin (${String(data)}).`);
  console.log("[staff] Open /admin/setup-mfa to turn on two-step sign-in.");
}

main().catch((error) => {
  console.error("[staff] bootstrap failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
