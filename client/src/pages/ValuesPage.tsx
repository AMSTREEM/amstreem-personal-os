import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Check, HeartHandshake, MoonStar, Plus, RotateCcw, Sparkles, Timer } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { api, json } from '../lib/api';
import { Button, Card, EmptyState, Field, PageHeader, TextArea, TextInput } from '../components/ui';
import { Cascade } from '../components/Cascade';
import { playAtlasFeedback } from '../lib/microFeedback';
import { RhythmConstellation } from '../components/fx/RhythmConstellation';
import { triggerSparkBurst } from '../components/fx/SparkBurst';
import { QuranMushafReader } from '../components/QuranMushafReader';

type Settings = Record<string, string>;
type Prayer = { prayer: string; completed: number; on_time: number };
type Deen = { date: string; prayers: Prayer[]; quran: { activity: string; pages: number; entries: number }[]; tahajjud: { woke_up: number; prayed: number } };
type RhythmRecord = { id: number; record_date: string; tradition: string; record_type: string; title: string; detail: string; status: 'planned'|'completed'|'active'|'answered'; metadata: Record<string, unknown> };
const prayerNames = ['Fajr','Dhuhr','Asr','Maghrib','Isha'];
const prayerRhythm = ['Morning Quiet Time','Midday Pause','Evening Examen'];
const jumuahItems = ['Prepare for Jumu’ah prayer','Read Surah Al-Kahf','Make time for salawat and du’a','Review the week and intentions'];
function dateKey() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }

