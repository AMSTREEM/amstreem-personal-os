import type { AtlasModuleManifest } from '../types';

const manifest: AtlasModuleManifest = {
  id: 'calendar',
  name: 'Calendar',
  icon: 'calendar-days',
  accent: 'blue',
  routes: ["/calendar"],
  nav: { group: 'plan', order: 2 }
};

export default manifest;
