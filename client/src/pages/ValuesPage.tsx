import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { HeartHandshake, MoonStar } from 'lucide-react';
import { api, json } from '../lib/api';
import { Button, Card, EmptyState, PageHeader } from '../components/ui';

type Settings = Record<string, string>;
type Prayer = { prayer: string; completed: number; on_time: number };
type Deen = { date: string; prayers: Prayer[]; quran: { activity: string; pages: number; entries: number }[]; tahajjud: { woke_up: number; prayed: number } };
type Faith = { activity: string; completed: number };
const practices = ['bible', 'prayer', 'reflection', 'worship', 'service'];

function dateKey() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }

export function ValuesPage() {
  const client = useQueryClient();
  const date = dateKey();
  const settings = useQuery({ queryKey: ['settings'], queryFn: () => api<Settings>('/settings') });
  const religion = settings.data?.religion || 'none';
  const deen = useQuery({ queryKey: ['deen', date], queryFn: () => api<Deen>('/deen/summary?date=' + date), enabled: religion === 'islam' });
  const faith = useQuery({ queryKey: ['faith', date], queryFn: () => api<Faith[]>('/faith?date=' + date), enabled: religion === 'christianity' });
  const choose = useMutation({ mutationFn: (value: string) => api('/settings', json('PATCH', { religion: value })), onSuccess: () => void client.invalidateQueries({ queryKey: ['settings'] }) });
  const prayer = useMutation({ mutationFn: (item: Prayer) => api('/deen/prayer', json('PATCH', { date, prayer: item.prayer, completed: !item.completed })), onSuccess: () => void client.invalidateQueries({ queryKey: ['deen', date] }) });
  const practice = useMutation({ mutationFn: (item: Faith) => api('/faith', json('PATCH', { date, activity: item.activity, completed: !item.completed })), onSuccess: () => void client.invalidateQueries({ queryKey: ['faith', date] }) });
  return <div className="stack">
    <PageHeader eyebrow="PERSONAL / VALUES" title="Values" description="A private, optional space for practices that help you stay close to what matters." />
    {religion === 'islam' ? <Card><div className="card-heading"><div><h2>Daily prayers</h2><p>Record what you choose to track. No judgement, just a clear record.</p></div><MoonStar size={18} /></div><div className="list-stack">{deen.data?.prayers.map(item => <div className="list-row" key={item.prayer}><input className="check-control" type="checkbox" checked={!!item.completed} onChange={() => prayer.mutate(item)} /><div className="list-row__body"><b>{item.prayer}</b></div><span className="list-row__meta">{item.completed ? 'Recorded' : 'Not recorded'}</span></div>)}</div></Card> : null}
    {religion === 'christianity' ? <Card><div className="card-heading"><div><h2>Today's practices</h2><p>Choose the practices you want to record.</p></div><HeartHandshake size={18} /></div><div className="list-stack">{practices.map(name => { const item = faith.data?.find(row => row.activity === name) || { activity: name, completed: 0 }; return <div className="list-row" key={name}><input className="check-control" type="checkbox" checked={!!item.completed} onChange={() => practice.mutate(item)} /><div className="list-row__body"><b>{name[0].toUpperCase() + name.slice(1)}</b></div><span className="list-row__meta">{item.completed ? 'Recorded' : 'Not recorded'}</span></div>; })}</div></Card> : null}
    {religion !== 'islam' && religion !== 'christianity' ? <Card><EmptyState title="Make space for your values." detail="This area is optional. Choose a practice framework only if it is useful to you." /><div className="choice-row"><Button onClick={() => choose.mutate('islam')}>Islamic practices</Button><Button variant="secondary" onClick={() => choose.mutate('christianity')}>Christian practices</Button><Button variant="ghost" onClick={() => choose.mutate('none')}>Not now</Button></div></Card> : <Button variant="ghost" onClick={() => choose.mutate('none')}>Turn off values tracking</Button>}
  </div>;
}