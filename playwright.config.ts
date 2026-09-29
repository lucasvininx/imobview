import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";
if (
  !process.env.TEST_DATABASE_URL ||
  !new URL(process.env.TEST_DATABASE_URL).pathname.endsWith("_test")
)
  throw new Error("E2E requires an isolated *_test database.");
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "node tests/fixtures/storage-server.mjs",
      url: "http://127.0.0.1:3101/health",
      reuseExistingServer: false,
    },
    {
      command: "npm run start -- --port 3100",
      url: "http://localhost:3100",
      reuseExistingServer: false,
      timeout: 120000,
      env: {
        DATABASE_URL: process.env.TEST_DATABASE_URL!,
        NEXT_PUBLIC_APP_URL: "http://localhost:3100",
        SMTP_PORT: "11025",
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:3101",
        SUPABASE_SECRET_KEY: "local-contract-test-key-not-a-secret",
        SUPABASE_TOUR_BUCKET: "imobview-tours",
      },
    },
  ],
});
