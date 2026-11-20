import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock3, Plus } from 'lucide-react';
import { api, json } from '../lib/api';
import { Button, Card, EmptyState, Field, PageHeader, TextArea, TextInput } from '../components/ui';

type Session = { id: number; session_date: string; minutes: number; focus: string; reflection: string };

export function FocusPage() {
  const client = useQueryClient();
  const [focus, setFocus] = useState('');
  const [minutes, setMinutes] = useState('25');
  const [reflection, setReflection] = useState('');
  const sessions = useQuery({ queryKey: ['sessions'], queryFn: () => api<Session[]>('/sessions') });
  const create = useMutation({
    mutationFn: () => api<Session>('/sessions', json('POST', { focus, minutes: Number(minutes), reflection })),
    onSuccess: () => { setFocus(''); setReflection(''); void client.invalidateQueries({ queryKey: ['sessions'] }); void client.invalidateQueries({ queryKey: ['overview'] }); void client.invalidateQueries({ queryKey: ['intelligence'] }); }
  });
  const total = sessions.data?.reduce((sum, item) => sum + item.minutes, 0) || 0;
  return <div className="stack">
    <PageHeader eyebrow="PRACTICE / ATTENTION" title="Focus room" description="Record the time you give to meaningful work. Keep the record honest and useful." />
    <div className="stat-grid stat-grid--three">
      <div className="stat-card"><div className="stat-card__top">RECENT SESSIONS</div><strong>{sessions.data?.length ?? '—'}</strong><small>Recorded focus blocks</small></div>
      <div className="stat-card"><div className="stat-card__top">TOTAL TIME</div><strong>{Math.round(total / 60 * 10) / 10}h</strong><small>Across your recent records</small></div>
      <div className="stat-card"><div className="stat-card__top">AVERAGE BLOCK</div><strong>{sessions.data?.length ? Math.round(total / sessions.data.length) + 'm' : '—'}</strong><small>Per recorded session</small></div>
    </div>
    <Card>
      <div className="card-heading"><div><h2>Record a focus session</h2><p>Log a completed block of attention.</p></div><Clock3 size={18} /></div>
      <form className="form-stack" onSubmit={event => { event.preventDefault(); if (focus.trim()) create.mutate(); }}>
        <Field label="What did you focus on?"><TextInput value={focus} onChange={event => setFocus(event.target.value)} placeholder="The work you gave your attention to" required /></Field>
        <Field label="Duration in minutes"><TextInput type="number" min="1" max="600" value={minutes} onChange={event => setMinutes(event.target.value)} required /></Field>
        <Field label="Reflection (optional)"><TextArea value={reflection} onChange={event => setReflection(event.target.value)} placeholder="What moved forward? What did you learn?" /></Field>
        <div><Button type="submit" disabled={create.isPending || !focus.trim()}><Plus size={16} /> Save session</Button></div>
      </form>
      {create.isError && <p className="inline-error">{create.error.message}</p>}
    </Card>
    <Card>
      <div className="card-heading"><div><h2>Recent sessions</h2><p>Your focus history.</p></div></div>
      {sessions.data?.length ? <div className="list-stack">{sessions.data.map(item => <div className="list-row" key={item.id}><span className="session-mark"><Clock3 size={16} /></span><div className="list-row__body"><b>{item.focus}</b><small>{item.session_date}{item.reflection ? ' · ' + item.reflection : ''}</small></div><span className="list-row__meta">{item.minutes} min</span></div>)}</div> : <EmptyState title="Your focus history starts here." detail="Record a completed session to build a useful picture of your attention over time." />}
    </Card>
  </div>;
}