import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Heart, Plus, RotateCcw, ShieldCheck, Trash2 } from 'lucide-react';
import { api, json } from '../lib/api';
import { Button, Card, EmptyState, Field, PageHeader, TextArea, TextInput } from '../components/ui';

type CheckIn = { id: number; tracker_id: number; log_date: string; outcome: 'clean' | 'slip'; urge_level: number; trigger: string; response: string; note: string; tracker_name: string; tracker_symbol: string };
type Tracker = { id: number; name: string; symbol: string; start_date: string; streak: number; longest_days: number; last_slip: string | null; today: CheckIn | null };
type Habit = { id: number; title: string; emoji: string; done: number; goal_title?: string | null };
type Data = { date: string; summary: Tracker[]; logs: CheckIn[]; history: { date: string; checkins: number; clean: number; slips: number; habits: number }[]; consistency: { days7: number; days30: number; percent7: number; percent30: number } };
function dateKey() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }

export function SelfControlPage() {
  const client = useQueryClient();
  const today = dateKey();
  const [name, setName] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [symbol, setSymbol] = useState('◇');
  const [startDate, setStartDate] = useState(today);
  const [activeTracker, setActiveTracker] = useState<Tracker | null>(null);
  const [outcome, setOutcome] = useState<'clean' | 'slip'>('clean');
  const [urge, setUrge] = useState('0');
  const [trigger, setTrigger] = useState('');
  const [response, setResponse] = useState('');
  const [note, setNote] = useState('');
  const data = useQuery({ queryKey: ['self-control', today], queryFn: () => api<Data>('/self-control?date=' + today) });
  const habits = useQuery({ queryKey: ['habits', today], queryFn: () => api<Habit[]>('/habits?date=' + today) });
  const toggleHabit = useMutation({ mutationFn: (id: number) => api('/habits/' + id + '/toggle', json('POST', { date: today })), onSuccess: () => { void client.invalidateQueries({ queryKey: ['habits', today] }); void client.invalidateQueries({ queryKey: ['self-control', today] }); void client.invalidateQueries({ queryKey: ['overview'] }); } });
  const create = useMutation({
    mutationFn: () => api('/self-control', json('POST', { name, symbol, start_date: startDate })),
    onSuccess: () => { setName(''); setSymbol('◇'); setShowCreate(false); void client.invalidateQueries({ queryKey: ['self-control'] }); }
  });
  const checkin = useMutation({
    mutationFn: (entry: { trackerId: number; outcome: 'clean' | 'slip'; urge?: number; trigger?: string; response?: string; note?: string }) => api('/self-control/' + entry.trackerId + '/checkin', json('POST', { date: today, outcome: entry.outcome, urge_level: entry.urge ?? 0, trigger: entry.trigger ?? '', response: entry.response ?? '', note: entry.note ?? '' })),
    onSuccess: () => { setActiveTracker(null); setTrigger(''); setResponse(''); setNote(''); setUrge('0'); void client.invalidateQueries({ queryKey: ['self-control', today] }); }
  });
  const remove = useMutation({
    mutationFn: (id: number) => api('/self-control/' + id, { method: 'DELETE' }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['self-control', today] })
  });

  const totalTrackers = data.data?.summary.length ?? 0;
  const cleanToday = data.data?.summary.filter(item => item.today?.outcome === 'clean').length ?? 0;
  return <div className="stack self-control-page">
    <PageHeader eyebrow="PERSONAL DEVELOPMENT / PRIVATE" title="Self-Control & Streaks" description="A private space for the commitments you choose to keep or leave behind. Track progress honestly, without turning a difficult day into a verdict." action={<Button onClick={() => setShowCreate(true)}><Plus size={15}/> Add a habit</Button>}/>
    <div className="self-control-note surface-card"><span className="self-note-mark"><ShieldCheck size={19}/></span><div><strong>Progress is not perfection.</strong><p>A difficult day does not erase your effort. If you slip, record it honestly, notice what led to it, and begin again without punishing yourself. A day without a check-in stays unscored; it is never treated as a slip.</p></div><div className="self-note-stats"><span><b>{totalTrackers}</b><small>TRACKERS</small></span><span><b>{cleanToday}</b><small>CLEAN TODAY</small></span></div></div>
    <section className="self-rhythm-consistency">
      <div className="self-rhythm-metrics">
        <div><span className="module-kicker">ROLLING CONSISTENCY</span><b>{data.data?.consistency.percent7 ?? 0}%</b><small>{data.data?.consistency.days7 ?? 0}/7 days with real check-ins · last 7 days</small></div>
        <div><span className="module-kicker">30-DAY VIEW</span><b>{data.data?.consistency.percent30 ?? 0}%</b><small>{data.data?.consistency.days30 ?? 0}/30 days with real check-ins</small></div>
      </div>
      <div className="self-rhythm-heatmap-wrap"><div className="module-panel-head"><div><span className="module-kicker">LAST 30 DAYS</span><h2>Your check-in rhythm.</h2></div><small>Intensity reflects recorded activity, not a score.</small></div>
        <div className="self-rhythm-heatmap" aria-label="Thirty-day check-in heatmap">{(data.data?.history || []).map(day => <span key={day.date} className={day.checkins+day.habits===0?'':day.checkins+day.habits>=3?'is-high':day.checkins+day.habits>=2?'is-medium':'is-low'} title={day.date+' · '+(day.habits||0)+' routine check-ins · '+(day.checkins||0)+' self-control records'} />)}</div>
        <div className="self-rhythm-legend"><span>Less</span><i/><i/><i/><span>More</span></div>
      </div>
    </section>
    <Card className="self-positive-habits"><div className="module-panel-head"><div><span className="module-kicker">POSITIVE ROUTINES</span><h2>Habits worth building.</h2><p>Completed routines are counted from actual daily check-ins.</p></div><Link className="text-link" to="/rituals">Manage routines <span>→</span></Link></div>
      {habits.data?.length ? <div className="self-positive-list">{habits.data.map(habit=><label key={habit.id} className="self-positive-row"><input type="checkbox" checked={!!habit.done} disabled={toggleHabit.isPending} onChange={()=>toggleHabit.mutate(habit.id)}/><span>{habit.emoji||'✦'}</span><b>{habit.title}</b>{habit.goal_title&&<small>{habit.goal_title}</small>}</label>)}</div> : <EmptyState title="No positive routines yet." detail="Add a small repeatable practice in Habits & Streaks."/>}
    </Card>
    <div className="self-control-section-head"><div><span className="module-kicker">YOUR PERSONAL COMMITMENTS</span><h2>Your personal commitments.</h2></div><span className="module-count">{totalTrackers} TRACKERS</span></div>
    <div className="tracker-grid">
      {data.data?.summary.length ? data.data.summary.map(tracker => <Card key={tracker.id} className="tracker-card">
        <div className="tracker-card__top"><span className="tracker-symbol">{tracker.symbol}</span><button className="icon-button" onClick={() => { if (window.confirm('Delete this tracker and its history?')) remove.mutate(tracker.id); }} aria-label={'Delete ' + tracker.name}><Trash2 size={15}/></button></div>
        <h2>{tracker.name}</h2>
        <div className="tracker-count"><strong>{tracker.streak}</strong><span>verified clean check-ins</span></div>
        <div className="tracker-meta"><span>Longest: {tracker.longest_days} verified days</span><span>Started {tracker.start_date}</span></div>
        <div className={'tracker-status' + (tracker.today?.outcome === 'slip' ? ' tracker-status--slip' : '')}>{tracker.today ? (tracker.today.outcome === 'clean' ? 'Today marked clean' : 'A slip was recorded today') : 'No check-in recorded today'}</div>
        <div className="tracker-actions"><Button size="sm" onClick={() => checkin.mutate({trackerId:tracker.id,outcome:'clean'})} disabled={checkin.isPending}><ShieldCheck size={14}/> Mark today as clean</Button><Button size="sm" variant="secondary" onClick={() => {setActiveTracker(tracker);setOutcome('slip');}} disabled={checkin.isPending}><RotateCcw size={14}/> Record a slip</Button></div>
      </Card>) : <Card className="tracker-empty"><EmptyState title="A fresh place to begin." detail="Add a habit you want to leave behind. Your record is private, honest, and entirely yours."/></Card>}
    </div>
    <Card className="self-control-history"><div className="module-panel-head"><div><span className="module-kicker">PATTERNS, NOT JUDGEMENT</span><h2>Your recent check-ins.</h2></div><span className="module-count">PRIVATE RECORD</span></div>
      {data.data?.logs.length ? <div className="list-stack">{data.data.logs.map(log => <div className="list-row" key={log.id}><span className="session-mark">{log.outcome === 'clean' ? <ShieldCheck size={16}/> : <RotateCcw size={16}/>}</span><div className="list-row__body"><b>{log.tracker_symbol} {log.tracker_name} · {log.outcome === 'clean' ? 'Clean day' : 'Reset recorded'}</b><small>{log.log_date}{log.trigger ? ' · Trigger: ' + log.trigger : ''}{log.response ? ' · Response: ' + log.response : ''}</small></div><span className="list-row__meta">{log.urge_level ? 'Urge ' + log.urge_level + '/5' : ''}</span></div>)}</div> : <EmptyState title="No check-ins yet." detail="Your history will appear here as you record your days."/>}
    </Card>
    <div className="self-control-foot"><span>YOUR RECORD IS PRIVATE TO YOUR WORKSPACE.</span><span>HONESTY · PATIENCE · RETURN</span></div>
    {showCreate && <div className="modal-backdrop" role="presentation" onMouseDown={event => {if(event.target===event.currentTarget)setShowCreate(false);}}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="create-tracker-title"><div className="card-heading"><div><span className="eyebrow">NEW COMMITMENT</span><h2 id="create-tracker-title">Add a commitment to track.</h2></div><button className="icon-button" onClick={() => setShowCreate(false)} aria-label="Close">×</button></div><form className="form-stack" onSubmit={event => {event.preventDefault();if(name.trim())create.mutate();}}><Field label="Habit name"><TextInput value={name} onChange={event=>setName(event.target.value)} placeholder="What behaviour or commitment are you tracking?" required/></Field><div className="field-row"><Field label="Symbol"><TextInput value={symbol} onChange={event=>setSymbol(event.target.value)} maxLength={4}/></Field><Field label="Start date"><TextInput type="date" value={startDate} max={today} onChange={event=>setStartDate(event.target.value)} required/></Field></div>{create.isError && <p className="inline-error">{create.error.message}</p>}<div className="modal-actions"><Button type="submit" disabled={create.isPending||!name.trim()}>{create.isPending?'Creating…':'Create tracker'}</Button><Button type="button" variant="ghost" onClick={()=>setShowCreate(false)}>Cancel</Button></div></form></section></div>}
    {activeTracker && <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setActiveTracker(null); }}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="checkin-title">
      <div className="card-heading"><div><span className="eyebrow">DAILY CHECK-IN</span><h2 id="checkin-title">{activeTracker.name}</h2></div><button className="icon-button" onClick={() => setActiveTracker(null)} aria-label="Close check-in">×</button></div>
      <form className="form-stack" onSubmit={event => { event.preventDefault(); checkin.mutate({ trackerId: activeTracker.id, outcome, urge: Number(urge), trigger, response, note }); }}>
        <Field label="How did today go?"><select className="field-input" value={outcome} onChange={event => setOutcome(event.target.value as 'clean' | 'slip')}><option value="clean">Today was clean</option><option value="slip">Record a slip</option></select></Field>
        <Field label="Urge intensity (0–5)"><TextInput type="number" min="0" max="5" value={urge} onChange={event => setUrge(event.target.value)}/></Field>
        <Field label="What was the trigger or situation?"><TextInput value={trigger} onChange={event => setTrigger(event.target.value)} placeholder="Identify a trigger, context or pattern"/></Field>
        <Field label="Recovery action plan"><TextInput value={response} onChange={event => setResponse(event.target.value)} placeholder="What will you do next time, or what support would help?"/></Field>
        <Field label="Note"><TextArea value={note} onChange={event => setNote(event.target.value)} placeholder="Anything else worth remembering"/></Field>
        <div className="modal-actions"><Button type="submit" disabled={checkin.isPending}>{checkin.isPending ? 'Saving…' : outcome === 'slip' ? 'Save slip' : 'Mark today as clean'}</Button><Button type="button" variant="ghost" onClick={() => setActiveTracker(null)}>Cancel</Button></div>
      </form>
    </section></div>}
  </div>;
}