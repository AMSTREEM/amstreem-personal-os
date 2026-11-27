const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createBackupEnvelope, unwrapBackup, summarizeBackup } = require('../workspace-backup');

test('Atlas backup envelopes carry a verifiable checksum and schema version', () => {
  const data = { goals: [{ id: 1, title: 'Keep' }], quran_logs: [{ id: 2, surah: 'Al-Baqarah' }] };
  const backup = createBackupEnvelope(data);
  assert.equal(backup.format, 'atlas-backup');
  assert.equal(backup.schemaVersion, 4);
  assert.equal(unwrapBackup(backup).quran_logs[0].surah, 'Al-Baqarah');
});

test('tampered and unsupported backup envelopes are rejected before restore', () => {
  const backup = createBackupEnvelope({ goals: [] });
  backup.data.goals.push({ id: 99 });
  assert.throws(() => unwrapBackup(backup), /checksum/);
  assert.throws(() => unwrapBackup({ ...createBackupEnvelope({}), schemaVersion: 99 }), /unsupported schema/);
});

test('legacy backup exports remain importable and summaries count records without changing them', () => {
  const legacy = { goals: [{ id: 1 }, { id: 2 }], quran_logs: [{ id: 3 }] };
  assert.equal(unwrapBackup(legacy), legacy);
  const summary = summarizeBackup(legacy, ['goals', 'quran_logs']);
  assert.deepEqual(summary, { goals: 2, quran_logs: 1 });
});

test('version 4 backups include external activity history without restoring it as a workspace table', () => {
  const backup = createBackupEnvelope({ goals: [], activity_events: [{ key: 'event-key-001' }] });
  assert.equal(backup.schemaVersion, 4);
  assert.deepEqual(summarizeBackup(backup, ['goals']), { goals: 0, activity_events: 1 });
});

test('oversized backup payloads are rejected', () => {
  assert.throws(() => unwrapBackup({ notes: 'x'.repeat(10 * 1024 * 1024 + 1) }), /10 MB/);
});

test('Stage 1 uses atomic versioned RPC commits and protects failed mutations', () => {
  const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  assert.match(server, /personal_os_workspaces\?select=data,version,schema_version/);
  assert.match(server, /\/rest\/v1\/rpc\/commit_workspace_with_events/);
  assert.match(server, /p_expected_version: expectedVersion/);
  assert.match(server, /res\.statusCode >= 400/);
  assert.match(server, /\/api\/import\/preview/);
  assert.match(server, /dryRun:true/);
  assert.match(server, /VERSION_CONFLICT/);
  assert.match(server, /replayWorkspaceMutation\(baseSnapshot, snapshot, latest\.data\)/);
  assert.match(server, /attempt < 3/);
  assert.match(server, /Idempotency-Key/);
});

test('Stage 1 migration contains account-scoped CAS, history retention and idempotency', () => {
  const transport = fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'lib', 'idempotency.ts'), 'utf8');
  const main = fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'main.tsx'), 'utf8');
  assert.match(transport, /Idempotency-Key/);
  assert.match(transport, /crypto\.randomUUID\(\)/);
  assert.match(transport, /api\/quran/);
  assert.match(main, /installApiIdempotency/);
  const migration = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', '20261127110000_atlas_stage1_versioned_workspace_writes.sql'), 'utf8');
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /version = p_expected_version/);
  assert.match(migration, /personal_os_workspace_history/);
  assert.match(migration, /interval '6 hours'/);
  assert.match(migration, /interval '90 days'/);
  assert.match(migration, /personal_os_workspace_idempotency/);
  assert.match(migration, /auth\.uid\(\)/);
  assert.match(migration, /force row level security/i);
});

test('migration runner refuses to run outside the isolated staging environment', () => {
  const runner = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'migrate.js'), 'utf8');
  assert.match(runner, /ATLAS_STAGING !== 'true'/);
  assert.match(runner, /SUPABASE_PROJECT_REF/);
  assert.match(runner, /SUPABASE_DB_PASSWORD/);
  assert.match(runner, /skjxwzmpajdcrfacwoap/);
});
