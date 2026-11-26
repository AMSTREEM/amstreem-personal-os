import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

type Props = { onClose: () => void; onOpenCommand?: () => void };

const stepRoutes = ['/residence', '/actions', '/goals', '/focus', '/growth', '/calendar'];

const steps = [
  {
    eyebrow: '01 · YOUR PERSONAL COMMAND CENTRE',
    title: 'Start with Home.',
    description: 'See what matters today: priorities, upcoming commitments, progress across your chosen life areas, and useful next actions.',
    rows: ['⌘ 1 · Home', 'Today’s priorities · Upcoming commitments', 'Life-area context · Suggested next actions'],
    label: 'UNDERSTAND WHERE YOU ARE'
  },
  {
    eyebrow: '02 · TURN INTENTION INTO ACTION',
    title: 'Make meaningful progress.',
    description: 'Bring tasks, projects, habits, routines and personal commitments into one execution space. Spend less time administering your life and more time living it.',
    rows: ['⌘ 2 · Actions', 'Tasks · Projects · Milestones', 'Habits · Routines · Commitments'],
    label: 'BUILD THE SYSTEM'
  },
  {
    eyebrow: '03 · CHOOSE YOUR DIRECTION',
    title: 'Work towards outcomes that matter.',
    description: 'Define long-term goals, break them into milestones, and connect the work that moves each outcome forward.',
    rows: ['⌘ 3 · Goals', 'Life goals · Measurable outcomes', 'Milestones · Long-term plans'],
    label: 'KNOW WHERE YOU ARE GOING'
  },
  {
    eyebrow: '04 · PROTECT YOUR ATTENTION',
    title: 'Give important work your focus.',
    description: 'Run deep-work and study sessions, link them to the work they support, and keep a reliable history of your effort.',
    rows: ['⌘ 4 · Focus', 'Focus timer · Study sessions', 'Session history · Task-linked work'],
    label: 'TURN PLANS INTO ACTION'
  },
  {
    eyebrow: '05 · SEE WHAT IS CHANGING',
    title: 'Measure growth, not busyness.',
    description: 'Review real evidence against your starting point. Notice what improved, what did not, and what you may want to adjust next.',
    rows: ['⌘ 5 · Growth', 'Reviews · Progress evidence', 'Patterns · Useful next steps'],
    label: 'UNDERSTAND YOUR PROGRESS'
  },
  {
    eyebrow: '06 · MAKE TIME VISIBLE',
    title: 'Organise your commitments.',
    description: 'Bring events, routines, deadlines and planned focus blocks into one view so your time reflects your priorities.',
    rows: ['⌘ 6 · Calendar', 'Daily and weekly schedules', 'Events · Deadlines · Planned focus'],
    label: 'MAKE ROOM FOR WHAT MATTERS'
  },
  {
    eyebrow: 'PERSONAL BY DESIGN',
    title: 'Make Atlas yours.',
    description: 'Choose the life areas you want to work on. Keep specialist tools such as Qur’an, Learning Library and faith practices available when they matter to you. Change your priorities whenever life changes.',
    rows: ['Your life areas · Your priorities', 'Qur’an · Learning · Personal tools', 'Settings · Private by design'],
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
