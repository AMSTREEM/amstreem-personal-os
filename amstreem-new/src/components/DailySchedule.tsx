import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowLeft, ArrowRight, CalendarDays, Clock3, Plus, Trash2, X, Repeat2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

type Category = 'focus' | 'study' | 'class' | 'personal' | 'break' | 'rest' | 'other';
type TimeBlock = {
  id: string; user_id: string; block_date: string; title: string; category: Category;
  start_time: string; end_time: string; notes: string;
};
type Routine = {
  id: string; user_id: string; title: string; category: Category; weekdays: number[];
  start_time: string; end_time: string; notes: string; active: boolean;
};
type ScheduleEntry = {
  id: string; title: string; category: Category; start_time: string; end_time: string;
  notes: string; recurring: boolean; routineId?: string;
};
const dateKey = (date: Date) => {
  const y = date.getFullYear(); const m = String(date.getMonth() + 1).padStart(2, '0'); const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};
const prettyDate = (key: string) => new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(key + 'T12:00:00'));
const prettyTime = (value: string) => new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date('2000-01-01T' + value.slice(0, 5) + ':00'));
const categories: { value: Category; label: string }[] = [
  { value: 'focus', label: 'Focus' }, { value: 'study', label: 'Study' }, { value: 'class', label: 'Class' },
  { value: 'personal', label: 'Personal' }, { value: 'break', label: 'Break' }, { value: 'rest', label: 'Rest' }, { value: 'other', label: 'Other' },
];
const weekDays = [{value:1,label:'Mon'},{value:2,label:'Tue'},{value:3,label:'Wed'},{value:4,label:'Thu'},{value:5,label:'Fri'},{value:6,label:'Sat'},{value:0,label:'Sun'}];
const overlaps = (aStart: string, aEnd: string, bStart: string, bEnd: string) => aStart < bEnd.slice(0,5) && aEnd > bStart.slice(0,5);

