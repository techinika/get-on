"use server";

import { revalidatePath } from "next/cache";
import { StaffError, requireStaffAction } from "@/lib/admin/staff";
import {
  setEmailProvider,
  setSmtpSettings,
  type EmailTransport,
} from "@/lib/platform/email-settings";

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
  const allowed = ["auto", "resend", "ses", "smtp", "console", "memory"];
  if (!allowed.includes(provider)) {
    return { ok: false, error: "Choose a valid email provider." };
  }

  try {
    await requireStaffAction("platform.settings");

    try {
      await setEmailProvider(provider as EmailTransport);
    } catch (error) {
      console.error("admin_set_email_provider failed", error);
      return { ok: false, error: "We could not save the email provider." };
    }

    if (provider === "smtp" && input.smtp) {
      try {
        await setSmtpSettings(input.smtp);
      } catch (error) {
        console.error("admin_set_smtp_settings failed", error);
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
