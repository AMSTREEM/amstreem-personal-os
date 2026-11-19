const express = require('express');
const path = require('path');
const Database = require('better-sqlite3');
const { restoreBackup } = require('./workspace-backup');
const { AsyncLocalStorage } = require('node:async_hooks');
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;
const supabaseConfig = require('./supabase-config.json');
const supabaseOrigin = new URL(supabaseConfig.url).origin;
const supabaseHost = new URL(supabaseConfig.url).host;

app.use((req,res,next)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy','same-origin');
  res.setHeader('Cross-Origin-Resource-Policy','same-origin');
  res.setHeader('Content-Security-Policy',[
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "script-src 'self' https://cdn.jsdelivr.net",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    `connect-src 'self' ${supabaseOrigin} wss://${supabaseHost}`,
    "upgrade-insecure-requests"
  ].join('; '));
  if (process.env.NODE_ENV === 'production' && req.secure) {
    res.setHeader('Strict-Transport-Security','max-age=31536000; includeSubDomains');
  }
  if (req.path.startsWith('/api/')) res.setHeader('Cache-Control','no-store');
  next();
});

// Small in-process limits protect the single Render instance from accidental
// request floods. These are deliberately conservative and do not store tokens.
const rateBuckets = new Map();
function consumeRateLimit(key, max, windowMs = 60_000) {
  const now = Date.now();
  let bucket = rateBuckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs };
    rateBuckets.set(key, bucket);
  }
  bucket.count += 1;
  if (rateBuckets.size > 10000) {
    for (const [bucketKey, value] of rateBuckets) {
      if (now >= value.resetAt) rateBuckets.delete(bucketKey);
    }
  }
  return bucket.count > max ? Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) : 0;
}
function rateLimit({ max, windowMs = 60_000, prefix = 'ip' }) {
  return (req, res, next) => {
    const retryAfter = consumeRateLimit(`${prefix}:${req.ip || req.socket.remoteAddress || 'unknown'}`, max, windowMs);
    if (retryAfter) {
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({ error: 'Too many requests. Please wait and try again.' });
    }
    next();
  };
}
app.get('/healthz', (req,res) => res.status(200).json({ ok: true }));
app.use('/api/admin', rateLimit({ max: 30, prefix: 'admin' }));
app.use('/api', rateLimit({ max: 120 }));
const ownerUserId = process.env.ADMIN_USER_ID || supabaseConfig.ownerUserId;
const tenantContext = new AsyncLocalStorage();
const userLocks = new Map();
const workspaceTables = [
  'tasks','modules','learning_paths','learning_lessons','learning_resources',
  'learning_study_logs','sessions','notes','settings','goals','habits','habit_logs',
  'prayer_logs','quran_logs','tahajjud_logs','faith_logs','self_control_logs',
  'self_control_trackers','self_control_entries','email_events','login_events','xp_events','feedback_logs'
];
function currentDb() {
  const context = tenantContext.getStore();
  if (!context?.db) throw new Error('Workspace database accessed outside an authenticated request.');
  return context.db;
}
const db = new Proxy({}, { get(_target, prop) { const active = currentDb(); const value = active[prop]; return typeof value === 'function' ? value.bind(active) : value; } });
// Keep ordinary API payloads small; allow larger JSON only for explicit backup imports.
app.use('/api/import', express.json({ limit: '10mb' }));
app.use(express.json({ limit: '1mb' }));
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
    for (const table of workspaceTables) {
      if (!Array.isArray(snapshot.tables[table]) && !['faith_logs','login_events','xp_events','feedback_logs'].includes(table)) {
        throw new Error(`Saved workspace is missing its ${table} section. No data was changed.`);
      }
    }
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
  for (const [key, value] of [['daily_target','80'],['display_name',''],['north_star',''],['religion',''],['leaderboard_name','']]) {
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
// Username sign-in is resolved server-side so account email addresses are never exposed to the browser.
app.post('/api/auth/username-login', rateLimit({ max: 8, windowMs: 60_000, prefix: 'username-login' }), async (req, res) => {
  const username=String(req.body?.username||'').trim().replace(/^@/,'').toLowerCase();
  const password=String(req.body?.password||'');
  if(!/^[a-z0-9_]{3,24}$/.test(username)||!password||password.length>256) return res.status(400).json({error:'Enter a valid username and password.'});
  const key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!key)return res.status(503).json({error:'Username sign-in is temporarily unavailable. Please use your email address.'});
  try {
    let page=1,matches=[],more=true;
    while(more&&page<=100){
      const listing=await fetch(`${supabaseConfig.url}/auth/v1/admin/users?page=${page}&per_page=100`,{headers:{apikey:key,Authorization:`Bearer ${key}`}});
      if(!listing.ok)throw new Error('Account lookup unavailable.');
      const payload=await listing.json(),batch=payload.users||[];
      matches.push(...batch.filter(user=>username==='admin'?user.id===ownerUserId:String(user.user_metadata?.username||'').toLowerCase()===username));
      more=batch.length===100;page++;
    }
    if(matches.length!==1||!matches[0].email)return res.status(401).json({error:'Invalid username or password.'});
    if(username==='admin'&&String(matches[0].user_metadata?.username||'').toLowerCase()!=='admin'){
      const updated=await fetch(`${supabaseConfig.url}/auth/v1/admin/users/${matches[0].id}`,{method:'PUT',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({user_metadata:{...(matches[0].user_metadata||{}),username:'admin'}})});
      if(!updated.ok)throw new Error('Could not configure the administrator username.');
    }
    const auth=await fetch(`${supabaseConfig.url}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:supabaseConfig.publishableKey,'Content-Type':'application/json'},body:JSON.stringify({email:matches[0].email,password})});
    if(!auth.ok)return res.status(401).json({error:'Invalid username or password.'});
    const session=await auth.json();
    return res.json({access_token:session.access_token,refresh_token:session.refresh_token});
  }catch(error){console.error('Username sign-in failed:',error.message);return res.status(503).json({error:'Username sign-in is temporarily unavailable. Please try your email address.'});}
});
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
    const accountRetryAfter = consumeRateLimit(`account:${user.id}`, 90);
    if (accountRetryAfter) {
      res.setHeader('Retry-After', String(accountRetryAfter));
      return res.status(429).json({ error: 'Too many requests for this account. Please wait and try again.' });
    }
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
        if (req.method === 'GET' || req.method === 'HEAD') {
          workspaceDb.close();
          release?.();
          return originalEnd(...args);
        }
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
CREATE TABLE IF NOT EXISTS faith_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, log_date TEXT NOT NULL, activity TEXT NOT NULL CHECK(activity IN ('bible','prayer','reflection','worship','service')), completed INTEGER NOT NULL DEFAULT 1, UNIQUE(log_date,activity));
CREATE TABLE IF NOT EXISTS self_control_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, category TEXT NOT NULL CHECK(category IN ('porn','masturbation')), log_date TEXT NOT NULL, outcome TEXT NOT NULL CHECK(outcome IN ('clean','slip')), urge_level INTEGER DEFAULT 0, trigger TEXT DEFAULT '', response TEXT DEFAULT '', note TEXT DEFAULT '', created_at TEXT DEFAULT CURRENT_TIMESTAMP, UNIQUE(category,log_date));
CREATE TABLE IF NOT EXISTS self_control_trackers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, symbol TEXT NOT NULL DEFAULT '◇', start_date TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS self_control_entries (id INTEGER PRIMARY KEY AUTOINCREMENT, tracker_id INTEGER NOT NULL, log_date TEXT NOT NULL, outcome TEXT NOT NULL CHECK(outcome IN ('clean','slip')), urge_level INTEGER DEFAULT 0, trigger TEXT DEFAULT '', response TEXT DEFAULT '', note TEXT DEFAULT '', created_at TEXT DEFAULT CURRENT_TIMESTAMP, UNIQUE(tracker_id,log_date), FOREIGN KEY(tracker_id) REFERENCES self_control_trackers(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS email_events (event TEXT PRIMARY KEY, sent_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS login_events (id INTEGER PRIMARY KEY AUTOINCREMENT, login_date TEXT NOT NULL, logged_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS xp_events (id INTEGER PRIMARY KEY AUTOINCREMENT, event_key TEXT NOT NULL UNIQUE, category TEXT NOT NULL, points INTEGER NOT NULL CHECK(points > 0), awarded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS feedback_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL, message TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
`;
const one=(s,...a)=>db.prepare(s).get(...a), all=(s,...a)=>db.prepare(s).all(...a);
function awardXp(eventKey,category,points){if(!eventKey||!Number.isInteger(points)||points<1)return;db.prepare('INSERT OR IGNORE INTO xp_events(event_key,category,points) VALUES(?,?,?)').run(eventKey,category,points);}
const dateKey=(d=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Lagos',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
// New installs start with no seeded habits; users define their own rituals.
async function sendResendEmail(to, subject, html) {
 const key=process.env.RESEND_API_KEY, from=process.env.EMAIL_FROM;
 if(!key||!from) throw new Error('Email is not configured. Add RESEND_API_KEY and EMAIL_FROM to the server environment.');
 const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({from,to,subject,html})});
 if(!response.ok){const detail=await response.text();throw new Error(`Email provider rejected the request: ${detail.slice(0,300)}`)}
 return response.json();
}
async function atlasRest(req,tableQuery,options={}) {
 const token=(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
 const headers={apikey:supabaseConfig.publishableKey,Authorization:token?'Bearer '+token:'','Content-Type':'application/json',...(options.headers||{})};
 const response=await fetch(`${supabaseConfig.url}/rest/v1/${tableQuery}`,{method:options.method||'GET',headers,body:options.body===undefined?undefined:JSON.stringify(options.body)});
 const raw=await response.text();
 if(!response.ok)throw new Error('Supabase data request failed ('+response.status+').');
 return raw?JSON.parse(raw):null;
}
app.get('/api/feedback',(req,res)=>{const labels={feedback:'General feedback',suggestion:'Feature suggestion',bug:'Something is broken',complaint:'A complaint',other:'Something else'};res.json(all('SELECT id,type,message,created_at FROM feedback_logs ORDER BY id DESC LIMIT 50').map(row=>({...row,type_label:labels[row.type]||'Feedback'})));});
app.post('/api/feedback',async(req,res)=>{try{const type=String(req.body?.type||'feedback'),message=String(req.body?.message||'').trim();if(!['feedback','suggestion','bug','complaint','other'].includes(type))return res.status(400).json({error:'Choose a valid feedback category.'});if(message.length<5||message.length>4000)return res.status(400).json({error:'Your message must be between 5 and 4,000 characters.'});await atlasRest(req,'atlas_feedback',{method:'POST',headers:{Prefer:'return=minimal'},body:{user_id:req.user.id,category:type,message}});const result=db.prepare('INSERT INTO feedback_logs(type,message) VALUES(?,?)').run(type,message);res.status(201).json(one('SELECT id,type,message,created_at FROM feedback_logs WHERE id=?',result.lastInsertRowid));}catch(error){console.error('Feedback submission:',error.message);res.status(503).json({error:'Your feedback could not be delivered to the team. Please try again.'});}});
app.get('/api/admin/feedback',async(req,res)=>{try{const rows=await atlasRest(req,'atlas_feedback?select=id,user_id,category,message,status,created_at&order=created_at.desc&limit=200');const labels={feedback:'General feedback',suggestion:'Feature suggestion',bug:'Something is broken',complaint:'A complaint',other:'Something else'};const items=(rows||[]).map(item=>({id:item.id,type:item.category,type_label:labels[item.category]||'Feedback',message:item.message,status:item.status,created_at:item.created_at,user_ref:String(item.user_id).slice(-6).toUpperCase()}));try{const snapshot=await readWorkspaceSnapshot(req.user.id,(req.headers.authorization||'').replace(/^Bearer\s+/i,''));const legacy=snapshot?.tables?.feedback_logs||[];for(const item of legacy){if(!items.some(row=>row.message===item.message&&row.created_at===item.created_at))items.push({id:'legacy-'+item.id,type:item.type,type_label:labels[item.type]||'Feedback',message:item.message,status:'legacy',created_at:item.created_at,user_ref:'ADMIN'});}}catch{}items.sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));res.json(items.slice(0,200));}catch(error){console.error('Admin feedback inbox:',error.message);res.status(502).json({error:'The feedback inbox is temporarily unavailable.'});}});
app.patch('/api/admin/feedback/:id',async(req,res)=>{try{const id=Number(req.params.id),status=String(req.body?.status||'');if(!Number.isSafeInteger(id)||id<1||!['new','in_review','resolved'].includes(status))return res.status(400).json({error:'Choose a valid feedback status.'});const rows=await atlasRest(req,`atlas_feedback?id=eq.${id}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:{status}});if(!rows?.length)return res.status(404).json({error:'Feedback item not found.'});res.json(rows[0]);}catch(error){console.error('Feedback status update:',error.message);res.status(502).json({error:'Could not update this feedback item.'});}});
app.get('/api/announcements',async(req,res)=>{try{const [items,reads]=await Promise.all([atlasRest(req,'atlas_announcements?select=id,title,body,kind,published,created_at,published_at&order=created_at.desc&limit=100'),atlasRest(req,'atlas_announcement_reads?select=announcement_id,read_at')]);const readIds=new Set((reads||[]).map(row=>Number(row.announcement_id)));res.json({items:items||[],readIds:[...readIds]});}catch(error){console.error('Announcements:',error.message);res.status(502).json({error:'Announcements are temporarily unavailable.'});}});
app.post('/api/announcements',async(req,res)=>{try{const title=String(req.body?.title||'').trim(),body=String(req.body?.body||'').trim(),kind=String(req.body?.kind||'update');if(title.length<3||title.length>120||body.length<3||body.length>5000)return res.status(400).json({error:'Add a title and a message (up to 5,000 characters).'});if(!['update','feature','maintenance','important'].includes(kind))return res.status(400).json({error:'Choose a valid announcement type.'});const rows=await atlasRest(req,'atlas_announcements',{method:'POST',headers:{Prefer:'return=representation'},body:{title,body,kind,published:true,created_by:req.user.id,published_at:new Date().toISOString()}});res.status(201).json(rows?.[0]||{ok:true});}catch(error){console.error('Publish announcement:',error.message);res.status(502).json({error:'Could not publish this announcement.'});}});
app.post('/api/announcements/:id/read',async(req,res)=>{try{const id=Number(req.params.id);if(!Number.isSafeInteger(id)||id<1)return res.status(400).json({error:'Invalid announcement.'});await atlasRest(req,'atlas_announcement_reads',{method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=minimal'},body:{announcement_id:id,user_id:req.user.id}});res.json({ok:true});}catch(error){console.error('Announcement read receipt:',error.message);res.status(502).json({error:'Could not save this announcement as read.'});}});
app.post('/api/login-event',(req,res)=>{const date=dateKey();const last=one('SELECT login_date FROM login_events ORDER BY id DESC LIMIT 1');if(last?.login_date!==date)db.prepare('INSERT INTO login_events(login_date) VALUES(?)').run(date);res.json({ok:true});});
app.get('/api/leaderboard',async(q,s)=>{
 try{
  const key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!key)return s.status(503).json({error:'The leaderboard is temporarily unavailable.'});
  const response=await fetch(`${supabaseConfig.url}/rest/v1/personal_os_workspaces?select=user_id,data`,{headers:{apikey:key,Authorization:`Bearer ${key}`}});
  if(!response.ok)throw new Error('Could not read leaderboard totals.');
  const rows=await response.json(),month=dateKey().slice(0,7),members=[],history={};
  for(const row of rows){
   const tables=row.data?.tables||{},events=Array.isArray(tables.xp_events)?tables.xp_events:[],settings=Array.isArray(tables.settings)?Object.fromEntries(tables.settings.map(x=>[x.key,x.value])):{};
   const total=events.reduce((n,x)=>n+(Number(x.points)||0),0),monthly=events.reduce((n,x)=>n+(String(x.awarded_at||'').slice(0,7)===month?(Number(x.points)||0):0),0);
   const display=String(settings.leaderboard_name||'').trim().slice(0,24)||('Member '+String(row.user_id).slice(-4).toUpperCase());
   members.push({userId:row.user_id,display,xp:monthly,totalXp:total,public:settings.leaderboard_public!=='0'});
   if(settings.leaderboard_public!=='0')for(const e of events){const m=String(e.awarded_at||'').slice(0,7);if(!/^\d{4}-\d{2}$/.test(m))continue;const item=history[m]||(history[m]=new Map());item.set(row.user_id,{display,xp:(item.get(row.user_id)?.xp||0)+(Number(e.points)||0)});}
  }
  const visible=members.filter(m=>m.public).sort((a,b)=>b.xp-a.xp||b.totalXp-a.totalXp||a.display.localeCompare(b.display));
  const mine=members.find(m=>m.userId===q.user.id),myRank=mine?.public?visible.findIndex(m=>m.userId===q.user.id)+1:null;
  const top=visible.filter(x=>x.xp>0).slice(0,10).map((m,i)=>({rank:i+1,display:m.display,xp:m.xp,isYou:m.userId===q.user.id}));
  const champions=Object.entries(history).filter(([m])=>m<month).sort(([a],[b])=>b.localeCompare(a)).slice(0,6).map(([m,items])=>({month:m,winner:[...items.values()].sort((a,b)=>b.xp-a.xp)[0]||null}));
  s.json({month,top,mine:{rank:myRank,xp:mine?.xp||0,totalXp:mine?.totalXp||0,public:mine?.public!==false},champions});
 }catch(error){console.error('Leaderboard:',error.message);s.status(502).json({error:'The leaderboard is temporarily unavailable.'});}
});
app.get('/api/admin/analytics',async(req,res)=>{
 try {
  const key=process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!key)return res.status(503).json({error:'Admin analytics are not configured.'});
  const response=await fetch(`${supabaseConfig.url}/rest/v1/personal_os_workspaces?select=user_id,data`,{headers:{apikey:key,Authorization:`Bearer ${key}`}});
  if(!response.ok)throw new Error('Could not load aggregate workspace activity.');
  const rows=await response.json(),today=dateKey(),toDate=s=>new Date(s+'T12:00:00');
  const addDays=(date,n)=>{const d=toDate(date);d.setDate(d.getDate()+n);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
  const loginSets=rows.map(row=>new Set((row.data?.tables?.login_events||[]).map(x=>x.login_date).filter(x=>/^\\d{4}-\\d{2}-\\d{2}$/.test(x))));
  const active=(n)=>loginSets.filter(set=>[...set].some(date=>date>=addDays(today,-(n-1))&&date<=today)).length;
  const streaks=loginSets.map(set=>{let current=0,cursor=today;if(!set.has(cursor))cursor=addDays(cursor,-1);while(set.has(cursor)&&current<5000){current++;cursor=addDays(cursor,-1);}let best=0,run=0,prev=null;for(const date of [...set].sort()){run=prev&&Math.round((toDate(date)-toDate(prev))/86400000)===1?run+1:1;best=Math.max(best,run);prev=date;}return {current,best};});
  res.json({activeToday:active(1),activeWeek:active(7),activeMonth:active(30),loginsToday:loginSets.reduce((n,set)=>n+(set.has(today)?1:0),0),topCurrent:Math.max(0,...streaks.map(x=>x.current)),bestStreak:Math.max(0,...streaks.map(x=>x.best))});
 } catch(error){res.status(502).json({error:error.message||'Could not load analytics.'});}
});
app.get('/api/admin/users',async(req,res)=>{
 try {
  const key=process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!key)return res.status(503).json({error:'Admin directory is not configured. Add SUPABASE_SECRET_KEY to the server environment.'});
  let page=1,users=[],more=true;
  while(more&&page<=100){const r=await fetch(`${supabaseConfig.url}/auth/v1/admin/users?page=${page}&per_page=100`,{headers:{apikey:key,Authorization:`Bearer ${key}`}});if(!r.ok)throw new Error('Could not retrieve the account directory.');const payload=await r.json();const batch=payload.users||[];users.push(...batch);more=batch.length===100;page++;}
  res.json({email_configured:!!(process.env.RESEND_API_KEY&&process.env.EMAIL_FROM),users:users.map(u=>({id:u.id,name:String(u.user_metadata?.full_name||u.user_metadata?.name||'—').slice(0,80),username:String(u.user_metadata?.username||'').slice(0,30),email:u.email||'',created_at:u.created_at||null,email_confirmed:!!u.email_confirmed_at,thank_you_sent_at:u.app_metadata?.personal_os_thank_you?.status==='sent'?u.app_metadata.personal_os_thank_you.sent_at:null,thank_you_status:u.app_metadata?.personal_os_thank_you?.status||'not_sent'})).sort((a,b)=>(b.created_at||'').localeCompare(a.created_at||''))});
 } catch(e){res.status(502).json({error:e.message||'Could not load users.'})}
});
app.post('/api/admin/thank-you',async(req,res)=>{
 try {
  const key=process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!key)return res.status(503).json({error:'Admin directory is not configured.'});
  if(!process.env.RESEND_API_KEY||!process.env.EMAIL_FROM)return res.status(503).json({error:'Thank-you email is not activated yet. Configure RESEND_API_KEY and EMAIL_FROM in Render.'});
  const subject=String(req.body.subject||'Thank you for using Amstreem Atlas').trim().slice(0,120);
  const message=String(req.body.message||'Thank you for being part of Amstreem Atlas. I appreciate you giving the system a place in your daily life.').trim().slice(0,4000);
  if(!message)return res.status(400).json({error:'Write a message first.'});
  let recipients=[];
  if(req.body.all===true||Array.isArray(req.body.userIds)){let page=1,more=true;while(more&&page<=100){const r=await fetch(`${supabaseConfig.url}/auth/v1/admin/users?page=${page}&per_page=100`,{headers:{apikey:key,Authorization:`Bearer ${key}`}});if(!r.ok)throw new Error('Could not retrieve recipients.');const batch=(await r.json()).users||[];recipients.push(...batch);more=batch.length===100;page++;}}
  else return res.status(400).json({error:'Choose recipients.'});
  if(Array.isArray(req.body.userIds)){const ids=new Set(req.body.userIds.filter(x=>typeof x==='string'));recipients=recipients.filter(u=>ids.has(u.id));}
  const eligible=recipients.filter(u=>u.email&&u.id!==ownerUserId);
  const targets=eligible.filter(u=>['not_sent','failed',undefined].includes(u.app_metadata?.personal_os_thank_you?.status));
  let sent=0,failed=0,pending=0,skippedAlreadySent=eligible.filter(u=>u.app_metadata?.personal_os_thank_you?.status==='sent').length,skippedPending=eligible.filter(u=>u.app_metadata?.personal_os_thank_you?.status==='pending').length;
  const escapeHtml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const updateMailStatus=async(user,status,extra={})=>{const metadata={...(user.app_metadata||{}),personal_os_thank_you:{status,...extra}};const response=await fetch(`${supabaseConfig.url}/auth/v1/admin/users/${encodeURIComponent(user.id)}`,{method:'PUT',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({app_metadata:metadata})});if(!response.ok)throw new Error('Could not save recipient email status.');user.app_metadata=metadata;};
  for(const user of targets){try{await updateMailStatus(user,'pending',{started_at:new Date().toISOString()});const name=escapeHtml(user.user_metadata?.full_name||'there'),body=escapeHtml(message).replace(/\n/g,'<br>');const result=await sendResendEmail(user.email,subject,`<div style="font-family:Arial,sans-serif;line-height:1.7;color:#222"><p>Hello ${name},</p><p>${body}</p><p>— Amstreem Atlas</p></div>`);try{await updateMailStatus(user,'sent',{sent_at:new Date().toISOString(),email_id:result?.id||null});sent++;}catch(markError){pending++;console.error('Email sent but status update is pending:',markError.message);}}catch(e){failed++;console.error('Thank-you email failed:',e.message);try{await updateMailStatus(user,'failed',{failed_at:new Date().toISOString()});}catch(markError){pending++;console.error('Could not update failed email status:',markError.message);}}}
  res.json({sent,failed,pending,skippedAlreadySent,skippedPending,total:targets.length});
 }catch(e){res.status(502).json({error:e.message||'Could not send emails.'})}
});
app.post('/api/admin/thank-you/mark-sent',async(req,res)=>{
 try{
  const key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!key)return res.status(503).json({error:'Admin directory is not configured.'});
  if(!Array.isArray(req.body.userIds)||!req.body.userIds.length)return res.status(400).json({error:'Select accounts to mark as sent.'});
  const ids=new Set(req.body.userIds.filter(x=>typeof x==='string'));let users=[],page=1,more=true;
  while(more&&page<=100){const r=await fetch(`${supabaseConfig.url}/auth/v1/admin/users?page=${page}&per_page=100`,{headers:{apikey:key,Authorization:`Bearer ${key}`}});if(!r.ok)throw new Error('Could not retrieve recipients.');const batch=(await r.json()).users||[];users.push(...batch);more=batch.length===100;page++;}
  const targets=users.filter(u=>ids.has(u.id)&&u.email&&u.id!==ownerUserId&&u.app_metadata?.personal_os_thank_you?.status!=='sent');let marked=0;
  for(const user of targets){const metadata={...(user.app_metadata||{}),personal_os_thank_you:{status:'sent',sent_at:new Date().toISOString(),manually_marked:true}};const r=await fetch(`${supabaseConfig.url}/auth/v1/admin/users/${encodeURIComponent(user.id)}`,{method:'PUT',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({app_metadata:metadata})});if(!r.ok)throw new Error('Could not save a recipient status.');marked++;}
  res.json({marked});
 }catch(e){res.status(502).json({error:e.message||'Could not update recipient statuses.'});}
});
app.post('/api/welcome',async(req,res)=>{
 try {
  const already=one('SELECT 1 FROM email_events WHERE event=?','welcome');if(already)return res.json({sent:false});
  if(!req.user.email)return res.json({sent:false});
  // Email is optional during local development; never let it interrupt workspace loading.
  if(!process.env.RESEND_API_KEY||!process.env.EMAIL_FROM)return res.json({sent:false,skipped:true,reason:'Email is not configured.'});
  const name=String(req.user.user_metadata?.full_name||'there').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  await sendResendEmail(req.user.email,'Welcome to Amstreem Atlas',`<div style="font-family:Arial,sans-serif;line-height:1.7;color:#222"><p>Hello ${name},</p><p>Thank you for joining Amstreem Atlas. Your space is yours to shape—your records remain private to your account.</p><p>— Amstreem Atlas</p></div>`);
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
app.get('/api/progress',(req,res)=>{
 const totalXp=one('SELECT COALESCE(SUM(points),0) total FROM xp_events').total;
 const thresholds=[0,50,150,300,500,800,1200,1700,2300,3000,4000,5200,6600,8200,10000];
 while(totalXp>=thresholds[thresholds.length-1])thresholds.push(thresholds[thresholds.length-1]+Math.round(1000+thresholds.length*125));
 let index=0;while(index+1<thresholds.length&&totalXp>=thresholds[index+1])index++;
 const level=index+1,currentFloor=thresholds[index],nextFloor=thresholds[index+1];
 const titles=['Newcomer','Starter','Builder','Pathfinder','Maker','Strategist','Specialist','Architect','Vanguard','Atlas'];
 const lastEvent=one('SELECT category,points,awarded_at FROM xp_events ORDER BY awarded_at DESC,id DESC LIMIT 1')||null;
 res.json({totalXp,level,title:titles[index]||'Master Builder',currentFloor,nextFloor,progressPct:Math.max(0,Math.min(100,Math.round((totalXp-currentFloor)/(nextFloor-currentFloor)*100))),remaining:Math.max(0,nextFloor-totalXp),lastEvent});
});
app.get('/api/tasks',(q,s)=>s.json(all('SELECT * FROM tasks ORDER BY done ASC, COALESCE(due_date,\'9999-12-31\') ASC,id DESC')));
app.post('/api/tasks',(q,s)=>{const {title,detail='',category='Learning',due_date=null}=q.body;if(!title?.trim())return s.status(400).json({error:'A task title is required.'});const r=db.prepare('INSERT INTO tasks(title,detail,category,due_date) VALUES(?,?,?,?)').run(title.trim(),detail,category,due_date||null);s.json(one('SELECT * FROM tasks WHERE id=?',r.lastInsertRowid));});
app.patch('/api/tasks/:id',(q,s)=>{const t=one('SELECT * FROM tasks WHERE id=?',q.params.id);if(!t)return s.status(404).json({error:'Task not found'});const done=q.body.done===undefined?t.done:(q.body.done?1:0);db.prepare('UPDATE tasks SET done=?,title=COALESCE(?,title),detail=COALESCE(?,detail),category=COALESCE(?,category),due_date=COALESCE(?,due_date) WHERE id=?').run(done,q.body.title??null,q.body.detail??null,q.body.category??null,q.body.due_date??null,q.params.id);if(!t.done&&done)awardXp('task:'+t.id,'tasks',5);s.json(one('SELECT * FROM tasks WHERE id=?',q.params.id));});
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
app.patch('/api/learning/lessons/:id',(q,s)=>{const l=one('SELECT * FROM learning_lessons WHERE id=?',q.params.id);if(!l)return s.status(404).json({error:'Lesson not found.'});const d=q.body;if(d.status!==undefined&&!['Not started','In progress','Completed'].includes(d.status))return s.status(400).json({error:'Invalid lesson status.'});db.prepare('UPDATE learning_lessons SET title=?,content=?,notes=?,status=? WHERE id=?').run(d.title??l.title,d.content??l.content,d.notes??l.notes,d.status??l.status,l.id);if(l.status!=='Completed'&&d.status==='Completed')awardXp('lesson:'+l.id,'learning',10);s.json(one('SELECT * FROM learning_lessons WHERE id=?',l.id));});
app.delete('/api/learning/lessons/:id',(q,s)=>{db.prepare('DELETE FROM learning_lessons WHERE id=?').run(q.params.id);s.json({ok:true});});
app.post('/api/learning/lessons/:id/resources',(q,s)=>{const l=one('SELECT id FROM learning_lessons WHERE id=?',q.params.id);if(!l)return s.status(404).json({error:'Lesson not found.'});const {title,url}=q.body;if(!title?.trim()||!url?.trim())return s.status(400).json({error:'Add a resource name and URL.'});let parsed;try{parsed=new URL(url)}catch{return s.status(400).json({error:'Enter a valid URL.'})}if(!['http:','https:'].includes(parsed.protocol))return s.status(400).json({error:'Only web links are supported.'});const r=db.prepare('INSERT INTO learning_resources(lesson_id,title,url) VALUES(?,?,?)').run(l.id,title.trim(),parsed.href);s.json(one('SELECT * FROM learning_resources WHERE id=?',r.lastInsertRowid));});
app.delete('/api/learning/resources/:id',(q,s)=>{db.prepare('DELETE FROM learning_resources WHERE id=?').run(q.params.id);s.json({ok:true});});
app.post('/api/learning/lessons/:id/study',(q,s)=>{const l=one('SELECT id FROM learning_lessons WHERE id=?',q.params.id);if(!l)return s.status(404).json({error:'Lesson not found.'});const minutes=Number(q.body.minutes);if(!Number.isInteger(minutes)||minutes<1||minutes>600)return s.status(400).json({error:'Study time must be between 1 and 600 minutes.'});const r=db.prepare('INSERT INTO learning_study_logs(lesson_id,log_date,minutes,reflection) VALUES(?,?,?,?)').run(l.id,q.body.log_date||dateKey(),minutes,q.body.reflection||'');s.json(one('SELECT * FROM learning_study_logs WHERE id=?',r.lastInsertRowid));});
app.get('/api/learning/study-logs',(q,s)=>s.json(all('SELECT sl.*,ll.title lesson_title,lp.title path_title FROM learning_study_logs sl JOIN learning_lessons ll ON ll.id=sl.lesson_id JOIN learning_paths lp ON lp.id=ll.path_id ORDER BY sl.log_date DESC,sl.id DESC LIMIT 50')));

app.get('/api/sessions',(q,s)=>s.json(all('SELECT * FROM sessions ORDER BY session_date DESC,id DESC LIMIT 100')));
app.post('/api/sessions',(q,s)=>{const {session_date,minutes,focus,reflection=''}=q.body;if(!minutes||minutes<1||minutes>600||!focus?.trim())return s.status(400).json({error:'Add a focus and a valid duration (1–600 minutes).'});const r=db.prepare('INSERT INTO sessions(session_date,minutes,focus,reflection) VALUES(?,?,?,?)').run(session_date||dateKey(),Math.round(minutes),focus.trim(),reflection);awardXp('session:'+r.lastInsertRowid,'focus',Math.min(20,Math.floor(Number(minutes)/10)*2)||1);s.json(one('SELECT * FROM sessions WHERE id=?',r.lastInsertRowid));});
app.get('/api/notes',(q,s)=>s.json(all('SELECT * FROM notes ORDER BY updated_at DESC')));
app.post('/api/notes',(q,s)=>{const {title,body=''}=q.body;if(!title?.trim())return s.status(400).json({error:'Give your note a title.'});const r=db.prepare('INSERT INTO notes(title,body) VALUES(?,?)').run(title.trim(),body);s.json(one('SELECT * FROM notes WHERE id=?',r.lastInsertRowid));});
app.put('/api/notes/:id',(q,s)=>{db.prepare('UPDATE notes SET title=?,body=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(q.body.title,q.body.body,q.params.id);s.json(one('SELECT * FROM notes WHERE id=?',q.params.id));});
app.delete('/api/notes/:id',(q,s)=>{db.prepare('DELETE FROM notes WHERE id=?').run(q.params.id);s.json({ok:true});});
app.get('/api/goals',(q,s)=>s.json(all("SELECT * FROM goals WHERE status!='archived' ORDER BY status='completed',target_date")));
app.post('/api/goals',(q,s)=>{if(!q.body.title?.trim())return s.status(400).json({error:'A goal needs a title.'});const r=db.prepare('INSERT INTO goals(title,detail,target_date) VALUES(?,?,?)').run(q.body.title.trim(),q.body.detail||'',q.body.target_date||null);s.json(one('SELECT * FROM goals WHERE id=?',r.lastInsertRowid));});
app.patch('/api/goals/:id',(q,s)=>{const previous=one('SELECT * FROM goals WHERE id=?',q.params.id);if(!previous)return s.status(404).json({error:'Goal not found.'});const status=q.body.status;if(!['active','completed','archived'].includes(status))return s.status(400).json({error:'Invalid goal status.'});db.prepare('UPDATE goals SET status=? WHERE id=?').run(status,q.params.id);if(previous.status!=='completed'&&status==='completed')awardXp('goal:'+previous.id,'goals',25);s.json(one('SELECT * FROM goals WHERE id=?',q.params.id));});
app.delete('/api/goals/:id',(q,s)=>{db.prepare('DELETE FROM goals WHERE id=?').run(q.params.id);s.json({ok:true});});
app.get('/api/habits',(q,s)=>{const date=q.query.date||dateKey();s.json(all('SELECT h.*,CASE WHEN l.id IS NULL THEN 0 ELSE 1 END done FROM habits h LEFT JOIN habit_logs l ON l.habit_id=h.id AND l.log_date=? WHERE h.active=1 ORDER BY h.sort_order',date));});
app.post('/api/habits/:id/toggle',(q,s)=>{const date=q.body.date||dateKey();const exists=one('SELECT id FROM habit_logs WHERE habit_id=? AND log_date=?',q.params.id,date);if(exists)db.prepare('DELETE FROM habit_logs WHERE id=?').run(exists.id);else{db.prepare('INSERT OR IGNORE INTO habit_logs(habit_id,log_date) VALUES(?,?)').run(q.params.id,date);if(date===dateKey())awardXp('habit:'+q.params.id+':'+date,'habits',3);}s.json({ok:true,done:!exists});});
app.post('/api/habits',(q,s)=>{if(!q.body.title?.trim())return s.status(400).json({error:'Give the ritual a name.'});const r=db.prepare('INSERT INTO habits(title,emoji,sort_order) VALUES(?,?,COALESCE((SELECT MAX(sort_order)+1 FROM habits),1))').run(q.body.title.trim(),q.body.emoji||'✦');s.json(one('SELECT * FROM habits WHERE id=?',r.lastInsertRowid));});
app.delete('/api/habits/:id',(q,s)=>{db.prepare('DELETE FROM habits WHERE id=?').run(q.params.id);s.json({ok:true});});
app.use('/api/deen',(q,s,next)=>{if(q.user?.id!==ownerUserId&&one("SELECT value FROM settings WHERE key='religion'")?.value!=='islam')return s.status(403).json({error:'This Deen space is not enabled for this account.'});next();});
const prayers=['Fajr','Dhuhr','Asr','Maghrib','Isha'];
app.get('/api/deen/summary',(q,s)=>{const date=q.query.date||dateKey();const logs=all('SELECT prayer,completed,on_time FROM prayer_logs WHERE prayer_date=?',date);const quran=all('SELECT activity,COALESCE(SUM(pages),0) pages,COUNT(*) entries FROM quran_logs WHERE log_date=? GROUP BY activity',date);const tah=one('SELECT woke_up,prayed FROM tahajjud_logs WHERE log_date=?',date)||{woke_up:0,prayed:0};s.json({date,prayers:prayers.map(p=>logs.find(x=>x.prayer===p)||{prayer:p,completed:0,on_time:0}),quran,tahajjud:tah});});
app.patch('/api/deen/prayer',(q,s)=>{const {date= dateKey(),prayer,completed,on_time}=q.body;if(!prayers.includes(prayer))return s.status(400).json({error:'Unknown prayer.'});const old=one('SELECT * FROM prayer_logs WHERE prayer_date=? AND prayer=?',date,prayer)||{completed:0,on_time:0};const c=completed===undefined?old.completed:(completed?1:0);const t=on_time===undefined?old.on_time:(on_time?1:0);db.prepare('INSERT INTO prayer_logs(prayer_date,prayer,completed,on_time) VALUES(?,?,?,?) ON CONFLICT(prayer_date,prayer) DO UPDATE SET completed=excluded.completed,on_time=excluded.on_time').run(date,prayer,c,t);s.json(one('SELECT * FROM prayer_logs WHERE prayer_date=? AND prayer=?',date,prayer));});
app.patch('/api/deen/tahajjud',(q,s)=>{const date=q.body.date||dateKey();const old=one('SELECT * FROM tahajjud_logs WHERE log_date=?',date)||{woke_up:0,prayed:0,note:''};const w=q.body.woke_up===undefined?old.woke_up:(q.body.woke_up?1:0);const p=q.body.prayed===undefined?old.prayed:(q.body.prayed?1:0);db.prepare('INSERT INTO tahajjud_logs(log_date,woke_up,prayed,note) VALUES(?,?,?,?) ON CONFLICT(log_date) DO UPDATE SET woke_up=excluded.woke_up,prayed=excluded.prayed,note=excluded.note').run(date,w,p,q.body.note??old.note);s.json(one('SELECT * FROM tahajjud_logs WHERE log_date=?',date));});
app.get('/api/deen/quran',(q,s)=>s.json(all('SELECT * FROM quran_logs ORDER BY log_date DESC,id DESC LIMIT 100')));
app.post('/api/deen/quran',(q,s)=>{const {log_date=dateKey(),activity,surah,ayah_start=null,ayah_end=null,pages=0,juz=null,reflection=''}=q.body;if(!['memorisation','revision'].includes(activity)||!surah?.trim()||surah.length>80)return s.status(400).json({error:'Choose a valid activity and surah.'});const start=ayah_start===null||ayah_start===''?null:Number(ayah_start),end=ayah_end===null||ayah_end===''?null:Number(ayah_end),pageCount=Number(pages),juzNumber=juz===null||juz===''?null:Number(juz);if(!Number.isFinite(pageCount)||pageCount<0||pageCount>100||(start!==null&&(!Number.isInteger(start)||start<1||start>286))||(end!==null&&(!Number.isInteger(end)||end<1||end>286))||(start!==null&&end!==null&&end<start)||(juzNumber!==null&&(!Number.isInteger(juzNumber)||juzNumber<1||juzNumber>30)))return s.status(400).json({error:'Check the ayah, juz and page values.'});const r=db.prepare('INSERT INTO quran_logs(log_date,activity,surah,ayah_start,ayah_end,pages,juz,reflection) VALUES(?,?,?,?,?,?,?,?)').run(log_date,activity,surah.trim(),start,end,pageCount,juzNumber,String(reflection).slice(0,2000));s.json(one('SELECT * FROM quran_logs WHERE id=?',r.lastInsertRowid));});
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
app.patch('/api/settings',(q,s)=>{
 const allowed=['daily_target','display_name','username','north_star','religion','leaderboard_name','leaderboard_public','theme','features','widgets','sidebar_collapsed'];
 const themes=['shadowed-alchemist','nocturnal-amethyst','abyssal-trench','whispering-woods','crimson-velvet','light-porcelain','light-sandstone','light-sage','light-lavender','light-sky'];
 const features=['calendar','deen','faith','selfcontrol','learning','tasks','focus','library','goals','rankings'];
 if(q.body.religion!==undefined&&!['islam','christianity','none','prefer_not_to_say'].includes(q.body.religion))return s.status(400).json({error:'Choose a valid religious experience.'});
 if(q.body.theme!==undefined&&!themes.includes(q.body.theme))return s.status(400).json({error:'Choose a valid colour theme.'});
 if(q.body.features!==undefined&&(!Array.isArray(q.body.features)||q.body.features.some(x=>!features.includes(x))))return s.status(400).json({error:'Choose valid workspace sections.'});
 if(q.body.widgets!==undefined&&(!q.body.widgets||typeof q.body.widgets!=='object'||Array.isArray(q.body.widgets)))return s.status(400).json({error:'Choose valid dashboard widgets.'});
 const tx=db.transaction(()=>{for(const k of allowed)if(q.body[k]!==undefined){let v=String(q.body[k]).trim();if(k==='features'||k==='widgets')v=JSON.stringify(q.body[k]);if(k==='daily_target')v=String(Math.max(10,Math.min(600,Number(v)||80)));if(k==='leaderboard_public')v=v==='1'?'1':'0';if(k==='sidebar_collapsed')v=v==='1'?'1':'0';if(k==='leaderboard_name')v=v.slice(0,24);db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(k,v)}});
 tx();s.json(Object.fromEntries(all('SELECT key,value FROM settings').map(x=>[x.key,x.value])));
});
app.use('/api/faith',(q,s,next)=>{if(q.user?.id!==ownerUserId&&one("SELECT value FROM settings WHERE key='religion'")?.value!=='christianity')return s.status(403).json({error:'This faith space is not enabled for this account.'});next();});
app.get('/api/faith',(q,s)=>{const date=q.query.date||dateKey();s.json(all('SELECT * FROM faith_logs WHERE log_date=? ORDER BY activity',date));});
app.patch('/api/faith',(q,s)=>{const {date=dateKey(),activity,completed}=q.body;if(!['bible','prayer','reflection','worship','service'].includes(activity))return s.status(400).json({error:'Choose a valid faith practice.'});db.prepare('INSERT INTO faith_logs(log_date,activity,completed) VALUES(?,?,?) ON CONFLICT(log_date,activity) DO UPDATE SET completed=excluded.completed').run(date,activity,completed?1:0);s.json(one('SELECT * FROM faith_logs WHERE log_date=? AND activity=?',date,activity));});
app.get('/api/calendar',(q,s)=>{const month=String(q.query.month||'');if(!/^\d{4}-\d{2}$/.test(month))return s.status(400).json({error:'Choose a valid calendar month.'});const from=month+'-01',to=month+'-31';const map=new Map();const add=(date,section)=>{if(!map.has(date))map.set(date,new Set());map.get(date).add(section)};const religion=one("SELECT value FROM settings WHERE key='religion'")?.value||'none';const queries=[['SELECT DISTINCT session_date date FROM sessions','focus'],['SELECT DISTINCT log_date date FROM learning_study_logs','learning'],['SELECT DISTINCT log_date date FROM habit_logs','habits']];if(religion==='islam'||q.user.id===ownerUserId)queries.push(['SELECT DISTINCT prayer_date date FROM prayer_logs WHERE completed=1','faith'],['SELECT DISTINCT log_date date FROM quran_logs','faith']);if(religion==='christianity'||q.user.id===ownerUserId)queries.push(['SELECT DISTINCT log_date date FROM faith_logs WHERE completed=1','faith']);for(const [sql,section] of queries)for(const row of all(sql))add(row.date,section);const allDays=[...map.entries()].map(([date,set])=>({date,sections:[...set],perfect:set.size>=3}));const days=allDays.filter(x=>x.date>=from&&x.date<=to).sort((a,b)=>a.date.localeCompare(b.date));const streaks={};for(const section of ['focus','learning','habits','faith']){const dates=allDays.filter(x=>x.sections.includes(section)).map(x=>x.date).sort();let current=0,cursor=new Date();const key=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');if(!dates.includes(key(cursor)))cursor.setDate(cursor.getDate()-1);const set=new Set(dates);while(set.has(key(cursor))){current++;cursor.setDate(cursor.getDate()-1)}let best=0,run=0,prev=null;for(const date of dates){const d=new Date(date+'T12:00:00');run=prev&&Math.round((d-prev)/86400000)===1?run+1:1;best=Math.max(best,run);prev=d}streaks[section]={current,best};}s.json({month,days,streaks});});
app.get('/api/export',(q,s)=>{s.setHeader('Content-Disposition','attachment; filename="personal-os-backup.json"');s.json({exportedAt:new Date().toISOString(),tasks:all('SELECT * FROM tasks'),modules:all('SELECT * FROM modules'),learning_paths:all('SELECT * FROM learning_paths'),learning_lessons:all('SELECT * FROM learning_lessons'),learning_resources:all('SELECT * FROM learning_resources'),learning_study_logs:all('SELECT * FROM learning_study_logs'),sessions:all('SELECT * FROM sessions'),notes:all('SELECT * FROM notes'),goals:all('SELECT * FROM goals'),habits:all('SELECT * FROM habits'),habit_logs:all('SELECT * FROM habit_logs'),prayer_logs:all('SELECT * FROM prayer_logs'),quran_logs:all('SELECT * FROM quran_logs'),tahajjud_logs:all('SELECT * FROM tahajjud_logs'),faith_logs:all('SELECT * FROM faith_logs'),self_control_logs:all('SELECT * FROM self_control_logs'),self_control_trackers:all('SELECT * FROM self_control_trackers'),self_control_entries:all('SELECT * FROM self_control_entries'),settings:all('SELECT * FROM settings'),email_events:all('SELECT * FROM email_events'),login_events:all('SELECT * FROM login_events'),xp_events:all('SELECT * FROM xp_events'),feedback_logs:all('SELECT * FROM feedback_logs')});});
app.post('/api/import',(q,s)=>{
 try {
  const imported=restoreBackup(db,q.body,workspaceTables);
  s.json({ok:true,imported});
 } catch(error) {
  s.status(400).json({error:error.message||'The backup could not be imported.'});
 }
});
app.listen(PORT,()=>console.log(`Amstreem Atlas running at http://localhost:${PORT}`));
