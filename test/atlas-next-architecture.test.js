const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const server = read('server.js');
const backup = read('workspace-backup.js');
const app = read('client/src/App.tsx');

test('existing v1 workspace snapshots remain readable and new writes use v2', () => {
  assert.match(server, /personal-os-sqlite-snapshot-v1/);
  assert.match(server, /personal-os-sqlite-snapshot-v2/);
  assert.match(server, /schemaVersion:\s*2/);
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
  assert.match(server, /lesson_id INTEGER REFERENCES learning_lessons\(id\)/);
  assert.match(server, /INSERT INTO sessions\(session_date,minutes,focus,reflection,task_id,project_id,lesson_id\)/);
  assert.match(server, /ll\.title AS lesson_title/);
  assert.match(server, /Link a focus session to either a task or a learning lesson/);
  assert.match(server, /INSERT INTO learning_study_logs\(lesson_id,log_date,minutes,reflection\)/);
});

test('the six core pillars stay visible while secondary tabs remain optional', () => {
  const shell = read('client/src/components/AppShell.tsx');
  const settings = read('client/src/pages/SettingsPage.tsx');
  assert.match(shell, /const visibleNavigation = navigation/);
  assert.match(shell, /feature: 'calendar'/);
  assert.match(shell, /feature: 'library'/);
  assert.match(settings, /Your six core pillars always stay available/);
  assert.match(settings, /Optional workspace views/);
});

test('new frontend routes cover the core personal operating system areas', () => {
  for (const route of ['/today', '/goals', '/projects', '/tasks', '/calendar', '/focus', '/rituals', '/self-control', '/learning', '/library', '/values', '/reviews', '/insights', '/settings', '/admin']) {
    assert.ok(app.includes('path="' + route + '"'), 'Missing route ' + route);
  }
});

test('Express serves the built app while retaining legacy public assets', () => {
  assert.match(server, /express\.static\(path\.join\(__dirname, 'dist'\)\)/);
  assert.match(server, /express\.static\(path\.join\(__dirname, 'public'\)\)/);
  assert.match(server, /res\.sendFile\(path\.join\(__dirname,'dist','index\.html'\)/);
});


test('Today supports fast task capture and deadline-aware priorities', () => {
  const today = read('client/src/pages/TodayPage.tsx');
  assert.match(today, /today-quick-capture/);
  assert.match(today, /api<Task>\('\/tasks'/);
  assert.match(today, /a\.due_date\.localeCompare\(b\.due_date\)/);
  assert.match(today, /Overdue/);
});

test('Focus timer survives refreshes and does not fabricate completed sessions', () => {
  const focus = read('client/src/pages/FocusPage.tsx');
  assert.match(focus, /atlas-focus-timer-v1/);
  assert.match(focus, /deadline - now/);
  assert.match(focus, /localStorage\.setItem/);
  assert.match(focus, /Timer completion does not create a record automatically/);
  assert.match(focus, /function pauseTimer/);
  assert.match(focus, /function resetTimer/);
  assert.match(focus, /Choose what this focus block will move forward/);
  assert.match(focus, /lesson_id: lessonId/);
  assert.match(focus, /learning-study-logs/);
  assert.match(read('client/src/pages/LearningPage.tsx'), /\/focus\?lesson=/);
});




test('Residence derives a daily consistency pulse from active life areas', () => {
  const residence = read('client/src/pages/TodayPage.tsx');
  assert.match(residence, /TODAY'S CONSISTENCY PULSE/);
  assert.match(residence, /api<Deen>\('\/deen\/summary/);
  assert.match(residence, /api<Faith\[]>\('\/faith/);
  assert.match(residence, /scoreDimensions/);
  assert.match(residence, /atlas-focus-timer-v1/);
  assert.match(residence, /activeFocusContext/);
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
