import type { AtlasModuleManifest } from '../types';

const manifest: AtlasModuleManifest = {
  id: 'residence',
  name: 'Residence',
  icon: 'house',
  accent: 'stream',
  routes: ["/residence"],
  nav: { group: 'home', order: 0 }
};

export default manifest;
