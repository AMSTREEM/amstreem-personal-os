import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../lib/api';
import { Button, Card, PageHeader } from '../components/ui';

type CalendarDay = { date: string; sections: string[]; perfect: boolean };
type CalendarData = { month: string; days: CalendarDay[]; streaks: Record<string, { current: number; best: number }> };

export function CalendarPage() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const data = useQuery({ queryKey: ['calendar', month], queryFn: () => api<CalendarData>('/calendar?month=' + month) });
  const first = new Date(month + '-01T12:00:00');
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const offset = (first.getDay() + 6) % 7;
  const cells = useMemo(() => [...Array(offset).fill(null), ...Array.from({ length: daysInMonth }, (_, index) => index + 1)], [offset, daysInMonth]);
  const byDate = new Map((data.data?.days || []).map(day => [day.date, day]));
  function changeMonth(amount: number) { const next = new Date(first.getFullYear(), first.getMonth() + amount, 1); setMonth(next.getFullYear() + '-' + String(next.getMonth() + 1).padStart(2, '0')); }
  return <div className="stack">
    <PageHeader eyebrow="PLAN / TIME" title="Calendar" description="See where your recent activity has been happening. This view is based on recorded sessions and practices." />
    <Card>
      <div className="calendar-head"><Button variant="ghost" onClick={() => changeMonth(-1)} aria-label="Previous month"><ChevronLeft size={18} /></Button><h2>{first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h2><Button variant="ghost" onClick={() => changeMonth(1)} aria-label="Next month"><ChevronRight size={18} /></Button></div>
      <div className="calendar-grid">{['MON','TUE','WED','THU','FRI','SAT','SUN'].map(day => <div className="calendar-weekday" key={day}>{day}</div>)}{cells.map((day, index) => {
        if (!day) return <div className="calendar-cell calendar-cell--blank" key={'blank-' + index} />;
        const date = month + '-' + String(day).padStart(2, '0');
        const record = byDate.get(date);
        return <div className={'calendar-cell ' + (record?.sections.length ? 'calendar-cell--active' : '')} key={date}><span>{day}</span>{record?.sections.length ? <div className="calendar-dots">{record.sections.map(section => <i className={'dot dot--' + section} key={section} title={section} />)}</div> : null}</div>;
      })}</div>
      <div className="calendar-legend"><span><i className="dot dot--focus" /> Focus</span><span><i className="dot dot--learning" /> Learning</span><span><i className="dot dot--habits" /> Rituals</span><span><i className="dot dot--faith" /> Values</span></div>
    </Card>
    <div className="stat-grid stat-grid--four">{Object.entries(data.data?.streaks || {}).map(([name, value]) => <div className="stat-card" key={name}><div className="stat-card__top">{name.toUpperCase()}</div><strong>{value.current}</strong><small>Current days · best {value.best}</small></div>)}</div>
  </div>;
}