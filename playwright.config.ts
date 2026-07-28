import { resolve } from "node:path";
import { defineConfig } from "@playwright/test";

const root = resolve(import.meta.dirname);
const databasePath = resolve(root, "review-artifacts", "e2e.db");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  outputDir: "review-artifacts/playwright-output",
  reporter: [
    ["line"],
    ["html", { outputFolder: "review-artifacts/playwright-report", open: "never" }]
  ],
  use: {
    baseURL: "http://127.0.0.1:15273",
    viewport: { width: 1440, height: 1000 },
    colorScheme: "dark",
    trace: "on",
    screenshot: "on",
    video: "off"
  },
  webServer: [
    {
      name: "api",
      command: "node scripts/prepare-e2e.mjs && npx tsx apps/server/src/index.ts",
      url: "http://127.0.0.1:18787/api/health/live",
      reuseExistingServer: false,
      timeout: 60_000,
      stdout: "pipe",
      stderr: "pipe",
      env: {
        HOST: "127.0.0.1",
        PORT: "18787",
        DATABASE_PATH: databasePath,
        CODEX_MODE: "demo"
      },
      gracefulShutdown: { signal: "SIGTERM", timeout: 1_000 }
    },
    {
      name: "web",
      command: "npx vite apps/web --config apps/web/vite.config.ts --host 127.0.0.1 --port 15273 --strictPort",
      url: "http://127.0.0.1:15273",
      reuseExistingServer: false,
      timeout: 60_000,
      stdout: "pipe",
      stderr: "pipe",
      env: { VITE_API_PROXY_TARGET: "http://127.0.0.1:18787" },
      gracefulShutdown: { signal: "SIGTERM", timeout: 1_000 }
    }
  ]
});
