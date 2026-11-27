const crypto = require('node:crypto');

function stableSerialize(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableSerialize).join(',') + ']';
  return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + stableSerialize(value[key])).join(',') + '}';
}

function createWorkspaceRequestHash({ method, path, body }) {
  const source = stableSerialize({
    method: String(method || 'POST').toUpperCase(),
    path: String(path || ''),
    body: body === undefined ? null : body
  });
  return crypto.createHash('sha256').update(source).digest('hex');
}

async function commitWorkspaceSnapshot({
  supabaseUrl,
  publishableKey,
  token,
  userId,
  expectedVersion,
  data,
  schemaVersion = 3,
  idempotencyKey,
  requestHash,
  forceHistory = false,
  historyReason = 'scheduled',
  events = [],
  fetchImpl = fetch
}) {
  const response = await fetchImpl(`${supabaseUrl}/rest/v1/rpc/commit_workspace_with_events`, {
    method: 'POST',
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({
      p_user_id: userId,
      p_expected_version: expectedVersion,
      p_data: data,
      p_schema_version: schemaVersion,
      p_idempotency_key: idempotencyKey,
      p_request_hash: requestHash,
      p_force_history: forceHistory,
      p_history_reason: historyReason,
      p_events: events
    })
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.message || 'Supabase rejected the workspace commit.';
    const error = new Error(message);
    error.code = message === 'version_conflict'
      ? 'version_conflict'
      : message === 'idempotency_key_reused'
        ? 'idempotency_key_reused'
        : 'workspace_commit_failed';
    throw error;
  }

  if (payload?.replayed) {
    const error = new Error('This save was already committed. Refresh to see the latest workspace.');
    error.code = 'idempotency_replayed';
    throw error;
  }

  const version = Number(payload?.version);
  if (!Number.isSafeInteger(version) || version < 1) {
    const error = new Error('Supabase returned an invalid workspace version.');
    error.code = 'workspace_commit_invalid_response';
    throw error;
  }
  return { ...payload, version };
}

module.exports = { stableSerialize, createWorkspaceRequestHash, commitWorkspaceSnapshot };
