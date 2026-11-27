export type AtlasRoom = 'residence' | 'rhythm' | 'execute' | 'growth' | null;
export type AtlasRouteMeta = { v2: boolean; frozen?: true; room: AtlasRoom };

const routeMeta: Record<string, AtlasRouteMeta> = {
  '/residence': { v2: true, room: 'residence' },
  '/blueprint': { v2: true, room: 'residence' },
  '/daily-rhythm': { v2: true, room: 'rhythm' },
  '/values': { v2: true, room: 'rhythm' },
  '/quran': { v2: false, frozen: true, room: null },
  '/habits': { v2: true, room: 'rhythm' },
  '/actions': { v2: true, room: 'execute' },
  '/focus': { v2: true, room: 'execute' },
  '/calendar': { v2: true, room: 'execute' },
  '/goals': { v2: true, room: 'growth' },
  '/learning-library': { v2: true, room: 'growth' },
  '/growth': { v2: true, room: 'growth' },
  '/learning': { v2: true, room: 'growth' },
  '/library': { v2: true, room: 'growth' },
  '/reviews-insights': { v2: true, room: 'growth' },
  '/insights': { v2: true, room: 'growth' },
  '/reviews': { v2: true, room: 'growth' },
  '/settings': { v2: true, room: null },
  '/admin': { v2: true, room: null }
};

export function getAtlasRouteMeta(pathname: string): AtlasRouteMeta {
  return routeMeta[pathname] ?? { v2: true, room: null };
}
