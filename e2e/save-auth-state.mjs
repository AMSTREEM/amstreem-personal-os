import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { resolve } from 'node:path';

const origin = process.env.BASELINE_ORIGIN || 'https://amstreem-atlas-staging.onrender.com';
const output = resolve(process.cwd(), 'e2e/.auth/user.json');
await mkdir(resolve(process.cwd(), 'e2e/.auth'), { recursive: true });

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext();
const page = await context.newPage();
await page.goto(origin, { waitUntil: 'domcontentloaded' });

console.log('\nSign in to the unchanged staging application in the opened browser.');
console.log('Do not share your password or session with anyone.');
const prompt = createInterface({ input: stdin, output: stdout });
await prompt.question('When the authenticated workspace is visible, press Enter here to save a local-only browser session: ');
prompt.close();

if (!(await page.locator('.app-frame').count())) {
  await browser.close();
  throw new Error('No authenticated workspace detected. Sign in, then run npm run baseline:auth again.');
}
await context.storageState({ path: output });
await browser.close();
console.log('Saved local-only session to e2e/.auth/user.json (git-ignored).');
