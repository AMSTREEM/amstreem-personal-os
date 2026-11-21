import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarCheck, Save } from 'lucide-react';
import { api, json } from '../lib/api';
import { Button, Card, EmptyState, Field, PageHeader, TextArea } from '../components/ui';

type Evidence = { completed_tasks: number; focus_minutes: number; lessons_completed: number; rhythm_total: number; rhythm_completed: number; habit_checkins: number; self_control_slips: number; milestones_total: number; milestones_completed: number };
type Review = { id: number; period_type: 'daily' | 'weekly'; period_start: string; period_end: string; wins: string; challenges: string; lessons: string; next_focus: string; priority_task_ids?: number[]; updated_at: string };
type Task = { id:number; title:string; done:number; priority:number; due_date:string|null };

function dateKey(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  return parts.find(item => item.type === 'year')!.value + '-' + parts.find(item => item.type === 'month')!.value + '-' + parts.find(item => item.type === 'day')!.value;
}
function periodRange(type: 'daily' | 'weekly') {
  const today = dateKey(new Date());
  const date = new Date(today + 'T12:00:00');
  if (type === 'daily') return { start: today, end: today };
  date.setDate(date.getDate() - 6);
  return { start: dateKey(date), end: today };
}

export function ReviewsPage() {
  const client = useQueryClient();
  const [type, setType] = useState<'daily' | 'weekly'>('weekly');
  const range = useMemo(() => periodRange(type), [type]);
  const [wins, setWins] = useState('');
  const [challenges, setChallenges] = useState('');
  const [lessons, setLessons] = useState('');
  const [nextFocus, setNextFocus] = useState('');
  const [priorityIds,setPriorityIds] = useState<number[]>([]);
  const tasks = useQuery({queryKey:['tasks'],queryFn:()=>api<Task[]>('/tasks')});
  const reviews = useQuery({ queryKey: ['reviews', type], queryFn: () => api<Review[]>('/reviews?period=' + type) });
  const evidence = useQuery({ queryKey: ['review-evidence', range.start, range.end], queryFn: () => api<Evidence>('/reviews/evidence?start=' + range.start + '&end=' + range.end), enabled: type === 'weekly' });
  const current = reviews.data?.find(item => item.period_start === range.start);
  useEffect(() => {
    setWins(current?.wins || '');
    setChallenges(current?.challenges || '');
    setLessons(current?.lessons || '');
    setNextFocus(current?.next_focus || '');
    setPriorityIds(current?.priority_task_ids || []);
  }, [current?.id, current?.updated_at, type]);
  const save = useMutation({
    mutationFn: () => api('/reviews', json('POST', { period_type: type, period_start: range.start, period_end: range.end, wins, challenges, lessons, next_focus: nextFocus, priority_task_ids: priorityIds })),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['reviews', type] })
  });

  return <div className="stack">
    <PageHeader eyebrow="REFLECT / REVIEW" title="Reviews" description="Make sense of what happened, notice what you learned, and choose what deserves attention next." />
    <div className="review-switch"><button className={type === 'daily' ? 'review-switch__active' : ''} onClick={() => setType('daily')}>Daily review</button><button className={type === 'weekly' ? 'review-switch__active' : ''} onClick={() => setType('weekly')}>Weekly review</button></div>
    {type === 'weekly' && <Card className="room4-card room4-evidence"><div className="card-heading"><div><span className="eyebrow">THE LAST SEVEN DAYS</span><h2>Your evidence, before reflection</h2><p>Workspace records for {range.start} — {range.end}. Missing records are not treated as zero-effort days.</p></div><CalendarCheck size={18}/></div>{evidence.isLoading ? <p>Gathering your workspace evidence…</p> : evidence.data ? <div className="room4-evidence-grid">{[['Focus minutes',evidence.data.focus_minutes+'m'],['Completed tasks',evidence.data.completed_tasks],['Lessons completed',evidence.data.lessons_completed],['Rhythm records',evidence.data.rhythm_completed+'/'+evidence.data.rhythm_total],['Habit check-ins',evidence.data.habit_checkins],['Self-control slips',evidence.data.self_control_slips],['Milestones completed',evidence.data.milestones_completed+'/'+evidence.data.milestones_total]].map(([label,value])=><div key={String(label)}><small>{label}</small><b>{value}</b></div>)}</div> : <p className="inline-error">Evidence is temporarily unavailable.</p>}<p className="room4-evidence-note">Task, lesson and milestone totals reflect currently completed records; older records do not have completion timestamps. Focus, Daily Rhythm and check-in counts use their actual dated logs.</p></Card>}
    <Card className="room4-card">
      <div className="card-heading"><div><h2>{type === 'weekly' ? 'Your week, in perspective.' : 'Close the day with intention.'}</h2><p>{range.start} — {range.end} {current ? '· Saved review' : '· New review'}</p></div><CalendarCheck size={18} /></div>
      <form className="form-stack" onSubmit={event => { event.preventDefault(); save.mutate(); }}>
        <Field label="What went well?"><TextArea value={wins} onChange={event => setWins(event.target.value)} placeholder="What moved forward? What are you glad you did?" /></Field>
        <Field label="What was difficult?"><TextArea value={challenges} onChange={event => setChallenges(event.target.value)} placeholder="What created friction or took more energy than expected?" /></Field>
        <Field label="What did you learn?"><TextArea value={lessons} onChange={event => setLessons(event.target.value)} placeholder="What will you carry into the next day or week?" /></Field>
        <Field label={type === 'weekly' ? 'What deserves your attention next week?' : 'What deserves your attention next?'}><TextArea value={nextFocus} onChange={event => setNextFocus(event.target.value)} placeholder={type === 'weekly' ? 'What will you deliberately prioritise, reduce or change next week?' : 'Choose a clear direction for the next period.'} /></Field>
        {type === 'weekly' && <section className="room4-priority-adjust"><div><b>Adjust next week’s priorities</b><small>Choose up to three existing open tasks. This updates your saved review priorities.</small></div><div className="room4-priority-list">{(tasks.data||[]).filter(task=>!task.done).map(task=><label key={task.id}><input type="checkbox" checked={priorityIds.includes(task.id)} disabled={!priorityIds.includes(task.id)&&priorityIds.length>=3} onChange={event=>setPriorityIds(current=>event.target.checked?[...current,task.id]:current.filter(id=>id!==task.id))}/><span>{task.title}</span></label>)}</div></section>}
        <div><Button type="submit" disabled={save.isPending}><Save size={16} /> {save.isPending ? 'Saving…' : 'Save review'}</Button></div>
      </form>
      {save.isError && <p className="inline-error">{save.error.message}</p>}
    </Card>
    <Card>
      <div className="card-heading"><div><h2>Previous reviews</h2><p>Return to what you noticed before.</p></div></div>
      {reviews.data?.length ? <div className="list-stack">{reviews.data.filter(item => item.period_start !== range.start).map(item => <div className="review-history-row" key={item.id}><div><b>{item.period_start} — {item.period_end}</b><small>{item.next_focus || item.wins || 'Reflection saved'}</small></div><span className="list-row__meta">{new Date(item.updated_at).toLocaleDateString()}</span></div>)}</div> : <EmptyState title="Your review history will grow here." detail="Save your first reflection to start building a record of what you learn about yourself." />}
    </Card>
  </div>;
}