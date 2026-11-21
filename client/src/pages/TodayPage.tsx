import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, BookOpen, Flame, MoonStar, Plus, Target, Timer, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, json } from '../lib/api';
import { Card, EmptyState, PageHeader } from '../components/ui';

type Task = { id: number; title: string; detail: string; due_date: string | null; done: number; goal_title?: string | null; project_title?: string | null };
type Habit = { id: number; title: string; emoji: string; done: number; goal_title?: string | null };
type Overview = { today: string; todayMin: number; weekMin: number; completed: number; moduleTotal: number; streak: number; dailyTarget: number; openTasks: number };
type Settings = Record<string, string>;
type Prayer = { prayer: string; completed: number; on_time: number };
type Deen = { date: string; prayers: Prayer[]; quran: { activity: string; pages: number; entries: number }[]; tahajjud: { woke_up: number; prayed: number } };
type Faith = { activity: string; completed: number };
type Goal = { id: number; title: string; target_date: string | null; status: string };
type Announcement = { id: number; title: string; body: string; kind: string; created_at: string; published_at: string | null };
type AnnouncementFeed = { items: Announcement[]; readIds: number[] };
type CalendarSummary = { streaks: Record<string, { current: number; best: number }> };
type SelfControlSummary = { summary: { id: number; name: string; symbol: string; streak: number; longest_days: number; last_slip: string | null }[] };
type Insight = { recommendation: { title: string; detail: string; reason: string; action: string; destination: string; priority: string }; pattern: string; rhythm: string | null };
type StoredTimer = { remaining: number; deadline: number | null; taskId?: string; lessonId?: string; projectId?: string };
const TIMER_KEY = 'atlas-focus-timer-v1';
const faithPractices = ['bible', 'prayer', 'reflection', 'worship', 'service'];

function todayKey() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  return parts.find(item => item.type === 'year')!.value + '-' + parts.find(item => item.type === 'month')!.value + '-' + parts.find(item => item.type === 'day')!.value;
}
function readTimer(): StoredTimer {
  try {
    const value = JSON.parse(localStorage.getItem(TIMER_KEY) || 'null') as StoredTimer | null;
    if (value && Number.isFinite(value.remaining) && (value.deadline === null || Number.isFinite(value.deadline))) return value;
  } catch { /* A malformed local timer should not break Residence. */ }
  return { remaining: 25 * 60, deadline: null };
}
function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? hours + 'h ' + rest + 'm' : rest + 'm';
}

