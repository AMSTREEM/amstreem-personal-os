'use strict';

function weekStartFor(dateKey) {
  const date = new Date(dateKey + 'T12:00:00Z');
  const offset = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - offset);
  return date.toISOString().slice(0, 10);
}

function calculateHabitStreak(checkedDates, throughDate) {
  const checked = checkedDates instanceof Set ? checkedDates : new Set(checkedDates || []);
  const cursor = new Date(throughDate + 'T12:00:00Z');
  if (Number.isNaN(cursor.getTime())) throw new TypeError('A valid YYYY-MM-DD date is required.');
  if (!checked.has(throughDate)) cursor.setUTCDate(cursor.getUTCDate() - 1);
  const recoveryWeeks = new Set();
  let streak = 0;
  let examined = 0;
  while (examined < 3660) {
    const day = cursor.toISOString().slice(0, 10);
    if (checked.has(day)) {
      streak += 1;
    } else {
      const week = weekStartFor(day);
      if (recoveryWeeks.has(week)) break;
      recoveryWeeks.add(week);
    }
    cursor.setUTCDate(cursor.getUTCDate() - 1);
    examined += 1;
  }
  return streak;
}

module.exports = { calculateHabitStreak, weekStartFor };
