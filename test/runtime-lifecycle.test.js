const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const workflow = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'test.yml'), 'utf8');
const atlasWorkflow = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'atlas-checks.yml'), 'utf8');
const render = fs.readFileSync(path.join(__dirname, '..', 'render.yaml'), 'utf8');

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

test('readiness is distinct from liveness and Render waits for readiness', () => {
  assert.match(server, /app\.get\('\/healthz',[^\n]*status\(200\)/);
  assert.match(server, /app\.get\('\/readyz',[\s\S]*?serverReady \? 200 : 503/);
  assert.match(server, /serverReady = true/);
  assert.match(server, /shutdownStarted = true;\s*serverReady = false/);
  assert.match(render, /healthCheckPath: \/readyz/);
});

test('staging startup fails closed without its own Supabase credentials or when pointed at production', () => {
  assert.match(server, /process\.env\.ATLAS_STAGING === 'true'/);
  assert.match(server, /!process\.env\.SUPABASE_URL \|\| !process\.env\.SUPABASE_PUBLISHABLE_KEY/);
  assert.match(server, /Staging requires its own Supabase URL and publishable key/);
  assert.match(server, /skjxwzmpajdcrfacwoap/);
  assert.match(server, /Staging must never connect to the production Supabase project/);
  assert.match(server, /new URL\(supabaseConfig\.url\)/);
});

test('Stage 0 CI fetches the base history and blocks protected Qur’an reader changes', () => {
  assert.match(workflow, /fetch-depth: 0/);
  assert.match(workflow, /check:boundaries/);
  assert.match(atlasWorkflow, /check:frozen/);
  assert.match(atlasWorkflow, /check-contrast/);
  assert.match(atlasWorkflow, /npm run build/);
  const lock = fs.readFileSync(path.join(__dirname, '..', 'FROZEN.lock.json'), 'utf8');
  assert.match(lock, /QuranMushafReader/);
  assert.match(lock, /quranSurahs/);
});
