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

test('the four core destinations and More menu stay visible while secondary views remain optional', () => {
  const shell = read('client/src/components/AppShell.tsx');
  const settings = read('client/src/pages/SettingsPage.tsx');
  for (const room of ['Today', 'Deen & Qur’an', 'Focus', 'Goals']) {
    assert.ok(shell.includes("label: '" + room + "'"), 'Missing room ' + room);
  }
  assert.match(shell, /const rooms = \[/);
  assert.match(shell, /faithTabLabel = quickReligion === 'islam' \? 'Deen & Qur’an'/);
  assert.match(shell, /atlas-mobile-dock/);
  assert.match(shell, /<span>More/);
  assert.match(shell, /tabsByRoom/);
  assert.match(shell, /feature: 'calendar'/);
  assert.match(shell, /label: 'Goals · Projects · Learning', detail:/);
  assert.ok(shell.includes("label: 'Private Library'") && shell.includes("to: '/learning-library'"));
  assert.match(settings, /Optional workspace views/);
});

test('canonical eight-view routes and legacy compatibility redirects cover the personal operating system', () => {
  for (const route of ['/residence', '/today', '/values', '/habits', '/execution', '/calendar', '/goals', '/learning-library', '/reviews-insights', '/projects', '/tasks', '/focus', '/rituals', '/self-control', '/learning', '/library', '/reviews', '/insights', '/settings', '/admin']) {
    assert.ok(app.includes('path="' + route + '"'), 'Missing route ' + route);
  }
});

test('Express serves the built app while retaining legacy public assets', () => {
  assert.match(server, /express\.static\(frontendDist\)/);
  assert.match(server, /express\.static\(path\.join\(__dirname, 'public'\), \{ index: false \}\)/);
  assert.match(server, /res\.sendFile\(frontendEntry/);
  assert.match(server, /Refusing to serve the legacy public HTML shell/);
  assert.match(server, /app\.get\('\/service-worker\.js'/);
});


test('Today supports fast task capture and deadline-aware priorities', () => {
  const today = read('client/src/pages/TodayPage.tsx');
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

test('first-run walkthrough explains the five current Atlas rooms and follows canonical routes', () => {
  const tour = read('client/src/components/AtlasWalkthrough.tsx');
  const shell = read('client/src/components/AppShell.tsx');
  const residence = read('client/src/pages/TodayPage.tsx');
  assert.equal((tour.match(/title: '/g) || []).length, 5);
  assert.match(tour, /Welcome to Residence/);
  assert.match(tour, /Morning Intention/);
  assert.match(tour, /Top 3 Priorities/);
  assert.match(tour, /Activity Pulse/);
  assert.match(tour, /Ferrofluid Core/);
  assert.match(tour, /Islam, Christianity, or general reflection/);
  assert.match(tour, /30-Day Rhythm Constellation/);
  assert.match(tour, /25m, 50m, 80m/);
  assert.match(tour, /Life Constellation/);
  assert.match(tour, /pill switcher/);
  assert.match(tour, /Private Library/);
  assert.match(tour, /Reviews & Insights/);
  assert.match(tour, /10 curated themes/);
  assert.match(tour, /navigate\(stepRoutes\[index\]\)/);
  assert.match(tour, /onOpenCommand\?\.\(\)/);
  assert.match(shell, /onOpenCommand=\{\(\) => \{ setCommandOpen\(true\);/);
  assert.match(residence, /Good \$\{rhythm/);
});

test('Qur’an reader uses a same-origin cached proxy and full-screen ayah study controls', () => {
  const reader = read('client/src/components/QuranMushafReader.tsx');
  assert.match(server, /app\.get\('\/api\/quran\/page\/:page'/);
  assert.match(server, /quranPageCache = new Map\(\)/);
  assert.match(server, /page < 1 \|\| page > 604/);
  assert.match(server, /quran-uthmani,en\.sahih/);
  assert.match(server, /media-src 'self'.*islamic\.network.*everyayah\.com/);
  assert.match(server, /connect-src 'self'.*alquran\.cloud.*islamic\.network/);
  assert.match(reader, /fetch\('\/api\/quran\/page\/' \+ page\)/);
  assert.doesNotMatch(reader, /fetch\('https:\/\/api\.alquran\.cloud/);
  assert.match(reader, /Open Full-Screen Mushaf/);
  assert.match(reader, /QURAN_SURAHS\.map/);
  assert.match(reader, /mushaf-fs-verse-actions/);
  assert.match(reader, /audio\.play\(\)/);
  assert.match(reader, /Mishary Alafasy/);
  assert.match(reader, /Complete & Log Page/);
  assert.match(reader, /hifz_bookmark/);
  assert.match(reader, /murajaah_bookmark/);
});


test('Qur’an page proxy falls back across mirrors and serves bundled offline pages', () => {
  const reader = read('client/src/components/QuranMushafReader.tsx');
  const values = read('client/src/pages/ValuesPage.tsx');
  const offline = JSON.parse(read('server/quran-fallback.json'));
  assert.match(server, /AbortSignal\.timeout\(6000\)/);
  assert.match(server, /'User-Agent': 'AmstreemAtlas\/1\.0'/);
  assert.match(server, /api\.quran\.com\/api\/v4\/verses\/by_page/);
  assert.match(server, /normalizeQuranCom/);
  assert.match(server, /quranOfflinePages\[String\(page\)\]/);
  assert.match(server, /return \{ page, juz:/);
  assert.deepEqual(Object.keys(offline.pages).sort(), ['1', '602', '603', '604']);
  for (const page of ['1', '602', '603', '604']) assert.ok(offline.pages[page].ayahs.length > 0);
  assert.match(reader, /const result = payload as MushafPage/);
  assert.match(reader, /ayah\.surahNumber/);
  assert.match(reader, /createPortal\([\s\S]*?document\.body/);
  assert.match(reader, /document\.body\.style\.overflow = 'hidden'/);
  assert.match(reader, /z-index:9999/);
  assert.match(reader, /mushaf-surah-banner/);
  assert.match(reader, /mushaf-bismillah/);
  assert.match(reader, /﴿/);
  assert.match(reader, /height:48px/);
  assert.match(reader, /max-width:620px/);
  assert.match(reader, /\[17, 19, 21, 25, 29\]/);
  assert.match(reader, /atlas_mushaf_font_step_v1/);
  assert.match(reader, /line-height:1\.85/);
  assert.match(reader, /height:54px/);
  assert.match(reader, /useState\(false\)/);
  assert.match(reader, /safe-area-inset-bottom/);
  assert.match(reader, /mushaf-fs-overlay/);
  assert.match(reader, /mushaf-fs-header/);
  assert.match(reader, /mushaf-fs-stage/);
  assert.match(reader, /mushaf-fs-sheet/);
  assert.match(reader, /mushaf-fs-footer/);
  assert.match(reader, /readingMode === 'translation'/);
  assert.match(reader, /readingMode === 'reading'/);
  assert.match(reader, /Translation/);
  assert.match(reader, /Reading/);
  assert.match(reader, /mushaf-fs-verse-row/);
  assert.match(reader, /mushaf-fs-verse-translation/);
  assert.match(reader, /mushaf-fs-verse-actions/);
  assert.match(reader, /<Fragment key=\{ayah\.surahNumber/);
  assert.match(reader, /Previous<\/button>/);
  assert.match(reader, />Next <ChevronRight/);
  assert.match(reader, /Bookmark/);
  assert.match(reader, /mushaf-fs-arabic--\$\{fontSize\}/);
  assert.doesNotMatch(reader, /showTranslation/);
  assert.match(read('client/index.html'), /Amiri\+Quran/);
  assert.match(read('client/index.html'), /Scheherazade\+New/);
  assert.doesNotMatch(reader, /mushaf-ayah-flow[^>]*style=\{/);
  const mushafCss = read('client/src/styles.css');
  assert.match(mushafCss, /\.mushaf-fs-overlay\s*\{[\s\S]*?grid-template-rows:52px minmax\(0,1fr\) 60px/);
  assert.match(mushafCss, /\.mushaf-fs-sheet\s*\{[\s\S]*?max-width:560px/);
  assert.match(mushafCss, /\.mushaf-fs-header\s*\{[\s\S]*?max-width:720px/);
  assert.match(mushafCss, /\.mushaf-fs-footer\s*\{[\s\S]*?max-width:720px/);
  assert.match(values, /PageHeader[\s\S]*?deen-tradition-switcher/);
  assert.match(values, /RhythmConstellation\/>[\s\S]*?Choose faith workspace/);
  assert.doesNotMatch(values, /YOUR FAITH & REFLECTION SPACE/);
  assert.doesNotMatch(values, /DEEN · DAILY PRACTICE/);
  assert.doesNotMatch(values, /HIFZ \/ RECITATION \/ REVISION/);
});
