import { describe, expect, it } from "vitest";
import { company } from "@/lib/company";
import { LEGAL_DOCUMENTS, type LegalBlock, type LegalDocument } from "@/lib/legal-content";

const PLACEHOLDER = /\[\[[^\]\n]+\]\]|\[[^\]\n]{2,80}\](?!\()/;

function blockText(block: LegalBlock): string[] {
  switch (block.kind) {
    case "p":
    case "h3":
      return [block.text];
    case "ul":
    case "ol":
      return block.items;
    case "table":
      return [...block.head, ...block.rows.flat()];
    default:
      return [];
  }
}

function documentText(document: LegalDocument): string[] {
  return document.sections.flatMap((section) => [
    section.title,
    ...section.blocks.flatMap((block) => blockText(block)),
  ]);
}

describe("legal content", () => {
  it("has the four legal pages", () => {
    expect(LEGAL_DOCUMENTS.map((document) => document.slug)).toEqual([
      "terms",
      "privacy",
      "cookies",
      "acceptable-use",
    ]);
  });

  it("gives every page a short version of three to five bullets", () => {
    for (const document of LEGAL_DOCUMENTS) {
      expect(document.short.length).toBeGreaterThanOrEqual(3);
      expect(document.short.length).toBeLessThanOrEqual(5);
    }
  });

  it("uses unique section ids on every page", () => {
    for (const document of LEGAL_DOCUMENTS) {
      const ids = document.sections.map((section) => section.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids) {
        expect(id).toMatch(/^[a-z0-9-]+$/);
      }
    }
  });

  it("has no unfinished text once the legal review is done", () => {
    if (company.reviewPending) {
      // Still a draft, so unfinished text is expected and shown highlighted.
      return;
    }
    const unfinished: string[] = [];
    for (const document of LEGAL_DOCUMENTS) {
      for (const text of documentText(document)) {
        if (PLACEHOLDER.test(text)) unfinished.push(`${document.slug}: ${text}`);
      }
    }
    expect(unfinished).toEqual([]);
  });
});
