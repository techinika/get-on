import { createAdminClient } from "@/lib/supabase/admin";

export type EmailTransport = "ses" | "smtp" | "console" | "memory";

export type EmailSettings = {
  email_provider: EmailTransport;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_secure: boolean | null;
  smtp_user: string | null;
  smtp_from: string | null;
  smtp_name: string | null;
};

export async function getEmailSettings(): Promise<EmailSettings> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("email_settings")
    .select(
      "email_provider, smtp_host, smtp_port, smtp_secure, smtp_user, smtp_from, smtp_name",
    )
    .eq("id", true)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return {
    email_provider: (data?.email_provider ?? "console") as EmailTransport,
    smtp_host: data?.smtp_host ?? null,
    smtp_port: data?.smtp_port ?? 587,
    smtp_secure: data?.smtp_secure ?? false,
    smtp_user: data?.smtp_user ?? null,
    smtp_from: data?.smtp_from ?? null,
    smtp_name: data?.smtp_name ?? "Get-On",
  };
}

export async function setEmailProvider(provider: EmailTransport): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.rpc("admin_set_email_provider", {
    p_provider: provider,
  });
  if (error) throw new Error(error.message);
}

export async function setSmtpSettings(input: {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  from: string;
  name: string;
}): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.rpc("admin_set_smtp_settings", {
    p_host: input.host.trim(),
    p_port: input.port,
    p_secure: input.secure,
    p_user: input.user.trim(),
    p_from: input.from.trim(),
    p_name: input.name.trim(),
  });
  if (error) throw new Error(error.message);
}
