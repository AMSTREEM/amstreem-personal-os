import { useState } from 'react';
import { Clock3, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../lib/supabase';

type Revision = { id: string; content: string; memory_type: string; changed_at: string };

export default function MemoryHistory({ memoryId }: { memoryId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [error, setError] = useState('');

  const toggle = async () => {
    if (open) { setOpen(false); return; }
    setOpen(true);
    if (loaded || !supabase) return;
    setLoading(true);
    setError('');
    const { data, error: queryError } = await supabase
      .from('memory_revisions')
      .select('id, content, memory_type, changed_at')
      .eq('memory_id', memoryId)
      .order('changed_at', { ascending: false });
    if (queryError) setError('History could not be loaded. Please try again.');
    else { setRevisions((data || []) as Revision[]); setLoaded(true); }
    setLoading(false);
  };

  return (
    <div className="memory-history">
      <button className="memory-history-toggle" onClick={() => void toggle()} aria-expanded={open}>
        <Clock3 size={13} /> Previous versions {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>
      {open && (
        <div className="memory-history-list">
          {loading ? <p>Loading previous versions…</p>
            : error ? <p>{error}</p>
            : revisions.length ? revisions.map(revision => (
              <article className="memory-revision" key={revision.id}>
                <span>{new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(revision.changed_at))} · BEFORE EDIT</span>
                <p>{revision.content}</p>
                <small>Category: {revision.memory_type}</small>
              </article>
            )) : <p>This memory has no earlier versions yet. Future edits will appear here.</p>}
        </div>
      )}
    </div>
  );
}
