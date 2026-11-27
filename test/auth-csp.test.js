const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

test('theme initialization is an external same-origin script under strict script-src self', () => {
  const html = read('client/index.html');
  const theme = read('client/public/theme-init.js');
  assert.ok(html.includes('<script src="/theme-init.js" vite-ignore></script>'));
  assert.doesNotMatch(html, /<script>\s*\(function\s*\(\)/);
  assert.match(theme, /localStorage\.getItem\('atlas_theme'\)/);
  assert.match(theme, /document\.documentElement/);
  for (const legacy of ['abyssal-trench', 'whispering-woods', 'crimson-velvet', 'light-sage', 'light-lavender', 'light-sky']) {
    assert.ok(theme.includes(`'${legacy}'`), `missing v2 theme mapping for ${legacy}`);
  }
});

test('invalid Supabase refresh tokens clear only the current browser session', () => {
  const client = read('client/src/lib/supabase.ts');
  const auth = read('client/src/auth/AuthProvider.tsx');
  assert.match(client, /requestUrl\.pathname\.endsWith\('\/auth\/v1\/token'\)/);
  assert.match(client, /searchParams\.get\('grant_type'\) !== 'refresh_token'/);
  assert.match(client, /response\.status !== 400/);
  assert.match(client, /isInvalidRefreshTokenMessage\(message\)/);
  assert.match(client, /auth\.signOut\(\{ scope: 'local' \}\)/);
  assert.match(auth, /isInvalidRefreshTokenError\(error\)/);
  assert.match(auth, /getSession\(\)\.then/);
  assert.match(auth, /Session restore failed/);
});
