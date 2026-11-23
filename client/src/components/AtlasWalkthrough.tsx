import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

type Props = { onClose: () => void; onOpenCommand?: () => void };

const stepRoutes = ['/residence', '/focus', '/goals'];

const steps = [
  {
    eyebrow: 'TODAY · YOUR DAILY HOME',
    title: 'Start with today.',
    description: 'See your Celestial Horizon, Activity Pulse and Ferrofluid Core, add a task in one line, then check off prayers and habits without leaving Home.',
    rows: ['Today · one clear starting point', 'Activity Pulse · Ferrofluid Core', 'Tasks · Prayers · Habits'],
    label: 'MAKE TODAY CLEAR'
  },
  {
    eyebrow: 'FOCUS · YOUR CHRONOGRAPH',
    title: 'Give one thing your attention.',
    description: 'Choose 25m, 50m or 80m, link a task or Qur’an Surah, and start. Your completed sessions appear directly below.',
    rows: ['25m · 50m · 80m', 'Link a task or Surah', 'Start · Session history'],
    label: 'PROTECT YOUR ATTENTION'
  },
  {
    eyebrow: 'GOALS · YOUR LONG-TERM DIRECTION',
    title: 'Explore your Life Constellation.',
    description: 'See Goals, Projects and Learning connected in one star map. Your goals and projects are ready to work with directly beneath it.',
    rows: ['Life Constellation', 'Goals · Projects', 'Learning paths · linked progress'],
    label: 'SEE HOW YOUR WORK CONNECTS'
  },
  {
    eyebrow: 'MORE · EVERYTHING ELSE',
    title: 'Your other spaces stay one tap away.',
    description: 'Open More for Deen & Qur’an, Habits & Self-Control, Learning & Library, Calendar, Reviews & Insights and Settings. Your existing routes remain available.',
    rows: ['Deen & Qur’an · Habits & Self-Control', 'Learning & Library · Calendar', 'Reviews & Insights · Settings'],
    label: 'KEEP THE DAILY CORE SIMPLE'
  },
  {
    eyebrow: 'THE AMSTREEM SIGNATURE',
    title: 'Keep the instruments. Lose the clutter.',
    description: 'Life Constellation, the 30-Day Rhythm Constellation, and the Ferrofluid Astrolabe Cores with Combo Sparks remain part of Atlas. Use Quick Capture when you need to move fast, and choose from 10 curated themes in Settings.',
    rows: ['Life Constellation · Goals and Projects', '30-Day Rhythm Constellation · consistency', 'Ferrofluid Core · Astrolabe · Combo Sparks'],
    label: 'YOUR VISUAL LANGUAGE, INTACT'
  }
];

export function AtlasWalkthrough({ onClose, onOpenCommand }: Props) {
  const [index, setIndex] = useState(0);
  const navigate = useNavigate();
  const dialogRef = useRef<HTMLElement>(null);
  const step = steps[index];

  const finish = () => onClose();
  const advance = () => {
    if (index < stepRoutes.length) navigate(stepRoutes[index]);
    if (index < steps.length - 1) {
      setIndex(value => Math.min(steps.length - 1, value + 1));
      return;
    }
    finish();
    onOpenCommand?.();
  };

  useEffect(() => {
    const previous = document.body.style.overflow;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = 'hidden';
    const focusable = () => Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') || []);
    focusable()[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') finish();
      if (event.key === 'ArrowRight') setIndex(value => Math.min(steps.length - 1, value + 1));
      if (event.key === 'ArrowLeft') setIndex(value => Math.max(0, value - 1));
      if (event.key === 'Tab') {
        const items = focusable();
        const first = items[0], last = items[items.length - 1];
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
      previouslyFocused?.focus();
    };
  }, [onClose]);

  return <motion.div className="atlas-tour-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) finish(); }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
    <motion.section ref={dialogRef} className="atlas-tour" role="dialog" aria-modal="true" aria-labelledby="atlas-tour-title" tabIndex={-1} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}>
      <header className="atlas-tour__top">
        <div className="atlas-tour__brand"><img className="brand-symbol" src="/assets/brand/amstreem-symbol.svg" alt="" /><span>AMSTREEM ATLAS</span></div>
        <span className="atlas-tour__count">YOUR FIRST LOOK · {String(index + 1).padStart(2, '0')} / {String(steps.length).padStart(2, '0')}</span>
        <button className="icon-button" type="button" aria-label="Close walkthrough" onClick={finish}><X size={18} /></button>
      </header>
      <div className="atlas-tour__body">
        <aside className="atlas-tour__intro">
          <span className="atlas-tour__eyebrow">A GUIDED INTRODUCTION</span>
          <h2>Make room for what matters.</h2>
          <p>Five quick stops: Today, Focus, Goals, More, and the signature instruments.</p>
          <div className="atlas-tour__progress" aria-label={`Step ${index + 1} of ${steps.length}`}><i style={{ width: `${((index + 1) / steps.length) * 100}%` }} /></div>
          <nav className="atlas-tour__nav" aria-label="Walkthrough steps">
            {steps.map((item, i) => <button key={item.label} type="button" aria-label={`Go to step ${i + 1}: ${item.title}`} aria-current={i === index ? 'step' : undefined} onClick={() => setIndex(i)}>{String(i + 1).padStart(2, '0')}</button>)}
          </nav>
        </aside>
        <main className="atlas-tour__content">
          <span className="atlas-tour__eyebrow">{step.eyebrow}</span>
          <h3 id="atlas-tour-title">{step.title}</h3>
          <p>{step.description}</p>
          <div className="atlas-tour__preview">
            <div className="atlas-tour__preview-head"><span>{step.label}</span><span>AT A GLANCE</span></div>
            {step.rows.map(row => <div className="atlas-tour__preview-row" key={row}><i />{row}</div>)}
          </div>
        </main>
      </div>
      <footer className="atlas-tour__actions">
        <button className="button button--ghost" type="button" onClick={finish}>Close tour</button>
        <div>
          <button className="button button--secondary" type="button" disabled={index === 0} onClick={() => setIndex(value => Math.max(0, value - 1))}><ChevronLeft size={15} /> Back</button>
          <button className="button button--primary" type="button" onClick={advance}>{index < steps.length - 1 ? <>Next <ChevronRight size={15} /></> : <>Open command dock <ChevronRight size={15} /></>}</button>
        </div>
      </footer>
    </motion.section>
  </motion.div>;
}
