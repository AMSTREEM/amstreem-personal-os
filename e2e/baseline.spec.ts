import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const viewports = [
  { name: '390x844', width: 390, height: 844 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '1440x900', width: 1440, height: 900 }
];

const quranThemes = [
  { name: 'light', legacy: 'light-porcelain' },
  { name: 'dark', legacy: 'shadowed-alchemist' }
];

const residenceThemes = [
  { name: 'obsidian', legacy: 'shadowed-alchemist' },
  { name: 'dusk', legacy: 'nocturnal-amethyst' },
  { name: 'ivory', legacy: 'light-porcelain' },
  { name: 'sahara', legacy: 'light-sandstone' }
];

const routeThemes = [
  { name: 'obsidian', legacy: 'shadowed-alchemist' },
  { name: 'ivory', legacy: 'light-porcelain' }
];

const routes = [
  { name: 'residence', path: '/residence', themes: residenceThemes },
  { name: 'today', path: '/daily-rhythm', themes: routeThemes },
  { name: 'actions', path: '/actions', themes: routeThemes },
  { name: 'calendar', path: '/calendar', themes: routeThemes },
  { name: 'growth', path: '/growth', themes: routeThemes },
  { name: 'settings', path: '/settings', themes: routeThemes },
  { name: 'quran', path: '/quran', themes: quranThemes }
];

const outputDir = resolve(process.cwd(), 'docs/frozen/baseline');

test.beforeAll(async () => {
  await mkdir(outputDir, { recursive: true });
});

for (const route of routes) {
  for (const viewport of viewports) {
    for (const theme of route.themes) {
      test(`${route.name} — ${viewport.name} — ${theme.name}`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.addInitScript((legacyTheme) => {
          localStorage.setItem('atlas_theme', legacyTheme);
        }, theme.legacy);

        await page.goto(route.path, { waitUntil: 'domcontentloaded' });
        const shell = page.locator('.app-frame');
        try {
          await expect(shell).toBeVisible({ timeout: 15_000 });
        } catch {
          throw new Error(
            'Authenticated workspace not available. Run npm run baseline:auth, then npm run baseline:screenshots.'
          );
        }

        await page.evaluate(async () => {
          if (document.fonts?.ready) await document.fonts.ready;
        });
        await page.waitForTimeout(700);
        const file = resolve(outputDir, `${route.name}-${viewport.name}-${theme.name}.png`);
        await page.screenshot({
          path: file,
          fullPage: true,
          animations: 'disabled',
          caret: 'hide'
        });
      });
    }
  }
}
