const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const sql = fs.readFileSync(path.join(__dirname, '..', 'supabase-postgres-schema.sql'), 'utf8');
const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

test('Supabase migration uses the existing per-user workspace table and least-privilege RLS', () => {
  assert.match(sql, /create table if not exists public\.personal_os_workspaces/i);
  assert.match(sql, /user_id uuid primary key references auth\.users\(id\) on delete cascade/i);
  assert.match(sql, /data jsonb not null default '\{\}'::jsonb/i);
  assert.match(sql, /alter table public\.personal_os_workspaces enable row level security/i);
  assert.match(sql, /alter table public\.personal_os_workspaces force row level security/i);
  assert.match(sql, /create policy "workspace owner read"[\s\S]*?select auth\.uid\(\)/i);
  assert.match(sql, /create policy "workspace owner insert"[\s\S]*?select auth\.uid\(\)/i);
  assert.match(sql, /create policy "workspace owner update"[\s\S]*?select auth\.uid\(\)/i);
  assert.match(sql, /revoke all on table public\.personal_os_workspaces from anon, authenticated/i);
  assert.match(sql, /grant select, insert, update on table public\.personal_os_workspaces to authenticated/i);
  assert.match(sql, /revoke all privileges on all tables in schema public from anon/i);
  assert.match(sql, /alter default privileges in schema public revoke all on tables from anon/i);
  assert.match(sql, /revoke all on table public\.personal_os_profiles from anon, authenticated/i);
  assert.match(sql, /revoke all on table public\.personal_os_admins from anon, authenticated/i);
  assert.match(sql, /revoke all on table public\.personal_os_invites from anon, authenticated/i);
  assert.match(sql, /revoke execute on function public\.personal_os_is_admin\(\) from public, anon, authenticated/i);
});

