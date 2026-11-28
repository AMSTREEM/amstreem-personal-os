import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Link2, Plus, Unlink } from 'lucide-react';
import { supabase } from '../lib/supabase';

type Memory = { id: string; content: string; memory_type: string };
type LifeItem = { id: string; title: string; kind: 'goal' | 'project' | 'task'; status: string };
type LinkRow = { id: string; memory_id: string; life_item_id: string };

const kindName = (kind: LifeItem['kind']) => kind === 'goal' ? 'Goal' : kind === 'project' ? 'Project' : 'Task';

export default function ContextConnections({ userId }: { userId: string }) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [items, setItems] = useState<LifeItem[]>([]);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [memoryId, setMemoryId] = useState('');
  const [itemId, setItemId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const load = async () => {
    if (!supabase) return;
    setLoading(true);
    const [memoryResult, itemResult, linkResult] = await Promise.all([
      supabase.from('memories').select('id,content,memory_type').order('updated_at', { ascending: false }),
      supabase.from('life_items').select('id,title,kind,status').neq('status', 'archived').order('created_at', { ascending: false }),
      supabase.from('memory_links').select('id,memory_id,life_item_id').order('created_at', { ascending: false }),
    ]);
    if (memoryResult.error || itemResult.error || linkResult.error) {
      setMessage('Connections could not be loaded. Please refresh and try again.');
    } else {
      setMemories((memoryResult.data || []) as Memory[]);
      setItems((itemResult.data || []) as LifeItem[]);
      setLinks((linkResult.data || []) as LinkRow[]);
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, [userId]);

  const availableItems = useMemo(() => items.filter(item => !links.some(link => link.memory_id === memoryId && link.life_item_id === item.id)), [items, links, memoryId]);
  const connect = async () => {
    if (!supabase || !memoryId || !itemId) return;
    setSaving(true); setMessage('');
    const { error } = await supabase.from('memory_links').insert({ user_id: userId, memory_id: memoryId, life_item_id: itemId });
    setSaving(false);
    if (error) { setMessage(error.message.includes('duplicate') ? 'Those two are already connected.' : 'Could not create that connection. Please try again.'); return; }
    setMemoryId(''); setItemId('');
    await load();
    setMessage('Connection saved. You can remove it any time.');
  };

  const disconnect = async (id: string) => {
    if (!supabase) return;
    const { error } = await supabase.from('memory_links').delete().eq('id', id);
    if (error) { setMessage('Could not remove that connection.'); return; }
    setLinks(current => current.filter(link => link.id !== id));
    setMessage('Connection removed.');
  };

  const connected = links.map(link => ({
    ...link,
    memory: memories.find(memory => memory.id === link.memory_id),
    item: items.find(item => item.id === link.life_item_id),
  })).filter(link => link.memory && link.item);

  return (
    <section className="context-connections">
      <div className="connections-heading">
        <div><span className="kicker"><Link2 size={12} /> CONTEXT THAT CONNECTS TO ACTION</span><h2>Bring what matters into what you're doing.</h2><p>Connect a thought or ambition you've saved to a goal, project or task. Amstreem won't create these links without you.</p></div>
        <span className="connections-count">{connected.length} {connected.length === 1 ? 'connection' : 'connections'}</span>
      </div>
      {loading ? <div className="connections-empty">Loading your context…</div> : (
        <>
          <div className="connection-create">
            <label>YOUR SAVED CONTEXT<select value={memoryId} onChange={event => { setMemoryId(event.target.value); setItemId(''); }}><option value="">Choose a memory…</option>{memories.map(memory => <option key={memory.id} value={memory.id}>{memory.content.length > 90 ? memory.content.slice(0, 90) + '…' : memory.content}</option>)}</select></label>
            <ArrowUpRight size={16} className="connection-arrow" />
            <label>WHAT IT RELATES TO<select value={itemId} onChange={event => setItemId(event.target.value)} disabled={!memoryId}><option value="">Choose a goal or project…</option>{availableItems.map(item => <option key={item.id} value={item.id}>{kindName(item.kind)} · {item.title}</option>)}</select></label>
            <button className="connection-add" onClick={() => void connect()} disabled={!memoryId || !itemId || saving}><Plus size={14} /> {saving ? 'Connecting…' : 'Connect'}</button>
          </div>
          {message && <p className="connection-message" role="status">{message}</p>}
          {connected.length ? <div className="connection-list">{connected.map(link => <article className="connection-item" key={link.id}><div className="connection-memory"><span>YOU SHARED</span><p>{link.memory!.content}</p></div><ArrowUpRight size={15} className="connection-arrow" /><div className="connection-target"><span>{kindName(link.item!.kind).toUpperCase()}</span><strong>{link.item!.title}</strong></div><button className="connection-remove" onClick={() => void disconnect(link.id)} aria-label="Remove connection"><Unlink size={14} /></button></article>)}</div> : <div className="connections-empty">{memories.length === 0 ? 'Save a thought in My world first.' : items.length === 0 ? 'Create a goal, project or task first.' : 'Your saved context and plans are ready to be connected.'}</div>}
        </>
      )}
      <div className="connections-foot">YOU CHOOSE WHAT CONNECTS. YOU CAN UNLINK IT AT ANY TIME.</div>
    </section>
  );
}
