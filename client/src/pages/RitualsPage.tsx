import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Check } from 'lucide-react';
import { api, json } from '../lib/api';
import { Button, EmptyState, Field, PageHeader, TextInput } from '../components/ui';

type Habit = { id: number; title: string; emoji: string; done: number };
function dateKey() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }

export function RitualsPage() {
  const client = useQueryClient();
  const date = dateKey();
  const [title, setTitle] = useState('');
  const habits = useQuery({ queryKey: ['habits', date], queryFn: () => api<Habit[]>('/habits?date=' + date) });
  const create = useMutation({ mutationFn: () => api('/habits', json('POST', { title })), onSuccess: () => { setTitle(''); void client.invalidateQueries({ queryKey: ['habits'] }); } });
  const toggle = useMutation({ mutationFn: (id: number) => api('/habits/' + id + '/toggle', json('POST', { date })), onSuccess: () => { void client.invalidateQueries({ queryKey: ['habits', date] }); void client.invalidateQueries({ queryKey: ['overview'] }); } });
  const remove = useMutation({ mutationFn: (id: number) => api('/habits/' + id, { method: 'DELETE' }), onSuccess: () => void client.invalidateQueries({ queryKey: ['habits', date] }) });
  const list = habits.data || [];
  const done = list.filter(item => item.done).length;
  const percent = list.length ? Math.round(done / list.length * 100) : 0;
  return <div className="stack rituals-page">
    <PageHeader eyebrow="PRACTICE / CONSISTENCY" title="Habits" description="A simple record of the actions you choose to repeat." />
    <section className="rituals-summary">
      <div><span className="eyebrow">TODAY'S COMPLETION</span><strong>{done}<small>/{list.length}</small></strong><p>{percent}% of your habits completed</p></div>
      <div className="rituals-progress"><span style={{ width: percent + '%' }} /></div>
      <span className="rituals-date">{new Intl.DateTimeFormat(undefined, { weekday:'long', month:'short', day:'numeric' }).format(new Date())}</span>
    </section>
    <form className="rituals-add" onSubmit={event => { event.preventDefault(); if (title.trim()) create.mutate(); }}>
      <Field label="ADD A HABIT"><TextInput value={title} onChange={event => setTitle(event.target.value)} placeholder="e.g. Read 10 pages, walk, revise Qur'an…" required /></Field>
      <Button type="submit" disabled={create.isPending || !title.trim()}><Plus size={15} /> Add habit</Button>
    </form>
    <section className="rituals-list">
      <div className="rituals-list-head"><div><span className="eyebrow">DAILY TRACKER</span><h2>Your habits</h2></div><span>{done} completed · {list.length - done} remaining</span></div>
      {list.length ? list.map(habit => <div className={'rituals-row ' + (habit.done ? 'is-done' : '')} key={habit.id}>
        <button className={'rituals-check ' + (habit.done ? 'is-checked' : '')} onClick={() => toggle.mutate(habit.id)} aria-label={habit.done ? 'Undo ' + habit.title : 'Complete ' + habit.title}>{habit.done ? <Check size={15} /> : null}</button>
        <span className="rituals-emoji">{habit.emoji || '•'}</span><b>{habit.title}</b><span className="rituals-row-state">{habit.done ? 'Completed' : 'Not yet'}</span>
        <button className="icon-button rituals-remove" onClick={() => { if (window.confirm('Remove this habit and its check-ins?')) remove.mutate(habit.id); }} aria-label={'Remove ' + habit.title}><Trash2 size={14} /></button>
      </div>) : <EmptyState title="Start with one habit." detail="Add a small action you want to repeat consistently." />}
    </section>
    <p className="rituals-footnote">Consistency is built through repetition, not perfect streaks.</p>
  </div>;
}
