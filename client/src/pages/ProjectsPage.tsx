import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, CheckCircle2, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, json } from '../lib/api';
import { Button, Card, EmptyState, Field, PageHeader, TextArea, TextInput } from '../components/ui';
import { Cascade } from '../components/Cascade';

type Goal = { id: number; title: string };
type Milestone = { id: number; title: string; target_date: string | null; completed: number };
type Project = { id: number; title: string; description: string; status: string; target_date: string | null; goal_id: number | null; goal_title: string | null; open_tasks: number; milestones: Milestone[] };

export function ProjectsPage({ embedded = false }: { embedded?: boolean }) {
  const client = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [goalId, setGoalId] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [milestoneDrafts, setMilestoneDrafts] = useState<Record<number, string>>({});
  const [milestoneDateDrafts, setMilestoneDateDrafts] = useState<Record<number, string>>({});
  const projects = useQuery({ queryKey: ['projects'], queryFn: () => api<Project[]>('/projects') });
  const goals = useQuery({ queryKey: ['goals'], queryFn: () => api<Goal[]>('/goals') });
  const create = useMutation({
    mutationFn: () => api('/projects', json('POST', { title, description, goal_id: goalId || null, target_date: targetDate || null })),
    onSuccess: () => { setTitle(''); setDescription(''); setGoalId(''); setTargetDate(''); void client.invalidateQueries({ queryKey: ['projects'] }); }
  });
  const update = useMutation({
    mutationFn: ({ project, status }: { project: Project; status: string }) => api('/projects/' + project.id, json('PATCH', { status })),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['projects'] })
  });
  const addMilestone = useMutation({
    mutationFn: ({ projectId, value, targetDate }: { projectId: number; value: string; targetDate: string }) => api('/projects/' + projectId + '/milestones', json('POST', { title: value, target_date: targetDate || null })),
    onSuccess: (_data, variables) => { setMilestoneDrafts(current => ({ ...current, [variables.projectId]: '' })); setMilestoneDateDrafts(current => ({ ...current, [variables.projectId]: '' })); void client.invalidateQueries({ queryKey: ['projects'] }); }
  });
  const toggleMilestone = useMutation({
    mutationFn: (item: Milestone) => api('/project-milestones/' + item.id, json('PATCH', { completed: !item.completed })),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['projects'] })
  });

  return <Cascade className="stack">
    {!embedded && <PageHeader eyebrow="PLAN / BUILD" title="Projects" description="Give meaningful goals a body of work. Projects turn direction into milestones and finishable actions." />}
    <Card>
      <details className="atlas-add-disclosure atlas-create-disclosure">
        <summary>+ Add project</summary>
        <div className="card-heading"><div><h2>{embedded ? 'Create a project' : 'Start a project'}</h2><p>Define the outcome and scope.</p></div></div>
        <form className="form-stack" onSubmit={event => { event.preventDefault(); if (title.trim()) create.mutate(); }}>
        <Field label="Project name"><TextInput value={title} onChange={event => setTitle(event.target.value)} placeholder="What are you building or changing?" required /></Field>
        <Field label="Description"><TextArea value={description} onChange={event => setDescription(event.target.value)} placeholder="What does done look like?" /></Field>
        <div className="field-row">
          <Field label="Related goal"><select className="field-input" value={goalId} onChange={event => setGoalId(event.target.value)}><option value="">Standalone project</option>{goals.data?.map(goal => <option key={goal.id} value={goal.id}>{goal.title}</option>)}</select></Field>
          <Field label="Target date"><TextInput type="date" value={targetDate} onChange={event => setTargetDate(event.target.value)} /></Field>
        </div>
        <div><Button type="submit" disabled={create.isPending || !title.trim()}><Plus size={16} /> Create project</Button></div>
        </form>
      </details>
      {create.isError && <p className="inline-error">{create.error.message}</p>}
    </Card>
    <div className="stack">
      {projects.data?.length ? projects.data.map(project => <div id={'atlas-project-'+project.id} className="atlas-constellation-target" key={project.id}><Card className="project-card">
        <div className="project-card__top"><span className="status-pill">{project.status}</span><span className="project-card__target">{project.target_date ? 'Target ' + project.target_date : 'No target date'}</span></div>
        <h2>{project.title}</h2>
        <p className="project-description">{project.description || 'Add a description when you want to make the outcome more specific.'}</p>
        <div className="project-meta"><span>{project.goal_title ? 'Goal · ' + project.goal_title : 'Standalone project'}</span><span>{project.open_tasks} open tasks</span><Link className="text-link" to="/execution">View tasks <ArrowUpRight size={14} /></Link></div>
        <div className="milestone-section">
          <div className="card-heading"><div><h3>Milestones</h3><p>Checkpoints that show the work moving forward.</p></div><small>{project.milestones.filter(item => item.completed).length}/{project.milestones.length}</small></div>
          {project.milestones.length ? <div className="list-stack">{project.milestones.map(item => <div className="list-row" key={item.id}><input className="check-control" type="checkbox" checked={!!item.completed} onChange={() => toggleMilestone.mutate(item)} aria-label={'Complete milestone ' + item.title} /><div className="list-row__body"><b className={item.completed ? 'is-complete' : ''}>{item.title}</b></div><span className="list-row__meta">{item.target_date || ''}</span></div>)}</div> : <p className="muted">No milestones yet.</p>}
          <details className="atlas-add-disclosure atlas-inline-add"><summary>+ Add milestone</summary>
            <form className="form-row milestone-form" onSubmit={event => { event.preventDefault(); const value = milestoneDrafts[project.id]?.trim(); if (value) addMilestone.mutate({ projectId: project.id, value, targetDate: milestoneDateDrafts[project.id] || '' }); }}>
              <Field label="Milestone"><TextInput value={milestoneDrafts[project.id] || ''} onChange={event => setMilestoneDrafts(current => ({ ...current, [project.id]: event.target.value }))} placeholder="A meaningful checkpoint" /></Field><Field label="Target date"><TextInput type="date" value={milestoneDateDrafts[project.id] || ""} onChange={event => setMilestoneDateDrafts(current => ({ ...current, [project.id]: event.target.value }))} /></Field>
              <Button type="submit" variant="secondary" disabled={addMilestone.isPending || !milestoneDrafts[project.id]?.trim()}><Plus size={15} /> Add</Button>
            </form>
          </details>
        </div>
        <div className="project-card__actions"><Button variant="ghost" onClick={() => update.mutate({ project, status: project.status === 'completed' ? 'active' : 'completed' })}>{project.status === 'completed' ? 'Reopen project' : <><CheckCircle2 size={15} /> Mark complete</>}</Button></div>
      </Card></div>) : <Card><EmptyState title="No projects yet." detail="Create a project to connect a goal to milestones and tasks. Your standalone tasks still work without one." /></Card>}
    </div>
  </Cascade>;
}