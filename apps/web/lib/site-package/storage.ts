import { createAdminClient } from "@/lib/supabase/admin";

export type PackageBucket = "backups" | "exports" | "imports";

function bucketName(kind: PackageBucket): string {
  if (kind === "backups") return process.env.BACKUP_BUCKET ?? "project-backups";
  if (kind === "imports") return process.env.IMPORT_BUCKET ?? "project-imports";
  return process.env.EXPORT_BUCKET ?? "project-exports";
}

function arrayBufferOf(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export async function putPackage(
  kind: PackageBucket,
  key: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.storage
    .from(bucketName(kind))
    .upload(key, arrayBufferOf(bytes), { contentType, upsert: false });
  if (error) throw new Error("PACKAGE_WRITE_FAILED");
}

export async function readPackage(kind: PackageBucket, key: string): Promise<Uint8Array> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(bucketName(kind)).download(key);
  if (error || !data) throw new Error("PACKAGE_READ_FAILED");
  return new Uint8Array(await data.arrayBuffer());
}

export async function deletePackage(kind: PackageBucket, key: string): Promise<void> {
  const admin = createAdminClient();
  await admin.storage.from(bucketName(kind)).remove([key]);
}
