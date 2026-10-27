import {
  MAX_ARCHIVE_ENTRIES,
  MAX_ARCHIVE_UNCOMPRESSED_BYTES,
  MAX_MEDIA_BYTES,
  SitePackageError,
} from "./format";
import { sha256Hex } from "./hash";

export type ArchiveEntry = {
  path: string;
  bytes: Uint8Array;
};

export function validateArchivePath(value: string): string {
  const path = value.trim();
  if (!path || path.length > 300) throw new SitePackageError("IMPORT_NOT_VALID");
  if (path.startsWith("/") || path.startsWith("\\")) {
    throw new SitePackageError("IMPORT_NOT_VALID");
  }
  if (path.includes("\\") || path.includes("\0") || path.includes("\r") || path.includes("\n")) {
    throw new SitePackageError("IMPORT_NOT_VALID");
  }
  if (path.split("/").some((part) => part === "" || part === "." || part === "..")) {
    throw new SitePackageError("IMPORT_NOT_VALID");
  }
  if (/^[a-zA-Z]:/.test(path)) throw new SitePackageError("IMPORT_NOT_VALID");
  return path;
}

export function assertArchiveEntries(entries: ArchiveEntry[]): void {
  if (entries.length > MAX_ARCHIVE_ENTRIES) {
    throw new SitePackageError("IMPORT_NOT_VALID", "The archive has too many files.");
  }
  const seen = new Set<string>();
  let total = 0;
  for (const entry of entries) {
    const path = validateArchivePath(entry.path);
    const key = path.toLowerCase();
    if (seen.has(key)) throw new SitePackageError("IMPORT_NOT_VALID", "The archive has duplicate files.");
    seen.add(key);
    total += entry.bytes.byteLength;
    if (entry.bytes.byteLength > MAX_MEDIA_BYTES && !path.endsWith(".json") && !path.endsWith(".txt")) {
      throw new SitePackageError("IMPORT_NOT_VALID", "A file in the archive is too big.");
    }
    if (total > MAX_ARCHIVE_UNCOMPRESSED_BYTES) {
      throw new SitePackageError("IMPORT_NOT_VALID", "The archive is too big.");
    }
  }
}

export function checksumsFor(entries: ArchiveEntry[]): string {
  return [...entries]
    .sort((left, right) => left.path.localeCompare(right.path))
    .map((entry) => `${sha256Hex(entry.bytes)}  ${entry.path}`)
    .join("\n")
    .concat("\n");
}

export function parseChecksums(value: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of value.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const match = /^([a-f0-9]{64})\s{2}(.+)$/.exec(line);
    if (!match) throw new SitePackageError("IMPORT_NOT_VALID");
    map.set(validateArchivePath(match[2]!), match[1]!);
  }
  return map;
}

export function verifyChecksums(entries: ArchiveEntry[], checksums: string): void {
  const expected = parseChecksums(checksums);
  if (expected.size !== entries.length) throw new SitePackageError("IMPORT_NOT_VALID");
  for (const entry of entries) {
    const path = validateArchivePath(entry.path);
    if (expected.get(path) !== sha256Hex(entry.bytes)) {
      throw new SitePackageError("IMPORT_NOT_VALID");
    }
  }
}

export function isPdf(bytes: Uint8Array): boolean {
  return (
    bytes.byteLength >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  );
}

export function isAllowedImageMime(mime: string): boolean {
  return mime === "image/webp" || mime === "image/png" || mime === "image/jpeg";
}

export function isSafeMediaPath(path: string): boolean {
  try {
    validateArchivePath(path);
    return /^media\/files\/[A-Za-z0-9._/-]+$/.test(path);
  } catch {
    return false;
  }
}
