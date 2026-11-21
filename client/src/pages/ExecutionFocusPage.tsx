import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CalendarDays, CheckSquare, Compass, Flag, FolderKanban } from 'lucide-react';
import { Cascade } from '../components/Cascade';
import { Card } from '../components/ui';
import { api } from '../lib/api';

type Project = { id:number; title:string; open_tasks:number; progress_pct:number };
type Task = { id:number; title:string; done:number; priority:number; due_date:string|null };

export function ExecutionFocusPage() {
  const projects=useQuery({queryKey:['projects'],queryFn:()=>api<Project[]>('/projects')});
  const tasks=useQuery({queryKey:['tasks'],queryFn:()=>api<Task[]>('/tasks')});
  const openTasks=(tasks.data||[]).filter(task=>!task.done);
  const overdue=openTasks.filter(task=>task.due_date&&task.due_date<new Date().toISOString().slice(0,10));
  const spaces=[
    {title:'Projects',detail:'Organise outcomes, milestones and progress.',to:'/projects',icon:FolderKanban,count:String(projects.data?.length??'—')+' projects'},
    {title:'Tasks',detail:'Plan priorities, manage next actions and follow through.',to:'/tasks',icon:CheckSquare,count:String(openTasks.length)+' open'},
    {title:'Goals',detail:'Keep long-term direction connected to your work.',to:'/goals',icon:Flag,count:'Direction'},
    {title:'Calendar',detail:'See commitments and plan your time.',to:'/calendar',icon:CalendarDays,count:'Schedule'}
  ];
  return <Cascade className="stack">
    <div className="execution-heading"><div><span className="eyebrow">ROOM 03 / WORKSPACE</span><h1>Make progress visible.</h1><p>Plan the work, organise your priorities, and keep projects moving.</p></div><Link className="button button--primary" to="/focus"><Compass size={15}/> Enter Focus Room <ArrowRight size={14}/></Link></div>
    <div className="stat-grid stat-grid--three">
      <div className="stat-card"><div className="stat-card__top">ACTIVE PROJECTS</div><strong>{projects.data?.length??'—'}</strong><small>Outcomes in motion</small></div>
      <div className="stat-card"><div className="stat-card__top">OPEN TASKS</div><strong>{openTasks.length}</strong><small>Actions still to move</small></div>
      <div className="stat-card"><div className="stat-card__top">OVERDUE</div><strong>{overdue.length}</strong><small>Need a fresh decision</small></div>
    </div>
    <div className="grid grid--two">{spaces.map(item=>{const Icon=item.icon;return <Card key={item.title}><div className="card-heading"><div><span className="eyebrow">{item.count}</span><h2>{item.title}</h2><p>{item.detail}</p></div><Icon size={19}/></div><Link className="text-link" to={item.to}>Open {item.title} <ArrowRight size={14}/></Link></Card>;})}</div>
  </Cascade>;
}
