import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, ArrowUpRight, CalendarDays, Check, Circle, Clock3, Plus, Sparkles, Target, Timer, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AtlasBadge, AtlasButton, AtlasCard, AtlasCardContent, AtlasEmptyState, AtlasInput, AtlasProgress, AtlasSectionHeading, AtlasSkeleton } from '../components/ui/atlas-ui';
import { api, json } from '../lib/api';
import { queryKeys } from '../lib/queryKeys';
import './residence-v2.css';

type Task = { id:number; title:string; detail?:string; due_date:string|null; done:number; priority?:number; category?:string; goal_title?:string|null; project_title?:string|null };
type Goal = { id:number; title:string; detail?:string; target_date:string|null; status:string; category?:string; linked_tasks?:number; completed_tasks?:number; focus_minutes?:number };
type Session = { session_date:string; minutes:number; session_kind?:string };

function atlasToday() {
  return new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Lagos',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
}
function dateText(date:string) {
  if (!date) return 'No date set';
  return new Intl.DateTimeFormat('en-NG',{timeZone:'Africa/Lagos',month:'short',day:'numeric'}).format(new Date(date+'T12:00:00'));
}
function minutesText(value:number) {
  const h=Math.floor(value/60), m=value%60;
  return h ? h+(m?'h '+m+'m':'h') : m+'m';
}

