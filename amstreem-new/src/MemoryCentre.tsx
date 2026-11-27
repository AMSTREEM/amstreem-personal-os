import { useEffect, useMemo, useState } from 'react';
import { Bookmark, Download, Pencil, Plus, Search, ShieldCheck, Trash2, X, Check } from 'lucide-react';
import {
  createMemory, exportMemories, readMemories, updateMemory, writeMemories,
  type MemoryKind, type MemoryRecord, type MemorySensitivity,
} from './lib/memory';

const kindLabels: Record<MemoryKind, string> = {
  fact: 'Fact', preference: 'Preference', goal: 'Goal',
  project: 'Project', experience: 'Experience', other: 'Other',
};
const kindOptions = Object.keys(kindLabels) as MemoryKind[];

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

  useEffect(() => {
    try { writeMemories(memories); }
    catch { setNotice('Your browser could not save this memory. Check available site storage.'); }
  }, [memories]);

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
        setNotice('Memory updated.');
      } else {
        setMemories(current => [createMemory({ content, kind, sensitivity }), ...current]);
        setNotice('Saved to your memory centre.');
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

  const remove = (id: string) => {
    if (!window.confirm('Delete this memory from this browser? This cannot be undone.')) return;
    setMemories(current => current.filter(memory => memory.id !== id));
    setNotice('Memory deleted from this device.');
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
        <div><strong>Explicit, editable and under your control.</strong><span>These memories currently stay in this browser on this device. They are not connected to an AI model or synced to an account.</span></div>
      </div>

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
        <button className="delete-capture" onClick={() => remove(memory.id)} aria-label="Delete memory"><Trash2 size={15} /></button>
      </article>)}</div> : <div className="empty-world memory-empty"><div className="empty-glyph"><Bookmark size={22} /></div><h3>{memories.length ? 'No memories match that search.' : 'Your memory centre is yours to shape.'}</h3><p>{memories.length ? 'Try a different phrase or type.' : 'Start with a preference, a goal, a useful fact or something you want to keep in view. You decide what belongs here.'}</p>{!memories.length && <button className="begin-button" onClick={() => setFormOpen(true)}>Add your first memory <Plus size={15} /></button>}</div>}

      {notice && <div className="memory-notice" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss message"><X size={13} /></button></div>}
    </section>
  );
}
