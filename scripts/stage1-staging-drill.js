const crypto = require('node:crypto');

const required = ['ATLAS_STAGE1_CONFIRM_DRILL','ATLAS_STAGE1_STAGING_URL','SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','ATLAS_STAGE1_TEST_TOKEN','ATLAS_STAGE1_TEST_USER_ID'];
for (const key of required) if (!process.env[key]) throw new Error(`Missing ${key}. This drill must use a dedicated staging test account.`);
if (process.env.ATLAS_STAGE1_CONFIRM_DRILL !== 'true') throw new Error('Set ATLAS_STAGE1_CONFIRM_DRILL=true only after confirming the account is disposable staging test data.');
if (new URL(process.env.ATLAS_STAGE1_STAGING_URL).hostname !== 'amstreem-atlas-staging.onrender.com') throw new Error('The drill only supports the Atlas staging service.');
if (new URL(process.env.SUPABASE_URL).hostname !== 'yllzeblecyqnncgktnjw.supabase.co') throw new Error('The drill only supports the isolated Atlas staging Supabase project.');

const base = process.env.SUPABASE_URL.replace(/\/$/, '');
const api = process.env.ATLAS_STAGE1_STAGING_URL.replace(/\/$/, '');
const token = process.env.ATLAS_STAGE1_TEST_TOKEN;
const userId = process.env.ATLAS_STAGE1_TEST_USER_ID;
const headers = { apikey: process.env.SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
const key = label => `atlas-stage1-${label}-${crypto.randomUUID()}`;
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const { replayWorkspaceMutation } = require('../workspace-replay');

async function request(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { ...headers, ...(options.headers || {}) } });
  const raw = await response.text();
  let body = null;
  try { body = raw ? JSON.parse(raw) : null; } catch { body = raw; }
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${body?.message || body?.error || raw}`);
  return body;
}
async function getWorkspace() {
  const rows = await request(`${base}/rest/v1/personal_os_workspaces?select=data,version,schema_version&user_id=eq.${encodeURIComponent(userId)}`);
  if (!rows?.length) throw new Error('The dedicated test account has no existing workspace; refusing to create one during the drill.');
  return rows[0];
}
async function commit(expected, data, label, forceHistory = false, reason = 'scheduled') {
  const idem = key(label);
  const body = {
    p_expected_version: Number(expected),
    p_data: data,
    p_schema_version: 3,
    p_idempotency_key: idem,
    p_request_hash: hash(JSON.stringify({ expected, data, label })),
    p_force_history: forceHistory,
    p_history_reason: reason
  };
  return request(`${base}/rest/v1/rpc/commit_workspace`, { method: 'POST', body: JSON.stringify(body) });
}
async function appRequest(path, body, method = 'PATCH') {
  return request(`${api}${path}`, { method, ...(method === 'GET' ? {} : { body: JSON.stringify(body) }) });
}

(async () => {
  // Race two writes from the same version, then replay the loser on the winner's snapshot.
  const concurrencyBase = await getWorkspace();
  const writeA = JSON.parse(JSON.stringify(concurrencyBase.data));
  const writeB = JSON.parse(JSON.stringify(concurrencyBase.data));
  writeA.tables.settings ||= [];
  writeB.tables.settings ||= [];
  writeA.tables.settings.push({ key: 'atlas_stage1_concurrency_a', value: key('a') });
  writeB.tables.settings.push({ key: 'atlas_stage1_concurrency_b', value: key('b') });
  const raced = await Promise.allSettled([
    commit(concurrencyBase.version, writeA, 'parallel-a'),
    commit(concurrencyBase.version, writeB, 'parallel-b')
  ]);
  const winners = raced.filter(result => result.status === 'fulfilled');
  const losers = raced.filter(result => result.status === 'rejected');
  if (winners.length !== 1 || losers.length !== 1 || !String(losers[0].reason.message).includes('version_conflict')) {
    throw new Error('Concurrent compare-and-swap did not produce exactly one winner and one stale-write conflict.');
  }
  const winnerSnapshot = await getWorkspace();
  const losingMutation = raced[0].status === 'rejected' ? writeA : writeB;
  const replayedSnapshot = replayWorkspaceMutation(concurrencyBase.data, losingMutation, winnerSnapshot.data);
  await commit(winnerSnapshot.version, replayedSnapshot, 'parallel-replay');
  const afterReplay = await getWorkspace();
  const settings = new Map(afterReplay.data.tables.settings.map(row => [row.key, row.value]));
  if (!settings.has('atlas_stage1_concurrency_a') || !settings.has('atlas_stage1_concurrency_b')) {
    throw new Error('Parallel-write check failed: replay did not preserve both independent writes.');
  }
  await commit(afterReplay.version, concurrencyBase.data, 'parallel-cleanup', true, 'pre_restore');

  // Create a pre-destructive history point, mutate a harmless sentinel, then restore the exact snapshot.
  const initial = await getWorkspace();
  const initialData = initial.data;
  const historyCommit = await commit(initial.version, initialData, 'history-seed', true, 'manual');
  const changed = JSON.parse(JSON.stringify(initialData));
  changed.tables ||= {};
  changed.tables.settings ||= [];
  changed.tables.settings = changed.tables.settings.filter(row => row.key !== 'atlas_stage1_restore_drill');
  changed.tables.settings.push({ key: 'atlas_stage1_restore_drill', value: key('sentinel') });
  const mutation = await commit(historyCommit.version, changed, 'restore-sentinel');
  const points = await request(`${base}/rest/v1/personal_os_workspace_history?select=id,version,schema_version,snapshot,reason&user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc&limit=20`);
  const point = (points || []).find(item => item.version === Number(initial.version) && item.reason === 'manual');
  if (!point || JSON.stringify(point.snapshot) !== JSON.stringify(initialData)) throw new Error('History snapshot does not match the pre-change workspace.');
  await commit(mutation.version, point.snapshot, 'restore-history', true, 'pre_restore');
  const restored = await getWorkspace();
  if (JSON.stringify(restored.data) !== JSON.stringify(initialData)) throw new Error('History restore did not reproduce the original workspace snapshot.');
  console.log(JSON.stringify({ parallelWrites: 'passed', historyCapture: 'passed', restore: 'passed', finalVersion: restored.version, testUser: userId }, null, 2));
})().catch(error => { console.error('[stage1-drill]', error.message); process.exitCode = 1; });
