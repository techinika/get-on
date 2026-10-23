import { chromium } from "@playwright/test";
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto("http://127.0.0.1:3113/", { waitUntil: "networkidle" });
const info = await page.evaluate(() => {
  const s = document.querySelector("summary");
  if (!s) return "no summary";
  const cs = getComputedStyle(s);
  const r = s.getBoundingClientRect();
  return {
    cls: s.className,
    h: r.height, w: r.width,
    minH: cs.minHeight, pad: cs.padding, display: cs.display,
    parentCls: s.parentElement?.className,
  };
});
console.log(info);
await browser.close();
