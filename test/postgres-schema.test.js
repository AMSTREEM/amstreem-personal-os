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
  assert.match(sql, /revoke all on table public\.personal_os_profiles from anon, authenticated/i);
  assert.match(sql, /revoke all on table public\.personal_os_admins from anon, authenticated/i);
  assert.match(sql, /revoke all on table public\.personal_os_invites from anon, authenticated/i);
  assert.match(sql, /revoke execute on function public\.personal_os_is_admin\(\) from public, anon, authenticated/i);
});

test('API persists request-scoped in-memory workspaces through Supabase', () => {
  assert.match(server, /new Database\(':memory:'\)/);
  assert.match(server, /personal_os_workspaces/);
  assert.match(server, /Saved workspace is missing its/);
  assert.match(server, /writeWorkspaceSnapshot\(user\.id, token, workspaceDb\)/);
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
