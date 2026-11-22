import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

type Props = { onClose: () => void; onOpenCommand?: () => void };

const stepRoutes = ['/residence', '/values', '/execution', '/goals'];

const steps = [
  {
    eyebrow: 'ROOM 01 · YOUR DAILY COMMAND CENTER',
    title: 'Welcome to Residence.',
    description: 'Set your Morning Intention, lock in your Top 3 Priorities, and watch your Activity Pulse and Ferrofluid Core respond as you move forward.',
    rows: ['⌘ 1 · Residence', 'Morning Intention · Top 3 Priorities', 'Activity Pulse · Ferrofluid Core'],
    label: 'START WITH WHAT MATTERS'
  },
  {
    eyebrow: 'ROOM 02 · YOUR DAILY RHYTHM',
    title: 'Build a rhythm that reflects your values.',
    description: 'Maintain your personal standards across Faith / Deen—adapted for Islam, Christianity, or general reflection—and Habits & Self-Control.',
    rows: ['⌘ 2 · Daily Rhythm', 'Faith / Deen · Habits & Self-Control', '30-Day Rhythm Constellation'],
    label: 'CONSISTENCY, YOUR WAY'
  },
  {
    eyebrow: 'ROOM 03 · YOUR DAILY EXECUTION',
    title: 'Turn priorities into focused action.',
    description: 'Manage Tasks with project or goal filters, launch the Focus Chronograph for 25m, 50m, 80m, or a custom session, or check your Calendar.',
    rows: ['⌘ 3 · Execution & Focus', 'Tasks · Project and goal filters', 'Focus Chronograph · Calendar'],
    label: 'PROTECT YOUR ATTENTION'
  },
  {
    eyebrow: 'ROOM 04 · YOUR LONG-TERM DIRECTION',
    title: 'Explore your Life Constellation.',
    description: 'Connect Goals, Projects, and Learning Paths on an interactive star map—tap or drag a star to inspect it, or use the pill switcher below to focus on one area.',
    rows: ['⌘ 4 · Growth & Direction', 'Goals · Projects · Learning Paths', 'Private Library · Reviews & Insights'],
    label: 'SEE HOW YOUR WORK CONNECTS'
  },
  {
    eyebrow: 'ALWAYS WITHIN REACH',
    title: 'Capture quickly. Move freely.',
    description: 'Use the floating command dock to capture a task in seconds, jump between rooms, and choose from 10 curated themes in Settings.',
    rows: ['⌘ K · Command Dock', 'Quick Capture · Room navigation', 'Settings · 10 curated themes'],
    label: 'YOUR EVERYDAY SHORTCUTS'
  }
];

export function AtlasWalkthrough({ onClose, onOpenCommand }: Props) {
  const [index, setIndex] = useState(0);
  const navigate = useNavigate();
  const dialogRef = useRef<HTMLElement>(null);
  const step = steps[index];

  const finish = () => onClose();
  const advance = () => {
    if (index < stepRoutes.length) {
      navigate(stepRoutes[index]);
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
          <p>Five quick stops to see how Atlas supports your day, your rhythm, and your direction.</p>
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
