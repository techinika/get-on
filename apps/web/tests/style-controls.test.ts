import { describe, expect, it } from "vitest";
import { STYLE_GROUPS, STYLE_SELECT_OPTIONS, validateStyleValue } from "@get-on/blocks";

describe("editor style controls", () => {
  const selects = STYLE_GROUPS.flatMap((group) =>
    group.props.filter((item) => item.control === "select").map((item) => ({ ...item, group: group.id })),
  );

  it("offers choices for every select control", () => {
    for (const item of selects) {
      expect(STYLE_SELECT_OPTIONS[item.prop]?.length, `${item.group}/${item.prop}`).toBeGreaterThan(0);
    }
  });

  it("only offers values the style validator accepts", () => {
    for (const item of selects) {
      for (const option of STYLE_SELECT_OPTIONS[item.prop] ?? []) {
        expect(validateStyleValue(item.prop, option), `${item.prop}: ${option}`).toMatchObject({ ok: true });
      }
    }
  });

  it("includes the layout choices people expect", () => {
    const props = new Set(selects.map((item) => item.prop));
    for (const prop of ["text-align", "justify-content", "align-items", "display", "position", "object-fit"]) {
      expect(props.has(prop), prop).toBe(true);
    }
  });
});
