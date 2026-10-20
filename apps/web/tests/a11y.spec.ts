import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Spec §10: every screen must pass axe-core with no serious or critical issues.
 * Also enforces §0: no horizontal scrolling at 360 px.
 */

const ROUTES: [name: string, path: string][] = [
  ["landing", "/"],
  ["signup", "/signup"],
  ["login", "/login"],
  ["forgot-password", "/forgot-password"],
  ["not-found", "/does-not-exist"],
];

async function scan(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const blocking = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  const summary = blocking
    .map((v) => `${v.id} (${v.impact}): ${v.help} → ${v.nodes.length} node(s) e.g. ${v.nodes[0]?.target.join(" ")}`)
    .join("\n");
  expect(blocking, `${label}: axe violations\n${summary}`).toEqual([]);
}

for (const [name, path] of ROUTES) {
  test(`${name}: no serious/critical axe violations`, async ({ page }) => {
    await page.goto(path, { waitUntil: "networkidle" });
    await scan(page, name);
  });
}

test("landing: no horizontal scroll at 360 px", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/", { waitUntil: "networkidle" });
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
});

test("landing: key spec copy and landmarks present", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(
    page.getByRole("heading", { level: 1, name: "Get your business online in minutes." }),
  ).toBeVisible();
  await expect(page.getByRole("navigation").first()).toBeVisible();
  await expect(page.getByRole("contentinfo")).toBeVisible();
  await expect(page.locator("#how")).toHaveCount(1);
  await expect(page.locator("#pricing")).toHaveCount(1);
  await expect(page.locator("#faq")).toHaveCount(1);
  // Forbidden product words must never appear in the page text.
  const text = (await page.locator("body").innerText()).toLowerCase();
  for (const word of ["slug", "dns", "schema", "domain configuration"]) {
    expect(text, `page must not contain "${word}"`).not.toContain(word);
  }
});

test("landing: display font applied to H1", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  const family = await page
    .getByRole("heading", { level: 1 })
    .first()
    .evaluate((el) => getComputedStyle(el).fontFamily);
  expect(family.toLowerCase()).toContain("bricolage");
});

test("landing: primary buttons meet 44px hit area", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/", { waitUntil: "networkidle" });
  const undersized = await page.evaluate(() => {
    const nodes = Array.from(
      document.querySelectorAll<HTMLElement>('button, summary, [role="radio"]'),
    );
    return nodes
      .filter((el) => el.offsetParent !== null)
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          tag: el.tagName,
          text: (el.textContent ?? "").trim().slice(0, 40),
          w: Math.round(r.width),
          h: Math.round(r.height),
        };
      })
      .filter((el) => el.h > 0 && (el.h < 44 || el.w < 44));
  });
  expect(undersized, "controls under 44×44").toEqual([]);
});
