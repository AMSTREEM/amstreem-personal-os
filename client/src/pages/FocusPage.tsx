import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock3, Pause, Play, RotateCcw } from 'lucide-react';
import { api, json } from '../lib/api';
import { Button, Card, EmptyState, Field, PageHeader, TextArea, TextInput } from '../components/ui';

type Session = { id: number; session_date: string; minutes: number; focus: string; reflection: string; task_title?: string | null; project_title?: string | null };
type Task = { id: number; title: string };
type Project = { id: number; title: string };

export function FocusPage() {
  const client = useQueryClient();
  const [focus, setFocus] = useState('');
  const [minutes, setMinutes] = useState('25');
  const [reflection, setReflection] = useState('');
  const [taskId, setTaskId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const sessions = useQuery({ queryKey: ['sessions'], queryFn: () => api<Session[]>('/sessions') });
  const tasks = useQuery({ queryKey: ['tasks'], queryFn: () => api<Task[]>('/tasks') });
  const projects = useQuery({ queryKey: ['projects'], queryFn: () => api<Project[]>('/projects') });

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setSecondsLeft(value => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [running]);
  useEffect(() => { if (secondsLeft === 0) setRunning(false); }, [secondsLeft]);

  const create = useMutation({
    mutationFn: () => api<Session>('/sessions', json('POST', { focus, minutes: Number(minutes), reflection, task_id: taskId || null, project_id: projectId || null })),
    onSuccess: () => { setFocus(''); setReflection(''); setTaskId(''); setProjectId(''); void client.invalidateQueries({ queryKey: ['sessions'] }); void client.invalidateQueries({ queryKey: ['overview'] }); void client.invalidateQueries({ queryKey: ['intelligence'] }); }
  });
  const total = sessions.data?.reduce((sum, item) => sum + item.minutes, 0) || 0;
  const timerText = String(Math.floor(secondsLeft / 60)).padStart(2, '0') + ':' + String(secondsLeft % 60).padStart(2, '0');

  return <div className="stack">
    <PageHeader eyebrow="PRACTICE / ATTENTION" title="Focus room" description="Protect a block of attention, connect it to meaningful work, and keep an honest record." />
    <div className="stat-grid stat-grid--three">
      <div className="stat-card"><div className="stat-card__top">RECENT SESSIONS</div><strong>{sessions.data?.length ?? '—'}</strong><small>Recorded focus blocks</small></div>
      <div className="stat-card"><div className="stat-card__top">TOTAL TIME</div><strong>{Math.round(total / 60 * 10) / 10}h</strong><small>Across your recent records</small></div>
      <div className="stat-card"><div className="stat-card__top">AVERAGE BLOCK</div><strong>{sessions.data?.length ? Math.round(total / sessions.data.length) + 'm' : '—'}</strong><small>Per recorded session</small></div>
    </div>
    <Card className="focus-timer-card">
      <div className="card-heading"><div><h2>Settle into one thing.</h2><p>A simple timer. No scores, no pressure.</p></div><Clock3 size={18} /></div>
      <div className="timer-display" aria-live="polite">{timerText}</div>
      <div className="timer-controls"><Button onClick={() => setRunning(value => !value)} disabled={secondsLeft === 0}>{running ? <><Pause size={15} /> Pause</> : <><Play size={15} /> Start focus</>}</Button><Button variant="ghost" onClick={() => { setRunning(false); setSecondsLeft(Math.max(1, Number(minutes) || 25) * 60); }}><RotateCcw size={15} /> Reset</Button></div>
      {secondsLeft === 0 && <p className="timer-complete">Your focus block is complete. Take a breath, then record what you worked on below.</p>}
    </Card>
    <Card>
      <div className="card-heading"><div><h2>Record a focus session</h2><p>Only save the time you actually spent.</p></div></div>
      <form className="form-stack" onSubmit={event => { event.preventDefault(); if (focus.trim()) create.mutate(); }}>
        <Field label="What did you focus on?"><TextInput value={focus} onChange={event => setFocus(event.target.value)} placeholder="The work you gave your attention to" required /></Field>
        <div className="field-row">
          <Field label="Duration in minutes"><TextInput type="number" min="1" max="600" value={minutes} onChange={event => { setMinutes(event.target.value); if (!running) setSecondsLeft(Math.max(1, Number(event.target.value) || 25) * 60); }} required /></Field>
          <Field label="Related task"><select className="field-input" value={taskId} onChange={event => setTaskId(event.target.value)}><option value="">No linked task</option>{tasks.data?.map(task => <option key={task.id} value={task.id}>{task.title}</option>)}</select></Field>
        </div>
        <Field label="Related project"><select className="field-input" value={projectId} onChange={event => setProjectId(event.target.value)}><option value="">No linked project</option>{projects.data?.map(project => <option key={project.id} value={project.id}>{project.title}</option>)}</select></Field>
        <Field label="Reflection (optional)"><TextArea value={reflection} onChange={event => setReflection(event.target.value)} placeholder="What moved forward? What did you learn?" /></Field>
        <div><Button type="submit" disabled={create.isPending || !focus.trim()}>{create.isPending ? 'Saving…' : 'Save session'}</Button></div>
      </form>
      {create.isError && <p className="inline-error">{create.error.message}</p>}
    </Card>
    <Card>
      <div className="card-heading"><div><h2>Recent sessions</h2><p>Your focus history.</p></div></div>
      {sessions.data?.length ? <div className="list-stack">{sessions.data.map(item => <div className="list-row" key={item.id}><span className="session-mark"><Clock3 size={16} /></span><div className="list-row__body"><b>{item.focus}</b><small>{item.session_date}{item.task_title ? ' · ' + item.task_title : ''}{item.project_title ? ' · ' + item.project_title : ''}{item.reflection ? ' · ' + item.reflection : ''}</small></div><span className="list-row__meta">{item.minutes} min</span></div>)}</div> : <EmptyState title="Your focus history starts here." detail="Record a completed session to build a useful picture of your attention over time." />}
    </Card>
  </div>;
}