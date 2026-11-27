const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveAppEnvironment, checkEnvironmentMarker } = require('../server/runtime-guard');

test('environment defaults to development locally and production on hosted Node runtime', () => {
  assert.equal(resolveAppEnvironment({}), 'development');
  assert.equal(resolveAppEnvironment({ NODE_ENV: 'production' }), 'production');
  assert.equal(resolveAppEnvironment({ APP_ENV: 'staging', NODE_ENV: 'production' }), 'staging');
});

test('staging cannot be labelled as production or development', () => {
  assert.throws(() => resolveAppEnvironment({ ATLAS_STAGING: 'true', APP_ENV: 'production' }), /requires APP_ENV=staging/);
  assert.throws(() => resolveAppEnvironment({ APP_ENV: 'preview' }), /APP_ENV must be/);
});

test('environment marker passes only when the database matches the application environment', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => [{ value: 'staging' }] });
  const result = await checkEnvironmentMarker({
    appEnv: 'staging',
    supabaseUrl: 'https://example.supabase.co',
    apiKey: 'test-key',
    fetchImpl
  });
  assert.deepEqual(result, { ok: true, database: true, environment: true });
});

test('environment marker fails closed on a mismatch or missing configuration', async () => {
  const mismatch = await checkEnvironmentMarker({
    appEnv: 'staging',
    supabaseUrl: 'https://example.supabase.co',
    apiKey: 'test-key',
    fetchImpl: async () => ({ ok: true, json: async () => [{ value: 'production' }] })
  });
  assert.deepEqual(mismatch, { ok: false, reason: 'environment_mismatch' });

  const missing = await checkEnvironmentMarker({ appEnv: 'production' });
  assert.deepEqual(missing, { ok: false, reason: 'configuration_missing' });
});

test('environment marker treats unreachable database as not ready', async () => {
  const result = await checkEnvironmentMarker({
    appEnv: 'production',
    supabaseUrl: 'https://example.supabase.co',
    apiKey: 'test-key',
    fetchImpl: async () => ({ ok: false })
  });
  assert.deepEqual(result, { ok: false, reason: 'database_unavailable' });
});
