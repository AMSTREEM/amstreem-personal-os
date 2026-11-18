const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const sql = fs.readFileSync(path.join(__dirname, '..', 'supabase-postgres-schema.sql'), 'utf8');
const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

test('Supabase migration uses the existing per-user workspace table', () => {
  assert.match(sql, /create table if not exists public\.personal_os_workspaces/i);
  assert.match(sql, /user_id uuid primary key references auth\.users\(id\) on delete cascade/i);
  assert.match(sql, /data jsonb not null default '\{\}'::jsonb/i);
  assert.match(sql, /alter table public\.personal_os_workspaces enable row level security/i);
  assert.match(sql, /alter table public\.personal_os_workspaces force row level security/i);
  assert.match(sql, /create policy personal_os_user_isolation on public\.personal_os_workspaces[\s\S]*?auth\.uid\(\)/i);
  assert.match(sql, /grant select, insert, update on public\.personal_os_workspaces to authenticated/i);
  assert.match(sql, /revoke all on public\.personal_os_workspaces from anon/i);
});

test('API persists request-scoped in-memory workspaces through Supabase', () => {
  assert.match(server, /new Database\(':memory:'\)/);
  assert.match(server, /personal_os_workspaces/);
  assert.match(server, /writeWorkspaceSnapshot\(user\.id, token, workspaceDb\)/);
  assert.match(server, /acquireUserLock\(user\.id\)/);
  assert.doesNotMatch(server, /DATA_DIR|owner\.db|amstreem\.db/);
});

test('existing workspace export can be restored through an authenticated import route', () => {
  assert.match(server, /app\.get\('\/api\/export'/);
  assert.match(server, /app\.post\('\/api\/import'/);
  assert.match(server, /db\.transaction\(\(\)=>/);
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
  assert.match(html, /id="settingsImport"/);
  assert.match(app, /api\('\/import'/);
});
