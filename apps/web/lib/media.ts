import env from "@/lib/env";

export const MEDIA_BUCKET = "project-media";

/** Public URL for a file stored in the project media bucket. */
export function publicMediaUrl(path: string | null | undefined): string {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${env.supabaseUrl}/storage/v1/object/public/${MEDIA_BUCKET}/${path}`;
}

/** Human readable file size, for example "1.4 MB". */
export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "0 KB";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
