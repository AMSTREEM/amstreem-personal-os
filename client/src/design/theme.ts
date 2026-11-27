const themeBackgrounds: Record<string, string> = {
  'shadowed-alchemist': '#07080A',
  'nocturnal-amethyst': '#050408',
  'abyssal-trench': '#03060C',
  'whispering-woods': '#030806',
  'crimson-velvet': '#080304',
  'light-porcelain': '#F5F6F3',
  'light-sandstone': '#F6F0E7',
  'light-sage': '#EFF4EF',
  'light-lavender': '#F4F1F8',
  'light-sky': '#EFF5F9'
};

export function resolveAtlasTheme(themeId: string, prefersLight?: boolean) {
  if (themeId !== 'system') return themeBackgrounds[themeId] ? themeId : 'shadowed-alchemist';
  const light = prefersLight ?? (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches);
  return light ? 'light-porcelain' : 'shadowed-alchemist';
}

export function applyAtlasTheme(themeId: string) {
  const effectiveTheme = resolveAtlasTheme(themeId);
  const background = themeBackgrounds[effectiveTheme];
  const root = document.documentElement;
  try { localStorage.setItem('atlas_theme', themeId); } catch {}
  root.setAttribute('data-theme', effectiveTheme);
  root.setAttribute('data-theme-preference', themeId);
  root.style.colorScheme = effectiveTheme.startsWith('light-') ? 'light' : 'dark';
  root.style.backgroundColor = background;
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach(meta => meta.setAttribute('content', background));
  return effectiveTheme;
}

export function watchAtlasSystemTheme(themeId: string) {
  if (themeId !== 'system' || typeof window === 'undefined' || !window.matchMedia) return () => undefined;
  const media = window.matchMedia('(prefers-color-scheme: light)');
  const update = () => applyAtlasTheme('system');
  media.addEventListener?.('change', update);
  return () => media.removeEventListener?.('change', update);
}
