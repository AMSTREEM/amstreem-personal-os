import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, CalendarDays, Compass, Flag, Lightbulb, RefreshCw, Sprout } from 'lucide-react';
import { supabase } from '../lib/supabase';

type LifeItem = { id:string; kind:'goal'|'project'|'task'; title:string; status:string; due_date:string|null; parent_id:string|null; created_at:string };
type Habit = { id:string; title:string; weekdays:number[]; active:boolean };
type HabitEntry = { habit_id:string; entry_date:string };
type TimeBlock = { title:string; start_time:string; end_time:string; block_date:string };
type Routine = { title:string; weekdays:number[]; start_time:string; end_time:string };

type Insight = { eyebrow:string; title:string; body:string; detail:string; action:string; icon:'flag'|'calendar'|'sprout'|'lightbulb'; onAction:()=>void };

const dateKey=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const daysBetween=(a:Date,b:Date)=>Math.floor((new Date(b.getFullYear(),b.getMonth(),b.getDate()).getTime()-new Date(a.getFullYear(),a.getMonth(),a.getDate()).getTime())/86400000);
const minutes=(value:string)=>{const [h,m]=value.split(':').map(Number);return h*60+m;};

export default function PersonalInsights({ userId, onOpenProjects, onOpenPlan, onOpenHabits }:{userId:string;onOpenProjects:()=>void;onOpenPlan:()=>void;onOpenHabits:()=>void}) {
  const [items,setItems]=useState<LifeItem[]>([]);
  const [habits,setHabits]=useState<Habit[]>([]);
  const [entries,setEntries]=useState<HabitEntry[]>([]);
  const [blocks,setBlocks]=useState<TimeBlock[]>([]);
  const [routines,setRoutines]=useState<Routine[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');

  const load=async()=>{
    if(!supabase){setLoading(false);return;}
    setLoading(true);setError('');
    const since=new Date();since.setDate(since.getDate()-13);
    const [life,h,e,b,r]=await Promise.all([
      supabase.from('life_items').select('id,kind,title,status,due_date,parent_id,created_at').neq('status','archived'),
      supabase.from('habits').select('id,title,weekdays,active').eq('active',true),
      supabase.from('habit_entries').select('habit_id,entry_date').gte('entry_date',dateKey(since)),
      supabase.from('time_blocks').select('title,start_time,end_time,block_date').gte('block_date',dateKey(new Date())).lte('block_date',dateKey(new Date(Date.now()+6*86400000))),
      supabase.from('routine_templates').select('title,weekdays,start_time,end_time').eq('active',true)
    ]);
    const firstError=life.error||h.error||e.error||b.error||r.error;
    if(firstError){setError('Some of your records could not be analysed: '+firstError.message);}
    else{setItems((life.data||[]) as LifeItem[]);setHabits((h.data||[]) as Habit[]);setEntries((e.data||[]) as HabitEntry[]);setBlocks((b.data||[]) as TimeBlock[]);setRoutines((r.data||[]) as Routine[]);}
    setLoading(false);
  };
  useEffect(()=>{void load();},[userId]);

  const insights=useMemo(()=>{
    const today=dateKey(new Date());
    const activeTasks=items.filter(x=>x.kind==='task'&&x.status==='active');
    const overdue=activeTasks.filter(x=>x.due_date&&x.due_date<today);
    const undated=activeTasks.filter(x=>!x.due_date);
    const activeGoals=items.filter(x=>x.kind==='goal'&&x.status==='active');
    const activeProjects=items.filter(x=>x.kind==='project'&&x.status==='active');
    const output:Insight[]=[];
    if(overdue.length) output.push({eyebrow:'TASKS · NEEDS REVIEW',title:`${overdue.length} open ${overdue.length===1?'task is':'tasks are'} past the planned date.`,body:'Dates are planning signals, not deadlines you have to feel bad about. It may be worth deciding what still matters.',detail:overdue.slice(0,3).map(x=>x.title).join(' · '),action:'Review your tasks',icon:'flag',onAction:onOpenProjects});
    if(undated.length>=3) output.push({eyebrow:'TASKS · CLARITY',title:`${undated.length} tasks have no date yet.`,body:'If some of these matter soon, giving just one or two a place in your week can make the next step clearer.',detail:undated.slice(0,3).map(x=>x.title).join(' · '),action:'Organise tasks',icon:'calendar',onAction:onOpenProjects});
    const goalsWithoutProjects=activeGoals.filter(g=>!activeProjects.some(p=>p.parent_id===g.id));
    if(goalsWithoutProjects.length) output.push({eyebrow:'GOALS · CONNECTIONS',title:`${goalsWithoutProjects.length} active ${goalsWithoutProjects.length===1?'goal has':'goals have'} no linked project.`,body:'A goal does not need a project immediately. If you are ready to make one more concrete, a small project can help give it shape.',detail:goalsWithoutProjects.slice(0,3).map(x=>x.title).join(' · '),action:'View your goals',icon:'lightbulb',onAction:onOpenProjects});
    const past14=new Date();past14.setDate(past14.getDate()-13);
    const planned=habits.reduce((sum,h)=>sum+Array.from({length:14},(_,i)=>{const d=new Date(past14);d.setDate(d.getDate()+i);return h.weekdays.includes(d.getDay())?1:0;}).reduce((a,b)=>a+b,0),0);
    const completed=entries.filter(e=>habits.some(h=>h.id===e.habit_id)).length;
    if(habits.length&&planned>0) output.push({eyebrow:'HABITS · LAST 14 DAYS',title:`${completed} of ${planned} planned habit check-ins were recorded.`,body:'This reflects what was logged here, not everything you may have done. You can adjust the plan if your routine has changed.',detail:`${habits.length} active ${habits.length===1?'habit':'habits'} · ${entries.length} recorded check-ins in this period`,action:'Review habits',icon:'sprout',onAction:onOpenHabits});
    const blockMinutes=blocks.reduce((sum,b)=>sum+Math.max(0,minutes(b.end_time)-minutes(b.start_time)),0);
    const routineMinutes=routines.reduce((sum,r)=>sum+Math.max(0,minutes(r.end_time)-minutes(r.start_time))*r.weekdays.length,0);
    if(blocks.length||routines.length) output.push({eyebrow:'TIME · THIS WEEK',title:`${Math.round((blockMinutes+routineMinutes)/60*10)/10} planned hours appear in your schedule.`,body:'This is scheduled time, not a measure of how you actually spent the week. Leave room for changes and rest.',detail:`${blocks.length} dated blocks · ${routines.length} recurring routines`,action:'Open your plan',icon:'calendar',onAction:onOpenPlan});
    if(!output.length) output.push({eyebrow:'A FRESH START',title:'There is not enough activity to spot a useful pattern yet.',body:'As you add goals, tasks, habits and plans, this space will surface observations grounded in those records—not generic advice.',detail:'Nothing needs to be added just to fill this page.',action:'Start with your goals',icon:'lightbulb',onAction:onOpenProjects});
    return output;
  },[items,habits,entries,blocks,routines,onOpenProjects,onOpenPlan,onOpenHabits]);

  const iconFor=(name:Insight['icon'])=>name==='flag'?<Flag size={17}/>:name==='calendar'?<CalendarDays size={17}/>:name==='sprout'?<Sprout size={17}/>:<Lightbulb size={17}/>;
  return <section className="insights-area">
    <div className="insights-heading"><div><span className="kicker">PATTERNS FROM YOUR RECORDS</span><h2>Notice what is <em>taking shape.</em></h2><p>Observations from the goals, tasks, habits and plans you have saved. No scores, assumptions or judgement.</p></div><button className="insights-refresh" onClick={()=>void load()} aria-label="Refresh insights"><RefreshCw size={15}/></button></div>
    <div className="insights-source"><Lightbulb size={14}/><span>Transparent, rule-based observations · Updated when you refresh · Not AI-generated</span></div>
    {loading?<div className="insights-empty">Looking across your saved activity…</div>:error?<div className="insights-error" role="alert">{error}</div>:<div className="insights-grid">{insights.map((insight,i)=><article className="insight-card" key={insight.eyebrow}><div className="insight-card-top"><span>{insight.eyebrow}</span><i>{iconFor(insight.icon)}</i></div><h3>{insight.title}</h3><p>{insight.body}</p><div className="insight-evidence">{insight.detail}</div><button onClick={insight.onAction}>{insight.action}<ArrowUpRight size={14}/></button></article>)}</div>}
    <p className="insights-footnote">These observations are generated from the records currently saved in your account. They can be incomplete when you have not logged something here.</p>
  </section>;
}
