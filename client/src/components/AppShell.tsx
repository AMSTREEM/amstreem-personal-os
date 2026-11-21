import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useCallback, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Compass, GraduationCap, Heart, House, LogOut, Menu, MoonStar, Settings, ShieldCheck, Target, Timer, X } from 'lucide-react';
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

export function AppShell() {
  const { user, role, signOut, session, completeOnboarding } = useAuth();
  const queryClient = useQueryClient();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
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
  const location = useLocation();
  const settings = useQuery({ queryKey: ['settings'], queryFn: () => api<Record<string, string>>('/settings') });
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
        <NavLink to="/settings" className={({ isActive }) => 'nav-link nav-link--settings ' + (isActive ? 'nav-link--active' : '')} onClick={() => setMobileOpen(false)}><Settings size={17} /><span>Settings</span></NavLink>
        {role === 'admin' && <NavLink to="/admin" className={({ isActive }) => 'nav-link nav-link--settings ' + (isActive ? 'nav-link--active' : '')} onClick={() => setMobileOpen(false)}><ShieldCheck size={17} /><span>Administration</span></NavLink>}
        <div className="profile-menu">
          <button className="profile-trigger" onClick={() => setProfileOpen(v => !v)}><span className="avatar">{(user?.name || user?.username || 'A').slice(0,1).toUpperCase()}</span><span className="profile-copy"><b>{user?.name || 'Your workspace'}</b><small>{user?.username ? '@' + user.username : user?.email}</small></span><span>⌄</span></button>
          {profileOpen && <div className="profile-popover"><button onClick={() => void signOut()}><LogOut size={15} /> Sign out</button></div>}
        </div>
      </div>
    </aside>
    <main className="main-area">
      <header className="topbar">
        <button className="mobile-menu-button" onClick={() => setMobileOpen(v => !v)} aria-label={mobileOpen ? 'Close menu' : 'Open menu'}>{mobileOpen ? <X /> : <Menu />}</button>
        <div className="topbar-context"><span>AMSTREEM ATLAS</span><b>{current?.label || (location.pathname === '/reviews' ? 'Deen & Reflection' : location.pathname === '/library' ? 'Learning Studio' : 'Settings')}</b></div>
        <div className="topbar-right"><button className="tour-launcher" type="button" onClick={() => setTourOpen(true)}><Compass size={14} /> Guided tour</button><span className="privacy-indicator"><span /> PRIVATE BY DESIGN</span><span className="topbar-date">{new Intl.DateTimeFormat(undefined,{weekday:'short',month:'short',day:'numeric'}).format(new Date())}</span></div>
      </header>
      <div className="page-container">
        {activeTabs.length > 0 && <nav className="module-subnav" aria-label="Module sections">{activeTabs.map(tab => <NavLink key={tab.to} to={tab.to} onClick={() => setMobileOpen(false)} className={({ isActive }) => 'module-subnav__link ' + (isActive ? 'module-subnav__link--active' : '')}>{tab.label}</NavLink>)}</nav>}
        <Outlet />
      </div>
      <footer className="app-footer"><span>AMSTREEM ATLAS</span><span>Make room for what matters.</span></footer>
    </main>
  </div>;
}