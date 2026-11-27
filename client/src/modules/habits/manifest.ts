import type { AtlasModuleManifest } from '../types';

const manifest: AtlasModuleManifest = {
  id: 'habits',
  name: 'Habits',
  icon: 'repeat',
  accent: 'lime',
  routes: ["/habits"],
  nav: { group: 'practice', order: 0 }
};

export default manifest;
