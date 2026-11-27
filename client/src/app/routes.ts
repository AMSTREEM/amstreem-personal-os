export type AtlasRoom = 'residence' | 'rhythm' | 'execute' | 'growth' | null;
export type AtlasRouteMeta = { v2: boolean; frozen?: true; room: AtlasRoom };

const routeMeta: Record<string, AtlasRouteMeta> = {
  '/residence': { v2: true, room: 'residence' },
  '/blueprint': { v2: false, room: 'residence' },
  '/daily-rhythm': { v2: false, room: 'rhythm' },
  '/values': { v2: false, room: 'rhythm' },
  '/quran': { v2: false, frozen: true, room: 'rhythm' },
  '/habits': { v2: false, room: 'rhythm' },
  '/actions': { v2: false, room: 'execute' },
  '/focus': { v2: false, room: 'execute' },
  '/calendar': { v2: false, room: 'execute' },
  '/goals': { v2: false, room: 'growth' },
  '/learning-library': { v2: false, room: 'growth' },
  '/growth': { v2: false, room: 'growth' },
  '/learning': { v2: false, room: 'growth' },
  '/library': { v2: false, room: 'growth' },
  '/reviews-insights': { v2: false, room: 'growth' },
  '/insights': { v2: false, room: 'growth' },
  '/reviews': { v2: false, room: 'growth' },
  '/settings': { v2: false, room: null },
  '/admin': { v2: false, room: null }
};

export function getAtlasRouteMeta(pathname: string): AtlasRouteMeta {
  return routeMeta[pathname] ?? { v2: false, room: null };
}
