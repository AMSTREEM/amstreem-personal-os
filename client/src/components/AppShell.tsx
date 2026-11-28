import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError, json } from '../lib/api';
import { enqueueOfflineCapture, flushOfflineCaptures, getOfflineCaptureCount } from '../lib/offlineCaptureQueue';
import { applyAtlasTheme, watchAtlasSystemTheme } from '../design/theme';
import { atlasMotion } from '../design/motion';
import { atlasModules as rooms, quranShellEntry as quranDestination, atlasNavigationGroups as navigationGroups, atlasCommandDestinations as commandDestinations, atlasQuickCaptureTypes, atlasSearchSources } from '../design/module-registry';
import { ArrowRight, BookOpen, Check, Compass, History as HistoryIcon, LogOut, Pause, Play, Plus, Search, Settings, PanelLeftClose, PanelLeftOpen, SlidersHorizontal, Timer, X, Zap } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { AtlasWalkthrough } from './AtlasWalkthrough';
import { AtlasOnboarding } from './AtlasOnboarding';
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



type QuickPrayer = { prayer: string; completed: number; on_time: number };
type QuickDeen = { prayers: QuickPrayer[] };
type QuickHabit = { id: number; title: string; emoji: string; done: number };
type AtlasSearchItem = { id: string; title: string; detail: string; to: string };
function atlasDate(timeZone = 'Africa/Lagos') { return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
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
  const commandPanelRef = useRef<HTMLElement>(null);
  const mobileDrawerRef = useRef<HTMLElement>(null);
  const dockCustomizerRef = useRef<HTMLElement>(null);
  const bootContentRef = useRef<HTMLDivElement>(null);
  useSpotlightGrid(workspaceRef);

  const navigate = useNavigate();
  const location = useLocation();
  const { user, role, signOut, session, completeOnboarding } = useAuth();
  const queryClient = useQueryClient();
  const reduceMotion = useReducedMotion();
  const [booting, setBooting] = useState(true);
  useEffect(() => { const timeout = window.setTimeout(() => setBooting(false), 380); return () => window.clearTimeout(timeout); }, []);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem('atlas-sidebar-collapsed');
      if (saved !== null) return saved === 'true';
      return window.matchMedia('(min-width: 640px) and (max-width: 1023px)').matches;
    } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem('atlas-sidebar-collapsed', String(sidebarCollapsed)); } catch {}
  }, [sidebarCollapsed]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dockCustomizerOpen, setDockCustomizerOpen] = useState(false);
  const [dockDestinationIds, setDockDestinationIds] = useState<string[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('atlas-phone-dock') || 'null');
      if (Array.isArray(saved) && saved.length === 3 && new Set(saved).size === 3 && saved.every(id => rooms.some(room => room.id === id))) return saved;
    } catch {}
    return ['residence', 'actions', 'calendar'];
  });
  useEffect(() => {
    try { localStorage.setItem('atlas-phone-dock', JSON.stringify(dockDestinationIds)); } catch {}
  }, [dockDestinationIds]);
  const dockModules = useMemo(() => dockDestinationIds.map(id => rooms.find(room => room.id === id)).filter((item): item is typeof rooms[number] => Boolean(item)), [dockDestinationIds]);
  const updateDockSlot = (slot: number, nextId: string) => {
    setDockDestinationIds(current => current.map((id, index) => index === slot ? nextId : id === nextId ? current[slot] : id));
  };
  const [profileOpen, setProfileOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const focusTimer = useFocusTimer();
  const [clockNow, setClockNow] = useState(Date.now());
  const [quickTaskTitle, setQuickTaskTitle] = useState('');
  const [quickCaptureType, setQuickCaptureType] = useState<(typeof atlasQuickCaptureTypes)[number]>('task');
  const [quickTaskSaving, setQuickTaskSaving] = useState(false);
  const [quickTaskError, setQuickTaskError] = useState('');
  const [pendingOfflineCaptures, setPendingOfflineCaptures] = useState(0);
  useEffect(() => {
    if (!commandOpen) return;
    const panel = commandPanelRef.current;
    if (!panel) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusable = () => Array.from(panel.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href]'));
    focusable()[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const items = focusable();
      const first = items[0], last = items[items.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previousFocus?.focus();
    };
  }, [commandOpen]);
  useEffect(() => {
    if (!mobileOpen) return;
    const panel = mobileDrawerRef.current;
    if (!panel) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusable = () => Array.from(panel.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled])'));
    focusable()[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const items = focusable();
      const first = items[0], last = items[items.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previousFocus?.focus();
    };
  }, [mobileOpen]);
  useEffect(() => {
    if (!dockCustomizerOpen) return;
    const panel = dockCustomizerRef.current;
    if (!panel) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusable = () => Array.from(panel.querySelectorAll<HTMLElement>('button:not([disabled]), select:not([disabled]), input:not([disabled]), a[href]'));
    focusable()[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const items = focusable();
      const first = items[0], last = items[items.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previousFocus?.focus();
    };
  }, [dockCustomizerOpen]);
  useEffect(() => {
    const userId = session?.user.id;
    if (!userId) { setPendingOfflineCaptures(0); return; }
    const refreshCount = () => setPendingOfflineCaptures(getOfflineCaptureCount(userId));
    const syncQueue = async () => {
      if (!navigator.onLine) { refreshCount(); return; }
      try {
        const result = await flushOfflineCaptures(userId, async capture => {
          try {
            return await api(capture.endpoint, {
              method: 'POST',
              headers: { 'Idempotency-Key': capture.idempotencyKey },
              body: JSON.stringify(capture.payload)
            });
          } catch (error) {
            if (error instanceof ApiError && error.code === 'idempotency_replayed') return;
            throw error;
          }
        });
        setPendingOfflineCaptures(result.remaining);
        if (result.sent > 0) {
          for (const key of [['tasks'], ['overview'], ['notes'], ['habits']]) void queryClient.invalidateQueries({ queryKey: key });
        }
      } catch (error) {
        refreshCount();
        console.warn('Atlas could not sync queued captures yet:', error);
      }
    };
    refreshCount();
    void syncQueue();
    const onOnline = () => { void syncQueue(); };
    const onVisible = () => { if (document.visibilityState === 'visible') void syncQueue(); };
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [session?.user.id, queryClient]);
  useEffect(() => {
    if (!session?.user || !user) return;
    let completed = session.user.user_metadata?.onboarding_completed === true;
    try { completed = completed || localStorage.getItem(`atlas-onboarding-complete:${session.user.id}`) === 'true'; } catch {}
    if (!completed) setOnboardingOpen(true);
  }, [session?.user.id, session?.user.user_metadata?.onboarding_completed, user?.id]);
  const finishOnboarding = useCallback(() => {
    setOnboardingOpen(false);
    void queryClient.invalidateQueries();
    if (!session?.user.id) return;
    try { localStorage.setItem(`atlas-onboarding-complete:${session.user.id}`, 'true'); } catch {}
    void completeOnboarding().catch(error => console.error('Could not save Atlas onboarding completion:', error));
  }, [session?.user.id, completeOnboarding, queryClient]);
  const closeTour = useCallback(() => setTourOpen(false), []);
  useEffect(() => {
    const tick = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, []);
  useEffect(() => {
    const destinations = [...rooms, quranDestination];
    let waitingForDestination = false;
    let prefixTimer: number | undefined;
    const onKey = (event: KeyboardEvent) => {
      const el = event.target as HTMLElement | null;
      const typing = !!el && (el.isContentEditable || ['INPUT','TEXTAREA','SELECT'].includes(el.tagName));
      const commandKey = event.metaKey || event.ctrlKey;
      if (commandKey && event.key.toLowerCase() === 'k') { event.preventDefault(); setCommandOpen(value => !value); setCommandQuery(''); return; }
      if (event.key === 'Escape') { setCommandOpen(false); setMobileOpen(false); setDockCustomizerOpen(false); waitingForDestination = false; return; }
      if (typing || (location.pathname === '/quran' && !commandKey)) return;
      if (!commandKey && event.key.toLowerCase() === 'g') {
        waitingForDestination = true;
        window.clearTimeout(prefixTimer);
        prefixTimer = window.setTimeout(() => { waitingForDestination = false; }, 900);
        return;
      }
      if (waitingForDestination && /^[1-9]$/.test(event.key)) {
        event.preventDefault();
        waitingForDestination = false;
        window.clearTimeout(prefixTimer);
        setPortalOrigin(window.innerWidth / 2, window.innerHeight / 2);
        navigate(destinations[Number(event.key) - 1].to);
        return;
      }
      if (!commandKey && event.key.toLowerCase() === 'c') {
        event.preventDefault(); setCommandOpen(true); setCommandQuery(''); return;
      }
      if (!commandKey && event.key === '/') {
        event.preventDefault(); setCommandOpen(true); setCommandQuery(''); return;
      }
      if (!commandKey && event.key === '?') {
        event.preventDefault(); setCommandOpen(true); setCommandQuery('shortcuts'); return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); window.clearTimeout(prefixTimer); };
  }, [navigate, location.pathname]);
  const focusRemaining = focusTimer.deadline ? Math.max(0, Math.ceil((focusTimer.deadline - clockNow) / 1000)) : focusTimer.remaining;
  const focusActive = !!focusTimer.deadline && focusRemaining > 0;
  const focusClock = String(Math.floor(focusRemaining / 60)).padStart(2,'0') + ':' + String(focusRemaining % 60).padStart(2,'0');
  const focusContext = focusTimer.taskTitle || focusTimer.lessonTitle || focusTimer.focusLabel || focusTimer.focus || 'Focus session';
  const focusSessionVisible = focusRemaining > 0 && (focusActive || focusTimer.remaining < 25 * 60 || !!focusTimer.startedAt || !!focusTimer.sessionKey || !!focusTimer.taskId || !!focusTimer.lessonId || !!focusTimer.projectId || (focusTimer.durationSeconds !== undefined && focusTimer.durationSeconds !== 25 * 60));
  function writeTimer(value: Parameters<typeof updateFocusTimer>[0]) { updateFocusTimer(value); }
  function toggleTimer() { if (focusActive) writeTimer({ ...focusTimer, remaining: focusRemaining, deadline: null }); else if (focusRemaining > 0) writeTimer({ ...focusTimer, deadline: Date.now() + focusRemaining * 1000 }); }
  function finishTimer() { const elapsed = Math.max(0, (focusTimer.durationSeconds || focusTimer.remaining) - focusRemaining); writeTimer({ ...focusTimer, remaining: 0, deadline: null, durationSeconds: elapsed, sessionKey: elapsed >= 60 ? focusTimer.sessionKey : null }); navigate('/focus'); }
  async function captureQuickItem(event: FormEvent) {
    event.preventDefault();
    const title = quickTaskTitle.trim();
    if (!title || quickTaskSaving) return;
    setQuickTaskSaving(true); setQuickTaskError('');
    const endpoint = quickCaptureType === 'task' ? '/tasks' : quickCaptureType === 'note' ? '/notes' : '/habits';
    const payload = quickCaptureType === 'task' ? { title, category: 'Personal' } : quickCaptureType === 'note' ? { title, body: '' } : { title, emoji: '✦' };
    const idempotencyKey = crypto.randomUUID();
    try {
      await api(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey }, body: JSON.stringify(payload) });
      setQuickTaskTitle(''); setQuickTaskError(''); setCommandOpen(false);
      for (const key of [['tasks'], ['overview'], ['notes'], ['habits']]) void queryClient.invalidateQueries({ queryKey: key });
    } catch (error) {
      if ((error instanceof TypeError || !navigator.onLine) && session?.user.id) {
        try {
          const count = enqueueOfflineCapture(session.user.id, endpoint, payload, idempotencyKey);
          setPendingOfflineCaptures(count);
          setQuickTaskTitle('');
          setQuickTaskError('');
          setCommandOpen(false);
        } catch (queueError) {
          setQuickTaskError(queueError instanceof Error ? queueError.message : 'Could not save this capture offline.');
        }
      } else {
        setQuickTaskError(error instanceof Error ? error.message : 'Could not save this item.');
      }
    } finally { setQuickTaskSaving(false); }
  }
  const commandItems = useMemo(() => commandDestinations.map((item,index) => ({ label: item.label, detail: ('detail' in item && item.detail) ? item.detail : 'Open module', to: item.to, icon: item.icon, shortcut: index < 9 ? 'g '+(index+1) : '' })).filter(item => (item.label+' '+item.detail).toLowerCase().includes(commandQuery.toLowerCase())),[commandQuery]);
  const entrancePreset = useEntrancePreset(location.pathname);
  const settings = useQuery({ queryKey: ['settings'], queryFn: () => api<Record<string, string>>('/settings') });
  const quickDate = atlasDate(settings.data?.timezone || 'Africa/Lagos');
  const quickReligion = settings.data?.faith_tradition || settings.data?.religion || 'none';
  const quickDeen = useQuery({ queryKey: ['deen', quickDate], queryFn: () => api<QuickDeen>('/deen/summary?date=' + quickDate), enabled: commandOpen && quickReligion === 'islam' });
  const quickHabits = useQuery({ queryKey: ['habits', quickDate], queryFn: () => api<QuickHabit[]>('/habits?date=' + quickDate), enabled: commandOpen });
  const searchIndex = useQuery({
    queryKey: ['atlas-command-search-index'],
    queryFn: async () => {
      const groups = await Promise.all(atlasSearchSources.map(async source => {
        try {
          const response = await api<unknown>(source.endpoint);
          const records = Array.isArray(response)
            ? response
            : response && typeof response === 'object'
              ? Object.values(response as Record<string, unknown>).filter(Array.isArray).flat()
              : [];
          return records.map((value, index): AtlasSearchItem | null => {
            if (!value || typeof value !== 'object') return null;
            const record = value as Record<string, unknown>;
            const title = [record.title, record.name, record.label].find(item => typeof item === 'string' && item.trim()) as string | undefined;
            if (!title) return null;
            const detail = typeof record.description === 'string' ? record.description : source.kind;
            return { id: source.id + ':' + String(record.id ?? index) + ':' + source.kind, title, detail: source.kind + ' · ' + detail, to: source.route };
          }).filter((item): item is AtlasSearchItem => item !== null);
        } catch {
          return [];
        }
      }));
      return groups.flat();
    },
    enabled: commandOpen && commandQuery.trim().length >= 2,
    staleTime: 30_000
  });
  const searchResults = useMemo(() => {
    const query = commandQuery.trim().toLowerCase();
    if (query.length < 2) return [];
    return (searchIndex.data || []).filter(item => (item.title + ' ' + item.detail).toLowerCase().includes(query)).slice(0, 8);
  }, [searchIndex.data, commandQuery]);
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
    applyAtlasTheme(theme);
    return watchAtlasSystemTheme(theme);
  }, [settings.data?.theme]);
  const storedFeatures = settings.data?.features;
  let enabledFeatures: string[] | null = null;
  if (storedFeatures) { try { enabledFeatures = JSON.parse(storedFeatures).map((feature: string) => feature === 'values' ? 'deen' : feature); } catch { enabledFeatures = null; } }
  const lifeAreaNames: Record<string, string> = { health: 'Health & Fitness', education: 'Education & Learning', career: 'Career & Business', finance: 'Financial Growth', faith: 'Faith & Spirituality', personal: 'Personal Development', relationships: 'Relationships', lifestyle: 'Lifestyle & Organisation' };
  let selectedLifeAreas: string[] = [];
  try { selectedLifeAreas = settings.data?.life_areas ? JSON.parse(settings.data.life_areas).filter((id: string) => !!lifeAreaNames[id]) : Object.keys(lifeAreaNames); } catch { selectedLifeAreas = Object.keys(lifeAreaNames); }
  // The six core pillars are always available; preferences only control secondary views.
  const current = commandDestinations.find(item => item.paths?.includes(location.pathname));
  useEffect(() => {
    if (location.pathname === '/quran') return;
    const heading = document.querySelector<HTMLElement>('#atlas-main-content .page-container h1, #atlas-main-content .page-container h2');
    if (!heading) return;
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }, [location.pathname]);
  useEffect(() => {
    if (focusActive && focusTimer.kind !== 'break') {
      const activeLabel = focusContext !== 'Focus session' ? focusContext : current?.label || 'Focus Room';
      document.title = focusClock + ' · ' + activeLabel + ' — Amstreem Atlas';
    } else document.title = 'Amstreem Atlas';
    return () => { document.title = 'Amstreem Atlas'; };
  }, [focusActive, focusTimer.kind, focusClock, focusContext, current?.label]);
  const faithTabLabel = quickReligion === 'islam' ? 'Deen' : quickReligion === 'christianity' ? 'Faith & Reflection' : 'Daily Reflection';
  const activeTabs: { label: string; to: string; feature?: string }[] = [];
  return <div className={"app-frame" + (location.pathname === '/quran' ? " atlas-quran-shell" : " atlas-standard-shell") + (booting ? " atlas-booting" : "")} onPointerDownCapture={event=>setPortalOrigin(event.clientX,event.clientY)}>
    <CursorAura/><SparkBurst/><EnergyVortex/>
    <MobileInstallPrompt />
    <AnimatePresence initial={false}>{tourOpen && <AtlasWalkthrough onClose={closeTour} onOpenCommand={() => { setCommandOpen(true); setCommandQuery(''); }} />}</AnimatePresence>
    {onboardingOpen && <AtlasOnboarding onComplete={finishOnboarding} />}
    <motion.aside className={'sidebar ' + (mobileOpen ? 'sidebar--open' : '') + (sidebarCollapsed ? ' sidebar--collapsed' : ' sidebar--expanded')} initial={reduceMotion ? false : { x: -12, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={reduceMotion ? { duration: 0 } : { duration: 0.18, ease: [0.22, 1, 0.36, 1] }}>
      <NavLink to="/residence" className="sidebar-brand" onClick={() => setMobileOpen(false)}><img className="brand-symbol" src="/assets/brand/amstreem-symbol.svg" alt="" /><span><b>AMSTREEM</b><small>ATLAS</small></span></NavLink>
      <button type="button" className="sidebar-collapse-toggle" aria-label={sidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'} aria-pressed={sidebarCollapsed} onClick={() => setSidebarCollapsed(value => !value)}>{sidebarCollapsed ? <PanelLeftOpen size={16}/> : <PanelLeftClose size={16}/>}<span>{sidebarCollapsed ? 'Expand' : 'Collapse'}</span></button>
      <div className="sidebar-caption">YOUR PRIVATE WORKSPACE</div>
      <nav className="primary-nav" aria-label="Primary navigation">
        {navigationGroups.map(group => <div className="nav-group" key={group.label}>
          <div className="nav-group__label">{group.label}</div>
          {group.items.map((item,index) => {
            const Icon = item.icon;
            const active = item.paths.includes(location.pathname);
            const shortcutIndex = rooms.findIndex(room => room.id === item.id) + 1;
            return <MotionNavLink key={item.id} to={item.to} end onClick={() => setMobileOpen(false)} whileTap={{ scale: 0.985 }} transition={atlasMotion.spring.snappy} data-module={item.id} title={sidebarCollapsed ? item.label : undefined} className={'nav-link room-nav-link atlas-nav-item ' + (active ? 'nav-link--active' : '')}>{active && <motion.span className="room-nav-indicator" layoutId="atlas-navigation-pill" transition={atlasMotion.spring.snappy} />}<Icon size={17} strokeWidth={1.8} /><span>{item.label}</span><kbd>g {shortcutIndex}</kbd></MotionNavLink>;
          })}
        </div>)}
        <div className="nav-group nav-group--specialist">
          <div className="nav-group__label">QUR’AN</div>
          <MotionNavLink to="/quran" end onClick={() => setMobileOpen(false)} whileTap={{ scale: 0.985 }} transition={{ type: 'spring', stiffness: 500, damping: 32 }} data-module="quran" title={sidebarCollapsed ? 'Qur’an' : undefined} className={'nav-link room-nav-link atlas-nav-item ' + (location.pathname === '/quran' ? 'nav-link--active' : '')}>
            {location.pathname === '/quran' && <motion.span className="room-nav-indicator" layoutId="atlas-navigation-pill" transition={{ type: 'spring', stiffness: 420, damping: 35, bounce: 0 }} />}
            <BookOpen size={17} strokeWidth={1.8}/><span>Qur’an</span><kbd>g 9</kbd>
          </MotionNavLink>
        </div>
      </nav>      <div className="sidebar-bottom">
        <NavLink to="/history" className={({ isActive }) => 'nav-link nav-link--settings ' + (isActive ? 'nav-link--active' : '')} onClick={() => setMobileOpen(false)}><HistoryIcon size={17} /><span>Workspace history</span></NavLink>
        <NavLink to="/settings" className={({ isActive }) => 'nav-link nav-link--settings ' + (isActive ? 'nav-link--active' : '')} onClick={() => setMobileOpen(false)}><SlidersHorizontal size={17} /><span>Settings</span></NavLink>
        {role === 'admin' && <NavLink to="/admin" className={({ isActive }) => 'nav-link nav-link--settings ' + (isActive ? 'nav-link--active' : '')} onClick={() => setMobileOpen(false)}><Settings size={17} /><span>Administration</span></NavLink>}
        <div className="profile-menu">
          <button className="profile-trigger" onClick={() => setProfileOpen(v => !v)}><span className="avatar">{(user?.name || user?.username || 'A').slice(0,1).toUpperCase()}</span><span className="profile-copy"><b>{user?.name || 'Your workspace'}</b><small>{user?.username ? '@' + user.username : user?.email}</small></span><span>⌄</span></button>
          {profileOpen && <div className="profile-popover"><button onClick={() => void signOut()}><LogOut size={15} /> Sign out</button></div>}
        </div>
      </div>
    </motion.aside>
    {mobileOpen && <><button className="mobile-more-scrim" type="button" aria-label="Close More menu" onClick={() => setMobileOpen(false)} /><motion.aside ref={mobileDrawerRef} className="mobile-more-drawer" role="dialog" aria-modal="true" initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 18 }} aria-label="More navigation"><div className="mobile-more-drawer__head"><b>More</b><button type="button" aria-label="Close menu" onClick={() => setMobileOpen(false)}><X size={17}/></button></div><nav className="mobile-launcher">
          <div className="mobile-launcher-grid" aria-label="Atlas modules">
            {[...rooms, quranDestination].map(item => { const Icon=item.icon; return <NavLink key={item.id} to={item.to} data-module={item.id} className={({isActive}) => 'mobile-launcher-tile atlas-nav-item ' + (isActive ? 'is-active' : '')} onClick={() => setMobileOpen(false)}><Icon size={21}/><span>{item.label}</span></NavLink>; })}
          </div>
          <div className="mobile-launcher-utilities">
            <div className="mobile-more-life-areas"><span className="eyebrow">YOUR LIFE AREAS</span><div>{selectedLifeAreas.map(id => <span key={id}>{lifeAreaNames[id]}</span>)}</div><NavLink to="/settings" onClick={() => setMobileOpen(false)}>Edit your areas <ArrowRight size={13}/></NavLink></div>
            <button type="button" onClick={() => { setMobileOpen(false); setDockCustomizerOpen(true); }}><SlidersHorizontal size={17}/><span>Customize bottom bar</span><ArrowRight size={14}/></button>
            <NavLink to="/settings" onClick={() => setMobileOpen(false)}><SlidersHorizontal size={17}/><span>Settings</span><ArrowRight size={14}/></NavLink>
            {role === 'admin' && <NavLink to="/admin" onClick={() => setMobileOpen(false)}><Settings size={17}/><span>Administration</span><ArrowRight size={14}/></NavLink>}
            <button type="button" onClick={() => { setMobileOpen(false); void signOut(); }}><LogOut size={17}/><span>Sign out</span></button>
          </div>
        </nav></motion.aside></>}
    
    <AnimatePresence>
      {dockCustomizerOpen && <motion.div className="atlas-dock-customizer-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={event => { if (event.target === event.currentTarget) setDockCustomizerOpen(false); }}>
        <motion.section ref={dockCustomizerRef} className="atlas-dock-customizer" role="dialog" aria-modal="true" aria-label="Customize phone navigation" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}>
          <header><div><b>Customize your bar</b><small>Choose the three destinations beside Capture and More</small></div><button type="button" aria-label="Close customizer" onClick={() => setDockCustomizerOpen(false)}><X size={18}/></button></header>
          {dockModules.map((item, slot) => <label key={slot} className="atlas-dock-customizer__field"><span>Destination {slot + 1}</span><select value={dockDestinationIds[slot]} onChange={event => updateDockSlot(slot, event.target.value)}>{rooms.map(room => <option key={room.id} value={room.id} disabled={dockDestinationIds.includes(room.id) && dockDestinationIds[slot] !== room.id}>{room.label}</option>)}</select></label>)}
          <button type="button" className="atlas-dock-customizer__done" onClick={() => setDockCustomizerOpen(false)}>Done</button>
        </motion.section>
      </motion.div>}
    </AnimatePresence>
    <a className="atlas-skip-link" href="#atlas-main-content">Skip to content</a>
    <div className="atlas-live-region" aria-live="polite" aria-atomic="true">{current?.label || "Atlas workspace"}</div>
    <main className="main-area" id="atlas-main-content" tabIndex={-1}>
      <motion.div ref={bootContentRef} className="atlas-workspace-boot" initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={reduceMotion ? { duration: 0 } : { duration: 0.24, ease: [0.16, 1, 0.3, 1] }}>
      <motion.header className="topbar" initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={reduceMotion ? { duration: 0 } : { duration: 0.18, delay: 0.04 }}>
        
        <div className="topbar-context"><b>{(current?.label) || (location.pathname === '/values' ? faithTabLabel : location.pathname === '/quran' ? 'Qur’an' : location.pathname === '/habits' ? 'Habits & Self-Control' : location.pathname === '/learning-library' ? 'Education & Learning' : location.pathname === '/reviews-insights' ? 'Growth' : location.pathname === '/admin' ? 'Administration' : location.pathname === '/settings' ? 'Settings' : 'Personal tools')}</b></div>
        <button className="mobile-more-trigger" type="button" aria-label="More and settings" aria-expanded={mobileOpen} onClick={() => setMobileOpen(v => !v)}><SlidersHorizontal size={17}/><span>More</span></button><button className="mobile-search-trigger" type="button" aria-label="Search Atlas" onClick={() => { setCommandOpen(true); setCommandQuery(''); }}><Search size={18}/></button>
        <div className="topbar-right"><button className="global-capture-trigger" type="button" onClick={() => {setCommandOpen(true);setCommandQuery('');}}><Search size={14}/><span>Quick capture</span><kbd>⌘ K</kbd></button><button className="tour-launcher" type="button" onClick={() => setTourOpen(true)}><Compass size={14} /> Guided tour</button><span className="privacy-indicator"><span /> PRIVATE BY DESIGN</span>{pendingOfflineCaptures > 0 && <span className="atlas-offline-queue" role="status" aria-live="polite">{pendingOfflineCaptures} queued</span>}<span className="topbar-date">{new Intl.DateTimeFormat(undefined,{timeZone:settings.data?.timezone || 'Africa/Lagos',weekday:'short',month:'short',day:'numeric'}).format(new Date())}</span></div>
      </motion.header>

      <div className="page-container" ref={workspaceRef}>
        {activeTabs.length > 0 && <nav className="module-subnav" aria-label="Module sections">{activeTabs.map(tab => <MotionNavLink key={tab.to} to={tab.to} onClick={() => setMobileOpen(false)} whileTap={{ scale: 0.985 }} transition={{ type: 'spring', stiffness: 500, damping: 32 }} className={({ isActive }) => 'module-subnav__link ' + (isActive ? 'module-subnav__link--active' : '')}>{({isActive}) => <>{isActive && <motion.span className="module-subnav-indicator" layoutId={'atlas-subnav-' + current?.id} transition={{ type: 'spring', stiffness: 420, damping: 35, bounce: 0 }} />}{tab.label}</>}</MotionNavLink>)}</nav>}
        <EntrancePresetContext.Provider value={entrancePreset}>
          <PortalTransition>
          <motion.div
            key={location.pathname}
            className="room-view-transition" data-module={current?.id || "residence"}
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
      <AnimatePresence initial={false}>{commandOpen && <motion.div className="command-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} onMouseDown={event => {if(event.target===event.currentTarget)setCommandOpen(false);}}><motion.section ref={commandPanelRef} className="command-panel" role="dialog" aria-modal="true" aria-label="Atlas command palette and quick capture" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}>
        <div className="command-search"><Search size={17}/><input autoFocus aria-label="Search Atlas destinations" value={commandQuery} onChange={event=>setCommandQuery(event.target.value)} placeholder="Search pillars, capture a task, or check in…"/><kbd>ESC</kbd></div>
        {commandQuery.toLowerCase() !== 'shortcuts' && <div className="quick-capture-types" role="group" aria-label="Capture type">
          {atlasQuickCaptureTypes.map(type => <button key={type} type="button" aria-pressed={quickCaptureType === type} onClick={() => setQuickCaptureType(type)}>{type === 'task' ? 'Task' : type === 'note' ? 'Note' : 'Habit'}</button>)}
        </div>}
        {commandQuery.toLowerCase() !== 'shortcuts' && <form className="command-task-form" onSubmit={captureQuickItem}><Zap size={15}/><input aria-label={quickCaptureType === 'task' ? 'New task title' : quickCaptureType === 'note' ? 'New note title' : 'New habit name'} value={quickTaskTitle} onChange={event=>setQuickTaskTitle(event.target.value)} placeholder={quickCaptureType === 'task' ? 'What needs doing?' : quickCaptureType === 'note' ? 'Give this note a title…' : 'Name a habit to build…'} maxLength={quickCaptureType === 'habit' ? 100 : 180}/><button disabled={!quickTaskTitle.trim()||quickTaskSaving}>{quickTaskSaving?'Saving…':'Save ' + quickCaptureType}</button></form>}
        {quickTaskError && <p className="command-error">{quickTaskError}</p>}
        <div className="command-actions" aria-label="Quick actions">
          <button type="button" onClick={() => { setQuickCaptureType('task'); setQuickTaskTitle(''); }}>New task</button>
          <button type="button" onClick={() => { setCommandOpen(false); navigate('/focus'); }}>Start focus</button>
          <button type="button" onClick={() => { setCommandOpen(false); navigate('/habits'); }}>Habit check-ins</button>
        </div>
        {quickReligion === 'islam' && <div className="command-checkins"><span className="eyebrow">TODAY · SALAH</span><div className="command-checkin-list">{(quickDeen.data?.prayers || []).map(item => <button type="button" key={item.prayer} className={item.completed ? 'is-complete' : ''} disabled={quickPrayerMutation.isPending} onClick={event => { if (!item.completed) sparkAtElement(event.currentTarget); quickPrayerMutation.mutate(item); }}><span>{item.completed ? '✓' : '○'}</span>{item.prayer}<small>{item.completed ? 'Recorded' : 'Mark done'}</small></button>)}</div></div>}
        {!!quickHabits.data?.length && <div className="command-checkins"><span className="eyebrow">TODAY · HABITS</span><div className="command-checkin-list">{quickHabits.data.map(item => <button type="button" key={item.id} className={item.done ? 'is-complete' : ''} disabled={quickHabitMutation.isPending} onClick={event => { if (!item.done) sparkAtElement(event.currentTarget); quickHabitMutation.mutate(item.id); }}><span>{item.done ? '✓' : '○'}</span>{item.title}<small>{item.done ? 'Done' : 'Mark done'}</small></button>)}</div></div>}
        {commandQuery.toLowerCase() === 'shortcuts' && <div className="command-shortcuts"><span className="eyebrow">KEYBOARD SHORTCUTS</span><div><kbd>g</kbd> then <kbd>1–9</kbd><span>Jump to a module</span></div><div><kbd>c</kbd><span>Quick capture</span></div><div><kbd>/</kbd> or <kbd>⌘ K</kbd><span>Open command palette</span></div><div><kbd>?</kbd><span>Show shortcuts</span></div><div><kbd>Esc</kbd><span>Close overlays</span></div></div>}
        <div className="command-results"><span className="eyebrow">JUMP TO</span>{commandItems.map(item=>{const Icon=item.icon;return <button key={item.label} type="button" onClick={()=>{setCommandOpen(false);navigate(item.to);}}><Icon size={16}/><span><b>{item.label}</b><small>{item.detail}</small></span><kbd>{item.shortcut}</kbd></button>;})}{!commandItems.length && commandQuery.toLowerCase() !== 'shortcuts' && <p>No matching destination.</p>}</div>
        {commandQuery.trim().length >= 2 && <div className="command-results command-results--search"><span className="eyebrow">SEARCH RESULTS</span>{searchIndex.isLoading && <p>Searching your workspace…</p>}{searchResults.map(item => <button key={item.id} type="button" onClick={() => { setCommandOpen(false); navigate(item.to); }}><Search size={15}/><span><b>{item.title}</b><small>{item.detail}</small></span></button>)}{!searchIndex.isLoading && !searchResults.length && <p>No matching workspace records.</p>}</div>}
        <div className="command-footer"><span>Navigate between rooms</span><span>⌘ 1 — 6</span></div>
      </motion.section></motion.div>}</AnimatePresence>
      <motion.nav className="atlas-command-dock" layout transition={atlasMotion.spring.snappy} aria-label="Atlas command dock">
        <MagneticButton className="atlas-dock-action" aria-label="Open command search" onClick={() => { setCommandOpen(true); setCommandQuery(''); }}><Search size={15}/><span>Command</span><kbd>⌘ K</kbd></MagneticButton>
        <MagneticButton className="atlas-dock-action" aria-label="Quick capture a task" onClick={() => { setCommandOpen(true); setCommandQuery('add a task'); }}><Plus size={15}/><span>Quick Capture</span></MagneticButton>
        <motion.div className={'atlas-dock-focus ' + (focusSessionVisible ? 'is-expanded' : '')} layout transition={{ type: 'spring', stiffness: 420, damping: 34, bounce: 0 }}>
          <MagneticButton className="atlas-dock-action atlas-dock-focus__open" aria-label="Open Focus Timer" onClick={() => navigate('/focus')}><Timer size={15}/><span>Focus Timer</span>{focusSessionVisible && <strong><OdometerNumber value={focusClock}/></strong>}</MagneticButton>
          {focusSessionVisible && <motion.div className="atlas-dock-focus__detail" initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 'auto' }} exit={{ opacity: 0, width: 0 }} transition={{ duration: 0.18 }}><span title={focusContext}>{focusContext}</span><MagneticButton className="atlas-dock-action atlas-dock-focus__toggle" onClick={toggleTimer}>{focusActive ? <Pause size={13}/> : <Play size={13}/>}<small>{focusActive ? "Pause" : "Resume"}</small></MagneticButton></motion.div>}
        </motion.div>
        <MagneticButton className="atlas-dock-action" aria-label="Open Daily Check-In" onClick={() => { navigate('/residence'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}><Check size={15}/><span>Daily Check-In</span></MagneticButton>
      </motion.nav>
      <nav className="atlas-mobile-dock" aria-label="Primary navigation">
        {dockModules.map((item, slot) => { const Icon = item.icon; const active = item.paths.includes(location.pathname) || (item.id === 'actions' && location.pathname === '/focus'); return <MotionNavLink key={item.id} to={item.to} data-module={item.id} className={'atlas-mobile-dock__item atlas-nav-item ' + (active ? 'is-active' : '')} whileTap={{ scale: 0.96 }} onContextMenu={event => { event.preventDefault(); setDockCustomizerOpen(true); }}><Icon size={18}/><span>{item.label}</span>{active && <motion.span className="atlas-mobile-dock__indicator" layoutId="atlas-navigation-pill"/>}</MotionNavLink>; })}
        <button type="button" className="atlas-mobile-dock__item atlas-mobile-dock__capture" aria-label={pendingOfflineCaptures > 0 ? 'Quick capture, ' + pendingOfflineCaptures + ' queued' : 'Quick capture'} onClick={() => { setCommandOpen(true); setCommandQuery(''); }}><Plus size={20}/><span>Capture</span>{pendingOfflineCaptures > 0 && <small className="atlas-mobile-dock__queue-count">{pendingOfflineCaptures}</small>}</button>
        <button type="button" className="atlas-mobile-dock__item" onClick={() => setMobileOpen(true)} aria-expanded={mobileOpen}><SlidersHorizontal size={18}/><span>More</span></button>
      </nav>
      <footer className="app-footer"><span>AMSTREEM ATLAS</span><span>Make room for what matters.</span></footer>
    </main>
  </div>;
}