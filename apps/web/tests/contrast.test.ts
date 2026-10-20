import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Verifies that every text/background pair from the UI spec (§1.1)
 * meets WCAG 2.1 AA (4.5:1 body text, 3:1 for the pinned large-text pairs).
 */

const CSS = readFileSync(join(__dirname, "../app/globals.css"), "utf8");

function extractBlock(selector: string): Record<string, string> {
  // Find "selector {" … "}" at brace depth 0 within the file.
  const start = CSS.indexOf(selector);
  if (start === -1) throw new Error(`Selector ${selector} not found`);
  const open = CSS.indexOf("{", start);
  let depth = 1;
  let i = open + 1;
  while (depth > 0 && i < CSS.length) {
    if (CSS[i] === "{") depth++;
    if (CSS[i] === "}") depth--;
    i++;
  }
  const block = CSS.slice(open + 1, i - 1);
  const vars: Record<string, string> = {};
  for (const m of block.matchAll(/(--[a-z-]+)\s*:\s*([^;]+);/g)) {
    vars[m[1]!] = m[2]!.trim();
  }
  return vars;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "").trim();
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

const light = extractBlock(":root");
const dark = extractBlock(".dark");

// Pairs: [foreground var or hex, background var or hex, minimum ratio]
type Pair = [string, string, number];

const LIGHT_PAIRS: Pair[] = [
  ["--text", "--bg", 4.5],
  ["--text", "--surface", 4.5],
  ["--text", "--surface-muted", 4.5],
  ["--text-muted", "--bg", 4.5],
  ["--text-muted", "--surface", 4.5],
  ["--text-muted", "--surface-muted", 4.5],
  ["--on-primary", "--primary", 4.5],
  ["--primary", "--bg", 4.5],
  ["--primary", "--surface", 4.5],
  ["--primary", "--primary-soft", 4.5],
  ["--accent-text", "--accent-soft", 4.5],
  ["--accent-text", "--surface", 4.5],
  ["--success-text", "--success-soft", 4.5],
  ["--success", "--surface", 3],
  ["--warning-text", "--warning-soft", 4.5],
  ["--warning-text", "--bg", 4.5],
  ["--danger-text", "--danger-soft", 4.5],
  ["--danger", "--surface", 4.5],
  ["#FFFFFF", "--danger", 4.5],
  ["--info-text", "--info-soft", 4.5],
  ["--info-text", "--bg", 4.5],
  // Footer (fixed colours, same in dark mode)
  ["#E8DFD0", "#1F1A17", 4.5],
  ["#B5A99B", "#1F1A17", 4.5],
];

const DARK_PAIRS: Pair[] = [
  ["--text", "--bg", 4.5],
  ["--text", "--surface", 4.5],
  ["--text", "--surface-muted", 4.5],
  ["--text-muted", "--bg", 4.5],
  ["--text-muted", "--surface", 4.5],
  ["--text-muted", "--surface-muted", 4.5],
  ["--on-primary", "--primary", 4.5],
  ["--primary", "--bg", 4.5],
  ["--primary", "--surface", 4.5],
  ["--primary", "--primary-soft", 4.5],
  ["--accent-text", "--accent-soft", 4.5],
  ["--accent-text", "--surface", 4.5],
  ["--success-text", "--success-soft", 4.5],
  ["--success", "--surface", 3],
  ["--warning-text", "--warning-soft", 4.5],
  ["--warning-text", "--bg", 4.5],
  ["--danger-text", "--danger-soft", 4.5],
  // Dark --danger is only used for icons/borders and as the danger button bg
  // behind white text (checked above); 3:1 covers the non-text usage.
  ["--danger", "--surface", 3],
  ["#FFFFFF", "--danger", 4.5],
  ["--info-text", "--info-soft", 4.5],
  ["--info-text", "--bg", 4.5],
];

function resolve(vars: Record<string, string>, key: string): string {
  if (key.startsWith("#")) return key;
  const v = vars[key];
  if (!v) throw new Error(`Missing variable ${key}`);
  return v;
}

describe("design token contrast (WCAG AA)", () => {
  it.each(LIGHT_PAIRS.map((p, i) => [i, ...p] as [number, string, string, number]))(
    "light: %s %s on %s >= %s",
    (_i, fg, bg, min) => {
      const ratio = contrast(resolve(light, fg), resolve(light, bg));
      expect(ratio, `${fg} on ${bg} = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(min);
    },
  );

  it.each(DARK_PAIRS.map((p, i) => [i, ...p] as [number, string, string, number]))(
    "dark: %s %s on %s >= %s",
    (_i, fg, bg, min) => {
      const ratio = contrast(resolve(dark, fg), resolve(dark, bg));
      expect(ratio, `${fg} on ${bg} = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(min);
    },
  );
});
