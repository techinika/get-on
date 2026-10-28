"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaffAction } from "@/lib/admin";
import { syncSystemTemplateCatalog } from "@/lib/templates/admin";

function message(error: unknown): string {
  const text = error instanceof Error ? error.message : "";
  if (text.includes("TEMPLATE_INVALID")) return text;
  if (text.includes("STAFF_NOT_ALLOWED")) {
    return "You do not have permission to change system templates.";
  }
  return "We could not save every template. Try syncing again.";
}

export async function syncTemplatesAction() {
  await requireStaffAction("template.system.manage");

  let notice: string;
  try {
    const result = await syncSystemTemplateCatalog();
    revalidatePath("/admin/templates");
    notice = `saved=${encodeURIComponent(
      result.imported === 0
        ? "Templates are already up to date."
        : `${result.imported} template version${
            result.imported === 1 ? "" : "s"
          } imported as a draft.`,
    )}`;
  } catch (error) {
    notice = `error=${encodeURIComponent(message(error))}`;
  }

  redirect(`/admin/templates?${notice}`);
}
