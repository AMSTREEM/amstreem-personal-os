import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { CalendarDays, Check, ChevronLeft, ChevronRight, Pause, Play, Plus, Sprout, Trash2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

type Habit = { id: string; user_id: string; title: string; intention: string; weekdays: number[]; active: boolean };
type Entry = { id: string; habit_id: string; user_id: string; entry_date: string; completed_at: string };
const days = [{value:1,label:'Mon',short:'M'},{value:2,label:'Tue',short:'T'},{value:3,label:'Wed',short:'W'},{value:4,label:'Thu',short:'T'},{value:5,label:'Fri',short:'F'},{value:6,label:'Sat',short:'S'},{value:0,label:'Sun',short:'S'}];
const keyOf = (date: Date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const mondayOf = (date: Date) => { const d=new Date(date.getFullYear(),date.getMonth(),date.getDate()); d.setDate(d.getDate()-(d.getDay()+6)%7); return d; };
const labelDate = (date: Date) => new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric'}).format(date);

export default function HabitTracker({ userId }: { userId: string }) {
  const [habits,setHabits]=useState<Habit[]>([]);
  const [entries,setEntries]=useState<Entry[]>([]);
  const [weekStart,setWeekStart]=useState(()=>mondayOf(new Date()));
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [formOpen,setFormOpen]=useState(false);
  const [title,setTitle]=useState('');
  const [intention,setIntention]=useState('');
  const [selectedDays,setSelectedDays]=useState<number[]>([1,2,3,4,5]);

  const weekDates=useMemo(()=>Array.from({length:7},(_,i)=>{const d=new Date(weekStart);d.setDate(d.getDate()+i);return d;}),[weekStart]);
  const weekEnd=keyOf(weekDates[6]);
  const weekStartKey=keyOf(weekDates[0]);
  const todayKey=keyOf(new Date());

  const load=async()=>{
    if(!supabase){setLoading(false);return;}
    setLoading(true);
    const [habitResult,entryResult]=await Promise.all([
      supabase.from('habits').select('id,user_id,title,intention,weekdays,active').eq('user_id',userId).order('created_at',{ascending:true}),
      supabase.from('habit_entries').select('id,habit_id,user_id,entry_date,completed_at').eq('user_id',userId).gte('entry_date',weekStartKey).lte('entry_date',weekEnd),
    ]);
    if(habitResult.error||entryResult.error)setError('Could not load your habits. '+(habitResult.error?.message||entryResult.error?.message));
    else{setHabits((habitResult.data||[]) as Habit[]);setEntries((entryResult.data||[]) as Entry[]);setError('');}
    setLoading(false);
  };
  useEffect(()=>{void load();},[userId,weekStartKey,weekEnd]);

  const toggleEntry=async(habit:Habit,dateKey:string)=>{
    if(!supabase||saving)return;
    const existing=entries.find(e=>e.habit_id===habit.id&&e.entry_date===dateKey);
    setSaving(true);setError('');
    if(existing){
      const {error:removeError}=await supabase.from('habit_entries').delete().eq('id',existing.id).eq('user_id',userId);
      if(removeError)setError('Could not update this day. '+removeError.message);
      else setEntries(current=>current.filter(e=>e.id!==existing.id));
    }else{
      const {data,error:addError}=await supabase.from('habit_entries').insert({habit_id:habit.id,user_id:userId,entry_date:dateKey}).select('id,habit_id,user_id,entry_date,completed_at').single();
      if(addError)setError('Could not record completion. '+addError.message);
      else if(data)setEntries(current=>[...current,data as Entry]);
    }
    setSaving(false);
  };
  const createHabit=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();if(!supabase||saving)return;
    if(!selectedDays.length){setError('Choose at least one planned day.');return;}
    setSaving(true);setError('');
    const {data,error:createError}=await supabase.from('habits').insert({user_id:userId,title:title.trim(),intention:intention.trim(),weekdays:selectedDays}).select('id,user_id,title,intention,weekdays,active').single();
    if(createError)setError('Could not create this habit. '+createError.message);
    else if(data){setHabits(current=>[...current,data as Habit]);setTitle('');setIntention('');setSelectedDays([1,2,3,4,5]);setFormOpen(false);setNotice('Habit added. Start whenever you are ready.');window.setTimeout(()=>setNotice(''),2600);}
    setSaving(false);
  };
  const setActive=async(habit:Habit,active:boolean)=>{
    if(!supabase)return;
    const {error:updateError}=await supabase.from('habits').update({active}).eq('id',habit.id).eq('user_id',userId);
    if(updateError)setError('Could not update this habit. '+updateError.message);
    else setHabits(current=>current.map(h=>h.id===habit.id?{...h,active}:h));
  };
  const removeHabit=async(habit:Habit)=>{
    if(!supabase)return;
    const {error:deleteError}=await supabase.from('habits').delete().eq('id',habit.id).eq('user_id',userId);
    if(deleteError)setError('Could not delete this habit. '+deleteError.message);
    else{setHabits(current=>current.filter(h=>h.id!==habit.id));setEntries(current=>current.filter(e=>e.habit_id!==habit.id));}
  };
  const activeHabits=habits.filter(h=>h.active);
  const plannedCount=activeHabits.reduce((sum,h)=>sum+weekDates.filter(d=>h.weekdays.includes(d.getDay())).length,0);
  const completedCount=entries.filter(e=>activeHabits.some(h=>h.id===e.habit_id)).length;
  const weekLabel=`${labelDate(weekDates[0])} – ${new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',year:'numeric'}).format(weekDates[6])}`;

  return <section className="habit-area">
    <div className="habit-heading"><div><span className="kicker">CONSISTENCY, WITHOUT PRESSURE</span><h2>Small things, <em>over time.</em></h2><p>Choose what matters, then record what you actually do. A missed day is just a day—not a failure.</p></div><button className="habit-create-button" onClick={()=>setFormOpen(v=>!v)}>{formOpen?<X size={15}/>:<Plus size={15}/>} {formOpen?'Close':'Add a habit'}</button></div>
    {formOpen&&<form className="habit-form" onSubmit={createHabit}>
      <label>What would you like to make room for?<input value={title} onChange={e=>setTitle(e.target.value)} maxLength={120} placeholder="e.g. Read, practise a skill, take a walk…" required/></label>
      <label>Why does it matter to you? <span>(optional)</span><textarea value={intention} onChange={e=>setIntention(e.target.value)} maxLength={500} rows={2} placeholder="A short reminder for your future self…"/></label>
      <div className="habit-days"><strong>Days you intend to do it</strong><div>{days.map(day=><button type="button" key={day.value} className={selectedDays.includes(day.value)?'selected':''} aria-pressed={selectedDays.includes(day.value)} onClick={()=>setSelectedDays(current=>current.includes(day.value)?current.filter(d=>d!==day.value):[...current,day.value])}>{day.label}</button>)}</div></div>
      <div className="habit-form-footer"><span>You can change your plan later.</span><button type="submit" disabled={saving||!title.trim()||!selectedDays.length}>{saving?'Saving…':'Create habit'}</button></div>
    </form>}
    {error&&<div className="life-error" role="alert">{error}</div>}{notice&&<div className="habit-notice">{notice}</div>}
    <div className="habit-weekbar"><div><CalendarDays size={15}/><strong>{weekLabel}</strong></div><div><button onClick={()=>setWeekStart(d=>{const n=new Date(d);n.setDate(n.getDate()-7);return n;})} aria-label="Previous week"><ChevronLeft size={16}/></button><button onClick={()=>setWeekStart(d=>{const n=new Date(d);n.setDate(n.getDate()+7);return n;})} aria-label="Next week"><ChevronRight size={16}/></button><button className="habit-this-week" onClick={()=>setWeekStart(mondayOf(new Date()))}>This week</button></div></div>
    <div className="habit-summary"><div><span>PLANNED THIS WEEK</span><strong>{plannedCount}</strong></div><div><span>COMPLETED</span><strong>{completedCount}</strong></div><div><span>HABITS IN VIEW</span><strong>{activeHabits.length}</strong></div></div>
    {loading?<div className="life-empty">Loading your habits…</div>:activeHabits.length?<div className="habit-list">
      <div className="habit-grid-head"><span>YOUR HABITS</span>{weekDates.map((d,i)=><div key={i} className={keyOf(d)===todayKey?'today':''}><b>{days[i].short}</b><span>{d.getDate()}</span></div>)}</div>
      {activeHabits.map(habit=><article className="habit-row" key={habit.id}>
        <div className="habit-name"><div className="habit-glyph"><Sprout size={16}/></div><div><strong>{habit.title}</strong>{habit.intention&&<span>{habit.intention}</span>}</div></div>
        {weekDates.map((date,i)=>{const dateKey=keyOf(date);const planned=habit.weekdays.includes(date.getDay());const done=entries.some(e=>e.habit_id===habit.id&&e.entry_date===dateKey);return <div key={i} className={dateKey===todayKey?'habit-day today':'habit-day'}>{planned?<button className={done?'done':''} disabled={saving||dateKey>todayKey} onClick={()=>void toggleEntry(habit,dateKey)} aria-label={`${done?'Unmark':'Mark'} ${habit.title} on ${dateKey}`} title={dateKey>todayKey?'This day has not arrived yet':done?'Completed':'Mark as completed'}>{done?<Check size={14}/>:<span/>}</button>:<i>·</i>}</div>;})}
        <div className="habit-row-actions"><button onClick={()=>void setActive(habit,false)} aria-label={`Pause ${habit.title}`} title="Pause habit"><Pause size={13}/></button><button onClick={()=>void removeHabit(habit)} aria-label={`Delete ${habit.title}`} title="Delete habit"><Trash2 size={13}/></button></div>
      </article>)}
    </div>:<div className="habit-empty"><Sprout size={24}/><strong>Nothing to track yet.</strong><p>Start with one small action that matters to you. You decide what counts as progress.</p><button onClick={()=>setFormOpen(true)}>Create your first habit <Plus size={14}/></button></div>}
    {habits.some(h=>!h.active)&&<div className="habit-paused"><strong>Paused habits</strong>{habits.filter(h=>!h.active).map(h=><div key={h.id}><span>{h.title}</span><div><button onClick={()=>void setActive(h,true)} aria-label={`Resume ${h.title}`}><Play size={13}/> Resume</button><button onClick={()=>void removeHabit(h)} aria-label={`Delete ${h.title}`}><Trash2 size={13}/></button></div></div>)}</div>}
    <p className="habit-footnote">Only days you mark are recorded. Future days stay unavailable until they arrive. No streak penalties, rankings or automatic assumptions.</p>
  </section>;
}
