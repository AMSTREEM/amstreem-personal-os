import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

type Props = { onClose: () => void; onOpenCommand?: () => void };

const stepRoutes = ['/residence', '/actions', '/habits', '/growth', '/quran'];

const steps = [
  {
    eyebrow: '01 · HOME',
    title: 'Start with Residence.',
    description: 'See the day in front of you: priorities, time-sensitive commitments, habits due and the next useful action.',
    rows: ['g 1 · Residence', 'Today’s briefing · Upcoming commitments', 'Progress across your chosen areas'],
    label: 'ORIENT YOUR DAY'
  },
  {
    eyebrow: '02 · PLAN',
    title: 'Turn direction into action.',
    description: 'Actions, Goals and Calendar work together: capture the work, connect it to outcomes, and make time for it.',
    rows: ['g 2 · Actions · Tasks and focus', 'g 3 · Goals · Outcomes and milestones', 'g 4 · Calendar · Time and commitments'],
    label: 'MAKE A PLAN YOU CAN ACT ON'
  },
  {
    eyebrow: '03 · PRACTICE',
    title: 'Build the routines that carry you.',
    description: 'Habits and Learning Library keep your daily practice and long-term learning in one place.',
    rows: ['g 5 · Habits · Routines and check-ins', 'g 6 · Learning Library · Lessons and notes', 'Quick capture · Save an idea in seconds'],
    label: 'MAKE CONSISTENCY EASIER'
  },
  {
    eyebrow: '04 · REFLECT',
    title: 'Measure growth, not busyness.',
    description: 'Growth and Values help you review evidence, understand patterns and keep your decisions aligned with what matters.',
    rows: ['g 7 · Growth · Reviews and progress', 'g 8 · Values · Principles and reflection', 'Private by design · Your workspace stays yours'],
    label: 'LEARN FROM WHAT HAPPENED'
  },
  {
    eyebrow: '05 · SPECIALIST READER',
    title: 'The Qur’an has its own space.',
    description: 'The reader keeps its specialised Mushaf layout, Tajweed colours, fonts, bookmarks and reading controls. Atlas navigation stays outside its reading surface.',
    rows: ['g 9 · Qur’an · Standalone destination', 'Reader controls remain under your control', 'No automatic snapping or shell motion inside'],
    label: 'A PROTECTED READING EXPERIENCE'
  },
  {
    eyebrow: 'YOUR WORKSPACE',
    title: 'Make Atlas yours.',
    description: 'Change themes, choose your life areas, capture tasks, notes or habits, and adjust your workspace as your priorities evolve.',
    rows: ['Ctrl/⌘ + K · Command palette', 'c · Quick capture · ? · Shortcuts', 'Settings · Appearance · Accessibility'],
    label: 'YOUR LIFE. YOUR DIRECTION. YOUR GROWTH'
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
          <p>Seven quick stops to see how Atlas helps you choose direction, take action and make meaningful progress.</p>
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
