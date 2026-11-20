import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, CalendarDays, Check, Clock3, Flame, Plus, Target } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, json } from '../lib/api';
import { Card, EmptyState, PageHeader } from '../components/ui';

type Task = { id: number; title: string; detail: string; due_date: string | null; done: number };
type Habit = { id: number; title: string; emoji: string; done: number };
type Overview = { today: string; todayMin: number; weekMin: number; completed: number; moduleTotal: number; streak: number; dailyTarget: number; openTasks: number };
type Announcement = { id: number; title: string; body: string; kind: string; created_at: string; published_at: string | null };
type AnnouncementFeed = { items: Announcement[]; readIds: number[] };
type Insight = { recommendation: { title: string; detail: string; reason: string; action: string; destination: string; priority: string }; pattern: string; rhythm: string | null };

function todayKey() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export function TodayPage() {
  const client = useQueryClient();
  const today = todayKey();
  const [quickTask, setQuickTask] = useState('');
  const overview = useQuery({ queryKey: ['overview'], queryFn: () => api<Overview>('/overview') });
  const tasks = useQuery({ queryKey: ['tasks'], queryFn: () => api<Task[]>('/tasks') });
  const habits = useQuery({ queryKey: ['habits', today], queryFn: () => api<Habit[]>('/habits?date=' + today) });
  const insight = useQuery({ queryKey: ['intelligence'], queryFn: () => api<Insight>('/intelligence') });
  const announcements = useQuery({ queryKey: ['announcements'], queryFn: () => api<AnnouncementFeed>('/announcements') });
  const markRead = useMutation({ mutationFn: (id: number) => api('/announcements/' + id + '/read', json('POST')), onSuccess: () => void client.invalidateQueries({ queryKey: ['announcements'] }) });
  const addTask = useMutation({
    mutationFn: () => api<Task>('/tasks', json('POST', { title: quickTask.trim(), category: 'Personal' })),
    onSuccess: () => { setQuickTask(''); void client.invalidateQueries({ queryKey: ['tasks'] }); void client.invalidateQueries({ queryKey: ['overview'] }); }
  });
  const toggleTask = useMutation({
    mutationFn: (task: Task) => api<Task>('/tasks/' + task.id, json('PATCH', { done: !task.done })),
    onSuccess: () => { void client.invalidateQueries({ queryKey: ['tasks'] }); void client.invalidateQueries({ queryKey: ['overview'] }); }
  });
  const toggleHabit = useMutation({
    mutationFn: (habit: Habit) => api('/habits/' + habit.id + '/toggle', json('POST', { date: today })),
    onSuccess: () => { void client.invalidateQueries({ queryKey: ['habits', today] }); void client.invalidateQueries({ queryKey: ['overview'] }); }
  });
  const habitList = habits.data || [];
  const completedHabits = habitList.filter(habit => habit.done).length;
  const completion = habitList.length ? Math.round(completedHabits / habitList.length * 100) : 0;
  const openTaskCount = (tasks.data || []).filter(task => !task.done).length;
  const openTasks = (tasks.data || []).filter(task => !task.done).sort((a, b) => {
    if (!a.due_date && !b.due_date) return 0;
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return a.due_date.localeCompare(b.due_date);
  }).slice(0, 6);
  const nextDestination = insight.data?.recommendation.destination === 'habit' ? '/rituals' : '/' + (insight.data?.recommendation.destination || 'tasks');

  return <div className="stack today-dashboard">
    <PageHeader eyebrow={new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date()).toUpperCase()} title="Today" description="Show up for the things that matter. One day at a time." action={<Link className="button button--secondary" to="/calendar"><CalendarDays size={15} /> Calendar</Link>} />

    <section className="consistency-strip" aria-label="Consistency summary">
      <div className="consistency-main">
        <div><span className="eyebrow">DAILY CONSISTENCY</span><strong>{completion}%</strong><small>{completedHabits} of {habitList.length} habits completed</small></div>
        <div className="consistency-track"><span style={{ width: completion + '%' }} /></div>
      </div>
      <div className="consistency-metric"><Flame size={16} /><b>{overview.data?.streak ?? 0}</b><small>day streak</small></div>
      <div className="consistency-metric"><Clock3 size={16} /><b>{overview.data?.todayMin ?? 0}m</b><small>focused today</small></div>
      <div className="consistency-metric"><Check size={16} /><b>{openTaskCount}</b><small>open tasks</small></div>
    </section>

    <div className="today-columns">
      <section className="today-primary">
        <Card className="today-habits-card">
          <div className="today-section-heading"><div><span className="eyebrow">YOUR DAILY CHECKLIST</span><h2>Build consistency</h2><p>Small actions. Repeated daily.</p></div><Link className="text-link" to="/rituals">Edit habits <ArrowRight size={13} /></Link></div>
          {habitList.length ? <div className="today-habit-list">{habitList.map(habit => <label className={'today-habit-row ' + (habit.done ? 'is-done' : '')} key={habit.id}>
            <input className="today-habit-check" type="checkbox" checked={!!habit.done} onChange={() => toggleHabit.mutate(habit)} />
            <span className="today-habit-emoji">{habit.emoji || '•'}</span><span className="today-habit-title">{habit.title}</span><span className="today-habit-state">{habit.done ? 'Done' : 'Mark done'}</span>
          </label>)}</div> : <EmptyState title="Start with a few daily habits." detail="Add the repeatable actions you want to become consistent with." />}
          <div className="today-card-footer"><span>{completedHabits === habitList.length && habitList.length ? 'All habits completed for today' : (habitList.length - completedHabits) + ' remaining today'}</span><Link to="/rituals" className="text-link">Manage habits <ArrowRight size={13} /></Link></div>
        </Card>

        <Card className="today-tasks-card">
          <div className="today-section-heading"><div><span className="eyebrow">GET THINGS DONE</span><h2>Today's priorities</h2></div><Link className="text-link" to="/tasks">All tasks <ArrowRight size={13} /></Link></div>
          <form className="today-quick-capture" onSubmit={event => { event.preventDefault(); if (quickTask.trim()) addTask.mutate(); }}>
            <input value={quickTask} onChange={event => setQuickTask(event.target.value)} placeholder="Capture a task…" aria-label="New task title" maxLength={180} />
            <button type="submit" disabled={!quickTask.trim() || addTask.isPending} aria-label="Add task"><Plus size={15} /> Add</button>
          </form>
          {addTask.isError && <p className="inline-error">{addTask.error.message}</p>}
          {openTasks.length ? <div className="today-task-list">{openTasks.map(task => <label className="today-task-row" key={task.id}>
            <input className="check-control" type="checkbox" checked={!!task.done} onChange={() => toggleTask.mutate(task)} />
            <span><b>{task.title}</b>{task.detail && <small>{task.detail}</small>}</span><time>{task.due_date ? (task.due_date < today ? 'Overdue · ' : task.due_date === today ? 'Today · ' : '') + new Date(task.due_date + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}</time>
          </label>)}</div> : <EmptyState title="You're clear for now." detail="Your unfinished tasks will appear here." />}
        </Card>
      </section>

      <aside className="today-secondary">
        <Card className="today-next-card">
          <div className="today-section-heading"><div><span className="eyebrow">A USEFUL NEXT STEP</span><h2>Keep moving</h2></div><Target size={16} /></div>
          {insight.data?.recommendation ? <div className="today-recommendation"><b>{insight.data.recommendation.title}</b><p>{insight.data.recommendation.detail}</p><Link className="text-link" to={nextDestination}>{insight.data.recommendation.action} <ArrowRight size={13} /></Link></div> : <p className="muted">As you build a record of consistency, Atlas will help surface a useful next step.</p>}
        </Card>
        <Card className="today-focus-card">
          <div className="today-section-heading"><div><span className="eyebrow">TIME INVESTED</span><h2>Focus</h2></div><Clock3 size={16} /></div>
          <div className="today-focus-values"><div><strong>{overview.data?.todayMin ?? 0}<small>m</small></strong><span>Today</span></div><div><strong>{Math.round((overview.data?.weekMin || 0) / 60 * 10) / 10}<small>h</small></strong><span>This week</span></div></div>
          <Link className="text-link" to="/focus">Open focus timer <ArrowRight size={13} /></Link>
        </Card>
        {announcements.data?.items?.filter(item => !announcements.data?.readIds.includes(item.id)).length ? <Card className="today-announcements"><span className="eyebrow">UPDATES</span>{announcements.data.items.filter(item => !announcements.data?.readIds.includes(item.id)).slice(0,2).map(item => <div className="today-announcement" key={item.id}><b>{item.title}</b><p>{item.body}</p><button className="text-link" onClick={() => markRead.mutate(item.id)}>Mark as read</button></div>)}</Card> : null}
      </aside>
    </div>
  </div>;
}
