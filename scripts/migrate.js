const { spawnSync } = require('node:child_process');

function fail(message) {
  console.error('[atlas-migrate] ' + message);
  process.exit(1);
}

if (process.env.ATLAS_STAGING !== 'true') {
  fail('Refusing to run migrations unless ATLAS_STAGING=true.');
}
const projectRef = process.env.SUPABASE_PROJECT_REF;
if (!projectRef || !/^[a-z]{20}$/.test(projectRef)) {
  fail('Set SUPABASE_PROJECT_REF to the staging project ref.');
}
if (projectRef === 'skjxwzmpajdcrfacwoap') {
  fail('Refusing to run against the production Supabase project.');
}
if (!process.env.SUPABASE_ACCESS_TOKEN || !process.env.SUPABASE_DB_PASSWORD) {
  fail('Set SUPABASE_ACCESS_TOKEN and SUPABASE_DB_PASSWORD in your secure shell environment.');
}

function run(args) {
  const result = spawnSync('npx', ['--yes', 'supabase', ...args], {
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32'
  });
  if (result.error) fail(result.error.message);
  if (result.status !== 0) process.exit(result.status || 1);
}

run(['link', '--project-ref', projectRef, '--password', process.env.SUPABASE_DB_PASSWORD]);
run(['db', 'push', '--linked']);
