const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

test('frozen Qur\'an route has no v2 room accent or route-transition wrapper', () => {
  const routes = read('client/src/app/routes.ts');
  const shell = read('client/src/components/AppShell.tsx');
  assert.match(routes, /'\/quran':\s*\{\s*v2:\s*false,\s*frozen:\s*true,\s*room:\s*null\s*\}/);
  assert.match(shell, /if\s*\(isQuranRoute\s*\|\|\s*!routeMeta\.room\)\s*\{\s*root\.removeAttribute\('data-room'\)/);
  assert.match(shell, /isQuranRoute\s*\?\s*\(\s*<div className="room-view-transition"><Outlet \/><\/div>\s*\)/);
  assert.match(shell, /!isQuranRoute\s*&&\s*<SparkBurst \/>/);
});

test('Qur\'an reader files and global legacy stylesheet remain unchanged by v2 styling', () => {
  const main = read('client/src/main.tsx');
  const styles = read('client/src/styles.css');
  assert.match(main, /import '\.\/styles\.css';/);
  assert.doesNotMatch(main, /import '\.\/design\/(?:shell|pages\/.*)\.css';/);
  assert.ok(styles.includes('.quran') || styles.includes('quran'));
});