export default function DailySchedule({ userId }: { userId: string }) {
  const [selectedDate, setSelectedDate] = useState(dateKey(new Date()));
  const [blocks, setBlocks] = useState<TimeBlock[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [formOpen, setFormOpen] = useState(false); const [routineOpen, setRoutineOpen] = useState(false); const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(''); const [category, setCategory] = useState<Category>('personal');
  const [startTime, setStartTime] = useState('09:00'); const [endTime, setEndTime] = useState('10:00'); const [notes, setNotes] = useState('');
  const [routineTitle, setRoutineTitle] = useState(''); const [routineCategory, setRoutineCategory] = useState<Category>('study');
  const [routineStart, setRoutineStart] = useState('09:00'); const [routineEnd, setRoutineEnd] = useState('10:00');
  const [routineNotes, setRoutineNotes] = useState(''); const [routineDays, setRoutineDays] = useState<number[]>([1,2,3,4,5]);

  const load = async () => {
    if (!supabase) { setLoading(false); return; }
    setLoading(true);
    const [blockResult, routineResult] = await Promise.all([
      supabase.from('time_blocks').select('id,user_id,block_date,title,category,start_time,end_time,notes').eq('user_id', userId).eq('block_date', selectedDate).order('start_time'),
      supabase.from('routine_templates').select('id,user_id,title,category,weekdays,start_time,end_time,notes,active').eq('user_id', userId).eq('active', true),
    ]);
    if (blockResult.error || routineResult.error) setError('Your schedule could not be loaded. ' + (blockResult.error?.message || routineResult.error?.message));
    else { setBlocks((blockResult.data || []) as TimeBlock[]); setRoutines((routineResult.data || []) as Routine[]); setError(''); }
    setLoading(false);
  };
  useEffect(() => { void load(); }, [selectedDate, userId]);
  const shiftDate = (amount: number) => { const next = new Date(selectedDate + 'T12:00:00'); next.setDate(next.getDate() + amount); setSelectedDate(dateKey(next)); };
  const weekday = new Date(selectedDate + 'T12:00:00').getDay();
  const entries = useMemo<ScheduleEntry[]>(() => [
    ...blocks.map(b => ({ id:b.id,title:b.title,category:b.category,start_time:b.start_time,end_time:b.end_time,notes:b.notes,recurring:false })),
    ...routines.filter(r => r.weekdays.includes(weekday)).map(r => ({ id:'routine-'+r.id,routineId:r.id,title:r.title,category:r.category,start_time:r.start_time,end_time:r.end_time,notes:r.notes,recurring:true })),
  ].sort((a,b) => a.start_time.localeCompare(b.start_time)), [blocks,routines,weekday]);

  const resetBlockForm = () => { setTitle(''); setCategory('personal'); setStartTime('09:00'); setEndTime('10:00'); setNotes(''); setFormOpen(false); };
  const saveBlock = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!supabase || saving) return;
    if (endTime <= startTime) { setError('Choose an end time later than the start time.'); return; }
    const collision = entries.find(b => overlaps(startTime,endTime,b.start_time,b.end_time));
    if (collision) { setError(`That overlaps with “${collision.title}”. Choose another time.`); return; }
    setSaving(true); setError('');
    const { error: insertError } = await supabase.from('time_blocks').insert({ user_id:userId,block_date:selectedDate,title:title.trim(),category,start_time:startTime,end_time:endTime,notes:notes.trim() });
    if (insertError) setError('Could not save this time block. ' + insertError.message);
    else { resetBlockForm(); setNotice('Added to your day.'); window.setTimeout(() => setNotice(''),2600); await load(); }
    setSaving(false);
  };
  const saveRoutine = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!supabase || saving) return;
    if (!routineDays.length) { setError('Choose at least one day for this routine.'); return; }
    if (routineEnd <= routineStart) { setError('Choose an end time later than the start time.'); return; }
    const routineCollision = routines.find(r => r.weekdays.some(day => routineDays.includes(day)) && overlaps(routineStart,routineEnd,r.start_time,r.end_time));
    if (routineCollision) { setError(`This conflicts with the recurring routine “${routineCollision.title}”.`); return; }
    if (routineDays.includes(weekday)) {
      const blockCollision = blocks.find(b => overlaps(routineStart,routineEnd,b.start_time,b.end_time));
      if (blockCollision) { setError(`This conflicts with “${blockCollision.title}” on the selected date.`); return; }
    }
    setSaving(true); setError('');
    const { error: insertError } = await supabase.from('routine_templates').insert({
      user_id:userId,title:routineTitle.trim(),category:routineCategory,weekdays:routineDays,
      start_time:routineStart,end_time:routineEnd,notes:routineNotes.trim(),
    });
    if (insertError) setError('Could not save this routine. ' + insertError.message);
    else { setRoutineTitle('');setRoutineNotes('');setRoutineOpen(false);setNotice('Recurring routine saved.');window.setTimeout(()=>setNotice(''),2600);await load(); }
    setSaving(false);
  };
  const removeBlock = async (blockId: string) => {
    if (!supabase) return;
    const {error:deleteError}=await supabase.from('time_blocks').delete().eq('id',blockId).eq('user_id',userId);
    if(deleteError)setError('Could not remove this block. '+deleteError.message);else setBlocks(current=>current.filter(b=>b.id!==blockId));
  };
  const removeRoutine = async (routine: Routine) => {
    if (!supabase) return;
    const {error:deleteError}=await supabase.from('routine_templates').delete().eq('id',routine.id).eq('user_id',userId);
    if(deleteError)setError('Could not remove this routine. '+deleteError.message);else setRoutines(current=>current.filter(r=>r.id!==routine.id));
  };
  const isToday = selectedDate === dateKey(new Date());
  const totalMinutes = entries.reduce((sum,b)=>{const [sh,sm]=b.start_time.split(':').map(Number);const [eh,em]=b.end_time.split(':').map(Number);return sum+(eh*60+em)-(sh*60+sm);},0);
  return (
    <section className="daily-schedule">
      <div className="daily-schedule-heading"><div><span className="kicker">YOUR DAY, YOUR TERMS</span><h3>Shape the day.</h3><p>Give important things a time and leave room for breaks, changes and the unexpected.</p></div>
        <div className="daily-heading-actions"><button className="daily-add-button" onClick={()=>{setFormOpen(v=>!v);setRoutineOpen(false);}}>{formOpen?<X size={15}/>:<Plus size={15}/>} {formOpen?'Close':'Add time block'}</button><button className="daily-add-button daily-routine-button" onClick={()=>{setRoutineOpen(v=>!v);setFormOpen(false);}}><Repeat2 size={14}/>{routineOpen?'Close':'Add routine'}</button></div>
      </div>
      <div className="daily-datebar"><button onClick={()=>shiftDate(-1)} aria-label="Previous day"><ArrowLeft size={16}/></button><div><CalendarDays size={15}/><strong>{isToday?'Today':prettyDate(selectedDate)}</strong>{isToday&&<span>{prettyDate(selectedDate)}</span>}</div><button onClick={()=>shiftDate(1)} aria-label="Next day"><ArrowRight size={16}/></button>{!isToday&&<button className="daily-today-button" onClick={()=>setSelectedDate(dateKey(new Date()))}>Today</button>}<input aria-label="Choose a day" type="date" value={selectedDate} onChange={e=>e.target.value&&setSelectedDate(e.target.value)}/></div>
      {formOpen&&<form className="daily-block-form" onSubmit={saveBlock}>
        <label>What are you making time for?<input value={title} onChange={e=>setTitle(e.target.value)} maxLength={120} placeholder="e.g. Study, class, reading…" required/></label>
        <div className="daily-form-row"><label>Type<select value={category} onChange={e=>setCategory(e.target.value as Category)}>{categories.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}</select></label><label>Starts<input type="time" value={startTime} onChange={e=>setStartTime(e.target.value)} required/></label><label>Ends<input type="time" value={endTime} onChange={e=>setEndTime(e.target.value)} required/></label></div>
        <label>Note (optional)<textarea value={notes} onChange={e=>setNotes(e.target.value)} maxLength={1000} rows={2} placeholder="Anything useful to remember…"/></label>
        <div className="daily-form-actions"><span>Overlapping blocks are prevented.</span><button type="submit" disabled={saving||!title.trim()}>{saving?'Saving…':'Save time block'}</button></div>
      </form>}
      {routineOpen&&<form className="daily-block-form daily-routine-form" onSubmit={saveRoutine}>
        <div className="daily-routine-intro"><Repeat2 size={16}/><div><strong>Make it repeat.</strong><span>This routine appears on each selected day. It is a template, not a copied event.</span></div></div>
        <label>Routine name<input value={routineTitle} onChange={e=>setRoutineTitle(e.target.value)} maxLength={120} placeholder="e.g. Morning study" required/></label>
        <div className="daily-form-row"><label>Type<select value={routineCategory} onChange={e=>setRoutineCategory(e.target.value as Category)}>{categories.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}</select></label><label>Starts<input type="time" value={routineStart} onChange={e=>setRoutineStart(e.target.value)} required/></label><label>Ends<input type="time" value={routineEnd} onChange={e=>setRoutineEnd(e.target.value)} required/></label></div>
        <div className="daily-days-picker"><span>Repeat on</span><div>{weekDays.map(day=><button type="button" key={day.value} className={routineDays.includes(day.value)?'selected':''} aria-pressed={routineDays.includes(day.value)} onClick={()=>setRoutineDays(days=>days.includes(day.value)?days.filter(d=>d!==day.value):[...days,day.value])}>{day.label}</button>)}</div></div>
        <label>Note (optional)<textarea value={routineNotes} onChange={e=>setRoutineNotes(e.target.value)} maxLength={1000} rows={2} placeholder="Anything useful to remember…"/></label>
        <div className="daily-form-actions"><span>Routine overlaps are checked across selected weekdays.</span><button type="submit" disabled={saving||!routineTitle.trim()||!routineDays.length}>{saving?'Saving…':'Save recurring routine'}</button></div>
      </form>}
      {error&&<div className="life-error" role="alert">{error}</div>}{notice&&<div className="daily-notice">{notice}</div>}
      <div className="daily-summary"><span><Clock3 size={14}/>{entries.length} {entries.length===1?'block':'blocks'} today</span><span>{Math.floor(totalMinutes/60)}h {totalMinutes%60}m planned</span></div>
      {loading?<div className="life-empty">Opening your day…</div>:entries.length?(
        <div className="daily-timeline">{entries.map((block,index)=><article className="daily-block" key={block.id}>
          <div className="daily-block-time"><strong>{prettyTime(block.start_time)}</strong><span>{prettyTime(block.end_time)}</span></div>
          <div className="daily-block-track"><span className={`daily-track-dot category-${block.category}`}/>{index<entries.length-1&&<span className="daily-track-line"/>}</div>
          <div className="daily-block-content"><div><span className={`daily-category category-${block.category}`}>{block.category}{block.recurring&&<em className="daily-recurring-label"><Repeat2 size={10}/> ROUTINE</em>}</span><h4>{block.title}</h4>{block.notes&&<p>{block.notes}</p>}</div>
            {block.recurring?<button onClick={()=>{const item=routines.find(r=>r.id===block.routineId);if(item)void removeRoutine(item);}} aria-label={`Remove recurring routine ${block.title}`}><Trash2 size={14}/></button>:<button onClick={()=>void removeBlock(block.id)} aria-label={`Remove ${block.title}`}><Trash2 size={14}/></button>}
          </div></article>)}</div>
      ):<div className="daily-empty"><CalendarDays size={22}/><strong>Your day is still open.</strong><p>Add a one-time block or create a routine that appears on the days you choose.</p><div><button onClick={()=>setFormOpen(true)}>Add a block <Plus size={14}/></button><button onClick={()=>setRoutineOpen(true)}>Create routine <Repeat2 size={14}/></button></div></div>}
      <div className="daily-routine-library"><div><strong>Recurring routines</strong><span>{routines.length} active</span></div>{routines.length?routines.map(r=><article key={r.id}><div><b>{r.title}</b><span>{weekDays.filter(d=>r.weekdays.includes(d.value)).map(d=>d.label).join(' · ')} · {prettyTime(r.start_time)}–{prettyTime(r.end_time)}</span></div><button onClick={()=>void removeRoutine(r)} aria-label={`Delete routine ${r.title}`}><Trash2 size={13}/></button></article>):<p>No recurring routines yet. Create one to bring a regular part of your week into view.</p>}</div>
      <div className="daily-footnote">A plan is a guide, not a rule. Remove a routine to stop it appearing on future days; existing one-time blocks stay separate.</div>
    </section>
  );
}