export function TodayPage() {
  const client = useQueryClient();
  const today = todayKey();
  const [quickTask, setQuickTask] = useState('');
  const [timer, setTimer] = useState<StoredTimer>(readTimer);
  const [now, setNow] = useState(() => Date.now());
  const settings = useQuery({ queryKey: ['settings'], queryFn: () => api<Settings>('/settings') });
  const religion = settings.data?.religion || 'none';
  let showCalendar = true;
  if (settings.data?.features) { try { showCalendar = JSON.parse(settings.data.features).includes('calendar'); } catch { showCalendar = true; } }
  const overview = useQuery({ queryKey: ['overview'], queryFn: () => api<Overview>('/overview') });
  const tasks = useQuery({ queryKey: ['tasks'], queryFn: () => api<Task[]>('/tasks') });
  const habits = useQuery({ queryKey: ['habits', today], queryFn: () => api<Habit[]>('/habits?date=' + today) });
  const deen = useQuery({ queryKey: ['deen', today], queryFn: () => api<Deen>('/deen/summary?date=' + today), enabled: religion === 'islam' });
  const faith = useQuery({ queryKey: ['faith', today], queryFn: () => api<Faith[]>('/faith?date=' + today), enabled: religion === 'christianity' });
  const learning = useQuery({ queryKey: ['learning-paths'], queryFn: () => api<{ id: number; title: string; lessons: { id: number; title: string }[] }[]>('/learning/paths'), enabled: !!timer.lessonId });
  const goals = useQuery({ queryKey: ['goals'], queryFn: () => api<Goal[]>('/goals') });
  const calendarSummary = useQuery({ queryKey: ['calendar-summary', today.slice(0, 7)], queryFn: () => api<CalendarSummary>('/calendar?month=' + today.slice(0, 7)) });
  const selfControl = useQuery({ queryKey: ['self-control', today], queryFn: () => api<SelfControlSummary>('/self-control?date=' + today) });
  const insight = useQuery({ queryKey: ['intelligence'], queryFn: () => api<Insight>('/intelligence') });
  const announcements = useQuery({ queryKey: ['announcements'], queryFn: () => api<AnnouncementFeed>('/announcements') });

  const addTask = useMutation({
    mutationFn: () => api<Task>('/tasks', json('POST', { title: quickTask.trim(), category: 'Personal', due_date: today })),
    onSuccess: () => { setQuickTask(''); void client.invalidateQueries({ queryKey: ['tasks'] }); void client.invalidateQueries({ queryKey: ['overview'] }); }
  });
  const toggleTask = useMutation({
    mutationFn: (task: Task) => api<Task>('/tasks/' + task.id, json('PATCH', { done: !task.done })),
    onSuccess: () => { void client.invalidateQueries({ queryKey: ['tasks'] }); void client.invalidateQueries({ queryKey: ['overview'] }); }
  });
  const toggleHabit = useMutation({
    mutationFn: (habit: Habit) => api('/habits/' + habit.id + '/toggle', json('POST', { date: today })),
    onSuccess: () => { void client.invalidateQueries({ queryKey: ['habits', today] }); void client.invalidateQueries({ queryKey: ['overview'] }); }
  });
  const togglePrayer = useMutation({
    mutationFn: (item: Prayer) => api('/deen/prayer', json('PATCH', { date: today, prayer: item.prayer, completed: !item.completed })),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['deen', today] })
  });
  const toggleFaith = useMutation({
    mutationFn: (item: Faith) => api('/faith', json('PATCH', { date: today, activity: item.activity, completed: !item.completed })),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['faith', today] })
  });
  const markAnnouncementRead = useMutation({ mutationFn: (id: number) => api('/announcements/' + id + '/read', json('POST')), onSuccess: () => void client.invalidateQueries({ queryKey: ['announcements'] }) });

  const habitList = habits.data || [];
  const completedHabits = habitList.filter(habit => habit.done).length;
  const habitStreak = calendarSummary.data?.streaks.habits.current ?? 0;
  const openTasks = (tasks.data || []).filter(task => !task.done).sort((a, b) => {
    if (!a.due_date && !b.due_date) return a.id - b.id;
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return a.due_date.localeCompare(b.due_date) || a.id - b.id;
  });
  const todayTasks = (tasks.data || []).filter(task => task.due_date === today);
  const priorityTasks = [...openTasks.filter(task => task.due_date && task.due_date < today), ...openTasks.filter(task => task.due_date === today), ...openTasks.filter(task => task.due_date && task.due_date > today), ...openTasks.filter(task => !task.due_date)].slice(0, 5);
  const activeGoals = (goals.data || []).filter(goal => goal.status === 'active').sort((a,b) => (a.target_date || '9999').localeCompare(b.target_date || '9999')).slice(0, 3);
  const prayerCount = deen.data?.prayers.filter(item => !!item.completed).length ?? 0;
  const faithCount = faithPractices.filter(activity => !!faith.data?.find(item => item.activity === activity)?.completed).length;
  const quranPages = deen.data?.quran.reduce((sum, item) => sum + item.pages, 0) ?? 0;
  const target = Math.max(1, overview.data?.dailyTarget || 80);
  const focusPercent = Math.min(100, Math.round((overview.data?.todayMin || 0) / target * 100));
  const remaining = timer.deadline === null ? timer.remaining : Math.max(0, Math.ceil((timer.deadline - now) / 1000));
  const focusRunning = timer.deadline !== null && remaining > 0;
  const timerText = String(Math.floor(remaining / 60)).padStart(2, '0') + ':' + String(remaining % 60).padStart(2, '0');
  const activeTask = timer.taskId ? tasks.data?.find(task => String(task.id) === timer.taskId) : null;
  const activeLesson = timer.lessonId ? learning.data?.flatMap(path => path.lessons.map(lesson => ({ ...lesson, pathTitle: path.title }))).find(lesson => String(lesson.id) === timer.lessonId) : null;
  const activeFocusContext = activeTask ? 'Task · ' + activeTask.title : activeLesson ? 'Learning · ' + activeLesson.pathTitle + ' / ' + activeLesson.title : 'Unlinked focus session';

  useEffect(() => {
    if (!focusRunning) return;
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, [focusRunning]);
  useEffect(() => {
    if (timer.deadline !== null && remaining === 0) {
      const completed = { ...timer, remaining: 0, deadline: null };
      setTimer(completed);
      localStorage.setItem(TIMER_KEY, JSON.stringify(completed));
    }
  }, [timer.deadline, remaining]);

  const scoreDimensions = useMemo(() => {
    const values: { label: string; score: number; detail: string }[] = [];
    if (religion === 'islam' && deen.data) values.push({ label: 'Deen', score: prayerCount / 5 * 100, detail: prayerCount + '/5 prayers' });
    if (religion === 'christianity' && faith.data) values.push({ label: 'Faith', score: faith.data.length ? faithCount / faith.data.length * 100 : 0, detail: faithCount + '/' + faith.data.length + ' practices' });
    if (habitList.length) values.push({ label: 'Habits', score: completedHabits / habitList.length * 100, detail: completedHabits + '/' + habitList.length + ' today' });
    if (overview.data && ((overview.data.todayMin || 0) > 0 || (overview.data.weekMin || 0) > 0)) values.push({ label: 'Focus', score: focusPercent, detail: formatMinutes(overview.data.todayMin) + ' / ' + formatMinutes(target) });
    if (todayTasks.length) values.push({ label: 'Tasks', score: todayTasks.filter(task => !!task.done).length / todayTasks.length * 100, detail: todayTasks.filter(task => !!task.done).length + '/' + todayTasks.length + ' due today' });
    return values;
  }, [religion, deen.data, prayerCount, faith.data, faithCount, habitList.length, completedHabits, overview.data, focusPercent, target, todayTasks]);
  const consistency = scoreDimensions.length ? Math.round(scoreDimensions.reduce((sum, item) => sum + item.score, 0) / scoreDimensions.length) : null;
  const nextDestination = insight.data?.recommendation.destination === 'habit' ? '/rituals' : '/' + (insight.data?.recommendation.destination || 'tasks');

  return <div className="stack today-dashboard">
    <PageHeader eyebrow={new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date()).toUpperCase()} title="Residence" description="Your central view of today’s priorities, routines, focus and progress." action={showCalendar ? <Link className="button button--secondary" to="/calendar">View calendar <ArrowRight size={14} /></Link> : undefined} />

    <section className="residence-pulse" aria-label="Your daily consistency pulse">
      <div className="residence-pulse__main">
        <div className="residence-pulse__heading"><span className="eyebrow">TODAY'S CONSISTENCY PULSE</span><span className="residence-pulse__date">{today}</span></div>
        <div className="residence-pulse__score">{consistency === null ? '—' : consistency + '%'}<span>{consistency === null ? 'Build your first signal' : 'across ' + scoreDimensions.length + ' active areas'}</span></div>
        <div className="residence-pulse__track"><span style={{ width: (consistency ?? 0) + '%' }} /></div>
        <p>{consistency === null ? 'Choose a habit, set a focus intention, or add a priority to begin. Your score only reflects areas you actively use.' : 'A useful snapshot, not a judgement. Your score is calculated from the records below and never fills in missing activity.'}</p>
      </div>
      <div className="residence-pulse__dimensions">
        {scoreDimensions.length ? scoreDimensions.map(item => <div className="residence-dimension" key={item.label}><span>{item.label}</span><b>{Math.round(item.score)}%</b><small>{item.detail}</small><i><span style={{ width: Math.max(0, Math.min(100, item.score)) + '%' }} /></i></div>) : <div className="residence-dimension residence-dimension--empty"><span>YOUR DAILY RHYTHM</span><b>Start small</b><small>Activity appears here as you use Atlas.</small></div>}
      </div>
    </section>

    <div className="residence-stat-grid">
      <Card className="residence-stat"><span className="eyebrow">FOCUS TODAY</span><strong>{formatMinutes(overview.data?.todayMin ?? 0)}</strong><small>{focusPercent}% of your {target}m intention</small></Card>
      <Card className="residence-stat"><span className="eyebrow">OPEN PRIORITIES</span><strong>{openTasks.length}</strong><small>{todayTasks.filter(task => !task.done).length} due today</small></Card>
      <Card className="residence-stat"><span className="eyebrow">HABITS COMPLETED</span><strong>{completedHabits}<small> / {habitList.length}</small></strong><small>Today's chosen habits</small></Card>
      <Card className="residence-stat"><span className="eyebrow">HABIT STREAK</span><strong><Flame size={18}/>{habitStreak}</strong><small>Consecutive days with habit activity</small></Card>
    </div>

    <div className="residence-grid">
      <section className="residence-main-column">
        {religion === 'islam' ? <Card className="residence-faith-card">
          <div className="residence-section-heading"><div><span className="eyebrow">DEEN & REFLECTION</span><h2>Today's Salah</h2><p>{prayerCount} of 5 prayers recorded</p></div><Link to="/values" className="text-link">Open Deen <ArrowRight size={13}/></Link></div>
          <div className="residence-prayer-list">{(deen.data?.prayers || []).map(item => <label className={'residence-prayer ' + (item.completed ? 'is-complete' : '')} key={item.prayer}><input type="checkbox" checked={!!item.completed} onChange={() => togglePrayer.mutate(item)} /><span>{item.prayer}</span><small>{item.completed ? 'Recorded' : 'Not recorded'}</small></label>)}</div>
          <div className="residence-faith-footer"><BookOpen size={14}/><span>{quranPages} Qur’an pages · {calendarSummary.data?.streaks.faith.current ?? 0}-day faith streak</span><Link to="/values">Open Qur’an journey</Link></div>
        </Card> : religion === 'christianity' ? <Card className="residence-faith-card">
          <div className="residence-section-heading"><div><span className="eyebrow">FAITH & REFLECTION</span><h2>Today's practices</h2><p>{faithCount} of 5 recorded</p></div><Link to="/values" className="text-link">Open reflection <ArrowRight size={13}/></Link></div>
          <div className="residence-prayer-list">{faithPractices.map(activity => { const item = faith.data?.find(row => row.activity === activity) || { activity, completed: 0 }; return <label className={'residence-prayer ' + (item.completed ? 'is-complete' : '')} key={activity}><input type="checkbox" checked={!!item.completed} onChange={() => toggleFaith.mutate(item)} /><span>{activity[0].toUpperCase() + activity.slice(1)}</span><small>{item.completed ? 'Recorded' : 'Not recorded'}</small></label>; })}</div>
          <div className="residence-faith-footer"><Flame size={14}/><span>{calendarSummary.data?.streaks.faith.current ?? 0}-day faith streak</span></div>
        </Card> : <Card className="residence-faith-card residence-faith-card--optional">
          <div className="residence-section-heading"><div><span className="eyebrow">DEEN & REFLECTION</span><h2>A private space, when you want it.</h2><p>Faith tracking is optional and controlled by your workspace settings.</p></div><MoonStar size={18}/></div>
          <Link className="text-link" to="/values">Explore Deen & Reflection <ArrowRight size={13}/></Link>
        </Card>}

        <Card className="today-habits-card">
          <div className="today-section-heading"><div><span className="eyebrow">SELF-CONTROL & STREAKS</span><h2>Your daily habits</h2><p>{completedHabits} of {habitList.length} completed</p></div><Link className="text-link" to="/rituals">Manage habits <ArrowRight size={13}/></Link></div>
          {habitList.length ? <div className="today-habit-list">{habitList.map(habit => <label className={'today-habit-row ' + (habit.done ? 'is-done' : '')} key={habit.id}>
            <input className="today-habit-check" type="checkbox" checked={!!habit.done} onChange={() => toggleHabit.mutate(habit)} />
            <span className="today-habit-emoji">{habit.emoji || '•'}</span><span className="today-habit-copy"><span className="today-habit-title">{habit.title}</span>{habit.goal_title && <small>Goal · {habit.goal_title}</small>}</span><span className="today-habit-state">{habit.done ? 'Done' : 'Mark done'}</span>
          </label>)}</div> : <EmptyState title="Start with a few daily habits." detail="Add the repeatable actions you want to become consistent with." />}
          <div className="today-card-footer"><span>{completedHabits === habitList.length && habitList.length ? 'All habits completed for today' : (habitList.length - completedHabits) + ' remaining today'}</span><Link to="/self-control" className="text-link">Open Self-Control <ArrowRight size={13}/></Link></div>
        </Card>

        <Card className="today-tasks-card">
          <div className="today-section-heading"><div><span className="eyebrow">PROJECTS & TASKS</span><h2>Today's priorities</h2><p>{todayTasks.filter(task => !task.done).length} due today · {openTasks.filter(task => task.due_date && task.due_date < today).length} overdue</p></div><Link className="text-link" to="/projects">Open projects <ArrowRight size={13}/></Link></div>
          <form className="today-quick-capture" onSubmit={event => { event.preventDefault(); if (quickTask.trim()) addTask.mutate(); }}>
            <input value={quickTask} onChange={event => setQuickTask(event.target.value)} placeholder="Add a priority for today…" aria-label="New task title" maxLength={180} />
            <button type="submit" disabled={!quickTask.trim() || addTask.isPending} aria-label="Add task"><Plus size={15}/> Add</button>
          </form>
          {addTask.isError && <p className="inline-error">{addTask.error.message}</p>}
          {priorityTasks.length ? <div className="today-task-list">{priorityTasks.map(task => <label className="today-task-row" key={task.id}>
            <input className="check-control" type="checkbox" checked={!!task.done} onChange={() => toggleTask.mutate(task)} />
            <span><b>{task.title}</b>{task.detail && <small>{task.detail}</small>}</span><time>{task.due_date ? (task.due_date < today ? 'Overdue · ' : task.due_date === today ? 'Today · ' : '') + new Date(task.due_date + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'No date'}</time>
          </label>)}</div> : <EmptyState title="You're clear for now." detail="Add a priority or open your projects to plan the next step." />}
          <div className="today-card-footer"><span>{openTasks.length} open across your workspace</span><Link to="/tasks" className="text-link">All tasks <ArrowRight size={13}/></Link></div>
        </Card>
      </section>

      <aside className="residence-side-column">
        <Card className="residence-focus-card">
          <div className="residence-section-heading"><div><span className="eyebrow">FOCUS ROOM</span><h2>{focusRunning ? 'Session in progress' : 'Protect your attention'}</h2></div><Timer size={17}/></div>
          {focusRunning ? <div className="residence-active-timer"><strong>{timerText}</strong><span>{activeFocusContext}</span></div> : <p className="residence-focus-copy">You've invested {formatMinutes(overview.data?.todayMin ?? 0)} in focused work today.</p>}
          <Link className="button button--secondary residence-focus-link" to="/focus">{focusRunning ? 'Return to focus room' : 'Start a focus session'} <ArrowRight size={14}/></Link>
          <div className="residence-week-focus"><span>Focus streak</span><b>{overview.data?.streak ?? 0} days</b></div><div className="residence-week-focus"><span>This week</span><b>{formatMinutes(overview.data?.weekMin ?? 0)}</b></div>
        </Card>

        <Card className="residence-next-card">
          <div className="residence-section-heading"><div><span className="eyebrow">A USEFUL NEXT STEP</span><h2>Keep moving</h2></div><Zap size={16}/></div>
          {insight.data?.recommendation ? <div className="today-recommendation"><b>{insight.data.recommendation.title}</b><p>{insight.data.recommendation.detail}</p><Link className="text-link" to={nextDestination}>{insight.data.recommendation.action} <ArrowRight size={13}/></Link></div> : <p className="muted">As you build a record of consistency, Atlas will surface a useful next step.</p>}
        </Card>

        {announcements.data?.items?.filter(item => !announcements.data?.readIds.includes(item.id)).length ? <Card className="today-announcements">
          <div className="residence-section-heading"><div><span className="eyebrow">UPDATES</span><h2>From Atlas</h2></div></div>
          {announcements.data.items.filter(item => !announcements.data?.readIds.includes(item.id)).slice(0,2).map(item => <div className="today-announcement" key={item.id}><b>{item.title}</b><p>{item.body}</p><button className="text-link" onClick={() => markAnnouncementRead.mutate(item.id)}>Mark as read</button></div>)}
        </Card> : null}
        {selfControl.data?.summary?.length ? <Card className="residence-goals-card">
          <div className="residence-section-heading"><div><span className="eyebrow">SELF-CONTROL & STREAKS</span><h2>Your commitments</h2><p>{selfControl.data.summary.length} active tracker{selfControl.data.summary.length === 1 ? '' : 's'}</p></div><Link to="/self-control" className="text-link">View all <ArrowRight size={13}/></Link></div>
          <div className="residence-goal-list">{selfControl.data.summary.slice(0,3).map(item => <div className="residence-goal" key={item.id}><Flame size={15}/><div><b>{item.name}</b><small>{item.streak} consecutive day{item.streak === 1 ? '' : 's'} · best {item.longest_days}</small></div></div>)}</div>
        </Card> : null}
        <Card className="residence-goals-card">
          <div className="residence-section-heading"><div><span className="eyebrow">LONG-TERM DIRECTION</span><h2>Active goals</h2></div><Link to="/goals" className="text-link">All goals <ArrowRight size={13}/></Link></div>
          {activeGoals.length ? <div className="residence-goal-list">{activeGoals.map(goal => <div className="residence-goal" key={goal.id}><Target size={15}/><div><b>{goal.title}</b><small>{goal.target_date ? 'Target ' + goal.target_date : 'No target date'}</small></div></div>)}</div> : <p className="muted">Your longer-term direction will appear here when you add a goal.</p>}
        </Card>
      </aside>
    </div>
  </div>;
}
