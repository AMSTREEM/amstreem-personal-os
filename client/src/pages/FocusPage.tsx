import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock3, Pause, Play, RotateCcw } from 'lucide-react';
import { api, json } from '../lib/api';
import { Button, Card, EmptyState, Field, PageHeader, TextArea, TextInput } from '../components/ui';

type Session = { id: number; session_date: string; minutes: number; focus: string; reflection: string; task_title?: string | null; project_title?: string | null };
type Task = { id: number; title: string };
type Project = { id: number; title: string };
type StoredTimer = { remaining: number; deadline: number | null };
const TIMER_KEY = 'atlas-focus-timer-v1';
const DEFAULT_SECONDS = 25 * 60;

function readTimer(): StoredTimer {
  try {
    const value = JSON.parse(localStorage.getItem(TIMER_KEY) || 'null') as StoredTimer | null;
    if (value && Number.isFinite(value.remaining) && (value.deadline === null || Number.isFinite(value.deadline))) {
      return { remaining: Math.max(0, Math.min(600 * 60, Math.floor(value.remaining))), deadline: value.deadline };
    }
  } catch { /* Ignore a malformed local timer and start cleanly. */ }
  return { remaining: DEFAULT_SECONDS, deadline: null };
}

export function FocusPage() {
  const client = useQueryClient();
  const [focus, setFocus] = useState('');
  const [minutes, setMinutes] = useState('25');
  const [reflection, setReflection] = useState('');
  const [taskId, setTaskId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [timer, setTimer] = useState<StoredTimer>(readTimer);
  const [now, setNow] = useState(() => Date.now());
  const [completed, setCompleted] = useState(false);
  const sessions = useQuery({ queryKey: ['sessions'], queryFn: () => api<Session[]>('/sessions') });
  const tasks = useQuery({ queryKey: ['tasks'], queryFn: () => api<Task[]>('/tasks') });
  const projects = useQuery({ queryKey: ['projects'], queryFn: () => api<Project[]>('/projects') });

  const remaining = timer.deadline === null ? timer.remaining : Math.max(0, Math.ceil((timer.deadline - now) / 1000));
  const running = timer.deadline !== null && remaining > 0;
  useEffect(() => {
    if (!running) return;
    const tick = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(tick);
  }, [running]);
  useEffect(() => {
    if (timer.deadline !== null && remaining === 0) {
      setTimer({ remaining: 0, deadline: null });
      setCompleted(true);
    }
  }, [timer.deadline, remaining]);
  useEffect(() => {
    if (timer.deadline !== null || timer.remaining !== DEFAULT_SECONDS) localStorage.setItem(TIMER_KEY, JSON.stringify(timer));
    else localStorage.removeItem(TIMER_KEY);
  }, [timer]);

  const create = useMutation({
    mutationFn: () => api<Session>('/sessions', json('POST', { focus, minutes: Number(minutes), reflection, task_id: taskId || null, project_id: projectId || null })),
    onSuccess: () => { setFocus(''); setReflection(''); setTaskId(''); setProjectId(''); void client.invalidateQueries({ queryKey: ['sessions'] }); void client.invalidateQueries({ queryKey: ['overview'] }); void client.invalidateQueries({ queryKey: ['intelligence'] }); }
  });
  const total = sessions.data?.reduce((sum, item) => sum + item.minutes, 0) || 0;
  const timerText = String(Math.floor(remaining / 60)).padStart(2, '0') + ':' + String(remaining % 60).padStart(2, '0');
  const timerLabel = useMemo(() => running ? 'Focus session in progress' : completed ? 'Focus block complete' : 'Focus timer ready', [running, completed]);

  function startTimer() {
    if (remaining <= 0) return;
    setCompleted(false);
    setNow(Date.now());
    setTimer({ remaining, deadline: Date.now() + remaining * 1000 });
  }
  function pauseTimer() {
    setTimer({ remaining, deadline: null });
    setNow(Date.now());
  }
  function resetTimer() {
    const seconds = Math.max(1, Math.min(600, Number(minutes) || 25)) * 60;
    setTimer({ remaining: seconds, deadline: null });
    setCompleted(false);
  }

  return <div className="stack">
    <PageHeader eyebrow="PRACTICE / ATTENTION" title="Focus room" description="Protect a block of attention, connect it to meaningful work, and keep an honest record." />
    <div className="stat-grid stat-grid--three">
      <div className="stat-card"><div className="stat-card__top">RECENT SESSIONS</div><strong>{sessions.data?.length ?? '—'}</strong><small>Recorded focus blocks</small></div>
      <div className="stat-card"><div className="stat-card__top">TOTAL TIME</div><strong>{Math.round(total / 60 * 10) / 10}h</strong><small>Across your recent records</small></div>
      <div className="stat-card"><div className="stat-card__top">AVERAGE BLOCK</div><strong>{sessions.data?.length ? Math.round(total / sessions.data.length) + 'm' : '—'}</strong><small>Per recorded session</small></div>
    </div>
    <Card className="focus-timer-card">
      <div className="card-heading"><div><h2>Settle into one thing.</h2><p>A dependable timer that survives refreshes and background tabs.</p></div><Clock3 size={18} /></div>
      <div className="timer-display" role="timer" aria-label={timerLabel}>{timerText}</div>
      <p className="focus-timer-status" aria-live="polite">{running ? 'Stay with the task. Your timer keeps its place if you leave this page.' : completed ? 'Your focus block is complete. Take a breath, then record what you worked on.' : 'Choose a duration below, then begin when you are ready.'}</p>
      <div className="timer-controls"><Button onClick={running ? pauseTimer : startTimer} disabled={remaining === 0 && !completed}>{running ? <><Pause size={15} /> Pause</> : <><Play size={15} /> {completed ? 'Start again' : 'Start focus'}</>}</Button><Button variant="ghost" onClick={resetTimer}><RotateCcw size={15} /> Reset</Button></div>
    </Card>
    <Card>
      <div className="card-heading"><div><h2>Record a focus session</h2><p>Only save the time you actually spent. Timer completion does not create a record automatically.</p></div></div>
      <form className="form-stack" onSubmit={event => { event.preventDefault(); if (focus.trim() && Number(minutes) > 0 && Number(minutes) <= 600) create.mutate(); }}>
        <Field label="What did you focus on?"><TextInput value={focus} onChange={event => setFocus(event.target.value)} placeholder="The work you gave your attention to" required /></Field>
        <div className="field-row">
          <Field label="Duration in minutes"><TextInput type="number" min="1" max="600" value={minutes} onChange={event => { setMinutes(event.target.value); if (!running) { const seconds = Math.max(1, Math.min(600, Number(event.target.value) || 25)) * 60; setTimer({ remaining: seconds, deadline: null }); setCompleted(false); } }} required /></Field>
          <Field label="Related task"><select className="field-input" value={taskId} onChange={event => setTaskId(event.target.value)}><option value="">No linked task</option>{tasks.data?.map(task => <option key={task.id} value={task.id}>{task.title}</option>)}</select></Field>
        </div>
        <Field label="Related project"><select className="field-input" value={projectId} onChange={event => setProjectId(event.target.value)}><option value="">No linked project</option>{projects.data?.map(project => <option key={project.id} value={project.id}>{project.title}</option>)}</select></Field>
        <Field label="Reflection (optional)"><TextArea value={reflection} onChange={event => setReflection(event.target.value)} placeholder="What moved forward? What did you learn?" /></Field>
        <div><Button type="submit" disabled={create.isPending || !focus.trim() || !(Number(minutes) > 0 && Number(minutes) <= 600)}>{create.isPending ? 'Saving…' : 'Save session'}</Button></div>
      </form>
      {create.isError && <p className="inline-error">{create.error.message}</p>}
    </Card>
    <Card>
      <div className="card-heading"><div><h2>Recent sessions</h2><p>Your focus history.</p></div></div>
      {sessions.data?.length ? <div className="list-stack">{sessions.data.map(item => <div className="list-row" key={item.id}><span className="session-mark"><Clock3 size={16} /></span><div className="list-row__body"><b>{item.focus}</b><small>{item.session_date}{item.task_title ? ' · ' + item.task_title : ''}{item.project_title ? ' · ' + item.project_title : ''}{item.reflection ? ' · ' + item.reflection : ''}</small></div><span className="list-row__meta">{item.minutes} min</span></div>)}</div> : <EmptyState title="Your focus history starts here." detail="Record a completed session to build a useful picture of your attention over time." />}
    </Card>
  </div>;
}
