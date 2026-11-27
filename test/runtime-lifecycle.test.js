const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

test('HTTP server shuts down gracefully on SIGTERM and SIGINT', () => {
  assert.match(server, /const httpServer = app\.listen\(PORT/);
  assert.match(server, /function shutdown\(signal\)/);
  assert.match(server, /if \(shutdownStarted\) return/);
  assert.match(server, /httpServer\.close\(error =>/);
  assert.match(server, /httpServer\.closeIdleConnections\?\.\(\)/);
  assert.match(server, /httpServer\.closeAllConnections\?\.\(\)/);
  assert.match(server, /process\.once\('SIGTERM'/);
  assert.match(server, /process\.once\('SIGINT'/);
  assert.match(server, /10_000/);
});

test('the lightweight unauthenticated health endpoint remains available', () => {
  assert.match(server, /app\.get\('\/healthz',[\s\S]*?status\(200\)\.json\(\{ ok: true \}\)/);
});
