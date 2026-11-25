import { useMemo, useState } from 'react';
import { ArrowRight, Compass, Focus, Layers3, Target, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import './blueprint.css';

type BlueprintGoal = {
  id: number;
  title: string;
  detail: string;
  target_date: string | null;
  status: string;
  category?: string;
  horizon?: 'short-term' | 'long-term';
  focus_minutes?: number;
  linked_tasks?: number;
  completed_tasks?: number;
};

function formatTarget(date: string | null) {
  if (!date) return 'No target date';
  return 'Target ' + new Intl.DateTimeFormat('en-NG', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Africa/Lagos' }).format(new Date(date + 'T12:00:00'));
}

function formatFocus(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours ? hours + 'h' + (remainder ? ' ' + remainder + 'm' : '') : remainder + 'm';
}

export function BlueprintPage() {
  const [selectedArea, setSelectedArea] = useState('all');
  const goalsQuery = useQuery({ queryKey: ['goals'], queryFn: () => api<BlueprintGoal[]>('/goals') });
  const goals = goalsQuery.data || [];
  const visibleGoals = goals.filter(goal => goal.status !== 'archived');
  const activeGoals = visibleGoals.filter(goal => goal.status === 'active');
  const areas = useMemo(() => [...new Set(visibleGoals.map(goal => goal.category?.trim() || 'Personal'))].sort((a, b) => a.localeCompare(b)), [visibleGoals]);
  const filteredGoals = selectedArea === 'all' ? visibleGoals : visibleGoals.filter(goal => (goal.category?.trim() || 'Personal') === selectedArea);
  const focusMinutes = activeGoals.reduce((sum, goal) => sum + (Number(goal.focus_minutes) || 0), 0);
  const goalsWithWork = activeGoals.filter(goal => (goal.linked_tasks || 0) > 0).length;
  const isLoading = goalsQuery.isLoading;

  return (
    <main className="atlas-blueprint page-container">
      <header className="atlas-blueprint__header">
        <div>
          <span className="atlas-blueprint__eyebrow"><Compass size={13} /> YOUR LIFE BLUEPRINT</span>
          <h1>Give your ambition <em>a direction.</em></h1>
          <p>A living map of the outcomes you're working towards. Start with what matters, then connect it to real work.</p>
        </div>
        <Link className="atlas-blueprint__create" to="/goals">Shape your goals <ArrowRight size={15} /></Link>
      </header>

      {goalsQuery.isError && <div className="atlas-blueprint__error" role="alert">Your goals couldn't be loaded. Please refresh and try again.</div>}

      <section className="atlas-blueprint__overview" aria-label="Blueprint overview">
        <article><span><Target size={16}/></span><small>Active directions</small><strong>{isLoading ? '—' : activeGoals.length}</strong></article>
        <article><span><Layers3 size={16}/></span><small>Life areas in motion</small><strong>{isLoading ? '—' : areas.length}</strong></article>
        <article><span><TrendingUp size={16}/></span><small>Goals with linked work</small><strong>{isLoading ? '—' : goalsWithWork}</strong></article>
        <article><span><Focus size={16}/></span><small>Focus invested</small><strong>{isLoading ? '—' : formatFocus(focusMinutes)}</strong></article>
      </section>

      <section className="atlas-blueprint__areas">
        <div className="atlas-blueprint__section-head">
          <div><span className="atlas-blueprint__eyebrow">01 / YOUR AREAS</span><h2>Where you are building</h2><p>Areas are drawn from the categories you've already chosen for your goals.</p></div>
          <span className="atlas-blueprint__section-count">{areas.length} {areas.length === 1 ? 'area' : 'areas'}</span>
        </div>
        {isLoading ? <div className="atlas-blueprint__area-skeleton"><i/><i/><i/></div> : areas.length ? (
          <div className="atlas-blueprint__area-grid">
            <button type="button" className={'atlas-blueprint__area-card ' + (selectedArea === 'all' ? 'is-selected' : '')} onClick={() => setSelectedArea('all')}>
              <span className="atlas-blueprint__area-icon"><Compass size={17}/></span><small>Everything</small><strong>{visibleGoals.length}</strong><span>Outcomes across your life</span>
            </button>
            {areas.map(area => {
              const areaGoals = visibleGoals.filter(goal => (goal.category?.trim() || 'Personal') === area);
              const areaActive = areaGoals.filter(goal => goal.status === 'active').length;
              return <button type="button" key={area} className={'atlas-blueprint__area-card ' + (selectedArea === area ? 'is-selected' : '')} onClick={() => setSelectedArea(area)}>
                <span className="atlas-blueprint__area-icon"><Layers3 size={17}/></span><small>{area}</small><strong>{areaActive}</strong><span>{areaGoals.length} {areaGoals.length === 1 ? 'outcome' : 'outcomes'}</span>
              </button>;
            })}
          </div>
        ) : (
          <div className="atlas-blueprint__empty">
            <span><Compass size={20}/></span><h3>Your blueprint starts with what matters to you.</h3>
            <p>Create a goal in an area of your life. Atlas will begin shaping this map from your own choices.</p>
            <Link to="/goals">Create your first goal <ArrowRight size={14}/></Link>
          </div>
        )}
      </section>

      <section className="atlas-blueprint__directions">
        <div className="atlas-blueprint__section-head">
          <div><span className="atlas-blueprint__eyebrow">02 / YOUR OUTCOMES</span><h2>{selectedArea === 'all' ? 'The things you're working towards' : selectedArea}</h2><p>Each outcome can connect to projects, milestones, actions and focused work.</p></div>
          <Link to="/goals" className="atlas-blueprint__manage">Manage goals <ArrowRight size={14}/></Link>
        </div>
        {isLoading ? <div className="atlas-blueprint__goal-skeleton"><i/><i/></div> : filteredGoals.length ? (
          <div className="atlas-blueprint__goal-grid">
            {filteredGoals.map(goal => {
              const linked = Number(goal.linked_tasks) || 0;
              const completed = Number(goal.completed_tasks) || 0;
              const progress = linked ? Math.min(100, Math.round(completed / linked * 100)) : 0;
              return <article className="atlas-blueprint__goal-card" key={goal.id}>
                <div className="atlas-blueprint__goal-top"><span>{goal.category || 'Personal'} · {goal.horizon || 'long-term'}</span><span className={'atlas-blueprint__status ' + (goal.status === 'completed' ? 'is-complete' : '')}>{goal.status}</span></div>
                <h3>{goal.title}</h3>
                <p>{goal.detail || 'No additional context has been added yet.'}</p>
                <div className="atlas-blueprint__goal-meta"><span>{formatTarget(goal.target_date)}</span><span>{linked} linked actions</span></div>
                {linked ? <><div className="atlas-blueprint__progress-copy"><span>Linked action progress</span><strong>{completed}/{linked}</strong></div><div className="atlas-blueprint__progress"><span style={{width:progress+'%'}}/></div></> : <div className="atlas-blueprint__no-evidence">Ready for its first connected action</div>}
                <Link to={'/goals#atlas-goal-' + goal.id} className="atlas-blueprint__goal-link">Open outcome <ArrowRight size={14}/></Link>
              </article>;
            })}
          </div>
        ) : (
          <div className="atlas-blueprint__empty atlas-blueprint__empty--small">
            <h3>No outcomes in this area yet.</h3><p>Choose an outcome that would make this part of your life more meaningful.</p><Link to="/goals">Add an outcome <ArrowRight size={14}/></Link>
          </div>
        )}
      </section>

      <footer className="atlas-blueprint__note">
        <span><Compass size={16}/></span>
        <p>This is your starting map, not a scorecard. Your areas and priorities can change as your life changes. Progress is only shown where Atlas has real linked records.</p>
      </footer>
    </main>
  );
}
