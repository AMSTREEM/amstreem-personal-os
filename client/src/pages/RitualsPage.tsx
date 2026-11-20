import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { api, json } from '../lib/api';
import { Button, Card, EmptyState, Field, PageHeader, TextInput } from '../components/ui';

type Habit = { id: number; title: string; emoji: string; done: number };
function dateKey() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }

export function RitualsPage() {
  const client = useQueryClient();
  const date = dateKey();
  const [title, setTitle] = useState('');
  const habits = useQuery({ queryKey: ['habits', date], queryFn: () => api<Habit[]>('/habits?date=' + date) });
  const create = useMutation({ mutationFn: () => api('/habits', json('POST', { title })), onSuccess: () => { setTitle(''); void client.invalidateQueries({ queryKey: ['habits'] }); } });
  const toggle = useMutation({ mutationFn: (id: number) => api('/habits/' + id + '/toggle', json('POST', { date })), onSuccess: () => void client.invalidateQueries({ queryKey: ['habits', date] }) });
  const remove = useMutation({ mutationFn: (id: number) => api('/habits/' + id, { method: 'DELETE' }), onSuccess: () => void client.invalidateQueries({ queryKey: ['habits', date] }) });
  return <div className="stack">
    <PageHeader eyebrow="PRACTICE / CONSISTENCY" title="Rituals" description="Build repeatable practices around the person you are trying to become. No punishment for being human." />
    <Card>
      <div className="card-heading"><div><h2>Add a ritual</h2><p>Choose a practice that is small enough to repeat.</p></div></div>
      <form className="form-row" onSubmit={event => { event.preventDefault(); if (title.trim()) create.mutate(); }}>
        <Field label="Ritual name"><TextInput value={title} onChange={event => setTitle(event.target.value)} placeholder="e.g. Read for 15 minutes" required /></Field>
        <Button type="submit" disabled={create.isPending || !title.trim()}><Plus size={16} /> Add ritual</Button>
      </form>
    </Card>
    <Card>
      <div className="card-heading"><div><h2>Today's practices</h2><p>{habits.data?.filter(item => item.done).length || 0} of {habits.data?.length || 0} recorded today</p></div></div>
      {habits.data?.length ? <div className="list-stack">{habits.data.map(habit => <div className="list-row" key={habit.id}><input className="check-control" type="checkbox" checked={!!habit.done} onChange={() => toggle.mutate(habit.id)} aria-label={'Mark ' + habit.title + ' complete'} /><div className="list-row__body"><b>{habit.emoji} {habit.title}</b><small>{habit.done ? 'Recorded for today' : 'Not yet recorded'}</small></div><button className="icon-button" onClick={() => { if (window.confirm('Remove this ritual and its check-ins?')) remove.mutate(habit.id); }} aria-label={'Remove ' + habit.title}><Trash2 size={15} /></button></div>)}</div> : <EmptyState title="Start with one small promise." detail="Add a ritual you want to make room for. You can change it whenever life changes." />}
    </Card>
  </div>;
}