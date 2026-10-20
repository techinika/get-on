import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: ["smoke.spec.ts", "a11y.spec.ts"],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Use system Chrome when Playwright's own browser is not installed.
        channel: process.env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD ? "chrome" : undefined,
      },
    },
  ],
});
