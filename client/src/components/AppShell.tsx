import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, json } from '../lib/api';
import { ArrowRight, BookOpen, Check, Compass, GraduationCap, Heart, House, LogOut, Menu, MoonStar, Pause, Play, Plus, Search, Settings, SlidersHorizontal, Target, Timer, X, Zap } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { AtlasWalkthrough } from './AtlasWalkthrough';
import { MobileInstallPrompt } from './MobileInstallPrompt';
import { EntrancePresetContext, entranceFrame, useCompactMotionViewport, useEntrancePreset } from './EntranceMotion';
import { playAtlasFeedback } from '../lib/microFeedback';
import { useFocusTimer, updateFocusTimer } from '../lib/focusTimerStore';

const MotionNavLink = motion.create(NavLink);

const rooms = [
  { id: 'residence', label: 'Residence', to: '/today', icon: House, paths: ['/today', '/insights'] },
  { id: 'rhythm', label: 'Daily Rhythm', to: '/values', icon: MoonStar, paths: ['/values', '/self-control', '/rituals'] },
  { id: 'execution', label: 'Execution & Focus', to: '/execution', icon: Compass, paths: ['/execution', '/projects', '/tasks', '/calendar', '/focus'] },
  { id: 'growth', label: 'Growth & Direction', to: '/learning', icon: GraduationCap, paths: ['/learning', '/library', '/goals', '/reviews'] }
];

const commandDestinations = [
  { label: 'Insights', detail: 'Review patterns from your activity', to: '/insights', icon: Zap },
  { label: 'Daily Rhythm', detail: 'Open your tradition-specific daily practice', to: '/values', icon: MoonStar },
  { label: 'Self-Control & Streaks', detail: 'Review routines, check-ins and recovery', to: '/self-control', icon: Heart },
  { label: 'Habits & Streaks', detail: 'Review your daily habits', to: '/rituals', icon: Heart },
  { label: 'Projects', detail: 'Move a project forward', to: '/projects', icon: Compass },
  { label: 'Tasks', detail: 'Review and complete tasks', to: '/tasks', icon: Zap },
  { label: 'Calendar', detail: 'Review your schedule', to: '/calendar', icon: Compass },
  { label: 'Focus Timer', detail: 'Start or resume a deep-work session', to: '/focus', icon: Timer },
  { label: 'Learning Studio', detail: 'Continue a learning path', to: '/learning', icon: GraduationCap },
  { label: 'Private Library', detail: 'Open saved notes and resources', to: '/library', icon: BookOpen },
  { label: 'Goals', detail: 'Review long-term direction', to: '/goals', icon: Target },
  { label: 'Reviews', detail: 'Open daily and weekly reviews', to: '/reviews', icon: Heart }
];

