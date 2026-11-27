const crypto = require('node:crypto');

const ALLOWED_ENVIRONMENTS = new Set(['development', 'staging', 'production']);

function resolveAppEnvironment(env = process.env) {
  const value = String(env.APP_ENV || (env.NODE_ENV === 'production' ? 'production' : 'development')).trim().toLowerCase();
  if (!ALLOWED_ENVIRONMENTS.has(value)) {
    throw new Error('APP_ENV must be development, staging, or production.');
  }
  if (env.ATLAS_STAGING === 'true' && value !== 'staging') {
    throw new Error('ATLAS_STAGING=true requires APP_ENV=staging.');
  }
  return value;
}

async function checkEnvironmentMarker({
  appEnv,
  supabaseUrl,
  apiKey,
  probeToken,
  fetchImpl = fetch,
  timeoutMs = 4000
}) {
  if (appEnv === 'development') {
    return { ok: true, database: true, environment: true, skipped: true };
  }
  if (!supabaseUrl || !apiKey || !probeToken) {
    return { ok: false, reason: 'configuration_missing' };
  }

  try {
    const endpoint = new URL('/rest/v1/app_meta?select=value&key=eq.environment', supabaseUrl);
    const response = await fetchImpl(endpoint, {
      headers: {
        apikey: apiKey,
        'x-atlas-probe-token': probeToken,
        Accept: 'application/json'
      },
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!response.ok) return { ok: false, reason: 'database_unavailable' };
    const rows = await response.json();
    const marker = Array.isArray(rows) && rows.length === 1 ? rows[0]?.value : null;
    if (marker !== appEnv) return { ok: false, reason: 'environment_mismatch' };
    return { ok: true, database: true, environment: true };
  } catch {
    return { ok: false, reason: 'database_unavailable' };
  }
}

function requestLogger({ write = line => process.stdout.write(line) } = {}) {
  return (req, res, next) => {
    const requestId = crypto.randomUUID();
    const startedAt = process.hrtime.bigint();
    req.requestId = requestId;
    res.setHeader('X-Request-ID', requestId);
    res.once('finish', () => {
      const elapsedNs = process.hrtime.bigint() - startedAt;
      const accountId = req.user?.id;
      const record = {
        timestamp: new Date().toISOString(),
        level: 'info',
        event: 'http.request',
        requestId,
        method: req.method,
        path: req.baseUrl && req.route?.path ? req.baseUrl + req.route.path : req.path,
        status: res.statusCode,
        durationMs: Math.round(Number(elapsedNs) / 1e6 * 100) / 100
      };
      if (accountId) {
        record.accountHash = crypto.createHash('sha256').update(String(accountId)).digest('hex').slice(0, 16);
      }
      write(JSON.stringify(record) + '\n');
    });
    next();
  };
}

module.exports = { resolveAppEnvironment, checkEnvironmentMarker, requestLogger };
