(function () {
  try {
    var legacyStored = localStorage.getItem('atlas_theme');
    var stored = localStorage.getItem('atlas.theme');
    var legacyToAtlas = {
      'shadowed-alchemist': 'obsidian',
      'nocturnal-amethyst': 'dusk',
      'abyssal-trench': 'obsidian',
      'whispering-woods': 'obsidian',
      'crimson-velvet': 'dusk',
      'light-porcelain': 'ivory',
      'light-sandstone': 'sahara',
      'light-sage': 'ivory',
      'light-lavender': 'ivory',
      'light-sky': 'sahara'
    };
    var themes = {
      obsidian: { legacy: 'shadowed-alchemist', scheme: 'dark', color: '#0a0c11' },
      dusk: { legacy: 'nocturnal-amethyst', scheme: 'dark', color: '#0e0d1c' },
      ivory: { legacy: 'light-porcelain', scheme: 'light', color: '#fcfaf6' },
      sahara: { legacy: 'light-sandstone', scheme: 'light', color: '#fdf4e7' }
    };
    var legacyThemes = {
      'shadowed-alchemist': { scheme: 'dark', color: '#07080A' },
      'nocturnal-amethyst': { scheme: 'dark', color: '#050408' },
      'abyssal-trench': { scheme: 'dark', color: '#03060C' },
      'whispering-woods': { scheme: 'dark', color: '#030806' },
      'crimson-velvet': { scheme: 'dark', color: '#080304' },
      'light-porcelain': { scheme: 'light', color: '#F5F6F3' },
      'light-sandstone': { scheme: 'light', color: '#F6F0E7' },
      'light-sage': { scheme: 'light', color: '#EFF4EF' },
      'light-lavender': { scheme: 'light', color: '#F4F1F8' },
      'light-sky': { scheme: 'light', color: '#EFF5F9' }
    };
    var validStored = Object.prototype.hasOwnProperty.call(themes, stored);
    var legacyConfig = legacyThemes[legacyStored];
    var theme = validStored ? stored :
      (legacyToAtlas[legacyStored] || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'obsidian' : 'ivory'));
    var config = themes[theme];
    var root = document.documentElement;
    root.setAttribute('data-a-theme', theme);
    // Keep the legacy theme contract unchanged outside the v2 shell. A v2-only
    // preference may set data-a-theme, but must not silently select a legacy theme.
    if (legacyConfig) {
      root.setAttribute('data-theme', legacyStored);
      root.style.colorScheme = legacyConfig.scheme;
      root.style.backgroundColor = legacyConfig.color;
      var meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', legacyConfig.color);
    }
  } catch (_) {}
})();
