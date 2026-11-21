import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { api, json } from '../lib/api';

type Props = { onClose: () => void };

const optionalModules = [
  { id: 'calendar', name: 'Calendar', description: 'Time-block commitments and see what is coming up.' },
  { id: 'focus', name: 'Focus', description: 'Protect focused work and record sessions.' },
  { id: 'rituals', name: 'Rituals', description: 'Build repeatable routines and daily practices.' },
  { id: 'selfcontrol', name: 'Self-control', description: 'Privately notice triggers and track responses.' },
  { id: 'learning', name: 'Learning', description: 'Organise skills, subjects and lessons.' },
  { id: 'library', name: 'Personal Library', description: 'Keep notes, references and useful material.' },
  { id: 'deen', name: 'Deen', description: 'Optional salah, Qur’an and Tahajjud tracking.' }
];
const steps = [
  {
    eyebrow: 'WELCOME TO YOUR SPACE',
    title: 'A system for what matters.',
    description: 'Atlas brings your direction, commitments, learning and personal growth into one considered workspace. It is designed to help you move with intention—not keep you busy for the sake of it.',
    rows: ['Your priorities stay connected to your bigger direction.', 'Daily actions have a clear place to live.', 'Reflection helps you adjust without starting over.'],
    label: 'THE ATLAS PRINCIPLE'
  },
  {
    eyebrow: 'YOUR STARTING POINT',
    title: 'Today keeps the day in view.',
    description: 'Your command centre brings the most relevant parts of your workspace together: priorities, commitments, rituals and recent activity. It should answer one question quickly: what matters now?',
    rows: ['See the day’s priorities and open tasks.', 'Keep rituals and focus intentions visible.', 'Review activity without hunting through modules.'],
    label: 'TODAY / COMMAND CENTRE'
  },
  {
    eyebrow: 'DIRECTION BEFORE ACTIVITY',
    title: 'Give your effort a destination.',
    description: 'Goals describe outcomes that matter. Projects turn those outcomes into manageable bodies of work. Milestones show the next meaningful checkpoint.',
    rows: ['Set goals with a clear reason and target.', 'Connect projects to the goals they support.', 'Use milestones to make larger outcomes tangible.'],
    label: 'GOALS → PROJECTS'
  },
  {
    eyebrow: 'MAKE THE NEXT MOVE CLEAR',
    title: 'Tasks and calendar work together.',
    description: 'Tasks capture actions. Calendar events give commitments a place in time. Keep them connected when it helps, while allowing standalone tasks and events when it does not.',
    rows: ['Capture a task without over-planning it.', 'Link work to a project or goal where relevant.', 'Give important commitments a time and date.'],
    label: 'EXECUTION / COMMITMENTS'
  },
  {
    eyebrow: 'BUILD A STEADY RHYTHM',
    title: 'Focus and rituals support consistency.',
    description: 'Focus sessions protect attention. Rituals make repeatable behaviours easier to maintain. Self-control tracking helps you notice patterns and choose a better response without turning the system into a source of shame.',
    rows: ['Record focused work and what it moved forward.', 'Keep recurring practices visible.', 'Reflect on triggers, responses and patterns privately.'],
    label: 'PRACTICE / CONSISTENCY'
  },
  {
    eyebrow: 'KEEP GETTING BETTER',
    title: 'Learning becomes a path, not a pile.',
    description: 'Organise subjects into learning paths, lessons and checkpoints. Save useful material in your Library so ideas and references remain close to the work they support.',
    rows: ['Create a learning path around a skill or subject.', 'Break it into lessons and checkpoints.', 'Keep notes and resources in your personal Library.'],
    label: 'LEARNING / KNOWLEDGE'
  },
  {
    eyebrow: 'NOTICE WHAT IS CHANGING',
    title: 'Reflection turns activity into insight.',
    description: 'Daily and weekly reviews help you record wins, friction and lessons. Insights should be drawn from your real workspace activity—not invented scores or empty motivational metrics.',
    rows: ['Review what worked and what got in the way.', 'Choose a useful focus for the next period.', 'Use trends to make calmer, better-informed decisions.'],
    label: 'REFLECTION / GROWTH'
  },
  {
    eyebrow: 'MAKE ATLAS YOURS',
    title: 'Your space should reflect your values.',
    description: 'Choose the appearance that feels right, manage your data and decide which personal practices belong in your workspace. Deen is optional; Atlas should respect the way you choose to use it.',
    rows: ['Choose from distinct dark and light palettes.', 'Export a backup of your workspace at any time.', 'Add Deen when it supports your practice, or leave it out.'],
    label: 'PERSONAL / OWNERSHIP'
  },
  { eyebrow: 'BUILT AROUND YOUR CHOICES', title: 'Choose what belongs in your Atlas.', description: 'The essentials stay available. Add only the extra spaces you want; you can change these choices any time in Settings.', rows: ['Optional spaces can be added or skipped.', 'Your choices shape the navigation.', 'Nothing here is permanent—you stay in control.'], label: 'YOUR OPTIONAL MODULES' }
];

