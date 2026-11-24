const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

test('Mushaf offers six persistent live Arabic font previews', () => {
  const reader = read('client/src/components/QuranMushafReader.tsx');
  const html = read('client/index.html');
  for (const font of ['Amiri Quran', 'Scheherazade New', 'Noto Naskh Arabic', 'Amiri', 'Lateef', 'Aref Ruqaa']) {
    assert.ok(reader.includes(font), 'missing font option: ' + font);
    assert.ok(html.includes(font.replaceAll(' ', '+')), 'font is not loaded: ' + font);
  }
  assert.match(reader, /mushaf-font-preview-card/);
  assert.match(reader, /MUSHAF_FONT_SAMPLE/);
  assert.match(reader, /atlas_mushaf_font_family_v1/);
});

test('Mushaf Tajweed palette and key use the requested rule colours', () => {
  const css = read('client/src/styles.css');
  const reader = read('client/src/components/QuranMushafReader.tsx');
  for (const color of ['#D500B7', '#E040FB', '#FF5252', '#F43F5E', '#169200', '#22C55E', '#0091EA', '#38BDF8', '#D97706', '#F59E0B', '#9CA3AF']) {
    assert.ok(css.includes(color), 'missing Tajweed colour ' + color);
  }
  assert.match(css, /opacity:\.55/);
  assert.match(reader, /Madd Lazim/);
  assert.match(reader, /Madd Wajib/);
  assert.match(reader, /Ghunnah \/ Ikhfa \/ Idgham/);
});

test('Qur’an is directly reachable from desktop and mobile navigation and Residence', () => {
  const shell = read('client/src/components/AppShell.tsx');
  const residence = read('client/src/pages/TodayPage.tsx');
  assert.match(shell, /nav-link--quran/);
  assert.match(shell, /atlas-mobile-dock__quran/);
  assert.match(shell, /to="\/values\?openMushaf=1"/);
  assert.match(residence, /Open Qur’an · Hifz P\.\{hifzPage\}/);
  assert.ok(residence.indexOf('residence-quran-resume') < residence.indexOf('<CelestialHorizon'),
    'Hifz quick launch should sit at the top of Residence');
});

test('Google Fonts origins are allowed by the server CSP', () => {
  const server = read('server.js');
  assert.match(server, /https:\/\/googleapis\.com/);
  assert.match(server, /https:\/\/gstatic\.com/);
});
