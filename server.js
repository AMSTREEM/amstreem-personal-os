const express = require('express');
const path = require('path');
const Database = require('better-sqlite3');
const { restoreBackup } = require('./workspace-backup');
const { AsyncLocalStorage } = require('node:async_hooks');
const app = express();
const PORT = process.env.PORT || 3000;
const supabaseConfig = require('./supabase-config.json');
const ownerUserId = process.env.ADMIN_USER_ID || supabaseConfig.ownerUserId;
const tenantContext = new AsyncLocalStorage();
const userLocks = new Map();
const workspaceTables = [
  'tasks','modules','learning_paths','learning_lessons','learning_resources',
  'learning_study_logs','sessions','notes','settings','goals','habits','habit_logs',
  'prayer_logs','quran_logs','tahajjud_logs','self_control_logs',
  'self_control_trackers','self_control_entries','email_events'
];
function currentDb() {
  const context = tenantContext.getStore();
  if (!context?.db) throw new Error('Workspace database accessed outside an authenticated request.');
  return context.db;
}
const db = new Proxy({}, { get(_target, prop) { const active = currentDb(); const value = active[prop]; return typeof value === 'function' ? value.bind(active) : value; } });
app.use(express.json({limit:'10mb'}));
app.use(express.static(path.join(__dirname, 'public')));

