import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, json } from '../lib/api';
import { ArrowRight, Compass, GraduationCap, Heart, House, LogOut, Menu, MoonStar, Pause, Play, Search, Settings, SlidersHorizontal, Target, Timer, X, Zap } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { AtlasWalkthrough } from './AtlasWalkthrough';

const navigation = [
  { label: 'Residence', to: '/today', icon: House, group: 'COMMAND & DAILY RHYTHM' },
  { label: 'Deen & Reflection', to: '/values', icon: MoonStar, group: 'COMMAND & DAILY RHYTHM' },
  { label: 'Self-Control & Streaks', to: '/self-control', icon: Heart, group: 'COMMAND & DAILY RHYTHM' },
  { label: 'Projects & Tasks', to: '/projects', icon: Compass, group: 'GROWTH & EXECUTION' },
  { label: 'Focus Room', to: '/focus', icon: Timer, group: 'GROWTH & EXECUTION' },
  { label: 'Learning Studio', to: '/learning', icon: GraduationCap, group: 'GROWTH & EXECUTION' },
  { label: 'Goals', to: '/goals', icon: Target, group: 'GROWTH & EXECUTION' }
];

const moduleTabs = [
  { match: (path: string) => path === '/today' || path === '/insights', tabs: [{ label: 'Residence', to: '/today' }, { label: 'Insights', to: '/insights' }] },
  { match: (path: string) => path === '/values' || path === '/reviews', tabs: [{ label: 'Deen', to: '/values' }, { label: 'Reflection', to: '/reviews' }] },
  { match: (path: string) => path === '/self-control' || path === '/rituals', tabs: [{ label: 'Self-Control', to: '/self-control' }, { label: 'Habits & Streaks', to: '/rituals' }] },
  { match: (path: string) => path === '/projects' || path === '/tasks' || path === '/calendar', tabs: [{ label: 'Projects', to: '/projects' }, { label: 'Tasks', to: '/tasks' }, { label: 'Calendar', to: '/calendar', feature: 'calendar' }] },
  { match: (path: string) => path === '/learning' || path === '/library', tabs: [{ label: 'Learning paths', to: '/learning' }, { label: 'Library', to: '/library', feature: 'library' }] }
];

