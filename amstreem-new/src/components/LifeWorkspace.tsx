import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowUpRight, CalendarDays, Check, Circle, Flag, Folder, Goal, ListTodo, LoaderCircle, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

type Kind = 'goal' | 'project' | 'task';
type Status = 'active' | 'completed' | 'archived';
type Priority = 'low' | 'normal' | 'high';
type LifeItem = {
  id: string;
  user_id: string;
  parent_id: string | null;
  kind: Kind;
  title: string;
  description: string;
  status: Status;
  priority: Priority;
  due_date: string | null;
  created_at: string;
};

const kindLabel: Record<Kind, string> = { goal: 'Goal', project: 'Project', task: 'Task' };

export default function LifeWorkspace({ userId }: { userId: string }) {
  const [items, setItems] = useState<LifeItem[]>([]);
  const [filter, setFilter] = useState<'all' | Kind>('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [kind, setKind] = useState<Kind>('goal');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [parentId, setParentId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<Priority>('normal');

  const load = async () => {
    if (!supabase) return;
    setLoading(true);
    const { data, error: queryError } = await supabase.from('life_items').select('*').order('created_at', { ascending: false });
    if (queryError) setError('Your items could not be loaded. ' + queryError.message);
    else { setItems((data || []) as LifeItem[]); setError(''); }
    setLoading(false);
  };

  useEffect(() => { void load(); }, [userId]);

  const availableParents = useMemo(() => {
    if (kind === 'project') return items.filter(item => item.kind === 'goal' && item.status !== 'archived');
    if (kind === 'task') return items.filter(item => (item.kind === 'goal' || item.kind === 'project') && item.status !== 'archived');
    return [];
  }, [items, kind]);

  const openForm = (nextKind: Kind) => {
    setKind(nextKind); setParentId(''); setTitle(''); setDescription(''); setDueDate('');
    setPriority('normal'); setShowForm(true);
  };

  const createItem = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase || !title.trim()) return;
    setSaving(true); setError('');
    const { error: insertError } = await supabase.from('life_items').insert({
      user_id: userId,
      kind,
      title: title.trim(),
      description: description.trim(),
      parent_id: parentId || null,
      due_date: dueDate || null,
      priority,
    });
    setSaving(false);
    if (insertError) { setError('Could not save this item. ' + insertError.message); return; }
    setShowForm(false);
    await load();
  };

  const changeStatus = async (item: LifeItem) => {
    if (!supabase) return;
    const status: Status = item.status === 'completed' ? 'active' : 'completed';
    const { error: updateError } = await supabase.from('life_items').update({ status }).eq('id', item.id);
    if (updateError) { setError('Could not update this item. ' + updateError.message); return; }
    setItems(current => current.map(row => row.id === item.id ? { ...row, status } : row));
  };

  const removeItem = async (item: LifeItem) => {
    if (!supabase || !window.confirm(`Delete this ${item.kind.toLowerCase()}? Any items inside it will also be deleted.`)) return;
    const { error: deleteError } = await supabase.from('life_items').delete().eq('id', item.id);
    if (deleteError) { setError('Could not delete this item. ' + deleteError.message); return; }
    await load();
  };

  const activeItems = items.filter(item => item.status !== 'archived');
  const visibleItems = activeItems.filter(item => filter === 'all' || item.kind === filter);
  const goals = activeItems.filter(item => item.kind === 'goal');
  const projects = activeItems.filter(item => item.kind === 'project');
  const tasks = activeItems.filter(item => item.kind === 'task');
  const completed = items.filter(item => item.status === 'completed').length;
  const dateLabel = (date: string | null) => date ? new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(date + 'T12:00:00')) : '';

  const itemIcon = (item: LifeItem) => item.kind === 'goal' ? <Goal size={17} /> : item.kind === 'project' ? <Folder size={17} /> : <ListTodo size={17} />;
  const renderItem = (item: LifeItem) => {
    const parent = item.parent_id ? items.find(row => row.id === item.parent_id) : null;
    const children = items.filter(row => row.parent_id === item.id && row.status !== 'archived');
    const doneChildren = children.filter(row => row.status === 'completed').length;
    return (
      <article className={`life-item life-${item.kind} ${item.status === 'completed' ? 'is-complete' : ''}`} key={item.id}>
        <button className="life-complete" onClick={() => void changeStatus(item)} aria-label={item.status === 'completed' ? 'Reopen item' : 'Mark complete'}>
          {item.status === 'completed' ? <Check size={15} /> : <Circle size={16} />}
        </button>
        <div className="life-item-main">
          <div className="life-item-meta"><span className={`life-kind kind-${item.kind}`}>{itemIcon(item)} {kindLabel[item.kind]}</span>{parent && <span className="life-parent">IN {parent.title}</span>}</div>
          <h3>{item.title}</h3>
          {item.description && <p>{item.description}</p>}
          <div className="life-item-foot">
            {item.due_date && <span><CalendarDays size={12} /> {dateLabel(item.due_date)}</span>}
            {item.kind === 'task' && <span className={`priority priority-${item.priority}`}><Flag size={11} /> {item.priority} priority</span>}
            {children.length > 0 && <span>{doneChildren}/{children.length} complete</span>}
          </div>
        </div>
        <button className="life-delete" onClick={() => void removeItem(item)} aria-label={`Delete ${item.title}`}><Trash2 size={14} /></button>
      </article>
    );
  };

  return (
    <section className="life-workspace">
      <div className="life-overview">
        <div><span className="kicker">YOUR DIRECTION, MADE PRACTICAL</span><h2>What are you moving toward?</h2><p>Connect the bigger things you care about to the projects and next steps that move them forward.</p></div>
        <div className="life-stats"><div><strong>{goals.length}</strong><span>GOALS</span></div><div><strong>{projects.length}</strong><span>PROJECTS</span></div><div><strong>{tasks.length}</strong><span>TASKS</span></div><div><strong>{completed}</strong><span>COMPLETED</span></div></div>
      </div>
      <div className="life-toolbar">
        <div className="life-filters">
          {(['all', 'goal', 'project', 'task'] as const).map(value => <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{value === 'all' ? 'Everything' : kindLabel[value] + 's'}</button>)}
        </div>
        <div className="life-add-actions"><button onClick={() => openForm('goal')}><Plus size={14} /> Goal</button><button onClick={() => openForm('project')}><Plus size={14} /> Project</button><button onClick={() => openForm('task')}><Plus size={14} /> Task</button></div>
      </div>
      {error && <div className="life-error" role="alert">{error}</div>}
      {loading ? <div className="life-empty"><LoaderCircle size={18} /> Bringing your plans together…</div> : visibleItems.length ? (
        <div className="life-list">{visibleItems.sort((a,b) => {
          const order: Record<Kind, number> = { goal: 0, project: 1, task: 2 };
          return order[a.kind] - order[b.kind] || (a.status === 'completed' ? 1 : -1);
        }).map(renderItem)}</div>
      ) : (
        <div className="life-empty"><div className="life-empty-icon"><Flag size={20} /></div><h3>{filter === 'all' ? 'Start with something that matters.' : `No ${filter}s yet.`}</h3><p>A goal gives you direction. A project gives it shape. A task gives you a next step. They can connect as your plans become clearer.</p><button onClick={() => openForm(filter === 'all' ? 'goal' : filter)}><Plus size={15} /> Create your first {filter === 'all' ? 'goal' : filter}</button></div>
      )}
      {showForm && <div className="life-form-layer" onMouseDown={event => { if (event.target === event.currentTarget) setShowForm(false); }}><form className="life-form" onSubmit={createItem}>
        <button type="button" className="life-form-close" onClick={() => setShowForm(false)}>×</button>
        <span className="kicker">ADD TO YOUR WORLD</span><h2>New <em>{kindLabel[kind].toLowerCase()}.</em></h2>
        <label>What is it called?<input value={title} onChange={event => setTitle(event.target.value)} maxLength={160} required placeholder={kind === 'goal' ? 'e.g. Build a healthier routine' : kind === 'project' ? 'e.g. Launch my portfolio' : 'e.g. Draft the first version'} /></label>
        <label>Anything worth adding?<textarea value={description} onChange={event => setDescription(event.target.value)} rows={3} maxLength={4000} placeholder="A little context, if useful…" /></label>
        {kind !== 'goal' && <label>Connect it to{kind === 'project' ? ' a goal' : ' a goal or project'}<select value={parentId} onChange={event => setParentId(event.target.value)}><option value="">Keep it independent for now</option>{availableParents.map(parent => <option key={parent.id} value={parent.id}>{kindLabel[parent.kind]} · {parent.title}</option>)}</select></label>}
        <div className="life-form-row"><label>Due date<input type="date" value={dueDate} onChange={event => setDueDate(event.target.value)} /></label>{kind === 'task' && <label>Priority<select value={priority} onChange={event => setPriority(event.target.value as Priority)}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option></select></label>}</div>
        <button className="life-save" type="submit" disabled={!title.trim() || saving}>{saving ? 'Saving…' : `Create ${kindLabel[kind].toLowerCase()}`} <ArrowUpRight size={15} /></button>
      </form></div>}
      <div className="life-note">YOUR PLAN CAN CHANGE. NOTHING HERE IS A PERMANENT COMMITMENT.</div>
    </section>
  );
}
