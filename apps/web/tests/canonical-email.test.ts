import { describe, expect, it } from "vitest";
import { canonicalEmail } from "@/lib/security/canonical-email";

describe("canonicalEmail", () => {
  it("trims and lowercases", () => {
    expect(canonicalEmail("  Foo@Example.COM  ")).toBe("foo@example.com");
  });

  it("NFKC normalises unicode", () => {
    // fullwidth A -> A
    expect(canonicalEmail("Ａlice@example.com")).toBe("alice@example.com");
  });

  it("strips +tag for all domains", () => {
    expect(canonicalEmail("alice+promo@example.com")).toBe("alice@example.com");
    expect(canonicalEmail("alice+promo+2@gmail.com")).toBe("alice@gmail.com");
  });

  it("gmail: removes dots and maps googlemail.com", () => {
    expect(canonicalEmail("a.l.i.c.e@gmail.com")).toBe("alice@gmail.com");
    expect(canonicalEmail("alice@googlemail.com")).toBe("alice@gmail.com");
    expect(canonicalEmail("A.L.I.C.E+tag@GoogleMail.com")).toBe("alice@gmail.com");
  });

  it("collapses repeated dots for allow-listed providers", () => {
    expect(canonicalEmail("a..b@yahoo.com")).toBe("a.b@yahoo.com");
  });

  it("does not collapse single dots for non-allow-listed providers", () => {
    expect(canonicalEmail("a.b@example.com")).toBe("a.b@example.com");
  });

  it("punycodes internationalised domains", () => {
    expect(canonicalEmail("user@münchen.de")).toBe("user@xn--mnchen-3ya.de");
  });

  it("returns input for malformed (no @)", () => {
    expect(canonicalEmail("notanemail")).toBe("notanemail");
  });

  it("handles empty", () => {
    expect(canonicalEmail("")).toBe("");
  });

  const cases: Array<[string, string]> = [
    ["Alice@Example.com", "alice@example.com"],
    ["  bob@test.org  ", "bob@test.org"],
    ["carol+newsletter@foo.bar", "carol@foo.bar"],
    ["dave.smith@gmail.com", "davesmith@gmail.com"],
    ["dave.smith@googlemail.com", "davesmith@gmail.com"],
    ["eve+work+urgent@Gmail.COM", "eve@gmail.com"],
    ["frank..double@yahoo.com", "frank.double@yahoo.com"],
    ["grace@example.co.uk", "grace@example.co.uk"],
    ["heidi+tag@sub.example.com", "heidi@sub.example.com"],
    ["ivan@XN--MNCHEN-3YA.DE", "ivan@xn--mnchen-3ya.de"],
    ["judy@例え.jp", "judy@xn--r8jz45g.jp"],
    ["mallory@EXAMPLE.COM", "mallory@example.com"],
    ["nancy+1+2+3@outlook.com", "nancy@outlook.com"],
    ["oscar.tag@proton.me", "oscar.tag@proton.me"],
    ["peggy@icloud.com", "peggy@icloud.com"],
    ["quinn+promo@hey.com", "quinn@hey.com"],
    ["ruth@fastmail.com", "ruth@fastmail.com"],
    ["steve+news@live.com", "steve@live.com"],
    ["trudy+spam@hotmail.com", "trudy@hotmail.com"],
    ["uma+u@ymail.com", "uma@ymail.com"],
    ["victor@rocketmail.com", "victor@rocketmail.com"],
    ["wendy+coupon@gmail.com", "wendy@gmail.com"],
    ["xavier.dots@gmail.com", "xavierdots@gmail.com"],
    ["yvonne+tag@googlemail.com", "yvonne@gmail.com"],
    ["zoe+1@GMAIL.com", "zoe@gmail.com"],
    ["a@b.co", "a@b.co"],
    ["name.surname@domain.io", "name.surname@domain.io"],
    ["plus+tag+extra@domain.io", "plus@domain.io"],
    [" leading@domain.io", "leading@domain.io"],
    ["trailing@domain.io ", "trailing@domain.io"],
    ["Mixed.Case@Domain.IO", "mixed.case@domain.io"],
    ["dots..collapse@yahoo.com", "dots.collapse@yahoo.com"],
    ["nochange@nochange.com", "nochange@nochange.com"],
    ["unicode.local@domain.com", "unicode.local@domain.com"],
    ["tag+with+plus@gmail.com", "tag@gmail.com"],
    ["multi.dot.local@gmail.com", "multidotlocal@gmail.com"],
    ["a.b.c.d@gmail.com", "abcd@gmail.com"],
    ["edge+@example.com", "edge@example.com"],
    ["a+@example.com", "a@example.com"],
    ["first.last+work@company.org", "first.last@company.org"],
    ["user.name+tag@sub.domain.com", "user.name@sub.domain.com"],
  ];

  for (const [input, expected] of cases) {
    it(`canonicalises: ${input}`, () => {
      expect(canonicalEmail(input)).toBe(expected);
    });
  }
});
