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
  assert.ok(nested.some(token => token.className === 'tj-madd-necessary'));
  assert.ok(nested.every(token => !/[\[\]]/.test(token.text)));
});

test('All 114 Surahs cover all 6,236 Ayahs and the complete 604-page Madani Mushaf', { timeout: 240000 }, async () => {
  const queue = Array.from({ length: 114 }, (_, index) => index + 1);
  const pageNumbers = new Set();
  const verseKeys = new Set();
  const missingMarkup = [];
  const mismatchedText = [];
  const uncoloredByBoth = [];
  const mirrorRecoveries = [];
  let totalAyahs = 0;
  let coloredAyahs = 0;
  const normalize = value => normalizeMadinahArabic(String(value || '').replace(/<[^>]+>/g, ''))
    .normalize('NFKC')
    .replace(/[\\s\\u0640\\u064B-\\u065F\\u0670\\u06D6-\\u06ED]/g, '')
    .replace(/[ٱأإآ]/g, 'ا')
    .replace(/ى/g, 'ي');
  const fetchOfficialSurah = async number => {
    const query = '?mushaf=19&words=true&word_fields=text_uthmani_tajweed,page_number,char_type_name&fields=verse_key,chapter_id,verse_number,page_number,text_uthmani,text_uthmani_tajweed&per_page=300';
    const urls = [
      'https://api.quran.com/api/v4/verses/by_chapter/' + number + query,
      'https://quran.com/api/proxy/content/api/qdc/verses/by_chapter/' + number + query
    ];
    let lastError;
    for (const url of urls) {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const response = await fetch(url, { signal: AbortSignal.timeout(20000), headers: { Accept: 'application/json' } });
          if (!response.ok) throw new Error('HTTP ' + response.status);
          const body = await response.json();
          if (!Array.isArray(body?.verses) || !body.verses.length) throw new Error('No verse rows');
          return body.verses;
        } catch (error) { lastError = error; }
      }
    }
    throw new Error('Quran.com could not supply Surah ' + number + ': ' + (lastError?.message || 'unknown error'));
  };
  const fetchMirrorSurah = async number => {
    const hosts = ['https://api.alquran.cloud/v1', 'https://alquran.api.islamic.network/v1'];
    for (const host of hosts) {
      try {
        const response = await fetch(host + '/surah/' + number + '/quran-tajweed', { signal: AbortSignal.timeout(20000) });
        if (!response.ok) continue;
        const body = await response.json();
        if (body?.code === 200 && Array.isArray(body?.data?.ayahs)) return body.data.ayahs;
      } catch { /* try the next public mirror */ }
    }
    return [];
  };
  const worker = async () => {
    while (queue.length) {
      const number = queue.shift();
      if (!number) return;
      const verses = await fetchOfficialSurah(number);
      const mirrorByAyah = new Map();
      const needsMirror = verses.some(verse => {
        const markup = String(verse.text_uthmani_tajweed || (verse.words || []).map(word => word.text_uthmani_tajweed || '').join(' '));
        return !parseAlQuranTajweed(markup).some(token => token.className);
      });
      if (needsMirror) {
        const mirror = await fetchMirrorSurah(number);
        mirror.forEach(ayah => mirrorByAyah.set(Number(ayah.numberInSurah), String(ayah.text || '')));
      }
      for (let index = 0; index < verses.length; index += 1) {
        const verse = verses[index];
        const verseNumber = Number(verse.verse_number);
        const key = String(verse.verse_key || (number + ':' + verseNumber));
        assert.equal(verseNumber, index + 1, 'Surah ' + number + ' has a missing or out-of-order Ayah at ' + (index + 1));
        assert.ok(!verseKeys.has(key), 'Duplicate Qur’an verse ' + key);
        verseKeys.add(key);
        totalAyahs += 1;
        const page = Number(verse.page_number || (verse.words || []).find(word => word.page_number)?.page_number);
        assert.ok(Number.isInteger(page) && page >= 1 && page <= 604, 'Invalid Madani page number for ' + key + ': ' + page);
        pageNumbers.add(page);
        const markup = String(verse.text_uthmani_tajweed || (verse.words || []).map(word => word.text_uthmani_tajweed || '').join(' '));
        let tokens = parseAlQuranTajweed(markup);
        if (!tokens.length) missingMarkup.push(key);
        const plain = String(verse.text_uthmani || '');
        if (plain && tokens.length && normalize(tokens.map(token => token.text).join('')) !== normalize(plain)) mismatchedText.push(key);
        if (tokens.some(token => token.className)) {
          coloredAyahs += 1;
          continue;
        }
        const mirrorMarkup = mirrorByAyah.get(verseNumber) || '';
        const mirrorTokens = parseAlQuranTajweed(mirrorMarkup);
        if (mirrorTokens.some(token => token.className) && (!plain || normalize(mirrorTokens.map(token => token.text).join('')) === normalize(plain))) {
          mirrorRecoveries.push(key);
          coloredAyahs += 1;
        } else {
          uncoloredByBoth.push(key);
        }
      }
    }
  };
  await Promise.all(Array.from({ length: 5 }, () => worker()));
  const missingPages = Array.from({ length: 604 }, (_, index) => index + 1).filter(page => !pageNumbers.has(page));
  assert.equal(totalAyahs, 6236, 'The audit must cover every Qur’an Ayah');
  assert.equal(verseKeys.size, 6236, 'Every Ayah must appear exactly once');
  assert.equal(pageNumbers.size, 604, 'Every Madani page must contain mapped verses');
  assert.deepEqual(missingPages, [], 'Every one of the 604 page numbers must be covered');
  assert.deepEqual(missingMarkup, [], 'Every Ayah must have source Tajweed text');
  assert.deepEqual(mismatchedText, [], 'Tajweed markup must preserve the canonical Arabic text');
  console.info('Full Quran Tajweed audit:', JSON.stringify({
    ayahs: totalAyahs, pages: pageNumbers.size, colouredAyahs: coloredAyahs,
    mirrorRecoveries: mirrorRecoveries.length, uncolouredByBoth: uncoloredByBoth.length,
    uncolouredAyahKeys: uncoloredByBoth
  }));
});

