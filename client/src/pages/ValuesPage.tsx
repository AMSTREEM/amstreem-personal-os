import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, HeartHandshake, MoonStar } from 'lucide-react';
import { api, json } from '../lib/api';
import { Button, Card, EmptyState, Field, PageHeader, TextArea, TextInput } from '../components/ui';

type Settings = Record<string, string>;
type Prayer = { prayer: string; completed: number; on_time: number };
type Deen = { date: string; prayers: Prayer[]; quran: { activity: string; pages: number; entries: number }[]; tahajjud: { woke_up: number; prayed: number } };
type Faith = { activity: string; completed: number };
type QuranLog = { id: number; log_date: string; activity: string; surah: string; ayah_start: number | null; ayah_end: number | null; pages: number; juz: number | null; reflection: string };
const practices = ['bible', 'prayer', 'reflection', 'worship', 'service'];

function dateKey() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }

export function ValuesPage() {
  const client = useQueryClient();
  const date = dateKey();
  const [activity, setActivity] = useState('memorisation');
  const [surah, setSurah] = useState('');
  const [ayahStart, setAyahStart] = useState('');
  const [ayahEnd, setAyahEnd] = useState('');
  const [pages, setPages] = useState('0');
  const [juz, setJuz] = useState('');
  const [reflection, setReflection] = useState('');
  const settings = useQuery({ queryKey: ['settings'], queryFn: () => api<Settings>('/settings') });
  const religion = settings.data?.religion || 'none';
  const deen = useQuery({ queryKey: ['deen', date], queryFn: () => api<Deen>('/deen/summary?date=' + date), enabled: religion === 'islam' });
  const quranLogs = useQuery({ queryKey: ['quran-logs'], queryFn: () => api<QuranLog[]>('/deen/quran'), enabled: religion === 'islam' });
  const faith = useQuery({ queryKey: ['faith', date], queryFn: () => api<Faith[]>('/faith?date=' + date), enabled: religion === 'christianity' });
  const choose = useMutation({ mutationFn: (value: string) => api('/settings', json('PATCH', { religion: value })), onSuccess: () => void client.invalidateQueries({ queryKey: ['settings'] }) });
  const prayer = useMutation({ mutationFn: (item: Prayer) => api('/deen/prayer', json('PATCH', { date, prayer: item.prayer, completed: !item.completed })), onSuccess: () => void client.invalidateQueries({ queryKey: ['deen', date] }) });
  const tahajjud = useMutation({
    mutationFn: (field: 'woke_up' | 'prayed') => api('/deen/tahajjud', json('PATCH', { date, woke_up: field === 'woke_up' ? !deen.data?.tahajjud.woke_up : !!deen.data?.tahajjud.woke_up, prayed: field === 'prayed' ? !deen.data?.tahajjud.prayed : !!deen.data?.tahajjud.prayed })),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['deen', date] })
  });
  const quran = useMutation({
    mutationFn: () => api('/deen/quran', json('POST', { log_date: date, activity, surah, ayah_start: ayahStart || null, ayah_end: ayahEnd || null, pages: Number(pages), juz: juz || null, reflection })),
    onSuccess: () => { setSurah(''); setAyahStart(''); setAyahEnd(''); setPages('0'); setJuz(''); setReflection(''); void client.invalidateQueries({ queryKey: ['quran-logs'] }); void client.invalidateQueries({ queryKey: ['deen', date] }); }
  });
  const practice = useMutation({ mutationFn: (item: Faith) => api('/faith', json('PATCH', { date, activity: item.activity, completed: !item.completed })), onSuccess: () => void client.invalidateQueries({ queryKey: ['faith', date] }) });

  return <div className="stack">
    <PageHeader eyebrow="PERSONAL / VALUES" title="Values" description="A private, optional space for practices that help you stay close to what matters." />
    {religion === 'islam' ? <>
      <Card><div className="card-heading"><div><h2>Daily prayers</h2><p>Record what you choose to track. No judgement, just a clear record.</p></div><MoonStar size={18} /></div><div className="list-stack">{deen.data?.prayers.map(item => <div className="list-row" key={item.prayer}><input className="check-control" type="checkbox" checked={!!item.completed} onChange={() => prayer.mutate(item)} /><div className="list-row__body"><b>{item.prayer}</b></div><span className="list-row__meta">{item.completed ? 'Recorded' : 'Not recorded'}</span></div>)}</div></Card>
      <Card><div className="card-heading"><div><h2>Qur’an practice</h2><p>Keep memorisation and revision records in one place.</p></div><BookOpen size={18} /></div>
        <form className="form-stack" onSubmit={event => { event.preventDefault(); if (surah.trim()) quran.mutate(); }}>
          <div className="field-row"><Field label="Activity"><select className="field-input" value={activity} onChange={event => setActivity(event.target.value)}><option value="memorisation">Memorisation</option><option value="revision">Revision</option></select></Field><Field label="Surah"><TextInput value={surah} onChange={event => setSurah(event.target.value)} placeholder="Surah name" required /></Field></div>
          <div className="field-row"><Field label="Starting ayah"><TextInput type="number" min="1" max="286" value={ayahStart} onChange={event => setAyahStart(event.target.value)} /></Field><Field label="Ending ayah"><TextInput type="number" min="1" max="286" value={ayahEnd} onChange={event => setAyahEnd(event.target.value)} /></Field></div>
          <div className="field-row"><Field label="Pages"><TextInput type="number" min="0" max="100" value={pages} onChange={event => setPages(event.target.value)} /></Field><Field label="Juz"><TextInput type="number" min="1" max="30" value={juz} onChange={event => setJuz(event.target.value)} /></Field></div>
          <Field label="Reflection (optional)"><TextArea value={reflection} onChange={event => setReflection(event.target.value)} placeholder="A note about this session" /></Field>
          <div><Button type="submit" disabled={quran.isPending || !surah.trim()}>Save Qur’an record</Button></div>
        </form>
        {quran.isError && <p className="inline-error">{quran.error.message}</p>}
        {quranLogs.data?.length ? <div className="list-stack quran-history">{quranLogs.data.slice(0,8).map(log => <div className="list-row" key={log.id}><span className="session-mark"><BookOpen size={15} /></span><div className="list-row__body"><b>{log.surah} · {log.activity}</b><small>{log.log_date}{log.ayah_start ? ' · Ayah ' + log.ayah_start + (log.ayah_end ? '–' + log.ayah_end : '') : ''}{log.pages ? ' · ' + log.pages + ' pages' : ''}</small></div></div>)}</div> : null}
      </Card>
      <Card><div className="card-heading"><div><h2>Tahajjud</h2><p>Track waking and prayer separately, if useful.</p></div></div><div className="list-stack"><div className="list-row"><input className="check-control" type="checkbox" checked={!!deen.data?.tahajjud.woke_up} onChange={() => tahajjud.mutate('woke_up')} /><div className="list-row__body"><b>Woke up</b></div></div><div className="list-row"><input className="check-control" type="checkbox" checked={!!deen.data?.tahajjud.prayed} onChange={() => tahajjud.mutate('prayed')} /><div className="list-row__body"><b>Prayed</b></div></div></div></Card>
    </> : null}
    {religion === 'christianity' ? <Card><div className="card-heading"><div><h2>Today's practices</h2><p>Choose the practices you want to record.</p></div><HeartHandshake size={18} /></div><div className="list-stack">{practices.map(name => { const item = faith.data?.find(row => row.activity === name) || { activity: name, completed: 0 }; return <div className="list-row" key={name}><input className="check-control" type="checkbox" checked={!!item.completed} onChange={() => practice.mutate(item)} /><div className="list-row__body"><b>{name[0].toUpperCase() + name.slice(1)}</b></div><span className="list-row__meta">{item.completed ? 'Recorded' : 'Not recorded'}</span></div>; })}</div></Card> : null}
    {religion !== 'islam' && religion !== 'christianity' ? <Card><EmptyState title="Make space for your values." detail="This area is optional. Choose a practice framework only if it is useful to you." /><div className="choice-row"><Button onClick={() => choose.mutate('islam')}>Islamic practices</Button><Button variant="secondary" onClick={() => choose.mutate('christianity')}>Christian practices</Button><Button variant="ghost" onClick={() => choose.mutate('none')}>Not now</Button></div></Card> : <Button variant="ghost" onClick={() => choose.mutate('none')}>Turn off values tracking</Button>}
  </div>;
}