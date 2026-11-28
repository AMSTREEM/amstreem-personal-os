'use strict';

const crypto = require('node:crypto');
const { calculateHabitStreak } = require('./atlas-streaks');

const PROJECTION_MODULES = new Set(['actions', 'goals', 'habits', 'learning', 'growth', 'calendar', 'residence']);

function rowsFor(data, table) {
  const value = data && data.tables && data.tables[table];
  return Array.isArray(value) ? value : [];
}

function settingsFor(data) {
  const result = {};
  for (const row of rowsFor(data, 'settings')) {
    if (row && typeof row.key === 'string') result[row.key] = row.value;
  }
  return result;
}

function jsonSetting(settings, key, fallback) {
  try {
    const value = settings[key];
    if (typeof value !== 'string') return fallback;
    const parsed = JSON.parse(value);
    return parsed == null ? fallback : parsed;
  } catch {
    return fallback;
  }
}

function dateKeyInZone(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date);
  const part = key => parts.find(item => item.type === key)?.value || '';
  return part('year') + '-' + part('month') + '-' + part('day');
}

function clockInZone(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23'
  }).formatToParts(date);
  const part = key => parts.find(item => item.type === key)?.value || '';
  return {
    localDate: part('year') + '-' + part('month') + '-' + part('day'),
    hour: Number(part('hour')),
    minute: Number(part('minute')),
    weekday: part('weekday')
  };
}

