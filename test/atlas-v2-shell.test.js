const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

test('authenticated non-Qur\'an routes use the independent Atlas v2 shell', () => {
  const app = read('client/src/App.tsx');
  const shell = read('client/src/components/AtlasV2Shell.tsx');
  assert.match(app, /<Route element={<AtlasV2Shell \/>}>/);
  assert.match(app, /<Route path="\/quran" element={<AppShell \/>}>/);
  assert.match(app, /<Route index element={<QuranPage \/>} \/>/);
  assert.match(shell, /className="atlas-v2 a-shell"/);
  assert.match(shell, /<Outlet \/>/);
});

test('new shell exposes all four rooms, specialist Qur\'an access, and account controls', () => {
  const shell = read('client/src/components/AtlasV2Shell.tsx');
  for (const route of ['/residence', '/blueprint', '/daily-rhythm', '/values', '/habits', '/actions', '/calendar', '/goals', '/learning-library', '/growth', '/quran', '/settings']) {
    assert.ok(shell.includes(route), 'missing navigation destination: ' + route);
  }
  assert.match(shell, /role === 'admin'/);
  assert.match(shell, /signOut\(\)/);
  assert.match(shell, /setCommandOpen/);
});

test('Atlas v2 shell is responsive and uses namespaced design tokens', () => {
  const css = read('client/src/design/shell.css');
  assert.match(css, /\.a-shell/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /\.a-mobile-bar/);
  assert.match(css, /\.a-command-backdrop/);
  assert.match(css, /var\(--a-bg\)/);
  assert.match(css, /var\(--a-surface-1\)/);
});
