import { useEffect, useMemo, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import AuthScreen from './components/AuthScreen';
import IntelligenceScreen from './components/IntelligenceScreen';
import ContextOverview from './components/ContextOverview';
import { isSupabaseConfigured, supabase, type MemoryRow } from './lib/supabase';
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, Atom, Bookmark,
  Check, ChevronDown, CircleHelp, Command, Compass, Feather, Folder,
  Layers3, Menu, Plus, Search, Send, Sparkles, Trash2, X, Download, Pencil
} from 'lucide-react';

type Note = { id: string; text: string; createdAt: number };
type Section = 'Today' | 'Intelligence' | 'My world' | 'Projects' | 'Activity';

const navigation: { label: Section; icon: typeof Compass }[] = [
  { label: 'Today', icon: Compass },
  { label: 'Intelligence', icon: Atom },
  { label: 'My world', icon: Layers3 },
  { label: 'Projects', icon: Folder },
  { label: 'Activity', icon: Activity },
];

const timeLabel = (timestamp: number) => new Intl.DateTimeFormat(undefined, {
  month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
}).format(timestamp);

function Workspace({ user }: { user: User }) {
  const [section, setSection] = useState<Section>('Today');
  const [draft, setDraft] = useState('');
  const [notes, setNotes] = useState<Note[]>([]);
  const [localNotes, setLocalNotes] = useState<Note[]>(() => { 
    try {
      const saved = window.localStorage.getItem('amstreem.captures.v1');
      if (!saved) return [];
      const parsed: unknown = JSON.parse(saved);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((item): item is { id: number; text: string; createdAt: number } =>
        item && typeof item.id === 'number' && typeof item.text === 'string' && typeof item.createdAt === 'number'
      ).map(item => ({ ...item, id: String(item.id) }));
    } catch {
      return [];
    }
  });
  const [captureOpen, setCaptureOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const refreshNotes = async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from('memories').select('*').order('updated_at', { ascending: false });
    if (error) { setNotice('Could not refresh your context: ' + error.message); return; }
    setNotes((data as MemoryRow[]).map(row => ({ id: row.id, text: row.content, createdAt: new Date(row.created_at).getTime() })));
  };
  useEffect(() => {
    let active = true;
    const load = async () => {
      const client = supabase;
      if (!client) return;
      const { data, error } = await client.from('memories').select('*').order('updated_at', { ascending: false });
      if (!active) return;
      if (error) { setNotice('Could not load your cloud memories: ' + error.message); return; }
      setNotes((data as MemoryRow[]).map(row => ({ id: row.id, text: row.content, createdAt: new Date(row.created_at).getTime() })));
    };
    void load();
    return () => { active = false; };
  }, [user.id]);

  const visibleNotes = notes.filter(note => note.text.toLocaleLowerCase().includes(searchQuery.trim().toLocaleLowerCase()));
  const startEditing = (note: Note) => { setEditingId(note.id); setEditDraft(note.text); };
  const saveEdit = async () => {
    const value = editDraft.trim();
    if (!value || editingId === null || !supabase) return;
    const { error } = await supabase.from('memories').update({ content: value }).eq('id', editingId);
    if (error) { setNotice('Could not update this memory: ' + error.message); return; }
    setNotes(current => current.map(note => note.id === editingId ? { ...note, text: value } : note));
    setEditingId(null); setEditDraft(''); setNotice('Your cloud memory was updated.');
    window.setTimeout(() => setNotice(''), 3200);
  };
  const exportNotes = () => {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), captures: notes }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a');
    link.href = url; link.download = 'amstreem-captures.json'; link.click(); URL.revokeObjectURL(url);
  };

  const removeNote = async (id: string) => {
    if (!supabase) return;
    const { error } = await supabase.from('memories').delete().eq('id', id);
    if (error) { setNotice('Could not delete this memory: ' + error.message); return; }
    setNotes(current => current.filter(note => note.id !== id));
    setNotice('Memory deleted from your account.');
    window.setTimeout(() => setNotice(''), 3200);
  };

  const importLocal = async () => {
    if (!supabase || localNotes.length === 0) return;
    const { error } = await supabase.from('memories').insert(localNotes.map(note => ({ user_id: user.id, content: note.text, memory_type: 'other', sensitivity: 'ordinary', source: 'imported' })));
    if (error) { setNotice('Import failed. Your original local captures are still safe: ' + error.message); return; }
    window.localStorage.removeItem('amstreem.captures.v1');
    setLocalNotes([]);
    const { data } = await supabase.from('memories').select('*').order('updated_at', { ascending: false });
    if (data) setNotes((data as MemoryRow[]).map(row => ({ id: row.id, text: row.content, createdAt: new Date(row.created_at).getTime() })));
    setNotice('Your selected local captures are now in your account.');
  };

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    return hour < 12 ? 'Good morning.' : hour < 18 ? 'Good afternoon.' : 'Good evening.';
  }, []);

  const capture = async () => {
    const value = draft.trim();
    if (!value || !supabase) return;
    const { data, error } = await supabase.from('memories').insert({ user_id: user.id, content: value, memory_type: 'other', sensitivity: 'ordinary', source: 'user_created' }).select('*').single();
    if (error) { setNotice('Could not save your memory: ' + error.message); return; }
    const row = data as MemoryRow;
    setNotes(current => [{ id: row.id, text: row.content, createdAt: new Date(row.created_at).getTime() }, ...current]);
    setDraft(''); setCaptureOpen(false); setSection('My world');
    setNotice('Saved securely to your Amstreem account.');
    window.setTimeout(() => setNotice(''), 3200);
  };

  const changeSection = (next: Section) => {
    setSection(next);
    setMenuOpen(false);
  };

  const pageCopy: Record<Section, { eyebrow: string; title: string; description: string }> = {
    Today: { eyebrow: 'YOUR PERSONAL ENVIRONMENT', title: 'A life, in motion.', description: 'A place to find clarity, keep what matters close, and move forward in your own way.' },
    Intelligence: { eyebrow: 'THINKING SPACE', title: 'Bring the unfinished thought.', description: 'A place for questions, decisions, possibilities and the things you are still working out.' },
    'My world': { eyebrow: 'YOUR PERSONAL CONTEXT', title: 'The things that make up your world.', description: 'Thoughts and details you choose to keep in view. Nothing is assumed; it starts with you.' },
    Projects: { eyebrow: 'YOUR WORK IN PROGRESS', title: 'Give an idea somewhere to go.', description: 'A home for the things you want to make, explore or bring to life.' },
    Activity: { eyebrow: 'YOUR AMSTREEM JOURNEY', title: 'A record, not a scorecard.', description: 'A calm view of what you have chosen to capture here.' },
  };

  return (
    <div className="app-shell">
      <aside className={menuOpen ? 'rail rail-open' : 'rail'}>
        <button className="wordmark" onClick={() => changeSection('Today')} aria-label="Amstreem home">
          <span className="wordmark-symbol">a<span>.</span></span>
          <span className="wordmark-name">amstreem</span>
        </button>
        <div className="rail-caption">YOUR ENVIRONMENT</div>
        <nav className="rail-nav" aria-label="Main navigation">
          {navigation.map(({ label, icon: Icon }, index) => (
            <button key={label} className={section === label ? 'rail-link selected' : 'rail-link'} onClick={() => changeSection(label)}>
              <Icon size={17} strokeWidth={1.7} />
              <span>{label}</span>
              {label === 'My world' && notes.length > 0 && <span className="nav-count">{notes.length}</span>}
              {index === 0 && <span className="active-indicator" />}
            </button>
          ))}
        </nav>
        <div className="rail-bottom">
          <div className="rail-note">
            <div className="rail-note-icon"><Sparkles size={15} /></div>
            <p>Built around your life.<br /><strong>Not the other way around.</strong></p>
          </div>
          <div className="profile-row">
            <div className="profile-avatar">{(user.email || 'A').slice(0,1).toUpperCase()}</div>
            <div><strong>{user.email || 'Your space'}</strong><span>Private account</span></div>
            <button className="auth-signout" onClick={() => { void supabase?.auth.signOut(); }}>Sign out</button>
          </div>
        </div>
      </aside>

      {menuOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}

      <main className="main-stage">
        <header className="topline">
          <div className="topline-left">
            <button className="mobile-menu" onClick={() => setMenuOpen(true)} aria-label="Open navigation"><Menu size={19} /></button>
            <span>AMSTREEM</span><span className="crumb-slash">/</span><span className="crumb-current">{section}</span>
          </div>
          <div className="topline-right">
            <div className="environment-status"><i /> EARLY EXPERIENCE</div>
            <button className="help-button" aria-label="Help"><CircleHelp size={17} /></button>
            <div className="top-avatar">A</div>
          </div>
        </header>

        <div className="canvas">
          <section className="intro-block">
            <div className="intro-copy">
              <div className="kicker"><span className="kicker-line" />{pageCopy[section].eyebrow}</div>
              <h1>{section === 'Today' ? <>{greeting}<br /><em>A life, in motion.</em></> : pageCopy[section].title}</h1>
              <p>{pageCopy[section].description}</p>
            </div>
            <div className="date-stamp">
              <span>{new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(new Date())}</span>
              <strong>{new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'long' }).format(new Date())}</strong>
            </div>
          </section>

          {section === 'Today' && (
            <>
              <section className="hero-composition">
                <div className="hero-orbit" aria-hidden="true">
                  <div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="orbit orbit-three" />
                  <div className="orbit-core"><span>a<span>.</span></span></div>
                  <i className="orbit-point point-one" /><i className="orbit-point point-two" /><i className="orbit-point point-three" />
                </div>
                <div className="hero-message">
                  <div className="kicker">START WHERE YOU ARE</div>
                  <h2>What's taking up<br /><em>space in your mind?</em></h2>
                  <p>A thought. A possibility. Something you want to change. You don't need to have it figured out before you begin.</p>
                  <button className="begin-button" onClick={() => setSection('Intelligence')}>Enter your thinking space <ArrowUpRight size={16} /></button>
                </div>
                <div className="hero-index"><span>01</span><i /> A SPACE THAT EVOLVES WITH YOU</div>
              </section>

              <ContextOverview onOpen={() => setSection("Intelligence")} />

              <section className="start-strip">
                <div className="strip-heading"><span className="kicker">MAKE IT YOURS</span><span className="strip-hint">A few ways to begin</span></div>
                <div className="start-grid">
                  <button className="start-card" onClick={() => setSection('Intelligence')}>
                    <span className="start-number">01</span><span className="start-icon icon-amber"><Atom size={18} /></span>
                    <strong>Think something through</strong><span>Bring a question or a decision.</span><ArrowUpRight className="start-arrow" size={16} />
                  </button>
                  <button className="start-card" onClick={() => { setDraft(''); setCaptureOpen(true); }}>
                    <span className="start-number">02</span><span className="start-icon icon-sage"><Bookmark size={18} /></span>
                    <strong>Keep a thought</strong><span>Save something you don't want to lose.</span><ArrowUpRight className="start-arrow" size={16} />
                  </button>
                  <button className="start-card" onClick={() => setSection('Projects')}>
                    <span className="start-number">03</span><span className="start-icon icon-blue"><Layers3 size={18} /></span>
                    <strong>Make an idea real</strong><span>Give something meaningful a place.</span><ArrowUpRight className="start-arrow" size={16} />
                  </button>
                </div>
              </section>

              <section className="closing-line">
                <div className="closing-mark">“</div>
                <p>Your life isn't a dashboard to optimise.<br /><em>It's a story you're still shaping.</em></p>
                <span>THE AMSTREEM PRINCIPLE</span>
              </section>
            </>
          )}

          {section === 'Intelligence' && (
            <IntelligenceScreen userId={user.id} onSaved={refreshNotes} />
          )}

          {section === 'My world' && (
            <section className="collection-area">
              <div className="collection-header"><div><span className="kicker">YOUR CHOSEN CONTEXT</span><h2>{notes.length ? 'Things you chose to keep.' : 'An open space, ready when you are.'}</h2></div><div className="memory-actions">{localNotes.length > 0 && <button className="outline-button" onClick={importLocal}><Download size={15} /> Import {localNotes.length} local captures</button>}{notes.length > 0 && <button className="outline-button" onClick={exportNotes}><Download size={15} /> Export</button>}<button className="outline-button" onClick={() => { setDraft(''); setCaptureOpen(true); }}><Plus size={16} /> Capture a thought</button></div></div>
              {notes.length > 0 && <div className="memory-search"><Search size={16} /><input aria-label="Search captures" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search your captures…" /><span>{visibleNotes.length} / {notes.length}</span></div>}
              {notes.length ? visibleNotes.length ? <div className="thought-list">{visibleNotes.map(note => <article className="thought-item" key={note.id}><div className="thought-glyph"><Feather size={17} /></div><div className="thought-body"><p>{note.text}</p><span>CAPTURED · {timeLabel(note.createdAt)}</span></div><button className="delete-capture" onClick={() => startEditing(note)} aria-label="Edit capture"><Pencil size={15} /></button><button className="delete-capture" onClick={() => removeNote(note.id)} aria-label="Delete capture"><Trash2 size={15} /></button></article>)}</div> : <div className="empty-world compact-empty"><h3>No matching captures.</h3><p>Try another word or clear your search.</p><button className="outline-button" onClick={() => setSearchQuery('')}>Clear search</button></div> : <div className="empty-world"><div className="empty-glyph"><Layers3 size={23} /></div><h3>Your world begins with what matters to you.</h3><p>Save a thought, an idea, a question or a detail you want to keep in view.</p><button className="begin-button" onClick={() => { setDraft(''); setCaptureOpen(true); }}>Capture your first thought <ArrowRight size={15} /></button></div>}
              <p className="local-note">Your memories are stored in your Amstreem account. Only you can access your rows. Local captures are kept separate until you explicitly import them.</p>
            </section>
          )}

          {section === 'Projects' && (
            <section className="workspace-panel project-panel">
              <div className="project-symbol"><Folder size={22} /></div><span className="kicker">A PLACE FOR POSSIBILITY</span>
              <h2>Every meaningful thing<br /><em>starts somewhere.</em></h2>
              <p>Project planning and progress tracking are coming later. For now, capture the idea that you want to give more attention to.</p>
              <button className="begin-button" onClick={() => { setDraft(''); setCaptureOpen(true); }}>Capture an idea <ArrowUpRight size={16} /></button>
            </section>
          )}

          {section === 'Activity' && (
            <section className="collection-area">
              <div className="collection-header"><div><span className="kicker">A QUIET RECORD</span><h2>Your recent captures.</h2></div><span className="activity-count">{notes.length} {notes.length === 1 ? 'entry' : 'entries'}</span></div>
              {notes.length ? <div className="thought-list">{notes.map(note => <article className="thought-item" key={note.id}><div className="thought-glyph"><Activity size={17} /></div><div className="thought-body"><p>{note.text}</p><span>{timeLabel(note.createdAt)}</span></div><button className="delete-capture" onClick={() => removeNote(note.id)} aria-label="Delete capture"><Trash2 size={15} /></button></article>)}</div> : <div className="empty-world"><div className="empty-glyph"><Activity size={23} /></div><h3>Nothing to catch up on.</h3><p>This space will reflect the things you choose to do here. No streaks, scores or pressure.</p></div>}
            </section>
          )}

          <footer className="page-footer"><span>AMSTREEM <i>✳</i> A MORE HUMAN WAY TO MOVE FORWARD</span><span>BUILT TO GROW WITH YOU <i>·</i> 0.2</span></footer>
        </div>
      </main>

      {editingId !== null && <div className="modal-layer" onMouseDown={e => { if (e.target === e.currentTarget) setEditingId(null); }}><section className="capture-modal"><button className="modal-x" onClick={() => setEditingId(null)} aria-label="Close"><X size={18} /></button><div className="modal-symbol"><Pencil size={18} /></div><span className="kicker">EDIT YOUR CAPTURE</span><h2>Keep it <em>accurate.</em></h2><textarea autoFocus rows={5} value={editDraft} onChange={e => setEditDraft(e.target.value)} /><div className="modal-bottom"><span>Changes sync to your Amstreem account.</span><button onClick={saveEdit} disabled={!editDraft.trim()}>Save changes <Check size={15} /></button></div></section></div>}
      {captureOpen && <div className="modal-layer" onMouseDown={e => { if (e.target === e.currentTarget) setCaptureOpen(false); }}>
        <section className="capture-modal">
          <button className="modal-x" onClick={() => setCaptureOpen(false)} aria-label="Close"><X size={18} /></button>
          <div className="modal-symbol"><Feather size={19} /></div>
          <span className="kicker">PERSONAL CAPTURE</span>
          <h2>What do you want<br /><em>to keep close?</em></h2>
          <textarea autoFocus rows={5} value={draft} onChange={e => setDraft(e.target.value)} placeholder="A thought, an idea, something worth remembering…" />
          <div className="modal-bottom"><span>Nothing is saved until you choose.</span><button onClick={capture} disabled={!draft.trim()}>Add to my world <ArrowUpRight size={15} /></button></div>
        </section>
      </div>}
      {notice && <div className="toast"><Check size={15} />{notice}</div>}
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!supabase) { setReady(true); return; }
    void supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => listener.subscription.unsubscribe();
  }, []);

  if (!isSupabaseConfigured || !supabase) return <main className="auth-screen"><section className="auth-card"><div className="auth-brand"><span className="wordmark-symbol">a<span>.</span></span><span className="wordmark-name">amstreem</span></div><h1>Connection <em>needed.</em></h1><p className="auth-copy">The secure account connection is not configured yet. Add the Supabase URL and publishable key to the Render environment to continue.</p></section></main>;
  if (!ready) return <main className="auth-screen"><section className="auth-card"><div className="auth-orb"><Sparkles size={25}/></div><p className="auth-copy">Preparing your private space…</p></section></main>;
  if (!session) return <AuthScreen client={supabase} />;
  return <Workspace user={session.user} />;
}