// A short per-account queue prevents overlapping requests from overwriting
// each other's workspace snapshots on a single application instance.
async function acquireUserLock(userId) {
  const previous = userLocks.get(userId) || Promise.resolve();
  let release;
  const current = new Promise(resolve => { release = resolve; });
  const tail = previous.then(() => current);
  userLocks.set(userId, tail);
  await previous;
  return () => { release(); if (userLocks.get(userId) === tail) userLocks.delete(userId); };
}
async function readWorkspaceSnapshot(userId, token) {
  const url = `${supabaseConfig.url}/rest/v1/personal_os_workspaces?select=data&user_id=eq.${encodeURIComponent(userId)}`;
  const response = await fetch(url, { headers: { apikey: supabaseConfig.publishableKey, Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error('Could not load your saved workspace from Supabase.');
  const rows = await response.json();
  return rows[0]?.data || null;
}
function createWorkspaceDatabase(snapshot) {
  const workspaceDb = new Database(':memory:');
  try {
    workspaceDb.pragma('foreign_keys = ON');
    workspaceDb.exec(schemaSql);
  if (snapshot?.format === 'personal-os-sqlite-snapshot-v1' && snapshot.tables && typeof snapshot.tables === 'object') {
    const insertRows = workspaceDb.transaction(() => {
      for (const table of workspaceTables) {
        const rows = Array.isArray(snapshot.tables[table]) ? snapshot.tables[table] : [];
        if (!rows.length) continue;
        const tableInfo = workspaceDb.prepare(`PRAGMA table_info(${table})`).all();
        const columns = tableInfo.map(column => column.name);
        const primaryKeys = tableInfo.filter(column => column.pk).map(column => column.name);
        const inserts = new Map();
        for (const row of rows) {
          if (!row || typeof row !== 'object' || Array.isArray(row) ||
              primaryKeys.some(column => !Object.prototype.hasOwnProperty.call(row, column))) {
            throw new Error(`Saved workspace contains an invalid ${table} record. No data was changed.`);
          }
          const rowColumns = columns.filter(column => Object.prototype.hasOwnProperty.call(row, column));
          const key = rowColumns.join(',');
          if (!inserts.has(key)) inserts.set(key, workspaceDb.prepare(`INSERT INTO ${table} (${key}) VALUES (${rowColumns.map(() => '?').join(',')})`));
          inserts.get(key).run(...rowColumns.map(column => row[column]));
        }
      }
    });
    insertRows();
  } else if (snapshot && Object.keys(snapshot).length) {
    // Preserve unknown legacy workspace payloads rather than silently replacing them.
    throw new Error('An older workspace format was found. It must be exported and migrated before this app can write to it.');
  }
  for (const [key, value] of [['daily_target','80'],['display_name',''],['north_star','']]) {
    workspaceDb.prepare('INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)').run(key,value);
  }
    return workspaceDb;
  } catch (error) {
    workspaceDb.close();
    throw error;
  }
}
function serializeWorkspaceDatabase(workspaceDb) {
  const tables = {};
  for (const table of workspaceTables) tables[table] = workspaceDb.prepare(`SELECT * FROM ${table}`).all();
  return { format: 'personal-os-sqlite-snapshot-v1', tables };
}
async function writeWorkspaceSnapshot(userId, token, workspaceDb) {
  const response = await fetch(`${supabaseConfig.url}/rest/v1/personal_os_workspaces`, {
    method: 'POST',
    headers: {
      apikey: supabaseConfig.publishableKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal'
    },
    body: JSON.stringify({ user_id: userId, data: serializeWorkspaceDatabase(workspaceDb), updated_at: new Date().toISOString() })
  });
  if (!response.ok) throw new Error('Supabase rejected the workspace save.');
}
app.use('/api', async (req, res, next) => {
  let release;
  let workspaceDb;
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token) return res.status(401).json({ error: 'Please sign in to continue.' });
    const response = await fetch(`${supabaseConfig.url}/auth/v1/user`, {
      headers: { apikey: supabaseConfig.publishableKey, Authorization: `Bearer ${token}` }
    });
    if (!response.ok) return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
    const user = await response.json();
    const adminRoute = req.path.startsWith('/admin');
    if (adminRoute && user.id !== ownerUserId) return res.status(403).json({ error: 'Administrator access required.' });
    req.user = user;
    release = await acquireUserLock(user.id);
    const snapshot = await readWorkspaceSnapshot(user.id, token);
    workspaceDb = createWorkspaceDatabase(snapshot);
    const context = { userId: user.id, db: workspaceDb };
    tenantContext.run(context, () => {
      const originalEnd = res.end.bind(res);
      let ending = false;
      res.end = (...args) => {
        if (ending) return res;
        ending = true;
        writeWorkspaceSnapshot(user.id, token, workspaceDb)
          .then(() => originalEnd(...args))
          .catch(error => {
            console.error('Workspace save failed:', error.message);
            res.statusCode = 503;
            res.removeHeader('Content-Length');
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            originalEnd(JSON.stringify({ error: 'Your workspace could not be saved. Please retry.' }));
          })
          .finally(() => { workspaceDb.close(); release?.(); });
        return res;
      };
      res.on('close', () => { if (!ending) { workspaceDb.close(); release?.(); } });
      next();
    });
  } catch (error) {
    console.error('Workspace request failed:', error.message);
    workspaceDb?.close();
    release?.();
    if (!res.headersSent) res.status(503).json({ error: 'Your workspace is temporarily unavailable. Please retry.' });
  }
});
app.get('/api/session', (req, res) => res.json({ user: { id: req.user.id, email: req.user.email, name: req.user.user_metadata?.full_name || '', username: req.user.user_metadata?.username || '' }, role: req.user.id === ownerUserId ? 'admin' : 'user' }));

const schemaSql = `
CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, detail TEXT DEFAULT '', category TEXT DEFAULT 'Learning', due_date TEXT, done INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS modules (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, track TEXT DEFAULT 'Personal Learning', status TEXT DEFAULT 'Not started', minutes INTEGER DEFAULT 0, sort_order INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS learning_paths (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, subject TEXT DEFAULT '', description TEXT DEFAULT '', target_date TEXT, status TEXT NOT NULL DEFAULT 'active', created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS learning_lessons (id INTEGER PRIMARY KEY AUTOINCREMENT, path_id INTEGER NOT NULL, title TEXT NOT NULL, content TEXT DEFAULT '', notes TEXT DEFAULT '', status TEXT NOT NULL DEFAULT 'Not started', sort_order INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(path_id) REFERENCES learning_paths(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS learning_resources (id INTEGER PRIMARY KEY AUTOINCREMENT, lesson_id INTEGER NOT NULL, title TEXT NOT NULL, url TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(lesson_id) REFERENCES learning_lessons(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS learning_study_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, lesson_id INTEGER NOT NULL, log_date TEXT NOT NULL, minutes INTEGER NOT NULL, reflection TEXT DEFAULT '', created_at TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(lesson_id) REFERENCES learning_lessons(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, session_date TEXT NOT NULL, minutes INTEGER NOT NULL, focus TEXT NOT NULL, reflection TEXT DEFAULT '', created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, body TEXT DEFAULT '', updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS goals (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, detail TEXT DEFAULT '', target_date TEXT, status TEXT DEFAULT 'active', created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS habits (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, emoji TEXT DEFAULT '✦', sort_order INTEGER DEFAULT 0, active INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS habit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, habit_id INTEGER NOT NULL, log_date TEXT NOT NULL, UNIQUE(habit_id,log_date), FOREIGN KEY(habit_id) REFERENCES habits(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS prayer_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, prayer_date TEXT NOT NULL, prayer TEXT NOT NULL, completed INTEGER NOT NULL DEFAULT 0, on_time INTEGER NOT NULL DEFAULT 0, UNIQUE(prayer_date,prayer));
CREATE TABLE IF NOT EXISTS quran_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, log_date TEXT NOT NULL, activity TEXT NOT NULL CHECK(activity IN ('memorisation','revision')), surah TEXT NOT NULL, ayah_start INTEGER, ayah_end INTEGER, pages REAL DEFAULT 0, juz INTEGER, reflection TEXT DEFAULT '', created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS tahajjud_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, log_date TEXT NOT NULL UNIQUE, woke_up INTEGER NOT NULL DEFAULT 0, prayed INTEGER NOT NULL DEFAULT 0, note TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS self_control_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, category TEXT NOT NULL CHECK(category IN ('porn','masturbation')), log_date TEXT NOT NULL, outcome TEXT NOT NULL CHECK(outcome IN ('clean','slip')), urge_level INTEGER DEFAULT 0, trigger TEXT DEFAULT '', response TEXT DEFAULT '', note TEXT DEFAULT '', created_at TEXT DEFAULT CURRENT_TIMESTAMP, UNIQUE(category,log_date));
CREATE TABLE IF NOT EXISTS self_control_trackers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, symbol TEXT NOT NULL DEFAULT '◇', start_date TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS self_control_entries (id INTEGER PRIMARY KEY AUTOINCREMENT, tracker_id INTEGER NOT NULL, log_date TEXT NOT NULL, outcome TEXT NOT NULL CHECK(outcome IN ('clean','slip')), urge_level INTEGER DEFAULT 0, trigger TEXT DEFAULT '', response TEXT DEFAULT '', note TEXT DEFAULT '', created_at TEXT DEFAULT CURRENT_TIMESTAMP, UNIQUE(tracker_id,log_date), FOREIGN KEY(tracker_id) REFERENCES self_control_trackers(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS email_events (event TEXT PRIMARY KEY, sent_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
`;
const one=(s,...a)=>db.prepare(s).get(...a), all=(s,...a)=>db.prepare(s).all(...a);
const dateKey=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
// New installs start with no seeded habits; users define their own rituals.
async function sendResendEmail(to, subject, html) {
 const key=process.env.RESEND_API_KEY, from=process.env.EMAIL_FROM;
 if(!key||!from) throw new Error('Email is not configured. Add RESEND_API_KEY and EMAIL_FROM to the server environment.');
 const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({from,to,subject,html})});
 if(!response.ok){const detail=await response.text();throw new Error(`Email provider rejected the request: ${detail.slice(0,300)}`)}
 return response.json();
}
app.get('/api/admin/users',async(req,res)=>{
 try {
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!key)return res.status(503).json({error:'Admin directory is not configured. Add SUPABASE_SERVICE_ROLE_KEY to the server environment.'});
  let page=1,users=[],more=true;
  while(more&&page<=100){const r=await fetch(`${supabaseConfig.url}/auth/v1/admin/users?page=${page}&per_page=100`,{headers:{apikey:key,Authorization:`Bearer ${key}`}});if(!r.ok)throw new Error('Could not retrieve the account directory.');const payload=await r.json();const batch=payload.users||[];users.push(...batch);more=batch.length===100;page++;}
  res.json({users:users.map(u=>({id:u.id,name:String(u.user_metadata?.full_name||u.user_metadata?.name||'—').slice(0,80),username:String(u.user_metadata?.username||'').slice(0,30),email:u.email||'',created_at:u.created_at||null,email_confirmed:!!u.email_confirmed_at})).sort((a,b)=>(b.created_at||'').localeCompare(a.created_at||''))});
 } catch(e){res.status(502).json({error:e.message||'Could not load users.'})}
});
app.post('/api/admin/thank-you',async(req,res)=>{
 try {
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!key)return res.status(503).json({error:'Admin directory is not configured.'});
  const subject=String(req.body.subject||'Thank you for using Personal OS').trim().slice(0,120);
  const message=String(req.body.message||'Thank you for being part of Personal OS. I appreciate you giving the system a place in your daily life.').trim().slice(0,4000);
  if(!message)return res.status(400).json({error:'Write a message first.'});
  let recipients=[];
  if(req.body.all===true){const r=await fetch(`${supabaseConfig.url}/auth/v1/admin/users?page=1&per_page=1000`,{headers:{apikey:key,Authorization:`Bearer ${key}`}});if(!r.ok)throw new Error('Could not retrieve recipients.');recipients=(await r.json()).users||[];}
  else if(Array.isArray(req.body.userIds)){const ids=new Set(req.body.userIds.filter(x=>typeof x==='string'));const r=await fetch(`${supabaseConfig.url}/auth/v1/admin/users?page=1&per_page=1000`,{headers:{apikey:key,Authorization:`Bearer ${key}`}});if(!r.ok)throw new Error('Could not retrieve recipients.');recipients=(await r.json()).users.filter(u=>ids.has(u.id));}
  else return res.status(400).json({error:'Choose recipients.'});
  const targets=recipients.filter(u=>u.email&&u.id!==ownerUserId);let sent=0,failed=0;
  for(const user of targets){const name=String(user.user_metadata?.full_name||'there').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const body=message.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])).replace(/\n/g,'<br>');try{await sendResendEmail(user.email,subject,`<div style="font-family:Arial,sans-serif;line-height:1.7;color:#222"><p>Hello ${name},</p><p>${body}</p><p>— Personal OS</p></div>`);sent++;}catch(e){failed++;console.error('Email delivery failed:',e.message)}}
  res.json({sent,failed,total:targets.length});
 }catch(e){res.status(502).json({error:e.message||'Could not send emails.'})}
});
app.post('/api/welcome',async(req,res)=>{
 try {
  const already=one('SELECT 1 FROM email_events WHERE event=?','welcome');if(already)return res.json({sent:false});
  if(!req.user.email)return res.json({sent:false});
  // Email is optional during local development; never let it interrupt workspace loading.
  if(!process.env.RESEND_API_KEY||!process.env.EMAIL_FROM)return res.json({sent:false,skipped:true,reason:'Email is not configured.'});
  const name=String(req.user.user_metadata?.full_name||'there').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  await sendResendEmail(req.user.email,'Welcome to Personal OS',`<div style="font-family:Arial,sans-serif;line-height:1.7;color:#222"><p>Hello ${name},</p><p>Thank you for joining Personal OS. Your space is yours to shape—your records remain private to your account.</p><p>— Personal OS</p></div>`);
  db.prepare('INSERT OR IGNORE INTO email_events(event) VALUES(?)').run('welcome');res.json({sent:true});
 }catch(e){console.error('Welcome email:',e.message);res.json({sent:false,error:'Your account is ready, but the welcome email could not be sent.'})}
});

