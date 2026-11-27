import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Check, Circle, Plus, Search, Timer, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, json } from '../lib/api';
import { queryKeys } from '../lib/queryKeys';
import { AtlasBadge, AtlasButton, AtlasCard, AtlasEmptyState, AtlasInput, AtlasSectionHeading, AtlasSkeleton } from '../components/ui/atlas-ui';
import './execution-v2.css';

type Task={id:number;title:string;detail?:string;done:number;priority:number;due_date:string|null;project_id:number|null;goal_id:number|null;project_title?:string|null;goal_title?:string|null;parent_task_id:number|null;focus_minutes:number};
type Project={id:number;title:string;open_tasks:number;progress_pct:number;goal_title?:string|null};
const priorityName=(n:number)=>({1:'Urgent',2:'High',3:'Normal',4:'Low'}[n]||'Normal');
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Lagos',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());

export function ExecutionV2Page(){
 const client=useQueryClient(); const [draft,setDraft]=useState(''); const [filter,setFilter]=useState<'open'|'all'|'done'>('open'); const [project,setProject]=useState('all'); const [query,setQuery]=useState('');
 const tasksQ=useQuery({queryKey:queryKeys.tasks,queryFn:()=>api<Task[]>('/tasks')});
 const projectsQ=useQuery({queryKey:queryKeys.projects,queryFn:()=>api<Project[]>('/projects')});
 const add=useMutation({mutationFn:()=>api<Task>('/tasks',json('POST',{title:draft.trim(),category:'Personal',priority:2})),onSuccess:()=>{setDraft('');void client.invalidateQueries({queryKey:queryKeys.tasks});void client.invalidateQueries({queryKey:queryKeys.projects});void client.invalidateQueries({queryKey:queryKeys.overview});}});
 const toggle=useMutation({mutationFn:(task:Task)=>api('/tasks/'+task.id,json('PATCH',{done:!task.done})),onSuccess:()=>{void client.invalidateQueries({queryKey:queryKeys.tasks});void client.invalidateQueries({queryKey:queryKeys.projects});void client.invalidateQueries({queryKey:queryKeys.overview});}});
 const tasks=tasksQ.data||[], projects=projectsQ.data||[];
 const open=tasks.filter(t=>!t.done&&!t.parent_task_id); const completed=tasks.filter(t=>!!t.done&&!t.parent_task_id);
 const visible=useMemo(()=>tasks.filter(t=>!t.parent_task_id&&(filter==='all'||(filter==='open'?!t.done:!!t.done))&&(project==='all'||String(t.project_id||'none')===project)&&(!query.trim()||t.title.toLowerCase().includes(query.toLowerCase()))).sort((a,b)=>Number(a.done)-Number(b.done)||(a.priority||3)-(b.priority||3)||(a.due_date||'9999').localeCompare(b.due_date||'9999')),[tasks,filter,project,query]);
 function submit(e:FormEvent){e.preventDefault();if(draft.trim()&&!add.isPending)add.mutate();}
 const due= open.filter(t=>t.due_date===today()).length;
 return <div className="a-execution">
  <header className="a-execution__hero"><div><span className="a-execution__eyebrow">EXECUTION / MAKE IT HAPPEN</span><h1>Less juggling.<br/><em>More meaningful progress.</em></h1><p>Bring your open loops into view. Choose one action, give it a place, and move it forward.</p></div><div className="a-execution__hero-mark"><span>02</span><small>INTENTION<br/>INTO ACTION</small></div></header>
  <section className="a-execution__signals"><div><span>OPEN ACTIONS</span><strong>{open.length}</strong></div><div><span>COMPLETED</span><strong>{completed.length}</strong></div><div><span>DUE TODAY</span><strong>{due}</strong></div><div><span>PROJECTS</span><strong>{projects.length}</strong></div></section>
  <div className="a-execution__layout">
   <main className="a-execution__main">
    <AtlasCard padding="lg">
     <AtlasSectionHeading eyebrow="YOUR ACTION QUEUE" title="What moves next?" description="Keep the list honest. Every action should be clear enough to begin."/>
     <form className="a-execution__capture" onSubmit={submit}><Plus size={17}/><AtlasInput aria-label="New action" placeholder="Capture a next action…" value={draft} onChange={e=>setDraft(e.target.value)}/><AtlasButton type="submit" size="sm" disabled={!draft.trim()||add.isPending} loading={add.isPending}>Add action</AtlasButton></form>
     {add.isError&&<p className="a-execution__error" role="alert">{add.error.message}</p>}
     <div className="a-execution__tools"><div className="a-execution__filters" aria-label="Filter actions"><button className={filter==='open'?'is-active':''} onClick={()=>setFilter('open')}>Open <b>{open.length}</b></button><button className={filter==='all'?'is-active':''} onClick={()=>setFilter('all')}>All</button><button className={filter==='done'?'is-active':''} onClick={()=>setFilter('done')}>Completed <b>{completed.length}</b></button></div><label className="a-execution__search"><Search size={14}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Find an action" aria-label="Find an action"/>{query&&<button type="button" onClick={()=>setQuery('')} aria-label="Clear search"><X size={13}/></button>}</label></div>
     <div className="a-execution__project-filter"><button className={project==='all'?'is-active':''} onClick={()=>setProject('all')}>Everywhere</button>{projects.map(p=><button key={p.id} className={project===String(p.id)?'is-active':''} onClick={()=>setProject(String(p.id))}>{p.title}</button>)}<button className={project==='none'?'is-active':''} onClick={()=>setProject('none')}>Unassigned</button></div>
     <div className="a-execution__list">{tasksQ.isLoading?<><AtlasSkeleton/><AtlasSkeleton/><AtlasSkeleton/></>:visible.length?visible.map(task=><article className={'a-execution__task '+(task.done?'is-done':'')} key={task.id}><button className="a-execution__check" aria-label={task.done?'Reopen '+task.title:'Complete '+task.title} disabled={toggle.isPending} onClick={()=>toggle.mutate(task)}>{task.done?<Check size={15}/>:<Circle size={16}/>}</button><div className="a-execution__task-copy"><strong>{task.title}</strong><span>{task.project_title||task.goal_title||'Personal action'}{task.due_date?' · '+(task.due_date===today()?'Due today':task.due_date):''}</span></div><AtlasBadge tone={task.priority===1?'danger':task.priority===2?'accent':'neutral'}>{priorityName(task.priority)}</AtlasBadge>{!task.done&&<Link className="a-execution__focus-link" to={'/focus?task='+task.id} aria-label={'Focus on '+task.title}><Timer size={15}/></Link>}</article>):<AtlasEmptyState title={filter==='done'?'No completed actions here.':'A little more breathing room.'} description={filter==='done'?'Completed actions will appear here.':'No actions match this view. Capture one when something needs your attention.'/>}</div>
    </AtlasCard>
   </main>
   <aside className="a-execution__aside"><AtlasCard padding="lg"><AtlasSectionHeading eyebrow="PROJECTS" title="Work with direction" description="Actions become easier to sustain when they belong to something meaningful."/>
    {projects.length?projects.map(p=><div className="a-execution__project" key={p.id}><div><strong>{p.title}</strong><span>{p.open_tasks} open actions</span></div><div className="a-execution__bar"><i style={{width:Math.max(0,Math.min(100,p.progress_pct||0))+'%'}}/></div></div>):<AtlasEmptyState title="No projects yet" description="Create a project to give related actions a shared direction."/>}
    <Link className="a-execution__text-link" to="/goals">Explore goals <ArrowRight size={14}/></Link>
   </AtlasCard><AtlasCard padding="lg" className="a-execution__focus-card"><span className="a-execution__eyebrow">PROTECT YOUR ATTENTION</span><h2>One thing at a time.</h2><p>Turn a task into a focused session. Your time is recorded against the work it supports.</p><Link to="/focus" className="a-execution__focus-cta"><Timer size={15}/> Open focus room <ArrowRight size={14}/></Link></AtlasCard></aside>
  </div>
 </div>;
}
