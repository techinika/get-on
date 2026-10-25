import { describe, expect, it } from "vitest";
import { parseWritingStyle } from "../app/dashboard/(shell)/projects/[projectId]/settings/writing/style";

function form(entries: Array<[string, string]>): FormData {
  const data = new FormData();
  for (const [key, value] of entries) data.append(key, value);
  return data;
}

describe("writing style form", () => {
  it("keeps known tones, drops unknown ones and caps at three", () => {
    const result = parseWritingStyle(
      form([
        ["tones", "Friendly"],
        ["tones", "Bold"],
        ["tones", "Elegant"],
        ["tones", "Direct"],
        ["tones", "Not a tone"],
      ]),
    );
    expect(result.tones).toEqual(["Friendly", "Bold", "Elegant"]);
  });

  it("trims, deduplicates and caps words", () => {
    const entries: Array<[string, string]> = [
      ["words_use", "  Fresh  "],
      ["words_use", "fresh"],
      ["words_use", "Local"],
    ];
    for (let index = 0; index < 12; index += 1) {
      entries.push(["words_avoid", `Word ${index}`]);
    }
    const result = parseWritingStyle(form(entries));
    expect(result.wordsToUse).toEqual(["Fresh", "Local"]);
    expect(result.wordsToAvoid).toHaveLength(10);
  });

  it("pairs facts and drops incomplete rows", () => {
    const result = parseWritingStyle(
      form([
        ["fact_label", "Open since"],
        ["fact_value", "2012"],
        ["fact_label", "No detail"],
        ["fact_value", ""],
        ["fact_label", ""],
        ["fact_value", "No name"],
      ]),
    );
    expect(result.businessFacts).toEqual([{ label: "Open since", value: "2012" }]);
  });

  it("caps facts at twenty", () => {
    const entries: Array<[string, string]> = [];
    for (let index = 0; index < 25; index += 1) {
      entries.push(["fact_label", `Fact ${index}`], ["fact_value", `Detail ${index}`]);
    }
    expect(parseWritingStyle(form(entries)).businessFacts).toHaveLength(20);
  });
});
