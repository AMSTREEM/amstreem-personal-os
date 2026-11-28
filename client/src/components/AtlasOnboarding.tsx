import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Compass, Globe2, Target } from 'lucide-react';
import { api } from '../lib/api';

type Props = { onComplete: () => void };

const steps = [
  { eyebrow: '01 · YOUR DAY', title: 'Where should Atlas anchor your day?', detail: 'Your time zone keeps daily plans, habits and reviews aligned with your actual day.', label: 'IANA time zone' },
  { eyebrow: '02 · YOUR DIRECTION', title: 'What is one outcome that matters?', detail: 'Start with one meaningful direction. You can add more goals whenever you need.', label: 'Your first goal' },
  { eyebrow: '03 · YOUR ROUTINE', title: 'What small routine will support it?', detail: 'Choose one repeatable action that helps turn your direction into progress.', label: 'Your first habit' }
];

export function AtlasOnboarding({ onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [timezone, setTimezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Lagos');
  const [goal, setGoal] = useState('');
  const [habit, setHabit] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const dialogRef = useRef<HTMLElement>(null);
  const current = steps[step];
  const value = step === 0 ? timezone : step === 1 ? goal : habit;
  const setValue = step === 0 ? setTimezone : step === 1 ? setGoal : setHabit;
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>('input:not([disabled]), button:not([disabled])'));
    focusable()[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const items = focusable();
      const first = items[0], last = items[items.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [step]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setError('');
    if (!value.trim()) { setError('Add an answer to continue.'); return; }
    if (step === 0) {
      try { new Intl.DateTimeFormat('en-US', { timeZone: timezone.trim() }); }
      catch { setError('Enter a valid IANA time zone, such as Africa/Lagos.'); return; }
    }
    if (step < 2) { setStep(value => value + 1); return; }
    setSaving(true);
    try {
      await api('/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timezone: timezone.trim(), goal_title: goal.trim(), habit_title: habit.trim() })
      });
      onComplete();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Atlas could not finish setting up your workspace.');
    } finally {
      setSaving(false);
    }
  }

  return <div className="atlas-onboarding-backdrop" role="presentation">
    <section ref={dialogRef} className="atlas-onboarding" role="dialog" aria-modal="true" aria-labelledby="atlas-onboarding-title">
      <header className="atlas-onboarding__head">
        <span><Compass size={17}/> AMSTREEM ATLAS</span>
        <span>SETUP · {step + 1} / 3</span>
      </header>
      <div className="atlas-onboarding__progress" aria-hidden="true"><i style={{ transform: 'scaleX(' + ((step + 1) / 3) + ')' }}/></div>
      <form onSubmit={submit}>
        <span className="atlas-onboarding__eyebrow">{current.eyebrow}</span>
        <h1 id="atlas-onboarding-title">{current.title}</h1>
        <p>{current.detail}</p>
        <label className="atlas-onboarding__field">
          <span>{current.label}</span>
          <div className="atlas-onboarding__input-wrap">
            {step === 0 ? <Globe2 size={17}/> : step === 1 ? <Target size={17}/> : <Compass size={17}/>}
            <input
              autoFocus
              value={value}
              onChange={event => setValue(event.target.value)}
              placeholder={step === 0 ? 'Africa/Lagos' : step === 1 ? 'Build a stable, independent business' : 'Spend 30 minutes learning each morning'}
              maxLength={step === 1 ? 120 : step === 2 ? 100 : 100}
              aria-label={current.label}
            />
          </div>
        </label>
        {error && <p className="atlas-onboarding__error" role="alert">{error}</p>}
        <footer className="atlas-onboarding__actions">
          <button type="button" className="atlas-onboarding__back" onClick={() => step === 0 ? undefined : setStep(value => value - 1)} disabled={step === 0 || saving}><ArrowLeft size={15}/> Back</button>
          <button type="submit" className="atlas-onboarding__continue" disabled={!value.trim() || saving}>{saving ? 'Creating workspace…' : step === 2 ? 'Create my workspace' : 'Continue'}{!saving && <ArrowRight size={15}/>}</button>
        </footer>
      </form>
      <div className="atlas-onboarding__privacy">Private by design. You can change these choices in Settings at any time.</div>
    </section>
  </div>;
}
