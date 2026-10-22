/**
 * Captures every screen from the UI spec at 360, 768, 1024, 1280 and 1440 px
 * wide, in light and dark, into docs/screenshots/.
 *
 * Public screens are always captured. Authenticated screens (dashboard,
 * wizard, project area) are captured when E2E_SCREENSHOTS=1 — this signs
 * up a throwaway user against the configured Supabase project.
 *
 * Usage: pnpm screenshots   (from apps/web, with the app built)
 */
import { chromium } from "@playwright/test";
import { mkdir, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const WEB_DIR = resolve(fileURLToPath(new URL("..", import.meta.url)));
const OUT_DIR = resolve(WEB_DIR, "../../docs/screenshots");
const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const WIDTHS = [360, 768, 1024, 1280, 1440];
const SCHEMES = ["light", "dark"];
const AUTH = process.env.E2E_SCREENSHOTS === "1";

/** Prefer a system Chrome/Chromium so we don't need Playwright's own download. */
const LAUNCH_OPTIONS = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
  ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
  : { channel: "chrome" };

async function waitForServer(url, timeoutMs = 60_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Server at ${url} did not start in time`);
}

async function shot(page, name, { fullPage = true } = {}) {
  await page.waitForTimeout(400); // let fonts/animations settle
  await page.screenshot({ path: join(OUT_DIR, `${name}.png`), fullPage });
  console.log(`captured ${name}`);
}

/** Wait until a button with this name is enabled. */
async function waitForEnabled(page, name, timeout = 20_000) {
  await page.waitForFunction(
    (label) => {
      const button = Array.from(document.querySelectorAll("button")).find(
        (el) => el.textContent?.trim() === label,
      );
      return Boolean(button && !button.disabled);
    },
    name,
    { timeout },
  );
}

async function capturePublic(contextFactory) {
  const routes = [
    ["landing", "/"],
    ["request-demo", "/request-demo"],
    ["terms", "/terms"],
    ["privacy", "/privacy"],
    ["cookies", "/cookies"],
    ["acceptable-use", "/acceptable-use"],
    ["signup", "/signup"],
    ["login", "/login"],
    ["forgot-password", "/forgot-password"],
    ["not-found", "/this-page-does-not-exist"],
  ];

  for (const scheme of SCHEMES) {
    for (const width of WIDTHS) {
      const browser = await chromium.launch(LAUNCH_OPTIONS);
      const context = await contextFactory(browser, scheme, width);
      const page = await context.newPage();
      for (const [name, path] of routes) {
        await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
        await shot(page, `${name}-${width}-${scheme}`);
      }
      await browser.close();
    }
  }
}

async function captureAuthenticated(contextFactory) {
  const browser = await chromium.launch(LAUNCH_OPTIONS);
  // One session for all authenticated screens (light/360 baseline + responsive variants).
  const context = await contextFactory(browser, "light", 360, { storageState: undefined });
  const page = await context.newPage();

  const email = `shots-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  const password = "screenshots-pass-1";

  async function trySignUp() {
    await page.goto(`${BASE}/signup`, { waitUntil: "networkidle" });
    await page.getByLabel("Full name").fill("Rosa Baker");
    await page.getByLabel("Email").fill(email);
    await page.getByRole("textbox", { name: "Password" }).fill(password);
    await page.getByRole("button", { name: "Create my account" }).click();
    await page
      .waitForURL(/\/(dashboard|login|signup)/, { timeout: 30_000 })
      .catch(() => undefined);
    return page.url().includes("/dashboard");
  }

  async function tryLogIn() {
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await page.getByLabel("Email").fill(email);
    await page.getByRole("textbox", { name: "Password" }).fill(password);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 30_000 }).catch(() => undefined);
    return page.url().includes("/dashboard");
  }

  let signedUp = await trySignUp();
  if (!signedUp) {
    // Supabase free tier rate-limits sign-up emails; retry once after a pause.
    console.log("Sign-up did not reach the dashboard, waiting 65s and retrying once…");
    await page.waitForTimeout(65_000);
    signedUp = await trySignUp();
  }
  if (!signedUp) {
    // The account may already exist from an earlier run, so try to log in.
    console.log("Trying to log in with the same account…");
    signedUp = await tryLogIn();
  }
  if (!signedUp) {
    console.warn(
      `SKIP authenticated screens: sign-up failed (${page.url()}). ` +
        "Supabase is likely rate-limiting sign-up emails — rerun later with E2E_SCREENSHOTS=1.",
    );
    await context.close();
    await browser.close();
    return;
  }

  // Wizard steps 1–6
  const stamp = String(Date.now()).slice(-6);
  const businessName = `Rose Bakery ${stamp}`;
  await page.getByLabel("Business name").fill(businessName);
  await waitForEnabled(page, "Continue");
  await shot(page, "wizard-step1-360-light");
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByRole("radio", { name: /Restaurant or cafe/ }).click();
  await shot(page, "wizard-step2-360-light");
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByRole("button", { name: "Continue" }).click(); // step 3 skippable
  await page.getByRole("radio", { name: /Start blank/ }).click();
  await page.getByRole("button", { name: "Continue" }).click(); // step 4
  await page.getByRole("button", { name: "Skip this step" }).click(); // step 5
  await shot(page, "wizard-step6-360-light");

  await page.getByRole("button", { name: "Create my website" }).click();
  await page.waitForURL(/\/dashboard\/projects\//, { timeout: 30_000 });
  await page.waitForLoadState("networkidle");
  await shot(page, "project-overview-360-light");

  const projectPath = new URL(page.url()).pathname;
  await page.goto(`${BASE}${projectPath}/pages`, { waitUntil: "networkidle" });
  await shot(page, "pages-list-360-light");

  await page.goto(`${BASE}${projectPath}/images`, { waitUntil: "networkidle" });
  await shot(page, "pictures-360-light");

  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await shot(page, "dashboard-360-light");

  await page.goto(`${BASE}/dashboard/plan`, { waitUntil: "networkidle" });
  await shot(page, "plan-360-light");

  await page.goto(`${BASE}/dashboard/team`, { waitUntil: "networkidle" });
  await shot(page, "team-360-light");

  await page.goto(`${BASE}/dashboard/account`, { waitUntil: "networkidle" });
  await shot(page, "account-360-light");

  // Re-capture key screens at other widths/schemes.
  for (const scheme of SCHEMES) {
    for (const width of WIDTHS) {
      if (width === 360 && scheme === "light") continue;
      await context.close();
      const ctx2 = await contextFactory(browser, scheme, width);
      const p2 = await ctx2.newPage();
      // Re-login with the same user.
      await p2.goto(`${BASE}/login`, { waitUntil: "networkidle" });
      await p2.getByLabel("Email").fill(email);
      await p2.getByRole("textbox", { name: "Password" }).fill(password);
      await p2.getByRole("button", { name: "Log in" }).click();
      await p2.waitForURL(/\/dashboard/, { timeout: 30_000 });
      await p2.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
      await shot(p2, `dashboard-${width}-${scheme}`);

      await p2.goto(`${BASE}/dashboard/plan`, { waitUntil: "networkidle" });
      await shot(p2, `plan-${width}-${scheme}`);

      await p2.goto(`${BASE}/dashboard/team`, { waitUntil: "networkidle" });
      await shot(p2, `team-${width}-${scheme}`);

      await p2.goto(`${BASE}/dashboard/account`, { waitUntil: "networkidle" });
      await shot(p2, `account-${width}-${scheme}`);

      // Project pages via the website card.
      const open = p2.getByRole("link", { name: businessName }).first();
      if (await open.count()) {
        await open.click();
        await p2.waitForURL(/\/dashboard\/projects\//, { timeout: 15_000 });
        await p2.waitForLoadState("networkidle");
        await shot(p2, `project-overview-${width}-${scheme}`);
        const url = new URL(p2.url()).pathname;
        await p2.goto(`${BASE}${url}/pages`, { waitUntil: "networkidle" });
        await shot(p2, `pages-list-${width}-${scheme}`);
        await p2.goto(`${BASE}${url}/images`, { waitUntil: "networkidle" });
        await shot(p2, `pictures-${width}-${scheme}`);
      }
      await ctx2.close();
    }
  }

  await context.close();
  await browser.close();
}

async function main() {
  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(OUT_DIR, { recursive: true });

  let server;
  let startedHere = false;
  try {
    await fetch(BASE);
  } catch {
    console.log(`Starting app server at ${BASE}…`);
    server = spawn("pnpm", ["start"], { cwd: WEB_DIR, stdio: "ignore" });
    startedHere = true;
  }
  await waitForServer(BASE);

  const contextFactory = async (browser, scheme, width, opts = {}) => {
    const context = await browser.newContext({
      viewport: { width, height: scheme === "light" ? 900 : 900 },
      colorScheme: scheme,
      reducedMotion: "reduce",
      ...opts,
    });
    if (scheme === "dark") {
      await context.addCookies([
        { name: "get-on-theme", value: "dark", url: new URL(BASE).origin },
      ]);
    } else {
      await context.addCookies([
        { name: "get-on-theme", value: "light", url: new URL(BASE).origin },
      ]);
    }
    return context;
  };

  try {
    await capturePublic(contextFactory);
    if (AUTH) {
      await captureAuthenticated(contextFactory);
    } else {
      console.log("Skipping authenticated screens (set E2E_SCREENSHOTS=1 to include).");
    }
  } finally {
    if (startedHere && server) server.kill();
  }
  console.log(`Done. Screenshots in ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
