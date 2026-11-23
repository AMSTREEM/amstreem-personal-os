import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, BookOpen, CheckCircle2, Clock3, FolderKanban, Heart, ListChecks, Plus, Target } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ProjectsPage } from './ProjectsPage';
import { LearningPage } from './LearningPage';
import { api, json } from '../lib/api';
import { Button, Card, EmptyState, Field, PageHeader, TextArea, TextInput } from '../components/ui';
import { SpatialTiltCard } from '../components/fx/SpatialTiltCard';
import { Cascade } from '../components/Cascade';
import { LifeConstellation, triggerEnergyVortex } from '../components/fx/AtlasEngines';

type Goal = { id: number; title: string; detail: string; target_date: string | null; status: string; category?: string; horizon?:'short-term'|'long-term'; focus_minutes: number };
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
  const [horizon,setHorizon]=useState<'short-term'|'long-term'>('long-term');
  const [activeWorkspace,setActiveWorkspace]=useState<'goals'|'projects'|'learning'|'all'>('all');
  const [pendingConstellationTarget,setPendingConstellationTarget]=useState<{kind:'goal'|'project'|'learning';id:number}|null>(null);
  const goals = useQuery({ queryKey: ['goals'], queryFn: () => api<Goal[]>('/goals') });
  const projects = useQuery({ queryKey: ['projects'], queryFn: () => api<Project[]>('/projects') });
  const tasks = useQuery({ queryKey: ['tasks'], queryFn: () => api<Task[]>('/tasks') });
  const habits = useQuery({ queryKey: ['habits'], queryFn: () => api<Habit[]>('/habits') });
  const paths = useQuery({ queryKey: ['learning-paths'], queryFn: () => api<Path[]>('/learning/paths') });
  const create = useMutation({
    mutationFn: () => api<Goal>('/goals', json('POST', { title, detail, target_date: targetDate || null, category, horizon })),
    onSuccess: () => { setTitle(''); setDetail(''); setTargetDate(''); setCategory('Personal'); setHorizon('long-term'); void client.invalidateQueries({ queryKey: ['goals'] }); }
  });
  const toggleMilestone = useMutation({
    mutationFn: ({id,completed}:{id:number;completed:boolean}) => api('/project-milestones/'+id,json('PATCH',{completed})),
    onSuccess: (_data, variables) => { if (variables.completed) triggerEnergyVortex(window.innerWidth * .5, window.innerHeight * .38); void client.invalidateQueries({queryKey:['projects']}); void client.invalidateQueries({queryKey:['goals']}); void client.invalidateQueries({queryKey:['overview']}); }
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

  useEffect(() => {
    const handleConstellationSelect = (event: Event) => {
      const detail = (event as CustomEvent<{kind:'goal'|'project'|'learning';id:number}>).detail;
      if (!detail) return;
      setActiveWorkspace(detail.kind === 'goal' ? 'goals' : detail.kind === 'project' ? 'projects' : 'learning');
      setPendingConstellationTarget(detail);
    };
    window.addEventListener('atlas:constellation-select', handleConstellationSelect);
    return () => window.removeEventListener('atlas:constellation-select', handleConstellationSelect);
  }, []);
  useEffect(() => {
    if (!pendingConstellationTarget) return;
    const target = document.getElementById('atlas-' + pendingConstellationTarget.kind + '-' + pendingConstellationTarget.id);
    if (!target) return;
    target.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
    target.classList.remove('atlas-constellation-highlight');
    void target.offsetWidth;
    target.classList.add('atlas-constellation-highlight');
    window.setTimeout(() => target.classList.remove('atlas-constellation-highlight'), 1900);
    setPendingConstellationTarget(null);
  }, [activeWorkspace,pendingConstellationTarget]);

  return <Cascade className="stack growth-horizon-layout goals-horizon">
    <PageHeader eyebrow="DIRECTION / LONG GAME" title="Goals & Milestones" description="Keep meaningful outcomes visible, with progress earned through linked tasks, completed lessons and project milestones." />
    <LifeConstellation goals={(goals.data||[]).map(({id,title})=>({id,title}))} projects={(projects.data||[]).map(({id,title,goal_id})=>({id,title,goal_id}))} paths={(paths.data||[]).map(({id,title,goal_id})=>({id,title,goal_id}))} />
    <nav className="growth-workspace-switcher" aria-label="Choose Growth workspace">
      {([{id:'goals',label:'Goals'},{id:'projects',label:'Projects'},{id:'learning',label:'Learning Paths'},{id:'all',label:'Show All'}] as const).map(tab=><button key={tab.id} type="button" className={activeWorkspace===tab.id?'is-active':''} aria-pressed={activeWorkspace===tab.id} onClick={()=>setActiveWorkspace(tab.id)}>{tab.label}</button>)}
    </nav>
    {(activeWorkspace==='goals'||activeWorkspace==='all') && <section id="goals-workspace" className="growth-view-section atlas-constellation-target">
    <div className="growth-section-heading"><span className="eyebrow">01 / DIRECTION</span><h2>Goals & milestones</h2><p>Set outcomes and let linked work provide the evidence of progress.</p></div>
    <Card>
      <div className="card-heading"><div><h2>Set a direction</h2><p>Describe an outcome, not a vague aspiration.</p></div></div>
      <details className="atlas-add-disclosure"><summary>+ Add goal</summary><form className="form-stack" onSubmit={event => { event.preventDefault(); if (title.trim()) create.mutate(); }}>
        <Field label="Goal"><TextInput value={title} onChange={event => setTitle(event.target.value)} placeholder="What do you want to make real?" required /></Field>
        <Field label="Why it matters"><TextArea value={detail} onChange={event => setDetail(event.target.value)} placeholder="Add the context that will help you stay oriented." /></Field>
        <Field label="Category"><select className="field-input" value={category} onChange={event => setCategory(event.target.value)}><option>Personal</option><option>Faith</option><option>Health</option><option>Learning</option><option>Career</option><option>Business</option><option>Finance</option></select></Field>
        <Field label="Horizon"><select className="field-input" value={horizon} onChange={event=>setHorizon(event.target.value as 'short-term'|'long-term')}><option value="short-term">Short-term</option><option value="long-term">Long-term</option></select></Field>
        <Field label="Target date"><TextInput type="date" value={targetDate} onChange={event => setTargetDate(event.target.value)} /></Field>
        <div><Button type="submit" disabled={create.isPending || !title.trim()}><Plus size={16} /> Add goal</Button></div>
      </form></details>
      {create.isError && <p className="inline-error">{create.error.message}</p>}
    </Card>
    <div className="goal-grid">
      {goals.data?.length ? goals.data.map(goal => {
        const work = workByGoal.get(goal.id);
        return <SpatialTiltCard key={goal.id} id={'atlas-goal-'+goal.id} className="goal-spatial-wrap atlas-constellation-target"><Card className="goal-card goal-card--connected atlas-spotlight">
          <div className="goal-card__top"><span className="status-pill">{goal.category || 'Personal'} · {goal.horizon || 'long-term'}</span><Target size={17}/></div>
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
            {work.projects.some(project=>project.milestones.length>0)&&<details className="goal-milestone-disclosure"><summary><span>Milestones</span><b>{work.projects.flatMap(project=>project.milestones).filter(item=>item.completed).length}/{work.projects.flatMap(project=>project.milestones).length} complete</b></summary><div>{work.projects.flatMap(project=>project.milestones.map(milestone=><label className="room4-goal-milestone" key={'m'+milestone.id}><input type="checkbox" checked={!!milestone.completed} disabled={toggleMilestone.isPending} onChange={event=>toggleMilestone.mutate({id:milestone.id,completed:event.target.checked})}/><span>{milestone.title}</span><small>{milestone.completed?'Done':'Milestone'}</small></label>))}</div></details>}
            {work.tasks.filter(task => !task.done).slice(0,2).map(task => <div key={'t'+task.id}><ListChecks size={13}/><span>{task.title}</span><small>{task.due_date || 'Open'}</small></div>)}
            {work.paths.slice(0,2).map(path => <div key={'l'+path.id}><BookOpen size={13}/><span>{path.title}</span><small>{path.lessons.filter(lesson=>lesson.status==='Completed').length}/{path.lessons.length} lessons</small></div>)}
          </div> : <p className="goal-no-work">Give this goal a first step by connecting a project or task.</p>}
          <div className="goal-card__bottom"><span className="goal-meta-chip"><Target size={12}/>{goal.target_date ? 'Target ' + goal.target_date : 'No target date'}</span><span className="goal-meta-chip"><Clock3 size={12}/>{work?.focusMinutes ?? 0}m focus invested</span><span>{work?.completed ?? 0} of {work?.total ?? 0} verified actions</span></div>
          <div className="goal-link-actions"><Link to="/goals#projects-workspace" className="text-link">Add project <ArrowRight size={13}/></Link><Link to="/execution" className="text-link">Add task <ArrowRight size={13}/></Link></div>
        </Card></SpatialTiltCard>;
      }) : <Card><EmptyState title="Give your effort a direction." detail="Your active goals will live here. Start with one outcome that genuinely matters." /></Card>}
    </div>
    </section>}
    {(activeWorkspace==='projects'||activeWorkspace==='all') && <section id="projects-workspace" className="growth-view-section atlas-constellation-target">
      <div className="growth-section-heading"><span className="eyebrow">02 / BUILD</span><h2>Projects</h2><p>Turn a goal into a body of work, with target dates, linked goals and meaningful milestones.</p></div>
      <ProjectsPage embedded />
    </section>}
    {(activeWorkspace==='learning'||activeWorkspace==='all') && <section id="learning-workspace" className="growth-view-section atlas-constellation-target">
      <div className="growth-section-heading"><span className="eyebrow">03 / DEVELOP</span><h2>Learning paths</h2><p>Connect skills and structured lessons to the direction they support.</p></div>
      <LearningPage embedded />
    </section>}
  </Cascade>;
}
