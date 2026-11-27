import type { AtlasModuleManifest } from '../types';

const manifest: AtlasModuleManifest = {
  id: 'goals',
  name: 'Goals',
  icon: 'target',
  accent: 'violet',
  routes: ["/goals"],
  nav: { group: 'plan', order: 1 }
};

export default manifest;
