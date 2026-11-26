import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

type Props = { onClose: () => void; onOpenCommand?: () => void };

const stepRoutes = ['/residence', '/daily-rhythm', '/actions', '/goals'];

const steps = [
  {
    eyebrow: '01 · RESIDENCE',
    title: 'Start with what matters.',
    description: 'Your Home starts with one meaningful next move, then brings your open actions, longer-term direction and real progress into view. Your Life Blueprint connects the work you do today to the outcomes you care about.',
    rows: ['⌘ 1 · Residence', 'Your current direction · Next actions', 'Focus time · Life Blueprint'],
    label: 'SEE THE BIG PICTURE'
  },
  {
    eyebrow: '02 · DAILY RHYTHM',
    title: 'Give your days a rhythm.',
    description: 'Shape your day without turning it into a scorecard. Keep reflection, Faith & Practice and Habits & Self-Control close, while specialist tools such as Qur’an remain independently accessible.',
    rows: ['⌘ 2 · Daily Rhythm', 'Daily Check-in · Faith & Practice', 'Habits & Self-Control · Qur’an'],
    label: 'BUILD A RHYTHM THAT LASTS'
  },
  {
    eyebrow: '03 · EXECUTION & FOCUS',
    title: 'Turn intention into action.',
    description: 'Capture what is on your mind, choose the next action, and protect time to do it. Projects, tasks, calendar commitments and focus sessions stay connected.',
    rows: ['⌘ 3 · Execution & Focus', 'Projects & Tasks · Calendar', 'Focus timer · Linked sessions'],
    label: 'MAKE PROGRESS VISIBLE'
  },
  {
    eyebrow: '04 · GROWTH & DIRECTION',
    title: 'Build towards outcomes that matter.',
    description: 'Set outcomes, connect them to learning and milestones, and review real evidence of how your work is changing over time.',
    rows: ['⌘ 4 · Growth & Direction', 'Goals & Milestones · Learning & Library', 'Reviews & Insights · Useful next steps'],
    label: 'GROW WITH INTENTION'
  },
  {
    eyebrow: 'PERSONAL BY DESIGN',
    title: 'Make Atlas yours.',
    description: 'Choose the areas that matter right now. Keep optional spaces optional, protect your private records, and change direction whenever life changes. Atlas should support your life—not become another obligation.',
    rows: ['Your life areas · Your priorities', 'Specialist tools · Private by design', 'A fresh start is always available'],
    label: 'YOUR LIFE. YOUR DIRECTION. YOUR GROWTH'
  }
];

export function AtlasWalkthrough({ onClose, onOpenCommand }: Props) {
  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);
  const navigate = useNavigate();
  const dialogRef = useRef<HTMLElement>(null);
  const step = steps[index];

  const finish = () => onClose();
  const goToStep = (nextIndex: number) => {
    const target = Math.max(0, Math.min(steps.length - 1, nextIndex));
    indexRef.current = target;
    setIndex(target);
    const route = stepRoutes[target];
    if (route) navigate(route);
  };
  const advance = () => {
    if (index < steps.length - 1) {
      goToStep(index + 1);
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
      if (event.key === 'ArrowRight') goToStep(indexRef.current + 1);
      if (event.key === 'ArrowLeft') goToStep(indexRef.current - 1);
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
          <p>Five quick stops to see how Atlas helps you choose direction, take action and make meaningful progress.</p>
          <div className="atlas-tour__progress" aria-label={`Step ${index + 1} of ${steps.length}`}><i style={{ width: `${((index + 1) / steps.length) * 100}%` }} /></div>
          <nav className="atlas-tour__nav" aria-label="Walkthrough steps">
            {steps.map((item, i) => <button key={item.label} type="button" aria-label={`Go to step ${i + 1}: ${item.title}`} aria-current={i === index ? 'step' : undefined} onClick={() => goToStep(i)}>{String(i + 1).padStart(2, '0')}</button>)}
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
          <button className="button button--secondary" type="button" disabled={index === 0} onClick={() => goToStep(index - 1)}><ChevronLeft size={15} /> Back</button>
          <button className="button button--primary" type="button" onClick={advance}>{index < steps.length - 1 ? <>Next <ChevronRight size={15} /></> : <>Start exploring <ChevronRight size={15} /></>}</button>
        </div>
      </footer>
    </motion.section>
  </motion.div>;
}
