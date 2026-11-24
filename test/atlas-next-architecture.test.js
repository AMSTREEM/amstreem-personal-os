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
  assert.ok(today.includes('Open Qur’an · Hifz P.{hifzPage}'));
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
  assert.ok(server.includes("app.get('/api/quran/surah/:surah'"));
  assert.ok(server.includes('quranSurahCache = new Map()'));
  assert.ok(server.includes('AbortSignal.timeout(15000)'));
  assert.ok(server.includes('attempt < 2'));
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
  assert.ok(reader.includes('mushaf-settings-popover'));
  assert.ok(reader.includes('tajweedEnabled') && reader.includes('Tajweed color key'));
  assert.ok(reader.includes("openReader('hifz')"));
  assert.ok(values.includes('<QuranMushafReader settings=') || values.includes('<QuranMushafReader autoOpen='));
  assert.doesNotMatch(values, /Open Full-Screen Mushaf|rhythm-quran-layout|Save Qur’an record/);
});

test('Mushaf reading settings persist font, five font sizes, three layouts and Tajweed preference', () => {
  const reader = read('client/src/components/QuranMushafReader.tsx');
  const html = read('client/index.html');
  const css = read('client/src/styles.css');
  for (const item of ['atlas_mushaf_font_family_v1','atlas_mushaf_font_size_v1','atlas_mushaf_layout_v1','atlas_mushaf_tajweed_v1','Madinah Uthmani','Modern Naskh Clarity','Traditional Calligraphic','Verse by Verse','Page by Page','Arabic Only','Tajweed colors','mushaf-settings-popover','fontSize: arabicFontSize']) assert.ok(reader.includes(item), 'Missing Mushaf setting: ' + item);
  for (const size of ['20,24,28,32,36']) assert.ok(reader.includes(size), 'Missing five-step Arabic font size scale');
  assert.ok(html.includes("Noto+Naskh+Arabic"));
  assert.match(css, /mushaf-settings-popover/);
  assert.match(css, /--mushaf-arabic-font/);
  for (const font of ['Amiri Quran','Scheherazade New','Noto Naskh Arabic','Amiri','Lateef','Aref Ruqaa','mushaf-font-preview-card','MUSHAF_FONT_SAMPLE']) assert.ok(reader.includes(font), 'Missing live font preview: ' + font);
  for (const color of ['#D500B7','#E040FB','#FF5252','#F43F5E','#169200','#22C55E','#0091EA','#38BDF8','#D97706','#F59E0B','#9CA3AF']) assert.ok(css.includes(color), 'Missing Tajweed palette colour: ' + color);
  assert.ok(reader.includes('Madd Lazim') && reader.includes('Madd Wajib'));
  assert.match(css, /opacity:\.55/);
});

test('Mushaf rebuild uses a fixed top bar, three-tab sidebar and two clean reading views', () => {
  const reader = read('client/src/components/QuranMushafReader.tsx');
  const css = read('client/src/styles.css');
  for (const item of ['mushaf-topbar','mushaf-sidebar-tabs','mushaf-surah-hero','mushaf-verse-row','mushaf-page-view','mushaf-page-arrows','Auto-saved']) assert.ok(reader.includes(item), 'Missing reader feature: ' + item);
  for (const item of ['mushaf-floating-top','mushaf-floating-bottom','mushaf-hud','mushaf-page-scrubber','mushaf-audio-control','reciter','Mishary','<audio','<Play']) assert.ok(!reader.includes(item), 'Legacy UI remains: ' + item);
  assert.ok(css.includes('height:48px;min-height:48px'));
  assert.ok(css.includes('flex:0 0 260px'));
  assert.ok(css.includes('width:min(100%,780px)'));
  assert.ok(css.includes('width:min(100%,500px)'));
  assert.ok(css.includes('width:28px;height:28px;min-width:28px'));
  assert.ok(css.includes('inset 0 0 0 2px var(--bg-canvas)'));
  assert.ok(css.includes('mushaf-medallion--wide'));
  assert.ok(css.includes('line-height:2.25'));
  assert.ok(css.includes('@media(max-width:420px)'));
  assert.ok(css.includes('position:fixed;right:20px;bottom:20px'));
  assert.ok(css.includes('@media(max-width:767px)'));
  assert.ok(css.includes('.mushaf-page-arrows'));
  assert.ok(css.includes('.mushaf-verse-translation'));
  assert.ok(css.includes('.mushaf-page-footer'));
});

