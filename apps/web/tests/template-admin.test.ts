import { describe, expect, it } from "vitest";
import { SYSTEM_TEMPLATES, packageSummary } from "@get-on/templates";
import {
  templatePackageBytes,
  templatePackageHash,
} from "@/lib/templates/package-hash";

describe("system template packages", () => {
  it("hashes every package deterministically and distinctly", () => {
    const hashes = SYSTEM_TEMPLATES.map((pkg) => templatePackageHash(pkg));
    expect(new Set(hashes).size).toBe(SYSTEM_TEMPLATES.length);
    hashes.forEach((hash) => expect(hash).toMatch(/^[0-9a-f]{64}$/));

    expect(templatePackageHash(SYSTEM_TEMPLATES[0])).toBe(
      templatePackageHash(SYSTEM_TEMPLATES[0]),
    );
  });

  it("changes the hash when the content changes", () => {
    const pkg = SYSTEM_TEMPLATES[0];
    const changed = structuredClone(pkg);
    changed.meta.tagline = `${changed.meta.tagline} Updated`;
    expect(templatePackageHash(changed)).not.toBe(templatePackageHash(pkg));
  });

  it("reports same-size counts and a positive byte size", () => {
    for (const pkg of SYSTEM_TEMPLATES) {
      const summary = packageSummary(pkg);
      expect(summary.pageCount).toBeGreaterThan(0);
      expect(summary.blockCount).toBeGreaterThan(0);
      expect(templatePackageBytes(pkg)).toBeGreaterThan(0);
    }
  });
});
