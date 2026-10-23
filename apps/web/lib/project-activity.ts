import { createClient } from "@/lib/supabase/server";
import { invalidateQuickFindCache } from "@/lib/quick-find-cache";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Mark a website as edited. The website card shows "Edited {relative time}",
 * so the project timestamp has to move when one of its pages changes.
 */
export async function touchProject(supabase: Supabase, projectId: string): Promise<void> {
  await supabase
    .from("projects")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", projectId);
}

/**
 * Drop the cached quick find results for a team. Called after a website or a
 * page is created, changed or deleted, so the next search shows the new list.
 */
export function invalidateQuickFind(teamId: string): void {
  invalidateQuickFindCache(teamId);
}
