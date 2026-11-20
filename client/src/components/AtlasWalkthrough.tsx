import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

type Props = { onClose: () => void };

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
    description: 'Choose the appearance that feels right, manage your data and decide which personal practices belong in your workspace. Values is optional; Atlas should respect the way you choose to use it.',
    rows: ['Choose from distinct dark and light palettes.', 'Export a backup of your workspace at any time.', 'Keep optional values and faith practices on your terms.'],
    label: 'PERSONAL / OWNERSHIP'
  }
];

export function AtlasWalkthrough({ onClose }: Props) {
  const [index, setIndex] = useState(0);
  const step = steps[index];

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowRight') setIndex(value => Math.min(steps.length - 1, value + 1));
      if (event.key === 'ArrowLeft') setIndex(value => Math.max(0, value - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return <div className="atlas-tour-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="atlas-tour" role="dialog" aria-modal="true" aria-labelledby="atlas-tour-title">
      <header className="atlas-tour__top">
        <div className="atlas-tour__brand"><img className="brand-symbol" src="/assets/brand/amstreem-symbol.svg" alt="" /><span>AMSTREEM ATLAS</span></div>
        <span className="atlas-tour__count">YOUR FIRST LOOK · {String(index + 1).padStart(2, '0')} / {String(steps.length).padStart(2, '0')}</span>
        <button className="icon-button" type="button" aria-label="Close walkthrough" onClick={onClose}><X size={18} /></button>
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
          </div>
        </main>
      </div>
      <footer className="atlas-tour__actions">
        <button className="button button--ghost" type="button" onClick={onClose}>Close tour</button>
        <div>
          <button className="button button--secondary" type="button" disabled={index === 0} onClick={() => setIndex(value => Math.max(0, value - 1))}><ChevronLeft size={15} /> Back</button>
          {index < steps.length - 1
            ? <button className="button button--primary" type="button" onClick={() => setIndex(value => Math.min(steps.length - 1, value + 1))}>Continue <ChevronRight size={15} /></button>
            : <button className="button button--primary" type="button" onClick={onClose}>Start exploring <ChevronRight size={15} /></button>}
        </div>
      </footer>
    </section>
  </div>;
}