export function ValuesPage() {
  const client = useQueryClient();
  const { role } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const date = dateKey();
  const [faithWorkspace, setFaithWorkspace] = useState<'primary'|'secondary'|'tertiary'|'all'>('primary');
  const [quickTitle, setQuickTitle] = useState('');
  const [quickDetail, setQuickDetail] = useState('');
  const [quickStatus, setQuickStatus] = useState<'planned'|'completed'>('planned');
  const [muhasabah, setMuhasabah] = useState('');
  const [intention, setIntention] = useState('');
  const [wisdom, setWisdom] = useState('');
  const [evening, setEvening] = useState('');
  const [book, setBook] = useState('');
  const [chapter, setChapter] = useState('');
  const [verse, setVerse] = useState('');
  const [memory, setMemory] = useState('');
  const [sermon, setSermon] = useState('');
  const [pray, setPray] = useState('');
  const [intercession, setIntercession] = useState('');
  const [intercessionDetail, setIntercessionDetail] = useState('');
  const settings = useQuery({ queryKey: ['settings'], queryFn: () => api<Settings>('/settings') });
  const traditionMutation = useMutation({
    mutationFn: (value: 'islam'|'christianity'|'general') => api<Settings>('/settings', json('PATCH', { faith_tradition: value })),
    onSuccess: () => { void client.invalidateQueries({ queryKey: ['settings'] }); void client.invalidateQueries({ queryKey: ['overview'] }); void client.invalidateQueries({ queryKey: ['deen'] }); void client.invalidateQueries({ queryKey: ['quran-logs'] }); void client.invalidateQueries({ queryKey: ['rhythm-records'] }); void client.invalidateQueries({ queryKey: ['rhythm-summary'] }); }
  });
  const religion = settings.data?.faith_tradition || settings.data?.religion || 'none';
  const requestedTradition = searchParams.get('tradition');
  const adminPreview = role === 'admin' && ['islam','christianity','general'].includes(requestedTradition || '') ? requestedTradition : null;
  const tradition = adminPreview || (religion === 'islam' || religion === 'christianity' ? religion : 'general');
  const deen = useQuery({ queryKey: ['deen', date], queryFn: () => api<Deen>('/deen/summary?date=' + date), enabled: tradition === 'islam' });
  const records = useQuery({ queryKey: ['rhythm-records', date], queryFn: () => api<RhythmRecord[]>('/rhythm/records?date=' + date) });
  const createRecord = useMutation({
    mutationFn: (entry: { record_type: string; title: string; detail?: string; status?: RhythmRecord['status']; record_date?: string }) => api<RhythmRecord>('/rhythm/records', json('POST', { record_date: date, status: 'completed', ...entry, ...(adminPreview ? { admin_tradition: adminPreview } : {}) })),
    onSuccess: () => { void client.invalidateQueries({ queryKey: ['rhythm-records', date] }); void client.invalidateQueries({ queryKey: ['rhythm-summary'] }); void client.invalidateQueries({ queryKey: ['overview'] }); }
  });
  const updateRecord = useMutation({
    mutationFn: (entry: { id: number; status: RhythmRecord['status'] }) => api<RhythmRecord>('/rhythm/records/' + entry.id, json('PATCH', { status: entry.status })),
    onSuccess: () => { void client.invalidateQueries({ queryKey: ['rhythm-records', date] }); void client.invalidateQueries({ queryKey: ['rhythm-summary'] }); void client.invalidateQueries({ queryKey: ['overview'] }); }
  });
  const prayer = useMutation({
    onMutate: entry => { if (entry.status !== 'pending') { playAtlasFeedback('tick'); triggerSparkBurst(window.innerWidth/2, window.innerHeight*.44); } },
    mutationFn: (entry: { item: Prayer; status: 'pending'|'on_time'|'qada' }) => api('/deen/prayer', json('PATCH', { date, prayer: entry.item.prayer, completed: entry.status === 'pending' ? 0 : 1, on_time: entry.status === 'on_time' ? 1 : 0 })),
    onSuccess: () => { void client.invalidateQueries({ queryKey: ['deen', date] }); void client.invalidateQueries({ queryKey: ['overview'] }); }
  });
  const recordsFor = (type: string) => (records.data || []).filter(item => item.record_type === type);
  const add = (type: string, title: string, detail = '', status: RhythmRecord['status'] = 'completed') => createRecord.mutate({ record_type: type, title, detail, status });
  const setPrayerStatus = (item: Prayer, status: string) => prayer.mutate({ item, status: status as 'pending'|'on_time'|'qada' });
  const prayerCount = deen.data?.prayers.filter(item => !!item.completed).length ?? 0;
  const recordList = (types: string[]) => (records.data || []).filter(item => types.includes(item.record_type));
  const recordRow = (item: RhythmRecord, answerable = false) => <div className="rhythm-record-row" key={item.id}><span className={'rhythm-record-status rhythm-record-status--' + item.status}>{item.status === 'completed' ? <Check size={13}/> : item.status === 'answered' ? <HeartHandshake size={13}/> : null}</span><div><b>{item.title}</b>{item.detail && <small>{item.detail}</small>}</div>{answerable && item.status === 'active' ? <button type="button" className="text-link" onClick={() => updateRecord.mutate({id:item.id,status:'answered'})}>Mark answered</button> : ['planned','completed'].includes(item.status) && ['sunnah','adhkar','jumuah','prayer_rhythm','daily_intention'].includes(item.record_type) ? <button type="button" className="text-link" onClick={() => updateRecord.mutate({id:item.id,status:item.status==='completed'?'planned':'completed'})}>{item.status==='completed'?'Return to plan':'Mark complete'}</button> : <span className="rhythm-record-label">{item.status}</span>}</div>;

  return <Cascade className="stack rhythm-page daily-rhythm-sanctuary">
    <PageHeader eyebrow={tradition === 'islam' ? 'FAITH / DEEN & QUR’AN' : tradition === 'christianity' ? 'FAITH & REFLECTION' : 'PERSONAL REFLECTION'} title={tradition === 'islam' ? 'Deen & Qur’an' : tradition === 'christianity' ? 'Faith & Reflection' : 'Clarity & Reflection'} description="A calm space for daily practice, reading and reflection." action={<div className="atlas-segmented-switcher deen-tradition-switcher" role="group" aria-label="Choose your tradition">{(['islam','christianity','general'] as const).map(value => <button key={value} type="button" className={tradition===value?'is-active':''} aria-pressed={tradition===value} disabled={traditionMutation.isPending} onClick={() => { if(adminPreview) setSearchParams(value==='general'?{}:{tradition:value}); else traditionMutation.mutate(value); }}>{value==='islam'?'Islam':value==='christianity'?'Christianity':'General'}</button>)}</div>}/>
    <RhythmConstellation/>
    {tradition === 'islam' && <div className="rhythm-branch" data-faith-workspace={faithWorkspace}>
      <nav className="growth-workspace-switcher atlas-segmented-switcher" aria-label="Choose faith workspace">{["Salah & Adhkar","Qur'an & Hifz","Jumu'ah & Muhasabah","Show All"].map((label,index)=><button key={label} type="button" className={faithWorkspace===(['primary','secondary','tertiary','all'][index])?'is-active':''} aria-pressed={faithWorkspace===(['primary','secondary','tertiary','all'][index])} onClick={()=>setFaithWorkspace(['primary','secondary','tertiary','all'][index] as 'primary'|'secondary'|'tertiary'|'all')}>{label}</button>)}</nav>
      <div className="rhythm-grid">
        <Card className="faith-section-primary"><div className="module-panel-head"><div><span className="module-kicker">THE FIVE DAILY PRAYERS</span><h2>Salah record</h2><p className="rhythm-prayer-count">{prayerCount}/5 prayers recorded</p></div><MoonStar size={18}/></div><p className="module-intro">Choose whether each prayer was completed on time, made up (qada), or is not yet recorded.</p>
          <div className="rhythm-prayer-progress" role="progressbar" aria-label="Salah recorded today" aria-valuemin={0} aria-valuemax={5} aria-valuenow={prayerCount}><span style={{width:(prayerCount/5*100)+'%'}}/></div>
          <div className="rhythm-prayer-list">{(deen.data?.prayers || prayerNames.map(prayer => ({prayer,completed:0,on_time:0}))).map(item => {const value=!item.completed?'pending':item.on_time?'on_time':'qada';const label=value==='pending'?'Unrecorded':value==='on_time'?'On time':'Qada';return <div className={'rhythm-prayer-row rhythm-prayer-row--'+value} key={item.prayer}><div><b>{item.prayer}</b><small>{label}</small></div><div className="rhythm-prayer-segments" role="group" aria-label={item.prayer+' status'}>{([{value:'pending',label:'Unrecorded'},{value:'on_time',label:'On time'},{value:'qada',label:'Qada'}] as const).map(option=><button type="button" key={option.value} aria-pressed={value===option.value} className={value===option.value?'is-active':''} disabled={prayer.isPending} onClick={()=>setPrayerStatus(item,option.value)}>{option.label}</button>)}</div></div>;})}</div>
        </Card>
        <Card className="faith-section-primary"><div className="module-panel-head"><div><span className="module-kicker">OPTIONAL · SUNNAH & ADHKAR</span><h2>Small acts, freely chosen</h2></div><Sparkles size={18}/></div>
          <details className="atlas-add-disclosure"><summary>+ Add practice</summary><form className="rhythm-inline-form" onSubmit={event=>{event.preventDefault();if(quickTitle.trim())add('sunnah',quickTitle.trim(),quickDetail,quickStatus);setQuickTitle('');setQuickDetail('');setQuickStatus('planned');}}><Field label="PRACTICE"><TextInput value={quickTitle} onChange={event=>setQuickTitle(event.target.value)} placeholder="e.g. Duha prayer" required/></Field><Field label="NOTE (OPTIONAL)"><TextInput value={quickDetail} onChange={event=>setQuickDetail(event.target.value)} placeholder="A gentle reminder"/></Field><Field label="STATUS"><select className="field-input" value={quickStatus} onChange={event=>setQuickStatus(event.target.value as 'planned'|'completed')}><option value="planned">Planned</option><option value="completed">Completed</option></select></Field><Button type="submit" disabled={createRecord.isPending}><Plus size={14}/> Add</Button></form></details>
          <div className="rhythm-record-list">{recordList(['sunnah','adhkar']).map(item=>recordRow(item))}{!recordList(['sunnah','adhkar']).length && <p className="muted">No optional practices logged today.</p>}</div>
          <div className="rhythm-quick-actions"><button type="button" onClick={()=>add('adhkar','Morning adhkar','', 'completed')}>+ Morning adhkar</button><button type="button" onClick={()=>add('adhkar','Evening adhkar','', 'completed')}>+ Evening adhkar</button></div>
        </Card>
      </div>
      <QuranMushafReader autoOpen={searchParams.get('openMushaf') === '1'} settings={settings.data || {}} settingsReady={settings.isFetched} onLogged={() => { void client.invalidateQueries({ queryKey: ['deen', date] }); void client.invalidateQueries({ queryKey: ['rhythm-summary'] }); void client.invalidateQueries({ queryKey: ['overview'] }); }} />
      <div className="rhythm-grid">
        <Card className="faith-section-tertiary"><div className="module-panel-head"><div><span className="module-kicker">FRIDAY PREPARATION</span><h2>Jumu’ah checklist</h2></div></div>
          {jumuahItems.map(title=>{const item=recordsFor('jumuah').find(row=>row.title===title);return <div className="rhythm-check-row" key={title}><span>{title}</span>{item ? <button type="button" className={item.status==='completed'?'is-complete':''} onClick={()=>updateRecord.mutate({id:item.id,status:item.status==='completed'?'planned':'completed'})}>{item.status==='completed'?'Completed':'Planned · Mark done'}</button> : <button type="button" onClick={()=>add('jumuah',title,'', 'planned')}>Add to plan</button>}</div>;})}
        </Card>
        <Card className="faith-section-tertiary"><div className="module-panel-head"><div><span className="module-kicker">MUHASABAH</span><h2>Daily reflection</h2></div></div>
          <details className="atlas-add-disclosure"><summary>+ Add record</summary><form className="form-stack" onSubmit={event=>{event.preventDefault();if(muhasabah.trim())add('muhasabah','Daily Muhasabah',muhasabah);setMuhasabah('');}}><Field label="WHAT ARE YOU GRATEFUL FOR? WHAT NEEDS ATTENTION?"><TextArea value={muhasabah} onChange={event=>setMuhasabah(event.target.value)} rows={3} placeholder="Reflect honestly, without harshness."/></Field><Button type="submit" disabled={!muhasabah.trim()||createRecord.isPending}>Save Muhasabah</Button></form></details>
          {recordList(['muhasabah']).map(item=>recordRow(item))}
        </Card>
      </div>
    </div>}
    {tradition === 'christianity' && <div className="rhythm-branch" data-faith-workspace={faithWorkspace}>
      <section className="rhythm-intro surface-card"><div><span className="eyebrow">FAITH · DAILY PRACTICE</span><h2>Make room for devotion.</h2><p>Plan your prayer rhythm, record Scripture and keep a living list of people and needs you are praying for.</p></div><div className="rhythm-intro-stat"><b>{recordList(['prayer_rhythm','bible_reading','scripture_memory','sermon_note','pray_reflection']).filter(item=>item.status==='completed').length}</b><small>COMPLETED TODAY</small></div></section>
      <nav className="growth-workspace-switcher atlas-segmented-switcher" aria-label="Choose faith workspace">{["Prayer & Intercession","Scripture & Study","Sermon & P-R-A-Y","Show All"].map((label,index)=><button key={label} type="button" className={faithWorkspace===(['primary','secondary','tertiary','all'][index])?'is-active':''} aria-pressed={faithWorkspace===(['primary','secondary','tertiary','all'][index])} onClick={()=>setFaithWorkspace(['primary','secondary','tertiary','all'][index] as 'primary'|'secondary'|'tertiary'|'all')}>{label}</button>)}</nav>
      <Card className="faith-section-primary"><div className="module-panel-head"><div><span className="module-kicker">DAILY PRAYER RHYTHM</span><h2>Pause, pray, return.</h2></div><HeartHandshake size={18}/></div>
        <div className="rhythm-prayer-progress" role="progressbar" aria-label="Daily prayer rhythm completed" aria-valuemin={0} aria-valuemax={prayerRhythm.length} aria-valuenow={recordList(['prayer_rhythm']).filter(item=>item.status==='completed').length}><span style={{width:(recordList(['prayer_rhythm']).filter(item=>item.status==='completed').length/prayerRhythm.length*100)+'%'}}/></div>
        <div className="rhythm-prayer-list rhythm-prayer-list--devotional">{prayerRhythm.map(title=>{const item=recordsFor('prayer_rhythm').find(row=>row.title===title);const value=item?.status==='completed'?'completed':'planned';return <div className={'rhythm-prayer-row rhythm-prayer-row--'+value} key={title}><div><b>{title}</b><small>{item?.status==='completed'?'Completed':'Not recorded'}</small></div><div className="rhythm-prayer-segments rhythm-prayer-segments--faith" role="group" aria-label={title+' status'}><button type="button" className={!item||item.status!=='completed'?'is-active':''} aria-pressed={!item||item.status!=='completed'} onClick={()=>{if(item?.status==='completed')updateRecord.mutate({id:item.id,status:'planned'});}}>Not recorded</button><button type="button" className={item?.status==='completed'?'is-active':''} aria-pressed={item?.status==='completed'} onClick={()=>{if(!item)add('prayer_rhythm',title,'','completed');else if(item.status!=='completed')updateRecord.mutate({id:item.id,status:'completed'});}} disabled={updateRecord.isPending}>Completed</button></div></div>;})}</div>
      </Card>
      <div className="rhythm-grid">
        <Card className="faith-section-primary"><div className="module-panel-head"><div><span className="module-kicker">INTERCESSORY PRAYER</span><h2>Hold people in prayer.</h2></div></div>
          <details className="atlas-add-disclosure"><summary>+ Add record</summary><form className="form-stack" onSubmit={event=>{event.preventDefault();if(intercession.trim())add('intercessory',intercession.trim(),intercessionDetail,'active');setIntercession('');setIntercessionDetail('');}}><Field label="PERSON OR PRAYER NEED"><TextInput value={intercession} onChange={event=>setIntercession(event.target.value)} placeholder="A person, situation or need" required/></Field><Field label="DETAILS (OPTIONAL)"><TextArea value={intercessionDetail} onChange={event=>setIntercessionDetail(event.target.value)} rows={2}/></Field><Button type="submit" disabled={createRecord.isPending||!intercession.trim()}><Plus size={14}/> Add prayer</Button></form></details>
          <div className="rhythm-record-list"><span className="eyebrow">ACTIVE</span>{recordList(['intercessory']).filter(item=>item.status==='active').map(item=>recordRow(item,true))}<span className="eyebrow">ANSWERED</span>{recordList(['intercessory']).filter(item=>item.status==='answered').map(item=>recordRow(item))}</div>
        </Card>
        <Card className="faith-section-secondary"><div className="module-panel-head"><div><span className="module-kicker">BIBLE READING</span><h2>Record Scripture.</h2></div><BookOpen size={18}/></div>
          <details className="atlas-add-disclosure"><summary>+ Add record</summary><form className="form-stack" onSubmit={event=>{event.preventDefault();if(book.trim())add('bible_reading',book.trim(),'Chapter '+chapter+(verse?' · Verse '+verse:''));setBook('');setChapter('');setVerse('');}}><Field label="BOOK"><TextInput value={book} onChange={event=>setBook(event.target.value)} placeholder="e.g. John" required/></Field><div className="field-row"><Field label="CHAPTER"><TextInput type="number" min="1" value={chapter} onChange={event=>setChapter(event.target.value)} required/></Field><Field label="VERSE / RANGE"><TextInput value={verse} onChange={event=>setVerse(event.target.value)} placeholder="e.g. 1–18"/></Field></div><Button type="submit" disabled={!book.trim()||!chapter||createRecord.isPending}>Save reading</Button></form></details>
          {recordList(['bible_reading']).map(item=>recordRow(item))}
        </Card>
        <Card className="faith-section-secondary"><div className="module-panel-head"><div><span className="module-kicker">SCRIPTURE MEMORY</span><h2>Keep a verse close.</h2></div></div><details className="atlas-add-disclosure"><summary>+ Add record</summary><form className="form-stack" onSubmit={event=>{event.preventDefault();if(memory.trim())add('scripture_memory','Scripture memory',memory);setMemory('');}}><Field label="VERSE / PASSAGE"><TextArea value={memory} onChange={event=>setMemory(event.target.value)} rows={3} placeholder="Reference and verse text or memory note"/></Field><Button type="submit" disabled={!memory.trim()||createRecord.isPending}>Save memory</Button></form></details>{recordList(['scripture_memory']).map(item=>recordRow(item))}</Card>
        <Card className="faith-section-tertiary"><div className="module-panel-head"><div><span className="module-kicker">SUNDAY SERMON NOTES</span><h2>Listen, notice, apply.</h2></div></div><details className="atlas-add-disclosure"><summary>+ Add record</summary><form className="form-stack" onSubmit={event=>{event.preventDefault();if(sermon.trim())add('sermon_note','Sunday sermon',sermon);setSermon('');}}><Field label="NOTES"><TextArea value={sermon} onChange={event=>setSermon(event.target.value)} rows={3} placeholder="Key passage, insight and one application"/></Field><Button type="submit" disabled={!sermon.trim()||createRecord.isPending}>Save sermon notes</Button></form></details>{recordList(['sermon_note']).map(item=>recordRow(item))}</Card>
      </div>
      <Card className="faith-section-tertiary"><div className="module-panel-head"><div><span className="module-kicker">P-R-A-Y REFLECTION</span><h2>Pause · Rejoice · Ask · Yield</h2></div></div><details className="atlas-add-disclosure"><summary>+ Add record</summary><form className="form-stack" onSubmit={event=>{event.preventDefault();if(pray.trim())add('pray_reflection','P-R-A-Y reflection',pray);setPray('');}}><Field label="TODAY’S REFLECTION"><TextArea value={pray} onChange={event=>setPray(event.target.value)} rows={4} placeholder="What are you rejoicing in, asking for, and yielding today?"/></Field><Button type="submit" disabled={!pray.trim()||createRecord.isPending}>Save reflection</Button></form></details>{recordList(['pray_reflection']).map(item=>recordRow(item))}<div className="rhythm-focus-link"><span>Set aside a quiet devotional block.</span><Link className="button button--secondary" to="/focus?focus=Devotional%20Focus"><Timer size={14}/> Start Devotional Focus</Link></div></Card>
    </div>}
    {tradition === 'general' && <div className="rhythm-branch" data-faith-workspace={faithWorkspace}>
      <section className="rhythm-intro surface-card"><div><span className="eyebrow">CLARITY · DAILY PRACTICE</span><h2>Choose what deserves your attention.</h2><p>Keep a simple record of intention, useful ideas and an honest evening review.</p></div><div className="rhythm-intro-stat"><b>{recordList(['daily_intention','wisdom_note','evening_reflection']).length}</b><small>RECORDS TODAY</small></div></section>
      <nav className="growth-workspace-switcher atlas-segmented-switcher" aria-label="Choose faith workspace">{["Daily Intention","Notes & Reflection","Show All"].map((label,index)=><button key={label} type="button" className={faithWorkspace===(['primary','secondary','all'][index])?'is-active':''} aria-pressed={faithWorkspace===(['primary','secondary','all'][index])} onClick={()=>setFaithWorkspace(['primary','secondary','all'][index] as 'primary'|'secondary'|'tertiary'|'all')}>{label}</button>)}</nav>
      <div className="rhythm-grid">
        <Card className="faith-section-primary"><div className="module-panel-head"><div><span className="module-kicker">DAILY INTENTION</span><h2>What matters today?</h2></div></div><details className="atlas-add-disclosure"><summary>+ Add record</summary><form className="form-stack" onSubmit={event=>{event.preventDefault();if(intention.trim())add('daily_intention','Daily intention',intention,'planned');setIntention('');}}><Field label="ONE CLEAR INTENTION"><TextArea value={intention} onChange={event=>setIntention(event.target.value)} rows={3} placeholder="What deserves your best attention today?"/></Field><Button type="submit" disabled={!intention.trim()||createRecord.isPending}>Save intention</Button></form></details>{recordList(['daily_intention']).map(item=>recordRow(item))}</Card>
        <Card className="faith-section-secondary"><div className="module-panel-head"><div><span className="module-kicker">WISDOM & READING NOTES</span><h2>Keep what you learn.</h2></div><BookOpen size={18}/></div><details className="atlas-add-disclosure"><summary>+ Add record</summary><form className="form-stack" onSubmit={event=>{event.preventDefault();if(wisdom.trim())add('wisdom_note',quickTitle.trim()||'Reading note',wisdom);setWisdom('');setQuickTitle('');}}><Field label="SOURCE / TITLE"><TextInput value={quickTitle} onChange={event=>setQuickTitle(event.target.value)} placeholder="Book, article or idea"/></Field><Field label="NOTE"><TextArea value={wisdom} onChange={event=>setWisdom(event.target.value)} rows={3} placeholder="What is worth remembering?"/></Field><Button type="submit" disabled={!wisdom.trim()||createRecord.isPending}>Save note</Button></form></details>{recordList(['wisdom_note']).map(item=>recordRow(item))}</Card>
      </div>
      <Card className="faith-section-secondary"><div className="module-panel-head"><div><span className="module-kicker">EVENING REFLECTION</span><h2>Close the day with clarity.</h2></div><MoonStar size={18}/></div><details className="atlas-add-disclosure"><summary>+ Add record</summary><form className="form-stack" onSubmit={event=>{event.preventDefault();if(evening.trim())add('evening_reflection','Evening reflection',evening);setEvening('');}}><Field label="WHAT MOVED FORWARD, WHAT DID YOU LEARN, AND WHAT COMES NEXT?"><TextArea value={evening} onChange={event=>setEvening(event.target.value)} rows={4} placeholder="Notice the day without judgement. Name one meaningful next step."/></Field><Button type="submit" disabled={!evening.trim()||createRecord.isPending}>Save reflection</Button></form></details>{recordList(['evening_reflection']).map(item=>recordRow(item))}</Card>
    </div>}
    {createRecord.isError && <p className="inline-error">{createRecord.error.message}</p>}
    {prayer.isError && <p className="inline-error">{prayer.error.message}</p>}
    <style>{deenPageStyles}</style>
  </Cascade>;
}

