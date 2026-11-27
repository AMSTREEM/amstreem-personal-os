import { useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';

const APPLY_ON_LAUNCH_KEY = 'atlas-pwa-apply-on-next-launch';

export function PwaUpdatePrompt() {
  const [ready, setReady] = useState(false);
  const [queued, setQueued] = useState(false);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    let registration: ServiceWorkerRegistration | null = null;
    let disposed = false;

    const activateQueuedUpdate = () => {
      if (!registration?.waiting || !navigator.serviceWorker.controller) return;
      let shouldApply = false;
      try { shouldApply = localStorage.getItem(APPLY_ON_LAUNCH_KEY) === 'true'; } catch {}
      if (shouldApply) registration.waiting.postMessage({ type: 'ATLAS_ACTIVATE_UPDATE' });
      else if (!disposed) setReady(true);
    };

    const onControllerChange = () => {
      let shouldReload = false;
      try {
        shouldReload = localStorage.getItem(APPLY_ON_LAUNCH_KEY) === 'true';
        if (shouldReload) localStorage.removeItem(APPLY_ON_LAUNCH_KEY);
      } catch {}
      if (shouldReload) window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    navigator.serviceWorker.register('/service-worker.js', { scope: '/' }).then(nextRegistration => {
      if (disposed) return;
      registration = nextRegistration;
      activateQueuedUpdate();
      nextRegistration.addEventListener('updatefound', () => {
        const installing = nextRegistration.installing;
        installing?.addEventListener('statechange', () => {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) activateQueuedUpdate();
        });
      });
      void nextRegistration.update().catch(() => undefined);
    }).catch(error => {
      console.warn('Atlas offline shell registration unavailable:', error);
    });

    return () => {
      disposed = true;
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  const queueForNextLaunch = () => {
    try { localStorage.setItem(APPLY_ON_LAUNCH_KEY, 'true'); } catch {}
    setQueued(true);
  };

  const applyNow = async () => {
    const fields = Array.from(document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input, textarea, select'));
    const hasUnsavedEdits = fields.some(field => {
      if (field instanceof HTMLInputElement && (field.type === 'checkbox' || field.type === 'radio')) return field.checked !== field.defaultChecked;
      let initialValue: string;
      if (field instanceof HTMLSelectElement) {
        initialValue = Array.from(field.options).find(option => option.defaultSelected)?.value ?? field.options[0]?.value ?? '';
      } else if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
        initialValue = field.defaultValue;
      } else {
        return false;
      }
      return field.value !== initialValue;
    }) || !!document.querySelector('[contenteditable="true"][data-dirty="true"]');
    if (hasUnsavedEdits) { queueForNextLaunch(); return; }
    try { localStorage.setItem(APPLY_ON_LAUNCH_KEY, 'true'); } catch {}
    const registration = await navigator.serviceWorker.getRegistration('/');
    if (!registration?.waiting) { setQueued(true); return; }
    setApplying(true);
    registration.waiting.postMessage({ type: 'ATLAS_ACTIVATE_UPDATE' });
  };

  if (!ready) return null;
  return <aside className="atlas-update-toast" role="status" aria-live="polite">
    <span className="atlas-update-toast__icon"><RefreshCw size={17}/></span>
    <span className="atlas-update-toast__copy">
      <b>{queued ? 'Update queued' : 'Atlas update ready'}</b>
      <small>{queued ? 'Close and reopen Atlas to apply it safely.' : 'Apply now if your forms are clear, or queue it for your next launch.'}</small>
    </span>
    {!queued && <><button type="button" onClick={() => void applyNow()} disabled={applying}>{applying ? 'Applying…' : 'Apply now'}</button><button className="atlas-update-toast__later" type="button" onClick={queueForNextLaunch}>Next launch</button></>}
    <button className="atlas-update-toast__close" type="button" aria-label="Dismiss update notice" onClick={() => setReady(false)}><X size={15}/></button>
  </aside>;
}
