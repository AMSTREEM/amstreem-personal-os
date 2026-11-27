const PRIMARY_KEYS = {
  goals: ['id'], projects: ['id'], project_milestones: ['id'], tasks: ['id'], modules: ['id'],
  learning_paths: ['id'], learning_lessons: ['id'], learning_resources: ['id'], learning_study_logs: ['id'],
  sessions: ['id'], calendar_events: ['id'], notes: ['id'], reviews: ['id'], settings: ['key'],
  habits: ['id'], habit_logs: ['id'], prayer_logs: ['id'], quran_logs: ['id'], tahajjud_logs: ['id'],
  faith_logs: ['id'], self_control_logs: ['id'], self_control_trackers: ['id'], self_control_entries: ['id'],
  rhythm_records: ['id'], reading_items: ['id'], email_events: ['event'], login_events: ['id'],
  xp_events: ['id'], achievement_unlocks: ['achievement_id'], weekly_challenges: ['week_start'],
  feedback_logs: ['id']
};

function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  }
  return JSON.stringify(value);
}

function indexRows(rows, keys, table, label) {
  const result = new Map();
  for (const row of rows || []) {
    if (!row || typeof row !== 'object' || Array.isArray(row) || keys.some(key => row[key] === undefined || row[key] === null)) {
      throw new Error(`Cannot safely replay ${table}: ${label} contains a row without its primary key.`);
    }
    const id = JSON.stringify(keys.map(key => row[key]));
    if (result.has(id)) throw new Error(`Cannot safely replay ${table}: duplicate primary key in ${label}.`);
    result.set(id, row);
  }
  return result;
}

// Replays a request's row-level SQLite delta onto the latest committed snapshot.
// It merges independent rows and refuses same-row edits/deletes rather than guessing.
function replayWorkspaceMutation(baseSnapshot, localSnapshot, latestSnapshot) {
  if (!baseSnapshot?.tables || !localSnapshot?.tables || !latestSnapshot?.tables) {
    throw new Error('Cannot replay this workspace mutation because a snapshot is incomplete.');
  }
  const merged = { ...latestSnapshot, tables: { ...latestSnapshot.tables } };
  for (const [table, keys] of Object.entries(PRIMARY_KEYS)) {
    const base = indexRows(baseSnapshot.tables[table], keys, table, 'base snapshot');
    const local = indexRows(localSnapshot.tables[table], keys, table, 'request snapshot');
    const latest = indexRows(latestSnapshot.tables[table], keys, table, 'latest snapshot');
    const output = new Map(latest);
    const ids = new Set([...base.keys(), ...local.keys()]);
    for (const id of ids) {
      const before = base.get(id);
      const after = local.get(id);
      const current = latest.get(id);
      if (!before) {
        if (!after) continue;
        if (!current) output.set(id, after);
        else if (canonical(current) !== canonical(after)) {
          throw new Error(`Workspace conflict in ${table}: a concurrently inserted record uses the same key.`);
        }
        continue;
      }
      if (!after) {
        if (!current) continue;
        if (canonical(current) === canonical(before)) output.delete(id);
        else throw new Error(`Workspace conflict in ${table}: the record changed while this request deleted it.`);
        continue;
      }
      if (canonical(after) === canonical(before)) continue;
      if (!current || canonical(current) === canonical(before)) output.set(id, after);
      else if (canonical(current) !== canonical(after)) {
        throw new Error(`Workspace conflict in ${table}: the same record was changed by another request.`);
      }
    }
    merged.tables[table] = [...output.values()];
  }
  return merged;
}

module.exports = { replayWorkspaceMutation };
