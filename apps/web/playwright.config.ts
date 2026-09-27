import { defineConfig, devices } from "@playwright/test";
import fs from "node:fs";

const executablePath =
  process.env.PW_CHROMIUM_PATH ??
  (fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: { baseURL, trace: "retain-on-failure", launchOptions: { executablePath } },
  projects: [
    {
      name: "mobile",
      use: {
        ...devices["Pixel 7"],
        viewport: { width: 390, height: 844 },
        launchOptions: { executablePath },
      },
      testIgnore: /captures|smoke/,
    },
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } }, testMatch: /desktop/ },
    { name: "captures", use: { viewport: { width: 1440, height: 900 } }, testMatch: /captures/ },
    { name: "smoke", use: { viewport: { width: 1440, height: 900 } }, testMatch: /smoke/ },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: "node ../../scripts/dev.mjs", url: baseURL, reuseExistingServer: true, timeout: 180_000 },
});
