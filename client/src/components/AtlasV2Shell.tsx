import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity, ArrowUpRight, BookOpen, CheckSquare, Command, House,
  LogOut, Menu, MoonStar, Plus, Search, Settings2, Sparkles, TrendingUp, X
} from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { applyAtlasTheme, type AtlasTheme } from '../design/theme';
import '../design/shell.css';

const rooms = [
  {
    id: 'residence', title: 'Residence', caption: 'Your life, in view', icon: House,
    links: [{ label: 'Overview', to: '/residence' }, { label: 'Life blueprint', to: '/blueprint' }]
  },
  {
    id: 'rhythm', title: 'Daily rhythm', caption: 'Make space for what matters', icon: MoonStar,
    links: [{ label: 'Today', to: '/daily-rhythm' }, { label: 'Values & faith', to: '/values' }, { label: 'Habits', to: '/habits' }]
  },
  {
    id: 'execution', title: 'Execution', caption: 'Turn intention into action', icon: CheckSquare,
    links: [{ label: 'Projects & actions', to: '/actions' }, { label: 'Calendar', to: '/calendar' }]
  },
  {
    id: 'growth', title: 'Growth', caption: 'Learn, reflect, evolve', icon: TrendingUp,
    links: [{ label: 'Goals', to: '/goals' }, { label: 'Learning library', to: '/learning-library' }, { label: 'Reviews & insights', to: '/growth' }]
  }
];

const utilityLinks = [
  { label: 'Qur’an', to: '/quran', icon: BookOpen },
  { label: 'Settings', to: '/settings', icon: Settings2 }
];

const pageNames: Record<string, string> = {
  '/residence': 'Your residence', '/blueprint': 'Life blueprint',
  '/daily-rhythm': 'Daily rhythm', '/values': 'Values & faith',
  '/habits': 'Habits', '/actions': 'Projects & actions',
  '/focus': 'Focus workspace', '/calendar': 'Calendar',
  '/goals': 'Goals', '/learning-library': 'Learning library',
  '/growth': 'Reviews & insights', '/settings': 'Settings', '/admin': 'Administration'
};

function dateLabel() {
  return new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());
}

