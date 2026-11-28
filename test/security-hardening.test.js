const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const workflow = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'test.yml'), 'utf8');
const render = fs.readFileSync(path.join(__dirname, '..', 'render.yaml'), 'utf8');

test('API has bounded request bodies and a separate backup-import allowance', () => {
  assert.match(server, /app\.use\('\/api\/import', express\.json\(\{\s*limit:\s*'10mb'/);
  assert.match(server, /app\.use\(express\.json\(\{\s*limit:\s*'1mb'/);
  assert.doesNotMatch(server, /app\.use\(express\.json\(\{\s*limit:\s*'10mb'/);
});

test('API and admin endpoints have per-IP and per-account request limits', () => {
  assert.match(server, /app\.use\('\/api', rateLimit\(\{ max: 300 \}\)\)/);
  assert.match(server, /app\.use\('\/api\/admin', rateLimit\(\{ max: 30/);
  assert.match(server, /consumeRateLimit\(\`account:\$\{user\.id\}\`, 240\)/);
  assert.match(server, /status\(429\)/);
});

test('health endpoint does not require authentication', () => {
  assert.match(server, /app\.get\('\/healthz',[\s\S]*?status\(200\)\.json\(\{ ok: true \}\)/);
});

test('browser responses have CSP, HSTS in production, and no-store API responses', () => {
  assert.match(server, /Content-Security-Policy/);
  assert.match(server, /frame-ancestors 'none'/);
  assert.match(server, /Strict-Transport-Security/);
  assert.match(server, /Cache-Control','no-store'/);
  assert.match(server, /Cross-Origin-Opener-Policy/);
});

test('production installs dependencies, builds the frontend, and CI audits all dependencies', () => {
  assert.match(workflow, /npm install/);
  assert.match(workflow, /npm audit/);
  assert.match(render, /buildCommand: npm install --include=dev && npm run build/);
  assert.match(render, /healthCheckPath: \/healthz/);
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  assert.ok(pkg.dependencies.vite, 'Vite must be available when Render installs production dependencies');
});


test('Residence pins saved priorities, completes them inline, and links focus to the selected task', () => {
  const quran = fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'pages', 'QuranPage.tsx'), 'utf8');
  const residence = fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'pages', 'TodayPage.tsx'), 'utf8');
  const focus = fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'components', 'FocusWorkspace.tsx'), 'utf8');
  assert.match(residence, /YOUR PINNED TOP 3/);
  assert.match(residence, /priorityTaskIds\.map\(id => tasks\.data\?\.find\(task => task\.id === id\)\)/);
  assert.match(residence, /toggleTask\.mutate\(task\)/);
  assert.match(residence, /residence-pinned-focus[^\n]*to=\{'\/focus\?task=' \+ task\.id\}/);
  assert.match(residence, /onMutate: async task/);
  assert.match(focus, /params\.get\('task'\)/);
  assert.match(residence, /dailyReview\?\.alignment_complete && !editingAlignment/);
  assert.match(residence, /yesterdayReview\?\.shutdown_complete && yesterdayReview\.next_focus\?\.trim\(\)/);
  assert.match(residence, /showShutdownPrompt \? /);
});


test('Daily Rhythm records persist per workspace and remain compatible with older snapshots and exports', () => {
  const backup = fs.readFileSync(path.join(__dirname, '..', 'workspace-backup.js'), 'utf8');
  assert.match(server, /'self_control_entries','rhythm_records','reading_items','email_events'/);
  assert.match(server, /'faith_logs','rhythm_records','reading_items','login_events'/);
  assert.match(server, /CREATE TABLE IF NOT EXISTS rhythm_records/);
  assert.match(server, /values\.faith_tradition=values\.faith_tradition\|\|values\.religion/);
  assert.match(server, /'faith_tradition','leaderboard_name'/);
  assert.match(server, /app\.post\('\/api\/rhythm\/records'/);
  assert.match(server, /app\.get\('\/api\/rhythm\/summary'/);
  assert.match(server, /rhythm_records:all\('SELECT \* FROM rhythm_records'\)/);
  assert.match(backup, /'self_control_entries','rhythm_records','reading_items','settings'/);
  assert.match(backup, /'feedback_logs','rhythm_records','reading_items'\]\.includes\(table\)/);
});

test('Daily Rhythm separates planned from completed records and updates Residence Activity Pulse', () => {
  const rhythm = fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'pages', 'ValuesPage.tsx'), 'utf8');
  const quran = fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'pages', 'QuranPage.tsx'), 'utf8');
  const residence = fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'pages', 'TodayPage.tsx'), 'utf8');
  const focus = fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'components', 'FocusWorkspace.tsx'), 'utf8');
  assert.match(rhythm, /status: 'planned'\|'completed'\|'active'\|'answered'/);
  assert.match(rhythm, /value:'qada'/);
  assert.match(rhythm, /Jumu’ah checklist/);
  assert.match(rhythm, /P-R-A-Y Reflection|P-R-A-Y REFLECTION/);
  assert.match(quran, /<QuranMushafReader[\s\S]*settings=/);
  assert.match(rhythm, /Start Devotional Focus/);
  assert.match(rhythm, /Clarity & Reflection/);
  assert.match(rhythm, /invalidateQueries\(\{ queryKey: \['rhythm-summary'\] \}\)/);
  assert.match(residence, /api<RhythmSummary>\('\/rhythm\/summary\?date='/);
  assert.match(residence, /rhythmSummary\.data\?\.completed/);
  assert.match(residence, /CLARITY & REFLECTION/);
  assert.match(focus, /get\('focus'\)/);
});

test('Self-Control consistency uses dated records and positive habit check-ins, not assumed streak days', () => {
  const selfControl = fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'pages', 'SelfControlPage.tsx'), 'utf8');
  const rituals = fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'pages', 'RitualsPage.tsx'), 'utf8');
  const shell = fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'components', 'AppShell.tsx'), 'utf8');
  const moduleRegistry = fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'design', 'module-registry.ts'), 'utf8');
  assert.match(server, /FROM self_control_entries WHERE log_date>=date\(\?,'-29 days'\)/);
  assert.match(server, /FROM habit_logs WHERE log_date>=date\(\?,'-29 days'\)/);
  assert.match(server, /let best=0,run=0,previous=null/);
  assert.match(selfControl, /ROLLING CONSISTENCY/);
  assert.match(selfControl, /LAST 30 DAYS/);
  assert.doesNotMatch(selfControl, /habits\.data\?\.length/);
  assert.match(rituals, /habit\.streak/);
  assert.match(rituals, /Pencil/);
  const consolidated = fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'pages', 'ConsolidatedViews.tsx'), 'utf8');
  assert.match(consolidated, /<SelfControlPage embedded afterHeatmap=\{switcher\}/);
  assert.match(consolidated, /workspace==='habits'/);
  assert.match(consolidated, /workspace==='self-control'/);
  assert.match(consolidated, /<RitualsPage embedded \/>/);
  assert.match(server, /return \{\.\.\.habit,streak\}/);
  assert.match(selfControl, /verified clean check-ins/);
  assert.match(rituals, /invalidateQueries\(\{ queryKey: \['self-control'\] \}\)/);
  assert.match(moduleRegistry, /label: 'Values'/);
  assert.match(shell, /faithTabLabel/);
  assert.match(shell, /Daily Reflection/);
});


test('Room 3 records focus completion once and derives linked work metrics from sessions', () => {
  const execution = fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'components', 'FocusWorkspace.tsx'), 'utf8');
  const learning = fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'pages', 'LearningPage.tsx'), 'utf8');
  const goals = fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'pages', 'GoalsPage.tsx'), 'utf8');
  assert.match(server, /session_key TEXT UNIQUE/);
  assert.match(server, /INSERT OR IGNORE INTO sessions/);
  assert.match(server, /if\(insert\.changes&&session_kind==='focus'\)\{awardXp\('session:'/);
  assert.match(server, /type:'focus\.ended'/);
  assert.doesNotMatch(server, /Link a focus session to either a task or a learning lesson, not both/);
  assert.match(server, /AS focus_minutes/);
  assert.match(server, /progress_pct:\s*p\.task_count\s*\?/);
  assert.match(server, /parent_task_id INTEGER REFERENCES tasks\(id\) ON DELETE CASCADE/);
  assert.match(server, /goal_id INTEGER REFERENCES goals\(id\) ON DELETE SET NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP\);/);
  assert.match(execution, /ACTIONS \/ DAILY EXECUTION/);
  assert.match(execution, /\['25','25m'\],\['50','50m'\],\['80','80m'\]/);
  assert.match(execution, /session_key:timer\.sessionKey/);
  assert.match(execution, /savedKeys\.current\.has\(timer\.sessionKey\)/);
  assert.match(execution, /distractions:timer\.distractions/);
  assert.match(execution, /parent_task_id:parentId/);
  assert.match(execution, /Finish & save/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'lib', 'focusTimerStore.ts'), 'utf8'), /atlas-migrated-/);
  assert.match(learning, /goal_id: goalId \|\| null/);
  assert.match(learning, /Related goal/);
  assert.match(goals, /focusMinutes: goal\.focus_minutes/);
  assert.match(goals, /focus invested/);
});

test('Room 3 uses the unified FocusWorkspace route and preserves project/task bookmarks through redirects', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'App.tsx'), 'utf8');
  const shell = fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'components', 'AppShell.tsx'), 'utf8');
  const moduleRegistry = fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'design', 'module-registry.ts'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'styles.css'), 'utf8');
  assert.match(app, /path="\/actions" element={<FocusWorkspace \/>}/);
  assert.match(app, /path="\/projects" element={<LegacyRedirect to="\/goals" \/>}/);
  assert.match(app, /path="\/tasks" element={<LegacyRedirect to="\/actions" \/>}/);
  assert.match(app, /path="\/focus" element={<FocusWorkspace \/>}/);
  assert.match(moduleRegistry, /to: '\/actions'/);
  assert.match(moduleRegistry, /label: 'Actions', to: '\/actions'/);
  assert.match(css, /\.execution-heading/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'components', 'FocusWorkspace.tsx'), 'utf8'), /project/i);
});


test('Room 4 reading library persists as an optional backward-compatible workspace table', () => {
  const backup = fs.readFileSync(path.join(__dirname, '..', 'workspace-backup.js'), 'utf8');
  const library = fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'pages', 'LibraryPage.tsx'), 'utf8');
  assert.match(server, /CREATE TABLE IF NOT EXISTS reading_items/);
  assert.match(server, /CHECK\(status IN \('Queued','Active','Completed'\)\)/);
  assert.match(server, /app\.get\('\/api\/reading-items'/);
  assert.match(server, /app\.post\('\/api\/reading-items'/);
  assert.match(server, /app\.patch\('\/api\/reading-items\/:id'/);
  assert.match(server, /app\.delete\('\/api\/reading-items\/:id'/);
  assert.match(server, /'self_control_entries','rhythm_records','reading_items'/);
  assert.match(backup, /'rhythm_records','reading_items','settings'/);
  assert.match(backup, /'feedback_logs','rhythm_records','reading_items'\]\.includes\(table\)/);
  assert.match(library, /Queued/);
  assert.match(library, /Active/);
  assert.match(library, /Completed/);
  assert.match(library, /Private library/);
});

test('Room 4 progress and weekly reviews use linked evidence and preserve existing review records', () => {
  const goals = fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'pages', 'GoalsPage.tsx'), 'utf8');
  const learning = fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'pages', 'LearningPage.tsx'), 'utf8');
  const reviews = fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'pages', 'ReviewsPage.tsx'), 'utf8');
  assert.match(goals, /linkedLessons\.filter\(lesson => lesson\.status === 'Completed'\)/);
  assert.match(goals, /milestones\.filter\(item => !!item\.completed\)/);
  assert.match(goals, /Evidence-based progress/);
  assert.match(goals, /short-term/);
  assert.match(server, /horizon TEXT NOT NULL DEFAULT 'long-term'/);
  assert.doesNotMatch(goals, /complete\.mutate/);
  assert.match(learning, /lesson\.study_minutes/);
  assert.match(server, /SELECT COALESCE\(SUM\(minutes\),0\) n FROM sessions WHERE lesson_id=\? AND session_kind='focus'/);
  assert.match(learning, /Start Study Focus/);
  assert.match(learning, /values:\{notes:/);
  assert.match(server, /FROM sessions WHERE session_kind='focus' AND session_date>=\? AND session_date<=\?/);
  assert.match(server, /app\.get\('\/api\/reviews\/evidence'/);
  assert.match(server, /priority_task_ids:priorityIds/);
  assert.match(reviews, /review-evidence/);
  assert.match(reviews, /priority_task_ids: priorityIds/);
  assert.match(reviews, /Adjust next week/);
});

test('Room 4 visual craft uses semantic tokens, responsive spacing, motion and reduced-motion safeguards', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'styles.css'), 'utf8');
  assert.match(css, /--bg-canvas:var\(--bg\)/);
  assert.match(css, /--bg-surface:var\(--surface\)/);
  assert.ok(css.includes('--bg-elevated:var(--surface-raised)'));
  assert.match(css, /--border-hairline:var\(--line\)/);
  assert.match(css, /--text-primary:var\(--text\)/);
  assert.match(css, /--accent-primary:var\(--accent\)/);
  assert.match(css, /Plus Jakarta Sans/);
  assert.match(css, /JetBrains Mono/);
  assert.match(css, /stroke-width:1\.5px/);
  assert.match(css, /cubic-bezier\(0\.16,1,0\.3,1\)/);
  assert.match(css, /translateY\(-2px\)/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /room4-evidence-grid \{ grid-template-columns:repeat\(2/);
});


test('Room 4 presents learning, library, reviews and insights together without moving intelligence into Residence', () => {
  const consolidated = fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'pages', 'ConsolidatedViews.tsx'), 'utf8');
  const goals = fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'pages', 'GoalsPage.tsx'), 'utf8');
  const learning = fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'pages', 'LearningPage.tsx'), 'utf8');
  const library = fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'pages', 'LibraryPage.tsx'), 'utf8');
  const reviews = fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'pages', 'ReviewsPage.tsx'), 'utf8');
  const insights = fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'pages', 'InsightsPage.tsx'), 'utf8');
  const residence = fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'pages', 'TodayPage.tsx'), 'utf8');
  assert.match(goals, /<LearningPage embedded \/>/);
  assert.match(goals, /<ProjectsPage embedded \/>/);
  assert.match(consolidated, /<LibraryPage embedded \/>/);
  assert.match(consolidated, /<ReviewsPage embedded \/>/);
  assert.match(consolidated, /<InsightsPage embedded \/>/);
  assert.match(learning, /Start Study Focus/);
  assert.match(library, /reading-items/);
  assert.match(library, /notes/);
  assert.match(reviews, /priority_task_ids: priorityIds/);
  assert.match(insights, /focusLast7Days/);
  assert.doesNotMatch(residence, /queryKey: \['intelligence'\]/);
  assert.doesNotMatch(residence, /residence-next-card/);
});



test('Growth & Direction unifies constellation targets while Execution remains task-only', () => {
  const goals = fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'pages', 'GoalsPage.tsx'), 'utf8');
  const projects = fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'pages', 'ProjectsPage.tsx'), 'utf8');
  const learning = fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'pages', 'LearningPage.tsx'), 'utf8');
  const constellation = fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'components', 'fx', 'AtlasEngines.tsx'), 'utf8');
  const execution = fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'components', 'FocusWorkspace.tsx'), 'utf8');
  assert.ok(goals.indexOf('<LifeConstellation') < goals.indexOf('id="goals-workspace"'));
  assert.ok(goals.indexOf('id="goals-workspace"') < goals.indexOf('id="projects-workspace"'));
  assert.ok(goals.indexOf('id="projects-workspace"') < goals.indexOf('id="learning-workspace"'));
  assert.match(goals, /atlas:constellation-select/);
  assert.match(constellation, /atlas:constellation-select/);
  assert.match(goals, /atlas-goal-/);
  assert.match(projects, /atlas-project-/);
  assert.match(learning, /atlas-learning-/);
  assert.doesNotMatch(execution, /ProjectsPage|execution-project-manager/);
  assert.match(execution, /execution-goal-filter-rail/);
  assert.match(execution, /TASK INSPECTOR/);
});


test('Room 3 has a dedicated Focus Room with safe context handoffs and a persistent global timer dock', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'App.tsx'), 'utf8');
  const shell = fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'components', 'AppShell.tsx'), 'utf8');
  const moduleRegistry = fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'design', 'module-registry.ts'), 'utf8');
  const workspace = fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'components', 'FocusWorkspace.tsx'), 'utf8');
  const values = fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'pages', 'ValuesPage.tsx'), 'utf8');
  const learning = fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'pages', 'LearningPage.tsx'), 'utf8');
  const residence = fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'pages', 'TodayPage.tsx'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'styles.css'), 'utf8');
  assert.match(app, /path="\/actions" element={<FocusWorkspace \/>}/);
  assert.match(app, /path="\/focus" element={<FocusWorkspace \/>}/);
  assert.match(moduleRegistry, /paths: \['\/focus'\]/);
  assert.match(moduleRegistry, /label: 'Focus', detail: 'Start or resume a focus session', to: '\/focus'/);
  assert.match(shell, /navigate\('\/focus'\)/);
  assert.match(shell, /className="atlas-command-dock"/);
  assert.match(workspace, /!isFocusRoute && <section className="execution-projects-panel">/);
  assert.match(workspace, /\{isFocusRoute && <section className="execution-focus-panel">/);
  assert.match(workspace, /navigate\('\/focus'\)/);
  assert.match(workspace, /sessionKey&&timer\.remaining>0/);
  assert.match(workspace, /session_key:timer\.sessionKey/);
  assert.match(workspace, /savedKeys\.current\.has\(timer\.sessionKey\)/);
  assert.doesNotMatch(values, /to="\/focus\?focus=Qur/);
  assert.match(values, /to="\/focus\?focus=Devotional%20Focus"/);
  assert.match(learning, /to=\{'\/focus\?lesson=' \+ lesson\.id\}/);
  assert.match(residence, /to=\{'\/focus\?task=' \+ task\.id\}/);
  assert.match(css, /\.execution-projects-layout \{ grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(css, /\.focus-room-layout/);
});


test('Atlas rooms use distinct spatial layouts, an actionable task inspector and a centered focus chronograph', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'styles.css'), 'utf8');
  const residence = fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'pages', 'TodayPage.tsx'), 'utf8');
  const rhythm = fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'pages', 'ValuesPage.tsx'), 'utf8');
  const consolidated = fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'pages', 'ConsolidatedViews.tsx'), 'utf8');
  const goals = fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'pages', 'GoalsPage.tsx'), 'utf8');
  const focus = fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'components', 'FocusWorkspace.tsx'), 'utf8');
  assert.ok(css.includes('grid-template-columns:minmax(0,1.55fr) minmax(0,1fr)'));
  assert.ok(css.includes('width:min(100%,820px)'));
  assert.ok(css.includes('.execution-split.has-task-inspector'));
  assert.match(css, /execution-timer-ring__progress/);
  assert.match(css, /growth-horizon-layout/);
  assert.match(residence, /residence-pulse__score/);
  assert.match(residence, /Progress is personal/);
  assert.match(rhythm, /daily-rhythm-sanctuary/);
  assert.match(goals, /growth-horizon-layout/);
  assert.match(goals, /goals-horizon/);
  assert.match(focus, /TASK INSPECTOR/);
  assert.match(focus, /inspectedSubtasks/);
  assert.match(focus, /execution-timer-ring/);
  assert.ok(focus.includes('session_key:timer.sessionKey'));
});


test('Atlas flagship CSS has one shared frame, consolidated room geometry and theme-aware tactile surfaces', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'styles.css'), 'utf8');
  assert.ok(css.includes('--atlas-frame: 1180px'));
  assert.ok(css.includes('--atlas-page-x: 40px'));
  assert.ok(css.includes('--atlas-page-y: 36px'));
  assert.ok(css.includes('grid-template-columns:minmax(0,1.55fr) minmax(0,1fr)'));
  assert.ok(css.includes('width:min(100%,820px)'));
  assert.ok(css.includes('grid-template-columns:minmax(0,1fr) 360px'));
  assert.ok(css.includes('width:260px'));
  assert.ok(css.includes('stroke-width:6'));
  assert.ok(css.includes('font:600 56px/1 "JetBrains Mono",monospace'));
  assert.ok(css.includes('grid-template-columns:repeat(2,minmax(0,1fr))'));
  assert.ok(css.includes('--surface-specular: inset 0 1px 0 0 rgba(255,255,255,.08)'));
  assert.ok(css.includes('--surface-specular: inset 0 1px 0 0 rgba(255,255,255,.9)'));
  assert.ok(css.includes('--atlas-radius-card: 14px'));
  assert.ok(css.includes('--atlas-radius-control: 9px'));
  assert.ok(css.includes('transition:transform 160ms ease'));
  assert.ok(!css.includes('Daily Rhythm — Cascade-aware spacing system (staging).'));
  assert.ok(!css.includes('ATLAS SPATIAL ARCHITECTURE — executive-grade room silhouettes'));
  assert.ok(!css.includes('Room 02 — spacious Deen layout pass (staging).'));
});


test('Atlas inner rooms use bespoke faith, task, chronograph, milestone and library interactions', () => {
  const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const values = read('client/src/pages/ValuesPage.tsx');
  const selfControl = read('client/src/pages/SelfControlPage.tsx');
  const focus = read('client/src/components/FocusWorkspace.tsx');
  const goals = read('client/src/pages/GoalsPage.tsx');
  const learning = read('client/src/pages/LearningPage.tsx');
  const library = read('client/src/pages/LibraryPage.tsx');
  const css = read('client/src/styles.css');
  assert.match(values, /rhythm-prayer-segments/);
  assert.match(values, /aria-pressed=\{value===option\.value\}/);
  assert.match(values, /rhythm-prayer-progress/);
  assert.match(values, /Unrecorded/);
  assert.match(selfControl, /self-rhythm-heatmap/);
  assert.match(focus, /execution-timer-tick/);
  assert.match(focus, /is-running/);
  assert.match(focus, /execution-task-check--/);
  assert.match(goals, /goal-milestone-disclosure/);
  assert.match(goals, /goal-meta-chip/);
  assert.match(learning, /room4-path-card--/);
  assert.match(library, /room4-resource--/);
  assert.ok(css.includes('--accent-soft:var(--accent-wash)'));
  assert.ok(css.includes('--bg-elevated:var(--surface-raised)'));
  assert.match(css, /appearance:none/);
  assert.match(css, /grid-template-columns:\s*repeat\(10,minmax\(0,1fr\)\);\s*gap:3px/);
  assert.match(css, /border-radius:4px/);
  assert.match(css, /execution-timer-tick--major/);
  assert.match(css, /room4-resource--completed/);
});