app.get('/api/overview',(req,res)=>{
 const today=dateKey();const d=new Date();d.setDate(d.getDate()-((d.getDay()+6)%7));const ws=dateKey(d);
 const todayMin=one('SELECT COALESCE(SUM(minutes),0) n FROM sessions WHERE session_date=?',today).n;
 const weekMin=one('SELECT COALESCE(SUM(minutes),0) n FROM sessions WHERE session_date>=?',ws).n;
 const completed=one("SELECT COUNT(*) n FROM learning_lessons WHERE status='Completed'").n,moduleTotal=one('SELECT COUNT(*) n FROM learning_lessons').n;
 const sessions=all("SELECT session_date,SUM(minutes) minutes FROM sessions WHERE session_date>=date(?,'-6 days') GROUP BY session_date ORDER BY session_date",today);
 const dates=all('SELECT DISTINCT session_date FROM sessions ORDER BY session_date DESC').map(x=>x.session_date);let streak=0,cursor=new Date();if(!dates.includes(today))cursor.setDate(cursor.getDate()-1);const set=new Set(dates);while(set.has(dateKey(cursor))){streak++;cursor.setDate(cursor.getDate()-1)}
 res.json({today,todayMin,weekMin,completed,moduleTotal,sessions,streak,dailyTarget:Number(one("SELECT value FROM settings WHERE key='daily_target'").value),openTasks:one('SELECT COUNT(*) n FROM tasks WHERE done=0').n});
});
app.get('/api/tasks',(q,s)=>s.json(all('SELECT * FROM tasks ORDER BY done ASC, COALESCE(due_date,\'9999-12-31\') ASC,id DESC')));
app.post('/api/tasks',(q,s)=>{const {title,detail='',category='Learning',due_date=null}=q.body;if(!title?.trim())return s.status(400).json({error:'A task title is required.'});const r=db.prepare('INSERT INTO tasks(title,detail,category,due_date) VALUES(?,?,?,?)').run(title.trim(),detail,category,due_date||null);s.json(one('SELECT * FROM tasks WHERE id=?',r.lastInsertRowid));});
app.patch('/api/tasks/:id',(q,s)=>{const t=one('SELECT * FROM tasks WHERE id=?',q.params.id);if(!t)return s.status(404).json({error:'Task not found'});db.prepare('UPDATE tasks SET done=?,title=COALESCE(?,title),detail=COALESCE(?,detail),category=COALESCE(?,category),due_date=COALESCE(?,due_date) WHERE id=?').run(q.body.done===undefined?t.done:(q.body.done?1:0),q.body.title??null,q.body.detail??null,q.body.category??null,q.body.due_date??null,q.params.id);s.json(one('SELECT * FROM tasks WHERE id=?',q.params.id));});
app.delete('/api/tasks/:id',(q,s)=>{db.prepare('DELETE FROM tasks WHERE id=?').run(q.params.id);s.json({ok:true});});
app.get('/api/modules',(q,s)=>s.json(all('SELECT * FROM modules ORDER BY sort_order')));
app.patch('/api/modules/:id',(q,s)=>{const {status}=q.body;if(!['Not started','In progress','Completed'].includes(status))return s.status(400).json({error:'Invalid status'});db.prepare('UPDATE modules SET status=? WHERE id=?').run(status,q.params.id);s.json(one('SELECT * FROM modules WHERE id=?',q.params.id));});

