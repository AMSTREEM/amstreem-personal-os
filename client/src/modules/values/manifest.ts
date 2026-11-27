import type { AtlasModuleManifest } from '../types';

const manifest: AtlasModuleManifest = {
  id: 'values',
  name: 'Values',
  icon: 'compass',
  accent: 'gold',
  routes: ["/values"],
  nav: { group: 'reflect', order: 1 }
};

export default manifest;
