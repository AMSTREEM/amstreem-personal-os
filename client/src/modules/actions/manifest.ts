import type { AtlasModuleManifest } from '../types';

const manifest: AtlasModuleManifest = {
  id: 'actions',
  name: 'Actions',
  icon: 'check-square',
  accent: 'orange',
  routes: ["/actions","/focus"],
  nav: { group: 'plan', order: 0 }
};

export default manifest;
