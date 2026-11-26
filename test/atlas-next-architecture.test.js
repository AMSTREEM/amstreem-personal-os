const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const server = read('server.js');
const backup = read('workspace-backup.js');
const app = read('client/src/App.tsx');

test('existing v1/v2 workspace snapshots remain readable and new writes use v3', () => {
  assert.match(server, /personal-os-sqlite-snapshot-v1/);
  assert.match(server, /personal-os-sqlite-snapshot-v2/);
  assert.match(server, /personal-os-sqlite-snapshot-v3/);
  assert.match(server, /schemaVersion:\s*3/);
});

test('new workspace tables are created, serialized, and backward-compatible', () => {
  for (const table of ['projects', 'project_milestones', 'calendar_events', 'reviews']) {
    assert.match(server, new RegExp('CREATE TABLE IF NOT EXISTS ' + table));
    assert.match(server, new RegExp("'" + table + "'"));
    assert.match(backup, new RegExp("'" + table + "'"));
  }
  assert.match(server, /optionalTables\s*=\s*\[[^\]]*'projects'[^\]]*'project_milestones'[^\]]*'calendar_events'[^\]]*'reviews'/s);
  assert.match(backup, /!\['projects','project_milestones','calendar_events','reviews'/);
  assert.doesNotMatch(server, /analytics_events/);
});

