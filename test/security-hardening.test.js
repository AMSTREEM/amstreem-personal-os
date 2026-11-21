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


test('Daily Rhythm records persist per workspace and remain compatible with older snapshots and exports', () => {
  const backup = fs.readFileSync(path.join(__dirname, '..', 'workspace-backup.js'), 'utf8');
  assert.match(server, /'self_control_entries','rhythm_records','email_events'/);
  assert.match(server, /'faith_logs','rhythm_records','login_events'/);
  assert.match(server, /CREATE TABLE IF NOT EXISTS rhythm_records/);
  assert.match(server, /values\.faith_tradition=values\.faith_tradition\|\|values\.religion/);
  assert.match(server, /'faith_tradition','leaderboard_name'/);
  assert.match(server, /app\.post\('\/api\/rhythm\/records'/);
  assert.match(server, /app\.get\('\/api\/rhythm\/summary'/);
  assert.match(server, /rhythm_records:all\('SELECT \* FROM rhythm_records'\)/);
  assert.match(backup, /'self_control_entries','rhythm_records','settings'/);
  assert.match(backup, /'feedback_logs','rhythm_records'\]\./);
});

test('Daily Rhythm separates planned from completed records and updates Residence Activity Pulse', () => {
  const rhythm = fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'pages', 'ValuesPage.tsx'), 'utf8');
  const residence = fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'pages', 'TodayPage.tsx'), 'utf8');
  const focus = fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'pages', 'FocusPage.tsx'), 'utf8');
  assert.match(rhythm, /status: 'planned'\|'completed'\|'active'\|'answered'/);
  assert.match(rhythm, /value="qada"/);
  assert.match(rhythm, /Jumu’ah checklist/);
  assert.match(rhythm, /P-R-A-Y Reflection|P-R-A-Y REFLECTION/);
  assert.match(rhythm, /Start Qur’an Focus/);
  assert.match(rhythm, /Start Devotional Focus/);
  assert.match(rhythm, /Clarity & Reflection/);
  assert.match(rhythm, /invalidateQueries\(\{ queryKey: \['rhythm-summary'\] \}\)/);
  assert.match(residence, /api<RhythmSummary>\('\/rhythm\/summary\?date='/);
  assert.match(residence, /rhythmSummary\.data\?\.completed/);
  assert.match(residence, /CLARITY & REFLECTION/);
  assert.match(focus, /get\('focus'\)/);
});

test('Self-Control consistency uses dated records and positive habit check-ins, not assumed streak days', () => {
  const selfControl = fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'pages', 'SelfControlPage.tsx'), 'utf8');
  const rituals = fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'pages', 'RitualsPage.tsx'), 'utf8');
  const shell = fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'components', 'AppShell.tsx'), 'utf8');
  assert.match(server, /FROM self_control_entries WHERE log_date>=date\(\?,'-29 days'\)/);
  assert.match(server, /FROM habit_logs WHERE log_date>=date\(\?,'-29 days'\)/);
  assert.match(server, /let best=0,run=0,previous=null/);
  assert.match(selfControl, /ROLLING CONSISTENCY/);
  assert.match(selfControl, /LAST 30 DAYS/);
  assert.match(selfControl, /habits\.data\?\.length/);
  assert.match(selfControl, /verified clean check-ins/);
  assert.match(rituals, /invalidateQueries\(\{ queryKey: \['self-control'\] \}\)/);
  assert.match(shell, /Deen & Reflection/);
  assert.match(shell, /Faith & Devotion/);
  assert.match(shell, /Clarity & Reflection/);
});
