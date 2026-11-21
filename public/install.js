(() => {
  const banner = document.getElementById('atlasInstallBanner');
  const guide = document.getElementById('atlasInstallGuide');
  if (!banner || !guide) return;

  const isStandalone = () =>
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  let dismissed = false;
  try { dismissed = localStorage.getItem('atlas-install-dismissed') === '1'; } catch {}

  if (isIOS && !isStandalone() && !dismissed) {
    window.setTimeout(() => banner.classList.remove('hidden'), 1400);
  }

  const closeGuide = () => guide.classList.add('hidden');
  document.getElementById('atlasInstallHow')?.addEventListener('click', () => guide.classList.remove('hidden'));
  document.getElementById('atlasInstallGuideClose')?.addEventListener('click', closeGuide);
  document.getElementById('atlasInstallDone')?.addEventListener('click', closeGuide);
  document.getElementById('atlasInstallClose')?.addEventListener('click', () => {
    banner.classList.add('hidden');
    try { localStorage.setItem('atlas-install-dismissed', '1'); } catch {}
  });
  guide.addEventListener('click', event => { if (event.target === guide) closeGuide(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeGuide(); });
})();
