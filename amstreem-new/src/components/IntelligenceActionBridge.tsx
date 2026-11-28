import { useEffect, useState } from 'react';
import { ArrowUpRight, ClipboardCheck, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';

type Task = { id: string; title: string; status: 'active' | 'completed' };
type ActionKind = 'complete_task' | 'reopen_task';

export default function IntelligenceActionBridge({ userId }: { userId: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [kind, setKind] = useState<ActionKind>('complete_task');
  const [taskId, setTaskId] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!supabase) { setLoading(false); return; }
      const { data, error } = await supabase.from('life_items')
        .select('id,title,status').eq('kind', 'task').neq('status', 'archived')
        .order('created_at', { ascending: false });
      if (!active) return;
      if (error) setMessage('Your tasks could not be loaded. Please try again.');
      else setTasks((data || []) as Task[]);
      setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, [userId]);

  const eligible = tasks.filter(task => kind === 'complete_task' ? task.status === 'active' : task.status === 'completed');

  const prepare = async () => {
    if (!supabase || !taskId || saving) return;
    const task = eligible.find(item => item.id === taskId);
    if (!task) return;
    setSaving(true);
    setMessage('');
    const explanation = reason.trim() || (kind === 'complete_task'
      ? 'Prepare to mark this task as completed.'
      : 'Prepare to reopen this task.');
    const { error } = await supabase.from('action_log').insert({
      user_id: userId,
      action_type: kind,
      target_id: task.id,
      target_title: task.title,
      explanation: explanation + ' Prepared from the Intelligence workspace.',
      status: 'awaiting_approval',
      permission_mode: 'ask',
    });
    if (error) setMessage('The proposal could not be saved. Your task has not changed.');
    else {
      setTaskId('');
      setReason('');
      setMessage('Proposal saved. Review it in Actions; your task has not changed.');
    }
    setSaving(false);
  };

  return <section className="intelligence-action-bridge">
    <div className="bridge-heading">
      <div className="bridge-icon"><ClipboardCheck size={17} /></div>
      <div><span className="kicker">FROM THINKING TO DOING</span><h3>Turn a decision into a next step.</h3><p>Prepare a task action from here. It will always wait in your approval queue; nothing changes until you approve it in Actions.</p></div>
    </div>
    <div className="action-compose bridge-compose">
      <label>Action<select value={kind} onChange={event => { setKind(event.target.value as ActionKind); setTaskId(''); }}><option value="complete_task">Complete a task</option><option value="reopen_task">Reopen a task</option></select></label>
      <label>Related task<select value={taskId} onChange={event => setTaskId(event.target.value)} disabled={loading}><option value="">{loading ? 'Loading tasks…' : 'Choose a task…'}</option>{eligible.map(task => <option key={task.id} value={task.id}>{task.title}</option>)}</select></label>
      <button disabled={!taskId || saving || loading} onClick={() => void prepare()}>{saving ? 'Preparing…' : 'Prepare proposal'} <ArrowUpRight size={14}/></button>
    </div>
    <label className="bridge-reason">Why does this action make sense? <input value={reason} onChange={event => setReason(event.target.value)} maxLength={240} placeholder="Optional context for your future self" /></label>
    {message && <p className="action-message" role="status">{message}</p>}
    <div className="bridge-safety"><ShieldCheck size={13}/> Always asks for approval, even if task updates are set to Allow.</div>
  </section>;
}
