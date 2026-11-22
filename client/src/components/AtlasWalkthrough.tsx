import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { api, json } from '../lib/api';

const palettes = [
  { group: 'Dark', items: [
    { id: 'shadowed-alchemist', name: 'Shadowed Alchemist', note: 'Quiet charcoal and gold', colors: ['#07080A','#0E1014','#CA8A04','#E4E4E7'] },
    { id: 'nocturnal-amethyst', name: 'Nocturnal Amethyst', note: 'Deep violet', colors: ['#050408','#0C0914','#C084FC','#EAE6F5'] },
    { id: 'abyssal-trench', name: 'Abyssal Trench', note: 'Midnight blue', colors: ['#03060C','#080E1A','#38BDF8','#E2E8F0'] },
    { id: 'whispering-woods', name: 'Whispering Woods', note: 'Forest green', colors: ['#030806','#08120E','#6EE7B7','#E2F1EC'] },
    { id: 'crimson-velvet', name: 'Crimson Velvet', note: 'Deep red and rose', colors: ['#080304','#120709','#FB7185','#F5E6E8'] }
  ]},
  { group: 'Light', items: [
    { id: 'light-porcelain', name: 'Porcelain', note: 'Clean neutral', colors: ['#F5F6F3','#FFFFFF','#527A62','#202720'] },
    { id: 'light-sandstone', name: 'Sandstone', note: 'Warm and grounded', colors: ['#F6F0E7','#FFFCF7','#9A7046','#30271F'] },
    { id: 'light-sage', name: 'Sage', note: 'Soft green', colors: ['#EFF4EF','#FBFEFB','#43836B','#203128'] },
    { id: 'light-lavender', name: 'Lavender Mist', note: 'Muted violet', colors: ['#F4F1F8','#FFFDFF','#8062A6','#2B2535'] },
    { id: 'light-sky', name: 'Sky Glass', note: 'Cool blue', colors: ['#EFF5F9','#FFFFFF','#477DA5','#202D39'] }
  ]}
];
const paletteBackgrounds: Record<string, string> = Object.fromEntries(palettes.flatMap(group => group.items.map(item => [item.id, item.colors[0]])));
function previewPalette(id: string) {
  const background = paletteBackgrounds[id];
  if (!background) return;
  localStorage.setItem('atlas_theme', id);
  document.documentElement.setAttribute('data-theme', id);
  document.documentElement.style.colorScheme = id.startsWith('light-') ? 'light' : 'dark';
  document.documentElement.style.backgroundColor = background;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', background);
}

type Props = { onClose: () => void };

const optionalModules = [
  { id: 'calendar', name: 'Calendar', description: 'Time-block commitments and see what is coming up.' },
  { id: 'library', name: 'Personal Library', description: 'Keep notes, references and useful material.' }
];
const steps = [
  {
    eyebrow: 'MAKE ATLAS YOURS FIRST',
    title: 'Choose the colour of your space.',
    description: 'Pick the palette that feels right. Select any option to preview it across Atlas instantly. You can change it later in Settings.',
    rows: ['Your choice changes the interface as you select it.', 'Dark and light palettes are both available.', 'Your selection is saved when you continue.'],
    label: 'LIVE APPEARANCE PREVIEW'
  },
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
    eyebrow: 'SEE HOW YOUR WORK CONNECTS',
    title: 'Your Life Constellation makes direction visible.',
    description: 'The constellation is a living map of the outcomes you care about and the work supporting them. Goals are the anchors; projects and learning paths become connected when you link them to a goal.',
    rows: ['Each point represents a goal, project or learning path.', 'Connect a project or learning path to a goal to create a visible link.', 'Drag points to explore the map; select one to see its name.', 'The map grows as your real workspace grows—nothing is fabricated.'],
    label: 'GOALS · PROJECTS · LEARNING'
  },
  {
    eyebrow: 'MAKE THE NEXT MOVE CLEAR',
    title: 'Execution & Focus keeps work in one place.',
    description: 'Workspace gives you the overview. Projects and Tasks organise the work, Focus Timer protects your attention, and Calendar keeps commitments in time.',
    rows: ['Start from Workspace to see what needs attention.', 'Move between Projects, Tasks, Focus Timer and Calendar.', 'Start a timer from a task or run a standalone deep-work session.'],
    label: 'EXECUTION & FOCUS'
  },
  {
    eyebrow: 'BUILD A STEADY RHYTHM',
    title: 'Build a rhythm you can sustain.',
    description: 'Focus Timer lives inside Execution & Focus. Daily Rhythm brings together repeatable practices, reflection and self-control without adding noise to your day.',
    rows: ['Protect attention with focused sessions.', 'Keep recurring practices visible.', 'Reflect on patterns and choose a better response.'],
    label: 'DAILY RHYTHM / CONSISTENCY'
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
    title: 'Your space stays yours.',
    description: 'Manage your personal preferences, keep control of your data and decide which optional practices belong in Atlas. Deen is optional; your workspace should respect the way you choose to use it.',
    rows: ['Change your appearance whenever you want.', 'Export a backup of your workspace at any time.', 'Add optional spaces when they support your life.'],
    label: 'PERSONAL / OWNERSHIP'
  },
  { eyebrow: 'BUILT AROUND YOUR CHOICES', title: 'Choose what belongs in your Atlas.', description: 'The essentials stay available. Add only the extra spaces you want; you can change these choices any time in Settings.', rows: ['Calendar and Personal Library are optional.', 'Your four main rooms stay available.', 'You can change these choices later in Settings.'], label: 'YOUR OPTIONAL MODULES' }
];

export function AtlasWalkthrough({ onClose }: Props) {
  const [index, setIndex] = useState(0);
  const [selectedModules, setSelectedModules] = useState<string[]>(optionalModules.map(item => item.id));
  const [selectedTheme, setSelectedTheme] = useState(() => { try { return localStorage.getItem('atlas_theme') || 'shadowed-alchemist'; } catch { return 'shadowed-alchemist'; } });
  const themeTouched = useRef(false);
  const selectedModulesRef = useRef(selectedModules);
  selectedModulesRef.current = selectedModules;
  useEffect(() => { void api<Record<string, string>>('/settings').then(settings => { if (settings.features) { try { setSelectedModules(JSON.parse(settings.features).map((feature: string) => feature === 'values' ? 'deen' : feature)); } catch { /* Keep the available defaults. */ } } if (settings.theme && !themeTouched.current) { setSelectedTheme(settings.theme); previewPalette(settings.theme); } }).catch(() => undefined); }, []);
  const finish = async () => { try { await api('/settings', json('PATCH', { features: selectedModulesRef.current, theme: selectedTheme })); } catch (error) { console.error('Could not save Atlas preferences:', error); } onClose(); };
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
            {index === 0 && <div className="atlas-onboarding-palettes">{palettes.map(group => <section className="atlas-onboarding-palette-group" key={group.group}><span>{group.group} palettes</span><div className="atlas-onboarding-palette-grid">{group.items.map(item => <button type="button" key={item.id} className={'atlas-onboarding-palette ' + (selectedTheme === item.id ? 'is-selected' : '')} aria-pressed={selectedTheme === item.id} onClick={() => { themeTouched.current = true; setSelectedTheme(item.id); previewPalette(item.id); }}><span className="atlas-onboarding-palette__swatches" aria-hidden="true">{item.colors.map((color, i) => <i key={i} style={{ background: color }} />)}</span><b>{item.name}</b><small>{item.note}</small>{selectedTheme === item.id && <em>Selected</em>}</button>)}</div></section>)}</div>}
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
