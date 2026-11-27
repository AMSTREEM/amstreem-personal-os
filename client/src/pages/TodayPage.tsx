import { useEffect, useMemo, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Cascade } from '../components/Cascade';
import { playAtlasFeedback } from '../lib/microFeedback';
import { AnimatedMetric } from '../components/AnimatedMetric';
import { MagneticDotField } from '../components/fx/MagneticDotField';
import { OdometerNumber } from '../components/fx/OdometerNumber';
import { triggerSparkBurst } from '../components/fx/SparkBurst';
import { FerrofluidCore } from '../components/fx/AtlasEngines';
import { CelestialHorizon } from '../components/fx/FlagshipInstruments';
import { RitualDeck } from '../components/fx/RitualDeck';
import { DailyArtifact } from '../components/fx/DailyArtifact';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, BookOpen, CalendarDays, Flame, FolderKanban, Heart, MoonStar, Plus, ShieldCheck, Sparkles, Sun, Target, Timer, Zap } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { api, json } from '../lib/api';
import { queryKeys } from '../lib/queryKeys';
import { Card, EmptyState, PageHeader } from '../components/ui';
import { useAuth } from '../auth/AuthProvider';

type Task = { id: number; title: string; detail: string; due_date: string | null; done: number; goal_title?: string | null; project_title?: string | null };
type Habit = { id: number; title: string; emoji: string; done: number; goal_title?: string | null };
type Overview = { today: string; todayMin: number; weekMin: number; completed: number; moduleTotal: number; streak: number; dailyTarget: number; openTasks: number };
type Settings = Record<string, string>;
type Prayer = { prayer: string; completed: number; on_time: number };
type Deen = { date: string; prayers: Prayer[]; quran: { activity: string; pages: number; entries: number }[]; tahajjud: { woke_up: number; prayed: number } };
type Faith = { activity: string; completed: number };
type RhythmSummary = { date: string; tradition: string; completed: number; planned: number; total: number; records: { id: number; record_type: string; title: string; status: string }[] };
type Goal = { id: number; title: string; target_date: string | null; status: string; category?: string };
type Announcement = { id: number; title: string; body: string; kind: string; created_at: string; published_at: string | null };
type DailyReview = { id: number; period_type: 'daily' | 'weekly'; period_start: string; period_end: string; wins: string; challenges: string; lessons: string; next_focus: string; intention: string; priority_task_ids: number[]; alignment_complete: number; shutdown_complete: number; updated_at: string };
type AnnouncementFeed = { items: Announcement[]; readIds: number[] };
type CalendarSummary = { streaks: Record<string, { current: number; best: number }> };
type SelfControlSummary = { summary: { id: number; name: string; symbol: string; streak: number; longest_days: number; last_slip: string | null }[] };
type StoredTimer = { remaining: number; deadline: number | null; taskId?: string; lessonId?: string; projectId?: string };
type FocusSession = { session_date: string; minutes: number; focus: string };
const TIMER_KEY = 'atlas-focus-timer-v1';
const faithPractices = ['bible', 'prayer', 'reflection', 'worship', 'service'];
const lifeAreaCards = [
  { id: 'health', title: 'Health & Fitness', detail: 'Training, nutrition and wellbeing', categories: ['health'], to: '/habits', icon: ShieldCheck, tone: 'self' },
  { id: 'education', title: 'Education & Learning', detail: 'Study, reading and new skills', categories: ['learning', 'education'], to: '/learning-library', icon: BookOpen, tone: 'learning' },
  { id: 'career', title: 'Career & Business', detail: 'Work, business and professional growth', categories: ['career', 'business'], to: '/goals', icon: FolderKanban, tone: 'projects' },
  { id: 'finance', title: 'Financial Growth', detail: 'Saving and financial outcomes', categories: ['finance'], to: '/goals', icon: Target, tone: 'goals' },
  { id: 'faith', title: 'Faith & Spirituality', detail: 'Worship and spiritual development', categories: ['faith'], to: '/values', icon: MoonStar, tone: 'deen' },
  { id: 'personal', title: 'Personal Development', detail: 'Discipline and self-improvement', categories: ['personal'], to: '/habits', icon: Heart, tone: 'self' },
  { id: 'relationships', title: 'Relationships', detail: 'Family, friends and connection', categories: ['relationships'], to: '/goals', icon: Heart, tone: 'projects' },
  { id: 'lifestyle', title: 'Lifestyle & Organisation', detail: 'Routines, time and daily life', categories: ['lifestyle'], to: '/calendar', icon: CalendarDays, tone: 'focus' }
];

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
function readHifzPage() {
  try {
    const bookmark = JSON.parse(localStorage.getItem('atlas_hifz_bookmark_v2') || '{}');
    const page = Number(bookmark.page);
    return Number.isInteger(page) && page >= 1 && page <= 604 ? page : 1;
  } catch { return 1; }
}
function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? hours + 'h ' + rest + 'm' : rest + 'm';
}

