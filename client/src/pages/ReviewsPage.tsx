import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarCheck, Save } from 'lucide-react';
import { api, json } from '../lib/api';
import { Button, Card, EmptyState, Field, PageHeader, TextArea } from '../components/ui';

type Review = { id: number; period_type: 'daily' | 'weekly'; period_start: string; period_end: string; wins: string; challenges: string; lessons: string; next_focus: string; updated_at: string };

function dateKey(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  return parts.find(item => item.type === 'year')!.value + '-' + parts.find(item => item.type === 'month')!.value + '-' + parts.find(item => item.type === 'day')!.value;
}
function periodRange(type: 'daily' | 'weekly') {
  const today = dateKey(new Date());
  const date = new Date(today + 'T12:00:00');
  if (type === 'daily') return { start: today, end: today };
  const offset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - offset);
  const start = dateKey(date);
  date.setDate(date.getDate() + 6);
  return { start, end: dateKey(date) };
}

export function ReviewsPage() {
  const client = useQueryClient();
  const [type, setType] = useState<'daily' | 'weekly'>('weekly');
  const range = useMemo(() => periodRange(type), [type]);
  const [wins, setWins] = useState('');
  const [challenges, setChallenges] = useState('');
  const [lessons, setLessons] = useState('');
  const [nextFocus, setNextFocus] = useState('');
  const reviews = useQuery({ queryKey: ['reviews', type], queryFn: () => api<Review[]>('/reviews?period=' + type) });
  const current = reviews.data?.find(item => item.period_start === range.start);
  useEffect(() => {
    setWins(current?.wins || '');
    setChallenges(current?.challenges || '');
    setLessons(current?.lessons || '');
    setNextFocus(current?.next_focus || '');
  }, [current?.id, current?.updated_at, type]);
  const save = useMutation({
    mutationFn: () => api('/reviews', json('POST', { period_type: type, period_start: range.start, period_end: range.end, wins, challenges, lessons, next_focus: nextFocus })),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['reviews', type] })
  });

  return <div className="stack">
    <PageHeader eyebrow="REFLECT / REVIEW" title="Reviews" description="Make sense of what happened, notice what you learned, and choose what deserves attention next." />
    <div className="review-switch"><button className={type === 'daily' ? 'review-switch__active' : ''} onClick={() => setType('daily')}>Daily review</button><button className={type === 'weekly' ? 'review-switch__active' : ''} onClick={() => setType('weekly')}>Weekly review</button></div>
    <Card>
      <div className="card-heading"><div><h2>{type === 'weekly' ? 'Your week, in perspective.' : 'Close the day with intention.'}</h2><p>{range.start} — {range.end} {current ? '· Saved review' : '· New review'}</p></div><CalendarCheck size={18} /></div>
      <form className="form-stack" onSubmit={event => { event.preventDefault(); save.mutate(); }}>
        <Field label="What went well?"><TextArea value={wins} onChange={event => setWins(event.target.value)} placeholder="What moved forward? What are you glad you did?" /></Field>
        <Field label="What was difficult?"><TextArea value={challenges} onChange={event => setChallenges(event.target.value)} placeholder="What created friction or took more energy than expected?" /></Field>
        <Field label="What did you learn?"><TextArea value={lessons} onChange={event => setLessons(event.target.value)} placeholder="What will you carry into the next day or week?" /></Field>
        <Field label="What deserves your attention next?"><TextArea value={nextFocus} onChange={event => setNextFocus(event.target.value)} placeholder="Choose a clear direction for the next period." /></Field>
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