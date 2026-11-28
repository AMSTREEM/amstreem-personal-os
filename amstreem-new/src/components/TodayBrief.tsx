import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CalendarClock, Check, Circle, Flag, Goal, ListTodo, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';

type Item = {
  id: string; kind: 'goal' | 'project' | 'task'; title: string;
  status: 'active' | 'completed' | 'archived'; priority: 'low' | 'normal' | 'high';
  due_date: string | null; parent_id: string | null;
};

const localDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const labelDate = (value: string) => new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(value + 'T12:00:00'));

export default function TodayBrief({ onOpenPlans }: { onOpenPlans: () => void }) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    if (!supabase) { setLoading(false); return; }
    setLoading(true);
    const { data, error: queryError } = await supabase.from('life_items').select('id,kind,title,status,priority,due_date,parent_id').neq('status', 'archived');
    if (queryError) setError('Your plans could not be loaded: ' + queryError.message);
    else { setItems((data || []) as Item[]); setError(''); }
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const today = localDate(new Date());
  const weekEndDate = new Date();
  weekEndDate.setDate(weekEndDate.getDate() + 7);
  const weekEnd = localDate(weekEndDate);
  const activeTasks = items.filter(item => item.kind === 'task' && item.status === 'active');
  const overdue = activeTasks.filter(item => item.due_date && item.due_date < today).sort((a,b) => a.due_date!.localeCompare(b.due_date!));
  const dueToday = activeTasks.filter(item => item.due_date === today);
  const comingUp = activeTasks.filter(item => item.due_date && item.due_date > today && item.due_date <= weekEnd).sort((a,b) => a.due_date!.localeCompare(b.due_date!));
  const undated = activeTasks.filter(item => !item.due_date);
  const focusTasks = [...overdue, ...dueToday, ...comingUp, ...undated].slice(0, 5);
  const goals = items.filter(item => item.kind === 'goal' && item.status === 'active');
  const projects = items.filter(item => item.kind === 'project' && item.status === 'active');
  const completedTasks = items.filter(item => item.kind === 'task' && item.status === 'completed').length;

  const markDone = async (item: Item) => {
    if (!supabase) return;
    const { error: updateError } = await supabase.from('life_items').update({ status: 'completed' }).eq('id', item.id);
    if (updateError) { setError('Could not complete that task: ' + updateError.message); return; }
    setItems(current => current.map(row => row.id === item.id ? { ...row, status: 'completed' } : row));
    setError('');
  };

  const sectionTitle = overdue.length ? 'Needs a little attention' : dueToday.length ? 'On the table today' : comingUp.length ? 'Coming into view' : 'Your next steps';

  return (
    <section className="today-brief">
      <div className="today-brief-head">
        <div><span className="kicker">A CLEARER VIEW OF YOUR DAY</span><h2>What matters <em>right now.</em></h2><p>A practical view of the plans you've chosen to keep.</p></div>
        <button className="today-refresh" onClick={() => void load()} aria-label="Refresh today's overview"><RefreshCw size={15}/></button>
      </div>
      {loading ? <div className="today-loading">Gathering your plans…</div> : error ? <div className="today-error">{error}</div> : (
        <>
          <div className="today-stats">
            <div><Goal size={16}/><strong>{goals.length}</strong><span>ACTIVE GOALS</span></div>
            <div><Flag size={16}/><strong>{projects.length}</strong><span>PROJECTS</span></div>
            <div><ListTodo size={16}/><strong>{activeTasks.length}</strong><span>OPEN TASKS</span></div>
            <div><Check size={16}/><strong>{completedTasks}</strong><span>DONE SO FAR</span></div>
          </div>
          <div className="today-focus">
            <div className="today-focus-title"><div><span className="kicker">YOUR ATTENTION</span><h3>{sectionTitle}</h3></div><span className="today-count">{focusTasks.length} {focusTasks.length === 1 ? 'NEXT STEP' : 'NEXT STEPS'}</span></div>
            {focusTasks.length ? <div className="today-task-list">{focusTasks.map(item => {
              const dueLabel = item.due_date ? item.due_date < today ? 'Overdue · ' + labelDate(item.due_date) : item.due_date === today ? 'Due today' : labelDate(item.due_date) : 'No date set';
              const parent = item.parent_id ? items.find(row => row.id === item.parent_id) : null;
              return <article className="today-task" key={item.id}>
                <button className="today-task-check" onClick={() => void markDone(item)} aria-label={`Complete ${item.title}`}><Circle size={17}/></button>
                <div className="today-task-copy"><strong>{item.title}</strong><span>{dueLabel}{parent ? ' · ' + parent.title : ''}</span></div>
                {item.priority === 'high' && <span className="today-priority">HIGH</span>}
              </article>;
            })}</div> : <div className="today-clear"><Check size={18}/><div><strong>Nothing pressing in your task list.</strong><span>{goals.length || projects.length ? 'Your bigger plans are here whenever you want to move them forward.' : 'Add a goal or task when something matters enough to make room for it.'}</span></div></div>}
            {undated.length > 5 && <p className="today-more">{undated.length - Math.max(0, 5 - overdue.length - dueToday.length - comingUp.length)} more tasks have no due date.</p>}
          </div>
          <div className="today-brief-foot"><span><CalendarClock size={13}/> {overdue.length ? `${overdue.length} overdue` : dueToday.length ? `${dueToday.length} due today` : comingUp.length ? `${comingUp.length} due this week` : 'No dated tasks demanding attention'}</span><button onClick={onOpenPlans}>Open your plans <ArrowRight size={14}/></button></div>
        </>
      )}
    </section>
  );
}