export function AtlasWalkthrough({ onClose }: Props) {
  const [index, setIndex] = useState(0);
  const [selectedModules, setSelectedModules] = useState<string[]>(optionalModules.map(item => item.id));
  const selectedModulesRef = useRef(selectedModules);
  selectedModulesRef.current = selectedModules;
  useEffect(() => { void api<Record<string, string>>('/settings').then(settings => { if (settings.features) { try { setSelectedModules(JSON.parse(settings.features).map((feature: string) => feature === 'values' ? 'deen' : feature)); } catch { /* Keep the available defaults. */ } } }).catch(() => undefined); }, []);
  const finish = async () => { try { await api('/settings', json('PATCH', { features: selectedModulesRef.current })); } catch (error) { console.error('Could not save Atlas module choices:', error); } onClose(); };
  const dialogRef = useRef<HTMLElement>(null);
  const step = steps[index];

  useEffect(() => {
    const previous = document.body.style.overflow;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = 'hidden';
    const focusable = () => Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') || []);
    focusable()[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') void finish();
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

  return <motion.div className="atlas-tour-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) void finish(); }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
    <motion.section ref={dialogRef} className="atlas-tour" role="dialog" aria-modal="true" aria-labelledby="atlas-tour-title" tabIndex={-1} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}>
      <header className="atlas-tour__top">
        <div className="atlas-tour__brand"><img className="brand-symbol" src="/assets/brand/amstreem-symbol.svg" alt="" /><span>AMSTREEM ATLAS</span></div>
        <span className="atlas-tour__count">YOUR FIRST LOOK · {String(index + 1).padStart(2, '0')} / {String(steps.length).padStart(2, '0')}</span>
        <button className="icon-button" type="button" aria-label="Close walkthrough" onClick={() => void finish()}><X size={18} /></button>
      </header>
      <div className="atlas-tour__body">
        <aside className="atlas-tour__intro">
          <span className="atlas-tour__eyebrow">A GUIDED INTRODUCTION</span>
          <h2>Make room for what matters.</h2>
          <p>Take a few minutes to understand how the pieces of Atlas fit together. You can revisit this walkthrough whenever you need it.</p>
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
            {index === steps.length - 1 && <div className="atlas-module-choices">{optionalModules.map(module => <label className="atlas-module-choice" key={module.id}><input type="checkbox" checked={selectedModules.includes(module.id)} onChange={event => setSelectedModules(current => event.target.checked ? [...current, module.id] : current.filter(id => id !== module.id))} /><span><b>{module.name}</b><small>{module.description}</small></span></label>)}</div>}
          </div>
        </main>
      </div>
      <footer className="atlas-tour__actions">
        <button className="button button--ghost" type="button" onClick={() => void finish()}>Close tour</button>
        <div>
          <button className="button button--secondary" type="button" disabled={index === 0} onClick={() => setIndex(value => Math.max(0, value - 1))}><ChevronLeft size={15} /> Back</button>
          {index < steps.length - 1
            ? <button className="button button--primary" type="button" onClick={() => setIndex(value => Math.min(steps.length - 1, value + 1))}>Continue <ChevronRight size={15} /></button>
            : <button className="button button--primary" type="button" onClick={() => void finish()}>Start exploring <ChevronRight size={15} /></button>}
        </div>
      </footer>
    </motion.section>
  </motion.div>;
}
