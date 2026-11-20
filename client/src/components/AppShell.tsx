import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { CalendarDays, CheckSquare, Compass, GraduationCap, Heart, House, Library, Lightbulb, LogOut, Menu, MoonStar, Settings, ShieldCheck, Target, Timer, X } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { AtlasWalkthrough } from './AtlasWalkthrough';

const navigation = [
  { label: 'Today', to: '/today', icon: House, group: 'SPACE' },
  { label: 'Goals', to: '/goals', icon: Target, group: 'PLAN' },
  { label: 'Projects', to: '/projects', icon: Compass, group: 'PLAN' },
  { label: 'Tasks', to: '/tasks', icon: CheckSquare, group: 'PLAN' },
  { label: 'Calendar', to: '/calendar', icon: CalendarDays, group: 'PLAN' , feature: 'calendar' },
  { label: 'Focus', to: '/focus', icon: Timer, group: 'PRACTICE' , feature: 'focus' },
  { label: 'Rituals', to: '/rituals', icon: Compass, group: 'PRACTICE' , feature: 'rituals' },
  { label: 'Self-control', to: '/self-control', icon: Heart, group: 'PRACTICE' , feature: 'selfcontrol' },
  { label: 'Learning', to: '/learning', icon: GraduationCap, group: 'PRACTICE' , feature: 'learning' },
  { label: 'Library', to: '/library', icon: Library, group: 'KNOWLEDGE' , feature: 'library' },
  { label: 'Values', to: '/values', icon: MoonStar, group: 'PERSONAL' , feature: 'values' },
  { label: 'Reviews', to: '/reviews', icon: CalendarDays, group: 'REFLECT' },
  { label: 'Insights', to: '/insights', icon: Lightbulb, group: 'REFLECT' }
];

export function AppShell() {
  const { user, role, signOut, session, completeOnboarding } = useAuth();
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
    if (!session?.user.id) return;
    localStorage.setItem(`atlas-tour-complete:${session.user.id}`, 'true');
    void completeOnboarding().catch(error => console.error('Could not save Atlas onboarding completion:', error));
  }, [session?.user.id, completeOnboarding]);
  const location = useLocation();
  const settings = useQuery({ queryKey: ['settings'], queryFn: () => api<Record<string, string>>('/settings') });
  useEffect(() => { document.documentElement.dataset.theme = settings.data?.theme || 'shadowed-alchemist'; }, [settings.data?.theme]);
  const storedFeatures = settings.data?.features;
  let enabledFeatures: string[] | null = null;
  if (storedFeatures) { try { enabledFeatures = JSON.parse(storedFeatures); } catch { enabledFeatures = null; } }
  const visibleModules = enabledFeatures === null ? navigation : navigation.filter(item => !('feature' in item) || enabledFeatures!.includes(item.feature as string));
  const visibleNavigation = role === 'admin' ? [...visibleModules, { label: 'Admin', to: '/admin', icon: ShieldCheck, group: 'OWNER' }] : visibleModules;
  const current = visibleNavigation.find(item => item.to === location.pathname);
  const groups = [...new Set(visibleNavigation.map(item => item.group))];

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
            return <NavLink key={item.to} to={item.to} onClick={() => setMobileOpen(false)} className={({ isActive }) => 'nav-link ' + (isActive ? 'nav-link--active' : '')}><Icon size={17} strokeWidth={1.8} /><span>{item.label}</span></NavLink>;
          })}
        </div>)}
      </nav>
      <div className="sidebar-bottom">
        <NavLink to="/settings" className={({ isActive }) => 'nav-link nav-link--settings ' + (isActive ? 'nav-link--active' : '')} onClick={() => setMobileOpen(false)}><Settings size={17} /><span>Settings</span></NavLink>
        <div className="profile-menu">
          <button className="profile-trigger" onClick={() => setProfileOpen(v => !v)}><span className="avatar">{(user?.name || user?.username || 'A').slice(0,1).toUpperCase()}</span><span className="profile-copy"><b>{user?.name || 'Your workspace'}</b><small>{user?.username ? '@' + user.username : user?.email}</small></span><span>⌄</span></button>
          {profileOpen && <div className="profile-popover"><button onClick={() => void signOut()}><LogOut size={15} /> Sign out</button></div>}
        </div>
      </div>
    </aside>
    <main className="main-area">
      <header className="topbar">
        <button className="mobile-menu-button" onClick={() => setMobileOpen(v => !v)} aria-label={mobileOpen ? 'Close menu' : 'Open menu'}>{mobileOpen ? <X /> : <Menu />}</button>
        <div className="topbar-context"><span>AMSTREEM ATLAS</span><b>{current?.label || 'Settings'}</b></div>
        <div className="topbar-right"><button className="tour-launcher" type="button" onClick={() => setTourOpen(true)}><Compass size={14} /> Guided tour</button><span className="privacy-indicator"><span /> PRIVATE BY DESIGN</span><span className="topbar-date">{new Intl.DateTimeFormat(undefined,{weekday:'short',month:'short',day:'numeric'}).format(new Date())}</span></div>
      </header>
      <div className="page-container"><Outlet /></div>
      <footer className="app-footer"><span>AMSTREEM ATLAS</span><span>Make room for what matters.</span></footer>
    </main>
  </div>;
}