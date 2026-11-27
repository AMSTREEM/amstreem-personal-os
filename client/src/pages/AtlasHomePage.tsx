import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, ArrowUpRight, CalendarDays, Check, Circle, Clock3, Plus, Sparkles, Target, Timer, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, json } from '../lib/api';
import { queryKeys } from '../lib/queryKeys';
import './atlas-home.css';

type HomeTask = {
  id: number;
  title: string;
  detail?: string;
  due_date: string | null;
  done: number;
  priority?: number;
  category?: string;
  goal_title?: string | null;
  project_title?: string | null;
};
type HomeGoal = {
  id: number;
  title: string;
  detail?: string;
  target_date: string | null;
  status: string;
  category?: string;
  linked_tasks?: number;
  completed_tasks?: number;
  focus_minutes?: number;
};
type FocusSession = { session_date: string; minutes: number; session_kind?: string };

function getAtlasDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(date);
}
function formatDate(date: string, options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }) {
  if (!date) return '';
  return new Intl.DateTimeFormat('en-NG', { ...options, timeZone: 'Africa/Lagos' }).format(new Date(date + 'T12:00:00'));
}
function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (hours && remaining) return hours + 'h ' + remaining + 'm';
  if (hours) return hours + 'h';
  return remaining + 'm';
}
function dueLabel(date: string | null, today: string) {
  if (!date) return 'Whenever you’re ready';
  if (date < today) return 'Needs a new date';
  if (date === today) return 'Today';
  const tomorrow = new Date(today + 'T12:00:00');
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (date === getAtlasDate(tomorrow)) return 'Tomorrow';
  return formatDate(date, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function AtlasHomePage() {
  const queryClient = useQueryClient();
  const [now, setNow] = useState(() => new Date());
  const [captureTitle, setCaptureTitle] = useState('');
  const today = getAtlasDate(now);
  const hour = Number(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Lagos', hour: '2-digit', hourCycle: 'h23'
  }).format(now));
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const dateLabel = new Intl.DateTimeFormat('en-NG', {
    timeZone: 'Africa/Lagos', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  }).format(now);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const tasksQuery = useQuery({ queryKey: queryKeys.tasks, queryFn: () => api<HomeTask[]>('/tasks') });
  const goalsQuery = useQuery({ queryKey: queryKeys.goals, queryFn: () => api<HomeGoal[]>('/goals') });
  const sessionsQuery = useQuery({ queryKey: queryKeys.sessions, queryFn: () => api<FocusSession[]>('/sessions') });

  const addTask = useMutation({
    mutationFn: (title: string) => api<HomeTask>('/tasks', json('POST', { title, category: 'Personal' })),
    onSuccess: () => {
      setCaptureTitle('');
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks });
      void queryClient.invalidateQueries({ queryKey: queryKeys.overview });
    }
  });
  const toggleTask = useMutation({
    mutationFn: (task: HomeTask) => api<HomeTask>('/tasks/' + task.id, json('PATCH', { done: !task.done })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks });
      void queryClient.invalidateQueries({ queryKey: queryKeys.overview });
    }
  });

  const tasks = tasksQuery.data || [];
  const goals = goalsQuery.data || [];
  const activeTasks = useMemo(() => tasks.filter(task => !task.done).sort((a, b) => {
    const priorityDifference = (a.priority ?? 3) - (b.priority ?? 3);
    if (priorityDifference) return priorityDifference;
    if (!a.due_date && !b.due_date) return a.id - b.id;
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return a.due_date.localeCompare(b.due_date) || a.id - b.id;
  }), [tasks]);
  const overdueTasks = activeTasks.filter(task => !!task.due_date && task.due_date < today);
  const todayTasks = activeTasks.filter(task => task.due_date === today);
  const activeGoals = goals.filter(goal => goal.status === 'active');
  const weekStart = useMemo(() => {
    const start = new Date(today + 'T12:00:00');
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    return getAtlasDate(start);
  }, [today]);
  const focusMinutes = (sessionsQuery.data || [])
    .filter(session => session.session_date >= weekStart && session.session_date <= today && session.session_kind !== 'break')
    .reduce((total, session) => total + (Number(session.minutes) || 0), 0);
  const nextTask = activeTasks[0];
  const nextGoal = activeGoals[0];
  const completedCount = tasks.filter(task => !!task.done).length;
  const loading = tasksQuery.isLoading || goalsQuery.isLoading || sessionsQuery.isLoading;
  const queryError = tasksQuery.isError || goalsQuery.isError || sessionsQuery.isError;

  function submitCapture(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = captureTitle.trim();
    if (title && !addTask.isPending) addTask.mutate(title);
  }

  return (
    <main className="atlas-dashboard">
      <header className="atlas-dashboard__masthead">
        <div className="atlas-dashboard__intro">
          <span className="atlas-dashboard__date"><span className="atlas-dashboard__date-dot" />{dateLabel}</span>
          <h1>{greeting}<br /><em>make today matter.</em></h1>
          <p>A calmer place to decide what deserves your attention—and take the next step.</p>
        </div>
        <div className="atlas-dashboard__masthead-side">
          <span className="atlas-dashboard__private"><span />YOUR SPACE, YOUR PACE</span>
          <Link to="/blueprint" className="atlas-dashboard__blueprint-link">Life blueprint <ArrowUpRight size={15} /></Link>
        </div>
      </header>

      {queryError && <div className="atlas-dashboard__notice" role="alert">Some information couldn't be loaded. Refresh to try again.</div>}

      <section className="atlas-dashboard__hero" aria-label="Your next move">
        <div className="atlas-dashboard__hero-copy">
          <span className="atlas-dashboard__kicker"><Sparkles size={13} /> THE NEXT MOVE</span>
          {loading ? (
            <><h2>Finding your next step…</h2><p>Your workspace is coming into view.</p></>
          ) : nextTask ? (
            <>
              <h2>{nextTask.title}</h2>
              <p>{nextTask.detail || nextTask.project_title || nextTask.goal_title || 'One clear action. Give it your attention, then decide what comes next.'}</p>
              <div className="atlas-dashboard__hero-meta">
                <span>{dueLabel(nextTask.due_date, today)}</span>
                <span>{nextTask.category || 'Personal'}</span>
              </div>
              <div className="atlas-dashboard__hero-actions">
                <Link to={'/focus?task=' + nextTask.id} className="atlas-dashboard__primary-action"><Timer size={15} /> Start a focus session <ArrowRight size={15} /></Link>
                <button type="button" className="atlas-dashboard__complete-action" disabled={toggleTask.isPending} onClick={() => toggleTask.mutate(nextTask)}><Check size={15} /> Mark complete</button>
              </div>
            </>
          ) : (
            <>
              <h2>Choose what matters next.</h2>
              <p>There’s space in your day. Add a small action or reconnect with a goal you care about.</p>
              <div className="atlas-dashboard__hero-actions"><Link to="/goals" className="atlas-dashboard__primary-action">Explore your goals <ArrowRight size={15} /></Link></div>
            </>
          )}
        </div>
        <div className="atlas-dashboard__hero-art" aria-hidden="true">
          <div className="atlas-dashboard__orbit atlas-dashboard__orbit--one" />
          <div className="atlas-dashboard__orbit atlas-dashboard__orbit--two" />
          <div className="atlas-dashboard__orbit atlas-dashboard__orbit--three" />
          <div className="atlas-dashboard__orbit-core"><span>01</span><small>ONE STEP<br />AT A TIME</small></div>
          <span className="atlas-dashboard__orbit-point atlas-dashboard__orbit-point--a" />
          <span className="atlas-dashboard__orbit-point atlas-dashboard__orbit-point--b" />
          <span className="atlas-dashboard__orbit-point atlas-dashboard__orbit-point--c" />
        </div>
      </section>

      <section className="atlas-dashboard__workbench">
        <div className="atlas-dashboard__actions">
          <div className="atlas-dashboard__section-head">
            <div><span className="atlas-dashboard__overline">THE DAY, IN MOTION</span><h2>Your open loops</h2></div>
            <Link to="/actions" aria-label="Open all actions" className="atlas-dashboard__round-link"><ArrowUpRight size={17} /></Link>
          </div>
          <div className="atlas-dashboard__action-summary">
            <span>{loading ? '—' : activeTasks.length + ' open'}</span>
            {overdueTasks.length > 0 && <span className="atlas-dashboard__attention">{overdueTasks.length} to reschedule</span>}
            {todayTasks.length > 0 && <span>{todayTasks.length} due today</span>}
          </div>
          {loading ? <div className="atlas-dashboard__skeleton"><i /><i /><i /></div> : activeTasks.length ? (
            <div className="atlas-dashboard__task-list">
              {activeTasks.slice(0, 5).map(task => (
                <article className="atlas-dashboard__task" key={task.id}>
                  <button type="button" aria-label={'Complete ' + task.title} className="atlas-dashboard__task-check" disabled={toggleTask.isPending} onClick={() => toggleTask.mutate(task)}><Circle size={19} /></button>
                  <div className="atlas-dashboard__task-main"><strong>{task.title}</strong><span>{task.project_title || task.goal_title || task.category || 'Personal action'}</span></div>
                  <span className={'atlas-dashboard__task-date ' + (task.due_date && task.due_date < today ? 'is-overdue' : '')}>{dueLabel(task.due_date, today)}</span>
                </article>
              ))}
            </div>
          ) : (
            <div className="atlas-dashboard__empty"><span><Check size={17} /></span><strong>All clear for now.</strong><p>Keep the space open, or add a new action when something matters.</p></div>
          )}
          <form className="atlas-dashboard__capture" onSubmit={submitCapture}>
            <Plus size={17} />
            <input aria-label="Capture an action" placeholder="Get it out of your head…" value={captureTitle} maxLength={180} onChange={event => setCaptureTitle(event.target.value)} />
            <button type="submit" disabled={!captureTitle.trim() || addTask.isPending}>{addTask.isPending ? 'Saving…' : 'Capture'}</button>
          </form>
          {addTask.isError && <p className="atlas-dashboard__error" role="alert">{addTask.error.message}</p>}
          {toggleTask.isError && <p className="atlas-dashboard__error" role="alert">{toggleTask.error.message}</p>}
        </div>

        <aside className="atlas-dashboard__side">
          <article className="atlas-dashboard__direction">
            <div className="atlas-dashboard__section-head"><div><span className="atlas-dashboard__overline">THE BIGGER PICTURE</span><h2>What you're building</h2></div><Target size={18} /></div>
            {loading ? <div className="atlas-dashboard__skeleton"><i /></div> : nextGoal ? (
              <>
                <span className="atlas-dashboard__goal-category">{nextGoal.category || 'Current direction'}</span>
                <h3>{nextGoal.title}</h3>
                <p>{nextGoal.detail || 'Let the small actions connect to something meaningful.'}</p>
                <div className="atlas-dashboard__goal-foot"><span>{nextGoal.completed_tasks || 0} of {nextGoal.linked_tasks || 0} linked actions</span>{nextGoal.target_date && <span>By {formatDate(nextGoal.target_date)}</span>}</div>
                {(nextGoal.linked_tasks || 0) > 0 && <div className="atlas-dashboard__progress"><span style={{ width: Math.min(100, Math.round(((nextGoal.completed_tasks || 0) / (nextGoal.linked_tasks || 1)) * 100)) + '%' }} /></div>}
                <Link to="/goals" className="atlas-dashboard__text-link">Open direction <ArrowRight size={14} /></Link>
              </>
            ) : (
              <div className="atlas-dashboard__empty atlas-dashboard__empty--small"><strong>Start with a direction.</strong><p>Choose one outcome you would be glad to move towards.</p><Link to="/goals">Create a goal <ArrowRight size={14} /></Link></div>
            )}
          </article>
          <Link to="/calendar" className="atlas-dashboard__calendar">
            <span className="atlas-dashboard__calendar-icon"><CalendarDays size={18} /></span>
            <span><small>MAKE ROOM FOR IT</small><strong>Shape your time</strong><em>Open calendar <ArrowRight size={13} /></em></span>
            <ArrowUpRight className="atlas-dashboard__calendar-arrow" size={17} />
          </Link>
        </aside>
      </section>

      <section className="atlas-dashboard__signals">
        <div className="atlas-dashboard__signals-heading"><span className="atlas-dashboard__overline">A LITTLE PERSPECTIVE</span><h2>Notice what’s moving.</h2><p>Evidence of effort, not a measure of your worth.</p></div>
        <div className="atlas-dashboard__signal"><span className="atlas-dashboard__signal-icon"><Clock3 size={16} /></span><strong>{loading ? '—' : formatMinutes(focusMinutes)}</strong><small>Focused this week</small></div>
        <div className="atlas-dashboard__signal"><span className="atlas-dashboard__signal-icon"><Check size={16} /></span><strong>{loading ? '—' : completedCount}</strong><small>Actions completed</small></div>
        <div className="atlas-dashboard__signal"><span className="atlas-dashboard__signal-icon"><TrendingUp size={16} /></span><strong>{loading ? '—' : activeGoals.length}</strong><small>Directions in motion</small></div>
      </section>
    </main>
  );
}