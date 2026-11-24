(function () {
  try {
    var theme = localStorage.getItem('atlas_theme');
    var dark = ['shadowed-alchemist', 'nocturnal-amethyst', 'abyssal-trench', 'whispering-woods', 'crimson-velvet'];
    var backgrounds = {
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
    if (theme && backgrounds[theme]) {
      var root = document.documentElement;
      root.setAttribute('data-theme', theme);
      root.style.colorScheme = dark.indexOf(theme) >= 0 ? 'dark' : 'light';
      var meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', backgrounds[theme]);
      root.style.backgroundColor = backgrounds[theme];
    }
  } catch (_) {}
})();