// Learning Studio: user-created paths, lessons, notes, resources and study records.
app.get('/api/learning/paths',(q,s)=>{
 const paths=all("SELECT * FROM learning_paths WHERE status!='archived' ORDER BY created_at DESC,id DESC");
 s.json(paths.map(p=>{const lessons=all('SELECT * FROM learning_lessons WHERE path_id=? ORDER BY sort_order,id',p.id);return {...p,lessons:lessons.map(l=>({...l,resources:all('SELECT * FROM learning_resources WHERE lesson_id=? ORDER BY id DESC',l.id),study_logs:all('SELECT * FROM learning_study_logs WHERE lesson_id=? ORDER BY log_date DESC,id DESC LIMIT 10',l.id),study_minutes:one('SELECT COALESCE(SUM(minutes),0) n FROM learning_study_logs WHERE lesson_id=?',l.id).n}))}}));
});
app.post('/api/learning/paths',(q,s)=>{const {title,subject='',description='',target_date=null}=q.body;if(!title?.trim())return s.status(400).json({error:'Give your learning path a title.'});const r=db.prepare('INSERT INTO learning_paths(title,subject,description,target_date) VALUES(?,?,?,?)').run(title.trim(),subject.trim(),description.trim(),target_date||null);s.json(one('SELECT * FROM learning_paths WHERE id=?',r.lastInsertRowid));});
app.patch('/api/learning/paths/:id',(q,s)=>{const p=one('SELECT * FROM learning_paths WHERE id=?',q.params.id);if(!p)return s.status(404).json({error:'Learning path not found.'});const d=q.body;db.prepare('UPDATE learning_paths SET title=?,subject=?,description=?,target_date=? WHERE id=?').run(d.title??p.title,d.subject??p.subject,d.description??p.description,d.target_date===undefined?p.target_date:(d.target_date||null),p.id);s.json(one('SELECT * FROM learning_paths WHERE id=?',p.id));});
app.delete('/api/learning/paths/:id',(q,s)=>{db.prepare('DELETE FROM learning_paths WHERE id=?').run(q.params.id);s.json({ok:true});});
app.post('/api/learning/paths/:id/lessons',(q,s)=>{const p=one('SELECT id FROM learning_paths WHERE id=?',q.params.id);if(!p)return s.status(404).json({error:'Learning path not found.'});if(!q.body.title?.trim())return s.status(400).json({error:'Give the lesson a title.'});const order=one('SELECT COALESCE(MAX(sort_order),0)+1 n FROM learning_lessons WHERE path_id=?',p.id).n;const r=db.prepare('INSERT INTO learning_lessons(path_id,title,content,sort_order) VALUES(?,?,?,?)').run(p.id,q.body.title.trim(),q.body.content||'',order);s.json(one('SELECT * FROM learning_lessons WHERE id=?',r.lastInsertRowid));});
app.patch('/api/learning/lessons/:id',(q,s)=>{const l=one('SELECT * FROM learning_lessons WHERE id=?',q.params.id);if(!l)return s.status(404).json({error:'Lesson not found.'});const d=q.body;if(d.status!==undefined&&!['Not started','In progress','Completed'].includes(d.status))return s.status(400).json({error:'Invalid lesson status.'});db.prepare('UPDATE learning_lessons SET title=?,content=?,notes=?,status=? WHERE id=?').run(d.title??l.title,d.content??l.content,d.notes??l.notes,d.status??l.status,l.id);s.json(one('SELECT * FROM learning_lessons WHERE id=?',l.id));});
app.delete('/api/learning/lessons/:id',(q,s)=>{db.prepare('DELETE FROM learning_lessons WHERE id=?').run(q.params.id);s.json({ok:true});});
app.post('/api/learning/lessons/:id/resources',(q,s)=>{const l=one('SELECT id FROM learning_lessons WHERE id=?',q.params.id);if(!l)return s.status(404).json({error:'Lesson not found.'});const {title,url}=q.body;if(!title?.trim()||!url?.trim())return s.status(400).json({error:'Add a resource name and URL.'});let parsed;try{parsed=new URL(url)}catch{return s.status(400).json({error:'Enter a valid URL.'})}if(!['http:','https:'].includes(parsed.protocol))return s.status(400).json({error:'Only web links are supported.'});const r=db.prepare('INSERT INTO learning_resources(lesson_id,title,url) VALUES(?,?,?)').run(l.id,title.trim(),parsed.href);s.json(one('SELECT * FROM learning_resources WHERE id=?',r.lastInsertRowid));});
app.delete('/api/learning/resources/:id',(q,s)=>{db.prepare('DELETE FROM learning_resources WHERE id=?').run(q.params.id);s.json({ok:true});});
app.post('/api/learning/lessons/:id/study',(q,s)=>{const l=one('SELECT id FROM learning_lessons WHERE id=?',q.params.id);if(!l)return s.status(404).json({error:'Lesson not found.'});const minutes=Number(q.body.minutes);if(!Number.isInteger(minutes)||minutes<1||minutes>600)return s.status(400).json({error:'Study time must be between 1 and 600 minutes.'});const r=db.prepare('INSERT INTO learning_study_logs(lesson_id,log_date,minutes,reflection) VALUES(?,?,?,?)').run(l.id,q.body.log_date||dateKey(),minutes,q.body.reflection||'');s.json(one('SELECT * FROM learning_study_logs WHERE id=?',r.lastInsertRowid));});
app.get('/api/learning/study-logs',(q,s)=>s.json(all('SELECT sl.*,ll.title lesson_title,lp.title path_title FROM learning_study_logs sl JOIN learning_lessons ll ON ll.id=sl.lesson_id JOIN learning_paths lp ON lp.id=ll.path_id ORDER BY sl.log_date DESC,sl.id DESC LIMIT 50')));

