import type { AtlasModuleManifest } from '../types';

const manifest: AtlasModuleManifest = {
  id: 'growth',
  name: 'Growth',
  icon: 'chart-no-axes-combined',
  accent: 'rose',
  routes: ["/growth"],
  nav: { group: 'reflect', order: 0 }
};

export default manifest;
