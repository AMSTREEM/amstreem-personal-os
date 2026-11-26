import { useState } from 'react';
import { LibraryPage } from './LibraryPage';
import { LearningPage } from './LearningPage';
import { ReviewsPage } from './ReviewsPage';
import { InsightsPage } from './InsightsPage';
import { RitualsPage } from './RitualsPage';
import { SelfControlPage } from './SelfControlPage';
import { PageHeader } from '../components/ui';

export function HabitsSelfControlView() {
  const [workspace,setWorkspace]=useState<'habits'|'self-control'|'all'>('habits');
  const switcher=<nav className="growth-workspace-switcher atlas-segmented-switcher" aria-label="Choose habits workspace">
    {([{id:'habits',label:'Daily Habits'},{id:'self-control',label:'Self-Control'},{id:'all',label:'Show All'}] as const).map(tab=><button key={tab.id} type="button" className={workspace===tab.id?'is-active':''} aria-pressed={workspace===tab.id} onClick={()=>setWorkspace(tab.id)}>{tab.label}</button>)}
  </nav>;
  return <div className="stack habits-self-control-view daily-rhythm-sanctuary">
    <PageHeader eyebrow="ROOM 02 / DAILY RHYTHM" title="Habits & Self-Control" description="Build the routines you want to keep, honour your personal commitments, and learn from the days that do not go to plan." />
    <SelfControlPage embedded afterHeatmap={switcher} showTrackerContent={workspace==='self-control'||workspace==='all'} />
    {(workspace==='habits'||workspace==='all') && <section className="habits-module-section habits-module-section--positive">
      <div className="habits-module-heading"><span className="module-kicker">DAILY POSITIVE HABITS</span><h2>Small actions, repeated.</h2><p>Check off the routines you want to build and watch consistency take shape.</p></div>
      <RitualsPage embedded />
    </section>}
  </div>;
}
 
export function LearningLibraryView() {
  const [workspace,setWorkspace]=useState<'learning'|'library'|'all'>('learning');
  return <div className="stack growth-combined-view">
    <PageHeader eyebrow="ROOM 04 / GROWTH & DIRECTION" title="Learning & Library" description="Turn curiosity into a path, keep useful knowledge close, and connect what you learn to the work you are doing." />
    <nav className="growth-workspace-switcher atlas-segmented-switcher" aria-label="Choose learning workspace">
      {([{id:'learning',label:'Learning Paths'},{id:'library',label:'Private Library'},{id:'all',label:'Show All'}] as const).map(tab=><button key={tab.id} type="button" className={workspace===tab.id?'is-active':''} aria-pressed={workspace===tab.id} onClick={()=>setWorkspace(tab.id)}>{tab.label}</button>)}
    </nav>
    {(workspace==='learning'||workspace==='all') && <section className="growth-view-section" aria-labelledby="growth-learning-heading">
      <div className="growth-section-heading"><span className="eyebrow">LEARN / PATHS & LESSONS</span><h2 id="growth-learning-heading">Learning paths</h2><p>Build a sequence of lessons, give them focused time, and keep each path connected to a meaningful goal.</p></div>
      <LearningPage embedded />
    </section>}
    {(workspace==='library'||workspace==='all') && <section className="growth-view-section" aria-labelledby="growth-library-heading">
      <div className="growth-section-heading"><span className="eyebrow">KNOWLEDGE / PRIVATE LIBRARY</span><h2 id="growth-library-heading">Private Library</h2><p>Keep books, articles, references and private notes close to the work that matters.</p></div>
      <LibraryPage embedded />
    </section>}
  </div>;
}

export function ReviewsInsightsView() {
  const [workspace,setWorkspace]=useState<'reviews'|'insights'|'all'>('reviews');
  return <div className="stack growth-combined-view">
    <nav className="growth-workspace-switcher atlas-segmented-switcher" aria-label="Choose review workspace">
      {([{id:'reviews',label:'Daily & Weekly Review'},{id:'insights',label:'Trends & Insights'},{id:'all',label:'Show All'}] as const).map(tab=><button key={tab.id} type="button" className={workspace===tab.id?'is-active':''} aria-pressed={workspace===tab.id} onClick={()=>setWorkspace(tab.id)}>{tab.label}</button>)}
    </nav>
    {(workspace==='reviews'||workspace==='all') && <section className="growth-view-section" aria-labelledby="growth-reviews-heading">
      <div className="growth-section-heading"><span className="eyebrow">REFLECT / DAILY & WEEKLY</span><h2 id="growth-reviews-heading">Reviews</h2><p>Reflect on wins, challenges and lessons, then choose the priorities that deserve attention.</p></div>
      <ReviewsPage embedded />
    </section>}
    {(workspace==='insights'||workspace==='all') && <section className="growth-view-section" aria-labelledby="growth-insights-heading">
      <div className="growth-section-heading"><span className="eyebrow">REFLECT / PERSONAL INTELLIGENCE</span><h2 id="growth-insights-heading">Insights & activity trends</h2><p>Notice comparable focus patterns and evidence-based next steps from your recorded workspace activity.</p></div>
      <InsightsPage embedded />
    </section>}
  </div>;
}