test('project, task, calendar, focus and review records can be linked', () => {
  assert.match(server, /project_id INTEGER REFERENCES projects\(id\)/);
  assert.match(server, /goal_id INTEGER REFERENCES goals\(id\)/);
  assert.match(server, /task_id INTEGER REFERENCES tasks\(id\)/);
  assert.match(server, /app\.get\('\/api\/projects'/);
  assert.match(server, /app\.post\('\/api\/projects'/);
  assert.match(server, /app\.post\('\/api\/calendar\/events'/);
  assert.match(server, /app\.post\('\/api\/reviews'/);
  assert.match(server, /goal_id INTEGER REFERENCES goals\(id\) ON DELETE SET NULL\);/);
  assert.match(server, /app\.patch\('\/api\/habits\/:id'/);
  assert.match(server, /Number\.isInteger\(goalId\)/);
  assert.match(server, /lesson_id INTEGER REFERENCES learning_lessons\(id\)/);
  assert.match(server, /INSERT OR IGNORE INTO sessions\(session_date,minutes,focus,reflection,task_id,project_id,lesson_id,session_key/);
  assert.match(server, /ll\.title AS lesson_title/);
  assert.doesNotMatch(server, /Link a focus session to either a task or a learning lesson, not both/);
  assert.match(server, /COALESCE\(SUM\(minutes\),0\) n FROM sessions WHERE lesson_id=\? AND session_kind='focus'/);
  assert.match(server, /'focus' AS source/);
  assert.match(server, /study_minutes:studyMinutes/);
});

test('six primary destinations and personal life areas shape the Atlas workspace', () => {
  const shell = read('client/src/components/AppShell.tsx');
  const settings = read('client/src/pages/SettingsPage.tsx');
  const server = read('server.js');
  for (const destination of ['Residence', 'Daily Rhythm', 'Execution & Focus', 'Growth & Direction']) {
    assert.ok(shell.includes("label: '" + destination + "'"), 'Missing room ' + destination);
  }
  assert.match(shell, /const rooms = \[/);
  assert.match(shell, /\^\[1-4\]\$/);
  for (const view of ['Faith & Practice', 'Habits & Self-Control', 'Projects & Tasks', 'Calendar', 'Goals & Milestones', 'Learning & Library', 'Reviews & Insights']) {
    assert.ok(shell.includes("label: '" + view + "'"), 'Missing room view ' + view);
  }
  assert.match(shell, /const activeTabs = location\.pathname === '\/quran' \? \[\] : \(current\?\.tabs \|\| \[\]\)/);
  assert.match(shell, /rooms\.map\(item =>/);
  assert.match(shell, /atlas-mobile-dock/);
  assert.match(shell, /to="\/quran"/);
  assert.match(shell, /PERSONAL TOOLS/);
  assert.match(shell, /<span>Qur’an<\/span>/);
  assert.match(shell, /YOUR LIFE AREAS/);
  assert.match(shell, /lifeAreaNames/);
  assert.match(settings, /Your life areas/);
  assert.match(settings, /life_areas: selectedLifeAreas/);
  assert.match(server, /'life_areas'/);
  assert.match(server, /Choose at least one valid life area/);
});


test('canonical eight-view routes and legacy compatibility redirects cover the personal operating system', () => {
  for (const route of ['/residence', '/blueprint', '/daily-rhythm', '/home', '/today', '/values', '/quran', '/habits', '/actions', '/execution', '/calendar', '/goals', '/learning-library', '/growth', '/reviews-insights', '/projects', '/tasks', '/focus', '/rituals', '/self-control', '/learning', '/library', '/reviews', '/insights', '/settings', '/admin']) {
    assert.ok(app.includes('path="' + route + '"'), 'Missing route ' + route);
  }
});

test('Express serves the built app while retaining legacy public assets', () => {
  assert.match(server, /express\.static\(frontendDist,\s*\{\s*setHeaders/);
  assert.match(server, /express\.static\(path\.join\(__dirname, 'public'\), \{ index: false \}\)/);
  assert.match(server, /res\.sendFile\(frontendEntry/);
  assert.match(server, /Refusing to serve the legacy public HTML shell/);
  assert.match(server, /app\.get\('\/service-worker\.js'/);
  assert.match(server, /no-store, no-cache, must-revalidate/);
  assert.match(server, /max-age=31536000, immutable/);
  assert.match(server, /RENDER_GIT_COMMIT/);
  assert.match(server, /atlas-shell-\$\{buildRevision\}/);
});


test('Today supports fast task capture and deadline-aware priorities', () => {
  const today = read('client/src/pages/TodayPage.tsx');
  assert.ok(today.includes('readHifzPage'));
  assert.ok(today.includes('Open Qur’an · Hifz P.{hifzPage}'));
  assert.ok(today.includes('to="/quran"'));
  assert.match(today, /today-quick-capture/);
  assert.match(today, /api<Task>\('\/tasks'/);
  assert.match(today, /a\.due_date\.localeCompare\(b\.due_date\)/);
  assert.match(today, /Overdue/);
});

test('FocusWorkspace uses one shared timer store and owns the focus-session workflow', () => {
  const workspace = read('client/src/components/FocusWorkspace.tsx');
  const timerStore = read('client/src/lib/focusTimerStore.ts');
  assert.match(workspace, /useFocusTimer/);
  assert.match(workspace, /updateFocusTimer/);
  assert.match(workspace, /timer.deadline-now/);
  assert.match(workspace, /function pause\(/);
  assert.match(workspace, /function reset\(/);
  assert.match(workspace, /lesson_id:timer.lessonId/);
  assert.match(workspace, /learning-study-logs/);
  assert.match(timerStore, /atlas-focus-timer-v1/);
  assert.match(timerStore, /useSyncExternalStore/);
  assert.match(timerStore, /localStorage\.setItem/);
  assert.ok(read('client/src/pages/ExecutionFocusPage.tsx').includes('ROOM 03 / EXECUTION & FOCUS'));
    assert.ok(read('client/src/App.tsx').includes('path="/focus"'));
  assert.match(read('client/src/pages/LearningPage.tsx'), /\/focus\?lesson=/);
  assert.match(read('client/src/pages/TodayPage.tsx'), /\/focus\?task=/);
  assert.match(read('client/src/pages/ValuesPage.tsx'), /\/focus\?focus=/);
});




test('Morning Alignment and Evening Shutdown persist in the daily review record', () => {
  const residence = read('client/src/pages/TodayPage.tsx');
  assert.match(server, /intention TEXT NOT NULL DEFAULT ''/);
  assert.ok(server.includes("priority_task_ids TEXT NOT NULL DEFAULT '[]'"));
  assert.match(server, /alignment_complete INTEGER NOT NULL DEFAULT 0/);
  assert.match(server, /shutdown_complete INTEGER NOT NULL DEFAULT 0/);
  assert.match(server, /priorityIds\.length>3/);
  assert.match(server, /One of your selected priorities no longer exists/);
  assert.match(residence, /MORNING ALIGNMENT/);
  assert.match(residence, /Choose up to three priorities/);
  assert.match(residence, /EVENING SHUTDOWN/);
  assert.match(residence, /Complete evening shutdown/);
  assert.match(residence, /api<DailyReview\[]>\('\/reviews\?period=daily'\)/);
});

test('Residence derives a daily consistency pulse from active life areas', () => {
  const residence = read('client/src/pages/TodayPage.tsx');
  assert.match(residence, /TODAY'S ACTIVITY PULSE/);
  assert.doesNotMatch(residence, /TODAY'S CONSISTENCY PULSE/);
  assert.match(residence, /api<Deen>\('\/deen\/summary/);
  assert.match(residence, /api<Faith\[]>\('\/faith/);
  assert.match(residence, /scoreDimensions/);
  assert.match(residence, /selectedLifeAreas/);
  assert.match(residence, /lifeAreaCards\.filter/);
  assert.match(residence, /Progress is personal/);
  assert.match(residence, /atlas-focus-timer-v1/);
  assert.match(residence, /activeFocusContext/);
  assert.match(residence, /showCalendar/);
  assert.match(residence, /calendar-summary/);
  assert.match(residence, /HABIT STREAK/);
  assert.match(residence, /Focus streak/);
  assert.match(residence, /api<SelfControlSummary>\('\/self-control\?date=/);
  assert.match(residence, /Your commitments/);
  assert.match(residence, /residence-band--orientation/);
  assert.match(residence, /residence-band--overview/);
  assert.match(residence, /residence-band--execution/);
  assert.match(residence, /api<AnnouncementFeed>\('\/announcements'/);
  assert.match(residence, /markAnnouncementRead/);
});

test('Goals expose linked projects, tasks and daily habits', () => {
  const goals = read('client/src/pages/GoalsPage.tsx');
  assert.match(goals, /api<Project\[]>\('\/projects'/);
  assert.match(goals, /api<Task\[]>\('\/tasks'/);
  assert.match(goals, /api<Habit\[]>\('\/habits'/);
  assert.match(goals, /linkedHabits/);
});

test('Habit tracker exposes a seven-day completion history', () => {
  const rituals = read('client/src/pages/RitualsPage.tsx');
  assert.match(rituals, /Array\.from\(\{ length: 7 \}/);
  assert.match(rituals, /useQueries/);
  assert.match(rituals, /rituals-week-dots/);
  assert.match(rituals, /historyCount \+ '\/7'/);
});


test('signature OS dock and cross-room focus controls remain present', () => {
  const shell = read('client/src/components/AppShell.tsx');
  assert.match(shell, /atlas-command-dock/);
  assert.match(shell, /Quick Capture/);
  assert.match(shell, /Daily Check-In/);
  assert.match(shell, /focusSessionVisible/);
  assert.match(shell, /useFocusTimer/);
  assert.match(shell, /updateFocusTimer/);
  assert.match(read('client/src/components/FocusWorkspace.tsx'), /startedAt/);
});

test('Residence day ribbon reflects local time and completed focus and rhythm records', () => {
  const residence = read('client/src/pages/TodayPage.tsx');
  assert.match(residence, /residence-day-ribbon/);
  assert.match(residence, /PRIVATE TIME/);
  assert.match(residence, /completedFocusBlocks/);
  assert.match(residence, /completedRhythmAnchors/);
  assert.match(residence, /Africa\/Lagos/);
});

test('keyboard task navigation exposes select, complete and focus shortcuts', () => {
  const tasks = read('client/src/pages/TasksPage.tsx');
  const residence = read('client/src/pages/TodayPage.tsx');
  for (const source of [tasks, residence]) {
    assert.match(source, /ArrowDown/);
    assert.match(source, /ArrowUp/);
    assert.match(source, /event\.key === ' '/);
    assert.match(source, /event\.key\.toLowerCase\(\) === 'f'/);
  }
});

test('all ten themes inherit specular card surfaces and structural skeletons', () => {
  const css = read('client/src/styles.css');
  assert.match(css, /--bg-canvas: var\(--bg\)/);
  assert.match(css, /--bg-surface: var\(--surface\)/);
  assert.match(css, /--bg-elevated: var\(--surface-raised\)/);
  assert.match(css, /inset 0 1px 0 0 rgba\(255,255,255,\.07\)/);
  assert.match(css, /inset 0 1px 0 0 rgba\(255,255,255,\.85\)/);
  assert.match(css, /atlas-skeleton-shimmer/);
});


test('Feel & Tactile micro-craft keeps browser title, numeric alignment and motion feedback accessible', () => {
  const shell = read('client/src/components/AppShell.tsx');
  const ui = read('client/src/components/ui.tsx');
  const css = read('client/src/styles.css');
  assert.match(shell, /document\.title = focusClock/);
  assert.match(shell, /document\.title = 'Amstreem Atlas'/);
  assert.match(shell, /whileTap=\{\{ scale: 0\.985 \}\}/);
  assert.match(ui, /whileTap=\{\{ scale: 0\.985 \}\}/);
  assert.match(css, /font-variant-numeric: tabular-nums/);
});

test('Web Audio micro-feedback is zero-dependency, opt-in, quiet and tied to check-offs and Focus completion', () => {
  const audio = read('client/src/lib/microFeedback.ts');
  assert.match(audio, /atlas-sound-feedback/);
  assert.match(audio, /localStorage\.getItem\(FEEDBACK_KEY\) !== 'on'/);
  assert.match(audio, /notes=\[523\.25,659\.25,783\.99\]/);
  assert.match(audio, /tone\(660/);
  assert.match(audio, /tone\(880/);
  assert.match(read('client/src/pages/SettingsPage.tsx'), /Subtle sound cues/);
  assert.match(read('client/src/components/FocusWorkspace.tsx'), /playAtlasFeedback\('complete'\)/);
  assert.match(read('client/src/pages/TodayPage.tsx'), /playAtlasFeedback\('tick'\)/);
  assert.match(read('client/src/pages/ValuesPage.tsx'), /playAtlasFeedback\('tick'\)/);
});

test('first-run walkthrough explains the six Atlas destinations and personal life areas', () => {
  const tour = read('client/src/components/AtlasWalkthrough.tsx');
  const shell = read('client/src/components/AppShell.tsx');
  const residence = read('client/src/pages/TodayPage.tsx');
  assert.equal((tour.match(/title: '/g) || []).length, 7);
  assert.match(tour, /Start with Home/);
  assert.match(tour, /⌘ 6 · Calendar/);
  assert.match(tour, /Choose the life areas you want to work on/);
  assert.match(tour, /Today’s priorities/);
  assert.match(tour, /Upcoming commitments/);
  assert.match(tour, /Life-area context/);
  assert.match(tour, /UNDERSTAND WHERE YOU ARE/);
  assert.match(tour, /Qur’an, Learning Library and faith practices/);
  assert.match(tour, /Measurable outcomes/);
  assert.match(tour, /Focus timer · Study sessions/);
  assert.match(tour, /Progress evidence/);
  assert.match(tour, /Daily and weekly schedules/);
  assert.match(tour, /Learning/);
  assert.match(tour, /Reviews · Progress evidence/);
  assert.match(tour, /PERSONAL BY DESIGN/);
  assert.match(tour, /navigate\(stepRoutes\[index\]\)/);
  assert.match(tour, /onOpenCommand\?\.\(\)/);
  assert.match(shell, /onOpenCommand=\{\(\) => \{ setCommandOpen\(true\);/);
  assert.match(residence, /Good \$\{rhythm/);
});

test('AlQuranCloud fetches canonical quran-uthmani and Sahih editions directly for page and Surah APIs', () => {
  const offline = JSON.parse(read('server/quran-fallback.json'));
  for (const item of ["app.get('/api/quran/page/:page'","fetchAlQuranCloudPage","'/page/' + page + '/quran-uthmani'","'/page/' + page + '/en.sahih'","'/surah/' + surahNumber + '/editions/quran-uthmani,en.sahih'",'https://api.alquran.cloud/v1','quranPageCache = new Map()','quranPageInflight = new Map()','parseAlQuranTajweed','normalizeMadinahArabic','tajweedSegments','tajweedText','normalizeAlQuranCloudSurah','fetchAlQuranCloudSurah','quranSurahCache = new Map()']) assert.ok(server.includes(item), 'Missing endpoint feature: ' + item);
  assert.ok(!server.includes('alignTajweedToUthmani'), 'Cross-string alignment must not remain');
  assert.deepEqual(Object.keys(offline.pages).sort(), ['1','602','603','604']);
});

test('global scrollbars use theme tokens consistently and the workspace has a single page-level scroll owner', () => {
  const css = read('client/src/styles.css');
  const shell = read('client/src/components/AppShell.tsx');
  assert.match(css, /scrollbar-width:thin;\s*scrollbar-color:var\(--border-strong\) transparent/);
  assert.match(css, /\*::-webkit-scrollbar \{ width:6px; height:6px; \}/);
  assert.match(css, /\*::-webkit-scrollbar-track \{ background:transparent; \}/);
  assert.match(css, /\*::-webkit-scrollbar-thumb \{ background:var\(--border-strong\); border-radius:999px; \}/);
  assert.match(css, /\*::-webkit-scrollbar-thumb:hover \{ background:var\(--accent-primary\); \}/);
  assert.match(css, /\.app-frame, \.main-area, \.page-container \{ overflow-y:visible; \}/);
  assert.match(css, /\.primary-nav \{[^}]*overflow: auto;/);
  assert.ok(shell.includes('className="page-container"'));
});

test('mobile web app capability metadata includes the standard non-Apple declaration', () => {
  const html = read('client/index.html');
  assert.ok(html.includes('<meta name="mobile-web-app-capable" content="yes" />'));
});


test('CSP uses same-origin scripts only and index contains no inline script bodies', () => {
  const html = read('client/index.html');
  const server = read('server.js');
  assert.match(server, /script-src 'self'/);
  assert.doesNotMatch(server, /script-src[^\n]*https?:/);
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  assert.ok(scripts.length >= 1);
  assert.ok(scripts.every(match => /\bsrc\s*=/.test(match[1]) && !match[2].trim()));
});

test('Uthmanic Hafs font endpoint validates WOFF2 and sends same-origin immutable font headers', () => {
  const server = read('server.js');
  assert.match(server, /\.subarray\(0, 4\)\.toString\('ascii'\)\s*===\s*'wOF2'/);
  assert.match(server, /res\.setHeader\('Content-Type',\s*'font\/woff2'\)/);
  assert.match(server, /res\.setHeader\('Cache-Control',\s*'public, max-age=31536000, immutable'\)/);
});



test('Mobile Qur’an Mushaf renders Quran.com-style chrome, both reading modes, and preserved bookmark hooks', () => {
  const reader = read('client/src/components/QuranMushafReader.tsx');
  assert.match(reader, /export function QuranMushafReader\(\{ settings, settingsReady, onLogged/);
  assert.match(reader, /quran-mobile-shell/);
  assert.doesNotMatch(reader, /Desktop reader layout is being rebuilt separately/);
  assert.match(reader, /Verse by Verse/);
  assert.match(reader, /Page by Page/);
  assert.match(reader, /Tajweed colors/);
  assert.match(reader, /quran-mobile-hero/);
  assert.match(reader, /quran-mobile-bismillah/);
  assert.match(reader, /quran-mobile-page-divider/);
  assert.match(reader, /quran-mobile-verse-row/);
  assert.match(reader, /quran-mobile-medallion/);
  assert.match(reader, /IntersectionObserver/);
  assert.match(reader, /lastSavedKeyRef/);
  assert.match(reader, /atlas_hifz_bookmark_v2/);
  assert.match(reader, /atlas_murajaah_bookmark_v2/);
  assert.match(reader, /fetch\('\/api\/quran\/page\//);
  assert.match(reader, /fetch\('\/api\/quran\/surah\//);
  assert.doesNotMatch(reader, /<audio\b|Tafsir|Lessons|Reflections/);
});

test('Mobile Mushaf styling is scoped below 768px and uses all ten-theme semantic tokens', () => {
  const css = read('client/src/styles.css');
  const mobileStart = css.lastIndexOf("/* Mobile Qur'an Mushaf");
  const desktopStart = css.indexOf("/* Desktop fallback frame", mobileStart);
  const mobile = css.slice(mobileStart, desktopStart > -1 ? desktopStart : undefined);
  assert.match(mobile, /@media \(max-width: 767px\)/);
  assert.match(mobile, /--bg-canvas/);
  assert.match(mobile, /--bg-surface/);
  assert.match(mobile, /--text-primary/);
  assert.match(mobile, /--text-secondary/);
  assert.match(mobile, /--border-hairline/);
  assert.match(mobile, /quran-mobile-header/);
  assert.match(mobile, /quran-mobile-settings/);
  assert.match(mobile, /quran-mobile-surah-drawer/);
  assert.match(mobile, /quran-mobile-medallion/);
  assert.doesNotMatch(mobile, /@media \(min-width: 768px\)/);
  assert.match(css, /\.sidebar/);
  assert.match(css, /\.main-area/);
});

test('Reader keeps the original required public props', () => {
  const reader = read('client/src/components/QuranMushafReader.tsx');
  assert.match(reader, /type Props = \{ settings: Settings; settingsReady: boolean; onLogged: \(\) => void/);
  assert.match(reader, /export function QuranMushafReader\(\{ settings, settingsReady, onLogged/);
});

test('Qur’an is a standalone workspace and no longer renders inside Deen', () => {
  const values = read('client/src/pages/ValuesPage.tsx');
  const quran = read('client/src/pages/QuranPage.tsx');
  const shell = read('client/src/components/AppShell.tsx');
  const app = read('client/src/App.tsx');
  assert.doesNotMatch(values, /QuranMushafReader|openMushaf/);
  assert.match(quran, /QuranMushafReader/);
  assert.match(quran, /autoOpen/);
  assert.ok(app.includes('path="/quran" element={<QuranPage />}'));
  assert.match(shell, /to="\/quran"/);
  assert.match(shell, /PERSONAL TOOLS/);
  assert.ok(!shell.includes('/values?openMushaf=1'));
  assert.match(shell, /faithTabLabel = quickReligion === 'islam' \? 'Deen'/);
});

test('standalone Qur’an route initializes the reader open without an effect-timing flash', () => {
  const reader = read('client/src/components/QuranMushafReader.tsx');
  assert.match(reader, /const \[fullScreen, setFullScreen\] = useState\(\(\) => autoOpen\)/);
  assert.doesNotMatch(reader, /autoOpenHandled/);
  assert.match(read('client/src/pages/QuranPage.tsx'), /autoOpen/);
});


test('Atlas four-room navigation exposes the eight core views and keeps Qur’an as a protected specialist route', () => {
  const shell = read('client/src/components/AppShell.tsx');
  const app = read('client/src/App.tsx');
  const quranPage = read('client/src/pages/QuranPage.tsx');
  const reader = read('client/src/components/QuranMushafReader.tsx');
  assert.match(shell, /label: 'Residence'/);
  assert.match(shell, /label: 'Daily Rhythm'/);
  assert.match(shell, /label: 'Execution & Focus'/);
  assert.match(shell, /label: 'Growth & Direction'/);
  assert.match(shell, /label: 'Faith & Practice'/);
  assert.match(shell, /label: 'Habits & Self-Control'/);
  assert.match(shell, /label: 'Projects & Tasks'/);
  assert.match(shell, /label: 'Goals & Milestones'/);
  assert.match(shell, /label: 'Learning & Library'/);
  assert.match(shell, /label: 'Reviews & Insights'/);
  assert.match(shell, /location\.pathname === '\/quran' \? \[\] :/);
  assert.match(shell, /to="\/quran"/);
  assert.match(app, /path="\/quran" element={<QuranPage \/>}/);
  assert.match(quranPage, /<QuranMushafReader/);
  assert.match(reader, /UthmanicHafs|tajweed|Tajweed/);
});


test('Residence is a direction-led Home, Life Blueprint is data-backed, and the previous daily dashboard remains available', () => {
  const app = read('client/src/App.tsx');
  const shell = read('client/src/components/AppShell.tsx');
  const home = read('client/src/pages/AtlasHomePage.tsx');
  const blueprint = read('client/src/pages/BlueprintPage.tsx');
  assert.ok(app.includes('path="/residence" element={<AtlasHomePage />}'));
  assert.ok(app.includes('path="/blueprint" element={<BlueprintPage />}'));
  assert.ok(app.includes('path="/daily-rhythm" element={<TodayPage />}'));
  assert.ok(home.includes("api<HomeTask[]>('/tasks')"));
  assert.ok(home.includes("api<HomeGoal[]>('/goals')"));
  assert.ok(home.includes("api<FocusSession[]>('/sessions')"));
  assert.match(home, /Your next actions/);
  assert.match(home, /Your current direction/);
  assert.match(home, /Nothing demanding your attention/);
  assert.ok(blueprint.includes("api<BlueprintGoal[]>('/goals')"));
  assert.match(blueprint, /linked_tasks/);
  assert.match(blueprint, /completed_tasks/);
  assert.match(blueprint, /Ready for its first connected action/);
  assert.match(shell, /label: 'Life Blueprint'/);
  assert.match(shell, /label: 'Daily Check-in'/);
});


test('personal intelligence suggestions are actionable, feedback-aware, and count focus sessions without breaks', () => {
  const start = server.indexOf("app.get('/api/intelligence'");
  const end = server.indexOf("app.post('/api/intelligence/feedback'", start);
  const intelligence = server.slice(start, end);
  const insights = read('client/src/pages/InsightsPage.tsx');
  assert.match(intelligence, /session_date=\? AND session_kind='focus'/);
  assert.match(intelligence, /session_kind='focus' GROUP BY weekday/);
  assert.match(intelligence, /recommendationStats/);
  assert.match(insights, /function recommendationHref/);
  assert.match(insights, /\/actions\?task=/);
  assert.match(insights, /\/focus\?lesson=/);
  assert.match(insights, /\/intelligence\/feedback/);
  assert.match(insights, /feedback\.mutate\('helpful'\)/);
  assert.match(insights, /feedback\.mutate\('not_useful'\)/);
  assert.match(insights, /feedback\.mutate\('opened'\)/);
});


test('route-level code splitting keeps the specialist Qur’an route statically loaded', () => {
  const app = read('client/src/App.tsx');
  assert.match(app, /const AtlasHomePage = lazy\(\(\) => import\('\.\/pages\/AtlasHomePage'\)/);
  assert.match(app, /const FocusWorkspace = lazy\(\(\) => import\('\.\/components\/FocusWorkspace'\)/);
  assert.match(app, /function SuspendedPage/);
  assert.match(app, /import \{ QuranPage \} from '\.\/pages\/QuranPage'/);
  assert.ok(app.includes('path="/quran" element={<QuranPage />}'));
  assert.ok(!app.includes('lazy(() => import(\'./pages/QuranPage\')'));
});


test('first-run walkthrough teaches the four-room structure and keeps its route in sync with each step', () => {
  const tour = read('client/src/components/AtlasWalkthrough.tsx');
  assert.ok(tour.includes("const stepRoutes = ['/residence', '/daily-rhythm', '/actions', '/goals']"));
  for (const room of ['RESIDENCE', 'DAILY RHYTHM', 'EXECUTION & FOCUS', 'GROWTH & DIRECTION']) assert.ok(tour.includes(room));
  assert.match(tour, /const goToStep =/);
  assert.match(tour, /onClick=\{\(\) => goToStep\(i\)\}/);
  assert.doesNotMatch(tour, /⌘ 5|⌘ 6/);
});


test('staging branch configuration cannot silently fall back to production Supabase', () => {
  const config = JSON.parse(read('supabase-config.json'));
  const browserConfig = read('public/supabase-config.js');
  const server = read('server.js');
  assert.match(config.url, /^https:\/\/[a-z0-9]+\.supabase\.co$/);
  assert.doesNotMatch(config.url, /skjxwzmpajdcrfacwoap/);
  assert.equal(config.ownerUserId, null);
  assert.match(browserConfig, /yllzeblecyqnncgktnjw/);
  assert.doesNotMatch(browserConfig, /skjxwzmpajdcrfacwoap/);
  assert.match(server, /process\.env\.ATLAS_STAGING === 'true'/);
  assert.match(server, /Staging must never connect to the production Supabase project/);
});
