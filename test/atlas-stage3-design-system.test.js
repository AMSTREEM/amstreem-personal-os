const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('Atlas v2 design foundation defines semantic tokens and four supported themes', () => {
  const tokens = read('client/src/design/tokens.css');
  const themes = read('client/src/design/themes.css');
  for (const token of ['--a-space-1', '--a-space-10', '--a-room', '--a-radius-xl', '--a-focus']) {
    assert.ok(tokens.includes(token), 'Missing Atlas v2 token ' + token);
  }
  for (const theme of ['obsidian', 'dusk', 'ivory', 'sahara']) {
    assert.ok(themes.includes(theme), 'Missing theme ' + theme);
  }
});

test('Atlas v2 shell owns responsive room navigation and keyboard access', () => {
  const shell = read('client/src/components/AtlasV2Shell.tsx');
  for (const room of ['Residence', 'Daily rhythm', 'Execution', 'Growth']) {
    assert.ok(shell.includes(room), 'Missing room ' + room);
  }
  assert.match(shell, /aria-label="Main navigation"/);
  assert.match(shell, /Skip to content/);
  assert.match(shell, /id="main-content"/);
  assert.match(shell, /atlas-mobile-bar/);
  assert.match(shell, /atlas-mobile-drawer/);
  assert.match(shell, /event.key.toLowerCase() === 'k'/);
});

test('Qur’an route remains separate from Atlas v2 workspace chrome', () => {
  const app = read('client/src/App.tsx');
  const shell = read('client/src/components/AtlasV2Shell.tsx');
  const containment = read('client/src/design/containment.css');
  assert.match(app, /path="\/quran"[\s\S]*QuranPage/);
  assert.doesNotMatch(shell, /QuranMushafReader/);
  assert.match(containment, /^\.atlas-v2/);
  assert.doesNotMatch(containment, /\.atlas-quran-mode/);
});
