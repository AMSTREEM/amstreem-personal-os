import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, BookOpen, CheckCircle2, Clock3, FolderKanban, Heart, ListChecks, Plus, Target } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, json } from '../lib/api';
import { Button, Card, EmptyState, Field, PageHeader, TextArea, TextInput } from '../components/ui';

type Goal = { id: number; title: string; detail: string; target_date: string | null; status: string; category?: string; focus_minutes: number };
type Project = { id: number; title: string; goal_id: number | null; status: string; open_tasks: number; milestones: { id: number; title: string; completed: number }[] };
type Task = { id: number; title: string; goal_id: number | null; project_id: number | null; done: number; due_date: string | null };
type Habit = { id: number; title: string; goal_id?: number | null; goal_title?: string | null };
type Path = { id:number; title:string; goal_id:number|null; lessons:{id:number;status:string}[] };

export function GoalsPage() {
  const client = useQueryClient();
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [category, setCategory] = useState('Personal');
  const goals = useQuery({ queryKey: ['goals'], queryFn: () => api<Goal[]>('/goals') });
  const projects = useQuery({ queryKey: ['projects'], queryFn: () => api<Project[]>('/projects') });
  const tasks = useQuery({ queryKey: ['tasks'], queryFn: () => api<Task[]>('/tasks') });
  const habits = useQuery({ queryKey: ['habits'], queryFn: () => api<Habit[]>('/habits') });
  const paths = useQuery({ queryKey: ['learning-paths'], queryFn: () => api<Path[]>('/learning/paths') });
  const create = useMutation({
    mutationFn: () => api<Goal>('/goals', json('POST', { title, detail, target_date: targetDate || null, category })),
    onSuccess: () => { setTitle(''); setDetail(''); setTargetDate(''); setCategory('Personal'); void client.invalidateQueries({ queryKey: ['goals'] }); }
  });
  const toggleMilestone = useMutation({
    mutationFn: ({id,completed}:{id:number;completed:boolean}) => api('/project-milestones/'+id,json('PATCH',{completed})),
    onSuccess: () => { void client.invalidateQueries({queryKey:['projects']}); void client.invalidateQueries({queryKey:['goals']}); void client.invalidateQueries({queryKey:['overview']}); }
  });
  const workByGoal = useMemo(() => {
    return new Map((goals.data || []).map(goal => {
      const linkedProjects = (projects.data || []).filter(project => project.goal_id === goal.id);
      const projectIds = new Set(linkedProjects.map(project => project.id));
      const linkedTasks = (tasks.data || []).filter(task => task.goal_id === goal.id || (task.project_id !== null && projectIds.has(task.project_id)));
      const linkedHabits = (habits.data || []).filter(habit => habit.goal_id === goal.id);
      const linkedPaths = (paths.data || []).filter(path => path.goal_id === goal.id);
      const linkedLessons = linkedPaths.flatMap(path => path.lessons || []);
      const milestones = linkedProjects.flatMap(project => project.milestones || []);
      const completed = linkedTasks.filter(task => !!task.done).length + milestones.filter(item => !!item.completed).length + linkedLessons.filter(lesson => lesson.status === 'Completed').length;
      const total = linkedTasks.length + milestones.length + linkedLessons.length;
      return [goal.id, { projects: linkedProjects, tasks: linkedTasks, habits: linkedHabits, paths: linkedPaths, lessons: linkedLessons, completed, total, focusMinutes: goal.focus_minutes || 0, progress: total ? Math.round(completed / total * 100) : 0 }];
    }));
  }, [goals.data, projects.data, tasks.data, habits.data, paths.data]);

  return <div className="stack">
    <PageHeader eyebrow="DIRECTION / LONG GAME" title="Goals" description="Keep your meaningful outcomes visible. Connect each one to projects, milestones and actionable tasks." />
    <Card>
      <div className="card-heading"><div><h2>Set a direction</h2><p>Describe an outcome, not a vague aspiration.</p></div></div>
      <form className="form-stack" onSubmit={event => { event.preventDefault(); if (title.trim()) create.mutate(); }}>
        <Field label="Goal"><TextInput value={title} onChange={event => setTitle(event.target.value)} placeholder="What do you want to make real?" required /></Field>
        <Field label="Why it matters"><TextArea value={detail} onChange={event => setDetail(event.target.value)} placeholder="Add the context that will help you stay oriented." /></Field>
        <Field label="Category"><select className="field-input" value={category} onChange={event => setCategory(event.target.value)}><option>Personal</option><option>Faith</option><option>Health</option><option>Learning</option><option>Career</option><option>Business</option><option>Finance</option></select></Field>
        <Field label="Target date"><TextInput type="date" value={targetDate} onChange={event => setTargetDate(event.target.value)} /></Field>
        <div><Button type="submit" disabled={create.isPending || !title.trim()}><Plus size={16} /> Add goal</Button></div>
      </form>
      {create.isError && <p className="inline-error">{create.error.message}</p>}
    </Card>
    <div className="goal-grid">
      {goals.data?.length ? goals.data.map(goal => {
        const work = workByGoal.get(goal.id);
        return <Card key={goal.id} className="goal-card goal-card--connected">
          <div className="goal-card__top"><span className="status-pill">{goal.category || 'Personal'}</span><Target size={17}/></div>
          <h2>{goal.title}</h2><p>{goal.detail || 'No additional context yet.'}</p>
          <div className="goal-work-summary">
            <div><FolderKanban size={14}/><b>{work?.projects.length ?? 0}</b><small>projects</small></div>
            <div><ListChecks size={14}/><b>{work?.tasks.length ?? 0}</b><small>tasks</small></div>
            <div><Heart size={14}/><b>{work?.habits.length ?? 0}</b><small>habits</small></div>
            <div><CheckCircle2 size={14}/><b>{work?.completed ?? 0}/{work?.total ?? 0}</b><small>actions done</small></div>
            <div className="goal-focus-metric"><Clock3 size={14}/><b>{work?.focusMinutes ?? 0}m</b><small>focus invested</small></div>
          </div>
          <div className="goal-progress-copy"><span>Evidence-based progress</span><b>{work?.total ? work.progress + '%' : 'No linked evidence yet'}</b></div>
          <div className="goal-progress-track"><span style={{width:(work?.progress ?? 0)+'%'}}/></div>
          {work?.projects.length || work?.tasks.length || work?.paths.length ? <div className="goal-linked-list">
            {work.projects.slice(0,2).map(project => <div key={'p'+project.id}><FolderKanban size={13}/><span>{project.title}</span><small>{project.status}</small></div>)}
            {work.projects.flatMap(project=>project.milestones.map(milestone=><label className="room4-goal-milestone" key={'m'+milestone.id}><input type="checkbox" checked={!!milestone.completed} disabled={toggleMilestone.isPending} onChange={event=>toggleMilestone.mutate({id:milestone.id,completed:event.target.checked})}/><span>{milestone.title}</span><small>{milestone.completed?'Done':'Milestone'}</small></label>)).slice(0,6)}
            {work.tasks.filter(task => !task.done).slice(0,2).map(task => <div key={'t'+task.id}><ListChecks size={13}/><span>{task.title}</span><small>{task.due_date || 'Open'}</small></div>)}
            {work.paths.slice(0,2).map(path => <div key={'l'+path.id}><BookOpen size={13}/><span>{path.title}</span><small>{path.lessons.filter(lesson=>lesson.status==='Completed').length}/{path.lessons.length} lessons</small></div>)}
          </div> : <p className="goal-no-work">Give this goal a first step by connecting a project or task.</p>}
          <div className="goal-card__bottom"><span>{goal.target_date ? 'Target ' + goal.target_date : 'No target date'}</span><span>{work?.completed ?? 0} of {work?.total ?? 0} verified actions</span></div>
          <div className="goal-link-actions"><Link to="/projects" className="text-link">Add project <ArrowRight size={13}/></Link><Link to="/tasks" className="text-link">Add task <ArrowRight size={13}/></Link></div>
        </Card>;
      }) : <Card><EmptyState title="Give your effort a direction." detail="Your active goals will live here. Start with one outcome that genuinely matters." /></Card>}
    </div>
  </div>;
}
