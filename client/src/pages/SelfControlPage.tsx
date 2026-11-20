import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Heart, Plus, RotateCcw, ShieldCheck, Trash2 } from 'lucide-react';
import { api, json } from '../lib/api';
import { Button, Card, EmptyState, Field, PageHeader, TextArea, TextInput } from '../components/ui';

type CheckIn = { id: number; tracker_id: number; log_date: string; outcome: 'clean' | 'slip'; urge_level: number; trigger: string; response: string; note: string; tracker_name: string; tracker_symbol: string };
type Tracker = { id: number; name: string; symbol: string; start_date: string; streak: number; longest_days: number; last_slip: string | null; today: CheckIn | null };
type Data = { date: string; summary: Tracker[]; logs: CheckIn[] };
function dateKey() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }

export function SelfControlPage() {
  const client = useQueryClient();
  const today = dateKey();
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('◇');
  const [startDate, setStartDate] = useState(today);
  const [activeTracker, setActiveTracker] = useState<Tracker | null>(null);
  const [outcome, setOutcome] = useState<'clean' | 'slip'>('clean');
  const [urge, setUrge] = useState('0');
  const [trigger, setTrigger] = useState('');
  const [response, setResponse] = useState('');
  const [note, setNote] = useState('');
  const data = useQuery({ queryKey: ['self-control', today], queryFn: () => api<Data>('/self-control?date=' + today) });
  const create = useMutation({
    mutationFn: () => api('/self-control', json('POST', { name, symbol, start_date: startDate })),
    onSuccess: () => { setName(''); setSymbol('◇'); void client.invalidateQueries({ queryKey: ['self-control'] }); }
  });
  const checkin = useMutation({
    mutationFn: (entry: { trackerId: number; outcome: 'clean' | 'slip'; urge?: number; trigger?: string; response?: string; note?: string }) => api('/self-control/' + entry.trackerId + '/checkin', json('POST', { date: today, outcome: entry.outcome, urge_level: entry.urge ?? 0, trigger: entry.trigger ?? '', response: entry.response ?? '', note: entry.note ?? '' })),
    onSuccess: () => { setActiveTracker(null); setTrigger(''); setResponse(''); setNote(''); setUrge('0'); void client.invalidateQueries({ queryKey: ['self-control', today] }); }
  });
  const remove = useMutation({
    mutationFn: (id: number) => api('/self-control/' + id, { method: 'DELETE' }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['self-control', today] })
  });

  return <div className="stack">
    <PageHeader eyebrow="PRACTICE / SELF-MASTERY" title="Self-control" description="A private, honest record of the choices you are working towards. A slip is information—not a verdict." />
    <Card>
      <div className="card-heading"><div><h2>Start a tracker</h2><p>Name a behaviour you want to understand or change.</p></div><Heart size={18} /></div>
      <form className="form-row" onSubmit={event => { event.preventDefault(); if (name.trim()) create.mutate(); }}>
        <Field label="Tracker name"><TextInput value={name} onChange={event => setName(event.target.value)} placeholder="What are you working on?" required /></Field>
        <Field label="Symbol"><TextInput value={symbol} onChange={event => setSymbol(event.target.value)} maxLength={4} /></Field>
        <Field label="Start date"><TextInput type="date" value={startDate} max={today} onChange={event => setStartDate(event.target.value)} required /></Field>
        <Button type="submit" disabled={create.isPending || !name.trim()}><Plus size={16} /> Add tracker</Button>
      </form>
      {create.isError && <p className="inline-error">{create.error.message}</p>}
    </Card>
    <div className="tracker-grid">
      {data.data?.summary.length ? data.data.summary.map(tracker => <Card key={tracker.id} className="tracker-card">
        <div className="tracker-card__top"><span className="tracker-symbol">{tracker.symbol}</span><button className="icon-button" onClick={() => { if (window.confirm('Delete this tracker and its history?')) remove.mutate(tracker.id); }} aria-label={'Delete ' + tracker.name}><Trash2 size={15} /></button></div>
        <h2>{tracker.name}</h2>
        <div className="tracker-count"><strong>{tracker.streak}</strong><span>days since reset</span></div>
        <div className="tracker-meta"><span>Longest: {tracker.longest_days} days</span><span>Started {tracker.start_date}</span></div>
        <div className="tracker-status">{tracker.today ? (tracker.today.outcome === 'clean' ? 'Today marked clean' : 'Slip recorded today') : 'No check-in recorded today'}</div><div className="tracker-actions"><Button size="sm" onClick={() => checkin.mutate({ trackerId: tracker.id, outcome: 'clean' })} disabled={checkin.isPending}><ShieldCheck size={14} /> Mark today as clean</Button><Button size="sm" variant="secondary" onClick={() => { setActiveTracker(tracker); setOutcome('slip'); }} disabled={checkin.isPending}><RotateCcw size={14} /> Record a slip</Button></div>
      </Card>) : <Card><EmptyState title="A fresh place to begin." detail="Create a tracker for a pattern you want to change. You control what you track and when." /></Card>}
    </div>
    <Card>
      <div className="card-heading"><div><h2>Recent check-ins</h2><p>Notice what happened without turning it into a judgement.</p></div></div>
      {data.data?.logs.length ? <div className="list-stack">{data.data.logs.map(log => <div className="list-row" key={log.id}><span className="session-mark">{log.outcome === 'clean' ? <ShieldCheck size={16} /> : <RotateCcw size={16} />}</span><div className="list-row__body"><b>{log.tracker_symbol} {log.tracker_name} · {log.outcome === 'clean' ? 'Clean day' : 'Reset recorded'}</b><small>{log.log_date}{log.trigger ? ' · Trigger: ' + log.trigger : ''}{log.response ? ' · Response: ' + log.response : ''}</small></div><span className="list-row__meta">{log.urge_level ? 'Urge ' + log.urge_level + '/5' : ''}</span></div>)}</div> : <EmptyState title="No check-ins yet." detail="Your history will appear here as you record your days." />}
    </Card>
    {activeTracker && <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setActiveTracker(null); }}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="checkin-title">
      <div className="card-heading"><div><span className="eyebrow">DAILY CHECK-IN</span><h2 id="checkin-title">{activeTracker.name}</h2></div><button className="icon-button" onClick={() => setActiveTracker(null)} aria-label="Close check-in">×</button></div>
      <form className="form-stack" onSubmit={event => { event.preventDefault(); checkin.mutate({ trackerId: activeTracker.id, outcome, urge: Number(urge), trigger, response, note }); }}>
        <Field label="How did today go?"><select className="field-input" value={outcome} onChange={event => setOutcome(event.target.value as 'clean' | 'slip')}><option value="clean">Today was clean</option><option value="slip">Record a slip</option></select></Field>
        <Field label="Urge intensity (0–5)"><TextInput type="number" min="0" max="5" value={urge} onChange={event => setUrge(event.target.value)} /></Field>
        <Field label="What was the trigger?"><TextInput value={trigger} onChange={event => setTrigger(event.target.value)} placeholder="Optional context" /></Field>
        <Field label="How did you respond?"><TextInput value={response} onChange={event => setResponse(event.target.value)} placeholder="What helped or what could help next time?" /></Field>
        <Field label="Note"><TextArea value={note} onChange={event => setNote(event.target.value)} placeholder="Anything else worth remembering" /></Field>
        <div className="modal-actions"><Button type="submit" disabled={checkin.isPending}>{checkin.isPending ? 'Saving…' : outcome === 'slip' ? 'Save slip' : 'Mark today as clean'}</Button><Button type="button" variant="ghost" onClick={() => setActiveTracker(null)}>Cancel</Button></div>
      </form>
    </section></div>}
  </div>;
}