import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, ArrowUpRight, CalendarDays, CheckCircle2, CheckSquare, Clock3, Flag, FolderKanban, Play, Plus } from 'lucide-react';
import { Cascade } from '../components/Cascade';
import { Card, EmptyState } from '../components/ui';
import { api } from '../lib/api';

type Project = { id:number; title:string; open_tasks:number; progress_pct:number; target_date?:string|null };
type Task = { id:number; title:string; done:number; priority:number; due_date:string|null; project_title?:string|null };

const priorityName:Record<number,string>={1:'Urgent',2:'High',3:'Normal',4:'Low'};

export function ExecutionFocusPage() {
  const projects=useQuery({queryKey:['projects'],queryFn:()=>api<Project[]>('/projects')});
  const tasks=useQuery({queryKey:['tasks'],queryFn:()=>api<Task[]>('/tasks')});
  const allTasks=tasks.data||[];
  const openTasks=allTasks.filter(task=>!task.done);
  const overdue=openTasks.filter(task=>task.due_date&&task.due_date<new Date().toISOString().slice(0,10));
  const nextTasks=[...openTasks].sort((a,b)=>(a.priority||3)-(b.priority||3)||(a.due_date||'9999').localeCompare(b.due_date||'9999')).slice(0,5);
  const projectList=projects.data||[];
  const spaces=[
    {title:'Projects',detail:'Organise outcomes, milestones and progress.',to:'/projects',icon:FolderKanban,count:projectList.length+' projects'},
    {title:'Tasks',detail:'Turn priorities into clear next actions.',to:'/tasks',icon:CheckSquare,count:openTasks.length+' open'},
    {title:'Goals',detail:'Keep long-term direction connected to your work.',to:'/goals',icon:Flag,count:'Direction'},
    {title:'Calendar',detail:'See commitments and make room for what matters.',to:'/calendar',icon:CalendarDays,count:'Schedule'}
  ];
  return <Cascade className="stack execution-workspace workspace-overview">
    <header className="workspace-hero">
      <div className="workspace-hero__copy">
        <span className="eyebrow">ROOM 03 / EXECUTION & FOCUS</span>
        <h1>Make progress visible.</h1>
        <p>A clear view of what is moving, what needs attention, and where to put your next hour.</p>
      </div>
      <Link className="button button--primary" to="/focus"><Play size={14}/> Start a focus session <ArrowRight size={14}/></Link>
    </header>

    <section className="workspace-metrics" aria-label="Execution overview">
      <div className="workspace-metric"><span>ACTIVE PROJECTS</span><strong>{projects.isLoading?'—':projectList.length}</strong><small>Outcomes in motion</small></div>
      <div className="workspace-metric"><span>OPEN TASKS</span><strong>{tasks.isLoading?'—':openTasks.length}</strong><small>Actions still to move</small></div>
      <div className={'workspace-metric '+(overdue.length?'workspace-metric--attention':'')}><span>OVERDUE</span><strong>{tasks.isLoading?'—':overdue.length}</strong><small>{overdue.length?'Worth a fresh decision':'Nothing overdue'}</small></div>
    </section>

    <section className="workspace-main-grid">
      <Card className="workspace-panel workspace-next-panel">
        <div className="workspace-panel__head">
          <div><span className="eyebrow">YOUR NEXT MOVES</span><h2>Priority queue</h2><p>The highest-priority open actions, ready to move forward.</p></div>
          <Link className="text-link" to="/tasks">All tasks <ArrowUpRight size={14}/></Link>
        </div>
        {tasks.isLoading?<div className="atlas-skeleton-list"><i/><i/><i/></div>:nextTasks.length?<div className="workspace-task-list">{nextTasks.map(task=><article className="workspace-task-row" key={task.id}>
          <span className={'workspace-task-priority workspace-task-priority--'+(priorityName[task.priority]||'Normal').toLowerCase()} />
          <div className="workspace-task-row__copy"><b>{task.title}</b><small>{task.project_title||'Personal task'}{task.due_date?' · Due '+task.due_date:''}</small></div>
          <Link className="workspace-task-focus" to={'/focus?task='+task.id} aria-label={'Focus on '+task.title}><Play size={13}/><span>Focus</span></Link>
        </article>)}</div>:<EmptyState title="Your task list is clear." detail="Add a next action when something needs your attention."/>}
        <Link className="workspace-add-link" to="/tasks"><Plus size={14}/> Add or organise tasks</Link>
      </Card>

      <Card className="workspace-panel workspace-project-panel">
        <div className="workspace-panel__head">
          <div><span className="eyebrow">OUTCOMES IN MOTION</span><h2>Projects</h2><p>Keep the work connected to a meaningful result.</p></div>
          <Link className="text-link" to="/projects">All projects <ArrowUpRight size={14}/></Link>
        </div>
        {projects.isLoading?<div className="atlas-skeleton-list"><i/><i/><i/></div>:projectList.length?<div className="workspace-project-list">{projectList.slice(0,5).map(project=><Link className="workspace-project-row" to="/projects" key={project.id}>
          <div className="workspace-project-row__head"><b>{project.title}</b><strong>{Math.max(0,Math.min(100,project.progress_pct||0))}%</strong></div>
          <div className="workspace-progress"><span style={{width:Math.max(0,Math.min(100,project.progress_pct||0))+'%'}}/></div>
          <small>{project.open_tasks} open tasks{project.target_date?' · Target '+project.target_date:''}</small>
        </Link>)}</div>:<EmptyState title="No projects yet." detail="Create a project to connect tasks to a bigger outcome."/>}
      </Card>
    </section>

    <section className="workspace-shortcuts">
      {spaces.map(item=>{const Icon=item.icon;return <Link className="workspace-shortcut" key={item.title} to={item.to}>
        <span className="workspace-shortcut__icon"><Icon size={17}/></span>
        <span className="workspace-shortcut__copy"><b>{item.title}</b><small>{item.detail}</small></span>
        <span className="workspace-shortcut__count">{item.count}</span>
        <ArrowUpRight size={14}/>
      </Link>;})}
    </section>

    <div className="workspace-footer-note"><CheckCircle2 size={14}/> Workspace and Focus Timer share one record of your progress. <Link to="/focus">Open Focus Timer <ArrowRight size={13}/></Link></div>
  </Cascade>;
}
