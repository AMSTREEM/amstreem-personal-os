import type { LucideIcon } from 'lucide-react';
import { BookOpen, CalendarDays, GraduationCap, Heart, History, House, ListChecks, MoonStar, Target, Timer, TrendingUp } from 'lucide-react';

export type AtlasModuleGroup = 'HOME' | 'PLAN' | 'PRACTICE' | 'REFLECT';
export const atlasQuickCaptureTypes = ['task', 'note', 'habit'] as const;
export type AtlasModuleManifest = {
  id: string;
  label: string;
  to: string;
  icon: LucideIcon;
  group: AtlasModuleGroup;
  order: number;
  accentToken: string;
  paths: string[];
  searchProvider: string;
  quickActions: string[];
  residenceWidgets: string[];
  settingsPanel: string;
};

export const atlasModules: AtlasModuleManifest[] = [
  { id: 'residence', label: 'Residence', to: '/residence', icon: House, group: 'HOME', order: 1, accentToken: '--atlas-module-residence', paths: ['/residence'], searchProvider: 'workspace', quickActions: [...atlasQuickCaptureTypes], residenceWidgets: ['daily-briefing', 'agenda', 'habits-due', 'progress'], settingsPanel: 'home-preferences' },
  { id: 'actions', label: 'Actions', to: '/actions', icon: ListChecks, group: 'PLAN', order: 2, accentToken: '--atlas-module-actions', paths: ['/actions'], searchProvider: 'tasks', quickActions: ['create-task', 'start-focus'], residenceWidgets: ['next-action', 'focus-summary'], settingsPanel: 'action-preferences' },
  { id: 'goals', label: 'Goals', to: '/goals', icon: Target, group: 'PLAN', order: 3, accentToken: '--atlas-module-goals', paths: ['/goals'], searchProvider: 'goals', quickActions: ['create-goal', 'add-milestone'], residenceWidgets: ['goal-progress'], settingsPanel: 'goal-preferences' },
  { id: 'calendar', label: 'Calendar', to: '/calendar', icon: CalendarDays, group: 'PLAN', order: 4, accentToken: '--atlas-module-calendar', paths: ['/calendar'], searchProvider: 'calendar', quickActions: ['create-event'], residenceWidgets: ['upcoming-agenda'], settingsPanel: 'calendar-preferences' },
  { id: 'habits', label: 'Habits', to: '/habits', icon: Heart, group: 'PRACTICE', order: 5, accentToken: '--atlas-module-habits', paths: ['/habits'], searchProvider: 'habits', quickActions: ['create-habit', 'check-in'], residenceWidgets: ['habits-due', 'streak-summary'], settingsPanel: 'habit-preferences' },
  { id: 'learning', label: 'Learning Library', to: '/learning-library', icon: GraduationCap, group: 'PRACTICE', order: 6, accentToken: '--atlas-module-learning', paths: ['/learning-library'], searchProvider: 'learning', quickActions: ['add-learning-item', 'capture-note'], residenceWidgets: ['learning-progress'], settingsPanel: 'learning-preferences' },
  { id: 'growth', label: 'Growth', to: '/growth', icon: TrendingUp, group: 'REFLECT', order: 7, accentToken: '--atlas-module-growth', paths: ['/growth'], searchProvider: 'reviews', quickActions: ['start-review'], residenceWidgets: ['weekly-review', 'growth-trends'], settingsPanel: 'growth-preferences' },
  { id: 'values', label: 'Values', to: '/values', icon: MoonStar, group: 'REFLECT', order: 8, accentToken: '--atlas-module-values', paths: ['/values'], searchProvider: 'values', quickActions: ['log-practice'], residenceWidgets: ['values-reflection'], settingsPanel: 'values-preferences' }
];

export const quranShellEntry = {
  id: 'quran',
  label: 'Qur’an',
  to: '/quran',
  icon: BookOpen,
  group: 'SPECIALIST' as const,
  order: 9,
  accentToken: '--atlas-module-quran',
  paths: ['/quran'],
  protected: true as const
};

export const atlasNavigationGroups = (['HOME', 'PLAN', 'PRACTICE', 'REFLECT'] as const).map(group => ({
  label: group,
  items: atlasModules.filter(module => module.group === group).sort((a, b) => a.order - b.order)
}));

export const atlasCommandDestinations = [
  ...atlasModules,
  quranShellEntry,
  { id: 'focus', label: 'Focus', detail: 'Start or resume a focus session', to: '/focus', icon: Timer, paths: ['/focus'] },
  { id: 'history', label: 'Workspace history', detail: 'Recovery points, backups and restore', to: '/history', icon: History, paths: ['/history'] }
];

export type AtlasSearchSource = {
  id: string;
  endpoint: string;
  route: string;
  kind: string;
};

export const atlasSearchSources: AtlasSearchSource[] = [
  { id: 'actions', endpoint: '/tasks', route: '/actions', kind: 'Task' },
  { id: 'goals', endpoint: '/goals', route: '/goals', kind: 'Goal' },
  { id: 'goals', endpoint: '/projects', route: '/goals', kind: 'Project' },
  { id: 'calendar', endpoint: '/calendar/events', route: '/calendar', kind: 'Event' },
  { id: 'habits', endpoint: '/habits', route: '/habits', kind: 'Habit' },
  { id: 'learning', endpoint: '/learning/paths', route: '/learning-library', kind: 'Learning path' },
  { id: 'learning', endpoint: '/learning/lessons', route: '/learning-library', kind: 'Lesson' },
  { id: 'learning', endpoint: '/notes', route: '/learning-library', kind: 'Note' }
];
