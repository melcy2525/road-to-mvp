import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  use: {
    baseURL: "http://127.0.0.1:3100",
    launchOptions: {
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    },
  },
  webServer: [
    {
      command: "node scripts/test-server.mjs",
      url: "http://127.0.0.1:3100",
      reuseExistingServer: false,
      timeout: 120000,
    },
    {
      command: "node scripts/test-server.mjs --unconfigured",
      url: "http://127.0.0.1:3101",
      reuseExistingServer: false,
      timeout: 120000,
    },
  ],
});
