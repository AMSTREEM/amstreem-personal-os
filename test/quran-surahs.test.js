const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Qur’an reference contains all 114 Surahs for the 604-page Madani Mushaf', () => {
  const source = fs.readFileSync(path.join(__dirname, '../client/src/data/quranSurahs.ts'), 'utf8');
  const match = source.match(/export const quranSurahs: QuranSurah\[\] = (\[[\s\S]*?\]);/);
  assert.ok(match, 'typed Surah array should be present');
  const surahs = JSON.parse(match[1]);

  assert.equal(surahs.length, 114);
  assert.deepEqual(surahs.map((surah) => surah.number), Array.from({ length: 114 }, (_, index) => index + 1));
  assert.equal(surahs.reduce((total, surah) => total + surah.ayahCount, 0), 6236);
  for (const surah of surahs) {
    assert.ok(surah.name && surah.arabicName);
    assert.ok(surah.ayahCount > 0);
    assert.ok(surah.startPage >= 1 && surah.startPage <= 604);
    assert.ok(surah.endPage >= surah.startPage && surah.endPage <= 604);
    assert.ok(surah.juz >= 1 && surah.juz <= 30);
  }

  assert.equal(surahs[0].name, 'Al-Fatihah');
  assert.equal(surahs[1].name, 'Al-Baqarah');
  assert.equal(surahs[113].name, 'An-Nas');
  assert.deepEqual(
    [surahs[0].ayahCount, surahs[0].startPage, surahs[0].endPage],
    [7, 1, 1]
  );
  assert.deepEqual(
    [surahs[1].ayahCount, surahs[1].startPage, surahs[1].endPage],
    [286, 2, 49]
  );
  assert.deepEqual(
    [surahs[113].ayahCount, surahs[113].startPage, surahs[113].endPage],
    [6, 604, 604]
  );

  const juzMatch = source.match(/export const quranJuzBoundaries = (\[[\s\S]*?\]) as const;/);
  assert.ok(juzMatch, '30 Juz start boundaries should be present');
  const juzBoundaries = JSON.parse(juzMatch[1]);
  assert.equal(juzBoundaries.length, 30);
  assert.deepEqual(juzBoundaries[1], { juz: 2, surah: 2, ayah: 142 });
  assert.deepEqual(juzBoundaries[29], { juz: 30, surah: 78, ayah: 1 });
});


test('Hifz logging clamps ayahs and derives pages and Juz from the selected Surah', () => {
  const values = fs.readFileSync(path.join(__dirname, '../client/src/pages/ValuesPage.tsx'), 'utf8');
  assert.match(values, /max=\{selectedSurah\?\.ayahCount \|\| 1\}/);
  assert.match(values, /getJuzForAyah\(selectedSurah\.number,Number\(bounded\)\)/);
  assert.match(values, /selectedSurah\.endPage-selectedSurah\.startPage\+1/);
  assert.match(values, /setPagesManuallyEdited\(true\)/);
});
