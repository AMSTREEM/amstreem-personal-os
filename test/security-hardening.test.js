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

test('production installs dependencies, builds the frontend, and CI audits production dependencies', () => {
  assert.match(workflow, /npm install/);
  assert.match(workflow, /npm audit --omit=dev --audit-level=high/);
  assert.match(render, /buildCommand: npm install && npm run build/);
  assert.match(render, /healthCheckPath: \/healthz/);
});


test('Residence pins saved priorities, completes them inline, and links focus to the selected task', () => {
  const residence = fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'pages', 'TodayPage.tsx'), 'utf8');
  const focus = fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'pages', 'FocusPage.tsx'), 'utf8');
  assert.match(residence, /YOUR PINNED TOP 3/);
  assert.match(residence, /priorityTaskIds\.map\(id => tasks\.data\?\.find\(task => task\.id === id\)\)/);
  assert.match(residence, /toggleTask\.mutate\(task\)/);
  assert.match(residence, /residence-pinned-focus[^\n]*to=\{'\/focus\?task=' \+ task\.id\}/);
  assert.match(residence, /onMutate: async task/);
  assert.match(focus, /params\.get\('task'\)/);
  assert.match(residence, /dailyReview\?\.alignment_complete && !editingAlignment/);
  assert.match(residence, /yesterdayReview\?\.shutdown_complete && yesterdayReview\.next_focus\?\.trim\(\)/);
  assert.match(residence, /showShutdownPrompt \? /);
});
