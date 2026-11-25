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
  assert.deepEqual(Array.from(tokens, token => token.className), ['tj-silent', 'tj-madd-normal', 'tj-qalqalah']);
  assert.equal(tokens.map(token => token.text).join(''), 'بِسْمِٱللّٰهُق');
  assert.equal(normalizeMadinahArabic('\u06CC\u06A9\u06C1'), '\u064A\u0643\u0647');
  const nested = parseAlQuranTajweed('[g[م[m[د]]ّ]]');
  assert.ok(nested.some(token => token.className === 'tj-ghunnah'));
  assert.ok(nested.some(token => token.className === 'tj-madd'));
  assert.ok(nested.every(token => !/[\[\]]/.test(token.text)));
});

test('Six selected Surahs tokenize every ayah and retain all provider colour tags', { timeout: 90000 }, async () => {
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
        const response = await fetch(host + '/surah/' + number + '/editions/quran-tajweed,en.sahih', { signal: AbortSignal.timeout(15000) });
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const body = await response.json();
        if (body?.code !== 200 || !Array.isArray(body?.data)) throw new Error('Invalid quran-tajweed editions response');
        const tajweed = body.data.find(item => item.edition?.identifier === 'quran-tajweed');
        if (!Array.isArray(tajweed?.ayahs)) throw new Error('Missing quran-tajweed edition');
        return tajweed.ayahs;
      } catch (error) { lastError = error; }
    }
    throw new Error('Could not fetch quran-tajweed Surah ' + number + ': ' + (lastError?.message || 'unknown error'));
  };
  const results = await Promise.all(surahs.map(async surah => {
    const ayahs = await fetchSurah(surah.number);
    assert.equal(ayahs.length, surah.ayahs, surah.name + ' ayah count');
    let fallbackByAyah = new Map();
    if (ayahs.some(ayah => !parseAlQuranTajweed(String(ayah.text || '')).some(token => token.className))) {
      const query = '?mushaf=19&words=true&translations=20&word_fields=text_uthmani_tajweed,verse_key,char_type_name&fields=text_uthmani_tajweed,verse_key,chapter_id,verse_number&per_page=300';
      const fallbackResponse = await fetch('https://api.quran.com/api/v4/verses/by_chapter/' + surah.number + query, { signal: AbortSignal.timeout(15000) });
      assert.ok(fallbackResponse.ok, surah.name + ' Quran.com Tajweed fallback request failed');
      const fallbackBody = await fallbackResponse.json();
      fallbackByAyah = new Map((fallbackBody.verses || []).map(verse => [Number(verse.verse_number), String(verse.text_uthmani_tajweed || (verse.words || []).map(word => word.text_uthmani_tajweed || '').join(' '))]));
    }
    let colouredAyahs = 0;
    for (const ayah of ayahs) {
      let tokens = parseAlQuranTajweed(String(ayah.text || ''));
      if (!tokens.some(token => token.className)) tokens = parseAlQuranTajweed(fallbackByAyah.get(Number(ayah.numberInSurah)) || '');
      assert.ok(tokens.length > 0, surah.name + ' ' + ayah.numberInSurah + ' produced no parsed Tajweed tokens');
      if (tokens.some(token => token.className)) colouredAyahs += 1;
      else assert.equal(surah.number + ':' + ayah.numberInSurah, '18:85', 'Only Al-Kahf 18:85 is unmarked by both upstream Tajweed datasets');
      assert.ok(tokens.every(token => !/[\[\]]/.test(token.text)), surah.name + ' ' + ayah.numberInSurah + ' leaked a bracket');
    }
    assert.equal(colouredAyahs, surah.number === 18 ? surah.ayahs - 1 : surah.ayahs, surah.name + ' provider-coloured ayah coverage');
    return { name: surah.name, ayahs: ayahs.length, colouredAyahs };
  }));
  assert.equal(results.reduce((sum, item) => sum + item.ayahs, 0), 520);
  assert.equal(results.reduce((sum, item) => sum + item.colouredAyahs, 0), 519);
  console.info('Direct Tajweed coverage by Surah:', JSON.stringify(results));
});


test('every Quran Foundation HTML rule and quran-tajweed shortcode maps to its correct Tajweed family', () => {
  const html = '<tajweed class=ham_wasl>ٱ</tajweed><tajweed class=slnt>ا</tajweed>' +
    '<tajweed class=madda_normal>ـٰ</tajweed><tajweed class=madda_permissible>ي</tajweed>' +
    '<tajweed class=madda_necessary>ا</tajweed><tajweed class=madda_obligatory>ا</tajweed>' +
    '<tajweed class=qalaqah>ق</tajweed><tajweed class=ikhafa>ن</tajweed>' +
    '<tajweed class=ikhafa_shafawi>م</tajweed><tajweed class=iqlab>ن</tajweed>' +
    '<tajweed class=idgham_shafawi>م</tajweed><tajweed class=idgham_ghunnah>ن</tajweed>' +
    '<tajweed class=idgham_wo_ghunnah>ل</tajweed><tajweed class=idgham_mutajanisayn>ت</tajweed>' +
    '<tajweed class=idgham_mutaqaribayn>ق</tajweed><tajweed class=ghunnah>ن</tajweed>';
  const expected = [
    'tj-silent','tj-silent','tj-madd-normal','tj-madd-permissible','tj-madd-necessary',
    'tj-madd-obligatory','tj-qalqalah','tj-ikhfa','tj-ikhfa-shafawi','tj-iqlab',
    'tj-idgham-shafawi','tj-idgham-ghunnah','tj-idgham-no-ghunnah',
    'tj-idgham-mutajanisayn','tj-idgham-mutaqaribayn','tj-ghunnah'
  ];
  const parsed = parseAlQuranTajweed(html);
  assert.deepEqual(Array.from(parsed.filter(token => token.className), token => token.className), expected);
  const shortcode = '[h[ٱ]][s[ا]][n[ـٰ]][p[ي]][m[ا]][o[ا]][q[ق]][f[ن]][c[م]][i[ن]][w[م]][a[ن]][u[ل]][d[ت]][b[ق]][g[ن]]';
  assert.deepEqual(Array.from(parseAlQuranTajweed(shortcode).filter(token => token.className), token => token.className), expected);
  assert.equal(parsed.map(token => token.text).join('').replace(/\\s/g, ''), 'ٱاـٰيااقنمنمنلتقن');
});
