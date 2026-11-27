const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('Stage 3 design tokens are semantic and isolated to the authenticated workspace shell', () => {
  const tokens = read('client/src/styles/atlas-tokens.css');
  const renaissance = read('client/src/styles/atlas-renaissance.css');
  for (const token of [
    '--atlas-shell-canvas', '--atlas-shell-sidebar', '--atlas-shell-surface',
    '--atlas-shell-border', '--atlas-shell-ink', '--atlas-shell-accent',
    '--atlas-space-1', '--atlas-space-10', '--atlas-radius-card',
    '--atlas-shadow-floating', '--atlas-motion-standard'
  ]) assert.ok(tokens.includes(token), 'Missing design token ' + token);
  assert.match(tokens, /^\/\*[\s\S]*?\*\/\s*\.app-frame\.atlas-renaissance\s*\{/);
  assert.match(renaissance, /^@import ['"]\.\/atlas-tokens\.css['"];/);
  assert.match(renaissance, /--bg:\s*var\(--atlas-shell-canvas\)/);
  assert.match(renaissance, /--sidebar:\s*var\(--atlas-shell-sidebar\)/);
  assert.match(renaissance, /--radius:\s*var\(--atlas-radius-card\)/);
});

test('desktop, mobile and command navigation share one typed four-room registry', () => {
  const navigation = read('client/src/shell/navigation.ts');
  const shell = read('client/src/components/AppShell.tsx');
  assert.match(navigation, /export const rooms: AtlasRoom\[\] = \[/);
  assert.match(navigation, /export const commandDestinations: AtlasDestination\[\] = \[/);
  for (const room of ['Residence', 'Daily Rhythm', 'Execution & Focus', 'Growth & Direction']) {
    assert.ok(navigation.includes("label: '" + room + "'"), 'Missing room ' + room);
  }
  for (const view of ['Faith & Practice', 'Habits & Self-Control', 'Projects & Tasks', 'Calendar', 'Goals & Milestones', 'Learning & Library', 'Reviews & Insights']) {
    assert.ok(navigation.includes("label: '" + view + "'"), 'Missing view ' + view);
  }
  assert.match(shell, /from '\.\.\/shell\/navigation'/);
  assert.match(shell, /rooms\.map\(item =>/);
  assert.match(shell, /rooms\.map\(\(item,index\) =>/);
  assert.match(shell, /commandDestinations\.map/);
  assert.match(shell, /atlas-mobile-dock/);
  assert.match(shell, /\^\[1-4\]\$/);
  assert.doesNotMatch(shell, /const rooms = \[/);
  assert.doesNotMatch(shell, /const commandDestinations = \[/);
});

test('unified shell exposes keyboard skip navigation and named landmarks without wrapping the Qur’an reader in workspace chrome', () => {
  const shell = read('client/src/components/AppShell.tsx');
  const app = read('client/src/App.tsx');
  const tokens = read('client/src/styles/atlas-tokens.css');
  const styles = read('client/src/styles/atlas-renaissance.css');
  assert.match(shell, /Skip to content/);
  assert.match(shell, /id="atlas-main-content"/);
  assert.match(shell, /aria-label="Atlas workspace navigation"/);
  assert.match(shell, /data-atlas-shell=/);
  assert.match(app, /path="\/quran" element=\{<QuranPage \/>\}/);
  assert.match(shell, /location\.pathname === "\/quran" \? "atlas-quran-mode" : "atlas-renaissance"/);
  assert.match(tokens, /\.app-frame\.atlas-renaissance/);
  assert.doesNotMatch(tokens, /quran|tajweed/i);
  assert.match(styles, /\.atlas-skip-link:focus/);
  assert.doesNotMatch(styles, /\.atlas-quran-mode/);
});
