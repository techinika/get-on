import { createHash } from "node:crypto";

export function hashBytes(bytes: Uint8Array, length = 10): string {
  return createHash("sha256").update(bytes).digest("hex").slice(0, length);
}

/** A file name that is safe to use in a web address. */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