type QuickPrayer = { prayer: string; completed: number; on_time: number };
type QuickDeen = { prayers: QuickPrayer[] };
type QuickHabit = { id: number; title: string; emoji: string; done: number };
function atlasDate() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
export function AppShell() {
  const navigate = useNavigate();
  const { user, role, signOut, session, completeOnboarding } = useAuth();
  const queryClient = useQueryClient();
  const reduceMotion = useReducedMotion();
  const hasMountedRoom = useRef(false);
  useEffect(() => { hasMountedRoom.current = true; }, []);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const focusTimer = useFocusTimer();
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
    const tick = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, []);
  useEffect(() => {
    const paths = ['/today','/values','/projects','/learning'];
    const onKey = (event: KeyboardEvent) => {
      const el = event.target as HTMLElement | null;
      const typing = !!el && (el.isContentEditable || ['INPUT','TEXTAREA','SELECT'].includes(el.tagName));
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setCommandOpen(v => !v); setCommandQuery(''); return; }
      if (event.key === 'Escape') { setCommandOpen(false); return; }
      if (!typing && (event.metaKey || event.ctrlKey) && !event.altKey && /^[1-4]$/.test(event.key)) { event.preventDefault(); navigate(paths[Number(event.key)-1]); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);
  const focusRemaining = focusTimer.deadline ? Math.max(0, Math.ceil((focusTimer.deadline - clockNow) / 1000)) : focusTimer.remaining;
  const focusActive = !!focusTimer.deadline && focusRemaining > 0;
  const focusClock = String(Math.floor(focusRemaining / 60)).padStart(2,'0') + ':' + String(focusRemaining % 60).padStart(2,'0');
  const focusContext = focusTimer.taskTitle || focusTimer.lessonTitle || focusTimer.focusLabel || focusTimer.focus || 'Focus session';
  const focusSessionVisible = focusRemaining > 0 && (focusActive || focusTimer.remaining < 25 * 60 || !!focusTimer.startedAt || !!focusTimer.sessionKey || !!focusTimer.taskId || !!focusTimer.lessonId || !!focusTimer.projectId || (focusTimer.durationSeconds !== undefined && focusTimer.durationSeconds !== 25 * 60));
  function writeTimer(value: Parameters<typeof updateFocusTimer>[0]) { updateFocusTimer(value); }
  function toggleTimer() { if (focusActive) writeTimer({ ...focusTimer, remaining: focusRemaining, deadline: null }); else if (focusRemaining > 0) writeTimer({ ...focusTimer, deadline: Date.now() + focusRemaining * 1000 }); }
  function finishTimer() { const elapsed = Math.max(0, (focusTimer.durationSeconds || focusTimer.remaining) - focusRemaining); writeTimer({ ...focusTimer, remaining: 0, deadline: null, durationSeconds: elapsed, sessionKey: elapsed >= 60 ? focusTimer.sessionKey : null }); navigate('/focus'); }
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
    ...rooms.map((item,index) => ({label:item.label,detail:'Open room',to:item.to,shortcut:'⌘ '+(index+1),icon:item.icon})),
    ...commandDestinations.map(item => ({...item,shortcut:''}))
  ].filter(item => (item.label+' '+item.detail).toLowerCase().includes(commandQuery.toLowerCase())),[commandQuery]);
  const location = useLocation();
  const entrancePreset = useEntrancePreset(location.pathname);
  const compactMotionViewport = useCompactMotionViewport();
  const settings = useQuery({ queryKey: ['settings'], queryFn: () => api<Record<string, string>>('/settings') });
  const quickDate = atlasDate();
  const quickReligion = settings.data?.faith_tradition || settings.data?.religion || 'none';
  const quickDeen = useQuery({ queryKey: ['deen', quickDate], queryFn: () => api<QuickDeen>('/deen/summary?date=' + quickDate), enabled: commandOpen && quickReligion === 'islam' });
  const quickHabits = useQuery({ queryKey: ['habits', quickDate], queryFn: () => api<QuickHabit[]>('/habits?date=' + quickDate), enabled: commandOpen });
  const quickPrayerMutation = useMutation({
    onMutate: item => { if (!item.completed) playAtlasFeedback('tick'); },
    mutationFn: (item: QuickPrayer) => api('/deen/prayer', json('PATCH', { date: quickDate, prayer: item.prayer, completed: !item.completed })),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['deen', quickDate] }); void queryClient.invalidateQueries({ queryKey: ['overview'] }); }
  });
  const quickHabitMutation = useMutation({
    mutationFn: (id: number) => api('/habits/' + id + '/toggle', json('POST', { date: quickDate })),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['habits', quickDate] }); void queryClient.invalidateQueries({ queryKey: ['overview'] }); }
  });
  useEffect(() => {
    const theme = settings.data?.theme;
    if (!theme) return;
    localStorage.setItem('atlas_theme', theme);
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    root.style.colorScheme = theme.startsWith('light-') ? 'light' : 'dark';
    const backgrounds: Record<string, string> = {
      'shadowed-alchemist': '#07080A', 'nocturnal-amethyst': '#050408',
      'abyssal-trench': '#03060C', 'whispering-woods': '#030806',
      'crimson-velvet': '#080304', 'light-porcelain': '#F5F6F3',
      'light-sandstone': '#F6F0E7', 'light-sage': '#EFF4EF',
      'light-lavender': '#F4F1F8', 'light-sky': '#EFF5F9'
    };
    const background = backgrounds[theme];
    if (background) {
      root.style.backgroundColor = background;
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', background);
    }
  }, [settings.data?.theme]);
  const storedFeatures = settings.data?.features;
  let enabledFeatures: string[] | null = null;
  if (storedFeatures) { try { enabledFeatures = JSON.parse(storedFeatures).map((feature: string) => feature === 'values' ? 'deen' : feature); } catch { enabledFeatures = null; } }
  // The six core pillars are always available; preferences only control secondary views.
  const current = rooms.find(item => item.paths.includes(location.pathname));
  useEffect(() => {
    if (focusActive && focusTimer.kind !== 'break') {
      const activeLabel = focusContext !== 'Focus session' ? focusContext : current?.label || 'Focus Room';
      document.title = focusClock + ' · ' + activeLabel + ' — Amstreem Atlas';
    } else document.title = 'Amstreem Atlas';
    return () => { document.title = 'Amstreem Atlas'; };
  }, [focusActive, focusTimer.kind, focusClock, focusContext, current?.label]);
  const faithTabLabel = quickReligion === 'islam' ? 'Deen & Reflection' : quickReligion === 'christianity' ? 'Faith & Devotion' : 'Clarity & Reflection';
  const tabsByRoom = {
    residence: [{ label: 'Overview', to: '/today' }, { label: 'Insights', to: '/insights' }],
    rhythm: [{ label: faithTabLabel, to: '/values' }, { label: 'Self-Control & Streaks', to: '/self-control' }, { label: 'Routine Builder', to: '/rituals' }],
    execution: [{ label: 'Workspace', to: '/execution' }, { label: 'Projects', to: '/projects' }, { label: 'Tasks', to: '/tasks' }, { label: 'Focus Timer', to: '/focus' }, { label: 'Calendar', to: '/calendar', feature: 'calendar' }],
    growth: [{ label: 'Learning Studio', to: '/learning' }, { label: 'Private Library', to: '/library', feature: 'library' }, { label: 'Goals', to: '/goals' }, { label: 'Reviews', to: '/reviews' }]
  };
  const activeTabs = current ? tabsByRoom[current.id as keyof typeof tabsByRoom].filter(tab => role === 'admin' || !('feature' in tab) || enabledFeatures === null || enabledFeatures.includes(tab.feature as string)) : [];
  useEffect(() => {
    const updateSpotlight = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>('.atlas-spotlight, .room4-library .room4-card') : null;
      if (!target) return;
      const rect = target.getBoundingClientRect();
      target.style.setProperty('--spotlight-x', ((event.clientX - rect.left) / rect.width * 100) + '%');
      target.style.setProperty('--spotlight-y', ((event.clientY - rect.top) / rect.height * 100) + '%');
    };
    const clearSpotlight = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>('.atlas-spotlight') : null;
      const next = event.relatedTarget instanceof Element ? event.relatedTarget.closest('.atlas-spotlight, .room4-library .room4-card') : null;
      if (target && target !== next) {
        target.style.removeProperty('--spotlight-x');
        target.style.removeProperty('--spotlight-y');
      }
    };
    document.addEventListener('pointermove', updateSpotlight);
    document.addEventListener('pointerout', clearSpotlight);
    return () => {
      document.removeEventListener('pointermove', updateSpotlight);
      document.removeEventListener('pointerout', clearSpotlight);
    };
  }, []);

  return <div className="app-frame">
    <MobileInstallPrompt />
    <AnimatePresence initial={false}>{tourOpen && <AtlasWalkthrough onClose={closeTour} />}</AnimatePresence>
    {mobileOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
    <aside className={'sidebar ' + (mobileOpen ? 'sidebar--open' : '')}>
      <NavLink to="/today" className="sidebar-brand" onClick={() => setMobileOpen(false)}><img className="brand-symbol" src="/assets/brand/amstreem-symbol.svg" alt="" /><span><b>AMSTREEM</b><small>ATLAS</small></span></NavLink>
      <div className="sidebar-caption">YOUR PRIVATE WORKSPACE</div>
      <nav className="primary-nav" aria-label="Atlas rooms">
        <div className="nav-group">
          <div className="nav-group__label">YOUR FOUR ROOMS</div>
          {rooms.map((item,index) => {
            const Icon = item.icon;
            const active = item.paths.includes(location.pathname);
            return <MotionNavLink key={item.id} to={item.to} end onClick={() => setMobileOpen(false)} whileTap={{ scale: 0.985 }} transition={{ type: 'spring', stiffness: 500, damping: 32 }} className={'nav-link room-nav-link ' + (active ? 'nav-link--active' : '')}>{active && <motion.span className="room-nav-indicator" layoutId="atlas-room-indicator" transition={{ type: 'spring', stiffness: 420, damping: 35, bounce: 0 }} />}<Icon size={17} strokeWidth={1.8} /><span>{item.label}</span><kbd>⌘ {index+1}</kbd></MotionNavLink>;
          })}
        </div>
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

      <div className="page-container">
        {activeTabs.length > 0 && <nav className="module-subnav" aria-label="Module sections">{activeTabs.map(tab => <MotionNavLink key={tab.to} to={tab.to} onClick={() => setMobileOpen(false)} whileTap={{ scale: 0.985 }} transition={{ type: 'spring', stiffness: 500, damping: 32 }} className={({ isActive }) => 'module-subnav__link ' + (isActive ? 'module-subnav__link--active' : '')}>{({isActive}) => <>{isActive && <motion.span className="module-subnav-indicator" layoutId={'atlas-subnav-' + current?.id} transition={{ type: 'spring', stiffness: 420, damping: 35, bounce: 0 }} />}{tab.label}</>}</MotionNavLink>)}</nav>}
        <EntrancePresetContext.Provider value={entrancePreset}>
          <motion.div
            key={location.pathname}
            className="room-view-transition"
            initial={reduceMotion || !hasMountedRoom.current ? false : entranceFrame(entrancePreset, 0, compactMotionViewport).initial}
            animate={entranceFrame(entrancePreset, 0, compactMotionViewport).animate}
            transition={reduceMotion ? { duration: 0 } : entranceFrame(entrancePreset, 0, compactMotionViewport).transition}
            style={{ willChange: reduceMotion ? 'auto' : 'transform, opacity' }}
          >
            <Outlet />
          </motion.div>
        </EntrancePresetContext.Provider>
      </div>
      <AnimatePresence initial={false}>{commandOpen && <motion.div className="command-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} onMouseDown={event => {if(event.target===event.currentTarget)setCommandOpen(false);}}><motion.section className="command-panel" role="dialog" aria-modal="true" aria-label="Atlas quick capture" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}>
        <div className="command-search"><Search size={17}/><input autoFocus value={commandQuery} onChange={event=>setCommandQuery(event.target.value)} placeholder="Search pillars, capture a task, or check in…"/><kbd>ESC</kbd></div>
        {(!commandQuery || 'add a task'.includes(commandQuery.toLowerCase())) && <form className="command-task-form" onSubmit={captureTask}><Zap size={15}/><input value={quickTaskTitle} onChange={event=>setQuickTaskTitle(event.target.value)} placeholder="Capture a task…" maxLength={180}/><button disabled={!quickTaskTitle.trim()||quickTaskSaving}>{quickTaskSaving?'Saving…':'Add task'}</button></form>}
        {quickTaskError && <p className="command-error">{quickTaskError}</p>}
        {quickReligion === 'islam' && <div className="command-checkins"><span className="eyebrow">TODAY · SALAH</span><div className="command-checkin-list">{(quickDeen.data?.prayers || []).map(item => <button type="button" key={item.prayer} className={item.completed ? 'is-complete' : ''} disabled={quickPrayerMutation.isPending} onClick={() => quickPrayerMutation.mutate(item)}><span>{item.completed ? '✓' : '○'}</span>{item.prayer}<small>{item.completed ? 'Recorded' : 'Mark done'}</small></button>)}</div></div>}
        {!!quickHabits.data?.length && <div className="command-checkins"><span className="eyebrow">TODAY · HABITS</span><div className="command-checkin-list">{quickHabits.data.map(item => <button type="button" key={item.id} className={item.done ? 'is-complete' : ''} disabled={quickHabitMutation.isPending} onClick={() => quickHabitMutation.mutate(item.id)}><span>{item.done ? '✓' : '○'}</span>{item.title}<small>{item.done ? 'Done' : 'Mark done'}</small></button>)}</div></div>}
        <div className="command-results"><span className="eyebrow">JUMP TO OR CHECK IN</span>{commandItems.map(item=>{const Icon=item.icon;return <button key={item.label} type="button" onClick={()=>{setCommandOpen(false);navigate(item.to);}}><Icon size={16}/><span><b>{item.label}</b><small>{item.detail}</small></span><kbd>{item.shortcut}</kbd></button>;})}{!commandItems.length&&<p>No matching destination.</p>}</div>
        <div className="command-footer"><span>Navigate between rooms</span><span>⌘ 1 — 4</span></div>
      </motion.section></motion.div>}</AnimatePresence>
      <motion.nav className="atlas-command-dock" layout transition={{ type: 'spring', stiffness: 420, damping: 34, bounce: 0 }} aria-label="Atlas command dock">
        <motion.button type="button" whileTap={{ scale: 0.985 }} transition={{ type: 'spring', stiffness: 500, damping: 32 }} className="atlas-dock-action" onClick={() => { setCommandOpen(true); setCommandQuery(''); }}><Search size={15}/><span>Command</span><kbd>⌘ K</kbd></motion.button>
        <motion.button type="button" whileTap={{ scale: 0.985 }} transition={{ type: 'spring', stiffness: 500, damping: 32 }} className="atlas-dock-action" onClick={() => { setCommandOpen(true); setCommandQuery('add a task'); }}><Plus size={15}/><span>Quick Capture</span></motion.button>
        <motion.div className={'atlas-dock-focus ' + (focusSessionVisible ? 'is-expanded' : '')} layout transition={{ type: 'spring', stiffness: 420, damping: 34, bounce: 0 }}>
          <motion.button type="button" whileTap={{ scale: 0.985 }} transition={{ type: 'spring', stiffness: 500, damping: 32 }} className="atlas-dock-action atlas-dock-focus__open" onClick={() => navigate('/focus')}><Timer size={15}/><span>Focus Timer</span>{focusSessionVisible && <strong>{focusClock}</strong>}</motion.button>
          {focusSessionVisible && <motion.div className="atlas-dock-focus__detail" initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 'auto' }} exit={{ opacity: 0, width: 0 }} transition={{ duration: 0.18 }}><span title={focusContext}>{focusContext}</span><motion.button type="button" whileTap={{ scale: 0.985 }} transition={{ type: 'spring', stiffness: 500, damping: 32 }} onClick={toggleTimer} aria-label={focusActive ? 'Pause focus timer' : 'Resume focus timer'}>{focusActive ? <Pause size={13}/> : <Play size={13}/>}<small>{focusActive ? 'Pause' : 'Resume'}</small></motion.button></motion.div>}
        </motion.div>
        <motion.button type="button" whileTap={{ scale: 0.985 }} transition={{ type: 'spring', stiffness: 500, damping: 32 }} className="atlas-dock-action" onClick={() => { navigate('/today'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}><Check size={15}/><span>Daily Check-In</span></motion.button>
      </motion.nav>
      <footer className="app-footer"><span>AMSTREEM ATLAS</span><span>Make room for what matters.</span></footer>
    </main>
  </div>;
}