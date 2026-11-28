const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

const root = path.join(__dirname, '..');
const tokens = fs.readFileSync(path.join(root, 'client/src/design/tokens.css'), 'utf8');
const themeInit = fs.readFileSync(path.join(root, 'client/public/theme-init.js'), 'utf8');
const readerStyles = fs.readFileSync(path.join(root, 'client/src/styles.css'), 'utf8');
const shell = fs.readFileSync(path.join(root, 'client/src/components/AppShell.tsx'), 'utf8');
const main = fs.readFileSync(path.join(root, 'client/src/main.tsx'), 'utf8');
const motionProvider = fs.readFileSync(path.join(root, 'client/src/design/MotionPreferenceProvider.tsx'), 'utf8');

function cssBlock(source, selector) {
  const start = source.indexOf(selector);
  assert.notEqual(start, -1, 'Missing CSS selector: ' + selector);
  const open = source.indexOf('{', start);
  const close = source.indexOf('}', open);
  assert.ok(open > start && close > open, 'Malformed CSS block: ' + selector);
  return source.slice(open + 1, close);
}
function cssValue(block, name) {
  const line = block.split(/\r?\n/).find(value => value.trim().startsWith(name + ':'));
  if (!line) return null;
  const value = line.slice(line.indexOf(':') + 1).trim().replace(/;$/, '');
  return /^#[0-9A-Fa-f]{6}$/.test(value) ? value : null;
}
function luminance(hex) {
  const rgb = hex.match(/[0-9a-f]{2}/gi).map(value => parseInt(value, 16) / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}
function contrast(a, b) {
  const values = [luminance(a), luminance(b)].sort((left, right) => right - left);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test('Atlas design tokens define dark/light foundations, typography, spacing and motion', () => {
  const dark = cssBlock(tokens, ':root {');
  const light = cssBlock(tokens, ':root[data-theme^="light-"]');
  assert.match(dark, /--atlas-brand:\s*#22D3EE/);
  assert.match(dark, /--atlas-surface-3:\s*#1D2733/);
  assert.match(dark, /--atlas-border-strong:\s*#34465A/);
  assert.match(light, /--atlas-brand:\s*#0891B2/);
  assert.match(light, /--atlas-surface-3:\s*#E7E3DA/);
  assert.match(light, /--atlas-border-strong:\s*#C4BEB0/);
  assert.ok(light.includes('--atlas-border: #DDD8CD;'));
  assert.ok(light.includes('--atlas-text-1: #121C27;'));
  assert.ok(light.includes('--atlas-text-2: #3A4A5E;'));
  for (const token of ['--atlas-space-10: 64px','--atlas-duration-slow: 320ms','--atlas-radius-xl: 24px','--atlas-font-ui:']) assert.ok(dark.includes(token), 'Missing '+token);
});

test('all nine module text accents meet WCAG AA contrast on dark and light surfaces', () => {
  const dark = cssBlock(tokens, ':root {');
  const light = cssBlock(tokens, ':root[data-theme^="light-"]');
  for (const module of ['residence','actions','goals','calendar','habits','learning','growth','values','quran']) {
    const d = cssValue(dark, '--atlas-module-' + module);
    const l = cssValue(light, '--atlas-module-' + module);
    assert.ok(d && contrast(d, '#0A0E13') >= 4.5, 'Dark accent fails AA: '+module);
    assert.ok(l && contrast(l, '#F6F4EF') >= 4.5, 'Light accent fails AA: '+module);
  }
});

test('standard shell consumes Atlas tokens while Qur’an shell remains opt-out', () => {
  assert.ok(shell.includes(`location.pathname === '/quran' ? " atlas-quran-shell" : " atlas-standard-shell"`));
  assert.ok(readerStyles.includes('.atlas-standard-shell {') && readerStyles.includes('--accent: var(--atlas-brand);'));
  assert.ok(!readerStyles.includes('.atlas-quran-shell {'));
  assert.doesNotMatch(tokens, /quran-mobile-shell|mushaf-desktop|tj-madd|tajweed/i);
  for (const variable of ['--accent','--accent-strong','--bg','--bg-canvas','--bg-surface','--border-hairline','--mushaf-user-font-size','--muted','--text','--text-primary','--text-secondary']) assert.ok(readerStyles.includes('var(' + variable));
});

test('Qur’an reader source fingerprints remain byte-for-byte protected', () => {
  const expected = {
    'client/src/components/QuranMushafReader.tsx': 'c8c4dee0592ed52b1867d58cd0d6b365fb213662',
    'client/src/pages/QuranPage.tsx': '275c9c75d00c79c46be680e9270539100ebcab6f',
    'client/src/data/quranSurahs.ts': '9f487f164568aec386aac208f073708c8e3e7995'
  };
  for (const [relative, hash] of Object.entries(expected)) {
    const bytes = fs.readFileSync(path.join(root, relative));
    const actual = createHash('sha1').update(Buffer.concat([Buffer.from('blob '+bytes.length+String.fromCharCode(0)), bytes])).digest('hex');
    assert.equal(actual, hash, 'Protected Qur’an source changed: '+relative);
  }
});

test('motion preferences are restored before paint and applied to all motion components', () => {
  assert.match(themeInit, /atlas-motion-preference/);
  assert.match(themeInit, /data-motion/);
  assert.match(main, /AtlasMotionProvider/);
  assert.match(motionProvider, /MotionConfig reducedMotion=/);
  assert.match(motionProvider, /atlas:motion-preference-change/);
  assert.match(readerStyles, /data-motion="reduced"/);
});

test('theme bootstrap has a deterministic dark fallback', () => {
  assert.ok(themeInit.includes("localStorage.getItem('atlas_theme') || 'shadowed-alchemist'"));
  assert.ok(themeInit.includes("'shadowed-alchemist': '#0A0E13'"));
});


test('Atlas UI loads its variable Inter font locally and the service worker caches hashed font assets', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  const main = fs.readFileSync(path.join(__dirname, '..', 'client/src/main.tsx'), 'utf8');
  const worker = fs.readFileSync(path.join(__dirname, '..', 'public/service-worker.js'), 'utf8');
  const styles = fs.readFileSync(path.join(__dirname, '..', 'client/src/styles.css'), 'utf8');
  assert.equal(packageJson.dependencies['@fontsource-variable/inter'], '^5.3.0');
  assert.match(main, /@fontsource-variable\/inter\/wght\.css/);
  assert.match(styles, /\.atlas-standard-shell \{ font-family: var\(--atlas-font-ui\); \}/);
  assert.match(worker, /\(\?:js\|css\|woff2\)/);
  assert.match(worker, /pathname\.startsWith\('\/fonts\/'\) \|\| \/quran\|tajweed\|recitation/);
});
