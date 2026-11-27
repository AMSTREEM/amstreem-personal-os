const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createWorkspaceRequestHash,
  commitWorkspaceSnapshot
} = require('../server/workspace-persistence');

const base = {
  supabaseUrl: 'https://staging.example.supabase.co',
  publishableKey: 'test-publishable-key',
  token: 'test-user-token',
  userId: '00000000-0000-4000-8000-000000000001',
  expectedVersion: 4,
  data: { format: 'personal-os-sqlite-snapshot-v3', schemaVersion: 3, tables: {} },
  schemaVersion: 3,
  idempotencyKey: 'test-write-key-2026',
  requestHash: 'a'.repeat(64),
  forceHistory: false,
  historyReason: 'scheduled',
  events: []
};

test('workspace request hashes are deterministic and bind method, path and body', () => {
  const first = createWorkspaceRequestHash({ method: 'PATCH', path: '/api/tasks/7', body: { done: true, title: 'A' } });
  const same = createWorkspaceRequestHash({ method: 'PATCH', path: '/api/tasks/7', body: { title: 'A', done: true } });
  const different = createWorkspaceRequestHash({ method: 'PATCH', path: '/api/tasks/8', body: { done: true, title: 'A' } });
  assert.equal(first, same);
  assert.notEqual(first, different);
  assert.match(first, /^[a-f0-9]{64}$/);
});

test('workspace commits use the authenticated RPC with version and idempotency metadata', async () => {
  let request;
  const result = await commitWorkspaceSnapshot({
    ...base,
    fetchImpl: async (url, options) => {
      request = { url, options, body: JSON.parse(options.body) };
      return { ok: true, json: async () => ({ version: 5, replayed: false }) };
    }
  });
  assert.equal(request.url, 'https://staging.example.supabase.co/rest/v1/rpc/commit_workspace_with_events');
  assert.equal(request.options.method, 'POST');
  assert.equal(request.options.headers.Authorization, 'Bearer test-user-token');
  assert.equal(request.options.headers.apikey, 'test-publishable-key');
  assert.equal(request.body.p_expected_version, 4);
  assert.equal(request.body.p_idempotency_key, 'test-write-key-2026');
  assert.equal(request.body.p_request_hash, 'a'.repeat(64));
  assert.deepEqual(request.body.p_events, []);
  assert.deepEqual(result, { version: 5, replayed: false });
});

test('workspace version conflicts are exposed for safe replay', async () => {
  await assert.rejects(
    commitWorkspaceSnapshot({
      ...base,
      fetchImpl: async () => ({
        ok: false,
        json: async () => ({ code: 'P0001', message: 'version_conflict' })
      })
    }),
    error => error.code === 'version_conflict'
  );
});

test('idempotency-key reuse and already-committed replays are not treated as new writes', async () => {
  await assert.rejects(
    commitWorkspaceSnapshot({
      ...base,
      fetchImpl: async () => ({
        ok: false,
        json: async () => ({ code: '22023', message: 'idempotency_key_reused' })
      })
    }),
    error => error.code === 'idempotency_key_reused'
  );

  await assert.rejects(
    commitWorkspaceSnapshot({
      ...base,
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({ version: 5, replayed: true })
      })
    }),
    error => error.code === 'idempotency_replayed'
  );
});
