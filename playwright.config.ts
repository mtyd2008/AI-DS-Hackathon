import { defineConfig, devices } from "@playwright/test";

// E2E runs the production build against an isolated, freshly migrated database.
const E2E_DB = process.env.E2E_DATABASE_URL ?? "postgresql://postgres@localhost:5432/hcm_lite_e2e?schema=public";
const PORT = 3200;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Reset the E2E database to an empty, migrated state, then serve the production build.
    command: `node tests/e2e/reset-db.mjs && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { DATABASE_URL: E2E_DB, AI_API_KEY: "", ADMIN_EMAIL: "", ADMIN_PASSWORD: "", JWT_SECRET: "e2e-secret-e2e-secret-e2e-secret-0123456789" },
  },
});