test('AlQuranCloud fetches quran-tajweed and Sahih editions directly for page and Surah APIs', () => {
  const offline = JSON.parse(read('server/quran-fallback.json'));
  for (const item of ["app.get('/api/quran/page/:page'","fetchAlQuranCloudPage","'/page/' + page + '/quran-tajweed'","'/page/' + page + '/en.sahih'","'/surah/' + surahNumber + '/editions/quran-tajweed,en.sahih'",'https://api.alquran.cloud/v1','quranPageCache = new Map()','quranPageInflight = new Map()','parseAlQuranTajweed','normalizeMadinahArabic','tajweedSegments','tajweedText','normalizeAlQuranCloudSurah','fetchAlQuranCloudSurah','quranSurahCache = new Map()']) assert.ok(server.includes(item), 'Missing endpoint feature: ' + item);
  assert.ok(!server.includes('alignTajweedToUthmani'), 'Cross-string alignment must not remain');
  assert.deepEqual(Object.keys(offline.pages).sort(), ['1','602','603','604']);
});

test('Tajweed rendering sanitizes provider HTML, preserves direct tokens and invalidates v1-v9 caches', () => {
  const reader = read('client/src/components/QuranMushafReader.tsx');
  const css = read('client/src/styles.css');
  const server = read('server.js');
  for (const item of ['tajweedSegments','TAJWEED_CLASSES','tj-madd','tj-qalqalah','tj-ghunnah','tj-heavy','tajweedEnabled','parseBracketTajweed','normalizeMadinahArabic',"atlas_mushaf_page_v10_","atlas_mushaf_page_v[1-9]_","stripRawQuranMarkup"]) assert.ok(reader.includes(item), 'Missing Tajweed rendering feature: ' + item);
  for (const item of ['sanitizeQuranPayload','sanitizeQuranAyah','stripQuranMarkup','<[^>]+>']) assert.ok(server.includes(item), 'Missing server Quran HTML sanitizer: ' + item);
  assert.ok(reader.includes('useLayoutEffect'));
  assert.ok(reader.includes('new ResizeObserver(schedule)'));
  assert.ok(reader.includes('fontSize > 14'));
  assert.ok(reader.includes('const lineHeight = 2.05'));
  assert.ok(css.includes('height: 100dvh; max-height: 100dvh;'));
  assert.ok(css.includes('grid-template-rows: 32px minmax(0, 1fr) 34px;'));
  assert.ok(css.includes('overflow: hidden;'));
  assert.ok(css.includes('font-size: var(--mushaf-fit-font-size, 22px) !important;'));
  assert.ok(css.includes('line-height: var(--mushaf-fit-line-height, 1.9) !important;'));
  assert.ok(css.includes('transition: opacity 200ms ease, visibility 200ms ease;'));
  for (const rule of ["h:'tj-silent'","s:'tj-silent'","l:'tj-silent'","u:'tj-silent'","n:'tj-madd-wajib'","p:'tj-madd-wajib'","m:'tj-madd'","o:'tj-madd'","q:'tj-qalqalah'","g:'tj-ghunnah'","i:'tj-ghunnah'","c:'tj-ghunnah'","a:'tj-ghunnah'","w:'tj-ghunnah'","f:'tj-ghunnah'","r:'tj-heavy'"]) assert.ok(reader.includes(rule), 'Missing client rule: ' + rule);
  for (const color of ['#E040FB','#FF5252','#22C55E','#38BDF8','#60A5FA','#9CA3AF']) assert.ok(css.includes(color), 'Missing Quran.com Tajweed color: ' + color);
  assert.match(css, /\.mushaf-bismillah b\{/);
  assert.ok(!server.includes('alignTajweedToUthmani'));
  assert.ok(!reader.includes('new DOMParser('));
  assert.ok(!reader.includes('dangerouslySetInnerHTML'));
});
test('Mushaf keeps bookmarks, automatic Hifz/Muraja’ah logging and direct Residence access', () => {
  const reader = read('client/src/components/QuranMushafReader.tsx');
  const values = read('client/src/pages/ValuesPage.tsx');
  const today = read('client/src/pages/TodayPage.tsx');
  const shell = read('client/src/components/AppShell.tsx');
  assert.ok(reader.includes('hifz_bookmark') && reader.includes('murajaah_bookmark'));
  assert.ok(reader.includes('atlas_quran_auto_logged_pages_'));
  assert.ok(reader.includes("api('/deen/quran'"));
  assert.ok(reader.includes('Continue Hifz'));
  assert.ok(reader.includes('Continue Muraja’ah'));
  assert.ok(values.includes('<QuranMushafReader'));
  assert.ok(today.includes('Open Qur’an · Hifz P.{hifzPage}'));
  assert.ok(shell.includes('nav-link--quran'));
  assert.ok(shell.includes('atlas-mobile-dock__quran'));
  assert.ok(reader.includes('createPortal(') && reader.includes('document.body'));
  assert.ok(reader.includes('window.setTimeout'));
});

test('Mushaf renders page ayahs directly and restores saved verse without bookmark race', () => {
  const reader = read('client/src/components/QuranMushafReader.tsx');
  assert.ok(reader.includes("scrollIntoView({ behavior: 'auto', block: 'center' })"));
  assert.ok(reader.includes('pageData.ayahs.map((ayah, index)'));
  assert.ok(reader.includes('renderTajweedMarkup(ayah.tajweedText || \'\', ayah.tajweedSegments, ayah.text, tajweedEnabled)'));
  assert.ok(reader.includes('userScrolledRef.current = false'));
  assert.ok(reader.includes('if (!userScrolledRef.current) return;'));
  assert.ok(reader.includes('onWheel={() => { userScrolledRef.current = true; }}'));
  assert.ok(reader.includes('Auto-saved · {bookmarkSurahName} {bookmark.surah}:{bookmark.ayah}'));
});

test('Mushaf page view has chapter openings, centered verse medallions and a page/Juz footer', () => {
  const reader = read('client/src/components/QuranMushafReader.tsx');
  const css = read('client/src/styles.css');
  for (const item of ['function BismillahOrnament','بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ','mushaf-page-surah-banner','mushaf-page-text','mushaf-page-footer','— Page {page} · Juz {pageJuz} —','mushaf-medallion']) assert.ok(reader.includes(item), 'Missing page reader feature: ' + item);
  for (const item of ['.mushaf-page-view','.mushaf-page-text','.mushaf-page-surah-banner','.mushaf-page-footer','line-height:2.25']) assert.ok(css.includes(item), 'Missing page style: ' + item);
});

test('Mushaf scroll locking and local-first dual bookmark persistence are retained', () => {
  const reader = read('client/src/components/QuranMushafReader.tsx');
  for (const item of ["const previousRootOverflow = root.style.overflow","const previousBodyOverflow = document.body.style.overflow","root.style.overflow = 'hidden'","document.body.style.overflow = 'hidden'","localStorage.setItem(HIFZ_KEY, JSON.stringify(hifzMark))","localStorage.setItem(MURAJAAH_KEY, JSON.stringify(murajaahMark))",'window.setTimeout(() =>','}, 1500);','window.clearTimeout(timer)','new IntersectionObserver','data-mushaf-verse="true"','restoreTargetRef','changePage(item.pageStart, { surahNumber: number, numberInSurah: 1 })','onTouchMove={() => { userScrolledRef.current = true; }}','onKeyDown={() => { userScrolledRef.current = true; }}']) assert.ok(reader.includes(item), 'Missing persistence behavior: ' + item);
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

test('Mushaf page mode keeps all ayahs reachable and restores separate reading positions', () => {
  const reader = read('client/src/components/QuranMushafReader.tsx');
  const css = read('client/src/styles.css');
  assert.ok(reader.includes("readingMode === 'reading' ? pageTextRef.current : readerRef.current"));
  assert.ok(reader.includes("readingMode !== 'reading' || !pageData?.ayahs?.length || loading"));
  assert.ok(reader.includes("onScroll={() => { userScrolledRef.current = true; }}"));
  assert.ok(reader.includes("updateBookmark(page, first)"));
  assert.ok(reader.includes("updateBookmark(pageNumber, { surahNumber, numberInSurah: ayahNumber })"));
  assert.match(reader, /onClick=\{\(\) => \{ if \(isMobileViewport && readingMode === 'reading'\) setMobileControlsVisible/);
  assert.ok(css.includes("overflow-y: auto !important;"));
  assert.ok(css.includes("height: calc(100dvh - 48px) !important;"));
  assert.ok(css.includes("opacity: 1 !important;"));
});


test('Mushaf mobile page turns use finger tracking, prefetch and a single centered header pill', () => {
  const reader = read('client/src/components/QuranMushafReader.tsx');
  const css = read('client/src/styles.css');
  assert.ok(reader.includes("drag={isMobileViewport ? 'x' : false}"));
  assert.ok(reader.includes('dragConstraints={{ left: 0, right: 0 }}'));
  assert.ok(reader.includes('dragElastic={0.25} dragDirectionLock'));
  assert.ok(reader.includes('Math.abs(offsetX) > 55 || Math.abs(velocityX) > 350'));
  assert.ok(reader.includes('direction > 0 && page < 604) changePage(page + 1)'));
  assert.ok(reader.includes('direction < 0 && page > 1) changePage(page - 1)'));
  assert.ok(reader.includes('whileDrag={{ opacity: 0.985, scale: 0.985 }}'));
  assert.ok(reader.includes('duration: 0.22, ease: [0.22, 1, 0.36, 1]'));
  assert.ok(reader.includes('const prefetchPage = async'));
  assert.ok(reader.includes('if (page > 1) void prefetchPage(page - 1)'));
  assert.ok(reader.includes('if (page < 604) void prefetchPage(page + 1)'));
  assert.ok(reader.includes('const cachedPage = readCachedMushafPage(value)'));
  assert.ok(css.includes('background: transparent !important;'));
  assert.ok(css.includes('width: calc(100vw - 32px) !important;'));
  assert.ok(css.includes('max-width: 400px !important;'));
  assert.ok(css.includes('padding-left: 22px !important;'));
  assert.ok(css.includes('padding-right: 22px !important;'));
  assert.doesNotMatch(css.slice(css.lastIndexOf('/* Mobile Mushaf polish:'), css.lastIndexOf('/* Final Mushaf typography')), /transform\s*:/);
});

test('Mushaf bookmark autosave is local-first, debounced and stable across parent rerenders', () => {
  const reader = read('client/src/components/QuranMushafReader.tsx');
  const server = read('server.js');
  assert.ok(reader.includes("const lastSavedKeyRef = useRef('')"));
  assert.ok(reader.includes("const saveKey = `${mode}:${mark.surah}:${mark.ayah}:${mark.page}`"));
  assert.ok(reader.includes("}, 1500);"));
  assert.ok(reader.includes("const onLoggedRef = useRef(onLogged)"));
  assert.ok(reader.includes("onLoggedRef.current = onLogged"));
  assert.ok(reader.includes("const loggedPagesTodayRef = useRef(new Set<string>())"));
  assert.ok(reader.includes("loggedPagesTodayRef.current.add(dedupeKey)"));
  assert.doesNotMatch(reader, /\[fullScreen, loading, pageData, page, mode, onLogged\]/);
  assert.match(server, /app\.use\('\/api', rateLimit\(\{ max: 300 \}\)\)/);
  assert.match(server, /'hifz_page','hifz_bookmark','murajaah_page','murajaah_bookmark'/);
});

test('Mushaf topbar derives every unique page Surah and falls back while page data loads', () => {
  const reader = read('client/src/components/QuranMushafReader.tsx');
  const data = read('client/src/data/quranSurahs.ts');
  assert.ok(reader.includes('const currentPageSurahLabel = useMemo(() =>'));
  assert.ok(reader.includes('const pageSurahs = new Map<number, string>()'));
  assert.ok(reader.includes('for (const ayah of pageData?.ayahs || [])'));
  assert.ok(reader.includes('.join(\' – \')'));
  assert.ok(reader.includes('const fallbackSurah = getPageSurah(page)'));
  assert.ok(reader.includes('{currentPageSurahLabel}'));
  assert.ok(reader.includes('className="mushaf-surah-trigger"'));
  assert.ok(reader.includes('className="mushaf-topbar-view-toggle"'));
  assert.ok(reader.includes("onClick={() => changeReadingMode('translation')}"));
  assert.ok(reader.includes("onClick={() => changeReadingMode('reading')}"));
  assert.ok(data.includes('export function getPageSurah(page:number)'));
});

test('Mushaf Arabic typography and medallions use non-overlapping dimensions and mobile surfaces stay calm', () => {
  const css = read('client/src/styles.css');
  assert.match(css, /\.mushaf-arabic,[\s\S]*?\.mushaf-verse-arabic,[\s\S]*?\.mushaf-page-text \{\s*line-height: 2\.25 !important;/);
  assert.match(css, /width: 24px !important;[\s\S]*?height: 24px !important;[\s\S]*?font-size: 10px !important;/);
  assert.ok(css.includes('background: rgba(128, 128, 128, 0.08) !important;'));
  assert.ok(css.includes('border: none !important;'));
  assert.ok(css.includes('max-width: 400px !important;'));
  assert.ok(css.includes('padding: 14px 20px !important;'));
});

test('mobile web app capability metadata includes the standard non-Apple declaration', () => {
  const html = read('client/index.html');
  assert.ok(html.includes('<meta name="mobile-web-app-capable" content="yes" />'));
});


test('Mushaf keeps the Surah selector and view controls while Verse by Verse receives its editorial mobile header', () => {
  const reader = read('client/src/components/QuranMushafReader.tsx');
  const css = read('client/src/styles.css');
  const headerStart = reader.indexOf('<header className={\'mushaf-topbar mushaf-fs-header');
  const headerEnd = reader.indexOf('</header>', headerStart);
  const header = reader.slice(headerStart, headerEnd);
  assert.ok(header.includes('{currentPageSurahLabel}'));
  assert.ok(header.includes('className="mushaf-topbar-view-toggle"'));
  assert.ok(header.includes('mushaf-settings-trigger'));
  assert.ok(header.includes('className="mushaf-exit"'));
  assert.ok(header.includes('Verse by Verse') && header.includes('Page by Page'));
  assert.ok(reader.includes('mushaf-page-mobile-chrome'));
  assert.ok(reader.includes('mushaf-page-mobile-meta'));
  assert.ok(reader.includes('mushaf-page-mobile-controls'));
  assert.ok(reader.includes('mushaf-verse-aya-pill'));
  assert.ok(reader.includes('mushaf-verse-tajweed-key'));
  assert.match(css, /\.mushaf-topbar-view-toggle[\s\S]*?border: none !important;/);
  assert.match(css, /\.mushaf-topbar\.mushaf-fs-header[\s\S]*?background: rgba\(128, 128, 128, 0\.08\)/);
  assert.match(css, /\.mushaf-app\.is-mobile-verse-reading \.mushaf-surah-trigger[\s\S]*?font-size: 16px !important;/);
  assert.match(css, /grid-template-rows: 48px 32px minmax\(0, 1fr\)/);
});


test('mobile Mushaf is distraction-free, single-screen, and tap-toggle HUD is scoped to mobile page reading', () => {
  const reader = read('client/src/components/QuranMushafReader.tsx');
  const css = read('client/src/styles.css');
  assert.match(reader, /setMobileControlsVisible\(value => !value\)/);
  assert.match(reader, /mobileActiveSurahName/);
  assert.match(reader, /setMobilePageFit\(\{ fontSize: 21, lineHeight: 2\.05 \}\)/);
  assert.match(reader, /while \(fontSize > 14 && !fits\(\)\)/);
  assert.match(reader, /mushaf-mobile-study-toggle/);
  assert.match(reader, /mushaf-page-footer-mobile/);
  const mobileRule = css.slice(css.lastIndexOf('/* Distraction-free, single-screen mobile Mushaf.'));
  assert.match(mobileRule, /@media \(max-width: 767px\)/);
  assert.match(mobileRule, /height: 100dvh !important/);
  assert.match(mobileRule, /padding: 8px 18px 4px !important/);
  assert.match(mobileRule, /line-height: 2\.05 !important/);
  assert.match(mobileRule, /width: 22px !important/);
  assert.match(mobileRule, /background: rgba\(128, 128, 128, 0\.14\)/);
  assert.match(mobileRule, /mobile-controls-visible > \.mushaf-mobile-header-shell/);
  assert.doesNotMatch(mobileRule, /@media \(min-width: 768px\)/);
});


test('Page by Page mobile chrome and Surah composition are isolated from Verse by Verse and desktop', () => {
  const reader = read('client/src/components/QuranMushafReader.tsx');
  const css = read('client/src/styles.css');
  assert.ok(reader.includes('mushaf-page-mobile-chrome'));
  assert.ok(reader.includes('mushaf-page-mobile-meta'));
  assert.ok(reader.includes('mushaf-page-mobile-controls'));
  assert.ok(reader.includes('mushaf-page-surah-hero-main'));
  assert.ok(reader.includes('mushaf-page-hero-modes'));
  assert.ok(reader.includes('In the Name of Allah—the Most Compassionate, Most Merciful'));
  assert.match(css, /\.mushaf-app\.is-mobile-page-reading \.mushaf-page-mobile-meta[\s\S]*?height:32px/);
  assert.match(css, /\.mushaf-app\.is-mobile-page-reading \.mushaf-page-mobile-controls[\s\S]*?height:44px/);
  assert.match(css, /\.mushaf-app\.is-mobile-page-reading \.mushaf-page-surah-banner[\s\S]*?border-radius:14px/);
  assert.match(css, /\.mushaf-app\.is-mobile-page-reading \.mushaf-page-text[\s\S]*?text-align:center/);
  assert.match(css, /\.mushaf-app\.is-mobile-verse-reading/);
});


test('Verse by Verse shares the Quran.com mobile header and clean right-aligned editorial ayah rows', () => {
  const reader = read('client/src/components/QuranMushafReader.tsx');
  const css = read('client/src/styles.css');
  assert.ok(reader.includes("readingMode === 'reading' || readingMode === 'translation'"));
  assert.ok(reader.includes('mushaf-page-mobile-meta'));
  assert.ok(reader.includes('mushaf-page-mobile-controls'));
  assert.ok(!reader.includes('mushaf-verse-subheader'));
  assert.ok(reader.includes('className="mushaf-surah-hero"'));
  assert.ok(reader.includes('<BismillahOrnament/>'));
  const verseMobile = css.slice(css.lastIndexOf('/* Unified Quran.com-style two-row mobile header'));
  assert.ok(verseMobile.includes('grid-template-rows:76px minmax(0,1fr)'));
  assert.ok(verseMobile.includes('height:32px!important'));
  assert.ok(verseMobile.includes('height:44px!important'));
  assert.ok(verseMobile.includes('padding:20px 18px!important'));
  assert.ok(verseMobile.includes('text-align:right!important;line-height:2.25!important;word-spacing:3px'));
  assert.ok(verseMobile.includes('text-align:left!important'));
  assert.ok(verseMobile.includes('border-bottom:1px solid var(--border-hairline)!important'));
});


test('Mushaf surfaces and controls use active theme tokens in both reading modes', () => {
  const css = read('client/src/styles.css');
  const reader = read('client/src/components/QuranMushafReader.tsx');
  const themeBlock = css.slice(css.lastIndexOf('/* Mushaf theme contract:'));
  for (const token of ['--bg-canvas','--bg-surface','--text-primary','--text-secondary','--text-muted','--border-hairline','--border-strong','--accent-primary','--accent-soft']) {
    assert.ok(themeBlock.includes(token), 'missing Mushaf theme token: ' + token);
  }
  for (const color of ['#D500B7','#E53935','#16A34A','#0288D1','#D97706']) assert.ok(themeBlock.includes(color));
  assert.ok(themeBlock.includes('.mushaf-fs-overlay .mushaf-sidebar,'));
  assert.ok(themeBlock.includes('.mushaf-fs-overlay .mushaf-settings-popover,'));
  assert.ok(themeBlock.includes('.mushaf-fs-overlay .mushaf-page-medallion {'));
  assert.ok(themeBlock.includes('background:var(--mushaf-surface)!important;'));
  assert.ok(themeBlock.includes('border-color:var(--mushaf-border-strong)!important;'));
  assert.ok(themeBlock.includes('.mushaf-app.is-mobile-verse-reading .mushaf-verse-arabic { text-align:right'));
  assert.ok(themeBlock.includes('.mushaf-app.is-mobile-verse-reading .mushaf-verse-translation { margin:12px 0 0!important;text-align:left'));
  assert.ok(reader.includes("aria-pressed={readingMode === 'translation'}"));
  assert.ok(reader.includes('className="mushaf-surah-hero"'));
});


test('QPC Hafs font and Quran Foundation Tajweed markup are bundled, defaulted, and styled without verse-end leakage', () => {
  const reader = read('client/src/components/QuranMushafReader.tsx');
  const css = read('client/src/styles.css');
  assert.ok(css.includes("font-family: 'UthmanicHafs';"));
  assert.ok(css.includes("url('/fonts/UthmanicHafs1Ver18.woff2') format('woff2')"));
  assert.ok(css.includes("src: url('/fonts/UthmanicHafs1Ver18.woff2') format('woff2')"));
  assert.ok(!css.includes('https://verses.quran.foundation/fonts/quran/hafs/uthmanic_hafs/UthmanicHafs1Ver18.woff2'));
  assert.ok(server.includes("app.get('/fonts/' + QURAN_FONT_FILENAME"));
  assert.ok(server.includes('font/woff2'));
  assert.ok(server.includes('max-age=31536000, immutable'));
  assert.ok(server.includes("'/page/' + page + '/quran-uthmani'"));
  assert.ok(server.includes("/editions/quran-uthmani,en.sahih"));
  assert.ok(server.includes("textSource: 'quran-uthmani'"));
  assert.ok(reader.includes("ayah.textSource === 'quran-uthmani' ? ayah.text"));
  assert.ok(reader.includes("{ name: 'UthmanicHafs', label: 'Madinah Uthmani · King Fahd Complex' }"));
  for (const rule of ['ham_wasl','slnt','laam_shamsiyah','madda_normal','madda_permissible','madda_necessary','madda_obligatory','qalaqah','ikhafa','ikhafa_shafawi','iqlab','idgham_shafawi','idgham_ghunnah','idgham_wo_ghunnah','ghunnah']) {
    assert.ok(reader.includes(rule + ":'" + rule + "'"), 'missing official Tajweed mapping: ' + rule);
    assert.ok(css.includes('.' + rule), 'missing official Tajweed selector: ' + rule);
  }
  assert.ok(reader.includes("className={className}"));
  assert.ok(reader.includes("replace(/<span\\s+class="));
});