export function AtlasV2Shell() {
  const { user, role, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const settings = useQuery({ queryKey: ['atlas-v2', 'theme-settings'], queryFn: () => api<Record<string, string>>('/settings') });
  const pageTitle = pageNames[location.pathname] || 'Amstreem Atlas';
  const initials = (user?.name || user?.username || 'A').trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();

  const destinations = useMemo(() => [
    ...rooms.flatMap(room => room.links.map(link => ({ ...link, section: room.title }))),
    ...utilityLinks.map(link => ({ ...link, section: 'Personal' }))
  ].filter(item => (item.label + ' ' + item.section).toLowerCase().includes(commandQuery.toLowerCase())), [commandQuery]);

  useEffect(() => {
    const legacyTheme = settings.data?.theme;
    if (!legacyTheme) return;
    const themeByLegacy: Record<string, AtlasTheme> = {
      'shadowed-alchemist': 'obsidian', 'abyssal-trench': 'obsidian', 'whispering-woods': 'obsidian',
      'nocturnal-amethyst': 'dusk', 'crimson-velvet': 'dusk',
      'light-porcelain': 'ivory', 'light-sage': 'ivory', 'light-lavender': 'ivory',
      'light-sky': 'ivory', 'light-sandstone': 'sahara'
    };
    applyAtlasTheme(themeByLegacy[legacyTheme] || (legacyTheme.startsWith('light-') ? 'ivory' : 'obsidian'));
    localStorage.setItem('atlas_theme', legacyTheme);
  }, [settings.data?.theme]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const editing = !!target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen(value => !value);
        setCommandQuery('');
      } else if (event.key === 'Escape') {
        setCommandOpen(false);
        setMobileMenuOpen(false);
      } else if (!editing && (event.metaKey || event.ctrlKey) && /^[1-4]$/.test(event.key)) {
        navigate(rooms[Number(event.key) - 1].links[0].to);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navigate]);

  useEffect(() => {
    const room = rooms.find(item => item.links.some(link => link.to === location.pathname));
    const root = document.documentElement;
    root.setAttribute('data-room', room?.id === 'execution' ? 'execute' : room?.id || 'none');
    document.title = pageTitle + ' — Amstreem Atlas';
    return () => { root.removeAttribute('data-room'); document.title = 'Amstreem Atlas'; };
  }, [location.pathname, pageTitle]);

  function openDestination(path: string) {
    setCommandOpen(false);
    setMobileMenuOpen(false);
    navigate(path);
  }

  return <div className="atlas-v2 a-shell">
    <div className="a-shell__ambient" aria-hidden="true" />
    <aside className="a-sidebar" aria-label="Main navigation">
      <NavLink to="/residence" className="a-brand" aria-label="Amstreem Atlas home">
        <span className="a-brand__mark"><span /><span /><span /></span>
        <span className="a-brand__word"><strong>AMSTREEM</strong><small>ATLAS / PERSONAL OS</small></span>
      </NavLink>

      <div className="a-sidebar__label">YOUR WORKSPACE</div>
      <nav className="a-nav">
        {rooms.map((room, index) => {
          const Icon = room.icon;
          const active = room.links.some(link => link.to === location.pathname);
          return <section className={'a-nav__room' + (active ? ' is-active' : '')} key={room.id}>
            <NavLink to={room.links[0].to} className="a-nav__room-link">
              <span className="a-nav__icon"><Icon size={17} strokeWidth={1.8} /></span>
              <span className="a-nav__copy"><strong>{room.title}</strong><small>{room.caption}</small></span>
              <kbd>{index + 1}</kbd>
            </NavLink>
            {active && <div className="a-nav__children">
              {room.links.map(link => <NavLink key={link.to} to={link.to} end className={({ isActive }) => 'a-nav__child' + (isActive ? ' is-current' : '')}>{link.label}</NavLink>)}
            </div>}
          </section>;
        })}
      </nav>

      <div className="a-sidebar__label a-sidebar__label--tools">PERSONAL SPACE</div>
      <nav className="a-utility-nav" aria-label="Personal tools">
        {utilityLinks.map(item => {
          const Icon = item.icon;
          return <NavLink key={item.to} to={item.to} className={({ isActive }) => 'a-utility-link' + (isActive ? ' is-current' : '')}><Icon size={17} />{item.label}<ArrowUpRight size={13} /></NavLink>;
        })}
        {role === 'admin' && <NavLink to="/admin" className={({ isActive }) => 'a-utility-link' + (isActive ? ' is-current' : '')}><Activity size={17} />Administration</NavLink>}
      </nav>

      <div className="a-sidebar__bottom">
        <div className="a-private-note"><span className="a-private-note__dot" /><span><strong>Your space, your pace</strong><small>Private by design</small></span></div>
        <div className="a-account">
          <span className="a-account__avatar">{initials}</span>
          <span className="a-account__copy"><strong>{user?.name || user?.username || 'Your account'}</strong><small>{user?.email || 'Personal workspace'}</small></span>
          <button className="a-icon-button a-account__logout" type="button" onClick={() => void signOut()} aria-label="Sign out" title="Sign out"><LogOut size={16} /></button>
        </div>
      </div>
    </aside>

    <div className="a-main">
      <header className="a-topbar">
        <div className="a-topbar__context">
          <span className="a-topbar__mobile-brand">ATLAS</span>
          <span className="a-topbar__breadcrumb">WORKSPACE <span>/</span> {pageTitle.toUpperCase()}</span>
        </div>
        <div className="a-topbar__actions">
          <span className="a-topbar__date">{dateLabel()}</span>
          <button className="a-search-trigger" type="button" onClick={() => { setCommandOpen(true); setCommandQuery(''); }}><Search size={15} /><span>Find anything</span><kbd>⌘ K</kbd></button>
          <button className="a-capture-button" type="button" onClick={() => navigate('/actions')}><Plus size={16} /><span>Actions</span></button>
          <button className="a-icon-button a-mobile-menu-trigger" type="button" onClick={() => setMobileMenuOpen(value => !value)} aria-label="Open navigation">{mobileMenuOpen ? <X size={19} /> : <Menu size={19} />}</button>
        </div>
      </header>

      <main className="a-content" id="main-content">
        <div className="a-content__intro">
          <div><span className="a-content__overline"><Sparkles size={12} /> A SPACE TO MOVE WITH INTENTION</span></div>
          <span className="a-content__date">{dateLabel()}</span>
        </div>
        <div className="a-route-content"><Outlet /></div>
      </main>
      <footer className="a-footer"><span>AMSTREEM ATLAS</span><span>Build a life that feels like yours.</span></footer>
    </div>

    <nav className="a-mobile-bar" aria-label="Quick navigation">
      {rooms.map(room => {
        const Icon = room.icon;
        const active = room.links.some(link => link.to === location.pathname);
        return <NavLink key={room.id} to={room.links[0].to} className={'a-mobile-bar__item' + (active ? ' is-current' : '')}><Icon size={18} /><span>{room.id === 'residence' ? 'Home' : room.id === 'execution' ? 'Do' : room.title.split(' ')[0]}</span></NavLink>;
      })}
      <button type="button" className={'a-mobile-bar__item' + (mobileMenuOpen ? ' is-current' : '')} onClick={() => setMobileMenuOpen(value => !value)}><Menu size={18} /><span>More</span></button>
    </nav>

    {mobileMenuOpen && <div className="a-mobile-drawer-backdrop" onClick={() => setMobileMenuOpen(false)}>
      <section className="a-mobile-drawer" aria-label="More navigation" onClick={event => event.stopPropagation()}>
        <div className="a-mobile-drawer__heading"><strong>Explore Atlas</strong><button type="button" className="a-icon-button" onClick={() => setMobileMenuOpen(false)} aria-label="Close menu"><X size={18} /></button></div>
        {rooms.flatMap(room => room.links.map(link => ({ ...link, section: room.title }))).concat(utilityLinks.map(link => ({ ...link, section: 'Personal space' }))).map(item => <button key={item.to} type="button" className="a-mobile-drawer__link" onClick={() => openDestination(item.to)}><span>{item.label}</span><ArrowUpRight size={15} /></button>)}
        <button type="button" className="a-mobile-drawer__signout" onClick={() => void signOut()}><LogOut size={15} /> Sign out</button>
      </section>
    </div>}

    {commandOpen && <div className="a-command-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setCommandOpen(false); }}>
      <section className="a-command" role="dialog" aria-modal="true" aria-label="Search Atlas">
        <div className="a-command__search"><Search size={18} /><input autoFocus value={commandQuery} onChange={event => setCommandQuery(event.target.value)} placeholder="Where would you like to go?" /><kbd>ESC</kbd></div>
        <div className="a-command__list">
          <span className="a-command__label">DESTINATIONS</span>
          {destinations.length ? destinations.map(item => <button key={item.to} type="button" onClick={() => openDestination(item.to)}><span><small>{item.section}</small><strong>{item.label}</strong></span><ArrowUpRight size={15} /></button>) : <p>No matching destinations.</p>}
        </div>
        <div className="a-command__foot"><span><Command size={12} /> Navigate your workspace</span><span>PRIVATE · PERSONAL</span></div>
      </section>
    </div>}
  </div>;
}
