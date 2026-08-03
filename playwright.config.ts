import { resolve } from "node:path";
import { defineConfig } from "@playwright/test";

const root = resolve(import.meta.dirname);
const databasePath = resolve(root, "review-artifacts", "e2e-current.db");
const skillsPath = resolve(root, "review-artifacts", "e2e-current-skills");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  outputDir: "review-artifacts/playwright-current-output",
  reporter: [["line"], ["html", { outputFolder: "review-artifacts/playwright-current-report", open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:15373",
    viewport: { width: 1440, height: 1000 },
    colorScheme: "dark",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "off"
  },
  webServer: [
    {
      name: "api",
      command: "node scripts/prepare-e2e.mjs && npx tsx apps/api-v2/src/index.ts",
      url: "http://127.0.0.1:18887/api/v2/health",
      reuseExistingServer: false,
      timeout: 60_000,
      stdout: "pipe",
      stderr: "pipe",
      env: { PORT: "18887", PERSONAL_OS_V2_DATABASE_PATH: databasePath, PERSONAL_OS_ALLOWED_ROOTS: root, PERSONAL_OS_SKILLS_ROOT: skillsPath },
      gracefulShutdown: { signal: "SIGTERM", timeout: 1_000 }
    },
    {
      name: "web",
      command: "npx vite apps/web-v2 --config apps/web-v2/vite.config.ts --host 127.0.0.1 --port 15373 --strictPort",
      url: "http://127.0.0.1:15373",
      reuseExistingServer: false,
      timeout: 60_000,
      stdout: "pipe",
      stderr: "pipe",
      env: { VITE_API_PROXY_TARGET: "http://127.0.0.1:18887" },
      gracefulShutdown: { signal: "SIGTERM", timeout: 1_000 }
    }
  ]
});
