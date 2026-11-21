import { useEffect, useState } from 'react';
import { Download, Share, Smartphone, X } from 'lucide-react';

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

let deferredInstallPrompt: InstallPromptEvent | null = null;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredInstallPrompt = event as InstallPromptEvent;
  });
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function isAppleMobile() {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function MobileInstallPrompt() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [installed, setInstalled] = useState(false);
  const apple = isAppleMobile();
  const mobileDevice = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 1 && window.innerWidth <= 1024);

  useEffect(() => {
    if (!mobileDevice) return;
    if (isStandalone()) { setInstalled(true); return; }
    if (deferredInstallPrompt) setPromptEvent(deferredInstallPrompt);
    let dismissedAt = 0;
    try { dismissedAt = Number(localStorage.getItem('atlas-install-dismissed-at') || 0); } catch {}
    const dismissedRecently = dismissedAt && Date.now() - dismissedAt < 14 * 24 * 60 * 60 * 1000;
    if (dismissedRecently) return;

    const onBeforeInstall = (event: Event) => setPromptEvent(event as InstallPromptEvent);
    const onInstalled = () => { setInstalled(true); setVisible(false); setGuideOpen(false); };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    const timer = window.setTimeout(() => setVisible(true), 5200);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [mobileDevice]);

  if (installed || !visible) return null;

  const dismiss = () => {
    setVisible(false);
    try { localStorage.setItem('atlas-install-dismissed-at', String(Date.now())); } catch {}
  };

  const install = async () => {
    if (!promptEvent) { setGuideOpen(true); return; }
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === 'accepted') { setInstalled(true); setVisible(false); }
    setPromptEvent(null);
  };

  const steps = apple
    ? [
        <>Open this page in <b>Safari</b> if you are using another browser.</>,
        <>Tap the <b>Share</b> icon in Safari.</>,
        <>Scroll and choose <b>Add to Home Screen</b>, then tap <b>Add</b>.</>
      ]
    : [
        <>Open the browser menu using the <b>⋮</b> button.</>,
        <>Choose <b>Install app</b> or <b>Add to Home screen</b>.</>,
        <>Confirm <b>Install</b> or <b>Add</b>. Atlas will appear with your apps.</>
      ];

  return <>
    <aside className="atlas-install-prompt" role="region" aria-label="Install Amstreem Atlas">
      <div className="atlas-install-prompt__head">
        <span className="atlas-install-prompt__mark"><Smartphone size={19} /></span>
        <div className="atlas-install-prompt__copy">
          <b>Keep Atlas one tap away</b>
          <p>Add Atlas to your Home Screen and open it like an app.</p>
        </div>
        <button className="atlas-install-prompt__dismiss" type="button" aria-label="Dismiss install prompt" onClick={dismiss}><X size={17}/></button>
      </div>
      <div className="atlas-install-prompt__actions">
        <button type="button" onClick={() => void install()}>{promptEvent ? <><Download size={14}/> Install Atlas</> : 'Show me how'}</button>
        <button type="button" onClick={() => setGuideOpen(true)}>How it works</button>
      </div>
    </aside>
    {guideOpen && <div className="atlas-install-guide-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setGuideOpen(false); }}>
      <section className="atlas-install-guide-card" role="dialog" aria-modal="true" aria-labelledby="atlas-install-guide-title">
        <button className="atlas-install-guide-card__close" type="button" aria-label="Close guide" onClick={() => setGuideOpen(false)}><X size={17}/></button>
        <span className="atlas-install-guide-card__kicker">AMSTREEM ATLAS · HOME SCREEN</span>
        <h2 id="atlas-install-guide-title">Make Atlas feel like your app.</h2>
        <p>Save Atlas to your phone for a dedicated icon, a full-screen app experience and faster access to your workspace.</p>
        <ol>{steps.map((step,index)=><li key={index}><span>{apple ? <Share size={15}/> : index + 1}</span><span>{step}</span></li>)}</ol>
        <p>{apple ? 'On iPhone and iPad, use Safari for the Add to Home Screen option.' : 'On Android, Chrome usually offers Install app. Other browsers may call it Add to Home screen.'}</p>
        <button className="atlas-install-guide-card__done" type="button" onClick={() => setGuideOpen(false)}>Got it</button>
      </section>
    </div>}
  </>;
}
