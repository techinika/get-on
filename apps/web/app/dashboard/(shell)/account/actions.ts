"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { hashIp } from "@/lib/spam";
import {
  checkPasswordPolicy,
  passwordErrorsFromMessage,
  type PasswordErrorCode,
} from "@/lib/security/passwords";
import { getSecuritySettings } from "@/lib/security/settings";

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string; passwordErrors?: PasswordErrorCode[] };

/** Saves the user's full name. */
export async function updateProfile(formData: FormData): Promise<ActionResult> {
  const fullName = String(formData.get("fullName") ?? "").trim();

  if (fullName.length < 2) {
    return { ok: false, error: "Please use at least 2 characters." };
  }
  if (fullName.length > 80) {
    return { ok: false, error: "Please use 80 characters or fewer." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Please sign in again." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName })
    .eq("id", user.id);

  if (error) {
    return { ok: false, error: "We could not save that. Please try again." };
  }

  revalidatePath("/dashboard/account");
  return { ok: true };
}

/** Changes the user's password. */
export async function updatePassword(formData: FormData): Promise<ActionResult> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password !== confirm) {
    return { ok: false, error: "Those passwords do not match." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Please sign in again." };
  }

  const settings = await getSecuritySettings();
  const check = checkPasswordPolicy(password, {
    email: user.email ?? undefined,
    name: typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : undefined,
    minLength: settings.minPasswordLength,
  });
  if (!check.ok) {
    return { ok: false, error: "Please fix the password rules below.", passwordErrors: check.errors };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    const passwordErrors = passwordErrorsFromMessage(error.message);
    if (passwordErrors.length > 0) {
      return { ok: false, error: "Please fix the password rules below.", passwordErrors };
    }
    return { ok: false, error: "We could not change your password. Please try again." };
  }

  return { ok: true };
}

/** Turns marketing email on or off and records the choice. */
export async function updateMarketingConsent(enabled: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Please sign in again." };
  }

  const headerList = await headers();
  const ip =
    headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headerList.get("x-real-ip") ??
    null;
  const { error } = await supabase.rpc("email_preference_set", {
    p_marketing_opt_in: enabled,
    p_source: "account",
    p_ip_hash: enabled ? hashIp(ip) : null,
    p_user_agent: headerList.get("user-agent"),
  });

  if (error) {
    return { ok: false, error: "We could not save that. Please try again." };
  }

  revalidatePath("/dashboard/account");
  return { ok: true };
}
