import { useEffect, useState } from 'react';
import { ArrowUpRight, Compass, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';

type ContextRow = {
  id: string;
  content: string;
  memory_type: 'fact' | 'preference' | 'goal' | 'project' | 'experience' | 'other';
  created_at: string;
};

type Props = { onOpen: () => void };

export default function ContextOverview({ onOpen }: Props) {
  const [rows, setRows] = useState<ContextRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!supabase) { setLoading(false); return; }
      const { data, error: queryError } = await supabase
        .from('memories')
        .select('id, content, memory_type, created_at')
        .eq('source', 'user_confirmed')
        .order('created_at', { ascending: true });
      if (!active) return;
      if (queryError) setError(true);
      else setRows((data || []) as ContextRow[]);
      setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, []);

  const latest = (type: ContextRow['memory_type']) => rows.filter(row => row.memory_type === type).slice(-1)[0];
  const goal = latest('goal');
  const focus = latest('fact');
  const project = latest('project');
  const preferences = rows.filter(row => row.memory_type === 'preference');

  return (
    <section className="context-overview">
      <div className="context-overview-head">
        <div>
          <span className="kicker"><Sparkles size={12} /> BUILT FROM WHAT YOU SHARED</span>
          <h2>Your world, in context.</h2>
          <p>Not a profile Amstreem invented. A starting point based on what you chose to tell it.</p>
        </div>
        <button className="context-edit" onClick={onOpen}>Review in Intelligence <ArrowUpRight size={14} /></button>
      </div>
      {loading ? (
        <div className="context-loading">Bringing your context together…</div>
      ) : error ? (
        <div className="context-loading">Your context could not be loaded right now. Your saved answers are not affected.</div>
      ) : rows.length === 0 ? (
        <button className="context-empty" onClick={onOpen}><Compass size={18} /><span>Give Amstreem a little context to begin.</span><ArrowUpRight size={14} /></button>
      ) : (
        <div className="context-grid">
          {goal && <article className="context-item context-primary"><span>WHAT YOU WANT TO MOVE TOWARD</span><p>{goal.content}</p></article>}
          {focus && <article className="context-item"><span>WHAT MATTERS RIGHT NOW</span><p>{focus.content}</p></article>}
          {preferences[0] && <article className="context-item"><span>HOW YOU WANT TO BE SUPPORTED</span><p>{preferences[0].content}</p></article>}
          {preferences[1] && <article className="context-item"><span>WHAT YOU WANT US TO AVOID</span><p>{preferences[1].content}</p></article>}
          {project && <article className="context-item"><span>WHAT YOU'RE BUILDING OR LEARNING</span><p>{project.content}</p></article>}
        </div>
      )}
      <div className="context-foot"><span>YOUR CONTEXT CAN CHANGE AS YOUR LIFE DOES.</span><span>YOU CAN EDIT OR DELETE IT IN MY WORLD.</span></div>
    </section>
  );
}
