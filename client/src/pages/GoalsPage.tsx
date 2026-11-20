import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, Plus } from 'lucide-react';
import { api, json } from '../lib/api';
import { Button, Card, EmptyState, Field, PageHeader, TextArea, TextInput } from '../components/ui';

type Goal = { id: number; title: string; detail: string; target_date: string | null; status: string };

export function GoalsPage() {
  const client = useQueryClient();
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const goals = useQuery({ queryKey: ['goals'], queryFn: () => api<Goal[]>('/goals') });
  const create = useMutation({
    mutationFn: () => api<Goal>('/goals', json('POST', { title, detail, target_date: targetDate || null })),
    onSuccess: () => { setTitle(''); setDetail(''); setTargetDate(''); void client.invalidateQueries({ queryKey: ['goals'] }); }
  });
  const complete = useMutation({
    mutationFn: (goal: Goal) => api('/goals/' + goal.id, json('PATCH', { status: goal.status === 'completed' ? 'active' : 'completed' })),
    onSuccess: () => { void client.invalidateQueries({ queryKey: ['goals'] }); void client.invalidateQueries({ queryKey: ['overview'] }); }
  });

  return <div className="stack">
    <PageHeader eyebrow="DIRECTION / LONG GAME" title="Goals" description="Keep your meaningful outcomes visible. The next step belongs in your projects and tasks." />
    <Card>
      <div className="card-heading"><div><h2>Set a direction</h2><p>Describe an outcome, not a vague aspiration.</p></div></div>
      <form className="form-stack" onSubmit={event => { event.preventDefault(); if (title.trim()) create.mutate(); }}>
        <Field label="Goal"><TextInput value={title} onChange={event => setTitle(event.target.value)} placeholder="What do you want to make real?" required /></Field>
        <Field label="Why it matters"><TextArea value={detail} onChange={event => setDetail(event.target.value)} placeholder="Add the context that will help you stay oriented." /></Field>
        <Field label="Target date"><TextInput type="date" value={targetDate} onChange={event => setTargetDate(event.target.value)} /></Field>
        <div><Button type="submit" disabled={create.isPending || !title.trim()}><Plus size={16} /> Add goal</Button></div>
      </form>
      {create.isError && <p className="inline-error">{create.error.message}</p>}
    </Card>
    <div className="goal-grid">
      {goals.data?.length ? goals.data.map(goal => <Card key={goal.id} className="goal-card">
        <div className="goal-card__top"><span className={'status-pill ' + (goal.status === 'completed' ? 'status-pill--done' : '')}>{goal.status}</span><ArrowUpRight size={17} /></div>
        <h2>{goal.title}</h2><p>{goal.detail || 'No additional context yet.'}</p>
        <div className="goal-card__bottom"><span>{goal.target_date ? 'Target ' + goal.target_date : 'No target date'}</span><Button variant="secondary" onClick={() => complete.mutate(goal)}>{goal.status === 'completed' ? 'Reopen' : 'Mark complete'}</Button></div>
      </Card>) : <Card><EmptyState title="Give your effort a direction." detail="Your active goals will live here. Start with one outcome that genuinely matters." /></Card>}
    </div>
  </div>;
}