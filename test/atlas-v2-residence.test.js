import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Residence route uses the clean-slate v2 dashboard', async () => {
  const app = await readFile(new URL('../client/src/App.tsx', import.meta.url), 'utf8');
  assert.match(app, /const ResidenceV2Page = lazy\(\(\) => import\('\.\/pages\/ResidenceV2Page'/);
  assert.match(app, /path="\/residence" element={<SuspendedPage><ResidenceV2Page \/><\/SuspendedPage>}/);
});

test('Qur’an route remains mounted through the original reader shell', async () => {
  const app = await readFile(new URL('../client/src/App.tsx', import.meta.url), 'utf8');
  assert.match(app, /<Route path="\/quran" element={<AppShell \/>}>\s*<Route index element={<QuranPage \/>} \/>/);
});

test('Residence redesign uses Atlas UI primitives and namespaced styles', async () => {
  const [page, css] = await Promise.all([
    readFile(new URL('../client/src/pages/ResidenceV2Page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../client/src/pages/residence-v2.css', import.meta.url), 'utf8')
  ]);
  for (const primitive of ['AtlasCard', 'AtlasButton', 'AtlasBadge', 'AtlasProgress', 'AtlasEmptyState']) assert.match(page, new RegExp(primitive));
  assert.match(css, /\.atlas-v2 \.a-residence/);
  assert.match(css, /prefers-reduced-motion/);
  assert.doesNotMatch(css, /(^|\n)\.atlas-dashboard/);
});
