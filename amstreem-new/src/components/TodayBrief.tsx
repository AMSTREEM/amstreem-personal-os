import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CalendarClock, Check, Circle, Flag, Goal, ListTodo, RefreshCw, Clock3, Sprout } from 'lucide-react';
import { supabase } from '../lib/supabase';

type Item = {
  id: string; kind: 'goal' | 'project' | 'task'; title: string;
  status: 'active' | 'completed' | 'archived'; priority: 'low' | 'normal' | 'high';
  due_date: string | null; parent_id: string | null;
};
type ScheduleEntry = { id:string; title:string; start_time:string; end_time:string; recurring:boolean };
type Habit = { id:string; title:string; weekdays:number[] };
type HabitEntry = { habit_id:string };

const localDate = (date: Date) => {
  const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, '0'); const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const labelDate = (value: string) => new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(value + 'T12:00:00'));
const timeLabel = (value:string) => new Intl.DateTimeFormat(undefined,{hour:'numeric',minute:'2-digit'}).format(new Date('2000-01-01T'+value.slice(0,5)+':00'));

export default function TodayBrief({ onOpenPlans }: { onOpenPlans: () => void }) {
  const [items, setItems] = useState<Item[]>([]);
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitEntries, setHabitEntries] = useState<HabitEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const today = localDate(new Date());
  const weekday = new Date().getDay();

  const load = async () => {
    if (!supabase) { setLoading(false); return; }
    setLoading(true);
    const [lifeResult, blockResult, routineResult, habitResult, entryResult] = await Promise.all([
      supabase.from('life_items').select('id,kind,title,status,priority,due_date,parent_id').neq('status', 'archived'),
      supabase.from('time_blocks').select('id,title,start_time,end_time').eq('block_date', today).order('start_time'),
      supabase.from('routine_templates').select('id,title,start_time,end_time,weekdays').eq('active', true),
      supabase.from('habits').select('id,title,weekdays').eq('active', true),
      supabase.from('habit_entries').select('habit_id').eq('entry_date', today),
    ]);
    const firstError = lifeResult.error || blockResult.error || routineResult.error || habitResult.error || entryResult.error;
    if (firstError) setError('Some parts of your day could not be loaded: ' + firstError.message);
    else {
      setItems((lifeResult.data || []) as Item[]);
      const blocks = (blockResult.data || []).map((b:any)=>({...b,recurring:false}));
      const routines = (routineResult.data || []).filter((r:any)=>r.weekdays.includes(weekday)).map((r:any)=>({...r,recurring:true}));
      setSchedule([...blocks,...routines].sort((a,b)=>a.start_time.localeCompare(b.start_time)) as ScheduleEntry[]);
      setHabits((habitResult.data || []) as Habit[]);
      setHabitEntries((entryResult.data || []) as HabitEntry[]);
      setError('');
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const weekEndDate = new Date(); weekEndDate.setDate(weekEndDate.getDate() + 7);
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
  const plannedHabits = habits.filter(habit=>habit.weekdays.includes(weekday));
  const completedHabitIds = new Set(habitEntries.map(entry=>entry.habit_id));
  const nextBlock = schedule.find(block=>block.end_time.slice(0,5)>new Date().toTimeString().slice(0,5));

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
          <div className="today-rhythm">
            <div className="today-rhythm-head"><div><span className="kicker">YOUR DAY, IN CONTEXT</span><h3>Today's rhythm</h3></div><span>{schedule.length} planned blocks</span></div>
            <div className="today-rhythm-grid">
              <div className="today-rhythm-column"><div className="today-rhythm-label"><Clock3 size={13}/> SCHEDULE</div>
                {schedule.length ? schedule.slice(0,4).map(block=><div className="today-rhythm-item" key={block.id}><strong>{block.title}</strong><span>{timeLabel(block.start_time)} – {timeLabel(block.end_time)}{block.recurring?' · ROUTINE':''}</span></div>):<p className="today-rhythm-empty">No time blocks or routines planned today.</p>}
                {nextBlock&&<p className="today-rhythm-next">Next upcoming: <strong>{nextBlock.title}</strong></p>}
              </div>
              <div className="today-rhythm-column"><div className="today-rhythm-label"><Sprout size={13}/> HABITS</div>
                {plannedHabits.length ? <><div className="today-habit-count"><strong>{plannedHabits.filter(h=>completedHabitIds.has(h.id)).length}</strong><span>of {plannedHabits.length} planned check-ins recorded</span></div><div className="today-habit-list">{plannedHabits.slice(0,4).map(h=><span key={h.id} className={completedHabitIds.has(h.id)?'recorded':''}>{completedHabitIds.has(h.id)?'✓':'○'} {h.title}</span>)}</div></>:<p className="today-rhythm-empty">No habits scheduled for today.</p>}
              </div>
            </div>
            <p className="today-rhythm-note">This shows what you've planned and recorded here—not everything happening in your life.</p>
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