const deenPageStyles = `
.daily-rhythm-sanctuary{gap:24px!important}
.daily-rhythm-sanctuary>.page-header{align-items:center;gap:20px;margin-bottom:0}
.daily-rhythm-sanctuary .deen-tradition-switcher{flex-wrap:nowrap;white-space:nowrap}
.daily-rhythm-sanctuary .rhythm-branch{display:flex;flex-direction:column;gap:24px}
.daily-rhythm-sanctuary .rhythm-grid{gap:24px!important}
.daily-rhythm-sanctuary .atlas-card,.daily-rhythm-sanctuary .rhythm-intro,.daily-rhythm-sanctuary>.surface-card{padding:18px 20px!important}
.daily-rhythm-sanctuary .faith-section-secondary,.daily-rhythm-sanctuary .faith-section-primary,.daily-rhythm-sanctuary .faith-section-tertiary{margin:0!important}
.daily-rhythm-sanctuary .rhythm-stats{margin-top:18px}
@media(max-width:700px){.daily-rhythm-sanctuary>.page-header{align-items:stretch}.daily-rhythm-sanctuary .deen-tradition-switcher{width:100%;justify-content:space-between}.daily-rhythm-sanctuary .deen-tradition-switcher button{flex:1;padding:8px 9px}.daily-rhythm-sanctuary .atlas-card,.daily-rhythm-sanctuary .rhythm-intro{padding:18px 20px!important}}
`;
