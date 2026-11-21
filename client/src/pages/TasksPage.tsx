import { Cascade } from '../components/Cascade';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { api, json } from '../lib/api';
import { Button, Card, EmptyState, Field, PageHeader, TextInput } from '../components/ui';

type Task = { id: number; title: string; detail: string; category: string; due_date: string | null; done: number; project_title?: string | null; goal_title?: string | null };
type Project = { id: number; title: string };
type Goal = { id: number; title: string };

export function TasksPage() {
  const client = useQueryClient();
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [projectId, setProjectId] = useState('');
  const [goalId, setGoalId] = useState('');
  const projects = useQuery({ queryKey: ['projects'], queryFn: () => api<Project[]>('/projects') });
  const goals = useQuery({ queryKey: ['goals'], queryFn: () => api<Goal[]>('/goals') });
  const tasks = useQuery({ queryKey: ['tasks'], queryFn: () => api<Task[]>('/tasks') });
  const create = useMutation({
    mutationFn: () => api<Task>('/tasks', json('POST', { title, detail, due_date: dueDate || null, project_id: projectId || null, goal_id: goalId || null })),
    onSuccess: () => { setTitle(''); setDetail(''); setDueDate(''); setProjectId(''); setGoalId(''); void client.invalidateQueries({ queryKey: ['tasks'] }); void client.invalidateQueries({ queryKey: ['overview'] }); }
  });
  const update = useMutation({
    mutationFn: ({ task, done }: { task: Task; done: boolean }) => api('/tasks/' + task.id, json('PATCH', { done })),
    onSuccess: () => { void client.invalidateQueries({ queryKey: ['tasks'] }); void client.invalidateQueries({ queryKey: ['overview'] }); }
  });
  const remove = useMutation({
    mutationFn: (id: number) => api('/tasks/' + id, { method: 'DELETE' }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['tasks'] })
  });

  return <Cascade className="stack">
    <PageHeader eyebrow="PLAN / EXECUTION" title="Tasks" description="Turn intentions into clear, finishable next actions." />
    <Card>
      <div className="card-heading"><div><h2>Capture a task</h2><p>Keep it specific enough to act on.</p></div></div>
      <form className="capture-form" onSubmit={event => { event.preventDefault(); if (title.trim()) create.mutate(); }}>
        <Field label="Task"><TextInput value={title} onChange={event => setTitle(event.target.value)} placeholder="What needs to move forward?" required /></Field>
        <Field label="A little context"><TextInput value={detail} onChange={event => setDetail(event.target.value)} placeholder="Optional details" /></Field>
        <Field label="Due date"><TextInput type="date" value={dueDate} onChange={event => setDueDate(event.target.value)} /></Field>
        <Field label="Project (optional)"><select className="field-input" value={projectId} onChange={event => setProjectId(event.target.value)}><option value="">No project</option>{projects.data?.map(project => <option value={project.id} key={project.id}>{project.title}</option>)}</select></Field>
        <Field label="Goal (optional)"><select className="field-input" value={goalId} onChange={event => setGoalId(event.target.value)}><option value="">No goal</option>{goals.data?.map(goal => <option value={goal.id} key={goal.id}>{goal.title}</option>)}</select></Field>
        <Button type="submit" disabled={create.isPending || !title.trim()}><Plus size={16} /> Add task</Button>
      </form>
      {create.isError && <p className="inline-error">{create.error.message}</p>}
    </Card>
    <Card>
      <div className="card-heading"><div><h2>Your task list</h2><p>{tasks.data?.filter(task => !task.done).length || 0} still open</p></div></div>
      {tasks.isLoading ? <p className="muted">Loading tasks…</p> : tasks.data?.length ? <div className="list-stack">{tasks.data.map(task => <div className="list-row" key={task.id}><input className="check-control" type="checkbox" checked={!!task.done} onChange={event => update.mutate({ task, done: event.target.checked })} aria-label={'Complete ' + task.title} /><div className="list-row__body"><b className={task.done ? 'is-complete' : ''}>{task.title}</b>{(task.detail || task.project_title || task.goal_title) && <small>{[task.detail, task.project_title, task.goal_title].filter(Boolean).join(' · ')}</small>}</div><span className="list-row__meta">{task.due_date || 'No date'}</span><button className="icon-button" onClick={() => { if (window.confirm('Delete this task?')) remove.mutate(task.id); }} aria-label={'Delete ' + task.title}><Trash2 size={15} /></button></div>)}</div> : <EmptyState title="A clean slate." detail="Capture the next action that would make a meaningful difference." />}
    </Card>
  </Cascade>;
}