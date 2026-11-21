const importTables = [
  'goals','projects','project_milestones','tasks','modules','learning_paths','learning_lessons','learning_resources',
  'learning_study_logs','sessions','calendar_events','notes','reviews','habits','habit_logs',
  'prayer_logs','quran_logs','tahajjud_logs','faith_logs','self_control_logs','self_control_trackers',
  'self_control_entries','rhythm_records','reading_items','settings','email_events','login_events','xp_events','achievement_unlocks','weekly_challenges','feedback_logs','reading_items'
];

const insertOrder = [
  'goals','projects','project_milestones','tasks','modules','learning_paths','learning_lessons','learning_resources',
  'learning_study_logs','sessions','calendar_events','notes','reviews','habits','habit_logs',
  'prayer_logs','quran_logs','tahajjud_logs','faith_logs','self_control_logs','self_control_trackers',
  'self_control_entries','rhythm_records','reading_items','settings','email_events','login_events','xp_events','achievement_unlocks','weekly_challenges','feedback_logs','reading_items'
];

function restoreBackup(db, backup, allowedTables) {
  if (!backup || typeof backup !== 'object' || Array.isArray(backup)) {
    throw new Error('Choose a valid Personal OS backup file.');
  }
  const rowsByTable = {};
  for (const table of importTables) {
    if (!allowedTables.includes(table)) continue;
    if (!['projects','project_milestones','calendar_events','reviews','email_events','faith_logs','login_events','xp_events','achievement_unlocks','weekly_challenges','feedback_logs','reading_items','rhythm_records','reading_items'].includes(table) && !Array.isArray(backup[table])) {
      throw new Error(`The backup is missing its ${table} section.`);
    }
    const rows = backup[table] ?? [];
    if (!Array.isArray(rows)) throw new Error(`The ${table} section is invalid.`);
    const tableInfo = db.prepare(`PRAGMA table_info(${table})`).all();
    const primaryKeys = tableInfo.filter(column => column.pk).map(column => column.name);
    rowsByTable[table] = rows.map(row => {
      if (!row || typeof row !== 'object' || Array.isArray(row) ||
          primaryKeys.some(column => !Object.prototype.hasOwnProperty.call(row, column))) {
        throw new Error(`A record in ${table} is missing its primary key.`);
      }
      return row;
    });
  }
  const order = insertOrder.filter(table => allowedTables.includes(table));
  const restore = db.transaction(() => {
    for (const table of [...order].reverse()) db.prepare(`DELETE FROM ${table}`).run();
    for (const table of order) {
      const rows = rowsByTable[table];
      if (!rows?.length) continue;
      const columns = db.prepare(`PRAGMA table_info(${table})`).all().map(column => column.name);
      const inserts = new Map();
      for (const row of rows) {
        const rowColumns = columns.filter(column => Object.prototype.hasOwnProperty.call(row, column));
        const key = rowColumns.join(',');
        if (!inserts.has(key)) inserts.set(key, db.prepare(`INSERT INTO ${table} (${key}) VALUES (${rowColumns.map(() => '?').join(',')})`));
        inserts.get(key).run(...rowColumns.map(column => row[column]));
      }
    }
  });
  restore();
  return order.reduce((sum, table) => sum + rowsByTable[table].length, 0);
}

module.exports = { restoreBackup };
