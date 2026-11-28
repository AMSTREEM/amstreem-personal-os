import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, CalendarDays, Clock3, Plus, Trash2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

type TimeBlock = {
  id: string;
  user_id: string;
  block_date: string;
  title: string;
  category: 'focus' | 'study' | 'class' | 'personal' | 'break' | 'rest' | 'other';
  start_time: string;
  end_time: string;
  notes: string;
};

const dateKey = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};
const prettyDate = (key: string) => new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(key + 'T12:00:00'));
const prettyTime = (value: string) => new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date('2000-01-01T' + value.slice(0, 5) + ':00'));
const categories = [
  { value: 'focus', label: 'Focus' }, { value: 'study', label: 'Study' },
  { value: 'class', label: 'Class' }, { value: 'personal', label: 'Personal' },
  { value: 'break', label: 'Break' }, { value: 'rest', label: 'Rest' },
  { value: 'other', label: 'Other' },
] as const;

export default function DailySchedule({ userId }: { userId: string }) {
  const [selectedDate, setSelectedDate] = useState(dateKey(new Date()));
  const [blocks, setBlocks] = useState<TimeBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<TimeBlock['category']>('personal');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [notes, setNotes] = useState('');

  const load = async () => {
    if (!supabase) { setLoading(false); return; }
    setLoading(true);
    const { data, error: queryError } = await supabase.from('time_blocks')
      .select('id,user_id,block_date,title,category,start_time,end_time,notes')
      .eq('user_id', userId).eq('block_date', selectedDate).order('start_time');
    if (queryError) setError('Your day could not be loaded. ' + queryError.message);
    else { setBlocks((data || []) as TimeBlock[]); setError(''); }
    setLoading(false);
  };

  useEffect(() => { void load(); }, [selectedDate, userId]);

  const shiftDate = (amount: number) => {
    const next = new Date(selectedDate + 'T12:00:00');
    next.setDate(next.getDate() + amount);
    setSelectedDate(dateKey(next));
  };

  const resetForm = () => {
    setTitle(''); setCategory('personal'); setStartTime('09:00'); setEndTime('10:00'); setNotes('');
    setFormOpen(false);
  };

  const saveBlock = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || saving) return;
    if (endTime <= startTime) { setError('Choose an end time later than the start time.'); return; }
    const collision = blocks.find(block => startTime < block.end_time.slice(0, 5) && endTime > block.start_time.slice(0, 5));
    if (collision) { setError(`That overlaps with “${collision.title}”. Choose another time.`); return; }
    setSaving(true); setError('');
    const { data, error: insertError } = await supabase.from('time_blocks').insert({
      user_id: userId, block_date: selectedDate, title: title.trim(), category,
      start_time: startTime, end_time: endTime, notes: notes.trim(),
    }).select('id,user_id,block_date,title,category,start_time,end_time,notes').single();
    if (insertError) setError('Could not save this time block. ' + insertError.message);
    else { setBlocks(current => [...current, data as TimeBlock].sort((a, b) => a.start_time.localeCompare(b.start_time))); resetForm(); setNotice('Added to your day.'); window.setTimeout(() => setNotice(''), 2600); }
    setSaving(false);
  };

  const removeBlock = async (block: TimeBlock) => {
    if (!supabase) return;
    const { error: deleteError } = await supabase.from('time_blocks').delete().eq('id', block.id).eq('user_id', userId);
    if (deleteError) setError('Could not remove this block. ' + deleteError.message);
    else setBlocks(current => current.filter(item => item.id !== block.id));
  };

  const isToday = selectedDate === dateKey(new Date());
  const totalMinutes = blocks.reduce((sum, block) => {
    const [sh, sm] = block.start_time.split(':').map(Number);
    const [eh, em] = block.end_time.split(':').map(Number);
    return sum + (eh * 60 + em) - (sh * 60 + sm);
  }, 0);

  return (
    <section className="daily-schedule">
      <div className="daily-schedule-heading">
        <div><span className="kicker">YOUR DAY, YOUR TERMS</span><h3>Shape the day.</h3><p>Give important things a time and leave room for breaks, changes and the unexpected.</p></div>
        <button className="daily-add-button" onClick={() => setFormOpen(value => !value)}>{formOpen ? <X size={15}/> : <Plus size={15}/>} {formOpen ? 'Close' : 'Add time block'}</button>
      </div>
      <div className="daily-datebar">
        <button onClick={() => shiftDate(-1)} aria-label="Previous day"><ArrowLeft size={16}/></button>
        <div><CalendarDays size={15}/><strong>{isToday ? 'Today' : prettyDate(selectedDate)}</strong>{isToday && <span>{prettyDate(selectedDate)}</span>}</div>
        <button onClick={() => shiftDate(1)} aria-label="Next day"><ArrowRight size={16}/></button>
        {!isToday && <button className="daily-today-button" onClick={() => setSelectedDate(dateKey(new Date()))}>Today</button>}
        <input aria-label="Choose a day" type="date" value={selectedDate} onChange={event => event.target.value && setSelectedDate(event.target.value)}/>
      </div>
      {formOpen && <form className="daily-block-form" onSubmit={saveBlock}>
        <label>What are you making time for?<input value={title} onChange={event => setTitle(event.target.value)} maxLength={120} placeholder="e.g. Study, class, reading…" required/></label>
        <div className="daily-form-row">
          <label>Type<select value={category} onChange={event => setCategory(event.target.value as TimeBlock['category'])}>{categories.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label>Starts<input type="time" value={startTime} onChange={event => setStartTime(event.target.value)} required/></label>
          <label>Ends<input type="time" value={endTime} onChange={event => setEndTime(event.target.value)} required/></label>
        </div>
        <label>Note (optional)<textarea value={notes} onChange={event => setNotes(event.target.value)} maxLength={1000} rows={2} placeholder="Anything useful to remember…"/></label>
        <div className="daily-form-actions"><span>Overlapping blocks are prevented.</span><button type="submit" disabled={saving || !title.trim()}>{saving ? 'Saving…' : 'Save time block'}</button></div>
      </form>}
      {error && <div className="life-error" role="alert">{error}</div>}
      {notice && <div className="daily-notice">{notice}</div>}
      <div className="daily-summary"><span><Clock3 size={14}/>{blocks.length} {blocks.length === 1 ? 'block' : 'blocks'}</span><span>{Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m planned</span></div>
      {loading ? <div className="life-empty">Opening your day…</div> : blocks.length ? (
        <div className="daily-timeline">
          {blocks.map((block, index) => <article className="daily-block" key={block.id}>
            <div className="daily-block-time"><strong>{prettyTime(block.start_time)}</strong><span>{prettyTime(block.end_time)}</span></div>
            <div className="daily-block-track"><span className={`daily-track-dot category-${block.category}`}/>{index < blocks.length - 1 && <span className="daily-track-line"/>}</div>
            <div className="daily-block-content"><div><span className={`daily-category category-${block.category}`}>{block.category}</span><h4>{block.title}</h4>{block.notes && <p>{block.notes}</p>}</div><button onClick={() => void removeBlock(block)} aria-label={`Remove ${block.title}`}><Trash2 size={14}/></button></div>
          </article>)}
        </div>
      ) : <div className="daily-empty"><CalendarDays size={22}/><strong>Your day is still open.</strong><p>Add a class, study session, break or anything else you want to make room for. Nothing gets scheduled without you.</p><button onClick={() => setFormOpen(true)}>Plan a first block <Plus size={14}/></button></div>}
      <div className="daily-footnote">A plan is a guide, not a rule. Leave breathing room and adjust whenever you need.</div>
    </section>
  );
}
