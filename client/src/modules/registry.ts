export type AtlasModuleId =
  | 'residence'
  | 'actions'
  | 'goals'
  | 'calendar'
  | 'habits'
  | 'learning'
  | 'growth'
  | 'values';

export type AtlasNavigationGroup = 'home' | 'plan' | 'practice' | 'reflect';

export interface AtlasModuleManifest {
  id: AtlasModuleId;
  name: string;
  icon: string;
  accent: string;
  routes: readonly string[];
  nav: {
    group: AtlasNavigationGroup;
    order: number;
  };
}

/**
 * Public metadata for the eight standard Atlas modules.
 * The Qur'an reader is intentionally not registered here: its route and
 * implementation remain a protected shell-owned integration.
 */
export const atlasModules: readonly AtlasModuleManifest[] = [
  { id: 'residence', name: 'Residence', icon: 'house', accent: 'stream', routes: ['/residence'], nav: { group: 'home', order: 0 } },
  { id: 'actions', name: 'Actions', icon: 'check-square', accent: 'orange', routes: ['/actions', '/focus'], nav: { group: 'plan', order: 0 } },
  { id: 'goals', name: 'Goals', icon: 'target', accent: 'violet', routes: ['/goals'], nav: { group: 'plan', order: 1 } },
  { id: 'calendar', name: 'Calendar', icon: 'calendar-days', accent: 'blue', routes: ['/calendar'], nav: { group: 'plan', order: 2 } },
  { id: 'habits', name: 'Habits', icon: 'repeat', accent: 'lime', routes: ['/habits'], nav: { group: 'practice', order: 0 } },
  { id: 'learning', name: 'Learning Library', icon: 'book-open', accent: 'fuchsia', routes: ['/learning-library'], nav: { group: 'practice', order: 1 } },
  { id: 'growth', name: 'Growth', icon: 'chart-no-axes-combined', accent: 'rose', routes: ['/growth'], nav: { group: 'reflect', order: 0 } },
  { id: 'values', name: 'Values', icon: 'compass', accent: 'gold', routes: ['/values'], nav: { group: 'reflect', order: 1 } }
] as const;

export function getAtlasModule(id: AtlasModuleId): AtlasModuleManifest | undefined {
  return atlasModules.find(module => module.id === id);
}
