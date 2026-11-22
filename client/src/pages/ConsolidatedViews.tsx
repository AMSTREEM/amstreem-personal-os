import { useState } from 'react';
import { LibraryPage } from './LibraryPage';
import { LearningPage } from './LearningPage';
import { ReviewsPage } from './ReviewsPage';
import { InsightsPage } from './InsightsPage';
import { RitualsPage } from './RitualsPage';
import { SelfControlPage } from './SelfControlPage';
import { PageHeader } from '../components/ui';

function ViewTabs({ items, value, onChange }: { items: { id: string; label: string }[]; value: string; onChange: (value: string) => void }) {
  return <div className="review-switch" role="tablist" aria-label="View sections">
    {items.map(item => <button key={item.id} type="button" role="tab" aria-selected={value === item.id} className={value === item.id ? 'review-switch__active' : ''} onClick={() => onChange(item.id)}>{item.label}</button>)}
  </div>;
}

export function HabitsSelfControlView() {
  return <div className="stack habits-self-control-view">
    <PageHeader eyebrow="ROOM 02 / DAILY RHYTHM" title="Habits & Self-Control" description="Build the routines you want to keep, honour your personal commitments, and learn from the days that do not go to plan." />
    <SelfControlPage embedded />
    <RitualsPage embedded />
  </div>;
}

export function LearningLibraryView() {
  const [tab, setTab] = useState('learning');
  return <div className="stack">
    <ViewTabs value={tab} onChange={setTab} items={[{ id: 'learning', label: 'Learning Paths' }, { id: 'library', label: 'Private Library' }]} />
    {tab === 'learning' ? <LearningPage /> : <LibraryPage />}
  </div>;
}

export function ReviewsInsightsView() {
  const [tab, setTab] = useState('reviews');
  return <div className="stack">
    <ViewTabs value={tab} onChange={setTab} items={[{ id: 'reviews', label: 'Daily & Weekly Reviews' }, { id: 'insights', label: 'Insights & Trends' }]} />
    {tab === 'reviews' ? <ReviewsPage /> : <InsightsPage />}
  </div>;
}