type QuickPrayer = { prayer: string; completed: number; on_time: number };
type QuickDeen = { prayers: QuickPrayer[] };
type QuickHabit = { id: number; title: string; emoji: string; done: number };
function atlasDate() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
type SharedTimer = { remaining: number; deadline: number | null; taskId?: string; lessonId?: string; projectId?: string; taskTitle?: string; lessonTitle?: string; focusLabel?: string };
function readSharedTimer(): SharedTimer {
  try { const value = JSON.parse(localStorage.getItem('atlas-focus-timer-v1') || 'null'); if (value && Number.isFinite(value.remaining)) return value; } catch { /* Ignore invalid timer state. */ }
  return { remaining: 25 * 60, deadline: null };
}
export function AppShell() {
  const { user, role, signOut, session, completeOnboarding } = useAuth();
  const queryClient = useQueryClient();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [focusTimer, setFocusTimer] = useState<SharedTimer>(readSharedTimer);
  const [clockNow, setClockNow] = useState(Date.now());
  const [quickTaskTitle, setQuickTaskTitle] = useState('');
  const [quickTaskSaving, setQuickTaskSaving] = useState(false);
  const [quickTaskError, setQuickTaskError] = useState('');
  useEffect(() => {
    if (!session?.user || !user) return;
    const key = `atlas-tour-complete:${session.user.id}`;
    const completed = session.user.user_metadata?.onboarding_completed === true || localStorage.getItem(key) === 'true';
    if (!completed) setTourOpen(true);
  }, [session?.user.id, session?.user.user_metadata?.onboarding_completed, user?.id]);
  const closeTour = useCallback(() => {
    setTourOpen(false);
    void queryClient.invalidateQueries({ queryKey: ['settings'] });
    if (!session?.user.id) return;
    localStorage.setItem(`atlas-tour-complete:${session.user.id}`, 'true');
    void completeOnboarding().catch(error => console.error('Could not save Atlas onboarding completion:', error));
  }, [session?.user.id, completeOnboarding, queryClient]);
  useEffect(() => {
    const sync = () => setFocusTimer(readSharedTimer());
    const tick = window.setInterval(() => { setClockNow(Date.now()); sync(); }, 1000);
    window.addEventListener('storage', sync);
    return () => { window.clearInterval(tick); window.removeEventListener('storage', sync); };
  }, []);
  useEffect(() => {
    const paths = ['/today','/values','/self-control','/projects','/focus','/learning','/goals'];
    const onKey = (event: KeyboardEvent) => {
      const el = event.target as HTMLElement | null;
      const typing = !!el && (el.isContentEditable || ['INPUT','TEXTAREA','SELECT'].includes(el.tagName));
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setCommandOpen(v => !v); setCommandQuery(''); return; }
      if (event.key === 'Escape') { setCommandOpen(false); return; }
      if (!typing && (event.metaKey || event.ctrlKey) && !event.altKey && /^[1-7]$/.test(event.key)) { event.preventDefault(); window.location.assign(paths[Number(event.key)-1]); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const focusRemaining = focusTimer.deadline ? Math.max(0, Math.ceil((focusTimer.deadline - clockNow) / 1000)) : focusTimer.remaining;
  const focusActive = !!focusTimer.deadline && focusRemaining > 0;
  const focusClock = String(Math.floor(focusRemaining / 60)).padStart(2,'0') + ':' + String(focusRemaining % 60).padStart(2,'0');
  const focusContext = focusTimer.taskTitle || focusTimer.lessonTitle || focusTimer.focusLabel || 'Focus session';
  function writeTimer(value: SharedTimer) { localStorage.setItem('atlas-focus-timer-v1', JSON.stringify(value)); setFocusTimer(value); window.dispatchEvent(new CustomEvent('atlas-focus-timer-change', { detail: value })); }
  function toggleTimer() { if (focusActive) writeTimer({ ...focusTimer, remaining: focusRemaining, deadline: null }); else if (focusRemaining > 0) writeTimer({ ...focusTimer, deadline: Date.now() + focusRemaining * 1000 }); }
  function finishTimer() { writeTimer({ ...focusTimer, remaining: 0, deadline: null }); window.location.assign('/focus'); }
  async function captureTask(event: FormEvent) {
    event.preventDefault(); if (!quickTaskTitle.trim() || quickTaskSaving) return;
    setQuickTaskSaving(true); setQuickTaskError('');
    try {
      await api('/tasks', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({title:quickTaskTitle.trim(),category:'Personal'}) });
      setQuickTaskTitle(''); setCommandOpen(false);
      void queryClient.invalidateQueries({queryKey:['tasks']}); void queryClient.invalidateQueries({queryKey:['overview']});
    } catch (error) { setQuickTaskError(error instanceof Error ? error.message : 'Could not save task.'); }
    finally { setQuickTaskSaving(false); }
  }
  const commandItems = useMemo(() => [
    ...navigation.map((item,index) => ({label:item.label,detail:'Open pillar',to:item.to,shortcut:'⌘ '+(index+1),icon:item.icon})),
    {label:'Deen check-in',detail:'Open prayers and reflection',to:'/values',shortcut:'',icon:MoonStar},
    {label:'Habit check-in',detail:'Open habits and streaks',to:'/rituals',shortcut:'',icon:Heart},
    {label:'Calendar',detail:'Review your schedule',to:'/calendar',shortcut:'',icon:Compass}
  ].filter(item => (item.label+' '+item.detail).toLowerCase().includes(commandQuery.toLowerCase())),[commandQuery]);
  const location = useLocation();
  const settings = useQuery({ queryKey: ['settings'], queryFn: () => api<Record<string, string>>('/settings') });
  const quickDate = atlasDate();
  const quickReligion = settings.data?.religion || 'none';
  const quickDeen = useQuery({ queryKey: ['deen', quickDate], queryFn: () => api<QuickDeen>('/deen/summary?date=' + quickDate), enabled: commandOpen && quickReligion === 'islam' });
  const quickHabits = useQuery({ queryKey: ['habits', quickDate], queryFn: () => api<QuickHabit[]>('/habits?date=' + quickDate), enabled: commandOpen });
  const quickPrayerMutation = useMutation({
    mutationFn: (item: QuickPrayer) => api('/deen/prayer', json('PATCH', { date: quickDate, prayer: item.prayer, completed: !item.completed })),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['deen', quickDate] }); void queryClient.invalidateQueries({ queryKey: ['overview'] }); }
  });
  const quickHabitMutation = useMutation({
    mutationFn: (id: number) => api('/habits/' + id + '/toggle', json('POST', { date: quickDate })),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['habits', quickDate] }); void queryClient.invalidateQueries({ queryKey: ['overview'] }); }
  });
  useEffect(() => { document.documentElement.dataset.theme = settings.data?.theme || 'shadowed-alchemist'; }, [settings.data?.theme]);
  const storedFeatures = settings.data?.features;
  let enabledFeatures: string[] | null = null;
  if (storedFeatures) { try { enabledFeatures = JSON.parse(storedFeatures).map((feature: string) => feature === 'values' ? 'deen' : feature); } catch { enabledFeatures = null; } }
  // The six core pillars are always available; preferences only control secondary views.
  const visibleNavigation = navigation;
  const current = visibleNavigation.find(item => item.to === location.pathname) || visibleNavigation.find(item => item.to === (['/tasks', '/calendar'].includes(location.pathname) ? '/projects' : location.pathname === '/library' ? '/learning' : location.pathname === '/reviews' ? '/values' : location.pathname === '/rituals' ? '/self-control' : location.pathname === '/insights' ? '/today' : ''));
  const groups = [...new Set(visibleNavigation.map(item => item.group))];
  const activeTabs = (moduleTabs.find(item => item.match(location.pathname))?.tabs || []).filter(tab => !('feature' in tab) || enabledFeatures === null || enabledFeatures.includes(tab.feature as string));

  return <div className="app-frame">
    {tourOpen && <AtlasWalkthrough onClose={closeTour} />}
    {mobileOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
    <aside className={'sidebar ' + (mobileOpen ? 'sidebar--open' : '')}>
      <NavLink to="/today" className="sidebar-brand" onClick={() => setMobileOpen(false)}><img className="brand-symbol" src="/assets/brand/amstreem-symbol.svg" alt="" /><span><b>AMSTREEM</b><small>ATLAS</small></span></NavLink>
      <div className="sidebar-caption">YOUR PRIVATE WORKSPACE</div>
      <nav className="primary-nav">
        {groups.map(group => <div className="nav-group" key={group}>
          <div className="nav-group__label">{group}</div>
          {visibleNavigation.filter(item => item.group === group).map(item => {
            const Icon = item.icon;
            const active = item.to === '/projects' ? ['/projects', '/tasks', '/calendar'].includes(location.pathname)
              : item.to === '/learning' ? ['/learning', '/library'].includes(location.pathname)
              : item.to === '/values' ? ['/values', '/reviews'].includes(location.pathname)
              : item.to === '/self-control' ? ['/self-control', '/rituals'].includes(location.pathname)
              : item.to === '/today' ? ['/today', '/insights'].includes(location.pathname)
              : location.pathname === item.to;
            return <NavLink key={item.to} to={item.to} onClick={() => setMobileOpen(false)} className={'nav-link ' + (active ? 'nav-link--active' : '')}><Icon size={17} strokeWidth={1.8} /><span>{item.label}</span></NavLink>;
          })}
        </div>)}
      </nav>
      <div className="sidebar-bottom">
        <NavLink to="/settings" className={({ isActive }) => 'nav-link nav-link--settings ' + (isActive ? 'nav-link--active' : '')} onClick={() => setMobileOpen(false)}><SlidersHorizontal size={17} /><span>Settings</span></NavLink>
        {role === 'admin' && <NavLink to="/admin" className={({ isActive }) => 'nav-link nav-link--settings ' + (isActive ? 'nav-link--active' : '')} onClick={() => setMobileOpen(false)}><Settings size={17} /><span>Administration</span></NavLink>}
        <div className="profile-menu">
          <button className="profile-trigger" onClick={() => setProfileOpen(v => !v)}><span className="avatar">{(user?.name || user?.username || 'A').slice(0,1).toUpperCase()}</span><span className="profile-copy"><b>{user?.name || 'Your workspace'}</b><small>{user?.username ? '@' + user.username : user?.email}</small></span><span>⌄</span></button>
          {profileOpen && <div className="profile-popover"><button onClick={() => void signOut()}><LogOut size={15} /> Sign out</button></div>}
        </div>
      </div>
    </aside>
    <main className="main-area">
      <header className="topbar">
        <button className="mobile-menu-button" onClick={() => setMobileOpen(v => !v)} aria-label={mobileOpen ? 'Close menu' : 'Open menu'}>{mobileOpen ? <X /> : <Menu />}</button>
        <div className="topbar-context"><span>AMSTREEM ATLAS</span><b>{current?.label || (location.pathname === '/reviews' ? 'Deen & Reflection' : location.pathname === '/library' ? 'Learning Studio' : location.pathname === '/admin' ? 'Administration' : 'Settings')}</b></div>
        <div className="topbar-right"><button className="global-capture-trigger" type="button" onClick={() => {setCommandOpen(true);setCommandQuery('');}}><Search size={14}/><span>Quick capture</span><kbd>⌘ K</kbd></button><button className="tour-launcher" type="button" onClick={() => setTourOpen(true)}><Compass size={14} /> Guided tour</button><span className="privacy-indicator"><span /> PRIVATE BY DESIGN</span><span className="topbar-date">{new Intl.DateTimeFormat(undefined,{weekday:'short',month:'short',day:'numeric'}).format(new Date())}</span></div>
      </header>
      {focusRemaining > 0 && (focusActive || focusTimer.remaining < 25*60) && <div className="global-focus-bar"><span className="global-focus-pulse"/><div className="global-focus-copy"><b>{focusClock}</b><span>{focusContext}</span></div><span className="global-focus-label">{focusActive?'FOCUS IN PROGRESS':'FOCUS PAUSED'}</span><button type="button" onClick={toggleTimer} aria-label={focusActive?'Pause focus timer':'Resume focus timer'}>{focusActive?<Pause size={13}/>:<Play size={13}/>}<span>{focusActive?'Pause':'Resume'}</span></button><button type="button" onClick={finishTimer}>Finish & review</button><NavLink to="/focus">Open room <ArrowRight size={12}/></NavLink></div>}
      <div className="page-container">
        {activeTabs.length > 0 && <nav className="module-subnav" aria-label="Module sections">{activeTabs.map(tab => <NavLink key={tab.to} to={tab.to} onClick={() => setMobileOpen(false)} className={({ isActive }) => 'module-subnav__link ' + (isActive ? 'module-subnav__link--active' : '')}>{tab.label}</NavLink>)}</nav>}
        <Outlet />
      </div>
      {commandOpen && <div className="command-backdrop" onMouseDown={event => {if(event.target===event.currentTarget)setCommandOpen(false);}}><section className="command-panel" role="dialog" aria-modal="true" aria-label="Atlas quick capture">
        <div className="command-search"><Search size={17}/><input autoFocus value={commandQuery} onChange={event=>setCommandQuery(event.target.value)} placeholder="Search pillars, capture a task, or check in…"/><kbd>ESC</kbd></div>
        {(!commandQuery || 'add a task'.includes(commandQuery.toLowerCase())) && <form className="command-task-form" onSubmit={captureTask}><Zap size={15}/><input value={quickTaskTitle} onChange={event=>setQuickTaskTitle(event.target.value)} placeholder="Capture a task…" maxLength={180}/><button disabled={!quickTaskTitle.trim()||quickTaskSaving}>{quickTaskSaving?'Saving…':'Add task'}</button></form>}
        {quickTaskError && <p className="command-error">{quickTaskError}</p>}
        {quickReligion === 'islam' && <div className="command-checkins"><span className="eyebrow">TODAY · SALAH</span><div className="command-checkin-list">{(quickDeen.data?.prayers || []).map(item => <button type="button" key={item.prayer} className={item.completed ? 'is-complete' : ''} disabled={quickPrayerMutation.isPending} onClick={() => quickPrayerMutation.mutate(item)}><span>{item.completed ? '✓' : '○'}</span>{item.prayer}<small>{item.completed ? 'Recorded' : 'Mark done'}</small></button>)}</div></div>}
        {!!quickHabits.data?.length && <div className="command-checkins"><span className="eyebrow">TODAY · HABITS</span><div className="command-checkin-list">{quickHabits.data.map(item => <button type="button" key={item.id} className={item.done ? 'is-complete' : ''} disabled={quickHabitMutation.isPending} onClick={() => quickHabitMutation.mutate(item.id)}><span>{item.done ? '✓' : '○'}</span>{item.title}<small>{item.done ? 'Done' : 'Mark done'}</small></button>)}</div></div>}
        <div className="command-results"><span className="eyebrow">JUMP TO OR CHECK IN</span>{commandItems.map(item=>{const Icon=item.icon;return <button key={item.label} type="button" onClick={()=>{setCommandOpen(false);window.location.assign(item.to);}}><Icon size={16}/><span><b>{item.label}</b><small>{item.detail}</small></span><kbd>{item.shortcut}</kbd></button>;})}{!commandItems.length&&<p>No matching destination.</p>}</div>
        <div className="command-footer"><span>Sequential navigation shortcuts</span><span>⌘ 1 — 7</span></div>
      </section></div>}
      <footer className="app-footer"><span>AMSTREEM ATLAS</span><span>Make room for what matters.</span></footer>
    </main>
  </div>;
}