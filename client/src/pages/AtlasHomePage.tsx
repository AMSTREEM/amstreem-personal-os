import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, CalendarDays, Check, Circle, Clock3, Plus, Sparkles, Target, Timer, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, json } from '../lib/api';
import './atlas-home.css';

type HomeTask = {
  id: number;
  title: string;
  detail?: string;
  due_date: string | null;
  done: number;
  priority?: number;
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

type HomeOverview = {
  today: string;
  todayMin: number;
  weekMin: number;
  completed: number;
  moduleTotal: number;
  streak: number;
  dailyTarget: number;
  openTasks: number;
};

type FocusSession = {
  session_date: string;
  minutes: number;
  session_kind?: string;
};

function getAtlasDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
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
  if (!date) return 'No due date';
  if (date < today) return 'Overdue';
  if (date === today) return 'Due today';
  const tomorrow = new Date(today + 'T12:00:00');
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (date === getAtlasDate(tomorrow)) return 'Tomorrow';
  return 'Due ' + formatDate(date);
}

export function AtlasHomePage() {
  const queryClient = useQueryClient();
  const [now, setNow] = useState(() => new Date());
  const [captureTitle, setCaptureTitle] = useState('');
  const today = getAtlasDate(now);
  const hour = Number(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Lagos',
    hour: '2-digit',
    hourCycle: 'h23'
  }).format(now));
  const greeting = hour < 12 ? 'Good morning.' : hour < 17 ? 'Good afternoon.' : 'Good evening.';
  const dateLabel = new Intl.DateTimeFormat('en-NG', {
    timeZone: 'Africa/Lagos',
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  }).format(now);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const tasksQuery = useQuery({ queryKey: ['tasks'], queryFn: () => api<HomeTask[]>('/tasks') });
  const goalsQuery = useQuery({ queryKey: ['goals'], queryFn: () => api<HomeGoal[]>('/goals') });
  const overviewQuery = useQuery({ queryKey: ['overview'], queryFn: () => api<HomeOverview>('/overview') });
  const sessionsQuery = useQuery({ queryKey: ['sessions'], queryFn: () => api<FocusSession[]>('/sessions') });

  const addTask = useMutation({
    mutationFn: (title: string) => api<HomeTask>('/tasks', json('POST', { title, category: 'Personal' })),
    onSuccess: () => {
      setCaptureTitle('');
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
      void queryClient.invalidateQueries({ queryKey: ['overview'] });
    }
  });

  const toggleTask = useMutation({
    mutationFn: (task: HomeTask) => api<HomeTask>('/tasks/' + task.id, json('PATCH', { done: !task.done })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
      void queryClient.invalidateQueries({ queryKey: ['overview'] });
    }
  });

  const tasks = tasksQuery.data || [];
  const goals = goalsQuery.data || [];
  const activeTasks = useMemo(() => tasks
    .filter(task => !task.done)
    .sort((a, b) => {
      const priorityDifference = (a.priority ?? 3) - (b.priority ?? 3);
      if (priorityDifference) return priorityDifference;
      if (!a.due_date && !b.due_date) return a.id - b.id;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return a.due_date.localeCompare(b.due_date) || a.id - b.id;
    }), [tasks]);
  const todayTasks = tasks.filter(task => !task.done && task.due_date === today);
  const overdueTasks = tasks.filter(task => !task.done && !!task.due_date && task.due_date < today);
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
  const loading = tasksQuery.isLoading || goalsQuery.isLoading || sessionsQuery.isLoading;
  const queryError = tasksQuery.isError || goalsQuery.isError || sessionsQuery.isError;

  function submitCapture(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = captureTitle.trim();
    if (title && !addTask.isPending) addTask.mutate(title);
  }

  return (
    <main className="atlas-home page-container">
      <header className="atlas-home__header">
        <div>
          <span className="atlas-home__eyebrow">{dateLabel}</span>
          <h1>{greeting}</h1>
          <p>Your life is bigger than your to-do list. Let's move something meaningful forward.</p>
        </div>
        <Link className="atlas-home__quiet-link" to="/settings">Workspace settings <ArrowRight size={14} /></Link>
      </header>

      {queryError && (
        <div className="atlas-home__notice" role="alert">
          Some workspace information couldn't be loaded. Refresh the page to try again.
        </div>
      )}

      <section className="atlas-home__hero-grid" aria-label="Your direction and current progress">
        <div className="atlas-home__hero">
          <div className="atlas-home__hero-top">
            <span className="atlas-home__eyebrow">YOUR DIRECTION</span>
            <span className="atlas-home__hero-mark"><Sparkles size={17} /></span>
          </div>
          <h2>Build a life with intention.</h2>
          <p>Choose what matters, give it your attention, and let the small steps add up.</p>
          <div className="atlas-home__hero-actions">
            <Link className="atlas-home__gold-button" to="/goals">Explore your goals <ArrowRight size={15} /></Link>
            <Link className="atlas-home__text-button" to="/growth">See your growth</Link>
          </div>
          <div className="atlas-home__hero-orbit" aria-hidden="true"><span /><span /><span /></div>
        </div>

        <div className="atlas-home__metrics">
          <article className="atlas-home__metric">
            <span className="atlas-home__metric-icon"><Target size={16} /></span>
            <span className="atlas-home__metric-label">Active goals</span>
            <strong>{loading ? '—' : activeGoals.length}</strong>
            <small>{activeGoals.length === 1 ? 'One direction in motion' : 'Your current directions'}</small>
          </article>
          <article className="atlas-home__metric">
            <span className="atlas-home__metric-icon"><Check size={16} /></span>
            <span className="atlas-home__metric-label">Open actions</span>
            <strong>{loading ? '—' : activeTasks.length}</strong>
            <small>{overdueTasks.length ? overdueTasks.length + ' need rescheduling or attention' : todayTasks.length + ' due today'}</small>
          </article>
          <article className="atlas-home__metric atlas-home__metric--wide">
            <span className="atlas-home__metric-icon"><Timer size={16} /></span>
            <span className="atlas-home__metric-label">Focused work this week</span>
            <strong>{loading ? '—' : formatMinutes(focusMinutes)}</strong>
            <small>Recorded focus sessions, Monday to today</small>
          </article>
        </div>
      </section>

      <section className="atlas-home__work-grid">
        <div className="atlas-home__panel atlas-home__next-panel">
          <div className="atlas-home__section-heading">
            <div>
              <span className="atlas-home__eyebrow">MAKE PROGRESS</span>
              <h2>Your next actions</h2>
            </div>
            <Link to="/actions" className="atlas-home__icon-link" aria-label="View all actions"><ArrowRight size={17} /></Link>
          </div>

          {loading ? (
            <div className="atlas-home__skeleton-list"><span /><span /><span /></div>
          ) : activeTasks.length ? (
            <div className="atlas-home__task-list">
              {activeTasks.slice(0, 4).map(task => (
                <article className="atlas-home__task" key={task.id}>
                  <button
                    type="button"
                    className="atlas-home__task-check"
                    aria-label={'Complete ' + task.title}
                    disabled={toggleTask.isPending}
                    onClick={() => toggleTask.mutate(task)}
                  ><Circle size={19} /></button>
                  <div className="atlas-home__task-copy">
                    <strong>{task.title}</strong>
                    <span>{task.project_title || task.goal_title || task.category || 'Personal action'}</span>
                  </div>
                  <span className={'atlas-home__due ' + (task.due_date && task.due_date < today ? 'is-overdue' : '')}>{dueLabel(task.due_date, today)}</span>
                </article>
              ))}
            </div>
          ) : (
            <div className="atlas-home__empty">
              <span className="atlas-home__empty-mark"><Check size={18} /></span>
              <strong>Nothing demanding your attention.</strong>
              <p>You have room to choose what deserves your attention next.</p>
              <Link to="/goals">Review your goals <ArrowRight size={14} /></Link>
            </div>
          )}

          <form className="atlas-home__capture" onSubmit={submitCapture}>
            <Plus size={17} />
            <input
              aria-label="Capture a task"
              placeholder="Capture something you need to do…"
              value={captureTitle}
              maxLength={180}
              onChange={event => setCaptureTitle(event.target.value)}
            />
            <button type="submit" disabled={!captureTitle.trim() || addTask.isPending}>{addTask.isPending ? 'Saving…' : 'Add'}</button>
          </form>
          {addTask.isError && <p className="atlas-home__inline-error" role="alert">{addTask.error.message}</p>}
          {toggleTask.isError && <p className="atlas-home__inline-error" role="alert">{toggleTask.error.message}</p>}
        </div>

        <div className="atlas-home__side-stack">
          <article className="atlas-home__panel atlas-home__continue">
            <div className="atlas-home__section-heading">
              <div>
                <span className="atlas-home__eyebrow">CONTINUE BUILDING</span>
                <h2>Your current direction</h2>
              </div>
              <Target size={18} />
            </div>
            {loading ? <div className="atlas-home__skeleton-block" /> : nextGoal ? (
              <>
                <h3>{nextGoal.title}</h3>
                <p>{nextGoal.detail || 'Keep this outcome connected to the work you do each day.'}</p>
                <div className="atlas-home__goal-meta">
                  <span>{nextGoal.linked_tasks || 0} linked actions</span>
                  {nextGoal.target_date && <span>Target {formatDate(nextGoal.target_date)}</span>}
                </div>
                {(nextGoal.linked_tasks || 0) > 0 && (
                  <div className="atlas-home__progress-track" aria-label={(nextGoal.completed_tasks || 0) + ' of ' + nextGoal.linked_tasks + ' linked tasks complete'}>
                    <span style={{ width: Math.min(100, Math.round(((nextGoal.completed_tasks || 0) / (nextGoal.linked_tasks || 1)) * 100)) + '%' }} />
                  </div>
                )}
                <Link to="/goals" className="atlas-home__panel-link">Open goal <ArrowRight size={14} /></Link>
              </>
            ) : (
              <div className="atlas-home__empty atlas-home__empty--compact">
                <strong>Give your effort a direction.</strong>
                <p>Create one goal that would make a meaningful difference to you.</p>
                <Link to="/goals">Create a goal <ArrowRight size={14} /></Link>
              </div>
            )}
          </article>

          <article className="atlas-home__panel atlas-home__focus-card">
            <div className="atlas-home__focus-icon"><Clock3 size={18} /></div>
            <div>
              <span className="atlas-home__eyebrow">PROTECT YOUR ATTENTION</span>
              <h2>Make space for focused work.</h2>
              <p>{nextTask ? 'Continue with “' + nextTask.title + '” or choose another task.' : 'Start a session for something that matters to you.'}</p>
              <Link to={nextTask ? '/focus?task=' + nextTask.id : '/focus'}>Open Focus <ArrowRight size={14} /></Link>
            </div>
          </article>
        </div>
      </section>

      <section className="atlas-home__bottom-grid">
        <div className="atlas-home__panel atlas-home__week-panel">
          <div className="atlas-home__section-heading">
            <div>
              <span className="atlas-home__eyebrow">A CLEARER PICTURE</span>
              <h2>Your progress at a glance</h2>
            </div>
            <TrendingUp size={18} />
          </div>
          <div className="atlas-home__week-stats">
            <div><strong>{loading ? '—' : formatMinutes(focusMinutes)}</strong><span>Focused time</span></div>
            <div><strong>{loading ? '—' : tasks.filter(task => !!task.done).length}</strong><span>Completed actions</span></div>
            <div><strong>{loading ? '—' : activeGoals.length}</strong><span>Goals in motion</span></div>
          </div>
          <p className="atlas-home__footnote">A record of activity, not a score of your worth. Progress means different things in different areas of life.</p>
        </div>

        <div className="atlas-home__panel atlas-home__calendar-panel">
          <div className="atlas-home__section-heading">
            <div>
              <span className="atlas-home__eyebrow">MAKE ROOM</span>
              <h2>Give your time a shape</h2>
            </div>
            <CalendarDays size={18} />
          </div>
          <p>See your commitments, make space for important work, and adjust when life changes.</p>
          <Link to="/calendar" className="atlas-home__panel-link">Open your calendar <ArrowRight size={14} /></Link>
        </div>
      </section>
    </main>
  );
}
