import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, CalendarDays, Check, Circle, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import DailySchedule from './DailySchedule';

type Task = {
  id: string;
  title: string;
  description: string;
  status: 'active' | 'completed' | 'archived';
  priority: 'low' | 'normal' | 'high';
  due_date: string | null;
  parent_id: string | null;
};

const toDateKey = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};
const dateLabel = (date: Date, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(undefined, options).format(date);

export default function PlanningWorkspace({ onOpenPlans, userId }: { onOpenPlans: () => void; userId: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [weekOffset, setWeekOffset] = useState(0);
  const [busyId, setBusyId] = useState('');

  const load = async () => {
    if (!supabase) { setLoading(false); return; }
    setLoading(true);
    const { data, error: queryError } = await supabase.from('life_items')
      .select('id,title,description,status,priority,due_date,parent_id')
      .eq('kind', 'task').neq('status', 'archived');
    if (queryError) setError('Your plan could not be loaded. ' + queryError.message);
    else { setTasks((data || []) as Task[]); setError(''); }
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const today = new Date();
  const weekStart = useMemo(() => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - ((date.getDay() + 6) % 7) + weekOffset * 7);
    return date;
  }, [weekOffset]);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + index);
    return date;
  });
  const startKey = toDateKey(days[0]);
  const endKey = toDateKey(days[6]);
  const todayKey = toDateKey(today);
  const active = tasks.filter(task => task.status === 'active');
  const completed = tasks.filter(task => task.status === 'completed');
  const overdue = active.filter(task => task.due_date && task.due_date < startKey);
  const unscheduled = active.filter(task => !task.due_date);
  const datedThisWeek = tasks.filter(task => task.due_date && task.due_date >= startKey && task.due_date <= endKey);
  const weekLabel = weekOffset === 0
    ? 'This week'
    : weekOffset === 1 ? 'Next week'
    : weekOffset === -1 ? 'Last week'
    : `${dateLabel(days[0], { month: 'short', day: 'numeric' })} — ${dateLabel(days[6], { month: 'short', day: 'numeric' })}`;

  const moveTask = async (task: Task, nextDate: string) => {
    if (!supabase || busyId) return;
    setBusyId(task.id);
    const { error: updateError } = await supabase.from('life_items').update({ due_date: nextDate || null }).eq('id', task.id);
    if (updateError) setError('Could not move that task. ' + updateError.message);
    else { setTasks(current => current.map(row => row.id === task.id ? { ...row, due_date: nextDate || null } : row)); setError(''); }
    setBusyId('');
  };

  const toggleTask = async (task: Task) => {
    if (!supabase || busyId) return;
    setBusyId(task.id);
    const status = task.status === 'completed' ? 'active' : 'completed';
    const { error: updateError } = await supabase.from('life_items').update({ status }).eq('id', task.id);
    if (updateError) setError('Could not update that task. ' + updateError.message);
    else { setTasks(current => current.map(row => row.id === task.id ? { ...row, status } : row)); setError(''); }
    setBusyId('');
  };

  const renderTask = (task: Task) => (
    <article className={`plan-task ${task.status === 'completed' ? 'is-complete' : ''}`} key={task.id}>
      <button className="plan-task-check" onClick={() => void toggleTask(task)} disabled={busyId === task.id} aria-label={task.status === 'completed' ? 'Reopen task' : 'Complete task'}>
        {task.status === 'completed' ? <Check size={15}/> : <Circle size={16}/>}
      </button>
      <div className="plan-task-main"><strong>{task.title}</strong>{task.description && <span>{task.description}</span>}</div>
      {task.priority === 'high' && <span className="plan-priority">HIGH</span>}
      <input aria-label={`Schedule ${task.title}`} type="date" value={task.due_date || ''} disabled={busyId === task.id} onChange={event => void moveTask(task, event.target.value)} />
    </article>
  );

  return (
    <section className="planning-workspace">
      <DailySchedule userId={userId} />
      <div className="planning-heading">
        <div><span className="kicker">YOUR TIME, WITH ROOM TO BREATHE</span><h2>Make space for what matters.</h2><p>A simple weekly view of the tasks you have chosen to schedule. Change dates as life changes.</p></div>
        <button className="today-refresh" onClick={() => void load()} aria-label="Refresh weekly plan"><RefreshCw size={15}/></button>
      </div>
      <div className="planning-summary">
        <div><strong>{active.length}</strong><span>OPEN TASKS</span></div>
        <div><strong>{datedThisWeek.filter(task => task.status === 'active').length}</strong><span>THIS WEEK</span></div>
        <div><strong>{overdue.length}</strong><span>PAST DUE</span></div>
        <div><strong>{completed.length}</strong><span>COMPLETED</span></div>
      </div>
      <div className="planning-weekbar">
        <div><span className="kicker">WEEKLY OVERVIEW</span><h3>{weekLabel}</h3></div>
        <div className="planning-week-controls">
          <button onClick={() => setWeekOffset(value => value - 1)} aria-label="Previous week"><ArrowLeft size={15}/></button>
          <button onClick={() => setWeekOffset(0)}>Today</button>
          <button onClick={() => setWeekOffset(value => value + 1)} aria-label="Next week"><ArrowRight size={15}/></button>
        </div>
      </div>
      {error && <div className="life-error" role="alert">{error}</div>}
      {loading ? <div className="life-empty">Gathering your week…</div> : (
        <>
          <div className="planning-days">
            {days.map(date => {
              const key = toDateKey(date);
              const dayTasks = tasks.filter(task => task.due_date === key);
              return <section className={`planning-day ${key === todayKey ? 'is-today' : ''}`} key={key}>
                <div className="planning-day-head"><span>{dateLabel(date, { weekday: 'short' })}</span><strong>{dateLabel(date, { day: 'numeric' })}</strong><small>{dayTasks.length} {dayTasks.length === 1 ? 'item' : 'items'}</small></div>
                <div className="planning-day-list">{dayTasks.length ? dayTasks.map(renderTask) : <span className="planning-day-empty">Nothing scheduled</span>}</div>
              </section>;
            })}
          </div>
          <div className="planning-backlog-grid">
            <section className="planning-backlog"><div className="planning-backlog-head"><div><span className="kicker">NEEDS A NEW DATE</span><h3>Past due</h3></div><span>{overdue.length}</span></div>{overdue.length ? overdue.map(renderTask) : <p className="planning-empty-copy">No overdue tasks. Good.</p>}</section>
            <section className="planning-backlog"><div className="planning-backlog-head"><div><span className="kicker">WHEN YOU'RE READY</span><h3>Unscheduled</h3></div><span>{unscheduled.length}</span></div>{unscheduled.length ? unscheduled.slice(0, 8).map(renderTask) : <p className="planning-empty-copy">Every open task has a date, or is complete.</p>}{unscheduled.length > 8 && <p className="planning-empty-copy">And {unscheduled.length - 8} more. Open your projects to review them.</p>}</section>
          </div>
          <div className="planning-footer"><span><CalendarDays size={14}/> Dates are planning guides, not promises.</span><button onClick={onOpenPlans}>Manage goals and tasks <ArrowRight size={14}/></button></div>
        </>
      )}
    </section>
  );
}
