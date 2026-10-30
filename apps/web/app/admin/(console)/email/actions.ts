"use server";

import { revalidatePath } from "next/cache";
import { StaffError, requireStaffAction } from "@/lib/admin/staff";
import { createAdminClient } from "@/lib/supabase/admin";

export type EmailSettingsActionResult =
  | { ok: true }
  | { ok: false; error: string };

export async function saveEmailProvider(input: {
  provider: string;
  smtp?: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    from: string;
    name: string;
  };
}): Promise<EmailSettingsActionResult> {
  const provider = input.provider.trim();
  const allowed = ["ses", "smtp", "console", "memory"];
  if (!allowed.includes(provider)) {
    return { ok: false, error: "Choose a valid email provider." };
  }

  try {
    await requireStaffAction("platform.settings");
    const supabase = createAdminClient();

    const { error } = await supabase.rpc("admin_set_email_provider", {
      p_provider: provider,
    });
    if (error) {
      console.error("admin_set_email_provider failed", error);
      return { ok: false, error: "We could not save the email provider." };
    }

    if (provider === "smtp" && input.smtp) {
      const { error: smtpError } = await supabase.rpc("admin_set_smtp_settings", {
        p_host: input.smtp.host.trim(),
        p_port: input.smtp.port,
        p_secure: input.smtp.secure,
        p_user: input.smtp.user.trim(),
        p_from: input.smtp.from.trim(),
        p_name: input.smtp.name.trim(),
      });
      if (smtpError) {
        console.error("admin_set_smtp_settings failed", smtpError);
        return { ok: false, error: "We could not save the SMTP settings." };
      }
    }

    revalidatePath("/admin/email");
    return { ok: true };
  } catch (error) {
    if (error instanceof StaffError) {
      return { ok: false, error: "You do not have permission to change email settings." };
    }
    console.error("saveEmailProvider failed", error);
    return { ok: false, error: "We could not save the email settings." };
  }
}
