"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

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

  if (password.length < 8) {
    return { ok: false, error: "Please use at least 8 characters." };
  }
  if (password !== confirm) {
    return { ok: false, error: "Those passwords do not match." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { ok: false, error: "We could not change your password. Please try again." };
  }

  return { ok: true };
}