function addDays(dateKey, amount) {
  const date = new Date(dateKey + 'T12:00:00Z');
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function mondayWeekStart(dateKey) {
  const date = new Date(dateKey + 'T12:00:00Z');
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

function safeTimeZone(value) {
  try {
    const zone = typeof value === 'string' && value.trim() ? value.trim() : 'Africa/Lagos';
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return zone;
  } catch {
    return 'Africa/Lagos';
  }
}

function notificationsEnabled(settings, category) {
  if (settings.notifications_enabled !== 'true') return false;
  const categories = jsonSetting(settings, 'notification_categories', []);
  return Array.isArray(categories) && categories.includes(category);
}

function quietHours(settings) {
  const value = jsonSetting(settings, 'notification_quiet_hours', { start: '22:00', end: '08:00' });
  const start = typeof value?.start === 'string' ? value.start : '22:00';
  const end = typeof value?.end === 'string' ? value.end : '08:00';
  const valid = item => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(item);
  return { start: valid(start) ? start : '22:00', end: valid(end) ? end : '08:00' };
}

function isQuietNow(settings, clock) {
  const quiet = quietHours(settings);
  const toMinutes = value => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
  const now = clock.hour * 60 + clock.minute;
  const start = toMinutes(quiet.start);
  const end = toMinutes(quiet.end);
  return start < end ? now >= start && now < end : now >= start || now < end;
}

function habitDateSets(workspace, events, localDate) {
  const byHabit = new Map();
  const apply = (id, day, checked) => {
    if (!id || typeof day !== 'string' || day > localDate) return;
    const key = String(id);
    const dates = byHabit.get(key) || new Set();
    if (checked) dates.add(day);
    else dates.delete(day);
    byHabit.set(key, dates);
  };
  for (const log of rowsFor(workspace.data, 'habit_logs')) apply(log.habit_id, log.log_date, true);
  for (const event of (events || []).slice().reverse()) {
    const day = event.payload?.logDate || event.local_date;
    if (event.type === 'habit.checked') apply(event.entity_id, day, true);
    if (event.type === 'habit.unchecked') apply(event.entity_id, day, false);
  }
  return byHabit;
}

function makeAdminClient(supabaseUrl, serviceKey) {
  const base = String(supabaseUrl || '').replace(/\/+$/, '');
  async function request(path, options = {}) {
    const headers = {
      apikey: serviceKey,
      Authorization: 'Bearer ' + serviceKey,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };
    const response = await fetch(base + '/rest/v1/' + path, {
      method: options.method || 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body)
    });
    const body = await response.text();
    if (!response.ok) throw new Error('Supabase admin REST failed (' + response.status + '): ' + body.slice(0, 300));
    return body ? JSON.parse(body) : null;
  }
  const rpc = (name, body) => request('rpc/' + name, { method: 'POST', body });
  return { request, rpc };
}

function startAtlasScheduler({ supabaseUrl, serviceKey, appEnv, intervalMs = 60_000 }) {
  if (!supabaseUrl || !serviceKey) {
    console.warn(JSON.stringify({ event: 'atlas.scheduler.disabled', environment: appEnv, reason: 'server-side Supabase service key is not configured' }));
    return () => {};
  }

  const admin = makeAdminClient(supabaseUrl, serviceKey);
  const ownerId = crypto.randomUUID();
  let active = false;
  let stopped = false;

  async function finishRun(runId, status, result, error, backoffSeconds) {
    await admin.rpc('finish_atlas_job_run', {
      p_run_id: runId,
      p_status: status,
      p_result: result || {},
      p_error_message: error ? String(error.message || error).slice(0, 2000) : null,
      p_backoff_seconds: backoffSeconds || 60
    });
  }

  async function runJob(jobName, runKey, userId, work) {
    let claim;
    try {
      const rows = await admin.rpc('claim_atlas_job_run', {
        p_job_name: jobName,
        p_run_key: runKey,
        p_user_id: userId || null,
        p_request_id: crypto.randomUUID()
      });
      claim = Array.isArray(rows) ? rows[0] : rows;
    } catch (error) {
      console.error(JSON.stringify({ event: 'atlas.job.claim_failed', job: jobName, message: error.message }));
      return null;
    }
    if (!claim?.claimed || !claim.run_id) return null;
    const started = Date.now();
    try {
      const result = await work();
      await finishRun(claim.run_id, 'succeeded', result || {}, null, 60);
      console.info(JSON.stringify({ event: 'atlas.job.succeeded', job: jobName, durationMs: Date.now() - started }));
      return result;
    } catch (error) {
      const backoff = Math.min(3600, 30 * (2 ** Math.min(6, Math.max(0, Number(claim.attempts || 1) - 1))));
      try { await finishRun(claim.run_id, 'failed', {}, error, backoff); } catch (finishError) {
        console.error(JSON.stringify({ event: 'atlas.job.finish_failed', job: jobName, message: finishError.message }));
      }
      console.error(JSON.stringify({ event: 'atlas.job.failed', job: jobName, durationMs: Date.now() - started, message: error.message }));
      return null;
    }
  }

  async function insertNotification(userId, settings, timezone, localDate, category, title, body, dedupeKey, data = {}) {
    if (!notificationsEnabled(settings, category)) return false;
    await admin.request('atlas_notifications?on_conflict=user_id,channel,dedupe_key', {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: {
        user_id: userId,
        local_date: localDate,
        category,
        channel: 'in_app',
        title,
        body,
        data: { ...data, timezone },
        dedupe_key: dedupeKey,
        status: 'queued',
        scheduled_at: new Date().toISOString()
      }
    });
    return true;
  }

  async function insertInsight(userId, settings, timezone, localDate, insight) {
    await admin.request('atlas_insights?on_conflict=user_id,dedupe_key', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: {
        user_id: userId,
        insight_type: insight.type,
        title: insight.title,
        summary: insight.summary,
        explanation: insight.explanation,
        evidence: insight.evidence,
        priority: insight.priority || 'normal',
        dedupe_key: insight.dedupeKey,
        status: 'active',
        expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString()
      }
    });
    if (insight.notificationCategory) {
      await insertNotification(
        userId, settings, timezone, localDate, insight.notificationCategory,
        insight.title, insight.summary, 'insight:' + insight.dedupeKey,
        { insightType: insight.type, why: insight.explanation }
      );
    }
  }

  async function buildBriefing(workspace, settings, timezone, localDate) {
    const tables = workspace.data?.tables || {};
    const tasks = Array.isArray(tables.tasks) ? tables.tasks : [];
    const habits = Array.isArray(tables.habits) ? tables.habits : [];
    const habitLogs = Array.isArray(tables.habit_logs) ? tables.habit_logs : [];
    const calendarEvents = Array.isArray(tables.calendar_events) ? tables.calendar_events : [];
    const dueTasks = tasks.filter(task => !Number(task.done) && task.due_date === localDate)
      .sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0));
    const overdueTasks = tasks.filter(task => !Number(task.done) && task.due_date && task.due_date < localDate);
    const checked = new Set(habitLogs.filter(log => log.log_date === localDate).map(log => String(log.habit_id)));
    const habitsDue = habits.filter(habit => habit.active !== 0 && habit.active !== false)
      .map(habit => ({ id: habit.id, title: habit.title, emoji: habit.emoji, done: checked.has(String(habit.id)) }));
    const agenda = calendarEvents.filter(event => {
      if (!event.start_at) return false;
      try { return dateKeyInZone(new Date(event.start_at), timezone) === localDate; } catch { return false; }
    }).sort((a, b) => String(a.start_at).localeCompare(String(b.start_at)))
      .map(event => ({ id: event.id, title: event.title, startAt: event.start_at, endAt: event.end_at, allDay: !!event.all_day }));
    const nextAction = dueTasks[0] ? { type: 'task', id: dueTasks[0].id, title: dueTasks[0].title } :
      agenda[0] ? { type: 'calendar', id: agenda[0].id, title: agenda[0].title } :
      habitsDue.find(habit => !habit.done) ? { type: 'habit', id: habitsDue.find(habit => !habit.done).id, title: habitsDue.find(habit => !habit.done).title } : null;
    const briefing = {
      localDate, timezone,
      agenda,
      dueTasks: dueTasks.slice(0, 8).map(task => ({ id: task.id, title: task.title, priority: task.priority })),
      overdueTasks: overdueTasks.slice(0, 8).map(task => ({ id: task.id, title: task.title, dueDate: task.due_date })),
      habitsDue,
      nextAction,
      counts: { dueTasks: dueTasks.length, overdueTasks: overdueTasks.length, habitsDue: habitsDue.length, habitsComplete: habitsDue.filter(habit => habit.done).length, calendarEvents: agenda.length },
      explanation: 'This briefing is assembled from your saved tasks, calendar entries and habit check-ins for this local date.'
    };
    await admin.request('atlas_briefings?on_conflict=user_id,local_date', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: { user_id: workspace.user_id, local_date: localDate, briefing, generated_at: new Date().toISOString() }
    });
    return { localDate, dueTasks: dueTasks.length, habitsDue: habitsDue.length, calendarEvents: agenda.length };
  }

  async function buildWeeklyReview(workspace, settings, timezone, weekStart) {
    const weekEnd = addDays(weekStart, 7);
    const previousStart = addDays(weekStart, -7);
    const userFilter = 'user_id=eq.' + encodeURIComponent(workspace.user_id);
    const currentRows = await admin.request('progress_daily?select=module,metric,value,local_date&' + userFilter + '&local_date=gte.' + weekStart + '&local_date=lt.' + weekEnd + '&limit=1000');
    const previousRows = await admin.request('progress_daily?select=module,metric,value,local_date&' + userFilter + '&local_date=gte.' + previousStart + '&local_date=lt.' + weekStart + '&limit=1000');
    const aggregate = rows => {
      const totals = {};
      for (const row of rows || []) {
        if (!PROJECTION_MODULES.has(row.module)) continue;
        totals[row.metric] = (totals[row.metric] || 0) + Number(row.value || 0);
      }
      return totals;
    };
    const totals = aggregate(currentRows);
    const previous = aggregate(previousRows);
    const summary = 'This week: ' + (totals.tasks_completed || 0) + ' tasks completed, ' +
      (totals.focus_minutes || 0) + ' focus minutes, ' + (totals.habit_checkins || 0) +
      ' habit check-ins and ' + (totals.learning_items_completed || 0) + ' learning items completed.';
    const review = {
      weekStart, weekEnd: addDays(weekEnd, -1), timezone, totals, previous,
      summary,
      highlights: [
        { metric: 'tasks_completed', current: totals.tasks_completed || 0, previous: previous.tasks_completed || 0 },
        { metric: 'focus_minutes', current: totals.focus_minutes || 0, previous: previous.focus_minutes || 0 },
        { metric: 'habit_checkins', current: totals.habit_checkins || 0, previous: previous.habit_checkins || 0 },
        { metric: 'learning_items_completed', current: totals.learning_items_completed || 0, previous: previous.learning_items_completed || 0 }
      ],
      explanation: 'This review is calculated from your event-backed daily progress projections for the selected week and the preceding week. It does not use private notes or Qur’an records.'
    };
    await admin.request('atlas_weekly_reviews?on_conflict=user_id,week_start', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: { user_id: workspace.user_id, week_start: weekStart, review, generated_at: new Date().toISOString() }
    });
    await insertNotification(workspace.user_id, settings, timezone, weekEnd, 'weekly_review', 'Your weekly review is ready', summary,
      'weekly-review:' + weekStart, { weekStart });
    return { weekStart, metrics: Object.keys(totals).length };
  }

  async function generateInsights(workspace, settings, timezone, localDate) {
    const userId = workspace.user_id;
    const tables = workspace.data?.tables || {};
    const since = addDays(localDate, -14);
    const events = await admin.request(
      'activity_events?select=type,entity_id,local_date,payload,occurred_at&user_id=eq.' + encodeURIComponent(userId) +
      '&module=in.(actions,goals,habits,learning,growth,calendar,residence)&local_date=gte.' + since +
      '&order=occurred_at.desc&limit=1000'
    );
    const goals = Array.isArray(tables.goals) ? tables.goals : [];
    for (const goal of goals.filter(item => !['completed', 'archived'].includes(String(item.status || '').toLowerCase()))) {
      const lastAction = (events || []).find(event => event.type === 'task.completed' && String(event.payload?.goalId || '') === String(goal.id));
      if (!lastAction) {
        await insertInsight(userId, settings, timezone, localDate, {
          type: 'goal_no_linked_action',
          title: 'A goal could use one next action',
          summary: 'No linked task completion has been recorded for “' + String(goal.title || 'this goal') + '” in the last 14 days.',
          explanation: 'Atlas found an active goal and checked the last 14 days of task.completed events for a matching goalId. No linked completion was found. This is a suggestion only; Atlas has not changed your goal or tasks.',
          evidence: { goalId: String(goal.id), goalTitle: goal.title, windowDays: 14, lastLinkedActionAt: null },
          priority: 'normal',
          dedupeKey: 'goal-no-action:' + String(goal.id) + ':' + mondayWeekStart(localDate),
          notificationCategory: 'goals'
        });
      }
    }

    const paths = Array.isArray(tables.learning_paths) ? tables.learning_paths : [];
    const lessons = Array.isArray(tables.learning_lessons) ? tables.learning_lessons : [];
    const recentStudyLessonIds = new Set((events || []).filter(event => event.type === 'learning.study_logged').map(event => String(event.payload?.lessonId || '')));
    for (const path of paths.filter(item => String(item.status || '').toLowerCase() === 'active')) {
      const pathLessonIds = lessons.filter(lesson => String(lesson.path_id) === String(path.id)).map(lesson => String(lesson.id));
      if (pathLessonIds.length && !pathLessonIds.some(id => recentStudyLessonIds.has(id))) {
        await insertInsight(userId, settings, timezone, localDate, {
          type: 'learning_path_stalled',
          title: 'A learning path has gone quiet',
          summary: 'There has been no study activity on “' + String(path.title || 'this path') + '” in the last 14 days.',
          explanation: 'Atlas checked the last 14 days of learning.study_logged events against the lessons in this active path. No matching study event was found. You can resume, change the path or leave it as it is.',
          evidence: { pathId: String(path.id), pathTitle: path.title, lessonCount: pathLessonIds.length, windowDays: 14 },
          priority: 'low',
          dedupeKey: 'learning-stalled:' + String(path.id) + ':' + mondayWeekStart(localDate),
          notificationCategory: 'learning'
        });
      }
    }

    const tomorrow = addDays(localDate, 1);
    const calendar = Array.isArray(tables.calendar_events) ? tables.calendar_events : [];
    const tomorrowEvents = calendar.filter(event => {
      if (!event.start_at) return false;
      try { return dateKeyInZone(new Date(event.start_at), timezone) === tomorrow; } catch { return false; }
    });
    const scheduledMinutes = tomorrowEvents.reduce((sum, event) => {
      if (event.all_day) return sum + 8 * 60;
      const start = new Date(event.start_at).getTime();
      const end = event.end_at ? new Date(event.end_at).getTime() : start + 60 * 60_000;
      return sum + Math.max(0, Math.min(24 * 60, (end - start) / 60_000));
    }, 0);
    if (scheduledMinutes >= 360) {
      await insertInsight(userId, settings, timezone, localDate, {
        type: 'tomorrow_overloaded',
        title: 'Tomorrow looks heavily scheduled',
        summary: 'Your calendar currently contains about ' + (scheduledMinutes / 60).toFixed(1) + ' scheduled hours tomorrow.',
        explanation: 'Atlas summed the durations of calendar entries whose start time falls on ' + tomorrow + ' in ' + timezone + '. The six-hour threshold was reached. This is a planning signal, not a judgement; you decide whether to move anything.',
        evidence: { localDate: tomorrow, eventCount: tomorrowEvents.length, scheduledMinutes, thresholdMinutes: 360 },
        priority: 'high',
        dedupeKey: 'tomorrow-overloaded:' + tomorrow,
        notificationCategory: 'system'
      });
    }
    return { generated: true, goalChecks: goals.length, learningPathChecks: paths.length, tomorrowEvents: tomorrowEvents.length };
  }

  async function streakRisk(workspace, settings, timezone, localDate) {
    const enabled = jsonSetting(settings, 'streaks_enabled_modules', ['habits']);
    if (!Array.isArray(enabled) || !enabled.includes('habits') || !notificationsEnabled(settings, 'habits')) return { skipped: 'preferences' };
    const habits = rowsFor(workspace.data, 'habits').filter(habit => habit.active !== 0 && habit.active !== false);
    const events = await admin.request(
      'activity_events?select=type,entity_id,local_date,payload,occurred_at&user_id=eq.' + encodeURIComponent(workspace.user_id) +
      '&module=eq.habits&local_date=gte.' + addDays(localDate, -14) + '&local_date=lte.' + localDate +
      '&order=occurred_at.desc&limit=1000'
    );
    const byHabit = habitDateSets(workspace, events, localDate);
    const weekStart = mondayWeekStart(localDate);
    let created = 0;
    for (const habit of habits) {
      const dates = byHabit.get(String(habit.id)) || new Set();
      if (dates.has(localDate)) continue;
      const streak = calculateHabitStreak(dates, localDate);
      if (streak <= 0) continue;
      let missedBeforeToday = 0;
      for (let day = weekStart; day < localDate; day = addDays(day, 1)) {
        if (!dates.has(day)) missedBeforeToday += 1;
      }
      if (missedBeforeToday < 1) continue;
      const inserted = await insertNotification(
        workspace.user_id, settings, timezone, localDate, 'habits',
        'A habit streak may need attention',
        'One recovery day has already been used this week for “' + String(habit.title || 'this habit') + '”. A check-in today keeps the streak from breaking.',
        'streak-risk:' + localDate + ':' + String(habit.id),
        { habitId: String(habit.id), streak, weekStart }
      );
      if (inserted) created += 1;
    }
    return { created };
  }

  async function dispatchNotifications(workspacesByUser) {
    const queued = await admin.request('atlas_notifications?select=id,user_id,category,local_date,scheduled_at,dedupe_key&channel=eq.in_app&status=eq.queued&scheduled_at=lte.' + encodeURIComponent(new Date().toISOString()) + '&order=scheduled_at.asc&limit=200');
    let delivered = 0;
    for (const item of queued || []) {
      const workspace = workspacesByUser.get(item.user_id);
      if (!workspace) continue;
      const settings = settingsFor(workspace.data);
      const timezone = safeTimeZone(settings.timezone);
      const clock = clockInZone(new Date(), timezone);
      if (!notificationsEnabled(settings, item.category)) {
        await admin.request('atlas_notifications?id=eq.' + encodeURIComponent(item.id), {
          method: 'PATCH', headers: { Prefer: 'return=minimal' },
          body: { status: 'dismissed' }
        });
        continue;
      }
      if (isQuietNow(settings, clock)) {
        await admin.request('atlas_notifications?id=eq.' + encodeURIComponent(item.id), {
          method: 'PATCH', headers: { Prefer: 'return=minimal' },
          body: { scheduled_at: new Date(Date.now() + 15 * 60_000).toISOString() }
        });
        continue;
      }
      const todayFilter = 'user_id=eq.' + encodeURIComponent(item.user_id) + '&local_date=eq.' + clock.localDate +
        '&status=in.(delivered,read)&channel=eq.in_app&select=id&limit=4';
      const deliveredToday = await admin.request('atlas_notifications?' + todayFilter);
      if ((deliveredToday || []).length >= 3) {
        await admin.request('atlas_notifications?id=eq.' + encodeURIComponent(item.id), {
          method: 'PATCH', headers: { Prefer: 'return=minimal' },
          body: { scheduled_at: new Date(Date.now() + 60 * 60_000).toISOString(), local_date: clock.localDate }
        });
        continue;
      }
      await admin.request('atlas_notifications?id=eq.' + encodeURIComponent(item.id), {
        method: 'PATCH', headers: { Prefer: 'return=minimal' },
        body: { status: 'delivered', delivered_at: new Date().toISOString(), local_date: clock.localDate }
      });
      delivered += 1;
    }
    return { delivered, inspected: (queued || []).length };
  }

  async function integrityAudit() {
    const workspaces = await admin.request('personal_os_workspaces?select=user_id,version,schema_version,data&limit=1000');
    let oversized = 0;
    for (const workspace of workspaces || []) {
      const bytes = Buffer.byteLength(JSON.stringify(workspace.data || {}), 'utf8');
      if (bytes > 4 * 1024 * 1024) oversized += 1;
    }
    return { workspaces: (workspaces || []).length, oversizedSnapshots: oversized };
  }

  async function processWorkspace(workspace) {
    const settings = settingsFor(workspace.data);
    const timezone = safeTimeZone(settings.timezone);
    const clock = clockInZone(new Date(), timezone);
    const localDate = clock.localDate;
    const userId = workspace.user_id;

    if (clock.hour >= 6) {
      await runJob('briefing.build', userId + ':' + localDate, userId, () => buildBriefing(workspace, settings, timezone, localDate));
    }
    if (clock.hour >= 7) {
      await runJob('insights.generate', userId + ':' + localDate, userId, () => generateInsights(workspace, settings, timezone, localDate));
    }
    if (clock.weekday === 'Sun' && clock.hour >= 18) {
      const weekStart = mondayWeekStart(localDate);
      await runJob('review.weekly', userId + ':' + weekStart, userId, () => buildWeeklyReview(workspace, settings, timezone, weekStart));
    }
    if (clock.hour >= 20) {
      await runJob('streak.risk', userId + ':' + localDate, userId, () => streakRisk(workspace, settings, timezone, localDate));
    }
  }

  async function tick() {
    if (active || stopped) return;
    active = true;
    let leaseClaimed = false;
    try {
      leaseClaimed = await admin.rpc('claim_atlas_job_lease', {
        p_job_name: 'atlas.scheduler.tick',
        p_owner_id: ownerId,
        p_lease_seconds: 300
      });
      if (!leaseClaimed) return;
      const workspaces = await admin.request('personal_os_workspaces?select=user_id,data,version,schema_version&limit=1000');
      const byUser = new Map((workspaces || []).map(workspace => [workspace.user_id, workspace]));
      for (const workspace of workspaces || []) {
        if (stopped) break;
        try { await processWorkspace(workspace); } catch (error) {
          console.error(JSON.stringify({ event: 'atlas.scheduler.user_failed', message: error.message }));
        }
      }
      const minuteKey = String(Math.floor(Date.now() / 60_000));
      await runJob('notify.dispatch', minuteKey, null, () => dispatchNotifications(byUser));
      const utc = new Date();
      if (utc.getUTCHours() >= 3) {
        const utcDate = utc.toISOString().slice(0, 10);
        await runJob('integrity.audit', utcDate, null, integrityAudit);
      }
    } catch (error) {
      console.error(JSON.stringify({ event: 'atlas.scheduler.tick_failed', environment: appEnv, message: error.message }));
    } finally {
      if (leaseClaimed) {
        try { await admin.rpc('release_atlas_job_lease', { p_job_name: 'atlas.scheduler.tick', p_owner_id: ownerId }); } catch (error) {
          console.error(JSON.stringify({ event: 'atlas.scheduler.lease_release_failed', message: error.message }));
        }
      }
      active = false;
    }
  }

  const timer = setInterval(() => { void tick(); }, intervalMs);
  if (typeof timer.unref === 'function') timer.unref();
  console.info(JSON.stringify({ event: 'atlas.scheduler.started', environment: appEnv, intervalMs }));
  void tick();
  return () => {
    stopped = true;
    clearInterval(timer);
    console.info(JSON.stringify({ event: 'atlas.scheduler.stopped', environment: appEnv }));
  };
}

module.exports = {
  startAtlasScheduler,
  rowsFor,
  settingsFor,
  jsonSetting,
  dateKeyInZone,
  clockInZone,
  addDays,
  mondayWeekStart,
  safeTimeZone,
  isQuietNow
};
