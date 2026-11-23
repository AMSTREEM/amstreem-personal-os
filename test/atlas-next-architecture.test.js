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
  assert.ok(shell.includes('to="/values?openMushaf=1"'));
  assert.ok(shell.includes('<BookOpen size={17} strokeWidth={1.8}/><span>Qur’an</span>'));
  assert.ok(shell.includes('atlas-mobile-dock__quran'));

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
  assert.ok(today.includes('Continue Qur’an · Hifz P.{hifzPage}'));
  assert.ok(today.includes('to="/values?openMushaf=1"'));
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

test('Qur’an reader uses the Quran.com page proxy, saved bookmarks, no reciter UI and a single portal launcher', () => {
  const reader = read('client/src/components/QuranMushafReader.tsx');
  const values = read('client/src/pages/ValuesPage.tsx');
  assert.ok(server.includes("app.get('/api/quran/page/:page'"));
  assert.ok(server.includes('quranPageCache = new Map()'));
  assert.ok(server.includes('QURAN_API_TOKEN'));
  assert.ok(reader.includes("fetch('/api/quran/page/' + page)"));
  assert.ok(reader.includes('Continue Hifz'));
  assert.ok(reader.includes('Continue Muraja’ah'));
  assert.ok(reader.includes('createPortal(') && reader.includes('document.body'));
  assert.doesNotMatch(reader, /reciters|reciter|Mishary|isPlaying|audioRef|playAyah|togglePlayback|<audio|aria-label="Play verse"|<Play/);
  assert.ok(reader.includes('hifz_bookmark') && reader.includes('murajaah_bookmark'));
  assert.ok(values.includes('<QuranMushafReader autoOpen={searchParams.get(\'openMushaf\') === \'1\'}'));
  assert.ok(reader.includes('autoOpen?: boolean'));
  assert.ok(reader.includes('autoOpenHandled.current = true'));
  assert.ok(reader.includes("openReader('hifz')"));
  assert.ok(values.includes('<QuranMushafReader settings=') || values.includes('<QuranMushafReader autoOpen='));
  assert.doesNotMatch(values, /Open Full-Screen Mushaf|rhythm-quran-layout|Save Qur’an record/);
});

