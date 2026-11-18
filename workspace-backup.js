const importTables = [
  'tasks','modules','learning_paths','learning_lessons','learning_resources',
  'learning_study_logs','sessions','notes','goals','habits','habit_logs',
  'prayer_logs','quran_logs','tahajjud_logs','self_control_logs',
  'self_control_trackers','self_control_entries','settings','email_events'
];

const insertOrder = [
  'tasks','modules','learning_paths','learning_lessons','learning_resources',
  'learning_study_logs','sessions','notes','goals','habits','habit_logs',
  'prayer_logs','quran_logs','tahajjud_logs','self_control_logs',
  'self_control_trackers','self_control_entries','settings','email_events'
];

function restoreBackup(db, backup, allowedTables) {
  if (!backup || typeof backup !== 'object' || Array.isArray(backup)) {
    throw new Error('Choose a valid Personal OS backup file.');
  }
  const rowsByTable = {};
  for (const table of importTables) {
    if (!allowedTables.includes(table)) continue;
    if (table !== 'email_events' && !Array.isArray(backup[table])) {
      throw new Error(`The backup is missing its ${table} section.`);
    }
    const rows = backup[table] ?? [];
    if (!Array.isArray(rows)) throw new Error(`The ${table} section is invalid.`);
    const columns = db.prepare(`PRAGMA table_info(${table})`).all().map(column => column.name);
    rowsByTable[table] = rows.map(row => {
      if (!row || typeof row !== 'object' || Array.isArray(row) ||
          columns.some(column => !Object.prototype.hasOwnProperty.call(row, column))) {
        throw new Error(`A record in ${table} is incomplete.`);
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
      const insert = db.prepare(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`);
      for (const row of rows) insert.run(...columns.map(column => row[column]));
    }
  });
  restore();
  return order.reduce((sum, table) => sum + rowsByTable[table].length, 0);
}

module.exports = { restoreBackup };
