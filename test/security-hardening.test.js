const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const workflow = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'test.yml'), 'utf8');
const render = fs.readFileSync(path.join(__dirname, '..', 'render.yaml'), 'utf8');

test('API has bounded request bodies and a separate backup-import allowance', () => {
  assert.match(server, /app\.use\('\/api\/import', express\.json\(\{\s*limit:\s*'10mb'/);
  assert.match(server, /app\.use\(express\.json\(\{\s*limit:\s*'1mb'/);
  assert.doesNotMatch(server, /app\.use\(express\.json\(\{\s*limit:\s*'10mb'/);
});

test('API and admin endpoints have per-IP and per-account request limits', () => {
  assert.match(server, /app\.use\('\/api', rateLimit\(\{ max: 120 \}\)\)/);
  assert.match(server, /app\.use\('\/api\/admin', rateLimit\(\{ max: 30/);
  assert.match(server, /consumeRateLimit\(\`account:\$\{user\.id\}\`, 90\)/);
  assert.match(server, /status\(429\)/);
});

test('health endpoint does not require authentication', () => {
  assert.match(server, /app\.get\('\/healthz',[\s\S]*?status\(200\)\.json\(\{ ok: true \}\)/);
});

test('browser responses have CSP, HSTS in production, and no-store API responses', () => {
  assert.match(server, /Content-Security-Policy/);
  assert.match(server, /frame-ancestors 'none'/);
  assert.match(server, /Strict-Transport-Security/);
  assert.match(server, /Cache-Control','no-store'/);
  assert.match(server, /Cross-Origin-Opener-Policy/);
});

test('production installs are reproducible and CI audits production dependencies', () => {
  assert.match(workflow, /npm ci/);
  assert.match(workflow, /npm audit --omit=dev --audit-level=high/);
  assert.match(render, /buildCommand: npm ci/);
});
