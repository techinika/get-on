import { expect, test } from "@playwright/test";

test("landing page loads", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Get your business online in minutes." })).toBeVisible();
});

test("landing header offers log in and start free when signed out", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Log in" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Start free" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Dashboard" })).toHaveCount(0);
});

test("landing header points to the dashboard and the account when signed in", async ({ page }) => {
  test.skip(!process.env.E2E_ENABLE_SIGNUP, "Set E2E_ENABLE_SIGNUP=1 with local Supabase running.");

  const email = `test-${Date.now()}@example.com`;
  await page.goto("/signup");
  await page.getByLabel("Full name").fill("Taylor Baker");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("textbox", { name: "Password" }).fill("testpass123");
  await page.getByRole("button", { name: "Create my account" }).click();
  await page.waitForURL(/\/(dashboard|login)/, { timeout: 15_000 });
  if (new URL(page.url()).pathname === "/login") {
    test.skip(true, "The project asks for email confirmation.");
  }

  await page.goto("/");
  await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Account for Taylor Baker" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Log in" })).toHaveCount(0);
});

test("signup page reaches dashboard after submit", async ({ page }) => {
  test.skip(!process.env.E2E_ENABLE_SIGNUP, "Set E2E_ENABLE_SIGNUP=1 with local Supabase running.");

  const email = `test-${Date.now()}@example.com`;
  await page.goto("/signup");
  await page.getByLabel("Full name").fill("Taylor Baker");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("textbox", { name: "Password" }).fill("testpass123");
  await page.getByRole("button", { name: "Create my account" }).click();

  // A local Supabase signs the user straight in. A hosted project with email
  // confirmation sends them to the login screen with a message instead.
  await page.waitForURL(/\/(dashboard|login)/, { timeout: 15_000 });
  if (new URL(page.url()).pathname === "/login") {
    await expect(page.getByText(/confirm your account/i)).toBeVisible();
    return;
  }
  await expect(page).toHaveURL(/\/dashboard/);
});

test("report page explains what happens and asks for the website", async ({ page }) => {
  await page.goto("/report");
  await expect(page.getByRole("heading", { name: "Report a website" })).toBeVisible();
  await expect(page.getByLabel(/website address/i)).toBeVisible();
  await expect(page.getByText(/we look at every report/i)).toBeVisible();
});
