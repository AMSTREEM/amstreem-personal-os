import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const authState = resolve(process.cwd(), 'e2e/.auth/user.json');

export default defineConfig({
  testDir: '.',
  testMatch: 'baseline.spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  outputDir: '../test-results/baseline',
  use: {
    baseURL: process.env.BASELINE_ORIGIN || 'https://amstreem-atlas-staging.onrender.com',
    browserName: 'chromium',
    headless: true,
    storageState: existsSync(authState) ? authState : undefined,
    screenshot: 'off',
    trace: 'retain-on-failure'
  }
});
