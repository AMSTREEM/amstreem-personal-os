(function () {
  try {
    var stored = localStorage.getItem('atlas.theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var themes = {
      obsidian: { legacy: 'shadowed-alchemist', scheme: 'dark', color: '#0a0c11' },
      dusk: { legacy: 'nocturnal-amethyst', scheme: 'dark', color: '#0e0d1c' },
      ivory: { legacy: 'light-porcelain', scheme: 'light', color: '#fcfaf6' },
      sahara: { legacy: 'light-sandstone', scheme: 'light', color: '#fdf4e7' }
    };
    var theme = Object.prototype.hasOwnProperty.call(themes, stored) ? stored : (prefersDark ? 'obsidian' : 'ivory');
    var config = themes[theme];
    var root = document.documentElement;
    root.setAttribute('data-a-theme', theme);
    root.setAttribute('data-theme', config.legacy);
    root.style.colorScheme = config.scheme;
    root.style.backgroundColor = config.color;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', config.color);
  } catch (_) {}
})();
