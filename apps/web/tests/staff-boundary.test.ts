import { readFileSync } from "node:fs";
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(process.cwd(), "app", "admin");
const LIB = join(process.cwd(), "lib", "admin");

const BANNED_IMPORTS = [
  "@/lib/supabase/admin",
  "@/lib/storage",
  "@/lib/publishing",
  "@/lib/backup",
  "@/lib/contact",
];

/**
 * The console has no service-role imports left. Privileged publishing and
 * domain-provider operations live outside app/admin and lib/admin, where they
 * can build a site without returning customer content to a staff screen.
 */
const LEGACY = new Set<string>([]);

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else if (/\.(ts|tsx)$/.test(entry)) out.push(path);
  }
  return out;
}

function importsOf(path: string): string[] {
  const source = readFileSync(path, "utf8");
  const matches = source.matchAll(/from\s+["']([^"']+)["']/g);
  return [...matches].map((match) => match[1]);
}

describe("staff content boundary", () => {
  it("does not let new admin modules import service-role or content clients", () => {
    const files = [...walk(ROOT), ...walk(LIB)];
    const offenders: string[] = [];
    for (const file of files) {
      const rel = relative(process.cwd(), file).replaceAll("\\", "/");
      if (LEGACY.has(rel)) continue;
      const banned = importsOf(file).filter((spec) =>
        BANNED_IMPORTS.some((prefix) => spec === prefix || spec.startsWith(`${prefix}/`)),
      );
      if (banned.length > 0) offenders.push(`${rel}: ${banned.join(", ")}`);
    }
    expect(offenders).toEqual([]);
  });

  it("keeps the legacy list from growing", () => {
    expect(LEGACY.size).toBe(0);
  });
});
