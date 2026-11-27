'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const modulesRoot = path.join(root, 'client', 'src', 'modules');
const errors = [];
const expectedModules = ['residence', 'actions', 'goals', 'calendar', 'habits', 'learning', 'growth', 'values'];

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

for (const moduleName of expectedModules) {
  const folder = path.join(modulesRoot, moduleName);
  const manifest = path.join(folder, 'manifest.ts');
  if (!fs.existsSync(manifest)) {
    errors.push(`Module "${moduleName}" is missing its manifest.ts.`);
    continue;
  }
  const source = fs.readFileSync(manifest, 'utf8');
  if (!new RegExp(`id\\s*:\\s*['"]${moduleName}['"]`).test(source)) {
    errors.push(`Module "${moduleName}" manifest ID does not match its folder.`);
  }
}
for (const entry of fs.readdirSync(modulesRoot, { withFileTypes: true })) {
  if (entry.isDirectory() && !expectedModules.includes(entry.name)) {
    errors.push(`Unexpected module folder "${entry.name}" is not registered in the Atlas module set.`);
  }
}

for (const file of walk(modulesRoot)) {
  const source = fs.readFileSync(file, 'utf8');
  const owner = moduleFor(file);
  if (!owner) continue; // Registry and shared module types sit above feature boundaries.
  const importPattern = /(?:from\s*|import\s*\()['"]([^'"]+)['"]/g;
  for (const match of source.matchAll(importPattern)) {
    const specifier = match[1];
    if (!specifier.startsWith('.')) continue;
    const target = path.resolve(path.dirname(file), specifier);
    const relative = path.relative(modulesRoot, target).split(path.sep);
    const targetModule = relative.length > 1 ? relative[0] : null;

    if (targetModule && targetModule !== owner) {
      errors.push(`${path.relative(root, file)} imports another module (${specifier}).`);
      continue;
    }
    if (relative[0] === '..') {
      errors.push(`${path.relative(root, file)} reaches outside the module boundary (${specifier}).`);
      continue;
    }
    if (!targetModule && !['types', 'shared'].includes(path.basename(target).replace(/\.[^.]+$/, ''))) {
      errors.push(`${path.relative(root, file)} imports an undeclared shell-level module dependency (${specifier}).`);
    }
  }
}

if (errors.length) {
  console.error('Atlas module boundary violations:');
  for (const error of errors) console.error(` - ${error}`);
  process.exitCode = 1;
} else {
  console.log('Atlas module boundary check passed: module manifests and dependency boundaries are valid.');
}
