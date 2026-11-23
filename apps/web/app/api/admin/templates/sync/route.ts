import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireStaffAction, StaffError } from "@/lib/admin";
import { isSupabaseConfigured } from "@/lib/supabase/fallback";
import {
  listSystemTemplates,
  syncSystemTemplateCatalog,
} from "@/lib/templates/admin";
import { getLocalTemplateSyncMeta } from "@/lib/templates/local-sync-store";

export const dynamic = "force-dynamic";

function statusForError(error: unknown): number {
  if (error instanceof StaffError) {
    if (error.code === "NOT_STAFF" || error.code === "STAFF_MFA_REQUIRED") {
      return 401;
    }
    if (error.code === "STAFF_NOT_ALLOWED") return 403;
    if (error.code === "TEMPLATE_INVALID") return 400;
  }
  return 500;
}

export async function GET() {
  try {
    await requireStaffAction("template.system.manage");
    const templates = await listSystemTemplates();
    const meta = getLocalTemplateSyncMeta();
    return NextResponse.json({
      ok: true,
      mode: isSupabaseConfigured() ? "supabase" : "local-registry",
      count: templates.length,
      lastSyncedAt: meta.lastSyncedAt,
      templates,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to list templates",
      },
      { status: statusForError(error) },
    );
  }
}

export async function POST() {
  try {
    await requireStaffAction("template.system.manage");
    const result = await syncSystemTemplateCatalog();
    const templates = await listSystemTemplates();
    const meta = getLocalTemplateSyncMeta();
    revalidatePath("/admin/templates");
    return NextResponse.json({
      ok: true,
      mode: isSupabaseConfigured() ? "supabase" : "local-registry",
      ...result,
      lastSyncedAt: meta.lastSyncedAt,
      templates,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to sync templates",
      },
      { status: statusForError(error) },
    );
  }
}
