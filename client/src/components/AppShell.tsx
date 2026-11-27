import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, json } from '../lib/api';
import { ArrowRight, BookOpen, CalendarDays, Check, Compass, GraduationCap, Heart, History as HistoryIcon, House, ListChecks, LogOut, MoonStar, Pause, Play, Plus, Search, Settings, SlidersHorizontal, Target, Timer, TrendingUp, X, Zap } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { AtlasWalkthrough } from './AtlasWalkthrough';
import { MobileInstallPrompt } from './MobileInstallPrompt';
import { EntrancePresetContext, useEntrancePreset } from './EntranceMotion';
import { playAtlasFeedback } from '../lib/microFeedback';
import { useFocusTimer, updateFocusTimer } from '../lib/focusTimerStore';
import { OdometerNumber } from './fx/OdometerNumber';
import { PortalTransition, setPortalOrigin } from './fx/PortalTransition';
import { SparkBurst } from './fx/SparkBurst';
import { EnergyVortex } from './fx/AtlasEngines';
import { CursorAura } from './fx/CursorAura';
import { MagneticButton } from './fx/MagneticButton';
import { useSpotlightGrid } from './fx/useSpotlightGrid';

const MotionNavLink = motion.create(NavLink);

const rooms = [
  { id: 'home', label: 'Home', to: '/residence', icon: House, paths: ['/residence'] },
  { id: 'actions', label: 'Actions', to: '/actions', icon: ListChecks, paths: ['/actions'] },
  { id: 'goals', label: 'Goals', to: '/goals', icon: Target, paths: ['/goals'] },
  { id: 'focus', label: 'Focus', to: '/focus', icon: Timer, paths: ['/focus'] },
  { id: 'growth', label: 'Growth', to: '/growth', icon: TrendingUp, paths: ['/growth'] },
  { id: 'calendar', label: 'Calendar', to: '/calendar', icon: CalendarDays, paths: ['/calendar'] }
];

const commandDestinations = [
  { label: 'Faith & Spirituality', detail: 'Qur’an, daily practice and spiritual reflection', to: '/values', icon: MoonStar },
  { label: 'Habits & Self-Control', detail: 'Build routines and personal commitments', to: '/habits', icon: Heart },
  { label: 'Education & Learning', detail: 'Learning paths, lessons and private library', to: '/learning-library', icon: GraduationCap },
  { label: 'Projects & Milestones', detail: 'Connect meaningful work to your goals', to: '/goals', icon: Target },
  { label: 'Reviews & Insights', detail: 'Reflect on evidence and patterns over time', to: '/growth', icon: TrendingUp },
  { label: 'Workspace history', detail: 'Recovery points, backups and restore', to: '/history', icon: HistoryIcon }
];

