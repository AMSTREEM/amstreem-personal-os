import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BarChart3, Bell, Layers3, MessageSquare, Users } from 'lucide-react';
import { api, json } from '../lib/api';
import { Button, Card, EmptyState, Field, PageHeader, TextArea, TextInput } from '../components/ui';

type Analytics = { activeToday: number; activeWeek: number; activeMonth: number; loginsToday: number; topCurrent: number; bestStreak: number };
type UserRow = { id: string; name: string; username: string; email: string; created_at: string | null; email_confirmed: boolean; thank_you_status: string };
type UserData = { email_configured: boolean; users: UserRow[] };
type Feedback = { id: number | string; type: string; type_label: string; message: string; status: string; created_at: string; user_ref: string };
type Announcement = { id: number; title: string; body: string; kind: string; created_at: string; published_at: string | null };
type AnnouncementFeed = { items: Announcement[]; readIds: number[] };

const tabs = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'users', label: 'Accounts', icon: Users },
  { id: 'sections', label: 'Sections', icon: Layers3 },
  { id: 'feedback', label: 'Feedback', icon: MessageSquare },
  { id: 'announcements', label: 'Announcements', icon: Bell }
] as const;

export function AdminPage() {
  const navigate = useNavigate();
  const client = useQueryClient();
  const [tab, setTab] = useState<(typeof tabs)[number]['id']>('overview');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [kind, setKind] = useState('update');
  const analytics = useQuery({ queryKey: ['admin-analytics'], queryFn: () => api<Analytics>('/admin/analytics'), enabled: tab === 'overview' });
  const users = useQuery({ queryKey: ['admin-users'], queryFn: () => api<UserData>('/admin/users'), enabled: tab === 'users' });
  const feedback = useQuery({ queryKey: ['admin-feedback'], queryFn: () => api<Feedback[]>('/admin/feedback'), enabled: tab === 'feedback' });
  const announcements = useQuery({ queryKey: ['announcements'], queryFn: () => api<AnnouncementFeed>('/announcements'), enabled: tab === 'announcements' });
  const publish = useMutation({
    mutationFn: () => api('/announcements', json('POST', { title, body, kind })),
    onSuccess: () => { setTitle(''); setBody(''); void client.invalidateQueries({ queryKey: ['announcements'] }); }
  });
  const updateFeedback = useMutation({
    mutationFn: ({ item, status }: { item: Feedback; status: string }) => api('/admin/feedback/' + item.id, json('PATCH', { status })),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['admin-feedback'] })
  });

  return <div className="stack">
    <PageHeader eyebrow="OWNER / WORKSPACE OPERATIONS" title="Administration" description="Account operations, feedback and product communications. This area is restricted to the workspace owner." />
    <div className="admin-tabs">{tabs.map(item => { const Icon = item.icon; return <button key={item.id} className={tab === item.id ? 'admin-tab admin-tab--active' : 'admin-tab'} onClick={() => setTab(item.id)}><Icon size={15} /> {item.label}</button>; })}</div>
    {tab === 'overview' ? <Card><div className="card-heading"><div><h2>Workspace activity</h2><p>Aggregate account activity from saved workspace records.</p></div></div>{analytics.isLoading ? <p className="muted">Loading analytics…</p> : analytics.isError ? <p className="inline-error">{analytics.error.message}</p> : analytics.data ? <div className="stat-grid stat-grid--three"><div className="stat-card"><div className="stat-card__top">ACTIVE TODAY</div><strong>{analytics.data.activeToday}</strong><small>Accounts with a login record</small></div><div className="stat-card"><div className="stat-card__top">ACTIVE THIS WEEK</div><strong>{analytics.data.activeWeek}</strong><small>Last 7 days</small></div><div className="stat-card"><div className="stat-card__top">ACTIVE THIS MONTH</div><strong>{analytics.data.activeMonth}</strong><small>Last 30 days</small></div><div className="stat-card"><div className="stat-card__top">LOGINS TODAY</div><strong>{analytics.data.loginsToday}</strong><small>Recorded accounts</small></div><div className="stat-card"><div className="stat-card__top">TOP CURRENT STREAK</div><strong>{analytics.data.topCurrent}</strong><small>Days</small></div><div className="stat-card"><div className="stat-card__top">BEST STREAK</div><strong>{analytics.data.bestStreak}</strong><small>Days</small></div></div> : <EmptyState title="No activity summary yet." detail="Aggregate activity will appear when the server-side admin connection is configured." />}</Card> : null}
    {tab === 'sections' ? <div className="stack">
      <Card><div className="card-heading"><div><h2>All product sections</h2><p>Admin access bypasses personal workspace visibility preferences. Open any area directly to inspect it.</p></div></div><div className="admin-section-grid">
        {[{name:'Residence',detail:'Daily command centre and shutdown',to:'/residence'},{name:'Faith / Deen',detail:'Tradition-specific daily practice',to:'/values'},{name:'Habits & Self-Control',detail:'Routines, commitments and recovery',to:'/habits'},{name:'Projects & Tasks',detail:'Unified execution workspace and focus dock',to:'/execution'},{name:'Calendar',detail:'Scheduled commitments and date activity',to:'/calendar'},{name:'Goals & Milestones',detail:'Long-term outcomes and linked evidence',to:'/goals'},{name:'Learning & Library',detail:'Learning paths, lessons and saved resources',to:'/learning-library'},{name:'Reviews & Insights',detail:'Daily and weekly reflection with evidence',to:'/reviews-insights'},{name:'Settings',detail:'Workspace preferences',to:'/settings'}].map(item=><button type="button" className="admin-section-link" key={item.to} onClick={()=>navigate(item.to)}><span><b>{item.name}</b><small>{item.detail}</small></span><span aria-hidden="true">↗</span></button>)}
      </div></Card>
      <Card><div className="card-heading"><div><h2>Faith experience testing</h2><p>Switch between all three Daily Rhythm experiences without changing your personal faith settings.</p></div></div><div className="admin-faith-grid">
        {[{name:'Deen & Reflection',tradition:'islam',detail:'Islamic daily practice, salah, Qur’an and reflection'},{name:'Faith & Devotion',tradition:'christianity',detail:'Prayer rhythm, intercession, Bible and devotion'},{name:'Clarity & Reflection',tradition:'general',detail:'Daily intention, wisdom notes and evening reflection'}].map(item=><button type="button" className="admin-faith-option" key={item.tradition} onClick={()=>navigate('/values?tradition='+item.tradition)}><b>{item.name}</b><small>{item.detail}</small><span>Open experience <span aria-hidden="true">→</span></span></button>)}
      </div></Card>
    </div> : null}
    {tab === 'users' ? <Card><div className="card-heading"><div><h2>Account directory</h2><p>Private account records visible only to the owner.</p></div></div>{users.isLoading ? <p className="muted">Loading accounts…</p> : users.isError ? <p className="inline-error">{users.error.message}</p> : users.data ? <><p className="field__hint">{users.data.users.length} accounts · Thank-you email {users.data.email_configured ? 'configured' : 'not configured'}</p><div className="list-stack">{users.data.users.map(user => <div className="list-row" key={user.id}><span className="avatar">{(user.name || user.username || 'U').slice(0,1).toUpperCase()}</span><div className="list-row__body"><b>{user.name || user.username || 'Unnamed account'}</b><small>{user.email}{user.username ? ' · @' + user.username : ''}</small></div><span className="list-row__meta">{user.email_confirmed ? 'Confirmed' : 'Unconfirmed'}</span></div>)}</div></> : <EmptyState title="Account directory unavailable." detail="The server-side admin connection is not configured." />}</Card> : null}
    {tab === 'feedback' ? <Card><div className="card-heading"><div><h2>Feedback inbox</h2><p>Review suggestions, bugs and account feedback.</p></div></div>{feedback.isLoading ? <p className="muted">Loading feedback…</p> : feedback.isError ? <p className="inline-error">{feedback.error.message}</p> : feedback.data?.length ? <div className="list-stack">{feedback.data.map(item => <div className="feedback-row" key={String(item.id)}><div className="feedback-row__top"><span className="status-pill">{item.type_label}</span><span className="list-row__meta">{new Date(item.created_at).toLocaleDateString()}</span></div><p>{item.message}</p><div className="feedback-row__bottom"><span className="list-row__meta">Account {item.user_ref}</span><select className="status-select" value={item.status === 'legacy' ? 'new' : item.status} onChange={event => updateFeedback.mutate({ item, status: event.target.value })} disabled={String(item.id).startsWith('legacy')}><option value="new">New</option><option value="in_review">In review</option><option value="resolved">Resolved</option></select></div></div>)}</div> : <EmptyState title="Inbox is clear." detail="New feedback will appear here." />}</Card> : null}
    {tab === 'announcements' ? <div className="stack"><Card><div className="card-heading"><div><h2>Publish an update</h2><p>Share a product note or important notice with all accounts.</p></div></div><form className="form-stack" onSubmit={event => { event.preventDefault(); if (title.trim() && body.trim()) publish.mutate(); }}><Field label="Title"><TextInput value={title} onChange={event => setTitle(event.target.value)} maxLength={120} placeholder="A short, clear headline" required /></Field><Field label="Type"><select className="field-input" value={kind} onChange={event => setKind(event.target.value)}><option value="update">Update</option><option value="feature">New feature</option><option value="maintenance">Maintenance</option><option value="important">Important</option></select></Field><Field label="Message"><TextArea value={body} onChange={event => setBody(event.target.value)} maxLength={5000} placeholder="Write the announcement…" required /></Field><div><Button type="submit" disabled={publish.isPending || !title.trim() || !body.trim()}>{publish.isPending ? 'Publishing…' : 'Publish announcement'}</Button></div></form>{publish.isError && <p className="inline-error">{publish.error.message}</p>}</Card><Card><div className="card-heading"><div><h2>Published announcements</h2><p>Updates currently visible to users.</p></div></div>{announcements.data?.items.length ? <div className="list-stack">{announcements.data.items.map(item => <div className="list-row" key={item.id}><span className="session-mark"><Bell size={15} /></span><div className="list-row__body"><b>{item.title}</b><small>{item.kind} · {new Date(item.published_at || item.created_at).toLocaleDateString()}</small></div></div>)}</div> : <EmptyState title="No announcements yet." detail="Published updates will appear here." />}</Card></div> : null}
  </div>;
}