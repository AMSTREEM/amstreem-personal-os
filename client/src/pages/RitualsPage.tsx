import { useMemo, useState } from 'react';
import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Check } from 'lucide-react';
import { api, json } from '../lib/api';
import { Button, EmptyState, Field, PageHeader, TextInput } from '../components/ui';

type Habit = { id: number; title: string; emoji: string; done: number };
function dateKey(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(value);
  return parts.find(item => item.type === 'year')!.value + '-' + parts.find(item => item.type === 'month')!.value + '-' + parts.find(item => item.type === 'day')!.value;
}

export function RitualsPage() {
  const client = useQueryClient();
  const date = dateKey();
  const [title, setTitle] = useState('');
  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const day = new Date(date + 'T12:00:00');
    day.setDate(day.getDate() - 6 + index);
    return dateKey(day);
  }), [date]);
  const weekQueries = useQueries({
    queries: weekDates.map(day => ({ queryKey: ['habits', day], queryFn: () => api<Habit[]>('/habits?date=' + day), staleTime: 15_000 }))
  });
  const todayQuery = weekQueries[6];
  const create = useMutation({ mutationFn: () => api('/habits', json('POST', { title })), onSuccess: () => { setTitle(''); void client.invalidateQueries({ queryKey: ['habits'] }); } });
  const toggle = useMutation({ mutationFn: (id: number) => api('/habits/' + id + '/toggle', json('POST', { date })), onSuccess: () => { void client.invalidateQueries({ queryKey: ['habits', date] }); void client.invalidateQueries({ queryKey: ['overview'] }); } });
  const remove = useMutation({ mutationFn: (id: number) => api('/habits/' + id, { method: 'DELETE' }), onSuccess: () => void client.invalidateQueries({ queryKey: ['habits'] }) });
  const list = todayQuery?.data || [];
  const done = list.filter(item => item.done).length;
  const percent = list.length ? Math.round(done / list.length * 100) : 0;
  const weekLoading = weekQueries.some(query => query.isLoading);
  const weekDays = weekDates.map(day => ({ date: day, label: new Date(day + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'narrow' }) }));

  return <div className="stack rituals-page">
    <PageHeader eyebrow="PRACTICE / CONSISTENCY" title="Habits" description="A simple record of the actions you choose to repeat." />
    <section className="rituals-summary">
      <div><span className="eyebrow">TODAY'S COMPLETION</span><strong>{done}<small>/{list.length}</small></strong><p>{percent}% of your habits completed</p></div>
      <div className="rituals-progress"><span style={{ width: percent + '%' }} /></div>
      <span className="rituals-date">{new Intl.DateTimeFormat(undefined, { weekday:'long', month:'short', day:'numeric' }).format(new Date())}</span>
    </section>
    <form className="rituals-add" onSubmit={event => { event.preventDefault(); if (title.trim()) create.mutate(); }}>
      <Field label="ADD A HABIT"><TextInput value={title} onChange={event => setTitle(event.target.value)} placeholder="e.g. Read 10 pages, walk, revise Qur'an…" required maxLength={100} /></Field>
      <Button type="submit" disabled={create.isPending || !title.trim()}><Plus size={15} /> Add habit</Button>
    </form>
    {create.isError && <p className="inline-error">{create.error.message}</p>}
    <section className="rituals-list">
      <div className="rituals-list-head"><div><span className="eyebrow">DAILY TRACKER</span><h2>Your habits</h2></div><span>{done} completed · {list.length - done} remaining</span></div>
      <div className="rituals-week-head" aria-label="Last seven days"><span>LAST 7 DAYS</span><div>{weekDays.map(day => <span key={day.date} title={day.date}>{day.label}</span>)}</div></div>
      {list.length ? list.map(habit => {
        const history = weekQueries.map(query => query.data?.find(item => item.id === habit.id)?.done === 1);
        const historyCount = history.filter(Boolean).length;
        return <div className={'rituals-row ' + (habit.done ? 'is-done' : '')} key={habit.id}>
          <button className={'rituals-check ' + (habit.done ? 'is-checked' : '')} onClick={() => toggle.mutate(habit.id)} aria-label={habit.done ? 'Undo ' + habit.title : 'Complete ' + habit.title}>{habit.done ? <Check size={15} /> : null}</button>
          <span className="rituals-emoji">{habit.emoji || '•'}</span><b>{habit.title}</b>
          <div className="rituals-week-dots" aria-label={historyCount + ' of 7 days completed'}>{history.map((completed, index) => <i key={weekDates[index]} className={completed ? 'is-complete' : ''} title={weekDates[index] + (completed ? ' completed' : ' not completed')} />)}</div>
          <span className="rituals-row-state">{weekLoading ? '…' : historyCount + '/7'}</span>
          <button className="icon-button rituals-remove" onClick={() => { if (window.confirm('Remove this habit and its check-ins?')) remove.mutate(habit.id); }} aria-label={'Remove ' + habit.title}><Trash2 size={14} /></button>
        </div>;
      }) : <EmptyState title="Start with one habit." detail="Add a small action you want to repeat consistently." />}
    </section>
    <p className="rituals-footnote">Consistency is built through repetition, not perfect streaks. Your seven-day history makes patterns visible without turning missed days into failure.</p>
  </div>;
}
