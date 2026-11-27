'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const modulesRoot = path.join(root, 'client', 'src', 'modules');
const errors = [];

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(full) : /\.[cm]?[jt]sx?$/.test(entry.name) ? [full] : [];
  });
}

function moduleFor(file) {
  const relative = path.relative(modulesRoot, file).split(path.sep);
  return relative.length > 1 ? relative[0] : null;
}

for (const file of walk(modulesRoot)) {
  const source = fs.readFileSync(file, 'utf8');
  const owner = moduleFor(file);
  const importPattern = /(?:from\s*|import\s*\()['"]([^'"]+)['"]/g;
  for (const match of source.matchAll(importPattern)) {
    const specifier = match[1];
    if (!specifier.startsWith('.')) continue;
    const target = path.resolve(path.dirname(file), specifier);
    const relative = path.relative(modulesRoot, target).split(path.sep);
    const targetModule = relative.length > 1 ? relative[0] : null;
    if (targetModule && targetModule !== owner) {
      errors.push(`${path.relative(root, file)} imports another module (${specifier}).`);
    }
  }
}

if (errors.length) {
  console.error('Atlas module boundary violations:');
  for (const error of errors) console.error(` - ${error}`);
  process.exitCode = 1;
} else {
  console.log('Atlas module boundary check passed.');
}
