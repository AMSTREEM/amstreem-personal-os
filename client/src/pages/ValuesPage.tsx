import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, HeartHandshake, MoonStar, RotateCcw } from 'lucide-react';
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

  const prayerCount = deen.data?.prayers.filter(item => !!item.completed).length ?? 0;
  const memorisedPages = quranLogs.data?.filter(log => log.activity === 'memorisation').reduce((sum, log) => sum + log.pages, 0) ?? 0;
  const revisedPages = quranLogs.data?.filter(log => log.activity === 'revision').reduce((sum, log) => sum + log.pages, 0) ?? 0;
  return <div className="stack deen-page">
    <header className="module-hero deen-hero">
      <div><span className="eyebrow">SPIRITUAL DEVELOPMENT / 001</span><h1>The Deen <em>space.</em></h1><p>A private record of worship, memorisation and revision. A gentle aid to consistency, never a measure of your worth.</p></div>
      {religion === 'islam' && <div className="module-hero-stat"><strong>{prayerCount}<span>/5</span></strong><small>PRAYERS LOGGED</small></div>}
    </header>
    {religion === 'islam' ? <>
      <div className="module-datebar surface-card"><div><span className="module-kicker">YOUR DAILY RECORD</span><strong>Take today as it comes.</strong></div><span className="module-date-label">{new Intl.DateTimeFormat('en-GB',{weekday:'long',day:'numeric',month:'long'}).format(new Date())}</span></div>
      <div className="deen-grid">
        <Card className="deen-prayer-panel">
          <div className="module-panel-head"><div><span className="module-kicker">THE FIVE DAILY PRAYERS</span><h2>Prayer record.</h2></div><span className="module-count">{prayerCount} / 5 COMPLETE</span></div>
          <p className="module-intro">Mark each prayer when completed. Keep this as a private record, not a measure of your worth.</p>
          <div className="deen-prayer-list">{deen.data?.prayers.map(item => <label className="deen-prayer-row" key={item.prayer}><input className="check-control" type="checkbox" checked={!!item.completed} onChange={() => prayer.mutate(item)} /><span className="deen-prayer-copy"><b>{item.prayer}</b><small>{item.completed ? 'Recorded for today' : 'Not recorded yet'}</small></span><span className={'deen-prayer-state' + (item.completed ? ' is-done' : '')}>{item.completed ? 'Complete' : 'Pending'}</span></label>)}</div>
          <p className="module-footnote">Your private personal record. Never a judgement or a substitute for your own religious guidance.</p>
        </Card>
        <Card className="deen-tahajjud-panel">
          <div className="module-panel-head"><div><span className="module-kicker">BEFORE FAJR · OPTIONAL NIGHT WORSHIP</span><h2>Tahajjud.</h2></div><MoonStar size={19}/></div>
          <p className="module-intro">A quiet intention to wake, stand and turn to Allah.</p>
          <div className="tahajjud-choice-list">
            <label className="tahajjud-choice"><input className="check-control" type="checkbox" checked={!!deen.data?.tahajjud.woke_up} onChange={() => tahajjud.mutate('woke_up')}/><span><b>Woke up</b><small>Made the effort to rise</small></span><span className="choice-indicator"/></label>
            <label className="tahajjud-choice"><input className="check-control" type="checkbox" checked={!!deen.data?.tahajjud.prayed} onChange={() => tahajjud.mutate('prayed')}/><span><b>Prayed</b><small>Recorded the prayer</small></span><span className="choice-indicator"/></label>
          </div>
          <div className="deen-quiet-note"><MoonStar size={15}/> No streak pressure. Every return is an opportunity.</div>
        </Card>
      </div>
      <section className="deen-quran-section">
        <div className="module-section-heading"><div><span className="eyebrow">HIFZ / RECITATION / REVISION</span><h2>Qur’an <em>journey.</em></h2><p>Track memorisation and revision by surah, ayah, page and juz.</p></div><Button onClick={() => document.querySelector('.deen-quran-entry')?.scrollIntoView({behavior:'smooth',block:'center'})}><BookOpen size={15}/> Log a session</Button></div>
        <div className="stat-grid stat-grid--three deen-quran-stats">
          <div className="stat-card"><div className="stat-card__top">MEMORISATION TODAY<BookOpen size={15}/></div><strong>{memorisedPages}<small> pages</small></strong><span>New material recorded</span></div>
          <div className="stat-card"><div className="stat-card__top">REVISION TODAY<RotateCcw size={15}/></div><strong>{revisedPages}<small> pages</small></strong><span>Previously memorised material</span></div>
          <div className="stat-card"><div className="stat-card__top">SESSIONS TODAY<MoonStar size={15}/></div><strong>{quranLogs.data?.filter(log => log.log_date === date).length ?? 0}<small> sessions</small></strong><span>Memorisation + revision</span></div>
        </div>
        <div className="deen-quran-layout">
          <Card className="deen-quran-entry">
            <div className="module-panel-head"><div><span className="module-kicker">ADD TO YOUR RECORD</span><h2>Log a session.</h2></div><BookOpen size={18}/></div>
            <form className="form-stack" onSubmit={event => { event.preventDefault(); if (surah.trim()) quran.mutate(); }}>
              <div className="field-row"><Field label="Activity"><select className="field-input" value={activity} onChange={event => setActivity(event.target.value)}><option value="memorisation">Memorisation</option><option value="revision">Revision</option></select></Field><Field label="Surah"><TextInput value={surah} onChange={event => setSurah(event.target.value)} placeholder="Surah name" required/></Field></div>
              <div className="field-row"><Field label="Starting ayah"><TextInput type="number" min="1" max="286" value={ayahStart} onChange={event => setAyahStart(event.target.value)}/></Field><Field label="Ending ayah"><TextInput type="number" min="1" max="286" value={ayahEnd} onChange={event => setAyahEnd(event.target.value)}/></Field></div>
              <div className="field-row"><Field label="Pages"><TextInput type="number" min="0" max="100" value={pages} onChange={event => setPages(event.target.value)}/></Field><Field label="Juz"><TextInput type="number" min="1" max="30" value={juz} onChange={event => setJuz(event.target.value)}/></Field></div>
              <Field label="Reflection (optional)"><TextArea value={reflection} onChange={event => setReflection(event.target.value)} placeholder="A note about this session"/></Field>
              <div><Button type="submit" disabled={quran.isPending || !surah.trim()}>{quran.isPending ? 'Saving…' : 'Save Qur’an record'}</Button></div>
            </form>
            {quran.isError && <p className="inline-error">{quran.error.message}</p>}
          </Card>
          <Card className="deen-history-panel"><div className="module-panel-head"><div><span className="module-kicker">YOUR HIFZ RECORD</span><h2>Recent sessions.</h2></div><span className="module-count">LATEST 8</span></div>
            {quranLogs.data?.length ? <div className="list-stack quran-history">{quranLogs.data.slice(0,8).map(log => <div className="list-row" key={log.id}><span className="session-mark"><BookOpen size={15}/></span><div className="list-row__body"><b>{log.surah} · {log.activity}</b><small>{log.log_date}{log.ayah_start ? ' · Ayah ' + log.ayah_start + (log.ayah_end ? '–' + log.ayah_end : '') : ''}{log.pages ? ' · ' + log.pages + ' pages' : ''}</small></div></div>)}</div> : <EmptyState title="Your Qur’an journey starts here." detail="Saved memorisation and revision sessions will appear in this record."/>}
          </Card>
        </div>
      </section>
    </> : null}
    {religion === 'christianity' ? <Card><div className="module-panel-head"><div><span className="module-kicker">FAITH · DAILY PRACTICE</span><h2>Today's practices.</h2></div><HeartHandshake size={19}/></div><div className="deen-prayer-list">{practices.map(name => { const item = faith.data?.find(row => row.activity === name) || { activity: name, completed: 0 }; return <label className="deen-prayer-row" key={name}><input className="check-control" type="checkbox" checked={!!item.completed} onChange={() => practice.mutate(item)}/><span className="deen-prayer-copy"><b>{name[0].toUpperCase() + name.slice(1)}</b><small>{item.completed ? 'Recorded for today' : 'Not recorded yet'}</small></span></label>; })}</div></Card> : null}
    {religion !== 'islam' && religion !== 'christianity' ? <Card className="deen-enable-card"><EmptyState title="Make room for Deen." detail="This space is optional. Enable Islamic practices when you want salah, Qur’an and Tahajjud tracking in Atlas."/><div className="choice-row"><Button onClick={() => choose.mutate('islam')}>Enable Deen</Button><Button variant="secondary" onClick={() => choose.mutate('christianity')}>Christian practices</Button><Button variant="ghost" onClick={() => choose.mutate('none')}>Not now</Button></div></Card> : <Button variant="ghost" onClick={() => choose.mutate('none')}>Turn off Deen tracking</Button>}
  </div>;
}