test('page Tajweed edition fills only matching unmarked ayahs without replacing existing annotations', () => {
  const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  const start = server.indexOf('function normalizeMadinahArabic(value) {');
  const end = server.indexOf('async function fetchAlQuranCloudPage(page) {');
  assert.ok(start >= 0 && end > start, 'Page Tajweed merge helpers must be present');
  const context = { module: { exports: {} } };
  vm.runInNewContext(server.slice(start, end) + '\nmodule.exports = { parseAlQuranTajweed, mergeTajweedEdition };', context);
  const { parseAlQuranTajweed: parse, mergeTajweedEdition } = context.module.exports;
  const markup = '[g[بِسْمِ]][n[ اللَّهِ]]';
  const segments = parse(markup);
  const page = { page: 1, ayahs: [
    { surahNumber: 1, numberInSurah: 1, text: 'بِسْمِ اللَّهِ', tajweedSegments: [{ text: 'بِسْمِ اللَّهِ', className: '' }] },
    { surahNumber: 1, numberInSurah: 2, text: 'ٱلْحَمْدُ لِلَّٰهِ', tajweedSegments: [{ text: 'ٱلْحَمْدُ لِلَّٰهِ', className: 'tj-ghunnah' }] },
    { surahNumber: 1, numberInSurah: 3, text: 'مَالِكِ يَوْمِ الدِّينِ', tajweedSegments: [{ text: 'مَالِكِ يَوْمِ الدِّينِ', className: '' }] }
  ] };
  const annotations = new Map([
    ['1:1', { markup, segments }],
    ['1:3', { markup: '[n[نصٌّ مختلف]]', segments: parse('[n[نصٌّ مختلف]]') }]
  ]);
  const merged = mergeTajweedEdition(page, annotations);
  assert.equal(merged.ayahs[0].tajweedSource, 'quran-tajweed');
  assert.ok(merged.ayahs[0].tajweedSegments.some(segment => segment.className === 'tj-ghunnah'));
  assert.equal(merged.ayahs[1].tajweedSegments[0].className, 'tj-ghunnah', 'Existing provider annotations must remain untouched');
  assert.equal(merged.ayahs[2].tajweedSegments[0].className, '', 'Mismatched edition text must never be overlaid');
  assert.equal(merged.tajweedComplete, false);
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
  const parsed = parseAlQuranTajweed(html.replace(/<\/tajweed><tajweed/g, '</tajweed> <tajweed'));
  assert.deepEqual(Array.from(parsed.filter(token => token.className), token => token.className), expected);
  const shortcode = '[h[ٱ]][s[ا]][n[ـٰ]][p[ي]][m[ا]][o[ا]][q[ق]][f[ن]][c[م]][i[ن]][w[م]][a[ن]][u[ل]][d[ت]][b[ق]][g[ن]]';
  assert.deepEqual(Array.from(parseAlQuranTajweed(shortcode.replace(/\]\]\[/g, ']] [')).filter(token => token.className), token => token.className), expected);
  assert.equal(parsed.map(token => token.text).join('').replace(/\s/g, ''), 'ٱاـٰيااقنمنمنلتقن');
});
