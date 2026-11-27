import { useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { Bookmark, Download, Pencil, Plus, Search, ShieldCheck, Trash2, X, Check, Cloud, CloudOff, LogOut, LockKeyhole } from 'lucide-react';
import {
  createMemory, exportMemories, readMemories, updateMemory, writeMemories,
  type MemoryKind, type MemoryRecord, type MemorySensitivity,
} from './lib/memory';
import { isSupabaseConfigured, supabase } from './lib/supabase';

const kindLabels: Record<MemoryKind, string> = {
  fact: 'Fact', preference: 'Preference', goal: 'Goal',
  project: 'Project', experience: 'Experience', other: 'Other',
};
const kindOptions = Object.keys(kindLabels) as MemoryKind[];

type CloudMemoryRow = {
  id: string;
  content: string;
  memory_type: MemoryKind;
  sensitivity: MemorySensitivity;
  source: MemoryRecord['source'];
  consented_at: string | null;
  created_at: string;
  updated_at: string;
};

const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

function fromCloud(row: CloudMemoryRow): MemoryRecord {
  return {
    id: row.id, content: row.content, kind: row.memory_type,
    sensitivity: row.sensitivity, source: row.source,
    consentedAt: row.consented_at, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

export default function MemoryCentre() {
  const [memories, setMemories] = useState<MemoryRecord[]>(() => readMemories());
  const [query, setQuery] = useState('');
  const [kindFilter, setKindFilter] = useState<MemoryKind | 'all'>('all');
  const [content, setContent] = useState('');
  const [kind, setKind] = useState<MemoryKind>('fact');
  const [sensitivity, setSensitivity] = useState<MemorySensitivity>('ordinary');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncConsent, setSyncConsent] = useState(false);
  const [lastSync, setLastSync] = useState('');

  useEffect(() => {
    try { writeMemories(memories); }
    catch { setNotice('Your browser could not save this memory. Check available site storage.'); }
  }, [memories]);

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!alive) return;
      if (error) setNotice(error.message);
      setUser(data.session?.user ?? null);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setSyncConsent(false);
      setLastSync('');
    });
    return () => { alive = false; listener.subscription.unsubscribe(); };
  }, []);

  const visible = useMemo(() => memories.filter(memory =>
    (kindFilter === 'all' || memory.kind === kindFilter) &&
    memory.content.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
  ), [memories, query, kindFilter]);

  const resetForm = () => {
    setContent(''); setKind('fact'); setSensitivity('ordinary');
    setEditingId(null); setFormOpen(false);
  };

  const save = () => {
    if (!content.trim()) return;
    try {
      if (editingId) {
        setMemories(current => updateMemory(current, editingId, { content, kind, sensitivity }));
        setNotice('Memory updated on this device. Use Sync now to update your account copy.');
      } else {
        setMemories(current => [createMemory({ content, kind, sensitivity }), ...current]);
        setNotice('Saved to your memory centre on this device.');
      }
      resetForm();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not save this memory.');
    }
  };

  const edit = (memory: MemoryRecord) => {
    setEditingId(memory.id); setContent(memory.content);
    setKind(memory.kind); setSensitivity(memory.sensitivity); setFormOpen(true);
  };

  const remove = async (id: string) => {
    if (!window.confirm('Delete this memory? If it has been synced, its account copy will also be deleted. This cannot be undone.')) return;
    if (user && supabase) {
      const { error } = await supabase.from('memories').delete().eq('id', id);
      if (error) {
        setNotice(`Could not delete the account copy: ${error.message}`);
        return;
      }
    }
    setMemories(current => current.filter(memory => memory.id !== id));
    setNotice(user ? 'Memory deleted from this device and your account.' : 'Memory deleted from this device.');
  };

  const authenticate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || !email.trim() || !password) return;
    setAuthBusy(true); setNotice('');
    try {
      if (authMode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: window.location.origin } });
        if (error) throw error;
        setNotice(data.session
          ? 'Your account is ready. You are signed in.'
          : 'Account request received. Check your email for a confirmation link before signing in.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        setNotice('You are signed in. Your local memories have not been uploaded.');
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Authentication could not be completed.');
    } finally {
      setAuthBusy(false);
    }
  };

  const signOut = async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    setNotice(error ? error.message : 'You have signed out. Your local memories remain on this device.');
  };

  const syncNow = async () => {
    if (!supabase || !user || !syncConsent || syncBusy) return;
    setSyncBusy(true); setNotice('');
    try {
      const { data: cloudRows, error: readError } = await supabase
        .from('memories')
        .select('id,content,memory_type,sensitivity,source,consented_at,created_at,updated_at')
        .order('updated_at', { ascending: false });
      if (readError) throw readError;

      const merged = new Map<string, MemoryRecord>();
      (cloudRows as CloudMemoryRow[] | null ?? []).forEach(row => {
        const memory = fromCloud(row);
        merged.set(memory.id, memory);
      });

      const localForUpload = memories.map(memory => isUuid(memory.id)
        ? memory
        : { ...memory, id: crypto.randomUUID() });
      localForUpload.forEach(local => {
        const cloud = merged.get(local.id);
        if (!cloud || new Date(local.updatedAt).getTime() >= new Date(cloud.updatedAt).getTime()) {
          merged.set(local.id, local);
        }
      });

      const finalRecords = [...merged.values()].sort((a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
      if (finalRecords.length) {
        const rows = finalRecords.map(memory => ({
          id: memory.id,
          user_id: user.id,
          content: memory.content,
          memory_type: memory.kind,
          sensitivity: memory.sensitivity,
          source: memory.source,
          consented_at: memory.consentedAt,
          created_at: memory.createdAt,
          updated_at: memory.updatedAt,
        }));
        const { error: writeError } = await supabase.from('memories').upsert(rows, { onConflict: 'id' });
        if (writeError) throw writeError;
      }
      setMemories(finalRecords);
      setLastSync(new Date().toLocaleString());
      setNotice(`Sync complete. ${finalRecords.length} memories are available to this account.`);
    } catch (error) {
      setNotice(error instanceof Error
        ? `Sync did not complete: ${error.message}`
        : 'Sync did not complete. Your local memories are unchanged.');
    } finally {
      setSyncBusy(false);
    }
  };

  const timestamp = (value: string) => new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium', timeStyle: 'short',
  }).format(new Date(value));

  return (
    <section className="memory-centre">
      <div className="memory-centre-heading">
        <div>
          <span className="kicker">YOUR MEMORY, YOUR CHOICE</span>
          <h2>A place for what matters.</h2>
          <p>Keep details you want Amstreem to be able to use in the future. Nothing is added without you choosing to save it.</p>
        </div>
        <button className="outline-button" onClick={() => { resetForm(); setFormOpen(true); }}><Plus size={16} /> Add a memory</button>
      </div>

      <div className="memory-promise">
        <ShieldCheck size={18} />
        <div><strong>Explicit, editable and under your control.</strong><span>Signing in never uploads memories by itself. You choose when to sync, and you can review what is stored here before doing so.</span></div>
      </div>

      <section className="memory-account" aria-label="Account and cloud sync">
        {!isSupabaseConfigured || !supabase ? (
          <div className="memory-account-state"><CloudOff size={18} /><div><strong>Cloud account is not configured yet.</strong><span>Your local memory centre still works. Cloud sync will be available after the site receives its public Supabase configuration.</span></div></div>
        ) : user ? (
          <>
            <div className="memory-account-state"><Cloud size={18} /><div><strong>Signed in</strong><span>{user.email ?? 'Your Amstreem account'} · Local memories are not automatically uploaded.</span></div><button className="outline-button" onClick={signOut}><LogOut size={14} /> Sign out</button></div>
            <div className="memory-sync-panel">
              <label className="memory-consent"><input type="checkbox" checked={syncConsent} onChange={event => setSyncConsent(event.target.checked)} /><span>I choose to sync all {memories.length} memories in this browser, including entries marked sensitive, to my private account. I understand they will be stored in Supabase and available when I sign in on another device.</span></label>
              <div className="memory-sync-actions"><span>{lastSync ? `Last synced: ${lastSync}` : 'Manual sync only · No background upload'}</span><button className="begin-button" disabled={!syncConsent || syncBusy} onClick={syncNow}>{syncBusy ? 'Syncing…' : 'Sync now'} <Cloud size={15} /></button></div>
            </div>
          </>
        ) : (
          <div className="memory-auth">
            <div className="memory-auth-intro"><LockKeyhole size={18} /><div><strong>Your private Amstreem account</strong><span>Sign in to access cloud memory on other devices. Signing in does not upload anything.</span></div></div>
            <form onSubmit={authenticate} className="memory-auth-form">
              <label>Email<input type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" /></label>
              <label>Password<input type="password" autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'} minLength={8} required value={password} onChange={event => setPassword(event.target.value)} placeholder="At least 8 characters" /></label>
              <button className="begin-button" type="submit" disabled={authBusy}>{authBusy ? 'Please wait…' : authMode === 'signup' ? 'Create account' : 'Sign in'} <Check size={15} /></button>
            </form>
            <button className="memory-auth-switch" onClick={() => { setAuthMode(current => current === 'signin' ? 'signup' : 'signin'); setNotice(''); }}>{authMode === 'signin' ? 'New to Amstreem? Create an account' : 'Already have an account? Sign in'}</button>
          </div>
        )}
      </section>

      {formOpen && <div className="memory-editor">
        <div className="memory-editor-top"><span className="kicker">{editingId ? 'EDIT MEMORY' : 'ADD A MEMORY'}</span><button className="memory-close" onClick={resetForm} aria-label="Close editor"><X size={17} /></button></div>
        <textarea autoFocus rows={4} maxLength={8000} value={content} onChange={event => setContent(event.target.value)} placeholder="Write something you explicitly want to remember…" />
        <div className="memory-fields">
          <label>Type<select value={kind} onChange={event => setKind(event.target.value as MemoryKind)}>{kindOptions.map(option => <option key={option} value={option}>{kindLabels[option]}</option>)}</select></label>
          <label>Privacy<select value={sensitivity} onChange={event => setSensitivity(event.target.value as MemorySensitivity)}><option value="ordinary">Ordinary</option><option value="sensitive">Sensitive</option></select></label>
          <span>{content.length.toLocaleString()} / 8,000</span>
        </div>
        <div className="memory-editor-bottom"><span>Choose only information you are comfortable keeping in this browser.</span><button onClick={save} disabled={!content.trim()}>{editingId ? 'Save changes' : 'Save memory'} <Check size={15} /></button></div>
      </div>}

      <div className="memory-toolbar">
        <div className="memory-search"><Search size={16} /><input aria-label="Search memories" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search your memories…" /><span>{visible.length} / {memories.length}</span></div>
        <select aria-label="Filter memories by type" value={kindFilter} onChange={event => setKindFilter(event.target.value as MemoryKind | 'all')}><option value="all">All types</option>{kindOptions.map(option => <option key={option} value={option}>{kindLabels[option]}</option>)}</select>
        <button className="outline-button" disabled={!memories.length} onClick={() => exportMemories(memories)}><Download size={15} /> Export</button>
      </div>

      {visible.length ? <div className="memory-record-list">{visible.map(memory => <article className="memory-record" key={memory.id}>
        <div className="memory-record-icon"><Bookmark size={16} /></div>
        <div className="memory-record-content"><div className="memory-record-meta"><span>{kindLabels[memory.kind]}</span>{memory.sensitivity === 'sensitive' && <span className="sensitive-label">Sensitive</span>}<time>{timestamp(memory.updatedAt)}</time></div><p>{memory.content}</p><small>Saved by you · {memory.source === 'user_created' ? 'Original entry' : memory.source}</small></div>
        <button className="delete-capture" onClick={() => edit(memory)} aria-label="Edit memory"><Pencil size={15} /></button>
        <button className="delete-capture" onClick={() => void remove(memory.id)} aria-label="Delete memory"><Trash2 size={15} /></button>
      </article>)}</div> : <div className="empty-world memory-empty"><div className="empty-glyph"><Bookmark size={22} /></div><h3>{memories.length ? 'No memories match that search.' : 'Your memory centre is yours to shape.'}</h3><p>{memories.length ? 'Try a different phrase or type.' : 'Start with a preference, a goal, a useful fact or something you want to keep in view. You decide what belongs here.'}</p>{!memories.length && <button className="begin-button" onClick={() => setFormOpen(true)}>Add your first memory <Plus size={15} /></button>}</div>}

      {notice && <div className="memory-notice" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss message"><X size={13} /></button></div>}
    </section>
  );
}
