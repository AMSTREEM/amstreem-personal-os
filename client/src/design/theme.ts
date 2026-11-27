export const atlasThemes = ['obsidian', 'dusk', 'ivory', 'sahara'] as const;
export type AtlasTheme = (typeof atlasThemes)[number];

const themeMeta: Record<AtlasTheme, { legacy: string; colorScheme: 'dark' | 'light'; color: string }> = {
  obsidian: { legacy: 'shadowed-alchemist', colorScheme: 'dark', color: '#0a0c11' },
  dusk: { legacy: 'nocturnal-amethyst', colorScheme: 'dark', color: '#0e0d1c' },
  ivory: { legacy: 'light-porcelain', colorScheme: 'light', color: '#fcfaf6' },
  sahara: { legacy: 'light-sandstone', colorScheme: 'light', color: '#fdf4e7' },
};

export function isAtlasTheme(value: string | null | undefined): value is AtlasTheme {
  return !!value && (atlasThemes as readonly string[]).includes(value);
}

export function applyAtlasTheme(theme: AtlasTheme): void {
  const root = document.documentElement;
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  const mapping = themeMeta[theme];
  root.setAttribute('data-a-theme', theme);
  root.setAttribute('data-theme', mapping.legacy);
  root.style.colorScheme = mapping.colorScheme;
  meta?.setAttribute('content', mapping.color);
  localStorage.setItem('atlas.theme', theme);
}

export function getInitialAtlasTheme(): AtlasTheme {
  const stored = localStorage.getItem('atlas.theme');
  if (isAtlasTheme(stored)) return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'obsidian' : 'ivory';
}

export function initializeAtlasTheme(): AtlasTheme {
  const theme = getInitialAtlasTheme();
  applyAtlasTheme(theme);
  return theme;
}
