import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type QuotaUsage = {
  active_sites: number;
  deleted_pending: number;
  max_websites: number | null;
  max_members: number | null;
  max_deleted_pending: number;
};

export const getQuota = cache(async (teamId: string): Promise<QuotaUsage | null> => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("team_quota_usage", { p_team: teamId });
  if (!data || typeof data !== "object") return null;
  return data as QuotaUsage;
});
