const modules = [
  {
    id: 'identity',
    routes: ['/api/auth', '/api/session'],
    files: ['client/src/components/AuthPage.tsx', 'client/src/pages/PasswordRecoveryPage.tsx'],
    dependsOn: ['shared-contracts']
  },
  {
    id: 'workspace',
    routes: ['/api/history', '/api/export', '/api/import'],
    files: ['client/src/pages/HistoryPage.tsx'],
    dependsOn: ['shared-contracts']
  },
  {
    id: 'execution',
    routes: ['/api/tasks', '/api/sessions', '/api/goals', '/api/projects', '/api/project-milestones', '/api/modules', '/api/progress'],
    files: ['client/src/pages/TasksPage.tsx', 'client/src/pages/ProjectsPage.tsx', 'client/src/pages/ExecutionFocusPage.tsx'],
    dependsOn: ['shared-contracts']
  },
  {
    id: 'learning',
    routes: ['/api/learning', '/api/reading-items', '/api/notes'],
    files: ['client/src/pages/LearningPage.tsx', 'client/src/pages/LibraryPage.tsx'],
    dependsOn: ['shared-contracts']
  },
  {
    id: 'calendar',
    routes: ['/api/calendar'],
    files: ['client/src/pages/CalendarPage.tsx'],
    dependsOn: ['shared-contracts', 'execution']
  },
  {
    id: 'faith',
    routes: ['/api/deen', '/api/faith', '/api/rhythm', '/api/habits'],
    files: ['client/src/pages/RitualsPage.tsx', 'client/src/pages/ValuesPage.tsx'],
    dependsOn: ['shared-contracts']
  },
  {
    id: 'reflection',
    routes: ['/api/reviews', '/api/self-control'],
    files: ['client/src/pages/ReviewsPage.tsx', 'client/src/pages/SelfControlPage.tsx', 'client/src/pages/InsightsPage.tsx'],
    dependsOn: ['shared-contracts', 'execution']
  },
  {
    id: 'platform',
    routes: ['/api/feedback', '/api/admin', '/api/announcements', '/api/login-event', '/api/leaderboard', '/api/welcome', '/api/overview', '/api/intelligence', '/api/weekly-challenge', '/api/achievements', '/api/settings'],
    files: ['client/src/pages/AdminPage.tsx', 'client/src/pages/SettingsPage.tsx', 'client/src/pages/TodayPage.tsx'],
    dependsOn: ['shared-contracts', 'workspace']
  },
  {
    id: 'quran',
    routes: ['/api/quran'],
    files: ['client/src/pages/QuranPage.tsx', 'client/src/components/QuranMushafReader.tsx', 'client/src/data/quranSurahs.ts'],
    dependsOn: [],
    protected: true,
    versioning: 'legacy-only'
  }
];

const sharedModules = ['shared-contracts'];

function routeOwner(path) {
  const matches = modules.filter(module => module.routes.some(prefix =>
    path === prefix || path.startsWith(prefix + '/')
  ));
  return matches.length === 1 ? matches[0] : null;
}

module.exports = { modules, sharedModules, routeOwner };
