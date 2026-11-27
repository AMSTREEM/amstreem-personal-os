import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Check, Circle, Clock3, Compass, MoonStar, Plus, Sparkles, Sun, Sunrise, Target, Timer, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, json } from '../lib/api';
import { queryKeys } from '../lib/queryKeys';
import { AtlasBadge, AtlasButton, AtlasCard, AtlasEmptyState, AtlasInput, AtlasProgress, AtlasSectionHeading, AtlasSkeleton } from '../components/ui/atlas-ui';
import './daily-rhythm-v2.css';

type Task = { id:number; title:string; detail?:string; due_date:string|null; done:number; priority?:number; category?:string; goal_title?:string|null; project_title?:string|null };
type Habit = { id:number; title:string; emoji?:string; done:number; goal_title?:string|null };
type Session = { session_date:string; minutes:number; focus?:string; session_kind?:string };
type DailyReview = { id:number; period_type:'daily'|'weekly'; period_start:string; period_end:string; wins:string; challenges:string; lessons:string; next_focus:string; intention:string; priority_task_ids:number[]; alignment_complete:number; shutdown_complete:number; updated_at:string };

function todayKey(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Lagos',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
function localHour(){return Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Lagos',hour:'2-digit',hourCycle:'h23'}).format(new Date()));}
function minutesText(n:number){const h=Math.floor(n/60),m=n%60;return h?h+'h '+m+'m':m+'m';}
function dateLabel(){return new Intl.DateTimeFormat('en-NG',{timeZone:'Africa/Lagos',weekday:'long',month:'long',day:'numeric'}).format(new Date());}

export function DailyRhythmV2Page(){
  const client=useQueryClient();
  const today=todayKey();
  const hour=localHour();
  const phase=hour<11?'morning':hour<17?'day':'evening';
  const [capture,setCapture]=useState('');
  const [intention,setIntention]=useState('');
  const [nextFocus,setNextFocus]=useState('');
  const tasksQ=useQuery({queryKey:queryKeys.tasks,queryFn:()=>api<Task[]>('/tasks')});
  const habitsQ=useQuery({queryKey:queryKeys.habits(today),queryFn:()=>api<Habit[]>('/habits?date='+today)});
  const sessionsQ=useQuery({queryKey:queryKeys.sessions,queryFn:()=>api<Session[]>('/sessions')});
  const reviewsQ=useQuery({queryKey:queryKeys.reviews('daily'),queryFn:()=>api<DailyReview[]>('/reviews?period=daily')});
  const review=reviewsQ.data?.find(item=>item.period_start===today);
  useEffect(()=>{if(review){setIntention(review.intention||'');setNextFocus(review.next_focus||'');}},[review?.id,review?.updated_at]);
  const addTask=useMutation({mutationFn:(title:string)=>api<Task>('/tasks',json('POST',{title,category:'Personal',due_date:today})),onSuccess:()=>{setCapture('');void client.invalidateQueries({queryKey:queryKeys.tasks});void client.invalidateQueries({queryKey:queryKeys.overview});}});
  const toggleTask=useMutation({mutationFn:(task:Task)=>api<Task>('/tasks/'+task.id,json('PATCH',{done:!task.done})),onSuccess:()=>{void client.invalidateQueries({queryKey:queryKeys.tasks});void client.invalidateQueries({queryKey:queryKeys.overview});}});
  const toggleHabit=useMutation({mutationFn:(habit:Habit)=>api('/habits/'+habit.id+'/toggle',json('POST',{date:today})),onSuccess:()=>{void client.invalidateQueries({queryKey:queryKeys.habits(today)});void client.invalidateQueries({queryKey:queryKeys.selfControl()});void client.invalidateQueries({queryKey:queryKeys.overview});}});
  const saveReview=useMutation({mutationFn:()=>api<DailyReview>('/reviews',json('POST',{period_type:'daily',period_start:today,period_end:today,intention,next_focus:nextFocus,alignment_complete:1})),onSuccess:()=>void client.invalidateQueries({queryKey:queryKeys.reviews('daily'))});
  const tasks=tasksQ.data||[],habits=habitsQ.data||[],sessions=sessionsQ.data||[];
  const openTasks=useMemo(()=>tasks.filter(t=>!t.done).sort((a,b)=>(a.priority??3)-(b.priority??3)||(a.due_date||'9999').localeCompare(b.due_date||'9999')), [tasks]);
  const todayTasks=openTasks.filter(t=>!t.due_date||t.due_date<=today);
  const completedHabits=habits.filter(h=>!!h.done).length;
  const todayMinutes=sessions.filter(s=>s.session_date===today&&s.session_kind!=='break').reduce((n,s)=>n+(Number(s.minutes)||0),0);
  const completedToday=tasks.filter(t=>!!t.done&&t.due_date===today).length;
  const loading=tasksQ.isLoading||habitsQ.isLoading||sessionsQ.isLoading||reviewsQ.isLoading;
  const error=tasksQ.isError||habitsQ.isError||sessionsQ.isError;
  const copy=phase==='morning'?{label:'MORNING ALIGNMENT',title:'Begin with intention.',detail:'Choose what matters before the day gets noisy.',icon:Sunrise}:phase==='day'?{label:'MIDDAY MOMENTUM',title:'Give your attention a direction.',detail:'Protect a little space for meaningful work.',icon:Sun}:{label:'EVENING RESET',title:'Close the day with clarity.',detail:'Notice what moved, then make tomorrow easier.',icon:MoonStar};
  const Icon=copy.icon;
  function submitCapture(e:FormEvent){e.preventDefault();if(capture.trim()&&!addTask.isPending)addTask.mutate(capture.trim());}
  return <div className="a-daily">
    <header className="a-daily__header"><div><span className="a-daily__eyebrow"><Sparkles size={13}/> DAILY RHYTHM / YOUR CHECK-IN</span><h1>{copy.title}</h1><p>{copy.detail} A steady day is built from small choices, not perfect streaks.</p></div><div className="a-daily__date"><AtlasBadge tone="accent"><Icon size={12}/>{copy.label}</AtlasBadge><span>{dateLabel()}</span></div></header>
    {error&&<div className="a-daily__error" role="alert">Some of today's information could not be loaded. Refresh to try again.</div>}
    <section className="a-daily__alignment">
      <div className="a-daily__alignment-copy"><span className="a-daily__eyebrow"><Compass size={13}/> A MOMENT TO ALIGN</span><h2>What would make today meaningful?</h2><p>Set a simple intention. It can be practical, personal, or something you want to give your attention to.</p>
        <form onSubmit={e=>{e.preventDefault();saveReview.mutate();}}><label htmlFor="daily-intention">Today's intention</label><AtlasInput id="daily-intention" value={intention} onChange={e=>setIntention(e.target.value)} maxLength={240} placeholder="Today, I want to…" /><label htmlFor="daily-next-focus">One thing to protect time for</label><AtlasInput id="daily-next-focus" value={nextFocus} onChange={e=>setNextFocus(e.target.value)} maxLength={180} placeholder="The thing I don't want to leave behind…" /><div className="a-daily__save"><AtlasButton type="submit" size="sm" loading={saveReview.isPending} disabled={!intention.trim()&&!nextFocus.trim()}>Save intention <ArrowRight size={14}/></AtlasButton>{review?.alignment_complete===1&&!saveReview.isPending&&<span><Check size={13}/> Saved for today</span>}</div></form>
        {saveReview.isError&&<p className="a-daily__error" role="alert">{saveReview.error.message}</p>}
      </div><div className="a-daily__alignment-art" aria-hidden="true"><div className="a-daily__sun-core"><span>YOUR<br/>DAY</span></div><i/><b/><em/></div>
    </section>
    <section className="a-daily__stats"><div><span>DAILY ACTIONS</span><strong>{loading?'—':completedToday}</strong><small>Completed today</small></div><div><span>HABIT CHECK-INS</span><strong>{loading?'—':completedHabits}<small className="a-daily__fraction"> / {habits.length}</small></strong><small>Practices completed</small></div><div><span>FOCUS TIME</span><strong>{loading?'—':minutesText(todayMinutes)}</strong><small>Recorded today</small></div><div><span>OPEN LOOPS</span><strong>{loading?'—':openTasks.length}</strong><small>Actions still in motion</small></div></section>
    <div className="a-daily__columns">
      <AtlasCard padding="lg"><div className="a-daily__card-head"><AtlasSectionHeading eyebrow="TODAY'S ATTENTION" title="Actions to move" description="Keep the list short enough to act on."/><Link to="/actions" aria-label="Open all actions"><ArrowRight size={17}/></Link></div>
        {loading?<div className="a-daily__skeletons"><AtlasSkeleton/><AtlasSkeleton/><AtlasSkeleton/></div>:todayTasks.length?<div className="a-daily__task-list">{todayTasks.slice(0,6).map(task=><div className="a-daily__task" key={task.id}><button type="button" aria-label={'Complete '+task.title} disabled={toggleTask.isPending} onClick={()=>toggleTask.mutate(task)}>{task.done?<Check size={17}/>:<Circle size={18}/>}</button><span><strong>{task.title}</strong><small>{task.goal_title||task.project_title||task.category||'Personal action'}</small></span><Link to={'/focus?task='+task.id} aria-label={'Focus on '+task.title}><Timer size={15}/></Link></div>)}</div>:<AtlasEmptyState title="Your attention is available." description="No urgent actions are waiting. Add one when something matters."/>}
        <form className="a-daily__capture" onSubmit={submitCapture}><Plus size={16}/><AtlasInput aria-label="Add an action for today" value={capture} onChange={e=>setCapture(e.target.value)} maxLength={180} placeholder="Add one thing to today…"/><AtlasButton type="submit" size="sm" disabled={!capture.trim()||addTask.isPending}>{addTask.isPending?'Adding':'Add'}</AtlasButton></form>
        {addTask.isError&&<p className="a-daily__error" role="alert">{addTask.error.message}</p>}{toggleTask.isError&&<p className="a-daily__error" role="alert">{toggleTask.error.message}</p>}
      </AtlasCard>
      <div className="a-daily__right">
        <AtlasCard padding="lg"><div className="a-daily__card-head"><AtlasSectionHeading eyebrow="REPEATABLE PRACTICES" title="Habits & rituals" description="Consistency without the pressure."/><Zap size={18}/></div>
          {habitsQ.isLoading?<div className="a-daily__skeletons"><AtlasSkeleton/><AtlasSkeleton/></div>:habits.length?<><div className="a-daily__habit-progress"><AtlasProgress value={habits.length?completedHabits/habits.length*100:0}/><span>{completedHabits} of {habits.length} checked in</span></div><div className="a-daily__habit-list">{habits.slice(0,5).map(habit=><button type="button" key={habit.id} className={'a-daily__habit'+(habit.done?' is-done':'')} disabled={toggleHabit.isPending} onClick={()=>toggleHabit.mutate(habit)}><span>{habit.emoji||'✦'}</span><strong>{habit.title}</strong>{habit.done?<Check size={16}/>:<Circle size={17}/>}</button>)}</div></>:<AtlasEmptyState title="Create a practice that matters." description="Add a small repeatable habit and return here to check in." action={<Link to="/habits">Set up habits <ArrowRight size={14}/></Link>}/>}
          {toggleHabit.isError&&<p className="a-daily__error" role="alert">{toggleHabit.error.message}</p>}<Link className="a-daily__text-link" to="/habits">Explore all habits <ArrowRight size={14}/></Link>
        </AtlasCard>
        <Link className="a-daily__values" to="/values"><MoonStar size={18}/><span><small>VALUES & FAITH</small><strong>Make space for what grounds you</strong><em>Open your practice space <ArrowRight size={13}/></em></span></Link>
      </div>
    </div>
    <footer className="a-daily__footer"><div><span className="a-daily__eyebrow"><Target size={13}/> A GENTLE REMINDER</span><h2>Progress is a direction, not a daily score.</h2><p>Some days are for momentum. Some days are for recovery. Both belong in a life you're building intentionally.</p></div><div><Clock3 size={16}/><strong>{loading?'—':minutesText(todayMinutes)}</strong><small>Time you've given your focus</small></div></footer>
  </div>;
}
