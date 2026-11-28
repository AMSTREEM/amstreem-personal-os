import { useEffect, useState } from 'react';
import { ArrowUpRight, Check, CheckCircle2, Clock3, ShieldCheck, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

type Task = { id: string; title: string; status: 'active' | 'completed' | 'archived' };
type Action = {
  id: string; action_type: 'complete_task' | 'reopen_task'; target_id: string;
  target_title: string; explanation: string;
  status: 'awaiting_approval' | 'approved' | 'completed' | 'failed' | 'cancelled';
  permission_mode: 'ask' | 'allow'; failure_message: string | null;
  created_at: string; completed_at: string | null;
};
type Mode = 'ask' | 'allow';

export default function ActionCenter({ userId }: { userId: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [mode, setMode] = useState<Mode>('ask');
  const [selectedTask, setSelectedTask] = useState('');
  const [kind, setKind] = useState<'complete_task' | 'reopen_task'>('complete_task');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const load = async () => {
    if (!supabase) return;
    setLoading(true);
    const [taskResult, actionResult, permissionResult] = await Promise.all([
      supabase.from('life_items').select('id,title,status').eq('kind','task').neq('status','archived').order('created_at',{ascending:false}),
      supabase.from('action_log').select('*').order('created_at',{ascending:false}).limit(40),
      supabase.from('action_permissions').select('mode').eq('category','task_updates').maybeSingle(),
    ]);
    if (taskResult.error || actionResult.error || permissionResult.error) {
      setMessage('Some action data could not be loaded. ' + (taskResult.error || actionResult.error || permissionResult.error)?.message);
    } else {
      setTasks((taskResult.data || []) as Task[]);
      setActions((actionResult.data || []) as Action[]);
      setMode((permissionResult.data?.mode as Mode) || 'ask');
      setMessage('');
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, [userId]);

  const execute = async (action: Action) => {
    if (!supabase) return;
    const nextStatus = action.action_type === 'complete_task' ? 'completed' : 'active';
    const { error: taskError } = await supabase.from('life_items').update({ status: nextStatus }).eq('id', action.target_id).eq('kind','task');
    if (taskError) {
      await supabase.from('action_log').update({ status: 'failed', failure_message: taskError.message, updated_at: new Date().toISOString() }).eq('id', action.id);
      setMessage('The action did not complete. Your task was not confirmed as changed.');
      await load();
      return;
    }
    const now = new Date().toISOString();
    const { error: logError } = await supabase.from('action_log').update({ status: 'completed', completed_at: now, updated_at: now, failure_message: null }).eq('id', action.id);
    if (logError) setMessage('The task changed, but its action history could not be updated. Please refresh the Action Centre.');
    else setMessage('Action completed and recorded.');
    await load();
  };

  const propose = async () => {
    if (!supabase || !selectedTask) return;
    const task = tasks.find(item => item.id === selectedTask);
    if (!task) return;
    setBusy(true); setMessage('');
    const actionType = kind;
    const approved = mode === 'allow';
    const now = new Date().toISOString();
    const { data, error } = await supabase.from('action_log').insert({
      user_id: userId,
      action_type: actionType,
      target_id: task.id,
      target_title: task.title,
      explanation: actionType === 'complete_task' ? 'Mark the selected task as completed.' : 'Reopen the selected task and return it to active work.',
      status: approved ? 'approved' : 'awaiting_approval',
      permission_mode: mode,
      approved_at: approved ? now : null,
    }).select('*').single();
    if (error) { setMessage('Could not create this action. ' + error.message); setBusy(false); return; }
    setSelectedTask('');
    if (approved) await execute(data as Action);
    else { setMessage('Action added to your approval queue. Nothing has changed yet.'); await load(); }
    setBusy(false);
  };

  const approve = async (action: Action) => {
    if (!supabase) return;
    setBusy(true);
    const now = new Date().toISOString();
    const { error } = await supabase.from('action_log').update({ status: 'approved', approved_at: now, updated_at: now }).eq('id', action.id).eq('status','awaiting_approval');
    if (error) setMessage('Could not approve this action. ' + error.message);
    else await execute({ ...action, status: 'approved' });
    setBusy(false);
  };

  const cancel = async (action: Action) => {
    if (!supabase) return;
    const now = new Date().toISOString();
    const { error } = await supabase.from('action_log').update({ status: 'cancelled', updated_at: now }).eq('id', action.id).eq('status','awaiting_approval');
    if (error) setMessage('Could not cancel this action. ' + error.message);
    else { setMessage('Action cancelled. Your task was left unchanged.'); await load(); }
  };

  const changeMode = async (next: Mode) => {
    if (!supabase) return;
    setBusy(true);
    const { error } = await supabase.from('action_permissions').upsert({
      user_id: userId, category: 'task_updates', mode: next, updated_at: new Date().toISOString()
    }, { onConflict: 'user_id,category' });
    if (error) setMessage('Could not save this permission. ' + error.message);
    else { setMode(next); setMessage(next === 'ask' ? 'Amstreem will ask before every task update.' : 'Task updates in this category may now run without individual approval.'); }
    setBusy(false);
  };

  const pending = actions.filter(action => action.status === 'awaiting_approval');
  const history = actions.filter(action => action.status !== 'awaiting_approval');
  const formatDate = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

  return <section className="action-center">
    <div className="action-intro">
      <div><span className="kicker">CONTROLLED INITIATIVE</span><h2>Useful action, <em>on your terms.</em></h2><p>Amstreem can prepare actions for your review. You decide what it may do, and every completed action is recorded here.</p></div>
      <div className="action-shield"><ShieldCheck size={23}/></div>
    </div>
    <div className="action-permission">
      <div><span className="kicker">TASK UPDATE PERMISSION</span><h3>{mode === 'ask' ? 'Ask before each action' : 'Allow task updates'}</h3><p>{mode === 'ask' ? 'Recommended. Every task change waits for your approval.' : 'Actions in this category can be carried out immediately when proposed.'}</p></div>
      <div className="action-mode-buttons"><button className={mode === 'ask' ? 'selected' : ''} disabled={busy} onClick={() => void changeMode('ask')}>Ask first</button><button className={mode === 'allow' ? 'selected' : ''} disabled={busy} onClick={() => void changeMode('allow')}>Allow</button></div>
    </div>
    <div className="action-proposer">
      <div><span className="kicker">PREPARE AN ACTION</span><h3>Make a task change.</h3></div>
      <div className="action-compose">
        <label>Action<select value={kind} onChange={e => setKind(e.target.value as typeof kind)}><option value="complete_task">Complete a task</option><option value="reopen_task">Reopen a task</option></select></label>
        <label>Task<select value={selectedTask} onChange={e => setSelectedTask(e.target.value)}><option value="">Choose a task…</option>{tasks.filter(task => kind === 'complete_task' ? task.status === 'active' : task.status === 'completed').map(task => <option key={task.id} value={task.id}>{task.title}</option>)}</select></label>
        <button disabled={!selectedTask || busy} onClick={() => void propose()}>{busy ? 'Working…' : mode === 'ask' ? 'Request approval' : 'Run action'} <ArrowUpRight size={14}/></button>
      </div>
      <p className="action-footnote">This first release only supports changes to tasks inside your Amstreem account. It does not send messages, make purchases, or access external services.</p>
    </div>
    <div className="action-section-heading"><div><span className="kicker">WAITING FOR YOU</span><h3>Approval queue</h3></div><span>{pending.length} PENDING</span></div>
    {loading ? <div className="action-empty">Loading your action history…</div> : pending.length ? <div className="action-list">{pending.map(action => <article className="action-row" key={action.id}><div className="action-row-icon"><Clock3 size={16}/></div><div className="action-row-copy"><strong>{action.action_type === 'complete_task' ? 'Complete task' : 'Reopen task'} · {action.target_title}</strong><p>{action.explanation}</p><span>REQUESTED · {formatDate(action.created_at)}</span></div><div className="action-row-buttons"><button disabled={busy} onClick={() => void approve(action)}><Check size={13}/> Approve & run</button><button disabled={busy} onClick={() => void cancel(action)} aria-label="Cancel action"><X size={14}/></button></div></article>)}</div> : <div className="action-empty">No actions are waiting for approval.</div>}
    <div className="action-section-heading"><div><span className="kicker">A TRANSPARENT RECORD</span><h3>Action history</h3></div><span>{history.length} RECENT</span></div>
    {history.length ? <div className="action-list">{history.map(action => <article className="action-row" key={action.id}><div className="action-row-icon">{action.status === 'completed' ? <CheckCircle2 size={16}/> : action.status === 'failed' ? <X size={16}/> : <Clock3 size={16}/>}</div><div className="action-row-copy"><strong>{action.action_type === 'complete_task' ? 'Complete task' : 'Reopen task'} · {action.target_title}</strong><p>{action.status.replace(/_/g,' ')}{action.failure_message ? ' · ' + action.failure_message : ''}</p><span>{formatDate(action.created_at)}{action.completed_at ? ' · COMPLETED ' + formatDate(action.completed_at) : ''}</span></div><span className={'action-status status-' + action.status}>{action.status.replace(/_/g,' ')}</span></article>)}</div> : <div className="action-empty">Completed and cancelled actions will appear here.</div>}
    {message && <p className="action-message" role="status">{message}</p>}
    <p className="action-privacy-note">Permissions apply only to this account and this action category. External or consequential actions will require their own separate controls.</p>
  </section>;
}