test('API persists request-scoped in-memory workspaces through Supabase', () => {
  assert.match(server, /new Database\(':memory:'\)/);
  assert.match(server, /personal_os_workspaces/);
  assert.match(server, /Saved workspace is missing its/);
  assert.match(server, /select=data,version,schema_version/);
  assert.match(server, /commitWorkspaceSnapshot\(/);
  assert.match(server, /writeWorkspaceSnapshot\(user\.id, token, workspaceDb, workspaceState, req\)/);
  assert.match(server, /Idempotency-Key/);
  assert.match(server, /X-Workspace-Version/);
  assert.match(server, /version_conflict/);
  assert.doesNotMatch(server, /resolution=merge-duplicates/);
  assert.match(server, /acquireUserLock\(user\.id\)/);
  assert.doesNotMatch(server, /DATA_DIR|owner\.db|amstreem\.db/);
});

test('existing workspace export can be restored through an authenticated import route', () => {
  assert.match(server, /app\.get\('\/api\/export'/);
  assert.match(server, /app\.post\('\/api\/import'/);
  assert.match(server, /restoreBackup\(db,\s*q\.body,\s*workspaceTables\)/);
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
  assert.match(html, /id="settingsImport"/);
  assert.match(app, /api\('\/import'/);
});

test('backup restore replaces records atomically and rejects incomplete files', () => {
  const Database = require('better-sqlite3');
  const { restoreBackup } = require('../workspace-backup');
  const db = new Database(':memory:');
  db.exec('CREATE TABLE tasks (id INTEGER PRIMARY KEY, title TEXT NOT NULL, detail TEXT NOT NULL DEFAULT ""); CREATE TABLE modules (id INTEGER PRIMARY KEY, title TEXT NOT NULL);');
  db.prepare('INSERT INTO tasks(id,title) VALUES(1,?)').run('old');
  const allowed = ['tasks','modules'];
  const restored = restoreBackup(db, {
    tasks: [{id:2,title:'new task'}],
    modules: [{id:7,title:'module'}]
  }, allowed);
  assert.equal(restored, 2);
  assert.deepEqual(db.prepare('SELECT * FROM tasks').all(), [{id:2,title:'new task',detail:''}]);
  assert.throws(() => restoreBackup(db, {tasks:[{title:'missing id'}],modules:[]}, allowed), /primary key/i);
  assert.deepEqual(db.prepare('SELECT * FROM tasks').all(), [{id:2,title:'new task',detail:''}]);
  assert.throws(() => restoreBackup(db, {
    tasks:[{id:3,title:'first'},{id:3,title:'duplicate'}],
    modules:[]
  }, allowed));
  assert.deepEqual(db.prepare('SELECT * FROM tasks').all(), [{id:2,title:'new task',detail:''}]);
  db.close();
});

test('workspace schema, snapshot serializer and backup export cover the same tables', () => {
  const workspaceBlock = server.match(/const workspaceTables = \[([\s\S]*?)\];/);
  assert.ok(workspaceBlock, 'workspace table allowlist exists');
  const workspaceTables = [...workspaceBlock[1].matchAll(/'([^']+)'/g)].map(match => match[1]);
  const schemaTables = [...server.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/gi)].map(match => match[1]);
  const backupSource = fs.readFileSync(path.join(__dirname, '..', 'workspace-backup.js'), 'utf8');
  const importBlock = backupSource.match(/const importTables = \[([\s\S]*?)\];/);
  const importTables = [...importBlock[1].matchAll(/'([^']+)'/g)].map(match => match[1]);
  assert.deepEqual([...schemaTables].sort(), [...workspaceTables].sort());
  assert.deepEqual([...importTables].sort(), [...workspaceTables].sort());
  for (const table of workspaceTables) {
    assert.ok(server.includes(`${table}:all('SELECT * FROM ${table}')`), `export includes ${table}`);
  }
});

test('user-controlled goal and Quran fields are validated before rendering', () => {
  assert.match(server, /!\['active','completed','archived'\]\.includes\(status\)/);
  assert.match(server, /Number\.isInteger\(start\)/);
  assert.match(server, /Number\.isInteger\(end\)/);
  assert.match(server, /juzNumber<1\|\|juzNumber>30/);
  assert.match(server, /String\(reflection\)\.slice\(0,2000\)/);
});

test('workspace export sends the authenticated session token', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
  assert.match(app, /async function exportWorkspace\(\)[\s\S]*?Authorization:[^\n]*session\.access_token/);
  assert.doesNotMatch(app, /location\.href='\/api\/export'/);
});

test('Express adds baseline browser security headers and hides its version', () => {
  assert.match(server, /app\.disable\('x-powered-by'\)/);
  assert.match(server, /X-Content-Type-Options/);
  assert.match(server, /X-Frame-Options/);
  assert.match(server, /Referrer-Policy/);
  assert.match(server, /Permissions-Policy/);
});

test('UI safely renders values restored from imported backups', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
  assert.match(app, /safeHttpUrl=value=>/);
  assert.match(app, /href="\$\{esc\(safeHttpUrl\(r\.url\)\)\}"/);
  assert.match(app, /Ayah \$\{esc\(x\.ayah_start\)\}/);
  assert.match(app, /data-status="\$\{esc\(g\.status\)\}"/);
  assert.match(app, /self-outcome \$\{esc\(l\.outcome\)\}/);
});


test('calendar, faith practices, and religion preferences are persisted per workspace', () => {
  const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  const backup = fs.readFileSync(path.join(__dirname, '..', 'workspace-backup.js'), 'utf8');
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
  assert.match(server, /CREATE TABLE IF NOT EXISTS faith_logs/);
  assert.ok(server.includes("app.get('/api/calendar'"));
  assert.ok(server.includes("faith_logs:all('SELECT * FROM faith_logs')"));
  assert.match(backup, /'faith_logs'/);
  assert.match(html, /id="signupReligion"/);
  assert.match(html, /id="page-calendar"/);
  assert.match(html, /id="page-faith"/);
  assert.match(app, /function applyReligionVisibility/);
  assert.match(app, /function renderCalendar/);
  assert.ok(app.includes("$$('[data-calendar-date]').forEach"));
  assert.match(app, /function renderFaith/);
});

test('new achievement and weekly challenge records survive backup restore, while legacy backups remain valid', () => {
  const Database = require('better-sqlite3');
  const { restoreBackup } = require('../workspace-backup');
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE achievement_unlocks (achievement_id TEXT PRIMARY KEY, unlocked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE weekly_challenges (week_start TEXT PRIMARY KEY, challenge_id TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL, metric TEXT NOT NULL, target INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, completed_at TEXT, claimed_at TEXT);
  `);
  const tables = ['achievement_unlocks','weekly_challenges'];
  assert.equal(restoreBackup(db, {}, tables), 0);
  assert.equal(restoreBackup(db, {
    achievement_unlocks: [{achievement_id:'first-task',unlocked_at:'2026-11-19 10:00:00'}],
    weekly_challenges: [{week_start:'2026-11-16',challenge_id:'focus-1',title:'Focus week',description:'Complete focus sessions',metric:'focus_minutes',target:60}]
  }, tables), 2);
  assert.equal(db.prepare('SELECT achievement_id FROM achievement_unlocks').get().achievement_id, 'first-task');
  assert.equal(db.prepare('SELECT title FROM weekly_challenges').get().title, 'Focus week');
  db.close();
});


test('workspace history is private, visible in Atlas, and restores with a pre-restore checkpoint', () => {
  assert.match(server, /app\.get\('\/api\/history'/);
  assert.match(server, /app\.post\('\/api\/history\/snapshot'/);
  assert.match(server, /app\.post\('\/api\/history\/:id\/restore'/);
  assert.match(server, /personal_os_workspace_history\?select=id,version,schema_version,reason,created_at/);
  assert.match(server, /historyReason: 'pre_restore'/);
  assert.match(server, /historyReason: 'manual'/);
  assert.match(server, /req\.skipWorkspaceCommit/);
  const historyPage = fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'pages', 'HistoryPage.tsx'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'App.tsx'), 'utf8');
  const shell = fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'components', 'AppShell.tsx'), 'utf8');
  assert.match(historyPage, /Create snapshot/);
  assert.match(historyPage, /Restore/);
  assert.match(historyPage, /window\.confirm/);
  assert.match(historyPage, /workspace-history/);
  assert.match(app, /path="\/history"/);
  assert.match(shell, /Workspace history/);
});


test('shared API contracts validate common identifiers, dates, pagination and communication preferences', () => {
  const contracts = require('../server/api-contracts');
  assert.equal(contracts.positiveIdSchema.parse('42'), 42);
  assert.equal(contracts.positiveIdSchema.safeParse('0').success, false);
  assert.equal(contracts.dateKeySchema.safeParse('2026-11-27').success, true);
  assert.equal(contracts.dateKeySchema.safeParse('27-11-2026').success, false);
  assert.deepEqual(contracts.paginationQuerySchema.parse({}), { limit: 25, offset: 0 });
  assert.equal(contracts.paginationQuerySchema.safeParse({ limit: 1000 }).success, false);
  assert.equal(contracts.communicationStyleSchema.safeParse('advisor').success, true);
  assert.equal(contracts.communicationStyleSchema.safeParse('unrestricted').success, false);
});

test('shared API validation middleware emits RFC-style problem responses and stores parsed values', () => {
  const contracts = require('../server/api-contracts');
  const middleware = contracts.validateRequest(contracts.paginationQuerySchema, 'query');
  const req = { query: { limit: '10', offset: '5' } };
  let nextCalled = false;
  middleware(req, {}, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
  assert.deepEqual(req.validated.query, { limit: 10, offset: 5 });

  let response;
  const invalidReq = { query: { limit: '5000' } };
  const res = {
    status(value) { response = { status: value }; return this; },
    type(value) { response.contentType = value; return this; },
    json(value) { response.body = value; return this; }
  };
  middleware(invalidReq, res, () => assert.fail('next must not run for invalid input'));
  assert.equal(response.status, 400);
  assert.equal(response.contentType, 'application/problem+json');
  assert.equal(response.body.code, 'validation_error');
  assert.ok(Array.isArray(response.body.errors));
});

test('shared API problem helper uses a stable problem-details envelope', () => {
  const { sendProblem } = require('../server/api-contracts');
  let response;
  const res = {
    status(value) { response = { status: value }; return this; },
    type(value) { response.contentType = value; return this; },
    json(value) { response.body = value; return this; }
  };
  sendProblem(res, { status: 404, title: 'Not Found', detail: 'Record not found.', code: 'not_found', instance: '/api/example/1' });
  assert.equal(response.status, 404);
  assert.equal(response.contentType, 'application/problem+json');
  assert.equal(response.body.type, 'about:blank');
  assert.equal(response.body.instance, '/api/example/1');
});


test('workspace history restore validates numeric IDs before handler without committing invalid requests', () => {
  const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  const route = server.slice(server.indexOf("app.post('/api/history/:id/restore'"), server.indexOf("app.post('/api/history/:id/restore'") + 500);
  assert.match(route, /req\.skipWorkspaceCommit = true/);
  assert.match(route, /validateRequest\(require\('zod'\)\.z\.object\(\{ id: positiveIdSchema \}\), 'params'\)/);
  assert.match(route, /req\.validated\.params\.id/);
});
