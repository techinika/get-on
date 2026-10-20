import { expect, test } from "@playwright/test";

test("landing page loads", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Get your business online in minutes." })).toBeVisible();
});

test("signup page reaches dashboard after submit", async ({ page }) => {
  test.skip(!process.env.E2E_ENABLE_SIGNUP, "Set E2E_ENABLE_SIGNUP=1 with local Supabase running.");

  const email = `test-${Date.now()}@example.com`;
  await page.goto("/signup");
  await page.getByLabel("Full name").fill("Taylor Baker");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("testpass123");
  await page.getByRole("button", { name: "Start free" }).click();

  await expect(page).toHaveURL(/\/dashboard/);
});
