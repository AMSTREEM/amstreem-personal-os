import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, CalendarDays, Check, Clock3, Flame, Target } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, json } from '../lib/api';
import { Button, Card, EmptyState, PageHeader, Stat } from '../components/ui';

type Task = { id: number; title: string; detail: string; due_date: string | null; done: number };
type Habit = { id: number; title: string; emoji: string; done: number };
type Overview = { today: string; todayMin: number; weekMin: number; completed: number; moduleTotal: number; streak: number; dailyTarget: number; openTasks: number };
type Insight = { recommendation: { title: string; detail: string; reason: string; action: string; destination: string; priority: string }; pattern: string; rhythm: string | null };

function todayKey() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export function TodayPage() {
  const client = useQueryClient();
  const today = todayKey();
  const overview = useQuery({ queryKey: ['overview'], queryFn: () => api<Overview>('/overview') });
  const tasks = useQuery({ queryKey: ['tasks'], queryFn: () => api<Task[]>('/tasks') });
  const habits = useQuery({ queryKey: ['habits', today], queryFn: () => api<Habit[]>('/habits?date=' + today) });
  const insight = useQuery({ queryKey: ['intelligence'], queryFn: () => api<Insight>('/intelligence') });
  const toggleTask = useMutation({
    mutationFn: (task: Task) => api<Task>('/tasks/' + task.id, json('PATCH', { done: !task.done })),
    onSuccess: () => { void client.invalidateQueries({ queryKey: ['tasks'] }); void client.invalidateQueries({ queryKey: ['overview'] }); }
  });
  const toggleHabit = useMutation({
    mutationFn: (habit: Habit) => api('/habits/' + habit.id + '/toggle', json('POST', { date: today })),
    onSuccess: () => { void client.invalidateQueries({ queryKey: ['habits', today] }); }
  });
  const openTasks = (tasks.data || []).filter(task => !task.done).slice(0, 5);
  const nextDestination = insight.data?.recommendation.destination === 'habit' ? '/rituals' : '/' + (insight.data?.recommendation.destination || 'tasks');

  return <div className="stack">
    <PageHeader eyebrow={new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date()).toUpperCase()} title="Make today count." description="A clear view of what matters now, without the noise." action={<Link className="button button--secondary" to="/calendar"><CalendarDays size={16} /> Open calendar</Link>} />
    <div className="stat-grid">
      <Stat label="FOCUS TODAY" value={overview.data ? overview.data.todayMin + 'm' : '—'} note={overview.data ? 'of ' + overview.data.dailyTarget + 'm intention' : 'Loading activity'} icon={<Clock3 size={16} />} />
      <Stat label="THIS WEEK" value={overview.data ? Math.round(overview.data.weekMin / 60 * 10) / 10 + 'h' : '—'} note="Time invested in focus" icon={<Flame size={16} />} />
      <Stat label="OPEN TASKS" value={overview.data?.openTasks ?? '—'} note="Things still in motion" icon={<Check size={16} />} />
      <Stat label="LEARNING" value={overview.data ? overview.data.completed + '/' + overview.data.moduleTotal : '—'} note="Lessons completed" icon={<Target size={16} />} />
    </div>
    <div className="content-grid">
      <div className="stack">
        <Card>
          <div className="card-heading"><div><h2>Your next step</h2><p>One useful move, chosen from your actual workspace.</p></div><span className="eyebrow">ATLAS NOTE</span></div>
          {insight.data?.recommendation ? <div className="recommendation"><div className="recommendation__priority">{insight.data.recommendation.priority} priority</div><h3>{insight.data.recommendation.title}</h3><p className="recommendation__detail">{insight.data.recommendation.detail}</p><p className="recommendation__reason">{insight.data.recommendation.reason}</p><Link className="text-link" to={nextDestination}>{insight.data.recommendation.action} <ArrowRight size={14} /></Link></div> : <EmptyState title="Your next step is taking shape." detail="Atlas will surface a useful action when your workspace has enough activity." />}
        </Card>
        <Card>
          <div className="card-heading"><div><h2>Today's priorities</h2><p>Keep the list short. Move the important work forward.</p></div><Link className="text-link" to="/tasks">All tasks <ArrowRight size={14} /></Link></div>
          {openTasks.length ? <div className="list-stack">{openTasks.map(task => <div className="list-row" key={task.id}><input className="check-control" type="checkbox" checked={!!task.done} onChange={() => toggleTask.mutate(task)} aria-label={'Complete ' + task.title} /><div className="list-row__body"><b>{task.title}</b>{task.detail && <small>{task.detail}</small>}</div><span className="list-row__meta">{task.due_date || 'No date'}</span></div>)}</div> : <EmptyState title="Nothing pressing." detail="Your open priorities will appear here. You can use the breathing room." />}
        </Card>
      </div>
      <div className="stack">
        <Card>
          <div className="card-heading"><div><h2>Daily rituals</h2><p>Small practices you chose to keep.</p></div><Link className="text-link" to="/rituals">Manage <ArrowRight size={14} /></Link></div>
          {habits.data?.length ? <div className="list-stack">{habits.data.map(habit => <div className="list-row" key={habit.id}><input className="check-control" type="checkbox" checked={!!habit.done} onChange={() => toggleHabit.mutate(habit)} aria-label={'Mark ' + habit.title + ' complete'} /><div className="list-row__body"><b>{habit.emoji} {habit.title}</b></div><span className="list-row__meta">{habit.done ? 'Done' : 'Open'}</span></div>)}</div> : <EmptyState title="Choose your rituals." detail="Create a few repeatable practices that support the way you want to live." />}
        </Card>
        <Card>
          <div className="card-heading"><div><h2>A wider view</h2><p>Patterns from your recent activity.</p></div></div>
          <p className="insight-copy">{insight.data?.pattern || 'Your activity pattern will appear as you use Atlas.'}</p>
          {insight.data?.rhythm && <p className="insight-copy insight-copy--muted">{insight.data.rhythm}</p>}
          <Link className="text-link" to="/insights">Explore insights <ArrowRight size={14} /></Link>
        </Card>
      </div>
    </div>
  </div>;
}