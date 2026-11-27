const crypto = require('node:crypto');

const required = ['ATLAS_STAGE1_CONFIRM_DRILL','ATLAS_STAGE1_STAGING_URL','SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','ATLAS_STAGE1_TEST_TOKEN','ATLAS_STAGE1_TEST_USER_ID'];
for (const key of required) if (!process.env[key]) throw new Error(`Missing ${key}. This drill must use a dedicated staging test account.`);
if (process.env.ATLAS_STAGE1_CONFIRM_DRILL !== 'true') throw new Error('Set ATLAS_STAGE1_CONFIRM_DRILL=true only after confirming the account is disposable staging test data.');
if (!process.env.ATLAS_STAGE1_STAGING_URL.includes('onrender.com')) throw new Error('The drill only supports the Render staging URL.');

const base = process.env.SUPABASE_URL.replace(/\/$/, '');
const api = process.env.ATLAS_STAGE1_STAGING_URL.replace(/\/$/, '');
const token = process.env.ATLAS_STAGE1_TEST_TOKEN;
const userId = process.env.ATLAS_STAGE1_TEST_USER_ID;
const headers = { apikey: process.env.SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
const key = label => `atlas-stage1-${label}-${crypto.randomUUID()}`;
const hash = value => crypto.createHash('sha256').update(value).digest('hex');

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
async function appRequest(path, body) {
  return request(`${api}${path}`, { method: 'PATCH', body: JSON.stringify(body) });
}

(async () => {
  // Exercise the deployed HTTP middleware with two simultaneous, independent settings edits.
  const beforeSettings = await appRequest('/api/settings', {}).catch(async error => {
    // PATCH empty payload is still a safe read of the current settings response in this app.
    throw error;
  });
  const originalTheme = beforeSettings.theme || 'shadowed-alchemist';
  const originalTarget = String(beforeSettings.daily_target || '80');
  const testTheme = originalTheme === 'light-porcelain' ? 'shadowed-alchemist' : 'light-porcelain';
  const testTarget = originalTarget === '97' ? '98' : '97';
  const parallel = await Promise.all([
    appRequest('/api/settings', { theme: testTheme }),
    appRequest('/api/settings', { daily_target: testTarget })
  ]);
  if (parallel.some(result => !result || typeof result !== 'object')) throw new Error('Parallel settings requests returned unexpected results.');
  const afterParallel = await appRequest('/api/settings', {});
  if (afterParallel.theme !== testTheme || String(afterParallel.daily_target) !== testTarget) {
    throw new Error('Parallel-write check failed: one independent settings change was lost.');
  }
  await appRequest('/api/settings', { theme: originalTheme, daily_target: originalTarget });

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
