import type { createClient } from "@/lib/supabase/server";
import { buildBackup, loadPackageSource, type PackageProject } from "./content";
import { putPackage } from "./storage";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type CreateBackupOptions = {
  kind: "manual" | "safety";
  messages?: boolean;
  label?: string | null;
  reason?: string | null;
  createdBy: string;
  expiresAt?: Date;
};

export async function createBackup(
  supabase: Supabase,
  project: PackageProject,
  options: CreateBackupOptions,
): Promise<{
  id: string;
  pageCount: number;
  mediaCount: number;
  mediaBytes: number;
  contentHash: string;
}> {
  const id = crypto.randomUUID();
  const key = `backups/${project.id}/${id}.zip`;
  const expiresAt = options.expiresAt ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const { error: insertError } = await supabase.from("backups").insert({
    id,
    project_id: project.id,
    kind: options.kind,
    label: options.label ?? null,
    status: "building",
    pictures_included: true,
    messages_included: options.messages === true,
    reason: options.reason ?? null,
    created_by: options.createdBy,
    expires_at: expiresAt.toISOString(),
    r2_key: key,
  });
  if (insertError) throw new Error("BACKUP_FAILED");

  try {
    const source = await loadPackageSource(supabase, project);
    const result = await buildBackup(supabase, source, {
      pictures: true,
      files: true,
      messages: options.messages === true,
    });
    await putPackage("backups", key, result.bytes, "application/zip");
    const { error } = await supabase
      .from("backups")
      .update({
        status: "ready",
        content_hash: result.manifest.contentHash,
        format_version: result.manifest.formatVersion,
        json_bytes: result.jsonBytes,
        media_count: result.mediaCount,
        media_bytes: result.mediaBytes,
        page_count: result.document.pages.length,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw new Error("BACKUP_FAILED");
    return {
      id,
      pageCount: result.document.pages.length,
      mediaCount: result.mediaCount,
      mediaBytes: result.mediaBytes,
      contentHash: result.manifest.contentHash,
    };
  } catch (error) {
    await supabase.from("backups").update({ status: "failed" }).eq("id", id);
    throw error;
  }
}