export function ResidenceV2Page() {
  const client=useQueryClient();
  const [capture,setCapture]=useState('');
  const today=atlasToday();
  const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Lagos',hour:'2-digit',hourCycle:'h23'}).format(new Date()));
  const greeting=hour<12?'Good morning':hour<17?'Good afternoon':'Good evening';
  const tasksQ=useQuery({queryKey:queryKeys.tasks,queryFn:()=>api<Task[]>('/tasks')});
  const goalsQ=useQuery({queryKey:queryKeys.goals,queryFn:()=>api<Goal[]>('/goals')});
  const sessionsQ=useQuery({queryKey:queryKeys.sessions,queryFn:()=>api<Session[]>('/sessions')});
  const add=useMutation({mutationFn:(title:string)=>api<Task>('/tasks',json('POST',{title,category:'Personal'})),onSuccess:()=>{setCapture('');void client.invalidateQueries({queryKey:queryKeys.tasks});void client.invalidateQueries({queryKey:queryKeys.overview});}});
  const toggle=useMutation({mutationFn:(task:Task)=>api<Task>('/tasks/'+task.id,json('PATCH',{done:!task.done})),onSuccess:()=>{void client.invalidateQueries({queryKey:queryKeys.tasks});void client.invalidateQueries({queryKey:queryKeys.overview});}});
  const tasks=tasksQ.data||[], goals=goalsQ.data||[], sessions=sessionsQ.data||[];
  const open=useMemo(()=>tasks.filter(t=>!t.done).sort((a,b)=>(a.priority??3)-(b.priority??3)||(a.due_date||'9999').localeCompare(b.due_date||'9999')), [tasks]);
  const activeGoals=goals.filter(g=>g.status==='active');
  const next=open[0], direction=activeGoals[0];
  const weekMinutes=sessions.filter(s=>s.session_date<=today&&s.session_date>=(()=>{const d=new Date(today+'T12:00:00');d.setDate(d.getDate()-((d.getDay()+6)%7));return new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Lagos'}).format(d);})()&&s.session_kind!=='break').reduce((n,s)=>n+(Number(s.minutes)||0),0);
  const loading=tasksQ.isLoading||goalsQ.isLoading||sessionsQ.isLoading;
  const error=tasksQ.isError||goalsQ.isError||sessionsQ.isError;
  const done=tasks.filter(t=>!!t.done).length;
  function submit(e:FormEvent){e.preventDefault();if(capture.trim()&&!add.isPending)add.mutate(capture.trim());}

  return <div className="a-residence">
    <header className="a-residence__welcome">
      <div><span className="a-residence__eyebrow"><Sparkles size={13}/> YOUR LIFE, IN VIEW</span><h1>{greeting}.<br/><em>Make room for what matters.</em></h1><p>A clear view of what you're building, what needs attention, and where to begin.</p></div>
      <div className="a-residence__welcome-side"><AtlasBadge tone="success">Private workspace</AtlasBadge><span>{new Intl.DateTimeFormat('en-NG',{timeZone:'Africa/Lagos',weekday:'long',month:'long',day:'numeric'}).format(new Date())}</span><Link to="/blueprint">Your life blueprint <ArrowUpRight size={14}/></Link></div>
    </header>
    {error&&<div className="a-residence__error" role="alert">Some workspace information could not be loaded. You can retry by refreshing this page.</div>}
    <section className="a-residence__focus">
      <div className="a-residence__focus-copy"><span className="a-residence__eyebrow"><Target size={13}/> THE NEXT STEP</span>
        {loading?<><h2>Bringing your day into focus…</h2><p>Your workspace is loading.</p></>:next?<><h2>{next.title}</h2><p>{next.detail||next.project_title||next.goal_title||'One meaningful action. Give it your attention, then choose what comes next.'}</p><div className="a-residence__meta"><AtlasBadge tone="accent">{next.category||'Personal'}</AtlasBadge><span>{next.due_date?next.due_date<today?'Past due':next.due_date===today?'Due today':'Due '+dateText(next.due_date):'No date set'}</span></div><div className="a-residence__actions"><Link className="a-residence__primary" to={'/focus?task='+next.id}><Timer size={15}/> Start focus <ArrowRight size={15}/></Link><AtlasButton tone="quiet" size="sm" disabled={toggle.isPending} leading={<Check size={14}/>} onClick={()=>toggle.mutate(next)}>Mark complete</AtlasButton></div></>:<><h2>What deserves your attention?</h2><p>Your day has room for a fresh start. Add an action or reconnect with a goal.</p><Link className="a-residence__primary" to="/goals">Explore your goals <ArrowRight size={15}/></Link></>}
      </div><div className="a-residence__orbit" aria-hidden="true"><span>01</span><small>ONE STEP<br/>AT A TIME</small><i/><b/><em/></div>
    </section>
    <div className="a-residence__grid">
      <AtlasCard padding="lg" className="a-residence__tasks"><div className="a-residence__card-head"><AtlasSectionHeading eyebrow="IN MOTION" title="Open actions" description={open.length+' things still in progress'}/><Link to="/actions" aria-label="View all actions"><ArrowUpRight size={18}/></Link></div>
        {loading?<div className="a-residence__skeletons"><AtlasSkeleton/><AtlasSkeleton/><AtlasSkeleton/></div>:open.length?<div className="a-residence__task-list">{open.slice(0,5).map(task=><div className="a-residence__task" key={task.id}><button type="button" aria-label={'Complete '+task.title} disabled={toggle.isPending} onClick={()=>toggle.mutate(task)}><Circle size={19}/></button><span><strong>{task.title}</strong><small>{task.project_title||task.goal_title||task.category||'Personal action'}</small></span><time>{task.due_date?task.due_date<today?'Past due':task.due_date===today?'Today':dateText(task.due_date):'Anytime'}</time></div>)}</div>:<AtlasEmptyState title="Nothing waiting on you." description="Keep the space clear, or capture a new action when something comes up."/>}
        <form className="a-residence__capture" onSubmit={submit}><Plus size={16}/><AtlasInput aria-label="Capture an action" placeholder="Capture a thought or action…" value={capture} maxLength={180} onChange={e=>setCapture(e.target.value)}/><AtlasButton size="sm" submit disabled={!capture.trim()||add.isPending}>{add.isPending?'Saving':'Add'}</AtlasButton></form>
        {add.isError&&<p className="a-residence__error" role="alert">{add.error.message}</p>}{toggle.isError&&<p className="a-residence__error" role="alert">{toggle.error.message}</p>}
      </AtlasCard>
      <div className="a-residence__side">
        <AtlasCard padding="lg"><div className="a-residence__card-head"><AtlasSectionHeading eyebrow="YOUR DIRECTION" title="What you're building"/><Target size={18}/></div>
          {loading?<div className="a-residence__skeletons"><AtlasSkeleton/><AtlasSkeleton/></div>:direction?<><AtlasBadge tone="accent">{direction.category||'Active goal'}</AtlasBadge><h3 className="a-residence__goal-title">{direction.title}</h3><p className="a-residence__goal-detail">{direction.detail||'Let small actions connect to something meaningful.'}</p><div className="a-residence__goal-meta"><span>{direction.completed_tasks||0} / {direction.linked_tasks||0} linked actions</span>{direction.target_date&&<span>By {dateText(direction.target_date)}</span>}</div>{(direction.linked_tasks||0)>0&&<AtlasProgress value={((direction.completed_tasks||0)/(direction.linked_tasks||1))*100}/>}<Link className="a-residence__text-link" to="/goals">Open goals <ArrowRight size={14}/></Link></>:<AtlasEmptyState title="Choose a direction." description="Start with one outcome you would be glad to move towards." action={<Link to="/goals">Create a goal <ArrowRight size={14}/></Link>}/>}
        </AtlasCard>
        <Link to="/calendar" className="a-residence__calendar"><CalendarDays size={19}/><span><small>MAKE SPACE FOR IT</small><strong>Shape your time</strong><em>Open calendar <ArrowRight size={13}/></em></span><ArrowUpRight size={16}/></Link>
      </div>
    </div>
    <section className="a-residence__signals"><div><span className="a-residence__eyebrow">A LITTLE PERSPECTIVE</span><h2>Notice what’s moving.</h2><p>Evidence of effort, not a measure of your worth.</p></div><div><Clock3 size={16}/><strong>{loading?'—':minutesText(weekMinutes)}</strong><small>Focused this week</small></div><div><Check size={16}/><strong>{loading?'—':done}</strong><small>Actions completed</small></div><div><TrendingUp size={16}/><strong>{loading?'—':activeGoals.length}</strong><small>Directions in motion</small></div></section>
  </div>;
}
