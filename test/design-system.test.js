const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

const root = path.join(__dirname, '..');
const tokens = fs.readFileSync(path.join(root, 'client/src/design/tokens.css'), 'utf8');
const themeInit = fs.readFileSync(path.join(root, 'client/public/theme-init.js'), 'utf8');
const readerStyles = fs.readFileSync(path.join(root, 'client/src/styles.css'), 'utf8');

function cssBlock(source, selector) {
  const start = source.indexOf(selector);
  assert.notEqual(start, -1, 'Missing CSS selector: ' + selector);
  const open = source.indexOf('{', start);
  const close = source.indexOf('}', open);
  assert.ok(open > start && close > open, 'Malformed CSS block: ' + selector);
  return source.slice(open + 1, close);
}

function cssValue(block, name) {
  const match = block.match(new RegExp('(?:^|\\s)' + name.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&') + ':\\s*(#[0-9A-Fa-f]{6})'));
  return match?.[1] || null;
}

function luminance(hex) {
  const rgb = hex.match(/[0-9a-f]{2}/gi).map(value => parseInt(value, 16) / 255).map(value =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  );
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

function contrast(a, b) {
  const values = [luminance(a), luminance(b)].sort((left, right) => right - left);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test('Atlas design tokens define the agreed dark and light foundations', () => {
  const dark = cssBlock(tokens, ':root {');
  const light = cssBlock(tokens, ':root[data-theme^="light-"]');
  assert.match(dark, /--atlas-brand:\s*#22D3EE/);
  assert.match(dark, /--atlas-surface-3:\s*#1D2733/);
  assert.match(dark, /--atlas-border-strong:\s*#34465A/);
  assert.match(dark, /--atlas-text-1:\s*var\\(--text, #EAF0F6\\)/);
  assert.match(light, /--atlas-brand:\s*#0891B2/);
  assert.match(light, /--atlas-surface-3:\s*#E7E3DA/);
  assert.match(light, /--atlas-border-strong:\s*#C4BEB0/);
  assert.match(tokens, /--atlas-space-11:\s*64px/);
  assert.match(tokens, /--atlas-duration-slow:\s*320ms/);
});

test('every module accent meets WCAG AA contrast for its text colour', () => {
  const dark = cssBlock(tokens, ':root {');
  const light = cssBlock(tokens, ':root[data-theme^="light-"]');
  const modules = ['residence','actions','goals','calendar','habits','learning','growth','values','quran'];
  for (const module of modules) {
    const darkColor = cssValue(dark, '--atlas-module-' + module);
    const lightColor = cssValue(light, '--atlas-module-' + module);
    assert.ok(darkColor, 'Missing dark accent for ' + module);
    assert.ok(lightColor, 'Missing light text accent for ' + module);
    assert.ok(contrast(darkColor, '#0A0E13') >= 4.5, 'Dark accent fails AA: ' + module);
    assert.ok(contrast(lightColor, '#F6F4EF') >= 4.5, 'Light accent fails AA: ' + module);
  }
});

test('design tokens stay isolated from legacy Qur’an reader variables and selectors', () => {
  for (const legacyToken of ['--bg:', '--surface:', '--accent:', '--accent-strong:', '--text:', '--muted:']) {
    assert.equal(tokens.includes(legacyToken), false, 'Design tokens must not redefine ' + legacyToken);
  }
  assert.doesNotMatch(tokens, /quran-mobile-shell|mushaf-desktop|tj-madd|tajweed/i);
  for (const readerVariable of ['--accent','--accent-strong','--bg','--bg-canvas','--bg-surface','--border-hairline','--mushaf-user-font-size','--muted','--text','--text-primary','--text-secondary']) {
    assert.ok(readerStyles.includes('var(' + readerVariable), 'Reader variable disappeared: ' + readerVariable);
  }
});

test('protected Qur’an source files retain their recorded baseline hashes', () => {
  const expected = {
    'client/src/components/QuranMushafReader.tsx': 'c8c4dee0592ed52b1867d58cd0d6b365fb213662',
    'client/src/pages/QuranPage.tsx': '275c9c75d00c79c46be680e9270539100ebcab6f',
    'client/src/data/quranSurahs.ts': '9f487f164568aec386aac208f073708c8e3e7995'
  };
  for (const [relative, expectedHash] of Object.entries(expected)) {
    const content = fs.readFileSync(path.join(root, relative));
    const header = Buffer.from('blob ' + content.length + '\0');
    const actual = createHash('sha1').update(Buffer.concat([header, content])).digest('hex');
    assert.equal(actual, expectedHash, 'Protected reader baseline changed: ' + relative);
  }
});

test('theme bootstrap applies a safe default and restores accessibility preferences before first paint', () => {
  assert.match(themeInit, /localStorage\\.getItem\\('atlas_theme'\\) \\|\\| 'shadowed-alchemist'/);
  assert.match(themeInit, /'shadowed-alchemist': '#0A0E13'/);
  assert.match(themeInit, /atlas-motion-preference/);
  assert.match(themeInit, /data-motion/);
});