app.get('/api/sessions',(q,s)=>s.json(all('SELECT * FROM sessions ORDER BY session_date DESC,id DESC LIMIT 100')));
app.post('/api/sessions',(q,s)=>{const {session_date,minutes,focus,reflection=''}=q.body;if(!minutes||minutes<1||minutes>600||!focus?.trim())return s.status(400).json({error:'Add a focus and a valid duration (1–600 minutes).'});const r=db.prepare('INSERT INTO sessions(session_date,minutes,focus,reflection) VALUES(?,?,?,?)').run(session_date||dateKey(),Math.round(minutes),focus.trim(),reflection);s.json(one('SELECT * FROM sessions WHERE id=?',r.lastInsertRowid));});
app.get('/api/notes',(q,s)=>s.json(all('SELECT * FROM notes ORDER BY updated_at DESC')));
app.post('/api/notes',(q,s)=>{const {title,body=''}=q.body;if(!title?.trim())return s.status(400).json({error:'Give your note a title.'});const r=db.prepare('INSERT INTO notes(title,body) VALUES(?,?)').run(title.trim(),body);s.json(one('SELECT * FROM notes WHERE id=?',r.lastInsertRowid));});
app.put('/api/notes/:id',(q,s)=>{db.prepare('UPDATE notes SET title=?,body=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(q.body.title,q.body.body,q.params.id);s.json(one('SELECT * FROM notes WHERE id=?',q.params.id));});
app.delete('/api/notes/:id',(q,s)=>{db.prepare('DELETE FROM notes WHERE id=?').run(q.params.id);s.json({ok:true});});
app.get('/api/goals',(q,s)=>s.json(all("SELECT * FROM goals WHERE status!='archived' ORDER BY status='completed',target_date")));
app.post('/api/goals',(q,s)=>{if(!q.body.title?.trim())return s.status(400).json({error:'A goal needs a title.'});const r=db.prepare('INSERT INTO goals(title,detail,target_date) VALUES(?,?,?)').run(q.body.title.trim(),q.body.detail||'',q.body.target_date||null);s.json(one('SELECT * FROM goals WHERE id=?',r.lastInsertRowid));});
app.patch('/api/goals/:id',(q,s)=>{db.prepare('UPDATE goals SET status=? WHERE id=?').run(q.body.status,q.params.id);s.json(one('SELECT * FROM goals WHERE id=?',q.params.id));});
app.delete('/api/goals/:id',(q,s)=>{db.prepare('DELETE FROM goals WHERE id=?').run(q.params.id);s.json({ok:true});});
app.get('/api/habits',(q,s)=>{const date=q.query.date||dateKey();s.json(all('SELECT h.*,CASE WHEN l.id IS NULL THEN 0 ELSE 1 END done FROM habits h LEFT JOIN habit_logs l ON l.habit_id=h.id AND l.log_date=? WHERE h.active=1 ORDER BY h.sort_order',date));});
app.post('/api/habits/:id/toggle',(q,s)=>{const date=q.body.date||dateKey();const exists=one('SELECT id FROM habit_logs WHERE habit_id=? AND log_date=?',q.params.id,date);if(exists)db.prepare('DELETE FROM habit_logs WHERE id=?').run(exists.id);else db.prepare('INSERT OR IGNORE INTO habit_logs(habit_id,log_date) VALUES(?,?)').run(q.params.id,date);s.json({ok:true,done:!exists});});
app.post('/api/habits',(q,s)=>{if(!q.body.title?.trim())return s.status(400).json({error:'Give the ritual a name.'});const r=db.prepare('INSERT INTO habits(title,emoji,sort_order) VALUES(?,?,COALESCE((SELECT MAX(sort_order)+1 FROM habits),1))').run(q.body.title.trim(),q.body.emoji||'✦');s.json(one('SELECT * FROM habits WHERE id=?',r.lastInsertRowid));});
app.delete('/api/habits/:id',(q,s)=>{db.prepare('DELETE FROM habits WHERE id=?').run(q.params.id);s.json({ok:true});});
const prayers=['Fajr','Dhuhr','Asr','Maghrib','Isha'];
app.get('/api/deen/summary',(q,s)=>{const date=q.query.date||dateKey();const logs=all('SELECT prayer,completed,on_time FROM prayer_logs WHERE prayer_date=?',date);const quran=all('SELECT activity,COALESCE(SUM(pages),0) pages,COUNT(*) entries FROM quran_logs WHERE log_date=? GROUP BY activity',date);const tah=one('SELECT woke_up,prayed FROM tahajjud_logs WHERE log_date=?',date)||{woke_up:0,prayed:0};s.json({date,prayers:prayers.map(p=>logs.find(x=>x.prayer===p)||{prayer:p,completed:0,on_time:0}),quran,tahajjud:tah});});
app.patch('/api/deen/prayer',(q,s)=>{const {date= dateKey(),prayer,completed,on_time}=q.body;if(!prayers.includes(prayer))return s.status(400).json({error:'Unknown prayer.'});const old=one('SELECT * FROM prayer_logs WHERE prayer_date=? AND prayer=?',date,prayer)||{completed:0,on_time:0};const c=completed===undefined?old.completed:(completed?1:0);const t=on_time===undefined?old.on_time:(on_time?1:0);db.prepare('INSERT INTO prayer_logs(prayer_date,prayer,completed,on_time) VALUES(?,?,?,?) ON CONFLICT(prayer_date,prayer) DO UPDATE SET completed=excluded.completed,on_time=excluded.on_time').run(date,prayer,c,t);s.json(one('SELECT * FROM prayer_logs WHERE prayer_date=? AND prayer=?',date,prayer));});
app.patch('/api/deen/tahajjud',(q,s)=>{const date=q.body.date||dateKey();const old=one('SELECT * FROM tahajjud_logs WHERE log_date=?',date)||{woke_up:0,prayed:0,note:''};const w=q.body.woke_up===undefined?old.woke_up:(q.body.woke_up?1:0);const p=q.body.prayed===undefined?old.prayed:(q.body.prayed?1:0);db.prepare('INSERT INTO tahajjud_logs(log_date,woke_up,prayed,note) VALUES(?,?,?,?) ON CONFLICT(log_date) DO UPDATE SET woke_up=excluded.woke_up,prayed=excluded.prayed,note=excluded.note').run(date,w,p,q.body.note??old.note);s.json(one('SELECT * FROM tahajjud_logs WHERE log_date=?',date));});
app.get('/api/deen/quran',(q,s)=>s.json(all('SELECT * FROM quran_logs ORDER BY log_date DESC,id DESC LIMIT 100')));
app.post('/api/deen/quran',(q,s)=>{const {log_date=dateKey(),activity,surah,ayah_start=null,ayah_end=null,pages=0,juz=null,reflection=''}=q.body;if(!['memorisation','revision'].includes(activity)||!surah?.trim())return s.status(400).json({error:'Choose an activity and enter a surah.'});if(Number(pages)<0||Number(pages)>100||Number(ayah_start)<0||Number(ayah_end)<0)return s.status(400).json({error:'Check the ayah and page values.'});const r=db.prepare('INSERT INTO quran_logs(log_date,activity,surah,ayah_start,ayah_end,pages,juz,reflection) VALUES(?,?,?,?,?,?,?,?)').run(log_date,activity,surah.trim(),ayah_start||null,ayah_end||null,Number(pages)||0,juz||null,reflection);s.json(one('SELECT * FROM quran_logs WHERE id=?',r.lastInsertRowid));});
app.delete('/api/deen/quran/:id',(q,s)=>{db.prepare('DELETE FROM quran_logs WHERE id=?').run(q.params.id);s.json({ok:true});});
// Freedom tracker: fully user-defined habits with discreet, separate check-ins.
function dayDiff(from,to){const a=new Date(from+'T12:00:00'),b=new Date(to+'T12:00:00');return Math.max(0,Math.round((b-a)/86400000));}
function freedomSummary(tracker,today){
 const latestSlip=one("SELECT log_date FROM self_control_entries WHERE tracker_id=? AND outcome='slip' ORDER BY log_date DESC,id DESC LIMIT 1",tracker.id);
 const effectiveSlip=latestSlip&&latestSlip.log_date>=tracker.start_date?latestSlip:null;
 const streak=effectiveSlip?dayDiff(effectiveSlip.log_date,today):dayDiff(tracker.start_date,today)+1;
 const todayEntry=one('SELECT * FROM self_control_entries WHERE tracker_id=? AND log_date=?',tracker.id,today);
 const slips=all("SELECT log_date FROM self_control_entries WHERE tracker_id=? AND outcome='slip' AND log_date>=? ORDER BY log_date ASC,id ASC",tracker.id,tracker.start_date);
 let anchor=tracker.start_date,best=0;
 for(const slip of slips){best=Math.max(best,dayDiff(anchor,slip.log_date));anchor=slip.log_date;}
 return {...tracker,last_slip:effectiveSlip?.log_date||null,streak:Math.max(0,streak),today:todayEntry,longest_days:Math.max(streak,best)};
}
app.get('/api/self-control',(q,s)=>{
 const today=q.query.date||dateKey();
 const trackers=all('SELECT * FROM self_control_trackers WHERE active=1 ORDER BY created_at,id');
 const logs=all('SELECT e.*,t.name AS tracker_name,t.symbol AS tracker_symbol FROM self_control_entries e JOIN self_control_trackers t ON t.id=e.tracker_id ORDER BY e.log_date DESC,e.id DESC LIMIT 100');
 s.json({date:today,summary:trackers.map(t=>freedomSummary(t,today)),logs});
});
app.post('/api/self-control',(q,s)=>{
 const name=String(q.body.name||'').trim(),symbol=String(q.body.symbol||'◇').trim().slice(0,4)||'◇',start_date=q.body.start_date||dateKey();
 if(!name||name.length>60)return s.status(400).json({error:'Give this habit a name (up to 60 characters).'});
 if(!/^\d{4}-\d{2}-\d{2}$/.test(start_date)||start_date>dateKey())return s.status(400).json({error:'Choose a valid starting date no later than today.'});
 const r=db.prepare('INSERT INTO self_control_trackers(name,symbol,start_date) VALUES(?,?,?)').run(name,symbol,start_date);
 s.json(one('SELECT * FROM self_control_trackers WHERE id=?',r.lastInsertRowid));
});
app.patch('/api/self-control/:id',(q,s)=>{
 const tracker=one('SELECT * FROM self_control_trackers WHERE id=? AND active=1',q.params.id);if(!tracker)return s.status(404).json({error:'Habit not found.'});
 const name=q.body.name===undefined?tracker.name:String(q.body.name).trim(),symbol=q.body.symbol===undefined?tracker.symbol:(String(q.body.symbol).trim().slice(0,4)||'◇');
 if(!name||name.length>60)return s.status(400).json({error:'Give this habit a name (up to 60 characters).'});
 db.prepare('UPDATE self_control_trackers SET name=?,symbol=? WHERE id=?').run(name,symbol,tracker.id);s.json(one('SELECT * FROM self_control_trackers WHERE id=?',tracker.id));
});
app.patch('/api/self-control/:id/start',(q,s)=>{
 const {start_date}=q.body;if(!/^\d{4}-\d{2}-\d{2}$/.test(start_date||'')||start_date>dateKey())return s.status(400).json({error:'Choose a valid starting date no later than today.'});
 const r=db.prepare('UPDATE self_control_trackers SET start_date=? WHERE id=? AND active=1').run(start_date,q.params.id);if(!r.changes)return s.status(404).json({error:'Habit not found.'});s.json({ok:true});
});
app.post('/api/self-control/:id/checkin',(q,s)=>{
 const tracker=one('SELECT id FROM self_control_trackers WHERE id=? AND active=1',q.params.id);if(!tracker)return s.status(404).json({error:'Habit not found.'});
 const {date=dateKey(),outcome,urge_level=0,trigger='',response='',note=''}=q.body;
 if(!['clean','slip'].includes(outcome))return s.status(400).json({error:'Choose a clean day or a reset.'});
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date>dateKey())return s.status(400).json({error:'Enter a valid date no later than today.'});
 const urge=Math.max(0,Math.min(5,Number(urge_level)||0));
 db.prepare('INSERT INTO self_control_entries(tracker_id,log_date,outcome,urge_level,trigger,response,note) VALUES(?,?,?,?,?,?,?) ON CONFLICT(tracker_id,log_date) DO UPDATE SET outcome=excluded.outcome,urge_level=excluded.urge_level,trigger=excluded.trigger,response=excluded.response,note=excluded.note').run(tracker.id,date,outcome,urge,String(trigger).slice(0,120),String(response).slice(0,120),String(note).slice(0,500));
 s.json({ok:true});
});
app.delete('/api/self-control/:id',(q,s)=>{const r=db.prepare('DELETE FROM self_control_trackers WHERE id=?').run(q.params.id);if(!r.changes)return s.status(404).json({error:'Habit not found.'});s.json({ok:true});});
app.delete('/api/self-control/entries/:id',(q,s)=>{db.prepare('DELETE FROM self_control_entries WHERE id=?').run(q.params.id);s.json({ok:true});});
app.get('/api/settings',(q,s)=>s.json(Object.fromEntries(all('SELECT key,value FROM settings').map(x=>[x.key,x.value]))));
app.patch('/api/settings',(q,s)=>{const allowed=['daily_target','display_name','username','north_star'];const tx=db.transaction(()=>{for(const k of allowed)if(q.body[k]!==undefined){let v=String(q.body[k]).trim();if(k==='daily_target')v=String(Math.max(10,Math.min(600,Number(v)||80)));db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(k,v)}});tx();s.json(Object.fromEntries(all('SELECT key,value FROM settings').map(x=>[x.key,x.value])));});
app.get('/api/export',(q,s)=>{s.setHeader('Content-Disposition','attachment; filename="personal-os-backup.json"');s.json({exportedAt:new Date().toISOString(),tasks:all('SELECT * FROM tasks'),modules:all('SELECT * FROM modules'),learning_paths:all('SELECT * FROM learning_paths'),learning_lessons:all('SELECT * FROM learning_lessons'),learning_resources:all('SELECT * FROM learning_resources'),learning_study_logs:all('SELECT * FROM learning_study_logs'),sessions:all('SELECT * FROM sessions'),notes:all('SELECT * FROM notes'),goals:all('SELECT * FROM goals'),habits:all('SELECT * FROM habits'),habit_logs:all('SELECT * FROM habit_logs'),prayer_logs:all('SELECT * FROM prayer_logs'),quran_logs:all('SELECT * FROM quran_logs'),tahajjud_logs:all('SELECT * FROM tahajjud_logs'),self_control_logs:all('SELECT * FROM self_control_logs'),self_control_trackers:all('SELECT * FROM self_control_trackers'),self_control_entries:all('SELECT * FROM self_control_entries'),settings:all('SELECT * FROM settings'),email_events:all('SELECT * FROM email_events')});});
app.post('/api/import',(q,s)=>{
 try {
  const imported=restoreBackup(db,q.body,workspaceTables);
  s.json({ok:true,imported});
 } catch(error) {
  s.status(400).json({error:error.message||'The backup could not be imported.'});
 }
});
app.listen(PORT,()=>console.log(`Personal OS running at http://localhost:${PORT}`));
