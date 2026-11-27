const fs = require('node:fs');
const path = require('node:path');
const { gzipSync } = require('node:zlib');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
const manifestPath = path.join(dist, '.vite', 'manifest.json');
const INITIAL_BUDGET = 180 * 1024;
const MODULE_BUDGET = 120 * 1024;

if (!fs.existsSync(manifestPath)) {
  console.error('Bundle budget check: Vite manifest is missing.');
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const entry = Object.entries(manifest).find(([key, item]) =>
  item.isEntry && (key.endsWith('main.tsx') || item.src?.endsWith('main.tsx'))
);
if (!entry) {
  console.error('Bundle budget check: main.tsx entry was not found.');
  process.exit(1);
}

const visited = new Set();
const initialFiles = [];
function collectStatic(key) {
  if (visited.has(key)) return;
  visited.add(key);
  const item = manifest[key];
  if (!item) throw new Error('Missing manifest import: ' + key);
  if (item.file?.endsWith('.js')) initialFiles.push(item.file);
  for (const dependency of item.imports || []) collectStatic(dependency);
}
collectStatic(entry[0]);

const gzipSize = file => gzipSync(fs.readFileSync(path.join(dist, file))).length;
const initialGzip = initialFiles.reduce((total, file) => total + gzipSize(file), 0);
const initialSet = new Set(initialFiles);
const moduleChunks = Object.values(manifest)
  .filter(item => item.file?.endsWith('.js') && !initialSet.has(item.file))
  .map(item => ({ file: item.file, gzip: gzipSize(item.file) }))
  .filter((item, index, all) => all.findIndex(candidate => candidate.file === item.file) === index)
  .sort((a, b) => b.gzip - a.gzip);

console.log('Initial JavaScript: ' + (initialGzip / 1024).toFixed(1) + ' KB gzip (budget 180 KB)');
for (const chunk of moduleChunks) {
  console.log('Module chunk: ' + chunk.file + ' — ' + (chunk.gzip / 1024).toFixed(1) + ' KB gzip (budget 120 KB)');
}

const oversized = moduleChunks.filter(chunk => chunk.gzip > MODULE_BUDGET);
if (initialGzip > INITIAL_BUDGET || oversized.length) {
  if (initialGzip > INITIAL_BUDGET) console.error('Initial JavaScript exceeds the 180 KB gzip budget.');
  for (const chunk of oversized) console.error('Module chunk exceeds the 120 KB gzip budget: ' + chunk.file);
  process.exit(1);
}
