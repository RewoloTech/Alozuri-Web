import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 45000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://localhost:3100',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node scripts/run-e2e-server.mjs',
    url: 'http://localhost:3100',
    reuseExistingServer: false,
    timeout: 90000,
    env: {
      NEXT_PUBLIC_DEMO_MODE: 'false',
      NEXT_PUBLIC_API_URL: process.env.E2E_API_URL || 'http://127.0.0.1:8189',
      NEXT_PUBLIC_PAYMENT_MODE: 'test',
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:
        process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || 'pk_test_browser_fixture',
    },
  },
});