test('Full-screen Mushaf opens without inline preview and uses a tap-to-toggle Ayah-style HUD', () => {
  const reader = read('client/src/components/QuranMushafReader.tsx');
  const css = read('client/src/styles.css');
  assert.ok(reader.includes('pageMemoryCache.clear()'));
  assert.ok(reader.includes('atlas_mushaf_page_v'));
  assert.ok(reader.includes('mushaf-loading-skeleton'));
  assert.ok(reader.includes('hudVisible'));
  assert.ok(reader.includes('mushaf-floating-top'));
  assert.ok(reader.includes('mushaf-floating-bottom'));
  assert.ok(reader.includes('mushaf-page-scrubber'));
  assert.ok(reader.includes('mushaf-quick-jump'));
  assert.doesNotMatch(reader, /mushaf-audio-control|reciter|Mishary|<audio|<Play|Play verse|Play recitation/);
  assert.doesNotMatch(css, /mushaf-audio-control|mushaf-floating-bottom select/);
  assert.ok(reader.includes('Page by Page') && reader.includes('Verse by Verse'));
  assert.ok(reader.includes('fontSteps = [16, 18, 20, 23, 26, 30, 34]'));
  assert.ok(reader.includes('style={{ fontSize: `${arabicFontSize}px` }}'));
  assert.ok(reader.includes('Auto-saved'));
  assert.ok(reader.includes('onMouseMove={event =>'));
  assert.ok(reader.includes('setLoading(true); setPageData(null); setPageError(\'\')'));
  assert.ok(reader.includes('mushaf-page-surah-opening'));
  assert.ok(reader.includes('word.charTypeName === \'end\' ? <AyahMedallion'));
  assert.ok(reader.includes('{item.ayahs} verses · {item.revelation}'));
  assert.ok(reader.includes('atlas_mushaf_starred_ayahs_v1'));
  assert.ok(reader.includes('mushaf-desktop-header'));
  assert.ok(reader.includes('mushaf-desktop-sidebar'));
  assert.ok(reader.includes('mushaf-desktop-sidebar-tabs'));
  assert.ok(reader.includes('mushaf-desktop-page-grid'));
  assert.ok(reader.includes('mushaf-page-desktop-arrows'));
  assert.match(reader, /readingMode === 'reading' && <div className="mushaf-page-desktop-arrows"/);
  assert.ok(reader.includes('mushaf-header-autosaved'));
  assert.doesNotMatch(reader, /mushaf-minimal-page-pill"><b>\{page\}<\/b><span>Auto-saved/);
  assert.doesNotMatch(reader, /mushaf-hud-autosaved/);
  assert.ok(reader.includes("fontFamily: \"'KFGQPC Uthmanic Script HAFS', 'Amiri Quran', serif\""));
  assert.ok(reader.includes('renderTajweedMarkup(ayah.tajweedText || ayah.text)'));
  assert.ok(reader.includes('word.tajweed || word.text'));
  assert.ok(reader.includes("wordSpacing: '2px'"));
  assert.ok(css.includes('UthmanicHafs1Ver18.woff2'));
  assert.ok(css.includes('family=Noto+Naskh+Arabic'));
  assert.ok(css.includes('.tajweed-ghunnah{color:#ff9a4d}'));
  assert.ok(css.includes('.tajweed-madda_normal{color:#72a0ff}'));
  assert.ok(css.includes('KFGQPC Uthmanic Script HAFS'));
  assert.ok(reader.includes('TAJWEED_RULES'));
  assert.ok(reader.includes('new DOMParser().parseFromString'));
  assert.ok(reader.includes("(node.textContent || '').replace(/[\\\\u06DD\\\\u06DE\\\\u06E9\\\\u06DF-\\\\u06E8\\\\u06EA-\\\\u06ED]/g, '')"));
  assert.ok(server.includes('text_qpc_hafs'));
  assert.ok(server.includes('text_uthmani_tajweed'));
  assert.ok(server.includes('mushaf=19'));
  assert.ok(server.includes('tajweed: String(word.text_uthmani_tajweed || \'\')'));
  assert.ok(server.includes('tajweedText: words.map(word => word.tajweed)'));
  assert.ok(reader.includes("CACHE_PREFIX = 'atlas_mushaf_page_v6_'"));
  assert.ok(server.includes('https://quran.foundation'));
  assert.ok(css.includes('.mushaf-header-autosaved'));
  assert.ok(css.includes('.mushaf-reading-canvas{padding-bottom:64px}'));
  assert.ok(reader.includes('mushaf-desktop-reading-switch'));
  assert.ok(css.includes('width:280px;min-width:280px'));
  assert.ok(css.includes('@media(min-width:768px)'));
  assert.ok(css.includes('@media(max-width:767px)'));
  assert.ok(css.includes('.mushaf-reading-screen{') && css.includes('100dvh'));
  assert.ok(css.includes('backdrop-filter:blur(16px)'));
  assert.ok(css.includes('max-width:640px'));
  assert.ok(css.includes('.mushaf-minimal-page-pill'));
});

test('Mushaf contents has Surah, Juz and Bookmarks navigation with a 114-Surah quick rail', () => {
  const reader = read('client/src/components/QuranMushafReader.tsx');
  const css = read('client/src/styles.css');
  assert.ok(reader.includes("contentsTab, setContentsTab"));
  assert.ok(reader.includes('Bookmarks'));
  assert.ok(reader.includes('Hifz (Memorization)'));
  assert.ok(reader.includes('Muraja’ah (Revision)'));
  assert.ok(reader.includes('starredAyahs.map'));
  assert.ok(reader.includes('QURAN_SURAHS.map(item => <button'));
  assert.ok(reader.includes('jumpSurah(item.number)'));
  assert.ok(reader.includes('jumpJuz(juz)'));
  assert.ok(css.includes('border-radius:14px'));
  assert.ok(css.includes('.mushaf-contents-rail'));
  assert.ok(css.includes('.mushaf-contents-list>button.is-current'));
});

test('Qur’an page proxy falls back cleanly and the Mushaf groups QCF words by 15-line page metadata', () => {
  const reader = read('client/src/components/QuranMushafReader.tsx');
  const css = read('client/src/styles.css');
  const values = read('client/src/pages/ValuesPage.tsx');
  const offline = JSON.parse(read('server/quran-fallback.json'));
  assert.ok(server.includes('AbortSignal.timeout(9000)'));
  assert.ok(server.includes('api.quran.com/api/v4/verses/by_page'));
  assert.ok(server.includes('normalizeQuranCom'));
  assert.ok(server.includes('normalizeAlQuranCloud'));
  assert.ok(server.includes('qcfAvailable'));
  assert.deepEqual(Object.keys(offline.pages).sort(), ['1', '602', '603', '604']);
  for (const page of ['1', '602', '603', '604']) assert.ok(offline.pages[page].ayahs.length > 0);
  assert.ok(reader.includes('atlas_mushaf_page_v6_'));
  assert.ok(reader.includes('sanitizeMushafPage(payload as MushafPage)'));
  assert.ok(reader.includes('readingLines = useMemo'));
  assert.ok(reader.includes('word.pageNumber !== page'));
  assert.ok(reader.includes('KFGQPC Uthmanic Script HAFS'));
  assert.ok(css.includes('font-display:swap'));
  assert.ok(server.includes('text_qpc_hafs'));
  assert.ok(reader.includes('function AyahMedallion'));
  assert.ok(reader.includes('mushaf-ayah-medallion-frame'));
  assert.ok(reader.includes('stripAyahEndMarker'));
  assert.ok(reader.includes("document.documentElement"));
  assert.ok(reader.includes("root.style.overflow = 'hidden'"));
  assert.ok(reader.includes('mushaf-fs-verse-row'));
  assert.ok(reader.includes('mushaf-fs-verse-translation'));
  assert.ok(reader.includes('mushaf-fs-qcf-page'));
  assert.ok(reader.includes('mushaf-page-running-header'));
  assert.ok(reader.includes('fontSize: `${arabicFontSize}px`'));
  assert.ok(css.includes('.mushaf-fs-qcf-page'));
  assert.ok(css.includes('.mushaf-fs-verse-arabic'));
  assert.ok(values.includes('<QuranMushafReader autoOpen=') || values.includes('<QuranMushafReader settings='));
});

test('Mushaf scroll locking restores document overflow styles and uses one contained reading canvas', () => {
  const reader = read('client/src/components/QuranMushafReader.tsx');
  const css = read('client/src/styles.css');
  assert.match(reader, /const previousRootOverflow = root\.style\.overflow/);
  assert.match(reader, /const previousBodyOverflow = document\.body\.style\.overflow/);
  assert.match(reader, /root\.style\.overflow = 'hidden'/);
  assert.match(reader, /document\.body\.style\.overflow = 'hidden'/);
  assert.ok(reader.includes('mushaf-reading-screen'));
  assert.ok(css.includes('.mushaf-reading-canvas{'));
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

 
test('Mushaf page keeps the Surah header, centered verse medallions and full-page Uthmani layout', () => {
  const reader = read('client/src/components/QuranMushafReader.tsx');
  const css = read('client/src/styles.css');
  assert.ok(reader.includes('function SurahCartouche'));
  assert.ok(reader.includes('function BismillahOrnament'));
  assert.ok(reader.includes('سُورَةُ'));
  assert.ok(reader.includes('بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ'));
  assert.ok(css.includes('.mushaf-fs-qcf-page{'));
  assert.ok(css.includes('.mushaf-page-running-header{'));
  assert.ok(css.includes('.mushaf-page-number{'));
  assert.ok(reader.includes('ayah.surahNumber !== 1 && ayah.surahNumber !== 9'));
  assert.ok(reader.includes('mushaf-contents-panel'));
  assert.ok(css.includes('.mushaf-reading-canvas.is-page-mode'));
  assert.ok(css.includes('line-height:1.55'));
  assert.ok(css.includes('max-width:640px'));
  assert.ok(css.includes('overflow:hidden'));
});

test('Mushaf saves the active page and ayah locally immediately and debounces workspace settings', () => {
  const reader = read('client/src/components/QuranMushafReader.tsx');
  assert.match(reader, /localStorage\.setItem\(key, JSON\.stringify\(mark\)\)/);
  assert.match(reader, /window\.setTimeout\(\(\) =>/);
  assert.match(reader, /}, 1200\)/);
  assert.match(reader, /window\.clearTimeout\(timer\)/);
  assert.match(reader, /atlas_quran_auto_logged_pages_/);
  assert.match(reader, /autoLoggedPagesRef/);
  assert.match(reader, /api\('\/deen\/quran'/);
  assert.doesNotMatch(reader, /Complete &amp; Log Page|Log Surah Reading/);
  assert.match(reader, /changePage\(item\.pageStart, \{ surahNumber: number, numberInSurah: 1 \}\)/);
  assert.match(reader, /const target = savedAyah \|\| pageData\.ayahs\[0\]/);
  assert.match(reader, /changeReadingMode/);
  assert.ok(reader.includes('mushaf-minimal-page-pill'));
});


test('Full-Screen Mushaf strips raw Qur’an ornaments, uses uniform 32px SVG medallions, and logs pages automatically', () => {
  const reader = read('client/src/components/QuranMushafReader.tsx');
  const css = read('client/src/styles.css');
  assert.ok(reader.includes('stripAyahEndMarker'));
  assert.match(reader, /mushaf-ayah-medallion-frame/);
  assert.doesNotMatch(reader, /Complete &amp; Log Page|Log Surah Reading/);
  assert.match(reader, /atlas_quran_auto_logged_pages_/);
  assert.match(reader, /max="604"/);
  assert.ok(reader.includes('mushaf-minimal-page-pill'));
  assert.ok(read('client/src/styles.css').includes('flex:0 0 32px'));
  assert.ok(css.includes('.mushaf-contents-panel{width:100%'));
  assert.ok(css.includes('overflow-x:hidden'));
  assert.ok(read('client/src/styles.css').includes('padding:12px 16px'));
});


test('Quran.com-inspired Mushaf chrome, reading proportions and mobile quick access remain in place', () => {
  const reader = read('client/src/components/QuranMushafReader.tsx');
  const css = read('client/src/styles.css');
  const shell = read('client/src/components/AppShell.tsx');
  assert.match(reader, /<Bookmark size=\{14\}\/><span>Page \{page\} · Juz \{pageJuz\}<\/span>/);
  assert.match(reader, /mushaf-fs-verse-topline/);
  assert.match(reader, /In the Name of Allah—the Most Compassionate, Most Merciful/);
  assert.match(reader, /window\.matchMedia\('\(min-width: 768px\)'\)\.matches/);
  assert.match(css, /height:46px;min-height:46px/);
  assert.match(css, /width:270px;min-width:270px/);
  assert.match(css, /max-width:780px/);
  assert.match(css, /max-width:540px/);
  assert.match(css, /position:fixed;right:20px;bottom:20px/);
  assert.match(css, /mushaf-mobile-sidebar-scrim/);
  assert.match(shell, /atlas-mobile-dock__quran/);
});
