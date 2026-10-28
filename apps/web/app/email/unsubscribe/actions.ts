"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isUnsubscribeToken } from "@/lib/email/unsubscribe";

export async function unsubscribeFromMarketing(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  if (!isUnsubscribeToken(token)) {
    redirect("/email/unsubscribe?error=invalid");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("email_unsubscribe", { p_token: token });
  if (error || data !== true) {
    redirect("/email/unsubscribe?error=invalid");
  }

  redirect("/email/unsubscribe?done=1");
}
