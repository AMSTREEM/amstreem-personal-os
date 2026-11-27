import type { AtlasModuleManifest } from '../types';

const manifest: AtlasModuleManifest = {
  id: 'learning',
  name: 'Learning Library',
  icon: 'book-open',
  accent: 'fuchsia',
  routes: ["/learning-library"],
  nav: { group: 'practice', order: 1 }
};

export default manifest;
