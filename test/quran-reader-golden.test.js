const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(process.cwd(), file), 'utf8');
const gitBlobSha = content => crypto.createHash('sha1')
  .update(Buffer.concat([Buffer.from('blob ' + Buffer.byteLength(content) + '\0'), Buffer.from(content)]))
  .digest('hex');

test('Qur’an reader source remains byte-identical to the Stage 2 protected baseline', () => {
  const protectedFiles = {
    'client/src/components/QuranMushafReader.tsx': 'c8c4dee0592ed52b1867d58cd0d6b365fb213662',
    'client/src/pages/QuranPage.tsx': '275c9c75d00c79c46be680e9270539100ebcab6f',
    'client/src/data/quranSurahs.ts': '9f487f164568aec386aac208f073708c8e3e7995'
  };
  for (const [file, expected] of Object.entries(protectedFiles)) {
    assert.equal(gitBlobSha(read(file)), expected, file + ' changed; obtain explicit reader-change approval before updating this golden');
  }
});

test('new design tokens do not select or restyle Qur’an reader internals', () => {
  const tokens = read('client/src/design/tokens.css');
  assert.doesNotMatch(tokens, /\.quran-|\.mushaf|\.tj-|UthmanicHafs|Tajweed/i);
});
