import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarPlus, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { api, json } from '../lib/api';
import { Button, Card, EmptyState, Field, PageHeader, TextInput } from '../components/ui';

type CalendarDay = { date: string; sections: string[]; perfect: boolean };
type CalendarEvent = { id: number; title: string; description: string; start_at: string; end_at: string | null; project_id: number | null };
type CalendarData = { month: string; days: CalendarDay[]; streaks: Record<string, { current: number; best: number }>; events: CalendarEvent[] };
type Project = { id: number; title: string };

function currentMonth() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit' }).formatToParts(new Date());
  return parts.find(part => part.type === 'year')!.value + '-' + parts.find(part => part.type === 'month')!.value;
}
function localDateTime() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
  const value = (type: string) => parts.find(part => part.type === type)!.value;
  return value('year') + '-' + value('month') + '-' + value('day') + 'T' + value('hour') + ':' + value('minute');
}

export function CalendarPage() {
  const client = useQueryClient();
  const [month, setMonth] = useState(currentMonth);
  const [selectedDate, setSelectedDate] = useState('');
  const [title, setTitle] = useState('');
  const [startAt, setStartAt] = useState(localDateTime);
  const [projectId, setProjectId] = useState('');
  const data = useQuery({ queryKey: ['calendar', month], queryFn: () => api<CalendarData>('/calendar?month=' + month) });
  const projects = useQuery({ queryKey: ['projects'], queryFn: () => api<Project[]>('/projects') });
  const create = useMutation({
    mutationFn: () => api('/calendar/events', json('POST', { title, start_at: startAt, project_id: projectId || null })),
    onSuccess: () => { setTitle(''); setProjectId(''); void client.invalidateQueries({ queryKey: ['calendar', month] }); }
  });
  const remove = useMutation({
    mutationFn: (id: number) => api('/calendar/events/' + id, { method: 'DELETE' }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['calendar', month] })
  });
  const first = new Date(month + '-01T12:00:00');
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const offset = (first.getDay() + 6) % 7;
  const cells = useMemo(() => [...Array(offset).fill(null), ...Array.from({ length: daysInMonth }, (_, index) => index + 1)], [offset, daysInMonth]);
  const byDate = new Map((data.data?.days || []).map(day => [day.date, day]));
  function changeMonth(amount: number) {
    const next = new Date(first.getFullYear(), first.getMonth() + amount, 1);
    setMonth(next.getFullYear() + '-' + String(next.getMonth() + 1).padStart(2, '0'));
  }
  function chooseDate(date: string) { setSelectedDate(date); setStartAt(date + 'T09:00'); }

  return <Cascade className="stack">
    <PageHeader eyebrow="PLAN / TIME" title="Calendar" description="See your commitments alongside the activity you record. Select a day to schedule something." />
    <Card>
      <div className="calendar-head"><Button variant="ghost" onClick={() => changeMonth(-1)} aria-label="Previous month"><ChevronLeft size={18} /></Button><h2>{first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h2><Button variant="ghost" onClick={() => changeMonth(1)} aria-label="Next month"><ChevronRight size={18} /></Button></div>
      <div className="calendar-grid">{['MON','TUE','WED','THU','FRI','SAT','SUN'].map(day => <div className="calendar-weekday" key={day}>{day}</div>)}{cells.map((day, index) => {
        if (!day) return <div className="calendar-cell calendar-cell--blank" key={'blank-' + index} />;
        const date = month + '-' + String(day).padStart(2, '0');
        const record = byDate.get(date);
        const eventCount = (data.data?.events || []).filter(event => event.start_at.slice(0, 10) === date).length;
        return <button type="button" className={'calendar-cell ' + ((record?.sections.length || eventCount) ? 'calendar-cell--active ' : '') + (selectedDate === date ? 'calendar-cell--selected' : '')} key={date} onClick={() => chooseDate(date)}><span>{day}</span><div className="calendar-dots">{record?.sections.map(section => <i className={'dot dot--' + section} key={section} title={section} />)}{eventCount > 0 && <i className="dot dot--event" title={eventCount + ' commitments'} />}</div>{eventCount > 0 && <small>{eventCount} event{eventCount === 1 ? '' : 's'}</small>}</button>;
      })}</div>
      <div className="calendar-legend"><span><i className="dot dot--focus" /> Focus</span><span><i className="dot dot--learning" /> Learning</span><span><i className="dot dot--habits" /> Rituals</span><span><i className="dot dot--faith" /> Values</span><span><i className="dot dot--event" /> Commitments</span></div>
    </Card>
    <div className="content-grid">
      <Card>
        <div className="card-heading"><div><h2>Schedule a commitment</h2><p>{selectedDate ? 'Selected day: ' + selectedDate : 'Add a time commitment to your calendar.'}</p></div><CalendarPlus size={18} /></div>
        <form className="form-stack" onSubmit={event => { event.preventDefault(); if (title.trim()) create.mutate(); }}>
          <Field label="What is happening?"><TextInput value={title} onChange={event => setTitle(event.target.value)} placeholder="Name the commitment" required /></Field>
          <Field label="Start"><TextInput type="datetime-local" value={startAt} onChange={event => setStartAt(event.target.value)} required /></Field>
          <Field label="Related project"><select className="field-input" value={projectId} onChange={event => setProjectId(event.target.value)}><option value="">No linked project</option>{projects.data?.map(project => <option key={project.id} value={project.id}>{project.title}</option>)}</select></Field>
          <div><Button type="submit" disabled={create.isPending || !title.trim()}><CalendarPlus size={15} /> Add commitment</Button></div>
        </form>
        {create.isError && <p className="inline-error">{create.error.message}</p>}
      </Card>
      <Card>
        <div className="card-heading"><div><h2>This month's commitments</h2><p>Scheduled items from your calendar.</p></div></div>
        {data.data?.events?.length ? <div className="list-stack">{data.data.events.map(event => <div className="list-row" key={event.id}><span className="session-mark"><CalendarPlus size={15} /></span><div className="list-row__body"><b>{event.title}</b><small>{event.start_at.replace('T', ' ')}</small></div><button className="icon-button" onClick={() => { if (window.confirm('Delete this calendar commitment?')) remove.mutate(event.id); }} aria-label={'Delete ' + event.title}><Trash2 size={15} /></button></div>)}</div> : <EmptyState title="Your calendar is clear." detail="Add a commitment when something deserves a place in your time." />}
      </Card>
    </div>
    <div className="stat-grid stat-grid--four">{Object.entries(data.data?.streaks || {}).map(([name, value]) => <div className="stat-card" key={name}><div className="stat-card__top">{name.toUpperCase()}</div><strong>{value.current}</strong><small>Current days · best {value.best}</small></div>)}</div>
  </Cascade>;
}