export function TodayPage() {
  const reduceMotion = useReducedMotion();
  const client = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedPriorityId, setSelectedPriorityId] = useState<number | null>(null);
  const [ritualMode,setRitualMode]=useState<'morning'|'evening'|null>(null);
  const [artifactOpen,setArtifactOpen]=useState(false);
  const [hifzPage] = useState(readHifzPage);
  const [wallClock, setWallClock] = useState(() => Date.now());
  const today = todayKey();
  const localHour = Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Lagos',hour:'2-digit',hourCycle:'h23'}).format(new Date()));
  const rhythm = localHour < 11 ? 'morning' : localHour < 17 ? 'day' : 'evening';
  const rhythmCopy = rhythm === 'morning'
    ? {eyebrow:'MORNING RHYTHM',title:'Begin with intention.',detail:'Set your direction, tend to your Deen, and choose the few priorities that matter today.'}
    : rhythm === 'day'
      ? {eyebrow:'DAY RHYTHM',title:'Give your attention a direction.',detail:'Move important work forward. Protect a focus block and keep learning in motion.'}
      : {eyebrow:'EVENING RHYTHM',title:'Close the day with clarity.',detail:'Review what was done, complete your check-ins, and leave tomorrow a little easier.'};
  const [quickTask, setQuickTask] = useState('');
  const [dailyIntention, setDailyIntention] = useState('');
  const [priorityTaskIds, setPriorityTaskIds] = useState<number[]>([]);
  const [editingAlignment, setEditingAlignment] = useState(false);
  const [shutdownWins, setShutdownWins] = useState('');
  const [shutdownChallenges, setShutdownChallenges] = useState('');
  const [shutdownLessons, setShutdownLessons] = useState('');
  const [shutdownNextFocus, setShutdownNextFocus] = useState('');
  const [timer, setTimer] = useState<StoredTimer>(readTimer);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const tick = window.setInterval(() => setWallClock(Date.now()), 30000); return () => window.clearInterval(tick); }, []);
  const settings = useQuery({ queryKey: queryKeys.settings, queryFn: () => api<Settings>('/settings') });
  const religion = settings.data?.faith_tradition || settings.data?.religion || 'none';
  let selectedLifeAreas: string[] = lifeAreaCards.map(area => area.id);
  try {
    const savedAreas = settings.data?.life_areas ? JSON.parse(settings.data.life_areas) : null;
    if (Array.isArray(savedAreas)) selectedLifeAreas = savedAreas.filter((id: string) => lifeAreaCards.some(area => area.id === id));
  } catch { /* Existing workspaces retain the full default set. */ }
  let showCalendar = true;
  if (settings.data?.features) { try { showCalendar = JSON.parse(settings.data.features).includes('calendar'); } catch { showCalendar = true; } }
  const dailyReviews = useQuery({ queryKey: queryKeys.reviews('daily'), queryFn: () => api<DailyReview[]>('/reviews?period=daily') });
  const dailyReview = dailyReviews.data?.find(item => item.period_start === today);
  const yesterdayDate = new Date(today + 'T12:00:00'); yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).format(yesterdayDate);
  const yesterdayReview = dailyReviews.data?.find(item => item.period_start === yesterdayKey);
  const overview = useQuery({ queryKey: queryKeys.overview, queryFn: () => api<Overview>('/overview') });
  const focusSessions = useQuery({ queryKey: queryKeys.sessions, queryFn: () => api<FocusSession[]>('/sessions') });
  const tasks = useQuery({ queryKey: queryKeys.tasks, queryFn: () => api<Task[]>('/tasks') });
  const habits = useQuery({ queryKey: queryKeys.habits(today), queryFn: () => api<Habit[]>('/habits?date=' + today) });
  const deen = useQuery({ queryKey: queryKeys.deen(today), queryFn: () => api<Deen>('/deen/summary?date=' + today), enabled: religion === 'islam' });
  const faith = useQuery({ queryKey: queryKeys.faith(today), queryFn: () => api<Faith[]>('/faith?date=' + today), enabled: religion === 'christianity' });
  const rhythmSummary = useQuery({ queryKey: queryKeys.rhythmSummary(today), queryFn: () => api<RhythmSummary>('/rhythm/summary?date=' + today) });
  const learning = useQuery({ queryKey: queryKeys.learningPaths, queryFn: () => api<{ id: number; title: string; lessons: { id: number; title: string; status: string }[] }[]>('/learning/paths'), enabled: !!timer.lessonId || rhythm === 'day' });
  const goals = useQuery({ queryKey: queryKeys.goals, queryFn: () => api<Goal[]>('/goals') });
  const calendarSummary = useQuery({ queryKey: queryKeys.calendarSummary(today.slice(0, 7)), queryFn: () => api<CalendarSummary>('/calendar?month=' + today.slice(0, 7)) });
  const selfControl = useQuery({ queryKey: queryKeys.selfControl(today), queryFn: () => api<SelfControlSummary>('/self-control?date=' + today) });
  const announcements = useQuery({ queryKey: queryKeys.announcements, queryFn: () => api<AnnouncementFeed>('/announcements') });

  const saveDaily = useMutation({
    mutationFn: (payload: Partial<DailyReview>) => api<DailyReview>('/reviews', json('POST', {
      period_type: 'daily', period_start: today, period_end: today, ...payload
    })),
    onSuccess: (_data, variables) => { void client.invalidateQueries({ queryKey: queryKeys.reviews('daily') }); if (variables.alignment_complete === 1) setEditingAlignment(false); }
  });

  const addTask = useMutation({
    mutationFn: () => api<Task>('/tasks', json('POST', { title: quickTask.trim(), category: 'Personal', due_date: today })),
    onSuccess: () => { setQuickTask(''); void client.invalidateQueries({ queryKey: queryKeys.tasks }); void client.invalidateQueries({ queryKey: queryKeys.overview }); }
  });
  const toggleTask = useMutation({
    mutationFn: (task: Task) => api<Task>('/tasks/' + task.id, json('PATCH', { done: !task.done })),
    onMutate: async task => {
      if (!task.done) { playAtlasFeedback('tick'); triggerSparkBurst(window.innerWidth/2, window.innerHeight*.44); }
      await client.cancelQueries({ queryKey: queryKeys.tasks });
      const previous = client.getQueryData<Task[]>(queryKeys.tasks);
      client.setQueryData<Task[]>(queryKeys.tasks, current => current?.map(item => item.id === task.id ? { ...item, done: task.done ? 0 : 1 } : item));
      return { previous };
    },
    onError: (_error, _task, context) => { if (context?.previous) client.setQueryData(queryKeys.tasks, context.previous); },
    onSettled: () => { void client.invalidateQueries({ queryKey: queryKeys.tasks }); void client.invalidateQueries({ queryKey: queryKeys.overview }); }
  });
  const toggleHabit = useMutation({
    onMutate: habit => { if (!habit.done) { playAtlasFeedback('tick'); triggerSparkBurst(window.innerWidth/2, window.innerHeight*.44); } },
    mutationFn: (habit: Habit) => api('/habits/' + habit.id + '/toggle', json('POST', { date: today })),
    onSuccess: () => { void client.invalidateQueries({ queryKey: queryKeys.habits(today) }); void client.invalidateQueries({ queryKey: queryKeys.selfControl() }); void client.invalidateQueries({ queryKey: queryKeys.overview }); }
  });
  const togglePrayer = useMutation({
    onMutate: item => { if (!item.completed) { playAtlasFeedback('tick'); triggerSparkBurst(window.innerWidth/2, window.innerHeight*.44); } },
    mutationFn: (item: Prayer) => api('/deen/prayer', json('PATCH', { date: today, prayer: item.prayer, completed: !item.completed })),
    onSuccess: () => void client.invalidateQueries({ queryKey: queryKeys.deen(today) })
  });
  const toggleFaith = useMutation({
    onMutate: item => { if (!item.completed) { playAtlasFeedback('tick'); triggerSparkBurst(window.innerWidth/2, window.innerHeight*.44); } },
    mutationFn: (item: Faith) => api('/faith', json('PATCH', { date: today, activity: item.activity, completed: !item.completed })),
    onSuccess: () => void client.invalidateQueries({ queryKey: queryKeys.faith(today) })
  });
  const markAnnouncementRead = useMutation({ mutationFn: (id: number) => api('/announcements/' + id + '/read', json('POST')), onSuccess: () => void client.invalidateQueries({ queryKey: queryKeys.announcements }) });

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
  const pinnedPriorityTasks = priorityTaskIds.map(id => tasks.data?.find(task => task.id === id)).filter((task): task is Task => !!task);
  const prioritiesCompleted = pinnedPriorityTasks.length === 3 && pinnedPriorityTasks.every(task => !!task.done);
  const showShutdownPrompt = rhythm === 'evening' || prioritiesCompleted;
  const priorityCandidates = [...(tasks.data || []).filter(task => priorityTaskIds.includes(task.id)), ...openTasks].filter((task,index,items) => items.findIndex(item => item.id === task.id) === index).slice(0,12);
  const priorityTasks = [...openTasks.filter(task => task.due_date && task.due_date < today), ...openTasks.filter(task => task.due_date === today), ...openTasks.filter(task => task.due_date && task.due_date > today), ...openTasks.filter(task => !task.due_date)].slice(0, 5);
  const activeGoals = (goals.data || []).filter(goal => goal.status === 'active').sort((a,b) => (a.target_date || '9999').localeCompare(b.target_date || '9999')).slice(0, 3);
  const tomorrowDate = new Date(today + 'T12:00:00'); tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).format(tomorrowDate);
  const tomorrowTasks = (tasks.data || []).filter(task => !task.done && task.due_date === tomorrowKey);
  const pendingHabits = habitList.length - completedHabits;
  const completedLessons = learning.data?.reduce((sum, path) => sum + path.lessons.filter(lesson => lesson.status === 'Completed').length, 0) ?? 0;
  const totalLessons = learning.data?.reduce((sum, path) => sum + path.lessons.length, 0) ?? 0;
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
  const completedFocusBlocks = (focusSessions.data || []).filter(item => item.session_date === today).length;
  const completedRhythmAnchors = religion === 'islam' ? prayerCount + (rhythmSummary.data?.completed || 0) : religion === 'christianity' ? faithCount + (rhythmSummary.data?.completed || 0) : (rhythmSummary.data?.completed || 0);
  const timeParts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(wallClock));
  const currentMinutes = Number(timeParts.find(item => item.type === 'hour')?.value || 0) * 60 + Number(timeParts.find(item => item.type === 'minute')?.value || 0);
  const dayProgress = Math.max(0, Math.min(100, currentMinutes / 1440 * 100));
  function handlePriorityKeys(event: ReactKeyboardEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
    if (!['ArrowDown', 'ArrowUp', 'j', 'k', ' ', 'f', 'F'].includes(event.key)) return;
    if (!pinnedPriorityTasks.length) return;
    event.preventDefault();
    const currentIndex = pinnedPriorityTasks.findIndex(task => task.id === selectedPriorityId);
    if (event.key === 'ArrowDown' || event.key === 'j') setSelectedPriorityId(pinnedPriorityTasks[(currentIndex + 1 + pinnedPriorityTasks.length) % pinnedPriorityTasks.length].id);
    else if (event.key === 'ArrowUp' || event.key === 'k') setSelectedPriorityId(pinnedPriorityTasks[(currentIndex <= 0 ? pinnedPriorityTasks.length : currentIndex) - 1].id);
    else { const task = pinnedPriorityTasks.find(item => item.id === selectedPriorityId) || pinnedPriorityTasks[0]; setSelectedPriorityId(task.id); if (event.key === ' ' && !toggleTask.isPending) { toggleTask.mutate(task); } if (event.key.toLowerCase() === 'f') navigate('/focus?task=' + task.id); }
  }

  useEffect(() => {
    if (!dailyReview) return;
    setDailyIntention(dailyReview.intention || '');
    setPriorityTaskIds(Array.isArray(dailyReview.priority_task_ids) ? dailyReview.priority_task_ids : []);
    setShutdownWins(dailyReview.wins || '');
    setShutdownChallenges(dailyReview.challenges || '');
    setShutdownLessons(dailyReview.lessons || '');
    setShutdownNextFocus(dailyReview.next_focus || '');
  }, [dailyReview?.id, dailyReview?.updated_at, today]);

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
    let faithScore = 0;
    let faithDetail = 'No faith activity recorded yet';
    const completedPractices = rhythmSummary.data?.completed || 0;
    const plannedPractices = rhythmSummary.data?.total || 0;
    if (religion === 'islam') {
      const quranSessions = deen.data?.quran.reduce((sum, item) => sum + item.entries, 0) || 0;
      const total = 5 + plannedPractices + quranSessions;
      faithScore = total ? (prayerCount + completedPractices + quranSessions) / total * 100 : 0;
      faithDetail = prayerCount + '/5 salah · ' + quranSessions + ' Qur’an sessions · ' + completedPractices + ' practices';
    } else if (religion === 'christianity') {
      const total = faithPractices.length + 3 + plannedPractices;
      faithScore = total ? (faithCount + completedPractices) / total * 100 : 0;
      faithDetail = faithCount + ' faith practices · ' + completedPractices + ' completed activities';
    } else {
      faithScore = completedPractices / Math.max(3, plannedPractices) * 100;
      faithDetail = completedPractices + ' completed · ' + (rhythmSummary.data?.planned || 0) + ' planned';
    }
    return [
      { label: religion === 'islam' ? 'Deen' : religion === 'christianity' ? 'Faith' : 'Clarity', score: faithScore, detail: faithDetail },
      { label: 'Habits', score: habitList.length ? completedHabits / habitList.length * 100 : 0, detail: completedHabits + '/' + habitList.length + ' completed today' },
      { label: 'Focus', score: focusPercent, detail: formatMinutes(overview.data?.todayMin || 0) + ' / ' + formatMinutes(target) + ' intention' }
    ];
  }, [religion, deen.data, prayerCount, faithCount, rhythmSummary.data, habitList.length, completedHabits, focusPercent, overview.data?.todayMin, target]);
  const activityPulse = Math.round(scoreDimensions.reduce((sum, item) => sum + item.score, 0) / 3);

  const dailyStreak=Math.max(habitStreak,calendarSummary.data?.streaks.faith.current??0,calendarSummary.data?.streaks.habits.current??0);
  const finishRitual=(values:{first:string;second:string;third:string;fourth:string})=>{if(ritualMode==='morning'){setDailyIntention(values.first);saveDaily.mutate({intention:values.first,priority_task_ids:priorityTaskIds,alignment_complete:1},{onSuccess:()=>{playAtlasFeedback('complete');triggerSparkBurst(window.innerWidth/2,window.innerHeight*.42);setRitualMode(null);navigate('/focus');}});}else{setShutdownWins(values.first);setShutdownLessons(values.second);setShutdownChallenges(values.third);setShutdownNextFocus(values.fourth);saveDaily.mutate({wins:values.first,lessons:values.second,challenges:values.third,next_focus:values.fourth,shutdown_complete:[values.first,values.third,values.second,values.fourth].every(v=>v.trim())?1:0},{onSuccess:()=>{playAtlasFeedback('complete');triggerSparkBurst(window.innerWidth/2,window.innerHeight*.42);setRitualMode(null);}});}};
  return <Cascade className="stack today-dashboard">
    <section className="residence-band residence-band--orientation" aria-label="Today's orientation">
      <PageHeader eyebrow={new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date()).toUpperCase()} title={`Good ${rhythm === 'day' ? 'afternoon' : rhythm}, ${settings.data?.display_name?.trim() || user?.name || user?.username || 'there'}`} description="Your Home: a clear view of today’s priorities, commitments, focus and progress across the areas that matter to you." action={showCalendar ? <Link className="button button--secondary" to="/calendar">View calendar <ArrowRight size={14} /></Link> : undefined} />
      {religion === 'islam' && <Link className="residence-quran-resume" to="/quran"><BookOpen size={15}/> Open Qur’an · Hifz P.{hifzPage} <ArrowRight size={13}/></Link>}
      <CelestialHorizon/>
      <div className="atlas-ritual-launchers"><button type="button" className="button button--secondary" onClick={()=>setRitualMode('morning')}><Sun size={14}/> Start Morning Kickoff</button><button type="button" className="button button--ghost" onClick={()=>setRitualMode('evening')}><MoonStar size={14}/> Evening Shutdown</button>{(prioritiesCompleted||completedFocusBlocks>0)&&<button type="button" className="button button--artifact" onClick={()=>setArtifactOpen(true)}><Sparkles size={14}/> Daily Artifact</button>}</div>
      <section className="residence-rhythm"><div><span className="eyebrow">{rhythmCopy.eyebrow}</span><span className="residence-rhythm-title-mask"><motion.h2 initial={reduceMotion ? false : { y: "105%", opacity: 0 }} animate={{ y: "0%", opacity: 1 }} transition={reduceMotion ? { duration: 0 } : { duration: 0.28, delay: 0.07, ease: [0.16, 1, 0.3, 1] }}>{rhythmCopy.title}</motion.h2></span><p>{rhythmCopy.detail}</p></div><span className="residence-rhythm-time">{new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Lagos',hour:'2-digit',minute:'2-digit'}).format(new Date())} WAT</span></section>
      {yesterdayReview?.shutdown_complete && yesterdayReview.next_focus?.trim() && <div className="residence-carryforward"><span className="eyebrow">YOUR FIRST MEANINGFUL STEP</span><p>{yesterdayReview.next_focus}</p><small>Carried forward from yesterday’s shutdown</small></div>}
    <section className="residence-rhythm-action" aria-live="polite">
      {showShutdownPrompt ? <><div><span className="eyebrow">EVENING SHUTDOWN</span><b>{prioritiesCompleted ? 'Your three priorities are complete. Close the loop.' : 'Make space to close the day.'}</b><p>Capture what moved forward and choose tomorrow’s first meaningful step.</p></div><Link to="#evening-shutdown">Begin shutdown <ArrowRight size={13}/></Link></>
      : rhythm === 'morning' ? <><div><span className="eyebrow">SET YOUR DIRECTION</span><b>{religion === 'islam' ? prayerCount + ' of 5 prayers recorded so far' : priorityTasks.length ? 'Your first priorities are ready' : 'Choose your first priority'}</b><p>{priorityTasks.length ? priorityTasks.slice(0,3).map(task => task.title).join(' · ') : 'Keep the start of the day simple: intention, one anchor, and a meaningful next step.'}</p></div><Link to={religion === 'islam' ? '/values' : '/tasks'}>{religion === 'islam' ? 'Open Deen' : 'Set priorities'} <ArrowRight size={13}/></Link></>
      : rhythm === 'day' ? <><div><span className="eyebrow">PROTECT DEEP WORK</span><b>{openTasks.length} open priorities · {totalLessons ? completedLessons + '/' + totalLessons + ' lessons complete' : 'Learning progress when you add a path'}</b><p>{focusRunning ? 'Your focus block is already underway. Keep your attention on the current session.' : 'Choose one important task, then give it a protected block of attention.'}</p></div><Link to={focusRunning ? '/focus' : '/tasks'}>{focusRunning ? 'Return to focus' : 'Choose a task'} <ArrowRight size={13}/></Link></>
      : <><div><span className="eyebrow">CLOSE THE DAY GENTLY</span><b>{pendingHabits} habits remaining{religion === 'islam' ? ' · ' + (5-prayerCount) + ' prayers not yet recorded' : ''}</b><p>{tomorrowTasks.length ? tomorrowTasks.length + ' task' + (tomorrowTasks.length === 1 ? '' : 's') + ' already planned for tomorrow.' : 'Review today honestly, then leave tomorrow one clear next step.'}</p></div><Link to="/reviews">Open daily reflection <ArrowRight size={13}/></Link></>}
    </section>
      <section className="residence-day-ribbon" aria-label="Day progress">
        <div className="residence-day-ribbon__head"><span>DAY PROGRESS</span><b>{timeParts.find(item => item.type === 'hour')?.value}:{timeParts.find(item => item.type === 'minute')?.value} <small>WAT</small></b></div>
        <div className="residence-day-ribbon__track" aria-label={Math.round(dayProgress) + ' percent through the day'}><span className="residence-day-ribbon__elapsed" style={{ width: dayProgress + '%' }}/><i className="residence-day-ribbon__now" style={{ left: dayProgress + '%' }}><b>PRIVATE TIME</b></i></div>
        <div className="residence-day-ribbon__foot"><span className="residence-day-ribbon__marks">{Array.from({ length: Math.min(8, completedFocusBlocks) }, (_, index) => <i className="is-focus" key={'f' + index}/>)}{Array.from({ length: Math.min(10, completedRhythmAnchors) }, (_, index) => <i className="is-anchor" key={'a' + index}/>)}</span><span>{completedFocusBlocks} focus blocks <em>·</em> {completedRhythmAnchors} faith / rhythm anchors</span></div>
      </section>
      {dailyReview?.alignment_complete && !editingAlignment ? <Card className="residence-intention-card">
        <div><span className="eyebrow">TODAY’S DAILY INTENTION</span><span className="residence-intention-mask"><motion.p initial={reduceMotion ? false : { y: "105%", opacity: 0 }} animate={{ y: "0%", opacity: 1 }} transition={reduceMotion ? { duration: 0 } : { duration: 0.28, delay: 0.13, ease: [0.16, 1, 0.3, 1] }}>{dailyReview.intention}</motion.p></span></div>
        <button type="button" className="text-link" onClick={() => setEditingAlignment(true)}>Edit plan <ArrowRight size={13}/></button>
      </Card> : <Card className="residence-alignment-card">
        <div className="residence-section-heading">
          <div><span className="eyebrow">01 / MORNING ALIGNMENT</span><h2>Give today a direction.</h2><p>{dailyReview?.alignment_complete ? 'Your intention is saved for today.' : 'Decide what deserves your attention before the day gets busy.'}</p></div>
          <span className={'residence-workflow-state ' + (dailyReview?.alignment_complete ? 'is-complete' : '')}>{dailyReview?.alignment_complete ? 'Aligned' : 'Not set'}</span>
        </div>
        <form className="residence-alignment-form" onSubmit={event => { event.preventDefault(); saveDaily.mutate({ intention: dailyIntention, priority_task_ids: priorityTaskIds, alignment_complete: 1 }); }}>
          <label className="residence-field"><span>Today's intention</span><textarea value={dailyIntention} onChange={event => setDailyIntention(event.target.value)} maxLength={500} rows={2} placeholder="What kind of person do you want to be today? What matters most?" /></label>
          <div className="residence-priority-picker">
            <div className="residence-priority-picker__heading"><b>Choose up to three priorities</b><small>{priorityTaskIds.length}/3 selected · selection order sets priority</small></div>
            {priorityCandidates.length ? <div className="residence-priority-options">{priorityCandidates.map(task => {
              const selected = priorityTaskIds.includes(task.id);
              const order = priorityTaskIds.indexOf(task.id);
              return <label className={'residence-priority-option ' + (selected ? 'is-selected' : '')} key={task.id}>
                <input type="checkbox" checked={selected} onChange={() => setPriorityTaskIds(current => selected ? current.filter(id => id !== task.id) : current.length < 3 ? [...current, task.id] : current)} />
                <span className="residence-priority-option__rank">{selected ? order + 1 : '·'}</span><span>{task.title}</span>
                {task.due_date && <small>{task.due_date === today ? 'Today' : task.due_date < today ? 'Overdue' : new Date(task.due_date + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</small>}
              </label>;
            })}</div> : <div className="residence-priority-empty">No open tasks yet. Add today's priorities in the task capture below, then return here to select them.</div>}
          </div>
          <div className="residence-workflow-footer"><small>{dailyReview?.alignment_complete ? 'You can adjust this plan at any time.' : 'A simple intention is enough to begin. You can choose fewer than three priorities.'}</small><button className="button button--primary" type="submit" disabled={!dailyIntention.trim() || saveDaily.isPending}>{saveDaily.isPending ? 'Saving…' : dailyReview?.alignment_complete ? 'Update alignment' : 'Save morning alignment'}</button></div>
          {saveDaily.isError && <p className="inline-error">{saveDaily.error.message}</p>}
        </form>
      </Card>}
    </section>

    <section className="residence-band residence-band--overview" aria-label="Life at a glance"><MagneticDotField/>
      <div className="residence-band-heading"><span className="eyebrow">02 / YOUR LIFE AT A GLANCE</span><p>Connected areas of your life, with activity drawn from your existing records.</p></div>
      <section className="residence-pillar-grid" aria-label="Your selected life areas">
      {lifeAreaCards.filter(area => selectedLifeAreas.includes(area.id)).map(area => {
        const Icon = area.icon;
        const linkedGoals = (goals.data || []).filter(goal => goal.status === 'active' && area.categories.includes((goal.category || '').toLowerCase()));
        const detail = area.id === 'faith'
          ? religion === 'islam' ? prayerCount + '/5 salah · ' + (rhythmSummary.data?.completed || 0) + ' practices today' : (rhythmSummary.data?.completed || 0) + ' faith activities today'
          : linkedGoals.length ? linkedGoals.length + ' active outcome' + (linkedGoals.length === 1 ? '' : 's') + ' connected' : area.detail + ' · Add an outcome when ready';
        return <Link className={'residence-pillar atlas-spotlight residence-pillar--' + area.tone} to={area.to} key={area.id}>
          <span className="residence-pillar__icon"><Icon size={19} strokeWidth={1.8}/></span>
          <div><b>{area.title}</b><small>{detail}</small></div><ArrowRight size={14}/>
        </Link>;
      })}
    </section>
    <Card className="residence-pulse-card">
      <section className="residence-pulse" aria-label="Your daily activity pulse">
        <div className="residence-pulse__top">
          <div className="residence-pulse__main">
            <div className="residence-pulse__heading"><span className="eyebrow">TODAY'S ACTIVITY PULSE</span><span className="residence-pulse__date">{today}</span></div>
            <div className="residence-pulse__score"><span>Progress is personal.</span></div>
            <p>These are separate activity signals, not a combined life score. Use them to understand your day without reducing every area of life to one number.</p>
          </div>
          <div className="residence-pulse__core" aria-hidden="true"><FerrofluidCore active={focusRunning || prioritiesCompleted}/></div>
        </div>
        <div className="residence-pulse__dimensions">
          {scoreDimensions.map(item => <div className="residence-dimension" key={item.label}>
            <div className="residence-dimension__heading"><span>{item.label}</span><b>{Math.round(item.score)}%</b></div>
            <small>{item.detail}</small>
            <i><span style={{ width: Math.max(0, Math.min(100, item.score)) + '%' }} /></i>
          </div>)}
        </div>
      </section>
    </Card>

    <div className="residence-stat-grid">
      <Card className="residence-stat atlas-spotlight"><span className="eyebrow">FOCUS TODAY</span><strong><AnimatedMetric value={overview.data?.todayMin ?? 0} format="minutes" /></strong><small>{focusPercent}% of your {target}m intention</small></Card>
      <Card className="residence-stat"><span className="eyebrow">OPEN PRIORITIES</span><strong>{openTasks.length}</strong><small>{todayTasks.filter(task => !task.done).length} due today</small></Card>
      <Card className="residence-stat"><span className="eyebrow">HABITS COMPLETED</span><strong>{completedHabits}<small> / {habitList.length}</small></strong><small>Today's chosen habits</small></Card>
      <Card className="residence-stat"><span className="eyebrow">HABIT STREAK</span><strong><Flame size={18}/>{habitStreak}</strong><small>Consecutive days with habit activity</small></Card>
    </div>
    </section>

    <section className="residence-band residence-band--execution" aria-label="Today's execution">
      <div className="residence-band-heading"><span className="eyebrow">03 / MOVE TODAY FORWARD</span><p>Turn today's direction into deliberate action.</p></div>
      <div className="residence-grid">
      <section className="residence-main-column">
        <Card className={"residence-pinned-priorities"+(prioritiesCompleted?" is-harmonically-locked":"")}>
          <div className="residence-section-heading"><div><span className="eyebrow">YOUR PINNED TOP 3</span><h2>Today’s execution</h2><p>{pinnedPriorityTasks.filter(task => !!task.done).length}/3 Harmonic Lock-In · {pinnedPriorityTasks.filter(task => !!task.done).length} priorities complete</p>{prioritiesCompleted && <span className="residence-day-secured">Day Secured · Come back tomorrow for Evening Shutdown</span>}</div><button type="button" className="text-link" onClick={() => setEditingAlignment(true)}>Edit plan <ArrowRight size={13}/></button></div>
          {prioritiesCompleted&&<button type="button" className="atlas-artifact-trigger" onClick={()=>setArtifactOpen(true)}><Sparkles size={14}/> View today’s proof-of-work artifact <ArrowRight size={13}/></button>}
          {pinnedPriorityTasks.length ? <div className="residence-pinned-list atlas-keyboard-list" tabIndex={0} aria-label="Today priorities. Use arrow keys or J and K to select, Space to complete, F to focus." onKeyDown={handlePriorityKeys}><AnimatePresence initial={false}>{pinnedPriorityTasks.map((task,index) => <motion.div layout initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0, scale: task.done ? 1.008 : 1 }} exit={{ opacity: 0, y: -5 }} transition={{ layout: { type: 'spring', stiffness: 420, damping: 35, bounce: 0 }, opacity: { duration: 0.14 }, scale: { type: 'spring', stiffness: 420, damping: 35, bounce: 0 } }} whileTap={{ scale: 0.985 }} onClick={() => setSelectedPriorityId(task.id)} className={'residence-pinned-row ' + (task.done ? 'is-complete' : '') + (selectedPriorityId === task.id ? ' is-keyboard-selected' : '')} key={task.id}>
            <span className="residence-pinned-rank">#{index+1}</span>
            <motion.span whileTap={{ scale: 0.96 }} transition={{ type: 'spring', stiffness: 420, damping: 35, bounce: 0 }}><input type="checkbox" checked={!!task.done} disabled={toggleTask.isPending} onChange={() => toggleTask.mutate(task)} aria-label={(task.done ? 'Reopen ' : 'Complete ') + task.title} /></motion.span>
            <span className="residence-pinned-copy"><b>{task.title}</b>{task.project_title && <small>{task.project_title}</small>}</span>
            <Link className="residence-pinned-focus" to={'/focus?task=' + task.id} aria-label={'Focus on ' + task.title}><Timer size={13}/> Focus</Link>
          </motion.div>)}</AnimatePresence></div> : <div className="residence-priority-empty">Your pinned priorities will appear here after you save Morning Alignment. <button type="button" className="text-link" onClick={() => setEditingAlignment(true)}>Set today’s plan</button></div>}
        </Card>
        {religion === 'islam' ? <Card className="residence-faith-card">
          <div className="residence-section-heading"><div><span className="eyebrow">DEEN & REFLECTION</span><h2>Today's Salah</h2><p>{prayerCount} of 5 salah recorded · {rhythmSummary.data?.completed || 0} additional practices completed</p></div><Link to="/values" className="text-link">Open Deen <ArrowRight size={13}/></Link></div>
          <div className="residence-prayer-list">{(deen.data?.prayers || []).map(item => <label className={'residence-prayer ' + (item.completed ? 'is-complete' : '')} key={item.prayer}><input type="checkbox" checked={!!item.completed} onChange={() => togglePrayer.mutate(item)} /><span>{item.prayer}</span><small>{item.completed ? 'Recorded' : 'Not recorded'}</small></label>)}</div>
          <div className="residence-faith-footer"><BookOpen size={14}/><span>{quranPages} Qur’an pages · {calendarSummary.data?.streaks.faith.current ?? 0}-day faith streak</span><Link to="/values">Open Qur’an journey</Link></div>
        </Card> : religion === 'christianity' ? <Card className="residence-faith-card">
          <div className="residence-section-heading"><div><span className="eyebrow">FAITH & REFLECTION</span><h2>Today's practices</h2><p>{faithCount} legacy practices · {rhythmSummary.data?.completed || 0} faith activities completed</p></div><Link to="/values" className="text-link">Open reflection <ArrowRight size={13}/></Link></div>
          <div className="residence-prayer-list">{faithPractices.map(activity => { const item = faith.data?.find(row => row.activity === activity) || { activity, completed: 0 }; return <label className={'residence-prayer ' + (item.completed ? 'is-complete' : '')} key={activity}><input type="checkbox" checked={!!item.completed} onChange={() => toggleFaith.mutate(item)} /><span>{activity[0].toUpperCase() + activity.slice(1)}</span><small>{item.completed ? 'Recorded' : 'Not recorded'}</small></label>; })}</div>
          <div className="residence-faith-footer"><Flame size={14}/><span>{calendarSummary.data?.streaks.faith.current ?? 0}-day faith streak</span></div>
        </Card> : <Card className="residence-faith-card residence-faith-card--optional">
          <div className="residence-section-heading"><div><span className="eyebrow">CLARITY & REFLECTION</span><h2>Your daily clarity.</h2><p>{rhythmSummary.data?.completed || 0} activities completed · {rhythmSummary.data?.planned || 0} planned</p></div><MoonStar size={18}/></div>
          <Link className="text-link" to="/values">Open Clarity & Reflection <ArrowRight size={13}/></Link>
        </Card>}

        {religion === 'islam' && <Card className="residence-quran-feature">
          <div className="residence-quran-feature__ornament" aria-hidden="true"><span/><span/><span/></div>
          <div className="residence-quran-feature__content">
            <span className="eyebrow">YOUR QUR’AN JOURNEY</span>
            <div className="residence-quran-feature__heading"><span className="residence-quran-feature__icon"><BookOpen size={20}/></span><div><h2>Qur’an</h2><p>Continue from your saved Hifz or Muraja’ah position.</p></div></div>
            <div className="residence-quran-feature__actions">
              <Link className="residence-quran-feature__primary" to="/quran">Open Qur’an <ArrowRight size={15}/></Link>
              <Link className="residence-quran-feature__secondary" to="/quran">Resume Muraja’ah <BookOpen size={14}/></Link>
            </div>
          </div>
          <div className="residence-quran-feature__page"><span>LAST SAVED</span><strong>{hifzPage}</strong><small>Hifz page</small></div>
        </Card>}

        <Card className="today-habits-card">
          <div className="today-section-heading"><div><span className="eyebrow">SELF-CONTROL & STREAKS</span><h2>Your daily habits</h2><p>{completedHabits} of {habitList.length} completed</p></div><Link className="text-link" to="/rituals">Manage habits <ArrowRight size={13}/></Link></div>
          {habitList.length ? <div className="today-habit-list">{habitList.map(habit => <label className={'today-habit-row ' + (habit.done ? 'is-done' : '')} key={habit.id}>
            <input className="today-habit-check" type="checkbox" checked={!!habit.done} onChange={() => toggleHabit.mutate(habit)} />
            <span className="today-habit-emoji">{habit.emoji || <Sparkles size={14} strokeWidth={1.8}/>}</span><span className="today-habit-copy"><span className="today-habit-title">{habit.title}</span>{habit.goal_title && <small>Goal · {habit.goal_title}</small>}</span><span className="today-habit-state">{habit.done ? 'Done' : 'Mark done'}</span>
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
          {priorityTasks.length ? <div className="today-task-list"><AnimatePresence initial={false}>{priorityTasks.map(task => <motion.label layout initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ layout: { type: 'spring', stiffness: 420, damping: 35, bounce: 0 }, opacity: { duration: 0.14 } }} whileTap={{ scale: 0.985 }} className="today-task-row" key={task.id}>
            <motion.span whileTap={{ scale: 0.96 }} transition={{ type: 'spring', stiffness: 420, damping: 35, bounce: 0 }}><input className="check-control" type="checkbox" checked={!!task.done} onChange={() => toggleTask.mutate(task)} /></motion.span>
            <span><b>{task.title}</b>{task.detail && <small>{task.detail}</small>}</span><time>{task.due_date ? (task.due_date < today ? 'Overdue · ' : task.due_date === today ? 'Today · ' : '') + new Date(task.due_date + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'No date'}</time>
          </motion.label>)}</AnimatePresence></div> : <EmptyState title="You're clear for now." detail="Add a priority or open your projects to plan the next step." />}
          <div className="today-card-footer"><span>{openTasks.length} open across your workspace</span><Link to="/tasks" className="text-link">All tasks <ArrowRight size={13}/></Link></div>
        </Card>
      </section>

      <aside className="residence-side-column">
        <Card className="residence-focus-card">
          <div className="residence-section-heading"><div><span className="eyebrow">FOCUS ROOM</span><h2>{focusRunning ? 'Session in progress' : 'Protect your attention'}</h2></div><Timer size={17}/></div>
          {focusRunning ? <div className="residence-active-timer"><strong>{timerText}</strong><span>{activeFocusContext}</span></div> : <p className="residence-focus-copy">You've invested {formatMinutes(overview.data?.todayMin ?? 0)} in focused work today.</p>}
          <Link className="button button--secondary residence-focus-link" to="/execution">{focusRunning ? 'Return to focus room' : 'Start a focus session'} <ArrowRight size={14}/></Link>
          <div className="residence-week-focus"><span>Focus streak</span><b>{overview.data?.streak ?? 0} days</b></div><div className="residence-week-focus"><span>This week</span><b>{formatMinutes(overview.data?.weekMin ?? 0)}</b></div>
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
      <div id="evening-shutdown" className={showShutdownPrompt ? 'residence-shutdown-highlight' : ''}><Card className={'residence-shutdown-card ' + (showShutdownPrompt ? 'is-highlighted' : '')}>
        <div className="residence-section-heading">
          <div><span className="eyebrow">04 / EVENING SHUTDOWN</span><h2>Close the day with clarity.</h2><p>Notice what happened without judgement. Leave tomorrow a little easier.</p></div>
          <span className={'residence-workflow-state ' + (dailyReview?.shutdown_complete ? 'is-complete' : '')}>{dailyReview?.shutdown_complete ? 'Closed' : 'Open'}</span>
        </div>
        <form className="residence-shutdown-form" onSubmit={event => { event.preventDefault(); saveDaily.mutate({ wins: shutdownWins, challenges: shutdownChallenges, lessons: shutdownLessons, next_focus: shutdownNextFocus, shutdown_complete: [shutdownWins, shutdownChallenges, shutdownLessons, shutdownNextFocus].every(value => value.trim()) ? 1 : 0 }); }}>
          <label className="residence-field"><span>What moved forward?</span><textarea value={shutdownWins} onChange={event => setShutdownWins(event.target.value)} rows={2} maxLength={5000} placeholder="What did you complete, practise, or make progress on?" /></label>
          <label className="residence-field"><span>What slipped, and why?</span><textarea value={shutdownChallenges} onChange={event => setShutdownChallenges(event.target.value)} rows={2} maxLength={5000} placeholder="What got in the way? Be honest, not harsh." /></label>
          <label className="residence-field"><span>What did you learn?</span><textarea value={shutdownLessons} onChange={event => setShutdownLessons(event.target.value)} rows={2} maxLength={5000} placeholder="What will you remember from today?" /></label>
          <label className="residence-field"><span>One clear next step for tomorrow</span><textarea value={shutdownNextFocus} onChange={event => setShutdownNextFocus(event.target.value)} rows={2} maxLength={5000} placeholder="What is the first meaningful thing to move forward?" /></label>
          <div className="residence-workflow-footer"><small>{dailyReview?.shutdown_complete ? "Today's shutdown is saved. You can still edit it." : 'Fill all four reflections to mark the day as closed. Partial notes can be saved as a draft.'}</small><button className="button button--secondary" type="submit" disabled={saveDaily.isPending || ![shutdownWins, shutdownChallenges, shutdownLessons, shutdownNextFocus].some(value => value.trim())}>{saveDaily.isPending ? 'Saving…' : [shutdownWins, shutdownChallenges, shutdownLessons, shutdownNextFocus].every(value => value.trim()) ? 'Complete evening shutdown' : 'Save reflection draft'}</button></div>
          {saveDaily.isError && <p className="inline-error">{saveDaily.error.message}</p>}
        </form>
      </Card></div>
    </section>
    <AnimatePresence>{ritualMode&&<RitualDeck mode={ritualMode} initial={{intention:dailyIntention,wins:shutdownWins,lessons:shutdownLessons,challenges:shutdownChallenges,nextFocus:shutdownNextFocus}} priorityCount={priorityTaskIds.length} activityPulse={activityPulse} onClose={()=>setRitualMode(null)} onComplete={finishRitual}/>}</AnimatePresence>
    {artifactOpen&&<DailyArtifact date={today} pulse={activityPulse} focusMinutes={overview.data?.todayMin||0} streak={dailyStreak} onClose={()=>setArtifactOpen(false)}/>}
  </Cascade>;
}