type QuickPrayer = { prayer: string; completed: number; on_time: number };
type QuickDeen = { prayers: QuickPrayer[] };
type QuickHabit = { id: number; title: string; emoji: string; done: number };
function atlasDate() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
function sparkAtElement(node: HTMLElement) { const rect = node.getBoundingClientRect(); window.dispatchEvent(new CustomEvent('atlas:spark-burst', { detail: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } })); }
export function AppShell() {
  useEffect(() => {
    const celebrate = (event: Event) => {
      const target = event.target as HTMLInputElement | null;
      if (!target?.matches?.('input[type="checkbox"]') || !target.checked || !target.closest('.execution-task, .execution-subtasks, .execution-inspector-subtask, .rhythm-prayer-row,  .rhythm-check-row, .today-habit-row, .today-task-row, .residence-pinned-row, .room4-goal-milestone, .residence-prayer')) return;
      const rect = target.getBoundingClientRect();
      window.dispatchEvent(new CustomEvent('atlas:spark-burst', { detail: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } }));
    };
    document.addEventListener('change', celebrate, true);
    return () => document.removeEventListener('change', celebrate, true);
  }, []);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const bootContentRef = useRef<HTMLDivElement>(null);
  useSpotlightGrid(workspaceRef);

  const navigate = useNavigate();
  const { user, role, signOut, session, completeOnboarding } = useAuth();
  const queryClient = useQueryClient();
  const reduceMotion = useReducedMotion();
  const [booting, setBooting] = useState(true);
  useEffect(() => { const timeout = window.setTimeout(() => setBooting(false), 380); return () => window.clearTimeout(timeout); }, []);
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
    const paths = ['/residence','/actions','/goals','/focus','/growth','/calendar'];
    const onKey = (event: KeyboardEvent) => {
      const el = event.target as HTMLElement | null;
      const typing = !!el && (el.isContentEditable || ['INPUT','TEXTAREA','SELECT'].includes(el.tagName));
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setCommandOpen(v => !v); setCommandQuery(''); return; }
      if (event.key === 'Escape') { setCommandOpen(false); return; }
      if (!typing && (event.metaKey || event.ctrlKey) && !event.altKey && /^[1-6]$/.test(event.key)) { event.preventDefault(); setPortalOrigin(window.innerWidth/2,window.innerHeight/2); navigate(paths[Number(event.key)-1]); }
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
  const lifeAreaNames: Record<string, string> = { health: 'Health & Fitness', education: 'Education & Learning', career: 'Career & Business', finance: 'Financial Growth', faith: 'Faith & Spirituality', personal: 'Personal Development', relationships: 'Relationships', lifestyle: 'Lifestyle & Organisation' };
  let selectedLifeAreas: string[] = [];
  try { selectedLifeAreas = settings.data?.life_areas ? JSON.parse(settings.data.life_areas).filter((id: string) => !!lifeAreaNames[id]) : Object.keys(lifeAreaNames); } catch { selectedLifeAreas = Object.keys(lifeAreaNames); }
  // The six core pillars are always available; preferences only control secondary views.
  const current = rooms.find(item => item.paths.includes(location.pathname));
  useEffect(() => {
    if (focusActive && focusTimer.kind !== 'break') {
      const activeLabel = focusContext !== 'Focus session' ? focusContext : current?.label || 'Focus Room';
      document.title = focusClock + ' · ' + activeLabel + ' — Amstreem Atlas';
    } else document.title = 'Amstreem Atlas';
    return () => { document.title = 'Amstreem Atlas'; };
  }, [focusActive, focusTimer.kind, focusClock, focusContext, current?.label]);
  const faithTabLabel = quickReligion === 'islam' ? 'Deen' : quickReligion === 'christianity' ? 'Faith & Reflection' : 'Daily Reflection';
  const activeTabs: { label: string; to: string; feature?: string }[] = [];
  return <div className={"app-frame" + (booting ? " atlas-booting" : "")} onPointerDownCapture={event=>setPortalOrigin(event.clientX,event.clientY)}>
    <CursorAura/><SparkBurst/><EnergyVortex/>
    <MobileInstallPrompt />
    <AnimatePresence initial={false}>{tourOpen && <AtlasWalkthrough onClose={closeTour} onOpenCommand={() => { setCommandOpen(true); setCommandQuery(''); }} />}</AnimatePresence>
    <motion.aside className={'sidebar ' + (mobileOpen ? 'sidebar--open' : '')} initial={reduceMotion ? false : { x: -12, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={reduceMotion ? { duration: 0 } : { duration: 0.18, ease: [0.22, 1, 0.36, 1] }}>
      <NavLink to="/residence" className="sidebar-brand" onClick={() => setMobileOpen(false)}><img className="brand-symbol" src="/assets/brand/amstreem-symbol.svg" alt="" /><span><b>AMSTREEM</b><small>ATLAS</small></span></NavLink>
      <div className="sidebar-caption">YOUR PRIVATE WORKSPACE</div>
      <nav className="primary-nav" aria-label="Primary navigation">
        <div className="nav-group">
          <div className="nav-group__label">YOUR LIFE</div>
          {rooms.map((item,index) => {
            const Icon = item.icon;
            const active = item.paths.includes(location.pathname);
            return <MotionNavLink key={item.id} to={item.to} end onClick={() => setMobileOpen(false)} whileTap={{ scale: 0.985 }} transition={{ type: 'spring', stiffness: 500, damping: 32 }} className={'nav-link room-nav-link ' + (active ? 'nav-link--active' : '')}>{active && <motion.span className="room-nav-indicator" layoutId="atlas-room-indicator" transition={{ type: 'spring', stiffness: 420, damping: 35, bounce: 0 }} />}<Icon size={17} strokeWidth={1.8} /><span>{item.label}</span><kbd>⌘ {index+1}</kbd></MotionNavLink>;
          })}
        </div>
        <div className="nav-group nav-group--specialist">
          <div className="nav-group__label">PERSONAL TOOLS</div>
          <MotionNavLink to="/quran" end onClick={() => setMobileOpen(false)} whileTap={{ scale: 0.985 }} transition={{ type: 'spring', stiffness: 500, damping: 32 }} className={'nav-link room-nav-link ' + (location.pathname === '/quran' ? 'nav-link--active' : '')}>
            {location.pathname === '/quran' && <motion.span className="room-nav-indicator" layoutId="atlas-room-indicator" transition={{ type: 'spring', stiffness: 420, damping: 35, bounce: 0 }} />}
            <BookOpen size={17} strokeWidth={1.8}/><span>Qur’an</span>
          </MotionNavLink>
          <button type="button" className="nav-link room-nav-link" onClick={() => setMobileOpen(true)}><SlidersHorizontal size={17}/><span>More personal tools</span></button>
        </div>
      </nav>
      <div className="sidebar-bottom">
        <NavLink to="/history" className={({ isActive }) => 'nav-link nav-link--settings ' + (isActive ? 'nav-link--active' : '')} onClick={() => setMobileOpen(false)}><HistoryIcon size={17} /><span>Workspace history</span></NavLink>
        <NavLink to="/settings" className={({ isActive }) => 'nav-link nav-link--settings ' + (isActive ? 'nav-link--active' : '')} onClick={() => setMobileOpen(false)}><SlidersHorizontal size={17} /><span>Settings</span></NavLink>
        {role === 'admin' && <NavLink to="/admin" className={({ isActive }) => 'nav-link nav-link--settings ' + (isActive ? 'nav-link--active' : '')} onClick={() => setMobileOpen(false)}><Settings size={17} /><span>Administration</span></NavLink>}
        <div className="profile-menu">
          <button className="profile-trigger" onClick={() => setProfileOpen(v => !v)}><span className="avatar">{(user?.name || user?.username || 'A').slice(0,1).toUpperCase()}</span><span className="profile-copy"><b>{user?.name || 'Your workspace'}</b><small>{user?.username ? '@' + user.username : user?.email}</small></span><span>⌄</span></button>
          {profileOpen && <div className="profile-popover"><button onClick={() => void signOut()}><LogOut size={15} /> Sign out</button></div>}
        </div>
      </div>
    </motion.aside>
    {mobileOpen && <><button className="mobile-more-scrim" type="button" aria-label="Close More menu" onClick={() => setMobileOpen(false)} /><motion.aside className="mobile-more-drawer" initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 18 }} aria-label="More navigation"><div className="mobile-more-drawer__head"><b>More</b><button type="button" aria-label="Close menu" onClick={() => setMobileOpen(false)}><X size={17}/></button></div><nav>{commandDestinations.map(item => { const Icon=item.icon; return <NavLink key={item.to} to={item.to} onClick={() => setMobileOpen(false)}><Icon size={17}/><span>{item.label}</span><ArrowRight size={14}/></NavLink>; })}<div className="mobile-more-life-areas"><span className="eyebrow">YOUR LIFE AREAS</span><div>{selectedLifeAreas.map(id => <span key={id}>{lifeAreaNames[id]}</span>)}</div><NavLink to="/settings" onClick={() => setMobileOpen(false)}>Edit your areas <ArrowRight size={13}/></NavLink></div><NavLink to="/settings" onClick={() => setMobileOpen(false)}><SlidersHorizontal size={17}/><span>Settings</span><ArrowRight size={14}/></NavLink>{role === 'admin' && <NavLink to="/admin" onClick={() => setMobileOpen(false)}><Settings size={17}/><span>Administration</span><ArrowRight size={14}/></NavLink>}<button type="button" onClick={() => { setMobileOpen(false); void signOut(); }}><LogOut size={17}/><span>Sign out</span></button></nav></motion.aside></>}
    
    <main className="main-area">
      <motion.div ref={bootContentRef} className="atlas-workspace-boot" initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={reduceMotion ? { duration: 0 } : { duration: 0.24, ease: [0.16, 1, 0.3, 1] }}>
      <motion.header className="topbar" initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={reduceMotion ? { duration: 0 } : { duration: 0.18, delay: 0.04 }}>
        
        <div className="topbar-context"><b>{(current?.label) || (location.pathname === '/values' ? faithTabLabel : location.pathname === '/quran' ? 'Qur’an' : location.pathname === '/habits' ? 'Habits & Self-Control' : location.pathname === '/learning-library' ? 'Education & Learning' : location.pathname === '/reviews-insights' ? 'Growth' : location.pathname === '/admin' ? 'Administration' : location.pathname === '/settings' ? 'Settings' : 'Personal tools')}</b></div>
        <button className="mobile-more-trigger" type="button" aria-label="More and settings" aria-expanded={mobileOpen} onClick={() => setMobileOpen(v => !v)}><SlidersHorizontal size={17}/><span>More</span></button>
        <div className="topbar-right"><button className="global-capture-trigger" type="button" onClick={() => {setCommandOpen(true);setCommandQuery('');}}><Search size={14}/><span>Quick capture</span><kbd>⌘ K</kbd></button><button className="tour-launcher" type="button" onClick={() => setTourOpen(true)}><Compass size={14} /> Guided tour</button><span className="privacy-indicator"><span /> PRIVATE BY DESIGN</span><span className="topbar-date">{new Intl.DateTimeFormat(undefined,{weekday:'short',month:'short',day:'numeric'}).format(new Date())}</span></div>
      </motion.header>

      <div className="page-container" ref={workspaceRef}>
        {activeTabs.length > 0 && <nav className="module-subnav" aria-label="Module sections">{activeTabs.map(tab => <MotionNavLink key={tab.to} to={tab.to} onClick={() => setMobileOpen(false)} whileTap={{ scale: 0.985 }} transition={{ type: 'spring', stiffness: 500, damping: 32 }} className={({ isActive }) => 'module-subnav__link ' + (isActive ? 'module-subnav__link--active' : '')}>{({isActive}) => <>{isActive && <motion.span className="module-subnav-indicator" layoutId={'atlas-subnav-' + current?.id} transition={{ type: 'spring', stiffness: 420, damping: 35, bounce: 0 }} />}{tab.label}</>}</MotionNavLink>)}</nav>}
        <EntrancePresetContext.Provider value={entrancePreset}>
          <PortalTransition>
          <motion.div
            key={location.pathname}
            className="room-view-transition"
            initial={false}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0 }}
            style={{ willChange: reduceMotion ? 'auto' : 'transform, opacity' }}
          >
            <Outlet />
          </motion.div>
          </PortalTransition>
        </EntrancePresetContext.Provider>
      </div>
      </motion.div>
      <AnimatePresence initial={false}>{commandOpen && <motion.div className="command-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} onMouseDown={event => {if(event.target===event.currentTarget)setCommandOpen(false);}}><motion.section className="command-panel" role="dialog" aria-modal="true" aria-label="Atlas quick capture" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}>
        <div className="command-search"><Search size={17}/><input autoFocus value={commandQuery} onChange={event=>setCommandQuery(event.target.value)} placeholder="Search pillars, capture a task, or check in…"/><kbd>ESC</kbd></div>
        {(!commandQuery || 'add a task'.includes(commandQuery.toLowerCase())) && <form className="command-task-form" onSubmit={captureTask}><Zap size={15}/><input value={quickTaskTitle} onChange={event=>setQuickTaskTitle(event.target.value)} placeholder="Capture a task…" maxLength={180}/><button disabled={!quickTaskTitle.trim()||quickTaskSaving}>{quickTaskSaving?'Saving…':'Add task'}</button></form>}
        {quickTaskError && <p className="command-error">{quickTaskError}</p>}
        {quickReligion === 'islam' && <div className="command-checkins"><span className="eyebrow">TODAY · SALAH</span><div className="command-checkin-list">{(quickDeen.data?.prayers || []).map(item => <button type="button" key={item.prayer} className={item.completed ? 'is-complete' : ''} disabled={quickPrayerMutation.isPending} onClick={event => { if (!item.completed) sparkAtElement(event.currentTarget); quickPrayerMutation.mutate(item); }}><span>{item.completed ? '✓' : '○'}</span>{item.prayer}<small>{item.completed ? 'Recorded' : 'Mark done'}</small></button>)}</div></div>}
        {!!quickHabits.data?.length && <div className="command-checkins"><span className="eyebrow">TODAY · HABITS</span><div className="command-checkin-list">{quickHabits.data.map(item => <button type="button" key={item.id} className={item.done ? 'is-complete' : ''} disabled={quickHabitMutation.isPending} onClick={event => { if (!item.done) sparkAtElement(event.currentTarget); quickHabitMutation.mutate(item.id); }}><span>{item.done ? '✓' : '○'}</span>{item.title}<small>{item.done ? 'Done' : 'Mark done'}</small></button>)}</div></div>}
        <div className="command-results"><span className="eyebrow">JUMP TO OR CHECK IN</span>{commandItems.map(item=>{const Icon=item.icon;return <button key={item.label} type="button" onClick={()=>{setCommandOpen(false);navigate(item.to);}}><Icon size={16}/><span><b>{item.label}</b><small>{item.detail}</small></span><kbd>{item.shortcut}</kbd></button>;})}{!commandItems.length&&<p>No matching destination.</p>}</div>
        <div className="command-footer"><span>Navigate between rooms</span><span>⌘ 1 — 6</span></div>
      </motion.section></motion.div>}</AnimatePresence>
      <motion.nav className="atlas-command-dock" layout transition={{ type: 'spring', stiffness: 420, damping: 34, bounce: 0 }} aria-label="Atlas command dock">
        <MagneticButton className="atlas-dock-action" aria-label="Open command search" onClick={() => { setCommandOpen(true); setCommandQuery(''); }}><Search size={15}/><span>Command</span><kbd>⌘ K</kbd></MagneticButton>
        <MagneticButton className="atlas-dock-action" aria-label="Quick capture a task" onClick={() => { setCommandOpen(true); setCommandQuery('add a task'); }}><Plus size={15}/><span>Quick Capture</span></MagneticButton>
        <motion.div className={'atlas-dock-focus ' + (focusSessionVisible ? 'is-expanded' : '')} layout transition={{ type: 'spring', stiffness: 420, damping: 34, bounce: 0 }}>
          <MagneticButton className="atlas-dock-action atlas-dock-focus__open" aria-label="Open Focus Timer" onClick={() => navigate('/focus')}><Timer size={15}/><span>Focus Timer</span>{focusSessionVisible && <strong><OdometerNumber value={focusClock}/></strong>}</MagneticButton>
          {focusSessionVisible && <motion.div className="atlas-dock-focus__detail" initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 'auto' }} exit={{ opacity: 0, width: 0 }} transition={{ duration: 0.18 }}><span title={focusContext}>{focusContext}</span><MagneticButton className="atlas-dock-action atlas-dock-focus__toggle" onClick={toggleTimer}>{focusActive ? <Pause size={13}/> : <Play size={13}/>}<small>{focusActive ? "Pause" : "Resume"}</small></MagneticButton></motion.div>}
        </motion.div>
        <MagneticButton className="atlas-dock-action" aria-label="Open Daily Check-In" onClick={() => { navigate('/residence'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}><Check size={15}/><span>Daily Check-In</span></MagneticButton>
      </motion.nav>
      <nav className="atlas-mobile-dock" aria-label="Primary navigation">
        <NavLink to="/residence" end className={({isActive}) => 'atlas-mobile-dock__item ' + (isActive ? 'is-active' : '')}><House size={18}/><span>Today</span></NavLink>
        <NavLink to="/quran" className={({isActive}) => 'atlas-mobile-dock__item atlas-mobile-dock__quran ' + (isActive ? 'is-active' : '')} onClick={() => setMobileOpen(false)}><BookOpen size={18}/><span>Qur’an</span></NavLink>
        <NavLink to="/focus" className={({isActive}) => 'atlas-mobile-dock__item ' + (isActive || location.pathname === '/execution' ? 'is-active' : '')}><Compass size={18}/><span>Focus</span></NavLink>
        <NavLink to="/goals" className={({isActive}) => 'atlas-mobile-dock__item ' + (isActive ? 'is-active' : '')}><Target size={18}/><span>Goals</span></NavLink>
        <button type="button" className="atlas-mobile-dock__item" onClick={() => setMobileOpen(true)} aria-expanded={mobileOpen}><SlidersHorizontal size={18}/><span>More</span></button>
      </nav>
      <footer className="app-footer"><span>AMSTREEM ATLAS</span><span>Make room for what matters.</span></footer>
    </main>
  </div>;
}