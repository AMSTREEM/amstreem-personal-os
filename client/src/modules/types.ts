export type AtlasModuleId = 'residence' | 'actions' | 'goals' | 'calendar' | 'habits' | 'learning' | 'growth' | 'values';
export type AtlasNavigationGroup = 'home' | 'plan' | 'practice' | 'reflect';
export interface AtlasModuleManifest {
  id: AtlasModuleId;
  name: string;
  icon: string;
  accent: string;
  routes: readonly string[];
  nav: { group: AtlasNavigationGroup; order: number };
}
