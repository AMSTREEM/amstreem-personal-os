const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const parserSource = server.slice(
  server.indexOf('function normalizeMadinahArabic(value) {'),
  server.indexOf('function normalizeAlQuranCloud(body, page) {')
);
assert.ok(parserSource.includes('function parseAlQuranTajweed(markup)'), 'Server Tajweed parser must be present');
const context = { module: { exports: {} } };
vm.runInNewContext(parserSource + '\nmodule.exports = { parseAlQuranTajweed, normalizeMadinahArabic };', context);
const { parseAlQuranTajweed, normalizeMadinahArabic } = context.module.exports;

test('Tajweed scanner preserves nested rule tags and normalizes IndoPak letter variants', () => {
  const tokens = parseAlQuranTajweed('[h:1[بِسْمِ]][n[ٱللّٰهُ]][q:3[ق]]');
  assert.deepEqual(Array.from(tokens, token => token.className), ['tj-silent', 'tj-madd', 'tj-qalqalah']);
  assert.equal(tokens.map(token => token.text).join(''), 'بِسْمِٱللّٰهُق');
  assert.equal(normalizeMadinahArabic('\u06CC\u06A9\u06C1'), '\u064A\u0643\u0647');
  const nested = parseAlQuranTajweed('[g[م[n[د]]ّ]]');
  assert.ok(nested.some(token => token.className === 'tj-ghunnah'));
  assert.ok(nested.some(token => token.className === 'tj-madd'));
  assert.ok(nested.every(token => !/[\[\]]/.test(token.text)));
});

test('Al-Fatihah, Al-Baqarah, Al-Kahf, Ya-Sin, Al-Mulk and Al-Ikhlas tokenize every ayah and retain all provider colour tags', { timeout: 90000 }, async () => {
  const surahs = [
    { number: 1, name: 'Al-Fatihah', ayahs: 7 },
    { number: 2, name: 'Al-Baqarah', ayahs: 286 },
    { number: 18, name: 'Al-Kahf', ayahs: 110 },
    { number: 36, name: 'Ya-Sin', ayahs: 83 },
    { number: 67, name: 'Al-Mulk', ayahs: 30 },
    { number: 112, name: 'Al-Ikhlas', ayahs: 4 }
  ];
  const fetchSurah = async number => {
    const hosts = ['https://api.alquran.cloud/v1', 'https://alquran.api.islamic.network/v1'];
    let lastError;
    for (const host of hosts) {
      try {
        const response = await fetch(host + '/surah/' + number + '/quran-tajweed', { signal: AbortSignal.timeout(12000) });
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const body = await response.json();
        if (body?.code !== 200 || !Array.isArray(body?.data?.ayahs)) throw new Error('Invalid quran-tajweed response');
        return body.data.ayahs;
      } catch (error) { lastError = error; }
    }
    throw new Error('Could not fetch quran-tajweed Surah ' + number + ': ' + (lastError?.message || 'unknown error'));
  };
  const results = await Promise.all(surahs.map(async surah => {
    const ayahs = await fetchSurah(surah.number);
    assert.equal(ayahs.length, surah.ayahs, surah.name + ' ayah count');
    for (const ayah of ayahs) {
      const tokens = parseAlQuranTajweed(String(ayah.text || ''));
      assert.ok(tokens.length > 0 && tokens.some(token => token.className), surah.name + ' ' + ayah.numberInSurah + ' has no coloured Tajweed token; source=' + JSON.stringify(ayah.text));
      assert.ok(tokens.every(token => !/[\[\]]/.test(token.text)), surah.name + ' ' + ayah.numberInSurah + ' leaked a bracket');
    }
    return { name: surah.name, ayahs: ayahs.length };
  }));
  assert.equal(results.reduce((sum, item) => sum + item.ayahs, 0), 520);
});
