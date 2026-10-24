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


/**
 * Settings routes stream in dev, so networkidle can hang. Wait for the
 * document and give the route a moment to paint instead.
 */
async function captureProjectSettings(page, projectPath, width, scheme) {
  const routes = [
    ["index", ""],
    ["business", "/business"],
    ["address", "/address"],
    ["publishing", "/publishing"],
    ["search", "/search"],
    ["sitemap", "/sitemap"],
    ["redirects", "/redirects"],
    ["analytics", "/analytics"],
    ["backups", "/backups"],
    ["export-import", "/export-import"],
    ["transfer", "/transfer"],
    ["delete", "/delete"],
    ["activity", "/activity"],
  ];
  for (const [name, suffix] of routes) {
    await page.goto(`${BASE}${projectPath}/settings${suffix}`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(600);
    await shot(page, `settings-${name}-${width}-${scheme}`);
  }
  await page.goto(`${BASE}${projectPath}/visitors`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(600);
  await shot(page, `visitors-${width}-${scheme}`);
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

/**
 * Walk the website wizard and capture the three steps the spec shows. The
 * draft is cleared first so every run starts at step 1.
 */
async function captureWizardSteps(page, width, scheme) {
  await page.goto(`${BASE}/dashboard/new`, { waitUntil: "networkidle" });
  await page.evaluate(() => window.sessionStorage.clear());
  await page.reload({ waitUntil: "networkidle" });

  const name = `Rose Bakery ${String(Date.now()).slice(-6)}`;
  await page.getByLabel("Business name").fill(name);
  await waitForEnabled(page, "Continue");
  await shot(page, `wizard-step1-${width}-${scheme}`);
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByRole("radio", { name: /Restaurant or cafe/ }).click();
  await shot(page, `wizard-step2-${width}-${scheme}`);
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByRole("button", { name: "Continue" }).click(); // step 3 skippable
  await page.getByRole("radio", { name: /Pick a template/ }).click();
  await page.getByLabel("Choose a design").selectOption("restaurant");
  await shot(page, `wizard-step4-${width}-${scheme}`);
  await page.getByRole("button", { name: "Continue" }).click(); // step 5
  await page.getByRole("button", { name: "Skip this step" }).click(); // step 6
  await shot(page, `wizard-step6-${width}-${scheme}`);
}

async function capturePublic(contextFactory) {
  const routes = [
    ["landing", "/"],
    ["templates", "/templates"],
    ["template-starter", "/templates/starter"],
    ["template-restaurant", "/templates/restaurant"],
    ["request-demo", "/request-demo"],
    ["report", "/report"],
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
  await page.getByRole("radio", { name: /Pick a template/ }).click();
  await page.getByLabel("Choose a design").selectOption("restaurant");
  await shot(page, "wizard-step4-360-light");
  await page.getByRole("button", { name: "Continue" }).click(); // step 5
  await page.getByRole("button", { name: "Skip this step" }).click(); // step 6
  await shot(page, "wizard-step6-360-light");

  await page.getByRole("button", { name: "Create my website" }).click();
  await page.waitForURL(/\/dashboard\/projects\//, { timeout: 30_000 });
  await page.waitForLoadState("networkidle");
  await shot(page, "project-overview-360-light");

  const projectPath = new URL(page.url()).pathname;
  const publishButton = page.getByRole("button", { name: /^Publish (website|changes)$/ }).first();
  if (await publishButton.count()) {
    await publishButton.click();
    await page.getByRole("dialog").waitFor({ state: "visible", timeout: 15_000 });
    await shot(page, "publish-dialog-360-light", { fullPage: false });
    await page.getByRole("button", { name: "Not now" }).click().catch(() => undefined);
  }
  await page.goto(`${BASE}${projectPath}/publish`, { waitUntil: "networkidle" });
  await shot(page, "publish-history-360-light");

  // The larger variants are captured in the loop below, so skip the baseline.
  await page.goto(`${BASE}${projectPath}/pages`, { waitUntil: "networkidle" });
  await shot(page, "pages-list-360-light");

  await page.goto(`${BASE}${projectPath}/images`, { waitUntil: "networkidle" });
  await shot(page, "pictures-360-light");

  await page.goto(`${BASE}${projectPath}/templates`, { waitUntil: "networkidle" });
  await shot(page, "project-templates-360-light");

  await captureProjectSettings(page, projectPath, 360, "light");

  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await shot(page, "dashboard-360-light");

  await page.goto(`${BASE}/dashboard/templates`, { waitUntil: "networkidle" });
  await shot(page, "templates-360-light");

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

      await p2.goto(`${BASE}/dashboard/templates`, { waitUntil: "networkidle" });
      await shot(p2, `templates-${width}-${scheme}`);

      // Project pages via the website card.
      await p2.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
      const open = p2.getByRole("link", { name: businessName }).first();
      if (await open.count()) {
        await open.click();
        await p2.waitForURL(/\/dashboard\/projects\//, { timeout: 15_000 });
        await p2.waitForLoadState("networkidle");
        await shot(p2, `project-overview-${width}-${scheme}`);
        const url = new URL(p2.url()).pathname;

        const publish = p2.getByRole("button", { name: /^Publish (website|changes)$/ }).first();
        if (await publish.count()) {
          await publish.click();
          await p2.getByRole("dialog").waitFor({ state: "visible", timeout: 15_000 });
          await shot(p2, `publish-dialog-${width}-${scheme}`, { fullPage: false });
          await p2.getByRole("button", { name: "Not now" }).click().catch(() => undefined);
        }
        await p2.goto(`${BASE}${url}/publish`, { waitUntil: "networkidle" });
        await shot(p2, `publish-history-${width}-${scheme}`);

        await p2.goto(`${BASE}${url}/pages`, { waitUntil: "networkidle" });
        await shot(p2, `pages-list-${width}-${scheme}`);
        await p2.goto(`${BASE}${url}/images`, { waitUntil: "networkidle" });
        await shot(p2, `pictures-${width}-${scheme}`);
        await p2.goto(`${BASE}${url}/templates`, { waitUntil: "networkidle" });
        await shot(p2, `project-templates-${width}-${scheme}`);
        await captureProjectSettings(p2, url, width, scheme);
      }
      await captureWizardSteps(p2, width, scheme);
      await ctx2.close();
    }
  }

  await context.close();
  await browser.close();
}

/**
 * Admin screens need an account whose email is in ADMIN_EMAILS. Supply that
 * account with E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD; otherwise this is
 * skipped so `pnpm screenshots` still works for everyone else.
 */
async function captureAdmin(contextFactory) {
  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;
  if (!email || !password) {
    console.log("Skipping admin screens (set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD).");
    return;
  }

  const browser = await chromium.launch(LAUNCH_OPTIONS);

  for (const scheme of SCHEMES) {
    for (const width of WIDTHS) {
      const context = await contextFactory(browser, scheme, width);
      const page = await context.newPage();
      await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
      await page.getByLabel("Email").fill(email);
      await page.getByRole("textbox", { name: "Password" }).fill(password);
      await page.getByRole("button", { name: "Log in" }).click();
      await page.waitForURL(/\/dashboard/, { timeout: 30_000 }).catch(() => undefined);

      await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
      if (!page.url().includes("/admin")) {
        console.warn(`SKIP admin screens: ${email} is not in ADMIN_EMAILS.`);
        await context.close();
        await browser.close();
        return;
      }

      await shot(page, `admin-${width}-${scheme}`);
      await page.goto(`${BASE}/admin/sites`, { waitUntil: "networkidle" });
      await shot(page, `admin-sites-${width}-${scheme}`);

      const firstSite = page.locator('a[href^="/admin/sites/"]').first();
      if (await firstSite.count()) {
        await firstSite.click();
        await page.waitForLoadState("networkidle");
        await shot(page, `admin-site-${width}-${scheme}`);
      }

      await context.close();
    }
  }

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
      await captureAdmin(contextFactory);
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
