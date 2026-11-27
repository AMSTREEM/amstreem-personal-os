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
      'light-sky': 'ivory'
    };
    var themes = {
      obsidian: { legacy: 'shadowed-alchemist', scheme: 'dark', color: '#111318' },
      dusk: { legacy: 'nocturnal-amethyst', scheme: 'dark', color: '#171426' },
      ivory: { legacy: 'light-porcelain', scheme: 'light', color: '#F7F6F1' },
      sahara: { legacy: 'light-sandstone', scheme: 'light', color: '#F3EBDD' }
    };
    var validStored = Object.prototype.hasOwnProperty.call(themes, stored);
    var theme = validStored ? stored :
      (legacyToAtlas[legacyStored] || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'obsidian' : 'ivory'));
    var config = themes[theme];
    var root = document.documentElement;
    root.setAttribute('data-a-theme', theme);
    // The selected Atlas theme is the source of truth. Never let a stale legacy
    // preference override its colour scheme or browser chrome after migration.
    root.setAttribute('data-theme', config.legacy);
    root.style.colorScheme = config.scheme;
    root.style.backgroundColor = config.color;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', config.color);
  } catch (_) {}
})();
