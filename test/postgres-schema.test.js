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
  assert.match(sql, /revoke all privileges on all tables in schema public from anon/i);
  assert.match(sql, /alter default privileges in schema public revoke all on tables from anon/i);
  assert.match(sql, /revoke all on table public\.personal_os_profiles from anon, authenticated/i);
  assert.match(sql, /revoke all on table public\.personal_os_admins from anon, authenticated/i);
  assert.match(sql, /revoke all on table public\.personal_os_invites from anon, authenticated/i);
  assert.match(sql, /revoke execute on function public\.personal_os_is_admin\(\) from public, anon, authenticated/i);
});

test('API persists request-scoped in-memory workspaces through Supabase', () => {
  assert.match(server, /new Database\(':memory:'\)/);
  assert.match(server, /personal_os_workspaces/);
  assert.match(server, /Saved workspace is missing its/);
  assert.match(server, /select=data,version,schema_version/);
  assert.match(server, /commitWorkspaceSnapshot\(/);
  assert.match(server, /writeWorkspaceSnapshot\(user\.id, token, workspaceDb, workspaceState, req\)/);
  assert.match(server, /Idempotency-Key/);
  assert.match(server, /X-Workspace-Version/);
  assert.match(server, /version_conflict/);
  assert.doesNotMatch(server, /resolution=merge-duplicates/);
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


test('calendar, faith practices, and religion preferences are persisted per workspace', () => {
  const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  const backup = fs.readFileSync(path.join(__dirname, '..', 'workspace-backup.js'), 'utf8');
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
  assert.match(server, /CREATE TABLE IF NOT EXISTS faith_logs/);
  assert.ok(server.includes("app.get('/api/calendar'"));
  assert.ok(server.includes("faith_logs:all('SELECT * FROM faith_logs')"));
  assert.match(backup, /'faith_logs'/);
  assert.match(html, /id="signupReligion"/);
  assert.match(html, /id="page-calendar"/);
  assert.match(html, /id="page-faith"/);
  assert.match(app, /function applyReligionVisibility/);
  assert.match(app, /function renderCalendar/);
  assert.ok(app.includes("$$('[data-calendar-date]').forEach"));
  assert.match(app, /function renderFaith/);
});

test('new achievement and weekly challenge records survive backup restore, while legacy backups remain valid', () => {
  const Database = require('better-sqlite3');
  const { restoreBackup } = require('../workspace-backup');
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE achievement_unlocks (achievement_id TEXT PRIMARY KEY, unlocked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE weekly_challenges (week_start TEXT PRIMARY KEY, challenge_id TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL, metric TEXT NOT NULL, target INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, completed_at TEXT, claimed_at TEXT);
  `);
  const tables = ['achievement_unlocks','weekly_challenges'];
  assert.equal(restoreBackup(db, {}, tables), 0);
  assert.equal(restoreBackup(db, {
    achievement_unlocks: [{achievement_id:'first-task',unlocked_at:'2026-11-19 10:00:00'}],
    weekly_challenges: [{week_start:'2026-11-16',challenge_id:'focus-1',title:'Focus week',description:'Complete focus sessions',metric:'focus_minutes',target:60}]
  }, tables), 2);
  assert.equal(db.prepare('SELECT achievement_id FROM achievement_unlocks').get().achievement_id, 'first-task');
  assert.equal(db.prepare('SELECT title FROM weekly_challenges').get().title, 'Focus week');
  db.close();
});


test('workspace history is private, visible in Atlas, and restores with a pre-restore checkpoint', () => {
  assert.match(server, /app\.get\('\/api\/history'/);
  assert.match(server, /app\.post\('\/api\/history\/snapshot'/);
  assert.match(server, /app\.post\('\/api\/history\/:id\/restore'/);
  assert.match(server, /personal_os_workspace_history\?select=id,version,schema_version,reason,created_at/);
  assert.match(server, /historyReason: 'pre_restore'/);
  assert.match(server, /historyReason: 'manual'/);
  assert.match(server, /req\.skipWorkspaceCommit/);
  const historyPage = fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'pages', 'HistoryPage.tsx'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'App.tsx'), 'utf8');
  const shell = fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'components', 'AppShell.tsx'), 'utf8');
  assert.match(historyPage, /Create snapshot/);
  assert.match(historyPage, /Restore/);
  assert.match(historyPage, /window\.confirm/);
  assert.match(historyPage, /workspace-history/);
  assert.match(app, /path="\/history"/);
  assert.match(shell, /Workspace history/);
});


test('shared API contracts validate common identifiers, dates, pagination and communication preferences', () => {
  const contracts = require('../server/api-contracts');
  assert.equal(contracts.positiveIdSchema.parse('42'), 42);
  assert.equal(contracts.positiveIdSchema.safeParse('0').success, false);
  assert.equal(contracts.dateKeySchema.safeParse('2026-11-27').success, true);
  assert.equal(contracts.dateKeySchema.safeParse('27-11-2026').success, false);
  assert.deepEqual(contracts.paginationQuerySchema.parse({}), { limit: 25, offset: 0 });
  assert.equal(contracts.paginationQuerySchema.safeParse({ limit: 1000 }).success, false);
  assert.equal(contracts.communicationStyleSchema.safeParse('advisor').success, true);
  assert.equal(contracts.communicationStyleSchema.safeParse('unrestricted').success, false);
});

test('shared API validation middleware emits RFC-style problem responses and stores parsed values', () => {
  const contracts = require('../server/api-contracts');
  const middleware = contracts.validateRequest(contracts.paginationQuerySchema, 'query');
  const req = { query: { limit: '10', offset: '5' } };
  let nextCalled = false;
  middleware(req, {}, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
  assert.deepEqual(req.validated.query, { limit: 10, offset: 5 });

  let response;
  const invalidReq = { query: { limit: '5000' } };
  const res = {
    status(value) { response = { status: value }; return this; },
    type(value) { response.contentType = value; return this; },
    json(value) { response.body = value; return this; }
  };
  middleware(invalidReq, res, () => assert.fail('next must not run for invalid input'));
  assert.equal(response.status, 400);
  assert.equal(response.contentType, 'application/problem+json');
  assert.equal(response.body.code, 'validation_error');
  assert.ok(Array.isArray(response.body.errors));
});

test('shared API problem helper uses a stable problem-details envelope', () => {
  const { sendProblem } = require('../server/api-contracts');
  let response;
  const res = {
    status(value) { response = { status: value }; return this; },
    type(value) { response.contentType = value; return this; },
    json(value) { response.body = value; return this; }
  };
  sendProblem(res, { status: 404, title: 'Not Found', detail: 'Record not found.', code: 'not_found', instance: '/api/example/1' });
  assert.equal(response.status, 404);
  assert.equal(response.contentType, 'application/problem+json');
  assert.equal(response.body.type, 'about:blank');
  assert.equal(response.body.instance, '/api/example/1');
});


test('workspace history restore validates numeric IDs before handler without committing invalid requests', () => {
  const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  const route = server.slice(server.indexOf("app.post('/api/history/:id/restore'"), server.indexOf("app.post('/api/history/:id/restore'") + 500);
  assert.match(route, /req\.skipWorkspaceCommit = true/);
  assert.match(route, /validateRequest\(require\('zod'\)\.z\.object\(\{ id: positiveIdSchema \}\), 'params'\)/);
  assert.match(route, /req\.validated\.params\.id/);
});


test('API v1 aliases reuse legacy handlers while keeping Qur’an routes outside the versioned surface', () => {
  const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  const alias = server.indexOf("req.path !== '/api/v1'");
  const auth = server.indexOf("app.use('/api', async (req, res, next) =>");
  assert.ok(alias > 0 && alias < auth);
  const block = server.slice(alias, auth);
  assert.match(block, /req\.url = '\/api' \+ req\.url\.slice\('\/api\/v1'\.length\)/);
  assert.match(block, /versionedPath === '\/quran'/);
  assert.match(block, /versioned_route_unavailable/);
});


test('API errors are normalised to problem details without removing legacy error fields or touching Qur’an responses', () => {
  const { apiProblemResponses } = require('../server/api-errors');
  let wrapped;
  let response;
  const req = { path: '/tasks' };
  const res = {
    statusCode: 400,
    json(body) { response = body; return this; },
    type(value) { this.contentType = value; return this; }
  };
  apiProblemResponses()(req, res, () => { wrapped = res.json; });
  wrapped({ error: 'Choose a valid task priority.', code: 'invalid_priority' });
  assert.equal(response.type, 'about:blank');
  assert.equal(response.status, 400);
  assert.equal(response.detail, 'Choose a valid task priority.');
  assert.equal(response.error, 'Choose a valid task priority.');
  assert.equal(res.contentType, 'application/problem+json');

  let quranNext = false;
  const quranRes = { json(body) { return body; } };
  apiProblemResponses()({ path: '/quran/page/1' }, quranRes, () => { quranNext = true; });
  assert.equal(quranNext, true);
});


test('module manifests assign every API route once and enforce the protected Qur’an boundary', () => {
  const { modules, sharedModules, routeOwner } = require('../server/module-manifests');
  const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  const ids = modules.map(module => module.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const module of modules) {
    for (const dependency of module.dependsOn) {
      assert.ok(ids.includes(dependency) || sharedModules.includes(dependency), `Unknown dependency ${dependency} in ${module.id}`);
    }
    for (const file of module.files) {
      assert.ok(fs.existsSync(path.join(__dirname, '..', file)), `Missing manifest file ${file}`);
    }
  }
  const routePattern = /app\.(?:get|post|put|patch|delete)\(\s*['"]([^'"]*\/api[^'"]*)['"]/g;
  const paths = [...server.matchAll(routePattern)].map(match => match[1]);
  assert.ok(paths.length > 20);
  for (const route of paths) assert.ok(routeOwner(route), `Unowned or multiply-owned API route: ${route}`);
  const quran = modules.find(module => module.id === 'quran');
  assert.equal(quran.protected, true);
  assert.equal(quran.versioning, 'legacy-only');
  assert.deepEqual(quran.dependsOn, []);
});


test('universal API envelope validation covers every API route and excludes the protected Qur’an API', () => {
  const { validateApiEnvelope } = require('../server/api-contracts');
  const middleware = validateApiEnvelope();
  let nextCalled = false;
  const validReq = { path: '/api/tasks', method: 'POST', params: { id: '2' }, query: {}, body: { title: 'Task' } };
  middleware(validReq, {}, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
  assert.deepEqual(validReq.validated.body, { title: 'Task' });

  let response;
  const invalidReq = { path: '/api/tasks', method: 'POST', params: {}, query: {}, body: ['not', 'an object'] };
  const res = {
    status(value) { response = { status: value }; return this; },
    type(value) { response.contentType = value; return this; },
    json(value) { response.body = value; return this; }
  };
  middleware(invalidReq, res, () => assert.fail('invalid body must not reach a route'));
  assert.equal(response.status, 400);
  assert.equal(response.contentType, 'application/problem+json');

  let quranNext = false;
  middleware({ path: '/api/quran/page/1', method: 'GET', params: {}, query: {} }, {}, () => { quranNext = true; });
  assert.equal(quranNext, true);

  const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  assert.ok(server.indexOf('app.use(validateApiEnvelope())') < server.indexOf("app.use('/api', async (req, res, next) =>"));
});


test('module file imports obey declared inter-module dependencies', () => {
  const { modules } = require('../server/module-manifests');
  const root = path.join(__dirname, '..');
  const owners = new Map();
  for (const module of modules) for (const file of module.files) owners.set(path.resolve(root, file), module.id);
  for (const module of modules) {
    for (const file of module.files) {
      const absolute = path.resolve(root, file);
      const source = fs.readFileSync(absolute, 'utf8');
      const imports = [...source.matchAll(/(?:from\s*|require\()\s*['"]([^'"]+)['"]/g)].map(match => match[1]);
      for (const specifier of imports.filter(value => value.startsWith('.'))) {
        const base = path.resolve(path.dirname(absolute), specifier);
        const candidates = [base, ...['.ts', '.tsx', '.js', '.jsx'].map(extension => base + extension), path.join(base, 'index.ts'), path.join(base, 'index.tsx')];
        const target = candidates.find(candidate => owners.has(candidate));
        if (!target) continue;
        const owner = owners.get(target);
        if (owner !== module.id) assert.ok(module.dependsOn.includes(owner), `${module.id} imports ${owner} without declaring the dependency (${file} -> ${specifier})`);
      }
    }
  }
});


test('Atlas semantic design tokens preserve named themes and stay outside Qur’an reader styling', () => {
  const tokens = fs.readFileSync(path.join(__dirname, '..', 'client/src/design/tokens.css'), 'utf8');
  const main = fs.readFileSync(path.join(__dirname, '..', 'client/src/main.tsx'), 'utf8');
  const reader = fs.readFileSync(path.join(__dirname, '..', 'client/src/components/QuranMushafReader.tsx'), 'utf8');
  assert.match(main, /design\/tokens\.css/);
  for (const token of ['--atlas-bg', '--atlas-surface-1', '--atlas-text-1', '--atlas-brand', '--atlas-module-residence', '--atlas-module-quran', '--atlas-duration-slow']) {
    assert.ok(tokens.includes(token), `Missing design token ${token}`);
  }
  for (const theme of ['shadowed-alchemist', 'nocturnal-amethyst', 'abyssal-trench', 'whispering-woods', 'crimson-velvet', 'light-porcelain', 'light-sandstone', 'light-sage', 'light-lavender', 'light-sky']) {
    assert.ok(fs.readFileSync(path.join(__dirname, '..', 'client/src/styles.css'), 'utf8').includes(theme), `Existing theme ${theme} must remain supported`);
  }
  assert.doesNotMatch(tokens, /\.quran-|\.mushaf|\.tj-/i);
  assert.doesNotMatch(tokens, /\.quran-|\.mushaf|\.tj-|@font-face|font-family\s*:/i);
  assert.ok(reader.includes('UthmanicHafs'));
  assert.ok(reader.includes('TAJWEED_CLASSES'));
});

test('Atlas module accent colours meet WCAG AA text contrast in dark and light contexts', () => {
  const ratio = (foreground, background) => {
    const luminance = hex => {
      const channels = hex.match(/[a-f0-9]{2}/gi).map(value => parseInt(value, 16) / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
      return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    };
    const a = luminance(foreground), b = luminance(background);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  };
  const dark = ['#22D3EE','#FB923C','#A78BFA','#60A5FA','#A3E635','#E879F9','#FB7185','#FACC15','#34D399'];
  const light = ['#0E7490','#C2410C','#6D28D9','#1D4ED8','#3F6212','#A21CAF','#BE123C','#854D0E','#047857'];
  for (const colour of dark) assert.ok(ratio(colour, '#0A0E13') >= 4.5, `Dark accent ${colour} fails WCAG AA`);
  for (const colour of light) assert.ok(ratio(colour, '#F6F4EF') >= 4.5, `Light accent ${colour} fails WCAG AA`);
  assert.ok(ratio('#22D3EE', '#0A0E13') >= 4.5, 'Dark brand fails WCAG AA');
  assert.ok(ratio('#0E7490', '#F6F4EF') >= 4.5, 'Light brand fails WCAG AA');
});


test('unified Atlas shell exposes nine module destinations, responsive navigation and quick capture', () => {
  const shell = fs.readFileSync(path.join(__dirname, '..', 'client/src/components/AppShell.tsx'), 'utf8');
  const styles = fs.readFileSync(path.join(__dirname, '..', 'client/src/styles.css'), 'utf8');
  assert.match(shell, /navigationGroups/);
  assert.match(shell, /quranDestination/);
  assert.match(shell, /data-module="quran"/);
  assert.match(shell, /aria-label={sidebarCollapsed \? 'Expand navigation' : 'Collapse navigation'}/);
  assert.match(shell, /destinations = \[\.\.\.rooms, quranDestination\]/);
  assert.match(shell, /waitingForDestination/);
  assert.match(shell, /event\.key\.toLowerCase\(\) === 'c'/);
  assert.match(shell, /event\.key === '\?'/);
  assert.match(shell, /quickCaptureType === 'note' \? '\/notes' : '\/habits'/);
  assert.match(shell, /atlas-mobile-dock__capture/);
  assert.match(shell, /atlas-skip-link/);
  assert.match(styles, /@media \(min-width: 768px\) and \(max-width: 1023px\)/);
  assert.match(styles, /--atlas-nav-width-expanded/);
  assert.match(styles, /\.quick-capture-types/);
});


test('PWA updates wait for user approval, never auto-reload, and exclude APIs and Qur’an assets', () => {
  const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  const prompt = fs.readFileSync(path.join(__dirname, '..', 'client/src/components/PwaUpdatePrompt.tsx'), 'utf8');
  const main = fs.readFileSync(path.join(__dirname, '..', 'client/src/main.tsx'), 'utf8');
  const start = server.indexOf("// Versioned PWA worker:");
  const end = server.indexOf("app.use(express.static(frontendDist", start);
  const worker = server.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(worker, /ATLAS_ACTIVATE_UPDATE/);
  assert.match(worker, /pathname\.startsWith\('\/api\/'\)/);
  assert.match(worker, /pathname === '\/quran'/);
  assert.match(worker, /pathname\.startsWith\('\/fonts\/'\)/);
  assert.doesNotMatch(worker, /clients\.forEach\(client => client\.navigate/);
  const installBlock = worker.slice(worker.indexOf("self.addEventListener('install'"), worker.indexOf("self.addEventListener('message'"));
  assert.doesNotMatch(installBlock, /skipWaiting/);
  assert.match(prompt, /Apply next launch/);
  assert.match(prompt, /ATLAS_ACTIVATE_UPDATE/);
  assert.match(main, /PwaUpdatePrompt/);
});

test('Atlas system theme and high-contrast preferences are applied before and after first paint', () => {
  const theme = fs.readFileSync(path.join(__dirname, '..', 'client/src/design/theme.ts'), 'utf8');
  const settings = fs.readFileSync(path.join(__dirname, '..', 'client/src/pages/SettingsPage.tsx'), 'utf8');
  const bootstrap = fs.readFileSync(path.join(__dirname, '..', 'client/public/theme-init.js'), 'utf8');
  assert.match(theme, /themeId !== 'system'/);
  assert.match(theme, /prefers-color-scheme: light/);
  assert.match(theme, /watchAtlasSystemTheme/);
  assert.match(theme, /data-contrast/);
  assert.match(settings, /id: 'system'/);
  assert.match(settings, /High-contrast interface/);
  assert.match(bootstrap, /preference === 'system'/);
  assert.match(bootstrap, /atlas-high-contrast/);
});


test('first-run onboarding validates and atomically creates timezone, one goal and one habit', () => {
  const { onboardingSchema } = require('../server/api-contracts');
  const { routeOwner } = require('../server/module-manifests');
  const valid = onboardingSchema.safeParse({ timezone: 'Africa/Lagos', goal_title: 'Build a durable business', habit_title: 'Study for 30 minutes' });
  assert.equal(valid.success, true);
  assert.equal(onboardingSchema.safeParse({ timezone: '', goal_title: '', habit_title: '' }).success, false);
  const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  const routeStart = server.indexOf("app.post('/api/onboarding'");
  const routeEnd = server.indexOf("app.patch('/api/settings'", routeStart);
  const route = server.slice(routeStart, routeEnd);
  assert.ok(routeStart > 0 && routeEnd > routeStart);
  assert.match(route, /validateRequest\(onboardingSchema\)/);
  assert.match(route, /db\.transaction\(/);
  assert.match(route, /INSERT INTO goals/);
  assert.match(route, /INSERT INTO habits/);
  assert.match(route, /settings\(key,value\)/);
  assert.equal(routeOwner('/api/onboarding')?.id, 'platform');
  assert.match(server, /SELECT value FROM settings WHERE key=\?/);
});


test('web shell builds all eight modules from manifests and keeps Qur’an as a protected shell-owned route', () => {
  const registry = fs.readFileSync(path.join(__dirname, '..', 'client/src/design/module-registry.ts'), 'utf8');
  const shell = fs.readFileSync(path.join(__dirname, '..', 'client/src/components/AppShell.tsx'), 'utf8');
  const moduleBlock = registry.slice(registry.indexOf('export const atlasModules'), registry.indexOf('export const quranShellEntry'));
  assert.equal((moduleBlock.match(/id: '/g) || []).length, 8);
  assert.match(registry, /\['HOME', 'PLAN', 'PRACTICE', 'REFLECT'\]/);
  assert.match(registry, /protected: true/);
  assert.match(registry, /accentToken: '--atlas-module-quran'/);
  assert.match(registry, /atlasModules,\s*quranShellEntry/);
  assert.match(shell, /design\/module-registry/);
  assert.match(shell, /navigationGroups\.map/);
});
