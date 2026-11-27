'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('every registered non-Qur’an API route receives the shared request-contract middleware', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  const wrappedMethods = source.match(/for \(const method of \['get', 'post', 'put', 'patch', 'delete', 'head', 'options'\]\)/);
  assert.ok(wrappedMethods, 'server must wrap every supported Express route registration method');
  assert.match(source, /routePath\.startsWith\('\/api\/'\)/);
  assert.match(source, /!routePath\.startsWith\('\/api\/quran\/'\)/);

  const routePattern = /app\.(get|post|put|patch|delete|head|options)\s*\(\s*(['"])(\/api\/[^'"]+)\2/g;
  const routes = [...source.matchAll(routePattern)].map(match => ({
    method: match[1],
    path: match[3]
  }));
  const quranRoutes = routes.filter(route => route.path.startsWith('/api/quran/'));
  const contractedRoutes = routes.filter(route => !route.path.startsWith('/api/quran/'));

  assert.ok(quranRoutes.length >= 2, 'Qur’an routes must remain explicitly identifiable');
  assert.ok(contractedRoutes.length >= 60, 'the route inventory should cover the current Atlas API surface');
  assert.equal(routes.length, quranRoutes.length + contractedRoutes.length);
  assert.ok(contractedRoutes.every(route => ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].includes(route.method)));
});
