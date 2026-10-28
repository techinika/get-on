import { describe, expect, it } from "vitest";
import {
  addOpenPixel,
  rewriteTrackedLinks,
  trackableLinks,
  trackingOrigin,
} from "@/lib/email/tracking";

const UNSUBSCRIBE = "https://get-on.tech/email/unsubscribe?token=abc";

describe("email tracking", () => {
  it("accepts http(s) origins only", () => {
    expect(trackingOrigin("https://get-on.tech/path?x=1")).toBe("https://get-on.tech");
    expect(trackingOrigin("http://localhost:3000")).toBe("http://localhost:3000");
    expect(trackingOrigin("javascript:alert(1)")).toBeNull();
    expect(trackingOrigin("")).toBeNull();
    expect(trackingOrigin(null)).toBeNull();
  });

  it("finds unique trackable links and skips the unsubscribe link", () => {
    const html = [
      '<a href="https://example.com/a?x=1&amp;y=2">A</a>',
      '<a href="https://example.com/a?x=1&amp;y=2">A again</a>',
      `<a href="${UNSUBSCRIBE}">Off</a>`,
      '<a href="mailto:team@get-on.tech">Email</a>',
      '<a href="/relative">Relative</a>',
    ].join("");

    expect(trackableLinks(html, UNSUBSCRIBE)).toEqual([
      "https://example.com/a?x=1&y=2",
    ]);
  });

  it("rewrites only the links in the replacement map", () => {
    const html =
      '<a href="https://example.com/a?x=1&amp;y=2">A</a><a href="https://keep.example">K</a>';
    const out = rewriteTrackedLinks(
      html,
      new Map([["https://example.com/a?x=1&y=2", "https://get-on.tech/email/click/abc"]]),
    );

    expect(out).toContain('href="https://get-on.tech/email/click/abc"');
    expect(out).toContain('href="https://keep.example"');
  });

  it("puts the open pixel before the body close", () => {
    expect(addOpenPixel("<html><body>Hi</body></html>", "https://t/p.gif")).toContain(
      '<img src="https://t/p.gif" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;opacity:0;"></body>',
    );
  });
});
