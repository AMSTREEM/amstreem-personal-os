const express = require('express');
const path = require('path');
const fs = require('node:fs');
const Database = require('better-sqlite3');
const { restoreBackup } = require('./workspace-backup');
const { AsyncLocalStorage } = require('node:async_hooks');
const crypto = require('node:crypto');
const { commitWorkspaceSnapshot, createWorkspaceRequestHash } = require('./server/workspace-persistence');
const { positiveIdSchema, validateRequest, validateApiEnvelope, sendProblem, onboardingSchema } = require('./server/api-contracts');
const { apiProblemResponses } = require('./server/api-errors');
const { createAtlasEvent } = require('./server/atlas-events');
const { calculateHabitStreak } = require('./server/atlas-streaks');
const { resolveAppEnvironment, checkEnvironmentMarker, requestLogger } = require('./server/runtime-guard');
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(requestLogger());
const PORT = process.env.PORT || 3000;
const APP_ENV = resolveAppEnvironment(process.env);
const fileSupabaseConfig = require('./supabase-config.json');
const supabaseConfig = {
  ...fileSupabaseConfig,
  url: process.env.SUPABASE_URL || fileSupabaseConfig.url,
  publishableKey: process.env.SUPABASE_PUBLISHABLE_KEY || fileSupabaseConfig.publishableKey
};
if (process.env.ATLAS_STAGING === 'true') {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_PUBLISHABLE_KEY) {
    throw new Error('Staging requires its own Supabase URL and publishable key.');
  }
  if (process.env.SUPABASE_URL.includes('skjxwzmpajdcrfacwoap')) {
    throw new Error('Staging must never connect to the production Supabase project.');
  }
}
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
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://googleapis.com https://fonts.googleapis.com",
    "font-src 'self' https://gstatic.com https://fonts.gstatic.com https://googleapis.com https://fonts.googleapis.com https://verses.quran.foundation https://quran.foundation data:",
    "img-src 'self' data: blob: https:",
    `connect-src 'self' ${supabaseOrigin} wss://${supabaseHost} https://alquran.cloud https://api.alquran.cloud https://api.quran.com https://islamic.network https://everyayah.com`,
    "media-src 'self' blob: https://alquran.cloud https://api.alquran.cloud https://islamic.network https://everyayah.com https://quran.foundation https://verses.quran.foundation",
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
app.get('/healthz', (_req,res) => res.status(200).json({ ok: true }));
app.get('/readyz', async (_req,res) => {
  const readiness = await checkEnvironmentMarker({
    appEnv: APP_ENV,
    supabaseUrl: supabaseConfig.url,
    apiKey: supabaseConfig.publishableKey,
    probeToken: process.env.ATLAS_ENVIRONMENT_PROBE_TOKEN
  });
  if (!readiness.ok) {
    return res.status(503).json({ ok: false, environment: APP_ENV, checks: { database: false, environment: false } });
  }
  return res.status(200).json({ ok: true, environment: APP_ENV, checks: { database: true, environment: true, skipped: Boolean(readiness.skipped) } });
});
const QURAN_FONT_FILENAME = 'UthmanicHafs1Ver18.woff2';
const quranFontPath = path.join(__dirname, 'public', 'fonts', QURAN_FONT_FILENAME);
let quranFontInflight = null;
async function loadQuranFontBuffer() {
  for (const candidate of [quranFontPath, path.join(__dirname, 'fonts', QURAN_FONT_FILENAME), path.join(__dirname, 'client', 'public', 'fonts', QURAN_FONT_FILENAME)]) {
    try {
      const local = await fs.promises.readFile(candidate);
      if (local.length > 0 && local.subarray(0, 4).toString('ascii') === 'wOF2') return local;
    } catch { /* try the next local font location */ }
  }
  if (quranFontInflight) return quranFontInflight;
  quranFontInflight = (async () => {
    const sources = [
      'https://verses.quran.foundation/fonts/quran/hafs/uthmanic_hafs/UthmanicHafs1Ver18.woff2',
      'https://cdn.jsdelivr.net/gh/thetruetruth/quran-data-kfgqpc@main/hafs/font/hafs.18.woff2'
    ];
    let lastError;
    for (const source of sources) {
      try {
        const response = await fetch(source, { headers: { Accept: 'font/woff2,application/octet-stream' }, signal: AbortSignal.timeout(15000) });
        if (!response.ok) throw new Error('Font source returned HTTP ' + response.status + '.');
        const buffer = Buffer.from(await response.arrayBuffer());
        if (!buffer.length || buffer.length > 10 * 1024 * 1024 || buffer.subarray(0, 4).toString('ascii') !== 'wOF2') {
          throw new Error('Font source did not return a valid WOFF2 binary.');
        }
        await fs.promises.mkdir(path.dirname(quranFontPath), { recursive: true });
        await fs.promises.writeFile(quranFontPath, buffer);
        return buffer;
      } catch (error) {
        lastError = error;
        console.warn('Qur’an font source failed:', source, error.message);
      }
    }
    throw lastError || new Error('No Qur’an font source is available.');
  })();
  try { return await quranFontInflight; }
  finally { quranFontInflight = null; }
}
app.get('/fonts/' + QURAN_FONT_FILENAME, async (_req, res) => {
  try {
    const font = await loadQuranFontBuffer();
    res.setHeader('Content-Type', 'font/woff2');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Content-Length', String(font.length));
    return res.status(200).send(font);
  } catch (error) {
    console.error('Qur’an font delivery failed:', error.message);
    return res.status(502).type('text/plain').send('The Qur’an font is temporarily unavailable.');
  }
});
const qcfV2FontInflight = new Map();
async function loadQcfV2FontBuffer(page) {
  if (!Number.isInteger(page) || page < 1 || page > 604) throw new Error('Invalid QCF V2 page font.');
  const fontPath = path.join(__dirname, 'public', 'fonts', 'qcf-v2', 'p' + page + '.woff2');
  try {
    const local = await fs.promises.readFile(fontPath);
    if (local.length && local.subarray(0, 4).toString('ascii') === 'wOF2') return local;
  } catch { /* fetch and persist the requested page font */ }
  if (qcfV2FontInflight.has(page)) return qcfV2FontInflight.get(page);
  const task = (async () => {
    const response = await fetch('https://verses.quran.foundation/fonts/quran/hafs/v2/woff2/p' + page + '.woff2', {
      headers: { Accept: 'font/woff2,application/octet-stream' }, signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) throw new Error('QCF V2 font returned HTTP ' + response.status + '.');
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length || buffer.length > 5 * 1024 * 1024 || buffer.subarray(0, 4).toString('ascii') !== 'wOF2') throw new Error('QCF V2 page font is not a valid WOFF2 binary.');
    await fs.promises.mkdir(path.dirname(fontPath), { recursive: true });
    await fs.promises.writeFile(fontPath, buffer);
    return buffer;
  })();
  qcfV2FontInflight.set(page, task);
  try { return await task; } finally { qcfV2FontInflight.delete(page); }
}
app.get('/fonts/qcf-v2/p:page.woff2', async (req, res) => {
  const page = Number(req.params.page);
  if (!Number.isInteger(page) || page < 1 || page > 604) return res.status(400).type('text/plain').send('Invalid Mushaf page font.');
  try {
    const font = await loadQcfV2FontBuffer(page);
    res.setHeader('Content-Type', 'font/woff2');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Content-Length', String(font.length));
    return res.status(200).send(font);
  } catch (error) {
    console.error('QCF V2 page font delivery failed:', page, error.message);
    return res.status(502).type('text/plain').send('The Mushaf page font is temporarily unavailable.');
  }
});
app.use('/api/admin', rateLimit({ max: 30, prefix: 'admin' }));
app.use('/api', rateLimit({ max: 300 }));

// Resilient, same-origin Mushaf proxy with bounded in-memory caching and
// a committed offline seed for the opening page and final three Madani pages.
const quranPageCache = new Map();
const quranPageInflight = new Map();
const quranSurahCache = new Map();
const quranSurahInflight = new Map();
const quranOfflinePages = require('./server/quran-fallback.json').pages;
const quranSurahLabels = {"1":{"surahName":"Al-Faatiha","arabicName":"الفاتحة"},"2":{"surahName":"Al-Baqara","arabicName":"البقرة"},"3":{"surahName":"Aal-i-Imraan","arabicName":"آل عمران"},"4":{"surahName":"An-Nisaa","arabicName":"النساء"},"5":{"surahName":"Al-Maaida","arabicName":"المائدة"},"6":{"surahName":"Al-An'aam","arabicName":"الأنعام"},"7":{"surahName":"Al-A'raaf","arabicName":"الأعراف"},"8":{"surahName":"Al-Anfaal","arabicName":"الأنفال"},"9":{"surahName":"At-Tawba","arabicName":"التوبة"},"10":{"surahName":"Yunus","arabicName":"يونس"},"11":{"surahName":"Hud","arabicName":"هود"},"12":{"surahName":"Yusuf","arabicName":"يوسف"},"13":{"surahName":"Ar-Ra'd","arabicName":"الرعد"},"14":{"surahName":"Ibrahim","arabicName":"ابراهيم"},"15":{"surahName":"Al-Hijr","arabicName":"الحجر"},"16":{"surahName":"An-Nahl","arabicName":"النحل"},"17":{"surahName":"Al-Israa","arabicName":"الإسراء"},"18":{"surahName":"Al-Kahf","arabicName":"الكهف"},"19":{"surahName":"Maryam","arabicName":"مريم"},"20":{"surahName":"Taa-Haa","arabicName":"طه"},"21":{"surahName":"Al-Anbiyaa","arabicName":"الأنبياء"},"22":{"surahName":"Al-Hajj","arabicName":"الحج"},"23":{"surahName":"Al-Muminoon","arabicName":"المؤمنون"},"24":{"surahName":"An-Noor","arabicName":"النور"},"25":{"surahName":"Al-Furqaan","arabicName":"الفرقان"},"26":{"surahName":"Ash-Shu'araa","arabicName":"الشعراء"},"27":{"surahName":"An-Naml","arabicName":"النمل"},"28":{"surahName":"Al-Qasas","arabicName":"القصص"},"29":{"surahName":"Al-Ankaboot","arabicName":"العنكبوت"},"30":{"surahName":"Ar-Room","arabicName":"الروم"},"31":{"surahName":"Luqman","arabicName":"لقمان"},"32":{"surahName":"As-Sajda","arabicName":"السجدة"},"33":{"surahName":"Al-Ahzaab","arabicName":"الأحزاب"},"34":{"surahName":"Saba","arabicName":"سبإ"},"35":{"surahName":"Faatir","arabicName":"فاطر"},"36":{"surahName":"Yaseen","arabicName":"يس"},"37":{"surahName":"As-Saaffaat","arabicName":"الصافات"},"38":{"surahName":"Saad","arabicName":"ص"},"39":{"surahName":"Az-Zumar","arabicName":"الزمر"},"40":{"surahName":"Al-Ghaafir","arabicName":"غافر"},"41":{"surahName":"Fussilat","arabicName":"فصلت"},"42":{"surahName":"Ash-Shura","arabicName":"الشورى"},"43":{"surahName":"Az-Zukhruf","arabicName":"الزخرف"},"44":{"surahName":"Ad-Dukhaan","arabicName":"الدخان"},"45":{"surahName":"Al-Jaathiya","arabicName":"الجاثية"},"46":{"surahName":"Al-Ahqaf","arabicName":"الأحقاف"},"47":{"surahName":"Muhammad","arabicName":"محمد"},"48":{"surahName":"Al-Fath","arabicName":"الفتح"},"49":{"surahName":"Al-Hujuraat","arabicName":"الحجرات"},"50":{"surahName":"Qaaf","arabicName":"ق"},"51":{"surahName":"Adh-Dhaariyat","arabicName":"الذاريات"},"52":{"surahName":"At-Tur","arabicName":"الطور"},"53":{"surahName":"An-Najm","arabicName":"النجم"},"54":{"surahName":"Al-Qamar","arabicName":"القمر"},"55":{"surahName":"Ar-Rahmaan","arabicName":"الرحمن"},"56":{"surahName":"Al-Waaqia","arabicName":"الواقعة"},"57":{"surahName":"Al-Hadid","arabicName":"الحديد"},"58":{"surahName":"Al-Mujaadila","arabicName":"المجادلة"},"59":{"surahName":"Al-Hashr","arabicName":"الحشر"},"60":{"surahName":"Al-Mumtahana","arabicName":"الممتحنة"},"61":{"surahName":"As-Saff","arabicName":"الصف"},"62":{"surahName":"Al-Jumu'a","arabicName":"الجمعة"},"63":{"surahName":"Al-Munaafiqoon","arabicName":"المنافقون"},"64":{"surahName":"At-Taghaabun","arabicName":"التغابن"},"65":{"surahName":"At-Talaaq","arabicName":"الطلاق"},"66":{"surahName":"At-Tahrim","arabicName":"التحريم"},"67":{"surahName":"Al-Mulk","arabicName":"الملك"},"68":{"surahName":"Al-Qalam","arabicName":"القلم"},"69":{"surahName":"Al-Haaqqa","arabicName":"الحاقة"},"70":{"surahName":"Al-Ma'aarij","arabicName":"المعارج"},"71":{"surahName":"Nooh","arabicName":"نوح"},"72":{"surahName":"Al-Jinn","arabicName":"الجن"},"73":{"surahName":"Al-Muzzammil","arabicName":"المزمل"},"74":{"surahName":"Al-Muddaththir","arabicName":"المدثر"},"75":{"surahName":"Al-Qiyaama","arabicName":"القيامة"},"76":{"surahName":"Al-Insaan","arabicName":"الانسان"},"77":{"surahName":"Al-Mursalaat","arabicName":"المرسلات"},"78":{"surahName":"An-Naba","arabicName":"النبإ"},"79":{"surahName":"An-Naazi'aat","arabicName":"النازعات"},"80":{"surahName":"Abasa","arabicName":"عبس"},"81":{"surahName":"At-Takwir","arabicName":"التكوير"},"82":{"surahName":"Al-Infitaar","arabicName":"الإنفطار"},"83":{"surahName":"Al-Mutaffifin","arabicName":"المطففين"},"84":{"surahName":"Al-Inshiqaaq","arabicName":"الإنشقاق"},"85":{"surahName":"Al-Burooj","arabicName":"البروج"},"86":{"surahName":"At-Taariq","arabicName":"الطارق"},"87":{"surahName":"Al-A'laa","arabicName":"الأعلى"},"88":{"surahName":"Al-Ghaashiya","arabicName":"الغاشية"},"89":{"surahName":"Al-Fajr","arabicName":"الفجر"},"90":{"surahName":"Al-Balad","arabicName":"البلد"},"91":{"surahName":"Ash-Shams","arabicName":"الشمس"},"92":{"surahName":"Al-Lail","arabicName":"الليل"},"93":{"surahName":"Ad-Dhuhaa","arabicName":"الضحى"},"94":{"surahName":"Ash-Sharh","arabicName":"الشرح"},"95":{"surahName":"At-Tin","arabicName":"التين"},"96":{"surahName":"Al-Alaq","arabicName":"العلق"},"97":{"surahName":"Al-Qadr","arabicName":"القدر"},"98":{"surahName":"Al-Bayyina","arabicName":"البينة"},"99":{"surahName":"Az-Zalzala","arabicName":"الزلزلة"},"100":{"surahName":"Al-Aadiyaat","arabicName":"العاديات"},"101":{"surahName":"Al-Qaari'a","arabicName":"القارعة"},"102":{"surahName":"At-Takaathur","arabicName":"التكاثر"},"103":{"surahName":"Al-Asr","arabicName":"العصر"},"104":{"surahName":"Al-Humaza","arabicName":"الهمزة"},"105":{"surahName":"Al-Fil","arabicName":"الفيل"},"106":{"surahName":"Quraish","arabicName":"قريش"},"107":{"surahName":"Al-Maa'un","arabicName":"الماعون"},"108":{"surahName":"Al-Kawthar","arabicName":"الكوثر"},"109":{"surahName":"Al-Kaafiroon","arabicName":"الكافرون"},"110":{"surahName":"An-Nasr","arabicName":"النصر"},"111":{"surahName":"Al-Masad","arabicName":"المسد"},"112":{"surahName":"Al-Ikhlaas","arabicName":"الإخلاص"},"113":{"surahName":"Al-Falaq","arabicName":"الفلق"},"114":{"surahName":"An-Naas","arabicName":"الناس"}};
const QURAN_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
let quranAccessTokenCache = { accessToken: '', expiresAt: 0 };
async function getQuranApiAuth() {
  const clientId = process.env.QURAN_CLIENT_ID || '';
  const clientSecret = process.env.QURAN_CLIENT_SECRET || '';
  const environment = process.env.QURAN_API_ENV === 'prelive' ? 'prelive' : 'production';
  const apiBase = environment === 'prelive'
    ? 'https://apis-prelive.quran.foundation/content/api/v4'
    : 'https://apis.quran.foundation/content/api/v4';
  if (!clientId) return { headers: {}, apiBase };
  if (process.env.QURAN_API_TOKEN) return { headers: { 'x-auth-token': process.env.QURAN_API_TOKEN, 'x-client-id': clientId }, apiBase };
  if (!clientSecret) return { headers: {}, apiBase };
  if (!quranAccessTokenCache.accessToken || Date.now() >= quranAccessTokenCache.expiresAt - 60_000) {
    const oauthBase = environment === 'prelive' ? 'https://prelive-oauth2.quran.foundation' : 'https://oauth2.quran.foundation';
    const scope = process.env.QURAN_API_SCOPE || 'content.quran.read content.translations.read';
    const tokenResponse = await fetch(oauthBase + '/oauth2/token', {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json'
      },
      body: new URLSearchParams({ grant_type: 'client_credentials', scope }),
      signal: AbortSignal.timeout(9000)
    });
    if (!tokenResponse.ok) throw new Error('Quran Foundation token request returned HTTP ' + tokenResponse.status + '.');
    const tokenBody = await tokenResponse.json();
    if (!tokenBody?.access_token) throw new Error('Quran Foundation did not return an access token.');
    quranAccessTokenCache = {
      accessToken: String(tokenBody.access_token),
      expiresAt: Date.now() + Math.max(60, Number(tokenBody.expires_in) || 3600) * 1000
    };
  }
  return { headers: { 'x-auth-token': quranAccessTokenCache.accessToken, 'x-client-id': clientId }, apiBase };
}

function normalizeMadinahArabic(value) {
  return String(value || '').replace(/[\u06CC\u06A9\u06C1]/g, character => ({
    '\u06CC': '\u064A', '\u06A9': '\u0643', '\u06C1': '\u0647'
  })[character] || character);
}
function tajweedClassForRule(rule) {
  const value = String(rule || '').toLowerCase().trim().replace(/[-\s]/g, '_');
  const rules = {
    h:'tj-silent',ham_wasl:'tj-silent',hamzat_wasl:'tj-silent',hamzat_al_wasl:'tj-silent',
    s:'tj-silent',slnt:'tj-silent',silent:'tj-silent',
    l:'tj-silent',laam_shamsiyah:'tj-silent',laam_shamsiyyah:'tj-silent',lam_shamsiyah:'tj-silent',lam_shamsiyyah:'tj-silent',
    n:'tj-madd-normal',madda_normal:'tj-madd-normal',
    p:'tj-madd-permissible',madda_permissible:'tj-madd-permissible',
    m:'tj-madd-necessary',madda_necessary:'tj-madd-necessary',
    o:'tj-madd-obligatory',madda_obligatory:'tj-madd-obligatory',madda_obligatory_mottasel:'tj-madd-obligatory-connected',madda_obligatory_monfasel:'tj-madd-obligatory-separated',
    madd:'tj-madd-normal','tj_madd':'tj-madd-normal','tj_madd_wajib':'tj-madd-obligatory',
    q:'tj-qalqalah',qlq:'tj-qalqalah',qalaqah:'tj-qalqalah',qalqalah:'tj-qalqalah',qalqala:'tj-qalqalah',
    f:'tj-ikhfa',ikhfa:'tj-ikhfa',ikhafa:'tj-ikhfa',
    c:'tj-ikhfa-shafawi',ikhfa_shafawi:'tj-ikhfa-shafawi',ikhafa_shafawi:'tj-ikhfa-shafawi',
    i:'tj-iqlab',iqlab:'tj-iqlab',iqlb:'tj-iqlab',qalb:'tj-iqlab',
    w:'tj-idgham-shafawi',idgham_shafawi:'tj-idgham-shafawi',idghm_shfw:'tj-idgham-shafawi',
    a:'tj-idgham-ghunnah',idgham_ghunnah:'tj-idgham-ghunnah',idgh_w_ghn:'tj-idgham-ghunnah',
    u:'tj-idgham-no-ghunnah',idgham_wo_ghunnah:'tj-idgham-no-ghunnah',
    d:'tj-idgham-mutajanisayn',idgham_mutajanisayn:'tj-idgham-mutajanisayn',idgh_mus:'tj-idgham-mutajanisayn',
    b:'tj-idgham-mutaqaribayn',idgham_mutaqaribayn:'tj-idgham-mutaqaribayn',
    g:'tj-ghunnah',ghn:'tj-ghunnah',ghunnah:'tj-ghunnah',
    r:'tj-tafkhim',heavy:'tj-tafkhim',tafkhim:'tj-tafkhim',tafkheem:'tj-tafkhim',
    'tj-silent':'tj-silent','tj-madd-normal':'tj-madd-normal','tj-madd-permissible':'tj-madd-permissible',
    'tj-madd-necessary':'tj-madd-necessary','tj-madd-obligatory':'tj-madd-obligatory','tj-madd-obligatory-connected':'tj-madd-obligatory-connected','tj-madd-obligatory-separated':'tj-madd-obligatory-separated',
    'tj-qalqalah':'tj-qalqalah','tj-ikhfa':'tj-ikhfa','tj-ikhfa-shafawi':'tj-ikhfa-shafawi',
    'tj-iqlab':'tj-iqlab','tj-idgham-shafawi':'tj-idgham-shafawi','tj-idgham-ghunnah':'tj-idgham-ghunnah',
    'tj-idgham-no-ghunnah':'tj-idgham-no-ghunnah','tj-idgham-mutajanisayn':'tj-idgham-mutajanisayn',
    'tj-idgham-mutaqaribayn':'tj-idgham-mutaqaribayn','tj-ghunnah':'tj-ghunnah','tj-tafkhim':'tj-tafkhim'
  };
  return rules[value] || rules[value.replace(/_/g, '-')] || '';
}
const stripQuranMarkup = value => String(value || '')
  .replace(/<span\s+class=["']?end["']?[^>]*>[\s\S]*?<\/span>/gi, '')
  .replace(/<[^>]+>/g, '')
  .replace(/[<>]/g, '')
  .replace(/\[[a-zA-Z]+(?::\d+)?\[/g, '')
  .replace(/\]/g, '')
  .replace(/(?:\\u25CC|\\u{25CC}|&#(?:x0*25cc|0*9676);|&#x0*25cc;)/gi, '')
  .replace(/\u25CC/g, '');
function parseAlQuranTajweed(markup) {
  // End-marker spans are presentation metadata; the reader renders its own medallion.
  const source = String(markup || '').replace(/<span\s+class=["']?end["']?[^>]*>[\s\S]*?<\/span>/gi, '');
  const segments = [];
  const stack = [];
  let leadingMarks = '';
  const append = (value, className) => {
    const text = normalizeMadinahArabic(stripQuranMarkup(value));
    if (!text) return;
    for (const character of Array.from(text)) {
      const previous = segments[segments.length - 1];
      if (/\p{M}/u.test(character)) {
        const lastCharacter = previous ? Array.from(previous.text).slice(-1)[0] || '' : '';
        if (previous) previous.text += character;
        else leadingMarks += character;
      } else {
        const clustered = character + leadingMarks;
        leadingMarks = '';
        if (previous && previous.className === className) previous.text += clustered;
        else segments.push({ text: clustered, className });
      }
    }
  };
  // Tokenize every HTML tag. Unknown tags are ignored, their text children survive.
  if (/<[^>]+>/.test(source)) {
    const xmlStack = [];
    const tokens = source.match(/<[^>]+>|[^<]+/g) || [];
    for (const token of tokens) {
      const tag = token.match(/^<\s*(\/?)\s*([a-z][a-z0-9:-]*)\b([^>]*)>/i);
      if (!tag) {
        append(token, [...xmlStack].reverse().find(item => item.className)?.className || '');
        continue;
      }
      const tagName = tag[2].toLowerCase();
      if (tagName !== 'tajweed' && tagName !== 'rule') continue;
      if (tag[1]) {
        for (let position = xmlStack.length - 1; position >= 0; position -= 1) {
          if (xmlStack[position].tag === tagName) { xmlStack.splice(position); break; }
        }
      } else {
        const attribute = tag[3].match(/\bclass\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
        const rule = attribute ? (attribute[1] || attribute[2] || attribute[3] || '') : '';
        xmlStack.push({ tag: tagName, className: rule.split(/\s+/).map(tajweedClassForRule).find(Boolean) || '' });
      }
    }
    return segments.map(segment => ({ ...segment, text: stripQuranMarkup(segment.text) }));
  }
  // Parse quran-tajweed's bracket syntax while retaining semantic rule classes.
  let index = 0;
  while (index < source.length) {
    if (source[index] === '[') {
      const opening = source.slice(index).match(/^\[([a-zA-Z][a-zA-Z0-9_-]*)(?::\d+)?\[/);
      if (opening) {
        stack.push(tajweedClassForRule(opening[1]));
        index += opening[0].length;
        continue;
      }
      index += 1;
      continue;
    }
    if (source[index] === ']') {
      if (stack.length) stack.pop();
      index += 1;
      continue;
    }
    append(source[index], [...stack].reverse().find(Boolean) || '');
    index += 1;
  }
  return segments.map(segment => ({ ...segment, text: stripQuranMarkup(segment.text) }));
}
function sanitizeQuranAyah(ayah) {
  const plainSource = String(ayah?.text || '');
  const tajweedSource = String(ayah?.tajweedText || '');
  const hasMarkup = value => /<[^>]+>|\[[a-zA-Z]/i.test(String(value || ''));
  const rawTajweed = hasMarkup(tajweedSource) ? tajweedSource : (hasMarkup(plainSource) ? plainSource : tajweedSource);
  const parsed = hasMarkup(rawTajweed) ? parseAlQuranTajweed(rawTajweed) : [];
  const sourceSegments = parsed.length ? parsed : (Array.isArray(ayah?.tajweedSegments) ? ayah.tajweedSegments : []);
  const tajweedSegments = [];
  let leadingMarks = '';
  for (const segment of sourceSegments) {
    const className = /^tj-[a-z-]+$/.test(String(segment?.className || '')) ? String(segment.className) : '';
    for (const character of Array.from(stripQuranMarkup(segment?.text || ''))) {
      if (/\p{M}/u.test(character)) {
        const previous = tajweedSegments[tajweedSegments.length - 1];
        const lastCharacter = previous ? Array.from(previous.text).slice(-1)[0] || '' : '';
        if (previous) previous.text += character;
        else leadingMarks += character;
      } else {
        const clustered = character + leadingMarks;
        leadingMarks = '';
        const previous = tajweedSegments[tajweedSegments.length - 1];
        if (previous && previous.className === className) previous.text += clustered;
        else tajweedSegments.push({ text: clustered, className });
      }
    }
  }
  const cleanText = stripQuranMarkup(ayah?.text || '');
  const cleanTajweedText = tajweedSegments.map(segment => segment.text).join('') || stripQuranMarkup(rawTajweed);
  return {
    ...ayah,
    text: cleanText || cleanTajweedText,
    tajweedText: cleanTajweedText,
    tajweedSegments,
    translation: stripQuranMarkup(ayah?.translation || ''),
    translations: Array.isArray(ayah?.translations) ? ayah.translations.map(item => ({ ...item, text: stripQuranMarkup(item?.text || '') })) : [],
    words: Array.isArray(ayah?.words) ? ayah.words.map(word => ({ ...word, text: stripQuranMarkup(word?.text || ''), tajweed: stripQuranMarkup(word?.tajweed || '') })) : []
  };
}
function sanitizeQuranPayload(payload) {
  if (!payload || !Array.isArray(payload.ayahs)) return payload;
  return { ...payload, ayahs: payload.ayahs.map(sanitizeQuranAyah) };
}
function normalizeAlQuranCloud(body, page) {
  const editions = Array.isArray(body?.data) ? body.data : [];
  const uthmani = editions.find(item => item?.edition?.identifier === 'quran-uthmani');
  const english = editions.find(item => item?.edition?.identifier === 'en.sahih');
  if (body?.code !== 200 || !Array.isArray(uthmani?.ayahs) || !uthmani.ayahs.length ||
      !Array.isArray(english?.ayahs) || english.ayahs.length !== uthmani.ayahs.length) {
    throw new Error('AlQuranCloud returned an incomplete quran-uthmani/English page.');
  }
  const ayahs = uthmani.ayahs.map((ayah, index) => {
    const surahNumber = Number(ayah?.surah?.number);
    const label = quranSurahLabels[surahNumber] || {};
    const canonicalText = String(ayah.text || '');
    const number = Number(ayah.number);
    const numberInSurah = Number(ayah.numberInSurah);
    const translation = String(english.ayahs[index]?.text || '').replace(/<[^>]*>/g, '').trim();
    if (!canonicalText || !Number.isInteger(number) || !Number.isInteger(numberInSurah) ||
        !Number.isInteger(surahNumber) || !translation ||
        Number(english.ayahs[index]?.number) !== number) {
      throw new Error('quran-uthmani/en.sahih returned a missing or mismatched ayah at index ' + index + '.');
    }
    return {
      number, numberInSurah, surahNumber,
      surahName: ayah?.surah?.englishName || label.surahName || 'Surah ' + surahNumber,
      arabicName: ayah?.surah?.name || label.arabicName || '',
      text: canonicalText, tajweedText: canonicalText,
      tajweedSegments: [{ text: canonicalText, className: '' }],
      textSource: 'quran-uthmani',
      translation,
      translations: [], words: []
    };
  });
  return {
    page, juz: Number(uthmani.ayahs[0]?.juz) || 1,
    hizb: Math.ceil((Number(uthmani.ayahs[0]?.hizbQuarter || uthmani.ayahs[0]?.hizb_quarter) || 1) / 4),
    qcfAvailable: false, textSource: 'quran-uthmani', tajweedComplete: false,
    translationSource: 'Sahih International', ayahs
  };
}
function normalizeAlQuranCloudSurah(body, surahNumber) {
  const editions = Array.isArray(body?.data) ? body.data : [];
  const uthmani = editions.find(item => item?.edition?.identifier === 'quran-uthmani');
  const english = editions.find(item => item?.edition?.identifier === 'en.sahih');
  if (body?.code !== 200 || !Array.isArray(uthmani?.ayahs) || !uthmani.ayahs.length ||
      !Array.isArray(english?.ayahs) || english.ayahs.length !== uthmani.ayahs.length) {
    throw new Error('AlQuranCloud returned an incomplete quran-uthmani/English Surah.');
  }
  const label = quranSurahLabels[surahNumber] || {};
  const ayahs = uthmani.ayahs.map((ayah, index) => {
    const canonicalText = String(ayah.text || '');
    if (!canonicalText) throw new Error('quran-uthmani returned an empty ayah.');
    return {
      number: Number(ayah.number), numberInSurah: Number(ayah.numberInSurah), surahNumber,
      surahName: ayah?.surah?.englishName || label.surahName || 'Surah ' + surahNumber,
      arabicName: ayah?.surah?.name || label.arabicName || '',
      text: canonicalText, tajweedText: canonicalText,
      tajweedSegments: [{ text: canonicalText, className: '' }],
      textSource: 'quran-uthmani',
      translation: String(english.ayahs[index]?.text || '').replace(/<[^>]*>/g, '').trim(),
      translations: [], words: []
    };
  });
  return {
    page: Number(uthmani.ayahs[0]?.page) || 1,
    juz: Number(uthmani.ayahs[0]?.juz) || 1,
    qcfAvailable: false, textSource: 'quran-uthmani', tajweedComplete: false,
    translationSource: 'Sahih International', ayahs
  };
}
async function fetchQuranCdnPage(page) {
  const query = '?mushaf=5&words=true&translations=131,20&per_page=50&word_fields=text_qpc_hafs,text_uthmani,text_uthmani_tajweed,line_number,page_number,position,char_type_name&fields=text_qpc_hafs,text_uthmani,text_uthmani_tajweed,verse_key,chapter_id,verse_number,juz_number,hizb_number,page_number';
  const payload = await fetchQuranMirror('https://api.qurancdn.com/api/qdc/verses/by_page/' + page + query, normalizeQuranCom, page);
  if (!payload.ayahs.length || payload.ayahs.some(ayah => !ayah.text || !ayah.translation)) throw new Error('Quran CDN page response is missing Arabic text or translation.');
  return { ...payload, textSource: 'qpc-hafs', qcfAvailable: false, mushafId: 5 };
}
async function fetchQuranCdnSurah(surahNumber) {
  const query = '?words=true&translations=131,20&per_page=300&word_fields=text_qpc_hafs,text_uthmani,text_uthmani_tajweed,line_number,page_number,position,char_type_name&fields=text_qpc_hafs,text_uthmani,text_uthmani_tajweed,verse_key,chapter_id,verse_number,juz_number,hizb_number,page_number';
  const payload = await fetchQuranMirror('https://api.qurancdn.com/api/qdc/verses/by_chapter/' + surahNumber + query, normalizeQuranCom, surahNumber);
  if (!payload.ayahs.length || payload.ayahs.some(ayah => !ayah.text || !ayah.translation)) throw new Error('Quran CDN Surah response is missing Arabic text or verse translation.');
  return { ...payload, textSource: 'qpc-hafs', qcfAvailable: false, mushafId: 5 };
}
async function fetchAlQuranCloudTajweedPage(page) {
  const providers = ['https://api.alquran.cloud/v1', 'https://alquran.api.islamic.network/v1', 'https://alquran.api.alislam.ru/v1'];
  let lastError = null;
  for (const base of providers) {
    try {
      return await fetchQuranMirror(base + '/page/' + page + '/quran-tajweed', body => {
        const edition = body?.data;
        if (body?.code !== 200 || !Array.isArray(edition?.ayahs) || !edition.ayahs.length) {
          throw new Error('AlQuranCloud quran-tajweed page edition is incomplete.');
        }
        const annotations = new Map();
        for (const ayah of edition.ayahs) {
          const surahNumber = Number(ayah?.surah?.number);
          const numberInSurah = Number(ayah?.numberInSurah);
          const markup = String(ayah?.text || '');
          if (!Number.isInteger(surahNumber) || !Number.isInteger(numberInSurah) || !markup) continue;
          const segments = parseAlQuranTajweed(markup);
          if (segments.length) {
            annotations.set(surahNumber + ':' + numberInSurah, { markup, segments });
          }
        }
        if (!annotations.size) throw new Error('AlQuranCloud quran-tajweed page contains no colour annotations.');
        return annotations;
      }, page);
    } catch (error) { lastError = error; }
  }
  throw lastError || new Error('No public quran-tajweed page provider is available.');
}
function mergeTajweedEdition(pagePayload, annotations) {
  if (!pagePayload?.ayahs?.length || typeof annotations?.get !== 'function' || !annotations.size) return pagePayload;
  const ayahs = pagePayload.ayahs.map(ayah => {
    if ((ayah.tajweedSegments || []).some(segment => Boolean(segment.className))) return ayah;
    const annotation = annotations.get(ayah.surahNumber + ':' + ayah.numberInSurah);
    if (!annotation?.segments?.length) return ayah;
    const comparable = normalizeTajweedComparable;
    const sourceText = comparable(ayah.text);
    const markedText = comparable(annotation.segments.map(segment => segment.text).join(''));
    if (!sourceText || sourceText !== markedText) {
      console.warn('Skipped Tajweed overlay because the edition text did not match:', ayah.surahNumber + ':' + ayah.numberInSurah);
      return ayah;
    }
    return { ...ayah, tajweedText: annotation.markup, tajweedSegments: annotation.segments, tajweedSource: 'quran-tajweed' };
  });
  const sourced = ayahs.filter(ayah => ayah.tajweedSource === 'quran-tajweed' || ayah.tajweedSource === 'quran-foundation' || (ayah.tajweedSegments || []).some(segment => Boolean(segment.className))).length;
  const colored = ayahs.filter(ayah => (ayah.tajweedSegments || []).some(segment => Boolean(segment.className))).length;
  const missing = ayahs.filter(ayah => !ayah.tajweedSource && !(ayah.tajweedSegments || []).some(segment => Boolean(segment.className))).map(ayah => ayah.surahNumber + ':' + ayah.numberInSurah);
  const uncolored = ayahs.filter(ayah => (ayah.tajweedSource === 'quran-foundation' || ayah.tajweedSource === 'quran-tajweed') && !(ayah.tajweedSegments || []).some(segment => Boolean(segment.className))).map(ayah => ayah.surahNumber + ':' + ayah.numberInSurah);
  return {
    ...pagePayload,
    ayahs,
    tajweedComplete: ayahs.length > 0 && sourced === ayahs.length,
    tajweedCoverage: { totalAyahs: ayahs.length, sourcedAyahs: sourced, coloredAyahs: colored, uncoloredAyahs: uncolored, missingAyahs: missing, mismatchedAyahs: [] }
  };
}
async function fetchAlQuranCloudPage(page) {
  try { return await fetchQuranCdnPage(page); }
  catch (error) { console.warn('Public Quran CDN page provider unavailable; trying AlQuranCloud:', error.message); }
  const providers = ['https://api.alquran.cloud/v1', 'https://alquran.api.islamic.network/v1', 'https://alquran.api.alislam.ru/v1'];
  let lastError = null;
  for (const base of providers) {
    try {
      try {
        const editions = await fetchQuranMirror(
          base + '/page/' + page + '/editions/quran-uthmani,en.sahih',
          body => {
            const list = Array.isArray(body?.data) ? body.data : [];
            const hasUthmani = list.some(item => item?.edition?.identifier === 'quran-uthmani' && Array.isArray(item?.ayahs));
            const hasEnglish = list.some(item => item?.edition?.identifier === 'en.sahih' && Array.isArray(item?.ayahs));
            if (body?.code !== 200 || !hasUthmani || !hasEnglish) {
              throw new Error('AlQuranCloud returned incomplete quran-uthmani/en.sahih page editions.');
            }
            return body;
          }, page
        );
        return normalizeAlQuranCloud(editions, page);
      } catch (combinedError) {
        // Compatibility fallback for mirrors that expose the two editions separately.
        const normalizeEdition = body => {
          if (body?.code !== 200 || !Array.isArray(body?.data?.ayahs) || !body.data.ayahs.length) {
            throw new Error('AlQuranCloud returned an incomplete page edition.');
          }
          return body.data;
        };
        const [uthmani, english] = await Promise.all([
          fetchQuranMirror(base + '/page/' + page + '/quran-uthmani', normalizeEdition, page),
          fetchQuranMirror(base + '/page/' + page + '/en.sahih', normalizeEdition, page)
        ]);
        return normalizeAlQuranCloud({ code: 200, data: [uthmani, english] }, page);
      }
    } catch (error) {
      lastError = error;
      console.warn('AlQuranCloud combined/split Uthmani/Sahih page provider failed:', base, error.message);
    }
  }
  throw lastError || new Error('No quran-uthmani/en.sahih page provider is available.');
}
async function fetchAlQuranCloudSurah(surahNumber) {
  try { return await fetchQuranFoundationSurah(surahNumber); }
  catch (error) { console.warn('Quran Foundation Surah API unavailable; using compatible fallback:', error.message); }
  try { return await fetchQuranCdnSurah(surahNumber); }
  catch (error) { console.warn('Public Quran CDN Surah provider unavailable; trying authenticated/legacy providers:', error.message); }
  const qpcQuery = '?mushaf=19&words=true&translations=20&word_fields=code_v2,line_number,line_v2,page_number,v2_page,text_uthmani,text_qpc_hafs,text_uthmani_tajweed,position,verse_key,char_type_name&fields=text_uthmani,text_qpc_hafs,text_uthmani_tajweed,verse_key,chapter_id,verse_number,juz_number,hizb_number&per_page=300';
  for (const url of [
    'https://quran.com/api/proxy/content/api/qdc/verses/by_chapter/' + surahNumber + qpcQuery,
    'https://api.quran.com/api/v4/verses/by_chapter/' + surahNumber + qpcQuery
  ]) {
    try {
      const qpcSurah = await fetchQuranMirror(url, normalizeQuranCom, 1);
      if (qpcSurah?.ayahs?.length && qpcSurah.ayahs.every(ayah => ayah.textSource === 'qpc-hafs' && ayah.tajweedSegments?.some(segment => Boolean(segment.className)) && ayah.translation)) {
        return { ...qpcSurah, page: qpcSurah.ayahs[0]?.pageNumber || 1, textSource: 'qpc-hafs' };
      }
    } catch (error) {
      console.warn('Quran.com QPC Hafs Surah provider failed:', surahNumber, error.message);
    }
  }
  const providers = ['https://api.alquran.cloud/v1', 'https://alquran.api.islamic.network/v1', 'https://alquran.api.alislam.ru/v1'];
  let lastError = null;
  for (const base of providers) {
    try {
      const editions = await fetchQuranMirror(
        base + '/surah/' + surahNumber + '/editions/quran-uthmani,en.sahih',
        body => {
          if (body?.code !== 200 || !Array.isArray(body?.data) || body.data.length < 2) throw new Error('AlQuranCloud returned incomplete Surah editions.');
          return body;
        }, surahNumber
      );
      return normalizeAlQuranCloudSurah(editions, surahNumber);
    } catch (error) {
      lastError = error;
      console.warn('AlQuranCloud quran-uthmani Surah provider failed:', base, error.message);
    }
  }
  throw lastError || new Error('No quran-uthmani Surah provider is available.');
}
async function fetchQuranFoundationPage(page) {
  const { headers, apiBase } = await getQuranApiAuth();
  if (!headers['x-auth-token'] || !headers['x-client-id']) throw new Error('Quran Foundation API credentials are not configured.');
  const query = '?mushaf=19&words=true&translations=131,20&per_page=50&word_fields=code_v2,text_qpc_hafs,text_uthmani_tajweed,line_number,page_number,position,char_type_name&fields=verse_key,chapter_id,verse_number,juz_number,hizb_number,page_number,text_uthmani_tajweed';
  const [verseResponse, lookupResponse] = await Promise.all([
    fetch(apiBase + '/verses/by_page/' + page + query, { headers: { Accept: 'application/json', ...headers }, signal: AbortSignal.timeout(12000) }),
    fetch(apiBase + '/pages/lookup?page_number=' + page + '&mushaf=19', { headers: { Accept: 'application/json', ...headers }, signal: AbortSignal.timeout(9000) }).catch(() => null)
  ]);
  if (!verseResponse.ok) throw new Error('Quran Foundation by_page returned HTTP ' + verseResponse.status + '.');
  const normalized = normalizeQuranCom(await verseResponse.json(), page);
  if (!normalized.ayahs.length || !normalized.qcfAvailable || normalized.ayahs.some(ayah => !ayah.translation || !ayah.words?.length || ayah.words.some(word => word.charTypeName !== 'end' && word.charTypeName !== 'pause' && (!word.lineNumber || !word.codeV2)))) throw new Error('Quran Foundation page response is missing translation, QCF V4 word glyph, or line data.');
  // QCF V4 supplies the page glyphs, but its Tajweed annotations can be incomplete
  // on individual pages. Fill those gaps from the official verse endpoint first,
  // then the public quran-tajweed edition, while keeping the QCF text and layout.
  let enriched = normalized;
  const hasCompleteTajweed = normalized.ayahs.every(ayah => (ayah.tajweedSegments || []).some(segment => Boolean(segment.className)));
  if (!hasCompleteTajweed) {
    enriched = await enrichPageWithQuranJsonTajweed(normalized);
    if (!enriched.tajweedComplete) {
      try {
        enriched = mergeTajweedEdition(enriched, await fetchAlQuranCloudTajweedPage(page));
      } catch (error) {
        console.warn('QCF page Tajweed completion fallback unavailable:', page, error.message);
      }
    }
  }
  let pageRange = null;
  if (lookupResponse?.ok) {
    const lookup = await lookupResponse.json();
    pageRange = lookup?.pages?.[String(page)] || null;
  }
  return { ...enriched, textSource: 'qcf-v4', qcfAvailable: true, mushafId: 19, pageRange };
}
async function fetchQuranFoundationSurah(surahNumber) {
  const { headers, apiBase } = await getQuranApiAuth();
  if (!headers['x-auth-token'] || !headers['x-client-id']) throw new Error('Quran Foundation API credentials are not configured.');
  const query = '?words=true&translations=131,20&per_page=300&word_fields=code_v2,text_qpc_hafs,text_uthmani_tajweed,line_number,page_number,position,char_type_name&fields=verse_key,chapter_id,verse_number,juz_number,hizb_number,page_number';
  const response = await fetch(apiBase + '/verses/by_chapter/' + surahNumber + query, { headers: { Accept: 'application/json', ...headers }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error('Quran Foundation by_chapter returned HTTP ' + response.status + '.');
  const normalized = normalizeQuranCom(await response.json(), 1);
  if (!normalized.ayahs.length) throw new Error('Quran Foundation returned no Surah verses.');
  if (normalized.ayahs.some(ayah => !ayah.translation)) throw new Error('Quran Foundation Surah response is missing one or more verse translations.');
  if (normalized.ayahs.some(ayah => !ayah.tajweedSegments?.some(segment => Boolean(segment.className)))) throw new Error('Quran Foundation Surah response is missing Tajweed markup.');
  return { ...normalized, textSource: 'qpc-hafs', qcfAvailable: normalized.ayahs.every(ayah => ayah.words?.length), mushafId: 1 };
}
function normalizeQuranCom(body, page) {
  const verses = Array.isArray(body?.verses) ? body.verses : [];
  if (!verses.length) throw new Error('Quran.com mirror returned an incomplete page.');
  const firstWords = verses.flatMap(verse => Array.isArray(verse.words) ? verse.words : []);
  const qcfAvailable = firstWords.some(word => typeof word?.code_v2 === 'string' && word.code_v2.length > 0);
  const firstTranslationIds = Array.isArray(verses[0]?.translations) ? verses[0].translations.map(item => Number(item.resource_id || item.id)) : [];
  const translationSource = firstTranslationIds.includes(131) ? 'The Clear Quran · Dr. Mustafa Khattab' : 'Sahih International';
  return { page, juz: Number(verses[0]?.juz_number) || 1, hizb: Number(verses[0]?.hizb_number) || 1, qcfAvailable,
    ayahs: verses.map(verse => {
      const [surahRaw, ayahRaw] = String(verse.verse_key || '').split(':');
      const surahNumber = Number(verse.chapter_id || surahRaw);
      const label = quranSurahLabels[surahNumber] || {};
      const translations = Array.isArray(verse.translations) ? verse.translations.map(item => ({
        id: Number(item.resource_id || item.id), name: String(item.name || item.resource_name || ''),
        text: String(item.text || '').replace(/<[^>]*>/g, '').trim()
      })) : [];
      const clearQuran = translations.find(item => item.id === 131);
      const sahih = translations.find(item => item.id === 20);
      const words = Array.isArray(verse.words) ? verse.words.map(word => ({
        text: String(word.text_qpc_hafs || word.text_uthmani || ''),
        tajweed: String(word.text_uthmani_tajweed || ''),
        codeV2: String(word.code_v2 || ''),
        lineNumber: Number(word.line_number || word.line_v2 || 0),
        pageNumber: Number(word.page_number || word.v2_page || page),
        position: Number(word.position || word.location || 0),
        verseKey: String(verse.verse_key || ''),
        charTypeName: String(word.char_type_name || '')
      })) : [];
      const text = String(verse.text_qpc_hafs || verse.text_uthmani || words.map(word => word.text).join(' '));
      const textSource = verse.text_qpc_hafs ? 'qpc-hafs' : 'quran-uthmani';
      const tajweedText = String(verse.text_uthmani_tajweed || words.map(word => word.tajweed).filter(Boolean).join(' '));
      const tajweedSegments = tajweedText.trim() ? parseAlQuranTajweed(tajweedText) : [{ text: normalizeMadinahArabic(text), className: '' }];
      return { number: Number(verse.id), numberInSurah: Number(verse.verse_number || ayahRaw), surahNumber,
        surahName: label.surahName || `Surah ${surahNumber}`, arabicName: label.arabicName || '',
        text, textSource, tajweedText, tajweedSegments,
        translation: clearQuran?.text || sahih?.text || '',
        pageNumber: Number(verse.page_number || words.find(word => word.pageNumber)?.pageNumber || page),
        translations, words };
    }) };
}
// Identity adapter retained for the page pipeline. Provider-tagged Tajweed is
// tokenized directly and is never reconstructed from offsets in another edition.
async function enrichPageWithQuranJsonTajweed(pagePayload) {
  try {
    const { headers, apiBase } = await getQuranApiAuth();
    const tajweedByVerse = await fetchOfficialTajweedPage(apiBase, headers, pagePayload.page);
    return applyTajweedToPage(pagePayload, tajweedByVerse);
  } catch (error) {
    // Public Quran.com mirrors are merged below when authenticated Tajweed is unavailable.
    return pagePayload;
  }
}
function splitTajweedWords(markup) {
  const tokens = String(markup || '').match(/<[^>]*>|[^<\s]+|\s+/g) || [];
  const words = [];
  let current = '';
  for (const token of tokens) {
    if (/^\s+$/.test(token)) { if (current) words.push(current); current = ''; }
    else current += token.replace(/[\u06DD\u06DE\u06E9\u06DF-\u06E8\u06EA-\u06ED]/g, '');
  }
  if (current) words.push(current);
  return words;
}
function mergeMissingTajweed(primary, fallback) {
  const backupByAyah = new Map((fallback?.ayahs || []).map(ayah => [String(ayah.surahNumber) + ':' + String(ayah.numberInSurah), ayah]));
  const ayahs = (primary?.ayahs || []).map(ayah => {
    if ((ayah.tajweedSegments || []).some(segment => Boolean(segment.className))) return ayah;
    const backup = backupByAyah.get(String(ayah.surahNumber) + ':' + String(ayah.numberInSurah));
    if (!backup || !(backup.tajweedSegments || []).some(segment => Boolean(segment.className))) return ayah;
    return ayah.textSource === 'quran-uthmani'
      ? { ...ayah, tajweedText: backup.tajweedText, tajweedSegments: backup.tajweedSegments }
      : { ...ayah, text: backup.text, tajweedText: backup.tajweedText, tajweedSegments: backup.tajweedSegments };
  });
  return { ...primary, ayahs, tajweedComplete: ayahs.length > 0 && ayahs.every(ayah => (ayah.tajweedSegments || []).some(segment => Boolean(segment.className))) };
}
async function fetchOfficialTajweedVerses(filter, auth, label) {
  const query = new URLSearchParams(filter).toString();
  const sources = [];
  if (auth?.headers?.['x-auth-token'] && auth?.apiBase) sources.push(auth.apiBase + '/quran/verses/uthmani_tajweed?' + query);
  sources.push('https://api.quran.com/api/v4/quran/verses/uthmani_tajweed?' + query);
  let lastError = null;
  for (const url of sources) {
    try {
      return await fetchQuranMirror(url, body => {
        const verses = Array.isArray(body?.verses) ? body.verses : [];
        if (!verses.length) throw new Error('Quran Foundation returned no Uthmani Tajweed verses for ' + label + '.');
        const annotations = new Map();
        for (const verse of verses) {
          const key = String(verse?.verse_key || '');
          const markup = String(verse?.text_uthmani_tajweed || '');
          if (/^\d+:\d+$/.test(key) && markup) annotations.set(key, markup);
        }
        if (!annotations.size) throw new Error('Quran Foundation returned no Tajweed markup for ' + label + '.');
        return annotations;
      }, 1, url.startsWith(auth?.apiBase || '\u0000') ? (auth?.headers || {}) : {});
    } catch (error) {
      lastError = error;
      console.warn('Quran Foundation Tajweed source failed for ' + label + ':', error.message);
    }
  }
  throw lastError || new Error('No official Tajweed source is available for ' + label + '.');
}
async function fetchOfficialTajweedPage(apiBase, headers, page) {
  return fetchOfficialTajweedVerses({ page_number: String(page) }, { apiBase, headers }, 'page ' + page);
}
async function fetchOfficialTajweedSurah(apiBase, headers, surahNumber) {
  return fetchOfficialTajweedVerses({ chapter_number: String(surahNumber) }, { apiBase, headers }, 'Surah ' + surahNumber);
}
function normalizeTajweedComparable(value) {
  return normalizeMadinahArabic(stripQuranMarkup(value))
    .normalize('NFKC')
    .replace(/[ىٮ]ٰ/g, 'ا')
    .replace(/[\s\u00A0\u0640\u064B-\u065F\u06D6-\u06ED\u061C\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g, '')
    .replace(/[ٱأإآٲٳٵٰ]/g, 'ا')
    .replace(/[ىٮ]/g, 'ي')
    .replace(/ئ/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ی/g, 'ي')
    .replace(/ک/g, 'ك');
}
function applyTajweedToPage(pagePayload, tajweedByVerse) {
  const ayahs = pagePayload.ayahs.map(ayah => {
    const key = ayah.surahNumber + ':' + ayah.numberInSurah;
    const tajweedText = tajweedByVerse.get(key) || '';
    if (!tajweedText) return { ...ayah, tajweedSource: ayah.tajweedSource || null };
    const segments = parseAlQuranTajweed(tajweedText);
    const markedText = segments.map(segment => segment.text).join('');
    const sourceText = normalizeTajweedComparable(ayah.text);
    const annotationText = normalizeTajweedComparable(markedText);
    if (!sourceText || !annotationText || sourceText !== annotationText) {
      console.warn('Skipped official Tajweed markup because its Arabic text did not match:', key);
      return { ...ayah, tajweedMismatch: true };
    }
    const markedWords = splitTajweedWords(tajweedText);
    const textWords = (ayah.words || []).filter(word => word.charTypeName !== 'end' && word.charTypeName !== 'pause');
    const words = ayah.words?.length && markedWords.length === textWords.length
      ? (() => { let index = 0; return ayah.words.map(word => word.charTypeName === 'end' || word.charTypeName === 'pause' ? word : { ...word, tajweed: markedWords[index++] }); })()
      : ayah.words;
    return { ...ayah, tajweedText, tajweedSegments: segments, words, tajweedSource: 'quran-foundation', tajweedMismatch: false };
  });
  const sourced = ayahs.filter(ayah => ayah.tajweedSource === 'quran-foundation' || ayah.tajweedSource === 'quran-tajweed' || (ayah.tajweedSegments || []).some(segment => Boolean(segment.className))).length;
  const colored = ayahs.filter(ayah => (ayah.tajweedSegments || []).some(segment => Boolean(segment.className))).length;
  const missing = ayahs.filter(ayah => !ayah.tajweedSource && !(ayah.tajweedSegments || []).some(segment => Boolean(segment.className))).map(ayah => ayah.surahNumber + ':' + ayah.numberInSurah);
  const uncolored = ayahs.filter(ayah => (ayah.tajweedSource === 'quran-foundation' || ayah.tajweedSource === 'quran-tajweed') && !(ayah.tajweedSegments || []).some(segment => Boolean(segment.className))).map(ayah => ayah.surahNumber + ':' + ayah.numberInSurah);
  const mismatched = ayahs.filter(ayah => ayah.tajweedMismatch).map(ayah => ayah.surahNumber + ':' + ayah.numberInSurah);
  return {
    ...pagePayload,
    ayahs,
    tajweedComplete: sourced === ayahs.length && mismatched.length === 0,
    tajweedCoverage: { totalAyahs: ayahs.length, sourcedAyahs: sourced, coloredAyahs: colored, uncoloredAyahs: uncolored, missingAyahs: missing, mismatchedAyahs: mismatched }
  };
}
async function fetchQuranMirror(url, normalizer, page, extraHeaders = {}) {
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'AmstreemAtlas/1.0', ...extraHeaders }, signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error(`Mirror returned HTTP ${response.status}.`);
      return normalizer(await response.json(), page);
    } catch (error) {
      lastError = error;
      if (attempt === 0) console.warn('Qur’an provider request failed; retrying once:', error.message);
    }
  }
  throw lastError || new Error('Qur’an provider request failed.');
}
app.get('/api/quran/page/:page', async (req, res) => {
  const page = Number(req.params.page);
  if (!Number.isInteger(page) || page < 1 || page > 604) return res.status(400).json({ error: 'Qur’an page must be between 1 and 604.' });
  const send = (payload, source) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Quran-Cache', source);
    return res.json(sanitizeQuranPayload(payload));
  };
  const cached = quranPageCache.get(page);
  if (cached && Date.now() - cached.cachedAt < QURAN_CACHE_TTL_MS) return send(cached.payload, 'HIT');
  if (quranPageInflight.has(page)) {
    try { return send(await quranPageInflight.get(page), 'COALESCED'); } catch { /* provider retry below */ }
  }
  const task = (async () => {
    try { return await fetchQuranFoundationPage(page); }
    catch (error) { console.warn('Quran Foundation Mushaf page API unavailable; using fallback:', error.message); }
    let primary = null;
    try { primary = await fetchAlQuranCloudPage(page); }
    catch (error) { console.warn('AlQuranCloud providers exhausted:', error.message); }
    let fallback = null;
    const query = `?mushaf=1&words=true&translations=20&word_fields=code_v2,line_number,line_v2,page_number,v2_page,text_uthmani,text_qpc_hafs,text_uthmani_tajweed,position,verse_key,char_type_name&fields=text_uthmani,text_qpc_hafs,text_uthmani_tajweed,verse_key,chapter_id,verse_number,juz_number,hizb_number&page=${page}&per_page=50`;
    const primaryAnnotations = (primary?.ayahs || []).filter(ayah => (ayah.tajweedSegments || []).some(segment => Boolean(segment.className))).length;
    if (primary?.ayahs?.length && primaryAnnotations < primary.ayahs.length) {
      for (const url of [`https://quran.com/api/proxy/content/api/qdc/verses/by_page/${page}${query}`,`https://api.quran.com/api/v4/verses/by_page/${page}${query}`]) {
        try {
          fallback = await fetchQuranMirror(url, normalizeQuranCom, page);
          if (fallback?.ayahs?.length && fallback.tajweedComplete) break;
        } catch (error) { console.warn('Quran.com fallback failed:', error.message); }
      }
    }
    const annotationCount = candidate => (candidate?.ayahs || []).filter(ayah => (ayah.tajweedSegments || []).some(segment => Boolean(segment.className))).length;
    const sourcePage = fallback?.textSource === 'qpc-hafs'
      ? mergeMissingTajweed(fallback, primary)
      : (primary?.ayahs?.length ? mergeMissingTajweed(primary, fallback) : (fallback?.qcfAvailable ? fallback : null));
    if (!sourcePage?.ayahs?.length) {
      const offline = quranOfflinePages[String(page)];
      if (offline?.ayahs?.length) return { ...offline, page, offlineFallback: true, qcfAvailable: false };
      throw new Error('All Qur’an page providers are temporarily unavailable.');
    }
    let enrichedPage = await enrichPageWithQuranJsonTajweed(sourcePage);
    if (!enrichedPage.tajweedComplete) {
      try {
        const editionAnnotations = await fetchAlQuranCloudTajweedPage(page);
        enrichedPage = mergeTajweedEdition(enrichedPage, editionAnnotations);
      } catch (error) {
        console.warn('AlQuranCloud quran-tajweed page fallback unavailable:', page, error.message);
      }
    }
    enrichedPage.tajweedComplete = Boolean(enrichedPage.tajweedComplete);
    return {
      ...enrichedPage, page, juz: enrichedPage.juz || getPageJuzFallback(page),
      ayahs: enrichedPage.ayahs.map(ayah => ({
        ...ayah, text: String(ayah.text || ''), tajweedText: String(ayah.tajweedText || ''),
        tajweedSegments: Array.isArray(ayah.tajweedSegments) ? ayah.tajweedSegments : parseAlQuranTajweed(ayah.tajweedText || ''),
        translation: String(ayah.translation || '')
      })),
      tajweedComplete: enrichedPage.tajweedComplete
    };
  })();
  quranPageInflight.set(page, task);
  try {
    const payload = sanitizeQuranPayload(await task);
    quranPageCache.set(page, { cachedAt: Date.now(), payload });
    if (quranPageCache.size > 604) quranPageCache.delete(quranPageCache.keys().next().value);
    return send(payload, payload.offlineFallback ? 'OFFLINE' : 'MISS');
  } catch (error) {
    console.error('Qur’an page providers exhausted:', error.message);
    if (cached?.payload?.ayahs?.length) return send(cached.payload, 'STALE');
    return res.status(502).json({ error: 'This page could not be fetched right now. Saved pages remain available; retry when the connection returns.' });
  } finally { quranPageInflight.delete(page); }
});
app.get('/api/quran/surah/:surah', async (req, res) => {
  const surahNumber = Number(req.params.surah);
  if (!Number.isInteger(surahNumber) || surahNumber < 1 || surahNumber > 114) {
    return res.status(400).json({ error: 'Qur’an Surah must be between 1 and 114.' });
  }
  const send = (payload, source) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Quran-Cache', source);
    return res.json(sanitizeQuranPayload(payload));
  };
  const cached = quranSurahCache.get(surahNumber);
  if (cached && Date.now() - cached.cachedAt < QURAN_CACHE_TTL_MS) return send(cached.payload, 'HIT');
  if (quranSurahInflight.has(surahNumber)) {
    try { return send(await quranSurahInflight.get(surahNumber), 'COALESCED'); } catch { /* provider retry below */ }
  }
  const task = (async () => {
    const source = await fetchAlQuranCloudSurah(surahNumber);
    let enriched = source;
    try {
      const auth = await getQuranApiAuth();
      const annotations = await fetchOfficialTajweedSurah(auth.apiBase, auth.headers, surahNumber);
      enriched = applyTajweedToPage(source, annotations);
      if (enriched.tajweedComplete) return enriched;
      console.warn('Official Tajweed source is incomplete for Surah:', surahNumber, enriched.tajweedCoverage);
    } catch (error) {
      console.warn('Official Surah Tajweed enrichment unavailable:', surahNumber, error.message);
    }
    const editions = ['https://api.alquran.cloud/v1', 'https://alquran.api.islamic.network/v1', 'https://alquran.api.alislam.ru/v1'];
    for (const base of editions) {
      try {
        const annotations = await fetchQuranMirror(base + '/surah/' + surahNumber + '/quran-tajweed', body => {
          const list = body?.data?.ayahs;
          if (body?.code !== 200 || !Array.isArray(list) || !list.length) throw new Error('Tajweed Surah edition is incomplete.');
          const map = new Map();
          for (const ayah of list) {
            const key = Number(ayah?.surah?.number) + ':' + Number(ayah?.numberInSurah);
            const markup = String(ayah?.text || '');
            if (/^\d+:\d+$/.test(key) && markup) map.set(key, { markup, segments: parseAlQuranTajweed(markup) });
          }
          return map;
        }, 1);
        const merged = mergeTajweedEdition(enriched, annotations);
        if (merged.tajweedComplete) return merged;
        enriched = merged;
      } catch (fallbackError) {
        console.warn('Tajweed Surah mirror failed:', surahNumber, fallbackError.message);
      }
    }
    return enriched;
  })();
  quranSurahInflight.set(surahNumber, task);
  try {
    const payload = sanitizeQuranPayload(await task);
    quranSurahCache.set(surahNumber, { cachedAt: Date.now(), payload });
    if (quranSurahCache.size > 114) quranSurahCache.delete(quranSurahCache.keys().next().value);
    return send(payload, 'MISS');
  } catch (error) {
    console.error('Qur’an Surah provider failed:', surahNumber, error.message);
    if (cached?.payload?.ayahs?.length) return send(cached.payload, 'STALE');
    return res.status(502).json({ error: 'This Surah could not be fetched right now. Please retry when the connection returns.' });
  } finally {
    quranSurahInflight.delete(surahNumber);
  }
});
function getPageJuzFallback(page) {
  const starts = [1,22,42,62,82,102,121,142,162,182,201,222,242,262,282,302,322,342,362,382,402,422,442,462,482,502,522,542,562,582];
  let juz = 1;
  for (let index = 0; index < starts.length; index += 1) if (page >= starts[index]) juz = index + 1;
  return juz;
}

const ownerUserId = process.env.ADMIN_USER_ID || (process.env.ATLAS_STAGING === 'true' ? null : supabaseConfig.ownerUserId);
const tenantContext = new AsyncLocalStorage();
const userLocks = new Map();
const workspaceTables = [
  'goals','projects','project_milestones','tasks','modules','learning_paths','learning_lessons','learning_resources',
  'learning_study_logs','sessions','calendar_events','notes','reviews','settings','habits','habit_logs',
  'prayer_logs','quran_logs','tahajjud_logs','faith_logs','self_control_logs','self_control_trackers',
  'self_control_entries','rhythm_records','reading_items','email_events','login_events','xp_events','achievement_unlocks','weekly_challenges','feedback_logs'
];
function publishAtlasEvent(req, event) {
  if (!Array.isArray(req.atlasEvents)) return;
  const { requestKey: eventRequestKey, ...eventFields } = event;
  const requestKey = eventRequestKey || req.idempotencyKey || req.requestId || crypto.randomUUID();
  req.atlasEvents.push(createAtlasEvent({ ...eventFields, requestKey }));
}
function currentDb() {
  const context = tenantContext.getStore();
  if (!context?.db) throw new Error('Workspace database accessed outside an authenticated request.');
  return context.db;
}
const db = new Proxy({}, { get(_target, prop) { const active = currentDb(); const value = active[prop]; return typeof value === 'function' ? value.bind(active) : value; } });
// Keep ordinary API payloads small; allow larger JSON only for explicit backup imports.
app.use('/api/import', express.json({ limit: '10mb' }));
app.use(express.json({ limit: '1mb' }));
app.get('/supabase-config.js', (req, res) => {
  res.type('application/javascript').set('Cache-Control', 'no-store').send(
    'window.PERSONAL_OS_SUPABASE = ' + JSON.stringify({
      url: supabaseConfig.url,
      publishableKey: supabaseConfig.publishableKey
    }) + ';'
  );
});
const frontendDist = path.join(__dirname, 'dist');
const frontendEntry = path.join(frontendDist, 'index.html');
const buildRevision = String(process.env.RENDER_GIT_COMMIT || process.env.BUILD_ID || 'local').replace(/[^a-zA-Z0-9_-]/g, '');

// HTML is always revalidated; only Vite's content-hashed /assets files are immutable.
app.use((req, res, next) => {
  if (req.path === '/' || req.path.toLowerCase().endsWith('.html')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  } else if (req.path.startsWith('/assets/') && /-[A-Za-z0-9_-]{8,}\.(?:js|css|woff2?|svg|png|jpe?g|webp|ico)$/i.test(path.basename(req.path))) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }
  next();
});

// Versioned PWA worker: updates wait for the user and never reload an active editing session.
app.get('/service-worker.js', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.type('application/javascript').send(`
    const CACHE_VERSION = 'atlas-shell-${buildRevision}';
    const SHELL_URLS = ['/', '/index.html', '/manifest.webmanifest'];

    self.addEventListener('install', event => {
      event.waitUntil(caches.open(CACHE_VERSION).then(cache => cache.addAll(SHELL_URLS)).catch(() => undefined));
    });

    self.addEventListener('message', event => {
      if (event.data && event.data.type === 'ATLAS_ACTIVATE_UPDATE') self.skipWaiting();
    });

    self.addEventListener('activate', event => {
      event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys.filter(key => key.startsWith('atlas-shell-') && key !== CACHE_VERSION).map(key => caches.delete(key)));
        await self.clients.claim();
      })());
    });

    self.addEventListener('fetch', event => {
      const request = event.request;
      const url = new URL(request.url);
      if (request.method !== 'GET' || url.origin !== self.location.origin) return;

      const pathname = url.pathname;
      // API traffic and every Qur'an route/font/audio request remain network-only and untouched.
      if (pathname.startsWith('/api/') || pathname === '/quran' || pathname.startsWith('/quran/') ||
          pathname.startsWith('/fonts/') || /quran|tajweed|recitation/i.test(pathname)) return;

      if (request.mode === 'navigate') {
        event.respondWith(fetch(request).then(response => {
          if (response.ok) caches.open(CACHE_VERSION).then(cache => cache.put('/index.html', response.clone()));
          return response;
        }).catch(async () => (await caches.match('/index.html')) || Response.error()));
        return;
      }

      if (pathname.startsWith('/assets/') && /-[A-Za-z0-9_-]{8,}/.test(pathname) && (pathname.endsWith('.js') || pathname.endsWith('.css'))) {
        event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
          if (response.ok) caches.open(CACHE_VERSION).then(cache => cache.put(request, response.clone()));
          return response;
        })));
        return;
      }

      if (pathname.startsWith('/assets/brand/') || pathname.startsWith('/assets/fonts/')) {
        event.respondWith(caches.match(request).then(cached => {
          const fresh = fetch(request).then(response => {
            if (response.ok) caches.open(CACHE_VERSION).then(cache => cache.put(request, response.clone()));
            return response;
          });
          return cached || fresh;
        }));
      }
    });
  `);
});
app.use(express.static(frontendDist, {
  setHeaders(res, filePath) {
    const relativePath = path.relative(frontendDist, filePath).split(path.sep).join('/');
    if (relativePath === 'index.html') {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    } else if (relativePath.startsWith('assets/') && /-[A-Za-z0-9_-]{8,}\.(?:js|css|woff2?|svg|png|jpe?g|webp|ico)$/i.test(path.basename(filePath))) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  }
}));
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

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
  const url = `${supabaseConfig.url}/rest/v1/personal_os_workspaces?select=data,version,schema_version&user_id=eq.${encodeURIComponent(userId)}`;
  const response = await fetch(url, { headers: { apikey: supabaseConfig.publishableKey, Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error('Could not load your saved workspace from Supabase.');
  const rows = await response.json();
  const row = rows[0];
  return {
    data: row?.data ?? null,
    version: Number(row?.version ?? 0),
    schemaVersion: Number(row?.schema_version ?? 3)
  };
}
function createWorkspaceDatabase(snapshot) {
  const workspaceDb = new Database(':memory:');
  try {
    workspaceDb.pragma('foreign_keys = ON');
    workspaceDb.exec(schemaSql);
  if (['personal-os-sqlite-snapshot-v1','personal-os-sqlite-snapshot-v2','personal-os-sqlite-snapshot-v3'].includes(snapshot?.format) && snapshot.tables && typeof snapshot.tables === 'object') {
    const optionalTables = ['projects','project_milestones','calendar_events','reviews','faith_logs','rhythm_records','reading_items','login_events','xp_events','achievement_unlocks','weekly_challenges','feedback_logs'];
    for (const table of workspaceTables) {
      if (!Array.isArray(snapshot.tables[table]) && !optionalTables.includes(table)) {
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
  return { format: 'personal-os-sqlite-snapshot-v3', schemaVersion: 3, tables };
}
async function writeWorkspaceSnapshot(userId, token, workspaceDb, workspaceState, req) {
  const data = serializeWorkspaceDatabase(workspaceDb);
  const isImport = req.originalUrl?.split('?')[0] === '/api/import';
  return commitWorkspaceSnapshot({
    supabaseUrl: supabaseConfig.url,
    publishableKey: supabaseConfig.publishableKey,
    token,
    userId,
    expectedVersion: workspaceState.version,
    data,
    schemaVersion: data.schemaVersion || workspaceState.schemaVersion || 3,
    idempotencyKey: req.idempotencyKey || req.requestId || crypto.randomUUID(),
    requestHash: req.idempotencyHash || createWorkspaceRequestHash({
      method: req.method,
      path: req.originalUrl,
      body: req.body
    }),
    forceHistory: isImport,
    historyReason: isImport ? 'pre_import' : 'scheduled',
    events: req.atlasEvents || []
  });
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
// Versioned aliases share the exact same handlers and authentication path as legacy /api routes.
// Qur'an endpoints remain on their protected legacy contract until separately versioned.
app.use((req, res, next) => {
  if (req.path !== '/api/v1' && !req.path.startsWith('/api/v1/')) return next();
  const versionedPath = req.path.slice('/api/v1'.length);
  if (versionedPath === '/quran' || versionedPath.startsWith('/quran/')) {
    return sendProblem(res, { status: 404, title: 'Not Found', detail: 'The Qur’an API is not available under /api/v1.', code: 'versioned_route_unavailable', instance: req.originalUrl });
  }
  req.url = '/api' + req.url.slice('/api/v1'.length);
  next();
});

app.use(validateApiEnvelope());
app.use('/api', apiProblemResponses());
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
    const accountRetryAfter = consumeRateLimit(`account:${user.id}`, 240);
    if (accountRetryAfter) {
      res.setHeader('Retry-After', String(accountRetryAfter));
      return res.status(429).json({ error: 'Too many requests for this account. Please wait and try again.' });
    }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const idempotencyKey = String(req.get('Idempotency-Key') || req.requestId || crypto.randomUUID());
      if (!/^[A-Za-z0-9._:-]{8,200}$/.test(idempotencyKey)) {
        return res.status(400).json({ error: 'A valid Idempotency-Key is required for workspace writes.' });
      }
      req.idempotencyKey = idempotencyKey;
      req.idempotencyHash = createWorkspaceRequestHash({
        method: req.method,
        path: req.originalUrl,
        body: req.body
      });
      res.setHeader('Idempotency-Key', idempotencyKey);
    }
    release = await acquireUserLock(user.id);
    const savedWorkspace = await readWorkspaceSnapshot(user.id, token);
    workspaceDb = createWorkspaceDatabase(savedWorkspace.data);
    const workspaceState = { version: savedWorkspace.version, schemaVersion: savedWorkspace.schemaVersion };
    req.workspaceState = workspaceState;
    req.workspaceToken = token;
    req.workspaceUserId = user.id;
    const context = { userId: user.id, db: workspaceDb, events: [] };
    req.atlasEvents = context.events;
    tenantContext.run(context, () => {
      const originalEnd = res.end.bind(res);
      let ending = false;
      res.end = (...args) => {
        if (ending) return res;
        ending = true;
        if (req.skipWorkspaceCommit || ['GET', 'HEAD', 'OPTIONS'].includes(req.method) || res.statusCode >= 400) {
          workspaceDb.close();
          release?.();
          return originalEnd(...args);
        }
        writeWorkspaceSnapshot(user.id, token, workspaceDb, workspaceState, req)
          .then(commit => {
            res.setHeader('X-Workspace-Version', String(commit.version));
            return originalEnd(...args);
          })
          .catch(error => {
            console.error(JSON.stringify({
              timestamp: new Date().toISOString(),
              level: 'error',
              event: 'workspace.commit_failed',
              requestId: req.requestId,
              code: error.code || 'workspace_commit_failed'
            }));
            res.statusCode = error.code === 'version_conflict' || error.code === 'idempotency_replayed' || error.code === 'idempotency_key_reused' ? 409 : 503;
            res.removeHeader('Content-Length');
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            const body = error.code === 'version_conflict'
              ? { error: 'Your workspace changed while this was being saved. Retrying safely.', code: 'version_conflict' }
              : error.code === 'idempotency_replayed'
                ? { error: 'This save was already committed. Refresh to see the latest workspace.', code: 'idempotency_replayed' }
                : error.code === 'idempotency_key_reused'
                  ? { error: 'This save key was already used for a different request. Refresh and try again.', code: 'idempotency_key_reused' }
                  : { error: 'Your workspace could not be saved. Please retry.', code: 'workspace_commit_failed' };
            originalEnd(JSON.stringify(body));
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
app.get('/api/history', async (req, res) => {
  try {
    const items = await atlasRest(req, 'personal_os_workspace_history?select=id,version,schema_version,reason,created_at&order=created_at.desc&limit=50');
    res.json({ items: items || [], currentVersion: req.workspaceState?.version ?? 0 });
  } catch (error) {
    console.error('Workspace history list failed:', error.message);
    res.status(503).json({ error: 'Workspace history is temporarily unavailable.' });
  }
});

app.post('/api/history/snapshot', async (req, res) => {
  req.skipWorkspaceCommit = true;
  try {
    const context = tenantContext.getStore();
    if (!context?.db || !req.workspaceState) return res.status(503).json({ error: 'Workspace is not ready for a snapshot.' });
    const snapshot = serializeWorkspaceDatabase(context.db);
    const result = await commitWorkspaceSnapshot({
      supabaseUrl: supabaseConfig.url,
      publishableKey: supabaseConfig.publishableKey,
      token: req.workspaceToken,
      userId: req.workspaceUserId,
      expectedVersion: req.workspaceState.version,
      data: snapshot,
      schemaVersion: snapshot.schemaVersion,
      idempotencyKey: req.idempotencyKey || crypto.randomUUID(),
      requestHash: req.idempotencyHash || createWorkspaceRequestHash({ method: req.method, path: req.originalUrl, body: req.body }),
      forceHistory: true,
      historyReason: 'manual',
      events: []
    });
    res.status(201).json({ version: result.version, message: 'Snapshot created.' });
  } catch (error) {
    const conflict = error.code === 'version_conflict';
    res.status(conflict ? 409 : 503).json({ error: conflict ? 'Your workspace changed. Refresh history and try again.' : 'Could not create a history snapshot.', code: conflict ? 'version_conflict' : 'history_snapshot_failed' });
  }
});

app.post('/api/history/:id/restore', (req, res, next) => { req.skipWorkspaceCommit = true; next(); }, validateRequest(require('zod').z.object({ id: positiveIdSchema }), 'params'), async (req, res) => {
  req.skipWorkspaceCommit = true;
  try {
    const historyId = req.validated.params.id;
    if (!req.workspaceState) return res.status(503).json({ error: 'Workspace is not ready to restore.' });
    const rows = await atlasRest(req, `personal_os_workspace_history?select=id,version,schema_version,snapshot,reason,created_at&id=eq.${historyId}&limit=1`);
    const point = rows?.[0];
    if (!point) return res.status(404).json({ error: 'That history point was not found.' });
    const snapshot = point.snapshot;
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot) ||
        !['personal-os-sqlite-snapshot-v1','personal-os-sqlite-snapshot-v2','personal-os-sqlite-snapshot-v3'].includes(snapshot.format) ||
        !snapshot.tables || typeof snapshot.tables !== 'object') {
      return res.status(422).json({ error: 'This history point has an unsupported snapshot format.' });
    }
    const result = await commitWorkspaceSnapshot({
      supabaseUrl: supabaseConfig.url,
      publishableKey: supabaseConfig.publishableKey,
      token: req.workspaceToken,
      userId: req.workspaceUserId,
      expectedVersion: req.workspaceState.version,
      data: snapshot,
      schemaVersion: Number(point.schema_version) || Number(snapshot.schemaVersion) || 3,
      idempotencyKey: req.idempotencyKey || crypto.randomUUID(),
      requestHash: req.idempotencyHash || createWorkspaceRequestHash({ method: req.method, path: req.originalUrl, body: req.body }),
      forceHistory: true,
      historyReason: 'pre_restore',
      events: []
    });
    res.json({ version: result.version, restoredFrom: historyId, message: 'Workspace restored. Your previous workspace was saved to history first.' });
  } catch (error) {
    const conflict = error.code === 'version_conflict';
    console.error('Workspace history restore failed:', error.message);
    res.status(conflict ? 409 : 503).json({ error: conflict ? 'Your workspace changed. Refresh history and try again.' : 'Could not restore this history point.', code: conflict ? 'version_conflict' : 'history_restore_failed' });
  }
});


const schemaSql = `
CREATE TABLE IF NOT EXISTS projects (id INTEGER PRIMARY KEY AUTOINCREMENT, goal_id INTEGER REFERENCES goals(id) ON DELETE SET NULL, title TEXT NOT NULL, description TEXT DEFAULT '', status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','completed','archived')), target_date TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS project_milestones (id INTEGER PRIMARY KEY AUTOINCREMENT, project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE, title TEXT NOT NULL, target_date TEXT, completed INTEGER NOT NULL DEFAULT 0, sort_order INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, detail TEXT DEFAULT '', category TEXT DEFAULT 'Learning', due_date TEXT, project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL, goal_id INTEGER REFERENCES goals(id) ON DELETE SET NULL, done INTEGER DEFAULT 0, priority INTEGER NOT NULL DEFAULT 2 CHECK(priority BETWEEN 1 AND 4), parent_task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS modules (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, track TEXT DEFAULT 'Personal Learning', status TEXT DEFAULT 'Not started', minutes INTEGER DEFAULT 0, sort_order INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS learning_paths (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, subject TEXT DEFAULT '', description TEXT DEFAULT '', target_date TEXT, status TEXT NOT NULL DEFAULT 'active', goal_id INTEGER REFERENCES goals(id) ON DELETE SET NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS learning_lessons (id INTEGER PRIMARY KEY AUTOINCREMENT, path_id INTEGER NOT NULL, title TEXT NOT NULL, content TEXT DEFAULT '', notes TEXT DEFAULT '', status TEXT NOT NULL DEFAULT 'Not started', sort_order INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(path_id) REFERENCES learning_paths(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS learning_resources (id INTEGER PRIMARY KEY AUTOINCREMENT, lesson_id INTEGER NOT NULL, title TEXT NOT NULL, url TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(lesson_id) REFERENCES learning_lessons(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS learning_study_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, lesson_id INTEGER NOT NULL, log_date TEXT NOT NULL, minutes INTEGER NOT NULL, reflection TEXT DEFAULT '', created_at TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(lesson_id) REFERENCES learning_lessons(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, session_date TEXT NOT NULL, minutes INTEGER NOT NULL, focus TEXT NOT NULL, reflection TEXT DEFAULT '', task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL, project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL, lesson_id INTEGER REFERENCES learning_lessons(id) ON DELETE SET NULL, session_key TEXT UNIQUE, session_kind TEXT NOT NULL DEFAULT 'focus' CHECK(session_kind IN ('focus','break')), distractions_json TEXT NOT NULL DEFAULT '[]', created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS calendar_events (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, description TEXT DEFAULT '', start_at TEXT NOT NULL, end_at TEXT, all_day INTEGER NOT NULL DEFAULT 0, task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL, project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, body TEXT DEFAULT '', updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS reviews (id INTEGER PRIMARY KEY AUTOINCREMENT, period_type TEXT NOT NULL CHECK(period_type IN ('daily','weekly')), period_start TEXT NOT NULL, period_end TEXT NOT NULL, wins TEXT DEFAULT '', challenges TEXT DEFAULT '', lessons TEXT DEFAULT '', next_focus TEXT DEFAULT '', intention TEXT NOT NULL DEFAULT '', priority_task_ids TEXT NOT NULL DEFAULT '[]', alignment_complete INTEGER NOT NULL DEFAULT 0, shutdown_complete INTEGER NOT NULL DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP, UNIQUE(period_type,period_start));
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS goals (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, detail TEXT DEFAULT '', target_date TEXT, status TEXT DEFAULT 'active', category TEXT NOT NULL DEFAULT 'Personal', horizon TEXT NOT NULL DEFAULT 'long-term' CHECK(horizon IN ('short-term','long-term')), created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS reading_items (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, item_type TEXT NOT NULL CHECK(item_type IN ('book','article','reference')), url TEXT DEFAULT '', author TEXT DEFAULT '', notes TEXT DEFAULT '', status TEXT NOT NULL DEFAULT 'Queued' CHECK(status IN ('Queued','Active','Completed')), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS habits (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, emoji TEXT DEFAULT '✦', sort_order INTEGER DEFAULT 0, active INTEGER DEFAULT 1, goal_id INTEGER REFERENCES goals(id) ON DELETE SET NULL);
CREATE TABLE IF NOT EXISTS habit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, habit_id INTEGER NOT NULL, log_date TEXT NOT NULL, UNIQUE(habit_id,log_date), FOREIGN KEY(habit_id) REFERENCES habits(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS prayer_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, prayer_date TEXT NOT NULL, prayer TEXT NOT NULL, completed INTEGER NOT NULL DEFAULT 0, on_time INTEGER NOT NULL DEFAULT 0, UNIQUE(prayer_date,prayer));
CREATE TABLE IF NOT EXISTS quran_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, log_date TEXT NOT NULL, activity TEXT NOT NULL CHECK(activity IN ('memorisation','revision')), surah TEXT NOT NULL, ayah_start INTEGER, ayah_end INTEGER, pages REAL DEFAULT 0, juz INTEGER, reflection TEXT DEFAULT '', created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS tahajjud_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, log_date TEXT NOT NULL UNIQUE, woke_up INTEGER NOT NULL DEFAULT 0, prayed INTEGER NOT NULL DEFAULT 0, note TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS faith_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, log_date TEXT NOT NULL, activity TEXT NOT NULL CHECK(activity IN ('bible','prayer','reflection','worship','service')), completed INTEGER NOT NULL DEFAULT 1, UNIQUE(log_date,activity));
CREATE TABLE IF NOT EXISTS rhythm_records (id INTEGER PRIMARY KEY AUTOINCREMENT, record_date TEXT NOT NULL, tradition TEXT NOT NULL CHECK(tradition IN ('islam','christianity','general')), record_type TEXT NOT NULL CHECK(record_type IN ('sunnah','adhkar','jumuah','muhasabah','prayer_rhythm','intercessory','bible_reading','scripture_memory','sermon_note','pray_reflection','daily_intention','wisdom_note','evening_reflection')), title TEXT NOT NULL, detail TEXT DEFAULT '', status TEXT NOT NULL DEFAULT 'completed' CHECK(status IN ('planned','completed','active','answered')), metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS self_control_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, category TEXT NOT NULL CHECK(category IN ('porn','masturbation')), log_date TEXT NOT NULL, outcome TEXT NOT NULL CHECK(outcome IN ('clean','slip')), urge_level INTEGER DEFAULT 0, trigger TEXT DEFAULT '', response TEXT DEFAULT '', note TEXT DEFAULT '', created_at TEXT DEFAULT CURRENT_TIMESTAMP, UNIQUE(category,log_date));
CREATE TABLE IF NOT EXISTS self_control_trackers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, symbol TEXT NOT NULL DEFAULT '◇', start_date TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS self_control_entries (id INTEGER PRIMARY KEY AUTOINCREMENT, tracker_id INTEGER NOT NULL, log_date TEXT NOT NULL, outcome TEXT NOT NULL CHECK(outcome IN ('clean','slip')), urge_level INTEGER DEFAULT 0, trigger TEXT DEFAULT '', response TEXT DEFAULT '', note TEXT DEFAULT '', created_at TEXT DEFAULT CURRENT_TIMESTAMP, UNIQUE(tracker_id,log_date), FOREIGN KEY(tracker_id) REFERENCES self_control_trackers(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS email_events (event TEXT PRIMARY KEY, sent_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS login_events (id INTEGER PRIMARY KEY AUTOINCREMENT, login_date TEXT NOT NULL, logged_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS xp_events (id INTEGER PRIMARY KEY AUTOINCREMENT, event_key TEXT NOT NULL UNIQUE, category TEXT NOT NULL, points INTEGER NOT NULL CHECK(points > 0), awarded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS achievement_unlocks (achievement_id TEXT PRIMARY KEY, unlocked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS weekly_challenges (week_start TEXT PRIMARY KEY, challenge_id TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL, metric TEXT NOT NULL, target INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, completed_at TEXT, claimed_at TEXT);
CREATE TABLE IF NOT EXISTS feedback_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL, message TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
`;
const one=(s,...a)=>db.prepare(s).get(...a), all=(s,...a)=>db.prepare(s).all(...a);
function awardXp(eventKey,category,points){if(!eventKey||!Number.isInteger(points)||points<1)return;db.prepare('INSERT OR IGNORE INTO xp_events(event_key,category,points) VALUES(?,?,?)').run(eventKey,category,points);}
const dateKey=(d=new Date())=>{
 let timezone='Africa/Lagos';
 try {
  const saved=one('SELECT value FROM settings WHERE key=?','timezone')?.value;
  if(saved) { new Intl.DateTimeFormat('en-US',{timeZone:saved}); timezone=saved; }
 } catch {}
 return new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
};
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
  const loginSets=rows.map(row=>new Set((row.data?.tables?.login_events||[]).map(x=>x.login_date).filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x))));
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
function readIntelligenceFeedback(){
 try{const raw=one("SELECT value FROM settings WHERE key='atlas_intelligence_feedback'")?.value;const parsed=raw?JSON.parse(raw):[];return Array.isArray(parsed)?parsed.slice(-40):[];}catch{return [];}
}
app.get('/api/intelligence',(req,res)=>{
 const today=dateKey(),target=Number(one("SELECT value FROM settings WHERE key='daily_target'")?.value||80),feedback=readIntelligenceFeedback();
 const recent=feedback.filter(x=>x.date>=today.slice(0,7)+'-01');
 const stats={};for(const item of recent){stats[item.id]??={helpful:0,notUseful:0,opened:0};if(item.signal==='helpful')stats[item.id].helpful++;if(item.signal==='not_useful')stats[item.id].notUseful++;if(item.signal==='opened')stats[item.id].opened++;}
 const candidates=[];
 const add=(id,title,detail,reason,action,destination,priority,extra={})=>candidates.push({id,title,detail,reason,action,destination,priority,...extra});
 const overdue=one("SELECT id,title,due_date FROM tasks WHERE done=0 AND due_date<? ORDER BY due_date,id LIMIT 1",today);
 const dueToday=one("SELECT id,title,due_date FROM tasks WHERE done=0 AND due_date=? ORDER BY id LIMIT 1",today);
 const habit=one("SELECT h.id,h.title FROM habits h LEFT JOIN habit_logs l ON l.habit_id=h.id AND l.log_date=? WHERE h.active=1 AND l.id IS NULL ORDER BY h.sort_order,h.id LIMIT 1",today);
 const focus=one("SELECT COALESCE(SUM(minutes),0) n FROM sessions WHERE session_date=?",today).n;
 const lesson=one("SELECT l.id,l.title,p.title path_title FROM learning_lessons l JOIN learning_paths p ON p.id=l.path_id WHERE l.status!='Completed' AND p.status='active' ORDER BY CASE l.status WHEN 'In progress' THEN 0 ELSE 1 END,l.sort_order,l.id LIMIT 1");
 const goal=one("SELECT id,title,target_date FROM goals WHERE status='active' AND target_date IS NOT NULL AND target_date>=? AND target_date<=date(?,'+14 days') ORDER BY target_date,id LIMIT 1",today,today);
 if(overdue)add('overdue-task','Clear the oldest overdue priority.',overdue.title,'This commitment is already past its due date. A clear next step can reduce the load.','Open this task','tasks','high',{taskId:overdue.id});
 if(dueToday)add('today-task','Move today’s priority forward.',dueToday.title,'You have a task due today. Giving it attention now protects the rest of your day.','Open today’s priorities','tasks','high',{taskId:dueToday.id});
 if(habit)add('daily-ritual','Keep one promise you chose.',habit.title,'This ritual is still unchecked today. A small return is enough.','Complete this ritual','habit','medium',{habitId:habit.id});
 if(focus<target)add('focus-gap',focus?'Build on the focus you’ve started.':'Give one important thing your attention.',focus+' of '+target+' minutes of your daily focus intention completed.','A focused block would move you closer to the intention you set.',focus?'Continue a focus session':'Start a focus session','focus','medium');
 if(lesson)add('learning-next','Continue your learning path.',lesson.title+' · '+lesson.path_title,'You have an unfinished lesson ready. Continue from where you left off.','Open this lesson','learning','medium',{lessonId:lesson.id});
 if(goal)add('goal-near','Give an approaching goal a concrete next step.',goal.title+' · target '+goal.target_date,'This goal is approaching its target date. Decide what would move it forward next.','Review this goal','goals','medium',{goalId:goal.id});
 if(!candidates.length)add('choose-direction','Choose what deserves your attention next.','Your workspace has room for a clear next commitment.','There is no urgent unfinished action showing in your current records. Set a direction, or enjoy the breathing room.','Review your goals','goals','low');
 const priority={high:30,medium:20,low:0};
 candidates.sort((a,b)=>{
  const score=x=>priority[x.priority]+Math.min(4,stats[x.id]?.helpful||0)*3-Math.min(5,stats[x.id]?.notUseful||0)*12+Math.min(3,stats[x.id]?.opened||0);
  return score(b)-score(a);
 });
 const recommendation=candidates[0],recommendationStats=stats[recommendation.id]||{helpful:0,notUseful:0,opened:0};
 const recentFocus=one("SELECT COALESCE(SUM(minutes),0) n,COUNT(*) sessions FROM sessions WHERE session_date>=date(?,'-6 days') AND session_date<=?",today,today);
 const priorFocus=one("SELECT COALESCE(SUM(minutes),0) n FROM sessions WHERE session_date>=date(?,'-13 days') AND session_date<date(?,'-6 days')",today,today).n;
 const dayPattern=all("SELECT strftime('%w',session_date) weekday,COALESCE(SUM(minutes),0) minutes FROM sessions WHERE session_date>=date(?,'-27 days') AND session_date<=? GROUP BY weekday ORDER BY minutes DESC LIMIT 1",today,today)[0];
 let pattern;
 if(priorFocus>0){const delta=recentFocus.n-priorFocus,pct=Math.round(Math.abs(delta)/priorFocus*100);pattern=delta>0?'Your focus time is up '+pct+'% compared with the previous seven days.':delta<0?'Your focus time is down '+pct+'% compared with the previous seven days. No need to catch up all at once.':'Your focus time is holding steady across both weeks.';}
 else if(recentFocus.sessions)pattern='You logged '+recentFocus.sessions+' focus session'+(recentFocus.sessions===1?'':'s')+' in the last seven days.';
 else pattern='Your next focus session will give Atlas a clearer picture of your rhythm.';
 const weekdayNames=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
 const rhythm=dayPattern&&dayPattern.minutes>0?'Your strongest focus day over the last four weeks has been '+weekdayNames[Number(dayPattern.weekday)]+'.':null;
 res.json({recommendation,pattern,rhythm,feedback:recommendationStats,signals:{todayFocus:focus,dailyTarget:target,focusLast7Days:recentFocus.n,focusSessionsLast7Days:recentFocus.sessions,focusPrevious7Days:priorFocus}});
});
app.post('/api/intelligence/feedback',(req,res)=>{
 const {recommendationId,signal}=req.body||{};
 const allowed=['overdue-task','today-task','daily-ritual','focus-gap','learning-next','goal-near','choose-direction'];
 if(!allowed.includes(recommendationId)||!['helpful','not_useful','opened'].includes(signal))return res.status(400).json({error:'Invalid recommendation feedback.'});
 const history=readIntelligenceFeedback();history.push({id:recommendationId,signal,date:dateKey(),at:new Date().toISOString()});
 db.prepare("INSERT INTO settings(key,value) VALUES('atlas_intelligence_feedback',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(JSON.stringify(history.slice(-40)));
 res.json({ok:true});
});
function achievementMetrics(){
 return {
  tasks:one("SELECT COUNT(*) n FROM tasks WHERE done=1").n,
  focusMinutes:one("SELECT COALESCE(SUM(minutes),0) n FROM sessions").n,
  focusSessions:one("SELECT COUNT(*) n FROM sessions").n,
  lessons:one("SELECT COUNT(*) n FROM learning_lessons WHERE status='Completed'").n,
  goals:one("SELECT COUNT(*) n FROM goals WHERE status='completed'").n,
  habitCheckins:one("SELECT COUNT(*) n FROM habit_logs").n
 };
}
function achievementDefinitions(metrics){
 return [
  {id:'first-finish',name:'First things first',description:'Complete your first task',icon:'✓',metric:'tasks',target:1},
  {id:'task-ten',name:'Getting things done',description:'Complete 10 tasks',icon:'↗',metric:'tasks',target:10},
  {id:'task-fifty',name:'Reliable executor',description:'Complete 50 tasks',icon:'◆',metric:'tasks',target:50},
  {id:'focus-hour',name:'One focused hour',description:'Invest 60 minutes in focus',icon:'◷',metric:'focusMinutes',target:60},
  {id:'deep-work',name:'Return to deep work',description:'Complete 10 focus sessions',icon:'◎',metric:'focusSessions',target:10},
  {id:'first-lesson',name:'Curiosity in motion',description:'Complete your first lesson',icon:'◇',metric:'lessons',target:1},
  {id:'five-lessons',name:'A learner by practice',description:'Complete 5 lessons',icon:'✦',metric:'lessons',target:5},
  {id:'first-goal',name:'A promise kept',description:'Complete your first goal',icon:'⌖',metric:'goals',target:1},
  {id:'ritual-week',name:'Small promises',description:'Record 7 daily ritual check-ins',icon:'✳',metric:'habitCheckins',target:7},
  {id:'ritual-month',name:'Consistency, compounded',description:'Record 30 daily ritual check-ins',icon:'✧',metric:'habitCheckins',target:30}
 ].map(item=>{
  const value=Number(metrics[item.metric]||0);
  const unlock=one('SELECT unlocked_at FROM achievement_unlocks WHERE achievement_id=?',item.id);
  return {...item,value,unlocked:value>=item.target,progress:Math.min(100,Math.round(value/item.target*100)),remaining:Math.max(0,item.target-value),unlockedAt:unlock?.unlocked_at||null};
 });
}
function currentWeekStart(){
 const localDay=new Date(dateKey()+'T12:00:00Z');
 localDay.setUTCDate(localDay.getUTCDate()-((localDay.getUTCDay()+6)%7));
 return localDay.toISOString().slice(0,10);
}
function weekEndDate(weekStart){
 const end=new Date(weekStart+'T12:00:00Z');end.setUTCDate(end.getUTCDate()+7);return end.toISOString().slice(0,10);
}
async function weeklyChallengeState(challenge,weekStart,req){
 const metrics={focus_minutes:0,study_minutes:0,habit_checkins:0};
 let source='event-ledger';
 try{
  const rows=await atlasRest(req,'progress_daily?select=metric,value&local_date=gte.'+weekStart+'&local_date=lt.'+weekEndDate(weekStart)+'&metric=in.(focus_minutes,study_minutes,habit_checkins)&limit=1000');
  for(const row of rows||[])if(Object.prototype.hasOwnProperty.call(metrics,row.metric))metrics[row.metric]+=Number(row.value||0);
 }catch(error){
  source='legacy-workspace';
  console.warn('Weekly challenge projection unavailable; using legacy workspace totals:',error.message);
  metrics.focus_minutes=one("SELECT COALESCE(SUM(minutes),0) n FROM sessions WHERE session_date>=? AND session_date<date(?,'+7 days')",weekStart,weekStart).n;
  metrics.study_minutes=one("SELECT COALESCE(SUM(minutes),0) n FROM learning_study_logs WHERE log_date>=? AND log_date<date(?,'+7 days')",weekStart,weekStart).n;
  metrics.habit_checkins=one("SELECT COUNT(*) n FROM habit_logs WHERE log_date>=? AND log_date<date(?,'+7 days')",weekStart,weekStart).n;
 }
 const value=Number(metrics[challenge.metric]||0),complete=value>=challenge.target;
 return {...challenge,weekStart,value,progress:Math.min(100,Math.round(value/challenge.target*100)),remaining:Math.max(0,challenge.target-value),complete,earned:!!challenge.claimed_at,completedAt:challenge.completed_at,source};
}
function createWeeklyChallenge(weekStart){
 const activeHabits=one('SELECT COUNT(*) n FROM habits WHERE active=1').n;
 const activeLessons=one("SELECT COUNT(*) n FROM learning_lessons WHERE status!='Completed'").n;
 const focusRecent=one("SELECT COALESCE(SUM(minutes),0) n FROM sessions WHERE session_date>=date(?,'-14 days') AND session_date<?",weekStart,weekStart).n;
 const studyRecent=one("SELECT COALESCE(SUM(minutes),0) n FROM learning_study_logs WHERE log_date>=date(?,'-14 days') AND log_date<?",weekStart,weekStart).n;
 const habitRecent=one("SELECT COUNT(*) n FROM habit_logs WHERE log_date>=date(?,'-14 days') AND log_date<?",weekStart,weekStart).n;
 const options=[];
 if(activeHabits>0)options.push({id:'ritual-rhythm',title:'Keep your rituals alive',description:'Record a few check-ins for the habits you chose.',metric:'habit_checkins',target:Math.max(3,Math.min(10,activeHabits*3)),score:habitRecent+activeHabits*2});
 if(activeLessons>0)options.push({id:'learning-investment',title:'Invest in your next chapter',description:'Put focused study time into a lesson you are working through.',metric:'study_minutes',target:Math.max(45,Math.min(150,Math.round((studyRecent/2||60)/15)*15)),score:studyRecent+activeLessons*5});
 options.push({id:'focus-foundation',title:'Make room for deep work',description:'Protect a little time for focused work this week.',metric:'focus_minutes',target:Math.max(60,Math.min(180,Math.round((focusRecent/2||75)*1.15/15)*15)),score:focusRecent+20});
 options.sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
 const chosen=options[0];
 db.prepare('INSERT OR IGNORE INTO weekly_challenges(week_start,challenge_id,title,description,metric,target) VALUES(?,?,?,?,?,?)').run(weekStart,chosen.id,chosen.title,chosen.description,chosen.metric,chosen.target);
 return one('SELECT * FROM weekly_challenges WHERE week_start=?',weekStart);
}
app.post('/api/weekly-challenge/sync',async(req,res)=>{
 const weekStart=currentWeekStart();
 let challenge=one('SELECT * FROM weekly_challenges WHERE week_start=?',weekStart);
 if(!challenge)challenge=createWeeklyChallenge(weekStart);
 let state=await weeklyChallengeState(challenge,weekStart,req);
 if(state.complete&&!challenge.claimed_at){
  const completedAt=new Date().toISOString();
  db.prepare('UPDATE weekly_challenges SET completed_at=COALESCE(completed_at,?),claimed_at=? WHERE week_start=?').run(completedAt,completedAt,weekStart);
  publishAtlasEvent(req,{requestKey:'weekly-challenge:'+weekStart,type:'challenge.completed',module:'residence',entityId:weekStart,localDate:dateKey(),payload:{weekStart,challengeId:challenge.challenge_id}});
  challenge=one('SELECT * FROM weekly_challenges WHERE week_start=?',weekStart);
  state=await weeklyChallengeState(challenge,weekStart,req);
  state.justCompleted=true;
 }
 res.json(state);
});
app.get('/api/weekly-challenge',async(req,res)=>{
 const weekStart=currentWeekStart(),challenge=one('SELECT * FROM weekly_challenges WHERE week_start=?',weekStart);
 if(!challenge)return res.status(404).json({error:'This week’s challenge has not been created yet.'});
 res.json(await weeklyChallengeState(challenge,weekStart,req));
});
async function readAtlasAchievementState(req) {
 const [definitions,unlocks,projection]=await Promise.all([
  atlasRest(req,'atlas_achievement_definitions?select=id,title,description,icon,metric,target,tier,secret&order=id.asc'),
  atlasRest(req,'atlas_achievement_unlocks?select=achievement_id,unlocked_at&order=unlocked_at.desc&limit=200'),
  atlasRest(req,'progress_daily?select=metric,value&limit=1000')
 ]);
 const totals={};
 for(const row of projection||[])totals[row.metric]=(totals[row.metric]||0)+Number(row.value||0);
 const aliases={tasks_completed:'tasks',focus_minutes:'focusMinutes',focus_sessions:'focusSessions',learning_items_completed:'lessons',goals_completed:'goals',milestones_reached:'milestonesReached',habit_checkins:'habitCheckins'};
 const metrics={tasks:totals.tasks_completed||0,focusMinutes:totals.focus_minutes||0,focusSessions:totals.focus_sessions||0,lessons:totals.learning_items_completed||0,goals:totals.goals_completed||0,milestonesReached:totals.milestones_reached||0,habitCheckins:totals.habit_checkins||0};
 const unlockedById=new Map((unlocks||[]).map(row=>[row.achievement_id,row.unlocked_at]));
 const achievements=(definitions||[]).map(item=>{
  const value=Number(totals[item.metric]||0),unlockedAt=unlockedById.get(item.id)||null;
  return {id:item.id,name:item.title,title:item.title,description:item.description,icon:item.icon,metric,target:Number(item.target),value,unlocked:Boolean(unlockedAt),progress:Math.min(100,Math.round(value/Math.max(1,Number(item.target))*100)),remaining:Math.max(0,Number(item.target)-value),unlockedAt,tier:item.tier,secret:item.secret};
 });
 return {metrics,achievements,unlocked:achievements.filter(item=>item.unlocked).length,total:achievements.length,recent:achievements.filter(item=>item.unlockedAt).sort((a,b)=>b.unlockedAt.localeCompare(a.unlockedAt)).slice(0,5)};
}
app.get('/api/achievements',async(req,res)=>{
 try { res.json(await readAtlasAchievementState(req)); }
 catch(error) { console.warn('Atlas achievements unavailable; using legacy workspace values:',error.message); const metrics=achievementMetrics(),achievements=achievementDefinitions(metrics); res.json({metrics,achievements,unlocked:achievements.filter(x=>x.unlocked).length,total:achievements.length,recent:achievements.filter(x=>x.unlockedAt).sort((a,b)=>b.unlockedAt.localeCompare(a.unlockedAt)).slice(0,5)}); }
});
app.post('/api/achievements/sync',async(req,res)=>{
 try {
  const state=await readAtlasAchievementState(req);
  const known=new Set(all('SELECT achievement_id FROM achievement_unlocks').map(item=>item.achievement_id));
  const newUnlocks=state.achievements.filter(item=>item.unlocked&&!known.has(item.id));
  const insert=db.prepare('INSERT OR IGNORE INTO achievement_unlocks(achievement_id) VALUES(?)');
  const sync=db.transaction(()=>newUnlocks.forEach(item=>insert.run(item.id)));
  sync();
  res.json({...state,newUnlocks});
 } catch(error) {
  const metrics=achievementMetrics(),eligible=achievementDefinitions(metrics).filter(x=>x.unlocked&&!x.unlockedAt);
  const insert=db.prepare('INSERT OR IGNORE INTO achievement_unlocks(achievement_id) VALUES(?)');
  db.transaction(()=>eligible.forEach(x=>insert.run(x.id)))();
  const achievements=achievementDefinitions(metrics);
  res.json({newUnlocks:achievements.filter(x=>eligible.some(e=>e.id===x.id)),achievements,unlocked:achievements.filter(x=>x.unlocked).length,total:achievements.length,recent:achievements.filter(x=>x.unlockedAt).sort((a,b)=>b.unlockedAt.localeCompare(a.unlockedAt)).slice(0,5)});
 }
});
app.get('/api/progress',async(req,res)=>{
 const thresholds=[0,50,150,300,500,800,1200,1700,2300,3000,4000,5200,6600,8200,10000];
 const titles=['Newcomer','Starter','Builder','Pathfinder','Maker','Strategist','Specialist','Architect','Vanguard','Atlas'];
 let totalXp=one('SELECT COALESCE(SUM(points),0) total FROM xp_events').total;
 let lastEvent=one('SELECT category,points,awarded_at FROM xp_events ORDER BY awarded_at DESC,id DESC LIMIT 1')||null;
 let dailyProjection=[];
 let xpByCategory={};
 let ledgerSource='legacy';
 try {
  const [ledger,projection]=await Promise.all([
   atlasRest(req,'xp_ledger?select=points,category,awarded_at,local_date&order=awarded_at.desc&limit=1000'),
   atlasRest(req,'progress_daily?select=module,metric,value,local_date&local_date=eq.'+encodeURIComponent(dateKey())+'&order=module,metric')
  ]);
  if(Array.isArray(ledger)){
   totalXp=ledger.reduce((sum,row)=>sum+Number(row.points||0),0);
   lastEvent=ledger[0]?{category:ledger[0].category,points:ledger[0].points,awarded_at:ledger[0].awarded_at}:null;
   for(const row of ledger)xpByCategory[row.category]=(xpByCategory[row.category]||0)+Number(row.points||0);
   ledgerSource='event-ledger';
  }
  if(Array.isArray(projection))dailyProjection=projection;
 }catch(error){console.warn('Atlas progress projection unavailable; using the legacy workspace projection:',error.message);}
 while(totalXp>=thresholds[thresholds.length-1])thresholds.push(thresholds[thresholds.length-1]+Math.round(1000+thresholds.length*125));
 let index=0;while(index+1<thresholds.length&&totalXp>=thresholds[index+1])index++;
 const level=index+1,currentFloor=thresholds[index],nextFloor=thresholds[index+1];
 res.json({totalXp,level,title:titles[index]||'Master Builder',currentFloor,nextFloor,progressPct:Math.max(0,Math.min(100,Math.round((totalXp-currentFloor)/(nextFloor-currentFloor)*100))),remaining:Math.max(0,nextFloor-totalXp),lastEvent,atlas:{source:ledgerSource,daily:dailyProjection,xpByCategory}});
});
app.get('/api/projects',(q,s)=>{const rows=all("SELECT p.*,g.title AS goal_title,(SELECT COUNT(*) FROM tasks t WHERE t.project_id=p.id AND t.done=0) AS open_tasks,(SELECT COUNT(*) FROM project_milestones m WHERE m.project_id=p.id) AS milestone_count,(SELECT COALESCE(SUM(ss.minutes),0) FROM sessions ss WHERE ss.project_id=p.id OR ss.task_id IN (SELECT t.id FROM tasks t WHERE t.project_id=p.id)) AS focus_minutes,(SELECT COUNT(*) FROM tasks t WHERE t.project_id=p.id) AS task_count,(SELECT COUNT(*) FROM tasks t WHERE t.project_id=p.id AND t.done=1) AS completed_tasks FROM projects p LEFT JOIN goals g ON g.id=p.goal_id WHERE p.status!='archived' ORDER BY p.status='completed',COALESCE(p.target_date,'9999-12-31'),p.id DESC");s.json(rows.map(p=>({...p,progress_pct:p.task_count?Math.round(p.completed_tasks/p.task_count*100):0,milestones:all('SELECT * FROM project_milestones WHERE project_id=? ORDER BY sort_order,id',p.id)})));});
app.post('/api/projects',(q,s)=>{const title=String(q.body.title||'').trim();const goalId=q.body.goal_id?Number(q.body.goal_id):null;if(!title)return s.status(400).json({error:'A project needs a title.'});if(goalId&&!one('SELECT id FROM goals WHERE id=?',goalId))return s.status(400).json({error:'Choose an existing goal.'});const r=db.prepare('INSERT INTO projects(title,description,goal_id,target_date) VALUES(?,?,?,?)').run(title,String(q.body.description||''),goalId,q.body.target_date||null);s.status(201).json(one('SELECT * FROM projects WHERE id=?',r.lastInsertRowid));});
app.patch('/api/projects/:id',(q,s)=>{const p=one('SELECT * FROM projects WHERE id=?',q.params.id);if(!p)return s.status(404).json({error:'Project not found.'});const title=String(q.body.title??p.title).trim(),status=q.body.status??p.status,goalId=q.body.goal_id===undefined?p.goal_id:(q.body.goal_id?Number(q.body.goal_id):null);if(!title||!['active','completed','archived'].includes(status))return s.status(400).json({error:'Check the project details and status.'});if(goalId&&!one('SELECT id FROM goals WHERE id=?',goalId))return s.status(400).json({error:'Choose an existing goal.'});db.prepare('UPDATE projects SET title=?,description=?,status=?,target_date=?,goal_id=? WHERE id=?').run(title,q.body.description??p.description,status,q.body.target_date===undefined?p.target_date:(q.body.target_date||null),goalId,p.id);s.json(one('SELECT * FROM projects WHERE id=?',p.id));});
app.delete('/api/projects/:id',(q,s)=>{const r=db.prepare('DELETE FROM projects WHERE id=?').run(q.params.id);if(!r.changes)return s.status(404).json({error:'Project not found.'});s.json({ok:true});});
app.post('/api/projects/:id/milestones',(q,s)=>{const project=one('SELECT id FROM projects WHERE id=?',q.params.id);if(!project)return s.status(404).json({error:'Project not found.'});const title=String(q.body.title||'').trim();if(!title)return s.status(400).json({error:'A milestone needs a title.'});const r=db.prepare('INSERT INTO project_milestones(project_id,title,target_date,sort_order) VALUES(?,?,?,COALESCE((SELECT MAX(sort_order)+1 FROM project_milestones WHERE project_id=?),1))').run(project.id,title,q.body.target_date||null,project.id);s.status(201).json(one('SELECT * FROM project_milestones WHERE id=?',r.lastInsertRowid));});
app.patch('/api/project-milestones/:id',(q,s)=>{const m=one('SELECT * FROM project_milestones WHERE id=?',q.params.id);if(!m)return s.status(404).json({error:'Milestone not found.'});const title=String(q.body.title??m.title).trim();if(!title)return s.status(400).json({error:'A milestone needs a title.'});const completed=q.body.completed===undefined?m.completed:(q.body.completed?1:0);db.prepare('UPDATE project_milestones SET title=?,target_date=?,completed=? WHERE id=?').run(title,q.body.target_date===undefined?m.target_date:(q.body.target_date||null),completed,m.id);const milestoneGoalId=one('SELECT goal_id FROM projects WHERE id=?',m.project_id)?.goal_id||null;if(!m.completed&&completed)publishAtlasEvent(q,{type:'goal.milestone_reached',module:'goals',entityId:String(m.id),localDate:dateKey(),payload:{projectId:m.project_id,goalId:milestoneGoalId?String(milestoneGoalId):null}});else if(m.completed&&!completed)publishAtlasEvent(q,{type:'goal.milestone_unreached',module:'goals',entityId:String(m.id),localDate:dateKey(),payload:{projectId:m.project_id,goalId:milestoneGoalId?String(milestoneGoalId):null}});s.json(one('SELECT * FROM project_milestones WHERE id=?',m.id));});
app.delete('/api/project-milestones/:id',(q,s)=>{const milestone=one('SELECT * FROM project_milestones WHERE id=?',q.params.id);if(!milestone)return s.status(404).json({error:'Milestone not found.'});if(milestone.completed){const goalId=one('SELECT goal_id FROM projects WHERE id=?',milestone.project_id)?.goal_id||null;publishAtlasEvent(q,{type:'goal.milestone_unreached',module:'goals',entityId:String(milestone.id),localDate:dateKey(),payload:{projectId:milestone.project_id,goalId:goalId?String(goalId):null}});}db.prepare('DELETE FROM project_milestones WHERE id=?').run(milestone.id);s.json({ok:true});});

app.get('/api/tasks',(q,s)=>s.json(all("SELECT t.*,p.title AS project_title,g.title AS goal_title,(SELECT COALESCE(SUM(ss.minutes),0) FROM sessions ss WHERE ss.task_id=t.id) AS focus_minutes,(SELECT COUNT(*) FROM tasks child WHERE child.parent_task_id=t.id) AS subtask_count FROM tasks t LEFT JOIN projects p ON p.id=t.project_id LEFT JOIN goals g ON g.id=t.goal_id ORDER BY t.parent_task_id IS NOT NULL,t.done ASC,t.priority ASC,COALESCE(t.due_date,'9999-12-31') ASC,t.id DESC")));
app.post('/api/tasks',(q,s)=>{const {title,detail='',category='Learning',due_date=null,project_id=null,goal_id=null,priority=2,parent_task_id=null}=q.body;if(!title?.trim()||title.trim().length>180)return s.status(400).json({error:'A task title is required (up to 180 characters).'});if(project_id&&!one('SELECT id FROM projects WHERE id=?',project_id))return s.status(400).json({error:'Choose an existing project.'});if(goal_id&&!one('SELECT id FROM goals WHERE id=?',goal_id))return s.status(400).json({error:'Choose an existing goal.'});if(!Number.isInteger(Number(priority))||Number(priority)<1||Number(priority)>4)return s.status(400).json({error:'Choose a valid task priority.'});if(parent_task_id){const parent=one('SELECT id,parent_task_id FROM tasks WHERE id=?',parent_task_id);if(!parent||parent.parent_task_id)return s.status(400).json({error:'Subtasks must belong to an existing top-level task.'});}const r=db.prepare('INSERT INTO tasks(title,detail,category,due_date,project_id,goal_id,priority,parent_task_id) VALUES(?,?,?,?,?,?,?,?)').run(title.trim(),String(detail).slice(0,4000),category,due_date||null,project_id||null,goal_id||null,Number(priority),parent_task_id||null);s.status(201).json(one('SELECT * FROM tasks WHERE id=?',r.lastInsertRowid));});
app.patch('/api/tasks/:id',(q,s)=>{const t=one('SELECT * FROM tasks WHERE id=?',q.params.id);if(!t)return s.status(404).json({error:'Task not found'});const done=q.body.done===undefined?t.done:(q.body.done?1:0);const projectId=q.body.project_id===undefined?t.project_id:(q.body.project_id||null);const goalId=q.body.goal_id===undefined?t.goal_id:(q.body.goal_id||null);const priority=q.body.priority===undefined?t.priority:Number(q.body.priority);if(projectId&&!one('SELECT id FROM projects WHERE id=?',projectId))return s.status(400).json({error:'Choose an existing project.'});if(goalId&&!one('SELECT id FROM goals WHERE id=?',goalId))return s.status(400).json({error:'Choose an existing goal.'});if(!Number.isInteger(priority)||priority<1||priority>4)return s.status(400).json({error:'Choose a valid task priority.'});db.prepare('UPDATE tasks SET done=?,title=?,detail=?,category=?,due_date=?,project_id=?,goal_id=?,priority=? WHERE id=?').run(done,q.body.title??t.title,q.body.detail??t.detail,q.body.category??t.category,q.body.due_date===undefined?t.due_date:(q.body.due_date||null),projectId,goalId,priority,q.params.id);const linkedProjectGoal=projectId?one('SELECT goal_id FROM projects WHERE id=?',projectId)?.goal_id:null;const linkedGoalId=goalId||linkedProjectGoal||null;if(!t.done&&done){publishAtlasEvent(q,{type:'task.completed',module:'actions',entityId:String(t.id),localDate:dateKey(),payload:{goalLinked:Boolean(linkedGoalId),goalId:linkedGoalId?String(linkedGoalId):null}});}else if(t.done&&!done){publishAtlasEvent(q,{type:'task.reopened',module:'actions',entityId:String(t.id),localDate:dateKey(),payload:{goalId:linkedGoalId?String(linkedGoalId):null}});}s.json(one('SELECT * FROM tasks WHERE id=?',q.params.id));});
app.delete('/api/tasks/:id',(q,s)=>{const task=one('SELECT id,done FROM tasks WHERE id=?',q.params.id);if(!task)return s.status(404).json({error:'Task not found.'});if(task.done)publishAtlasEvent(q,{type:'task.reopened',module:'actions',entityId:String(task.id),localDate:dateKey(),payload:{}});db.prepare('DELETE FROM tasks WHERE id=?').run(task.id);s.json({ok:true});});
app.get('/api/modules',(q,s)=>s.json(all('SELECT * FROM modules ORDER BY sort_order')));
app.patch('/api/modules/:id',(q,s)=>{const {status}=q.body;if(!['Not started','In progress','Completed'].includes(status))return s.status(400).json({error:'Invalid status'});db.prepare('UPDATE modules SET status=? WHERE id=?').run(status,q.params.id);s.json(one('SELECT * FROM modules WHERE id=?',q.params.id));});

// Learning Studio: user-created paths, lessons, notes, resources and study records.
app.get('/api/learning/paths',(q,s)=>{
 const paths=all("SELECT * FROM learning_paths WHERE status!='archived' ORDER BY created_at DESC,id DESC");
 s.json(paths.map(p=>{const lessons=all('SELECT * FROM learning_lessons WHERE path_id=? ORDER BY sort_order,id',p.id);return {...p,lessons:lessons.map(l=>{const manualLogs=all("SELECT id,log_date,minutes,reflection,'study' AS source FROM learning_study_logs WHERE lesson_id=? ORDER BY log_date DESC,id DESC LIMIT 10",l.id);const focusLogs=all("SELECT id,session_date AS log_date,minutes,reflection,'focus' AS source FROM sessions WHERE lesson_id=? ORDER BY session_date DESC,id DESC LIMIT 10",l.id);const studyLogs=[...manualLogs,...focusLogs].sort((a,b)=>b.log_date.localeCompare(a.log_date)||b.id-a.id).slice(0,10);const studyMinutes=one("SELECT COALESCE(SUM(minutes),0) n FROM sessions WHERE lesson_id=? AND session_kind='focus'",l.id).n;return {...l,resources:all('SELECT * FROM learning_resources WHERE lesson_id=? ORDER BY id DESC',l.id),study_logs:studyLogs,study_minutes:studyMinutes};})}}));
});
app.post('/api/learning/paths',(q,s)=>{const {title,subject='',description='',target_date=null,goal_id=null}=q.body;if(!title?.trim())return s.status(400).json({error:'Give your learning path a title.'});if(goal_id&&!one('SELECT id FROM goals WHERE id=?',goal_id))return s.status(400).json({error:'Choose an existing goal.'});const r=db.prepare('INSERT INTO learning_paths(title,subject,description,target_date,goal_id) VALUES(?,?,?,?,?)').run(title.trim(),subject.trim(),description.trim(),target_date||null,goal_id||null);s.json(one('SELECT * FROM learning_paths WHERE id=?',r.lastInsertRowid));});
app.patch('/api/learning/paths/:id',(q,s)=>{const p=one('SELECT * FROM learning_paths WHERE id=?',q.params.id);if(!p)return s.status(404).json({error:'Learning path not found.'});const d=q.body,goalId=d.goal_id===undefined?p.goal_id:(d.goal_id?Number(d.goal_id):null);if(goalId&&!one('SELECT id FROM goals WHERE id=?',goalId))return s.status(400).json({error:'Choose an existing goal.'});db.prepare('UPDATE learning_paths SET title=?,subject=?,description=?,target_date=?,goal_id=? WHERE id=?').run(d.title??p.title,d.subject??p.subject,d.description??p.description,d.target_date===undefined?p.target_date:(d.target_date||null),goalId,p.id);s.json(one('SELECT * FROM learning_paths WHERE id=?',p.id));});
app.delete('/api/learning/paths/:id',(q,s)=>{db.prepare('DELETE FROM learning_paths WHERE id=?').run(q.params.id);s.json({ok:true});});
app.post('/api/learning/paths/:id/lessons',(q,s)=>{const p=one('SELECT id FROM learning_paths WHERE id=?',q.params.id);if(!p)return s.status(404).json({error:'Learning path not found.'});if(!q.body.title?.trim())return s.status(400).json({error:'Give the lesson a title.'});const order=one('SELECT COALESCE(MAX(sort_order),0)+1 n FROM learning_lessons WHERE path_id=?',p.id).n;const r=db.prepare('INSERT INTO learning_lessons(path_id,title,content,sort_order) VALUES(?,?,?,?)').run(p.id,q.body.title.trim(),q.body.content||'',order);s.json(one('SELECT * FROM learning_lessons WHERE id=?',r.lastInsertRowid));});
app.patch('/api/learning/lessons/:id',(q,s)=>{const l=one('SELECT * FROM learning_lessons WHERE id=?',q.params.id);if(!l)return s.status(404).json({error:'Lesson not found.'});const d=q.body;if(d.status!==undefined&&!['Not started','In Progress','In progress','Completed'].includes(d.status))return s.status(400).json({error:'Invalid lesson status.'});const nextStatus=d.status??l.status;db.prepare('UPDATE learning_lessons SET title=?,content=?,notes=?,status=? WHERE id=?').run(d.title??l.title,d.content??l.content,d.notes??l.notes,nextStatus,l.id);if(l.status!=='Completed'&&nextStatus==='Completed'){publishAtlasEvent(q,{type:'learning.item_completed',module:'learning',entityId:String(l.id),localDate:dateKey(),payload:{}});}else if(l.status==='Completed'&&nextStatus!=='Completed'){publishAtlasEvent(q,{type:'learning.item_reopened',module:'learning',entityId:String(l.id),localDate:dateKey(),payload:{}});}s.json(one('SELECT * FROM learning_lessons WHERE id=?',l.id));});
app.delete('/api/learning/lessons/:id',(q,s)=>{const lesson=one('SELECT id,status FROM learning_lessons WHERE id=?',q.params.id);if(!lesson)return s.status(404).json({error:'Lesson not found.'});if(lesson.status==='Completed')publishAtlasEvent(q,{type:'learning.item_reopened',module:'learning',entityId:String(lesson.id),localDate:dateKey(),payload:{}});db.prepare('DELETE FROM learning_lessons WHERE id=?').run(lesson.id);s.json({ok:true});});
app.post('/api/learning/lessons/:id/resources',(q,s)=>{const l=one('SELECT id FROM learning_lessons WHERE id=?',q.params.id);if(!l)return s.status(404).json({error:'Lesson not found.'});const {title,url}=q.body;if(!title?.trim()||!url?.trim())return s.status(400).json({error:'Add a resource name and URL.'});let parsed;try{parsed=new URL(url)}catch{return s.status(400).json({error:'Enter a valid URL.'})}if(!['http:','https:'].includes(parsed.protocol))return s.status(400).json({error:'Only web links are supported.'});const r=db.prepare('INSERT INTO learning_resources(lesson_id,title,url) VALUES(?,?,?)').run(l.id,title.trim(),parsed.href);s.json(one('SELECT * FROM learning_resources WHERE id=?',r.lastInsertRowid));});
app.delete('/api/learning/resources/:id',(q,s)=>{db.prepare('DELETE FROM learning_resources WHERE id=?').run(q.params.id);s.json({ok:true});});
app.post('/api/learning/lessons/:id/study',(q,s)=>{const l=one('SELECT id FROM learning_lessons WHERE id=?',q.params.id);if(!l)return s.status(404).json({error:'Lesson not found.'});const minutes=Number(q.body.minutes);if(!Number.isInteger(minutes)||minutes<1||minutes>600)return s.status(400).json({error:'Study time must be between 1 and 600 minutes.'});const logDate=q.body.log_date||dateKey();const r=db.prepare('INSERT INTO learning_study_logs(lesson_id,log_date,minutes,reflection) VALUES(?,?,?,?)').run(l.id,logDate,minutes,q.body.reflection||'');publishAtlasEvent(q,{type:'learning.study_logged',module:'learning',entityId:String(r.lastInsertRowid),localDate:logDate,payload:{minutes}});s.json(one('SELECT * FROM learning_study_logs WHERE id=?',r.lastInsertRowid));});
app.get('/api/learning/study-logs',(q,s)=>{const manual=all("SELECT sl.id,sl.log_date,sl.minutes,sl.reflection,'study' AS source,ll.title lesson_title,lp.title path_title FROM learning_study_logs sl JOIN learning_lessons ll ON ll.id=sl.lesson_id JOIN learning_paths lp ON lp.id=ll.path_id ORDER BY sl.log_date DESC,sl.id DESC LIMIT 50");const focus=all("SELECT ss.id,ss.session_date AS log_date,ss.minutes,ss.reflection,'focus' AS source,ll.title lesson_title,lp.title path_title FROM sessions ss JOIN learning_lessons ll ON ll.id=ss.lesson_id JOIN learning_paths lp ON lp.id=ll.path_id ORDER BY ss.session_date DESC,ss.id DESC LIMIT 50");s.json([...manual,...focus].sort((a,b)=>b.log_date.localeCompare(a.log_date)||b.id-a.id).slice(0,50));});

app.get('/api/sessions',(q,s)=>s.json(all("SELECT ss.*,t.title AS task_title,p.title AS project_title,ll.title AS lesson_title,lp.title AS path_title FROM sessions ss LEFT JOIN tasks t ON t.id=ss.task_id LEFT JOIN projects p ON p.id=ss.project_id LEFT JOIN learning_lessons ll ON ll.id=ss.lesson_id LEFT JOIN learning_paths lp ON lp.id=ll.path_id ORDER BY ss.session_date DESC,ss.id DESC LIMIT 100").map(row=>({...row,distractions:(()=>{try{return JSON.parse(row.distractions_json||'[]')}catch{return []}})()}))));
app.post('/api/sessions',(q,s)=>{const {session_date,minutes,focus,reflection='',task_id=null,project_id=null,lesson_id=null,session_key=null,session_kind='focus',distractions=[]}=q.body;const duration=Number(minutes);if(!Number.isInteger(duration)||duration<1||duration>600||!String(focus||'').trim())return s.status(400).json({error:'Add a focus and a valid duration (1–600 minutes).'});if(!['focus','break'].includes(session_kind))return s.status(400).json({error:'Choose a valid session type.'});if(session_key!==null&&(typeof session_key!=='string'||session_key.length<8||session_key.length>100))return s.status(400).json({error:'The focus session key is invalid.'});if(task_id&&!one('SELECT id FROM tasks WHERE id=?',task_id))return s.status(400).json({error:'Choose an existing task.'});if(project_id&&!one('SELECT id FROM projects WHERE id=?',project_id))return s.status(400).json({error:'Choose an existing project.'});if(lesson_id&&!one('SELECT id FROM learning_lessons WHERE id=?',lesson_id))return s.status(400).json({error:'Choose an existing learning lesson.'});if(!Array.isArray(distractions)||distractions.length>50||distractions.some(item=>typeof item!=='string'||item.length>240))return s.status(400).json({error:'Check the distraction log.'});if(session_key){const existing=one('SELECT * FROM sessions WHERE session_key=?',session_key);if(existing)return s.json(existing);}const logDate=session_date||dateKey(),projectFromTask=task_id?one('SELECT project_id FROM tasks WHERE id=?',task_id)?.project_id:null,linkedProject=project_id||projectFromTask||null;const insert=db.prepare('INSERT OR IGNORE INTO sessions(session_date,minutes,focus,reflection,task_id,project_id,lesson_id,session_key,session_kind,distractions_json) VALUES(?,?,?,?,?,?,?,?,?,?)').run(logDate,duration,String(focus).trim().slice(0,120),String(reflection||'').slice(0,4000),task_id||null,linkedProject,lesson_id||null,session_key||null,session_kind,JSON.stringify(distractions));const session= session_key?one('SELECT * FROM sessions WHERE session_key=?',session_key):one('SELECT * FROM sessions WHERE id=?',insert.lastInsertRowid);if(!session)return s.status(500).json({error:'The focus session could not be recorded.'});if(insert.changes&&session_kind==='focus'){publishAtlasEvent(q,{type:'focus.ended',module:'actions',entityId:String(session.id),localDate:logDate,payload:{minutes:duration,taskId:task_id||null,projectId:linkedProject,lessonId:lesson_id||null}});}s.status(insert.changes?201:200).json(session);});
app.get('/api/reading-items',(q,s)=>s.json(all('SELECT * FROM reading_items ORDER BY CASE status WHEN \'Active\' THEN 0 WHEN \'Queued\' THEN 1 ELSE 2 END,updated_at DESC,id DESC')));
app.post('/api/reading-items',(q,s)=>{const d=q.body||{},title=String(d.title||'').trim(),type=String(d.item_type||'book');if(!title||title.length>180||!['book','article','reference'].includes(type))return s.status(400).json({error:'Add a title and choose a valid resource type.'});let url='';if(d.url){try{const parsed=new URL(String(d.url));if(!['http:','https:'].includes(parsed.protocol))throw new Error();url=parsed.href}catch{return s.status(400).json({error:'Use a valid http or https link.'})}}const result=db.prepare('INSERT INTO reading_items(title,item_type,url,author,notes,status) VALUES(?,?,?,?,?,?)').run(title,type,url,String(d.author||'').slice(0,160),String(d.notes||'').slice(0,3000),'Queued');s.status(201).json(one('SELECT * FROM reading_items WHERE id=?',result.lastInsertRowid));});
app.patch('/api/reading-items/:id',(q,s)=>{const item=one('SELECT * FROM reading_items WHERE id=?',q.params.id);if(!item)return s.status(404).json({error:'Library item not found.'});const d=q.body||{},status=d.status===undefined?item.status:String(d.status);if(!['Queued','Active','Completed'].includes(status))return s.status(400).json({error:'Choose Queued, Active or Completed.'});const title=d.title===undefined?item.title:String(d.title).trim();if(!title||title.length>180)return s.status(400).json({error:'Add a valid title.'});db.prepare('UPDATE reading_items SET title=?,author=?,notes=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(title,d.author===undefined?item.author:String(d.author).slice(0,160),d.notes===undefined?item.notes:String(d.notes).slice(0,3000),status,item.id);s.json(one('SELECT * FROM reading_items WHERE id=?',item.id));});
app.delete('/api/reading-items/:id',(q,s)=>{db.prepare('DELETE FROM reading_items WHERE id=?').run(q.params.id);s.json({ok:true});});
app.get('/api/notes',(q,s)=>s.json(all('SELECT * FROM notes ORDER BY updated_at DESC')));
app.post('/api/notes',(q,s)=>{const {title,body=''}=q.body;if(!title?.trim())return s.status(400).json({error:'Give your note a title.'});const r=db.prepare('INSERT INTO notes(title,body) VALUES(?,?)').run(title.trim(),body);s.json(one('SELECT * FROM notes WHERE id=?',r.lastInsertRowid));});
app.put('/api/notes/:id',(q,s)=>{db.prepare('UPDATE notes SET title=?,body=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(q.body.title,q.body.body,q.params.id);s.json(one('SELECT * FROM notes WHERE id=?',q.params.id));});
app.delete('/api/notes/:id',(q,s)=>{db.prepare('DELETE FROM notes WHERE id=?').run(q.params.id);s.json({ok:true});});
app.get('/api/goals',(q,s)=>s.json(all("SELECT g.*,(SELECT COALESCE(SUM(ss.minutes),0) FROM sessions ss WHERE ss.task_id IN (SELECT t.id FROM tasks t LEFT JOIN projects tp ON tp.id=t.project_id WHERE t.goal_id=g.id OR tp.goal_id=g.id) OR ss.project_id IN (SELECT p.id FROM projects p WHERE p.goal_id=g.id) OR ss.lesson_id IN (SELECT ll.id FROM learning_lessons ll JOIN learning_paths lp ON lp.id=ll.path_id WHERE lp.goal_id=g.id)) AS focus_minutes,(SELECT COUNT(*) FROM tasks t LEFT JOIN projects tp ON tp.id=t.project_id WHERE t.goal_id=g.id OR tp.goal_id=g.id) AS linked_tasks,(SELECT COUNT(*) FROM tasks t LEFT JOIN projects tp ON tp.id=t.project_id WHERE (t.goal_id=g.id OR tp.goal_id=g.id) AND t.done=1) AS completed_tasks FROM goals g WHERE g.status!='archived' ORDER BY g.status='completed',g.target_date")));
app.post('/api/goals',(q,s)=>{if(!q.body.title?.trim())return s.status(400).json({error:'A goal needs a title.'});const category=String(q.body.category||'Personal').trim().slice(0,60)||'Personal',horizon=String(q.body.horizon||'long-term');if(!['short-term','long-term'].includes(horizon))return s.status(400).json({error:'Choose a short-term or long-term goal.'});const r=db.prepare('INSERT INTO goals(title,detail,target_date,category,horizon) VALUES(?,?,?,?,?)').run(q.body.title.trim(),q.body.detail||'',q.body.target_date||null,category,horizon);s.json(one('SELECT * FROM goals WHERE id=?',r.lastInsertRowid));});
app.patch('/api/goals/:id',(q,s)=>{const previous=one('SELECT * FROM goals WHERE id=?',q.params.id);if(!previous)return s.status(404).json({error:'Goal not found.'});const status=q.body.status;if(!['active','completed','archived'].includes(status))return s.status(400).json({error:'Invalid goal status.'});db.prepare('UPDATE goals SET status=? WHERE id=?').run(status,q.params.id);if(previous.status!=='completed'&&status==='completed'){publishAtlasEvent(q,{type:'goal.completed',module:'goals',entityId:String(previous.id),localDate:dateKey(),payload:{}});}else if(previous.status==='completed'&&status!=='completed'){publishAtlasEvent(q,{type:'goal.reopened',module:'goals',entityId:String(previous.id),localDate:dateKey(),payload:{}});}s.json(one('SELECT * FROM goals WHERE id=?',q.params.id));});
app.delete('/api/goals/:id',(q,s)=>{const goal=one('SELECT id,status FROM goals WHERE id=?',q.params.id);if(!goal)return s.status(404).json({error:'Goal not found.'});if(goal.status==='completed')publishAtlasEvent(q,{type:'goal.reopened',module:'goals',entityId:String(goal.id),localDate:dateKey(),payload:{}});db.prepare('DELETE FROM goals WHERE id=?').run(goal.id);s.json({ok:true});});
app.get('/api/habits',async(q,s)=>{
 const date=q.query.date||dateKey();
 const habits=all('SELECT h.*,g.title AS goal_title,CASE WHEN l.id IS NULL THEN 0 ELSE 1 END done FROM habits h LEFT JOIN goals g ON g.id=h.goal_id LEFT JOIN habit_logs l ON l.habit_id=h.id AND l.log_date=? WHERE h.active=1 ORDER BY h.sort_order',date);
 let streakModules=['habits'];
 try{const saved=one("SELECT value FROM settings WHERE key='streaks_enabled_modules'")?.value;if(saved){const parsed=JSON.parse(saved);if(Array.isArray(parsed))streakModules=parsed;}}catch{}
 if(!streakModules.includes('habits'))return s.json(habits.map(habit=>({...habit,streak:0,streaksEnabled:false,streakSource:'disabled'})));
 const byHabit=new Map();
 const addDate=(habitId,logDate,checked)=>{const key=String(habitId),dates=byHabit.get(key)||new Set();if(checked)dates.add(logDate);else dates.delete(logDate);byHabit.set(key,dates);};
 for(const log of all('SELECT habit_id,log_date FROM habit_logs WHERE log_date<=? ORDER BY habit_id,log_date',date))addDate(log.habit_id,log.log_date,true);
 let streakSource='workspace+event-ledger';
 try{
  const events=await atlasRest(q,'activity_events?select=type,entity_id,local_date,payload,occurred_at&module=eq.habits&type=in.(habit.checked,habit.unchecked)&local_date=lte.'+encodeURIComponent(date)+'&order=occurred_at.desc&limit=5000');
  for(const event of (events||[]).reverse()){
   const logDate=event.payload?.logDate||event.local_date;
   if(logDate<=date)addDate(event.entity_id,logDate,event.type==='habit.checked');
  }
 }catch(error){streakSource='legacy-workspace';console.warn('Habit event projection unavailable; using workspace logs:',error.message);}
 s.json(habits.map(habit=>({...habit,streak:calculateHabitStreak(byHabit.get(String(habit.id))||new Set(),date),streaksEnabled:true,streakSource})));
});
app.post('/api/habits/:id/toggle',(q,s)=>{const date=q.body.date||dateKey();const exists=one('SELECT id FROM habit_logs WHERE habit_id=? AND log_date=?',q.params.id,date);if(exists){db.prepare('DELETE FROM habit_logs WHERE id=?').run(exists.id);publishAtlasEvent(q,{type:'habit.unchecked',module:'habits',entityId:String(q.params.id),localDate:date,payload:{logDate:date}});}else{db.prepare('INSERT OR IGNORE INTO habit_logs(habit_id,log_date) VALUES(?,?)').run(q.params.id,date);publishAtlasEvent(q,{type:'habit.checked',module:'habits',entityId:String(q.params.id),localDate:date,payload:{logDate:date}});}s.json({ok:true,done:!exists});});
app.post('/api/habits',(q,s)=>{if(!q.body.title?.trim())return s.status(400).json({error:'Give the ritual a name.'});const goalId=q.body.goal_id===undefined||q.body.goal_id===null||q.body.goal_id===''?null:Number(q.body.goal_id);if(goalId!==null&&(!Number.isInteger(goalId)||goalId<1||!one('SELECT id FROM goals WHERE id=? AND status=\'active\'',goalId)))return s.status(400).json({error:'Choose an active goal.'});const r=db.prepare('INSERT INTO habits(title,emoji,sort_order,goal_id) VALUES(?,?,COALESCE((SELECT MAX(sort_order)+1 FROM habits),1),?)').run(q.body.title.trim(),q.body.emoji||'✦',goalId);s.json(one('SELECT * FROM habits WHERE id=?',r.lastInsertRowid));});
app.patch('/api/habits/:id',(q,s)=>{const habit=one('SELECT * FROM habits WHERE id=? AND active=1',q.params.id);if(!habit)return s.status(404).json({error:'Habit not found.'});const title=String(q.body.title??habit.title).trim(),emoji=String(q.body.emoji??habit.emoji).trim().slice(0,8)||'✦',rawGoalId=q.body.goal_id===undefined?habit.goal_id:q.body.goal_id,goalId=rawGoalId===null||rawGoalId===''?null:Number(rawGoalId);if(!title||title.length>100)return s.status(400).json({error:'Give the habit a name (up to 100 characters).'});if(goalId!==null&&(!Number.isInteger(goalId)||goalId<1||!one('SELECT id FROM goals WHERE id=? AND status=\'active\'',goalId)))return s.status(400).json({error:'Choose an active goal.'});db.prepare('UPDATE habits SET title=?,emoji=?,goal_id=? WHERE id=?').run(title,emoji,goalId,habit.id);s.json(one('SELECT * FROM habits WHERE id=?',habit.id));});
app.delete('/api/habits/:id',(q,s)=>{const habit=one('SELECT id FROM habits WHERE id=?',q.params.id);if(!habit)return s.status(404).json({error:'Habit not found.'});for(const log of all('SELECT log_date FROM habit_logs WHERE habit_id=? ORDER BY log_date',habit.id))publishAtlasEvent(q,{requestKey:(q.idempotencyKey||q.requestId)+':'+log.log_date,type:'habit.unchecked',module:'habits',entityId:String(habit.id),localDate:log.log_date,payload:{logDate:log.log_date}});db.prepare('DELETE FROM habits WHERE id=?').run(habit.id);s.json({ok:true});});
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
 const todayEntry=one('SELECT * FROM self_control_entries WHERE tracker_id=? AND log_date=?',tracker.id,today);
 const entries=all('SELECT log_date,outcome FROM self_control_entries WHERE tracker_id=? AND log_date>=? AND log_date<=? ORDER BY log_date ASC,id ASC',tracker.id,tracker.start_date,today);
 const byDate=new Map(entries.map(entry=>[entry.log_date,entry.outcome]));
 let cursor=new Date((todayEntry?today:(()=>{const d=new Date(today+'T12:00:00');d.setDate(d.getDate()-1);return dateKey(d)})())+'T12:00:00'),streak=0;
 while(true){const key=dateKey(cursor);if(byDate.get(key)!=='clean')break;streak++;cursor.setDate(cursor.getDate()-1);}
 let best=0,run=0,previous=null;
 for(const entry of entries){const current=new Date(entry.log_date+'T12:00:00');if(entry.outcome!=='clean'){run=0;previous=null;continue;}run=previous&&Math.round((current-previous)/86400000)===1?run+1:1;best=Math.max(best,run);previous=current;}
 return {...tracker,last_slip:effectiveSlip?.log_date||null,streak,today:todayEntry,longest_days:Math.max(streak,best)};
}
app.get('/api/self-control',(q,s)=>{
 const today=q.query.date||dateKey();
 const trackers=all('SELECT * FROM self_control_trackers WHERE active=1 ORDER BY created_at,id');
 const logs=all('SELECT e.*,t.name AS tracker_name,t.symbol AS tracker_symbol FROM self_control_entries e JOIN self_control_trackers t ON t.id=e.tracker_id ORDER BY e.log_date DESC,e.id DESC LIMIT 100');
 const days=all("SELECT log_date date,COUNT(*) checkins,SUM(CASE WHEN outcome='clean' THEN 1 ELSE 0 END) clean,SUM(CASE WHEN outcome='slip' THEN 1 ELSE 0 END) slips FROM self_control_entries WHERE log_date>=date(?,'-29 days') AND log_date<=? GROUP BY log_date",today,today);
 const habitDays=all("SELECT log_date date,COUNT(*) habits FROM habit_logs WHERE log_date>=date(?,'-29 days') AND log_date<=? GROUP BY log_date",today,today);
 const byDate=new Map();for(const row of days)byDate.set(row.date,{date:row.date,checkins:row.checkins,clean:row.clean,slips:row.slips,habits:0});for(const row of habitDays){const entry=byDate.get(row.date)||{date:row.date,checkins:0,clean:0,slips:0,habits:0};entry.habits=row.habits;byDate.set(row.date,entry);}
 const history=Array.from({length:30},(_,index)=>{const d=new Date(today+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-29+index);const date=d.toISOString().slice(0,10);return byDate.get(date)||{date,checkins:0,clean:0,slips:0,habits:0};});
 const recorded=history.filter(day=>day.checkins+day.habits>0);
 const last7=history.slice(-7);
 s.json({date:today,summary:trackers.map(t=>freedomSummary(t,today)),logs,history,consistency:{days7: last7.filter(day=>day.checkins+day.habits>0).length,days30:recorded.length,percent7:Math.round(last7.filter(day=>day.checkins+day.habits>0).length/7*100),percent30:Math.round(recorded.length/30*100)}});
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
app.get('/api/reviews/evidence',(q,s)=>{const start=String(q.query.start||''),end=String(q.query.end||'');if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end))return s.status(400).json({error:'Choose a valid evidence window.'});const completedTasks=one('SELECT COUNT(*) n FROM tasks WHERE done=1 AND date(created_at)>=date(?) AND date(created_at)<=date(?)',start,end).n;const focusMinutes=one("SELECT COALESCE(SUM(minutes),0) n FROM sessions WHERE session_kind='focus' AND session_date>=? AND session_date<=?",start,end).n;const lessonsCompleted=one("SELECT COUNT(*) n FROM learning_lessons WHERE status='Completed' AND date(created_at)>=date(?) AND date(created_at)<=date(?)",start,end).n;const rhythm=one("SELECT COUNT(*) total,SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) completed FROM rhythm_records WHERE record_date>=? AND record_date<=?",start,end);const prayers=one('SELECT COUNT(*) total,SUM(completed) completed FROM prayer_logs WHERE prayer_date>=? AND prayer_date<=?',start,end);const quran=one('SELECT COUNT(*) total FROM quran_logs WHERE log_date>=? AND log_date<=?',start,end);const faith=one('SELECT COUNT(*) total,SUM(completed) completed FROM faith_logs WHERE log_date>=? AND log_date<=?',start,end);const rhythmTotal=(rhythm.total||0)+(prayers.total||0)+(quran.total||0)+(faith.total||0),rhythmCompleted=(rhythm.completed||0)+(prayers.completed||0)+(quran.total||0)+(faith.completed||0);const habits=one('SELECT COUNT(*) n FROM habit_logs WHERE log_date>=? AND log_date<=?',start,end).n;const selfControl=one("SELECT COUNT(*) total,SUM(CASE WHEN outcome='slip' THEN 1 ELSE 0 END) slips FROM self_control_entries WHERE log_date>=? AND log_date<=?",start,end);const slips=selfControl.slips||0;const milestone=one('SELECT COUNT(*) n,SUM(CASE WHEN completed=1 THEN 1 ELSE 0 END) completed FROM project_milestones WHERE date(created_at)>=date(?) AND date(created_at)<=date(?)',start,end);s.json({start,end,completed_tasks:completedTasks,focus_minutes:focusMinutes,lessons_completed:lessonsCompleted,rhythm_total:rhythmTotal,rhythm_completed:rhythmCompleted,habit_checkins:habits,self_control_checkins:selfControl.total||0,self_control_slips:slips,milestones_total:milestone.n||0,milestones_completed:milestone.completed||0});});
app.get('/api/reviews',(q,s)=>{const period=String(q.query.period||'');if(period&&!['daily','weekly'].includes(period))return s.status(400).json({error:'Choose a daily or weekly review.'});const rows=period?all('SELECT * FROM reviews WHERE period_type=? ORDER BY period_start DESC LIMIT 30',period):all('SELECT * FROM reviews ORDER BY period_start DESC LIMIT 30');s.json(rows.map(row=>({...row,priority_task_ids:(()=>{try{return JSON.parse(row.priority_task_ids||'[]')}catch{return []}})()})));});
app.post('/api/reviews',(q,s)=>{
 const {period_type,period_start,period_end}=q.body;
 if(!['daily','weekly'].includes(period_type)||!/^\d{4}-\d{2}-\d{2}$/.test(period_start||'')||!/^\d{4}-\d{2}-\d{2}$/.test(period_end||''))return s.status(400).json({error:'Choose a valid review period.'});
 const existing=one('SELECT * FROM reviews WHERE period_type=? AND period_start=?',period_type,period_start);
 const field=(key,fallback='')=>q.body[key]===undefined?(existing?.[key]??fallback):q.body[key];
 const wins=String(field('wins')).slice(0,5000),challenges=String(field('challenges')).slice(0,5000),lessons=String(field('lessons')).slice(0,5000),nextFocus=String(field('next_focus')).slice(0,5000);
 const intention=String(field('intention')).trim().slice(0,500);
 let priorityIds=field('priority_task_ids',[]);
 if(typeof priorityIds==='string'){try{priorityIds=JSON.parse(priorityIds)}catch{priorityIds=[]}}
 if(!Array.isArray(priorityIds)||priorityIds.length>3||priorityIds.some(id=>!Number.isSafeInteger(Number(id))||Number(id)<1))return s.status(400).json({error:'Choose up to three valid priorities.'});
 priorityIds=[...new Set(priorityIds.map(Number))];
 for(const id of priorityIds)if(!one('SELECT id FROM tasks WHERE id=?',id))return s.status(400).json({error:'One of your selected priorities no longer exists. Refresh and choose again.'});
 const alignmentComplete=field('alignment_complete',0)?1:0,shutdownComplete=field('shutdown_complete',0)?1:0;
 if(alignmentComplete&&!intention)return s.status(400).json({error:'Add a daily intention before completing Morning Alignment.'});
 if(shutdownComplete&&(!wins.trim()||!challenges.trim()||!lessons.trim()||!nextFocus.trim()))return s.status(400).json({error:'Complete all four reflection prompts before closing the day.'});
 const result=db.prepare('INSERT INTO reviews(period_type,period_start,period_end,wins,challenges,lessons,next_focus,intention,priority_task_ids,alignment_complete,shutdown_complete) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(period_type,period_start) DO UPDATE SET period_end=excluded.period_end,wins=excluded.wins,challenges=excluded.challenges,lessons=excluded.lessons,next_focus=excluded.next_focus,intention=excluded.intention,priority_task_ids=excluded.priority_task_ids,alignment_complete=excluded.alignment_complete,shutdown_complete=excluded.shutdown_complete,updated_at=CURRENT_TIMESTAMP').run(period_type,period_start,period_end,wins,challenges,lessons,nextFocus,intention,JSON.stringify(priorityIds),alignmentComplete,shutdownComplete);
 const row=one('SELECT * FROM reviews WHERE period_type=? AND period_start=?',period_type,period_start);
 if(shutdownComplete&&!existing?.shutdown_complete)publishAtlasEvent(q,{type:'review.submitted',module:'growth',entityId:String(row.id),localDate:period_end,payload:{periodStart:period_start,periodType:period_type}});
 s.json({...row,priority_task_ids:priorityIds});
});

app.get('/api/settings',(q,s)=>{const values=Object.fromEntries(all('SELECT key,value FROM settings').map(x=>[x.key,x.value]));values.faith_tradition=values.faith_tradition||values.religion||'general';s.json(values);});
app.post('/api/onboarding', validateRequest(onboardingSchema), (q,s)=>{
 const { timezone, goal_title, habit_title } = q.validated.body;
 try { new Intl.DateTimeFormat('en-US',{timeZone:timezone}); }
 catch { return s.status(400).json({error:'Choose a valid IANA time zone.'}); }
 const create = db.transaction(()=>{
  db.prepare("INSERT INTO settings(key,value) VALUES('timezone',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(timezone);
  const goalResult=db.prepare('INSERT INTO goals(title,detail,target_date,category,horizon) VALUES(?,?,?,?,?)').run(goal_title,'',null,'Personal','long-term');
  const habitResult=db.prepare('INSERT INTO habits(title,emoji,sort_order,goal_id) VALUES(?,?,COALESCE((SELECT MAX(sort_order)+1 FROM habits),1),?)').run(habit_title,'✦',null);
  return { goal: one('SELECT * FROM goals WHERE id=?',goalResult.lastInsertRowid), habit: one('SELECT * FROM habits WHERE id=?',habitResult.lastInsertRowid) };
 });
 return s.status(201).json(create());
});
app.patch('/api/settings',(q,s)=>{
 const allowed=['daily_target','display_name','username','north_star','timezone','religion','faith_tradition','leaderboard_name','leaderboard_public','theme','features','life_areas','widgets','sidebar_collapsed','hifz_page','hifz_bookmark','murajaah_page','murajaah_bookmark','communication_style','xp_enabled_modules','streaks_enabled_modules'];
 const themes=['system','shadowed-alchemist','nocturnal-amethyst','abyssal-trench','whispering-woods','crimson-velvet','light-porcelain','light-sandstone','light-sage','light-lavender','light-sky'];
 const features=['calendar','deen','faith','selfcontrol','learning','tasks','focus','library','goals','rankings','rituals','values'];
 const lifeAreas=['health','education','career','finance','faith','personal','relationships','lifestyle'];
 if(q.body.communication_style!==undefined&&!['adaptive','jarvis','companion','advisor'].includes(q.body.communication_style))return s.status(400).json({error:'Choose a valid communication style.'});
 const xpModules=['actions','goals','habits','learning','growth','residence'];
 if(q.body.xp_enabled_modules!==undefined&&(!Array.isArray(q.body.xp_enabled_modules)||new Set(q.body.xp_enabled_modules).size!==q.body.xp_enabled_modules.length||q.body.xp_enabled_modules.some(x=>!xpModules.includes(x))))return s.status(400).json({error:'Choose valid modules for XP.'});
 if(q.body.streaks_enabled_modules!==undefined&&(!Array.isArray(q.body.streaks_enabled_modules)||new Set(q.body.streaks_enabled_modules).size!==q.body.streaks_enabled_modules.length||q.body.streaks_enabled_modules.some(x=>x!=='habits')))return s.status(400).json({error:'Choose valid modules for streaks.'});
 if(q.body.religion!==undefined&&!['islam','christianity','none','prefer_not_to_say'].includes(q.body.religion))return s.status(400).json({error:'Choose a valid religious experience.'});
 if(q.body.faith_tradition!==undefined&&!['islam','christianity','none','prefer_not_to_say','general'].includes(q.body.faith_tradition))return s.status(400).json({error:'Choose a valid faith tradition.'});
 if(q.body.theme!==undefined&&!themes.includes(q.body.theme))return s.status(400).json({error:'Choose a valid colour theme.'});
 if(q.body.timezone!==undefined){try{new Intl.DateTimeFormat('en-US',{timeZone:String(q.body.timezone).trim()});}catch{return s.status(400).json({error:'Choose a valid IANA time zone.'});}}
 if(q.body.features!==undefined&&(!Array.isArray(q.body.features)||q.body.features.some(x=>!features.includes(x))))return s.status(400).json({error:'Choose valid workspace sections.'});
 if(q.body.life_areas!==undefined&&(!Array.isArray(q.body.life_areas)||q.body.life_areas.length<1||q.body.life_areas.length>8||new Set(q.body.life_areas).size!==q.body.life_areas.length||q.body.life_areas.some(x=>!lifeAreas.includes(x))))return s.status(400).json({error:'Choose at least one valid life area.'});
 if(q.body.widgets!==undefined&&(!q.body.widgets||typeof q.body.widgets!=='object'||Array.isArray(q.body.widgets)))return s.status(400).json({error:'Choose valid dashboard widgets.'});
 const tx=db.transaction(()=>{for(const k of allowed)if(q.body[k]!==undefined){let v=String(q.body[k]).trim();if(k==='features'||k==='life_areas'||k==='widgets'||k==='xp_enabled_modules'||k==='streaks_enabled_modules')v=JSON.stringify(q.body[k]);if(k==='daily_target')v=String(Math.max(10,Math.min(600,Number(v)||80)));if(k==='leaderboard_public')v=v==='1'?'1':'0';if(k==='sidebar_collapsed')v=v==='1'?'1':'0';if(k==='leaderboard_name')v=v.slice(0,24);db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(k,v)}});
 tx();if(q.body.faith_tradition!==undefined){const v=q.body.faith_tradition==='general'?'none':q.body.faith_tradition;db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run('religion',v);db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run('faith_tradition',q.body.faith_tradition);}else if(q.body.religion!==undefined){db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run('faith_tradition',q.body.religion==='none'?'general':q.body.religion);}const values=Object.fromEntries(all('SELECT key,value FROM settings').map(x=>[x.key,x.value]));values.faith_tradition=values.faith_tradition||values.religion||'general';s.json(values);
});
app.use('/api/faith',(q,s,next)=>{if(q.user?.id!==ownerUserId&&one("SELECT value FROM settings WHERE key='religion'")?.value!=='christianity')return s.status(403).json({error:'This faith space is not enabled for this account.'});next();});
app.get('/api/faith',(q,s)=>{const date=q.query.date||dateKey();s.json(all('SELECT * FROM faith_logs WHERE log_date=? ORDER BY activity',date));});
app.patch('/api/faith',(q,s)=>{const {date=dateKey(),activity,completed}=q.body;if(!['bible','prayer','reflection','worship','service'].includes(activity))return s.status(400).json({error:'Choose a valid faith practice.'});db.prepare('INSERT INTO faith_logs(log_date,activity,completed) VALUES(?,?,?) ON CONFLICT(log_date,activity) DO UPDATE SET completed=excluded.completed').run(date,activity,completed?1:0);s.json(one('SELECT * FROM faith_logs WHERE log_date=? AND activity=?',date,activity));});
// Daily Rhythm records live in each authenticated user's workspace snapshot.
const rhythmTypes = new Set(['sunnah','adhkar','jumuah','muhasabah','prayer_rhythm','intercessory','bible_reading','scripture_memory','sermon_note','pray_reflection','daily_intention','wisdom_note','evening_reflection']);
function validRecordDate(value){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value+'T12:00:00Z'));}
function rhythmTradition(){const setting=one("SELECT value FROM settings WHERE key='faith_tradition'")?.value||one("SELECT value FROM settings WHERE key='religion'")?.value||'none';return setting==='islam'||setting==='christianity'?setting:'general';}
function rhythmRecord(row){if(!row)return row;let metadata={};try{metadata=JSON.parse(row.metadata_json||'{}')}catch{}return {...row,metadata};}
app.get('/api/rhythm/records',(q,s)=>{const date=String(q.query.date||dateKey());if(!validRecordDate(date))return s.status(400).json({error:'Choose a valid date.'});s.json(all('SELECT * FROM rhythm_records WHERE record_date=? ORDER BY created_at,id',date).map(rhythmRecord));});
app.get('/api/rhythm/summary',(q,s)=>{const date=String(q.query.date||dateKey());if(!validRecordDate(date))return s.status(400).json({error:'Choose a valid date.'});const records=all('SELECT * FROM rhythm_records WHERE record_date=? ORDER BY created_at,id',date).map(rhythmRecord);const completed=records.filter(item=>item.status==='completed').length;const planned=records.filter(item=>item.status==='planned').length;s.json({date,tradition:rhythmTradition(),completed,planned,total:completed+planned,records});});
app.post('/api/rhythm/records',(q,s)=>{const recordDate=String(q.body.record_date||dateKey()),type=String(q.body.record_type||''),title=String(q.body.title||'').trim(),detail=String(q.body.detail||'').trim(),status=String(q.body.status||'completed'),metadata=q.body.metadata&&typeof q.body.metadata==='object'&&!Array.isArray(q.body.metadata)?q.body.metadata:{};if(!validRecordDate(recordDate)||recordDate>dateKey()&&!['planned'].includes(status))return s.status(400).json({error:'Choose a valid date for this record.'});if(!rhythmTypes.has(type)||!title||title.length>120||detail.length>4000||!['planned','completed','active','answered'].includes(status))return s.status(400).json({error:'Check the activity, title, details and status.'});const isOwner=q.user?.id===ownerUserId;const requestedTradition=String(q.body.admin_tradition||'');const tradition=isOwner&&['islam','christianity','general'].includes(requestedTradition)?requestedTradition:rhythmTradition();const allowed=type==='sunnah'||type==='adhkar'||type==='jumuah'||type==='muhasabah'?tradition==='islam':type==='prayer_rhythm'||type==='intercessory'||type==='bible_reading'||type==='scripture_memory'||type==='sermon_note'||type==='pray_reflection'?tradition==='christianity':type==='daily_intention'||type==='wisdom_note'||type==='evening_reflection'?tradition==='general':false;if(!allowed)return s.status(403).json({error:'This activity does not belong to the selected Daily Rhythm.'});const metadataJson=JSON.stringify(metadata);if(metadataJson.length>8000)return s.status(400).json({error:'Keep the activity details under 8 KB.'});const result=db.prepare('INSERT INTO rhythm_records(record_date,tradition,record_type,title,detail,status,metadata_json) VALUES(?,?,?,?,?,?,?)').run(recordDate,tradition,type,title,detail,status,metadataJson);if(status==='completed')publishAtlasEvent(q,{type:'practice.logged',module:'values',entityId:String(result.lastInsertRowid),localDate:recordDate,payload:{practiceType:type,tradition}});s.status(201).json(rhythmRecord(one('SELECT * FROM rhythm_records WHERE id=?',result.lastInsertRowid)));});
app.patch('/api/rhythm/records/:id',(q,s)=>{const existing=one('SELECT * FROM rhythm_records WHERE id=?',q.params.id);if(!existing)return s.status(404).json({error:'Daily Rhythm record not found.'});if(existing.tradition!==rhythmTradition()&&q.user?.id!==ownerUserId)return s.status(403).json({error:'This record belongs to a different Daily Rhythm.'});const title=String(q.body.title??existing.title).trim(),detail=String(q.body.detail??existing.detail).trim(),status=String(q.body.status??existing.status);if(!title||title.length>120||detail.length>4000||!['planned','completed','active','answered'].includes(status))return s.status(400).json({error:'Check the title, details and status.'});db.prepare('UPDATE rhythm_records SET title=?,detail=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(title,detail,status,existing.id);if(existing.status!=='completed'&&status==='completed')publishAtlasEvent(q,{type:'practice.logged',module:'values',entityId:String(existing.id),localDate:existing.record_date,payload:{practiceType:existing.record_type,tradition:existing.tradition}});else if(existing.status==='completed'&&status!=='completed')publishAtlasEvent(q,{type:'practice.unlogged',module:'values',entityId:String(existing.id),localDate:existing.record_date,payload:{practiceType:existing.record_type,tradition:existing.tradition}});s.json(rhythmRecord(one('SELECT * FROM rhythm_records WHERE id=?',existing.id)));});
app.delete('/api/rhythm/records/:id',(q,s)=>{const record=one('SELECT * FROM rhythm_records WHERE id=?',q.params.id);if(!record)return s.status(404).json({error:'Daily Rhythm record not found.'});if(record.status==='completed')publishAtlasEvent(q,{type:'practice.unlogged',module:'values',entityId:String(record.id),localDate:record.record_date,payload:{practiceType:record.record_type,tradition:record.tradition}});db.prepare('DELETE FROM rhythm_records WHERE id=?').run(record.id);s.json({ok:true});});
app.get('/api/calendar',(q,s)=>{const month=String(q.query.month||'');if(!/^\d{4}-\d{2}$/.test(month))return s.status(400).json({error:'Choose a valid calendar month.'});const from=month+'-01',to=month+'-31';const map=new Map();const add=(date,section)=>{if(!map.has(date))map.set(date,new Set());map.get(date).add(section)};const religion=one("SELECT value FROM settings WHERE key='religion'")?.value||'none';const queries=[['SELECT DISTINCT session_date date FROM sessions','focus'],['SELECT DISTINCT log_date date FROM learning_study_logs','learning'],['SELECT DISTINCT log_date date FROM habit_logs','habits']];if(religion==='islam'||q.user.id===ownerUserId)queries.push(['SELECT DISTINCT prayer_date date FROM prayer_logs WHERE completed=1','faith'],['SELECT DISTINCT log_date date FROM quran_logs','faith']);if(religion==='christianity'||q.user.id===ownerUserId)queries.push(['SELECT DISTINCT log_date date FROM faith_logs WHERE completed=1','faith']);for(const [sql,section] of queries)for(const row of all(sql))add(row.date,section);const allDays=[...map.entries()].map(([date,set])=>({date,sections:[...set],perfect:set.size>=3}));const days=allDays.filter(x=>x.date>=from&&x.date<=to).sort((a,b)=>a.date.localeCompare(b.date));const streaks={};for(const section of ['focus','learning','habits','faith']){const dates=allDays.filter(x=>x.sections.includes(section)).map(x=>x.date).sort();let current=0,cursor=new Date();const key=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');if(!dates.includes(key(cursor)))cursor.setDate(cursor.getDate()-1);const set=new Set(dates);while(set.has(key(cursor))){current++;cursor.setDate(cursor.getDate()-1)}let best=0,run=0,prev=null;for(const date of dates){const d=new Date(date+'T12:00:00');run=prev&&Math.round((d-prev)/86400000)===1?run+1:1;best=Math.max(best,run);prev=d}streaks[section]={current,best};}const events=all("SELECT * FROM calendar_events WHERE substr(start_at,1,7)=? ORDER BY start_at,id",month);s.json({month,days,streaks,events});});
app.post('/api/calendar/events',(q,s)=>{const title=String(q.body.title||'').trim(),startAt=String(q.body.start_at||'');if(!title||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(startAt))return s.status(400).json({error:'Add a title and a valid start time.'});const taskId=q.body.task_id?Number(q.body.task_id):null,projectId=q.body.project_id?Number(q.body.project_id):null;if(taskId&&!one('SELECT id FROM tasks WHERE id=?',taskId))return s.status(400).json({error:'Choose an existing task.'});if(projectId&&!one('SELECT id FROM projects WHERE id=?',projectId))return s.status(400).json({error:'Choose an existing project.'});const r=db.prepare('INSERT INTO calendar_events(title,description,start_at,end_at,all_day,task_id,project_id) VALUES(?,?,?,?,?,?,?)').run(title,String(q.body.description||''),startAt,q.body.end_at||null,q.body.all_day?1:0,taskId,projectId);s.status(201).json(one('SELECT * FROM calendar_events WHERE id=?',r.lastInsertRowid));});
app.patch('/api/calendar/events/:id',(q,s)=>{const e=one('SELECT * FROM calendar_events WHERE id=?',q.params.id);if(!e)return s.status(404).json({error:'Calendar event not found.'});const title=String(q.body.title??e.title).trim(),startAt=String(q.body.start_at??e.start_at),taskId=q.body.task_id===undefined?e.task_id:(q.body.task_id||null),projectId=q.body.project_id===undefined?e.project_id:(q.body.project_id||null);if(!title||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(startAt))return s.status(400).json({error:'Check the event title and start time.'});if(taskId&&!one('SELECT id FROM tasks WHERE id=?',taskId))return s.status(400).json({error:'Choose an existing task.'});if(projectId&&!one('SELECT id FROM projects WHERE id=?',projectId))return s.status(400).json({error:'Choose an existing project.'});db.prepare('UPDATE calendar_events SET title=?,description=?,start_at=?,end_at=?,all_day=?,task_id=?,project_id=? WHERE id=?').run(title,q.body.description??e.description,startAt,q.body.end_at===undefined?e.end_at:(q.body.end_at||null),q.body.all_day===undefined?e.all_day:(q.body.all_day?1:0),taskId,projectId,e.id);s.json(one('SELECT * FROM calendar_events WHERE id=?',e.id));});
app.delete('/api/calendar/events/:id',(q,s)=>{db.prepare('DELETE FROM calendar_events WHERE id=?').run(q.params.id);s.json({ok:true});});
app.get('/api/export',(q,s)=>{s.setHeader('Content-Disposition','attachment; filename="personal-os-backup.json"');s.json({exportedAt:new Date().toISOString(),goals:all('SELECT * FROM goals'),projects:all('SELECT * FROM projects'),project_milestones:all('SELECT * FROM project_milestones'),tasks:all('SELECT * FROM tasks'),modules:all('SELECT * FROM modules'),learning_paths:all('SELECT * FROM learning_paths'),learning_lessons:all('SELECT * FROM learning_lessons'),learning_resources:all('SELECT * FROM learning_resources'),learning_study_logs:all('SELECT * FROM learning_study_logs'),sessions:all('SELECT * FROM sessions'),calendar_events:all('SELECT * FROM calendar_events'),notes:all('SELECT * FROM notes'),reading_items:all('SELECT * FROM reading_items'),reviews:all('SELECT * FROM reviews'),habits:all('SELECT * FROM habits'),habit_logs:all('SELECT * FROM habit_logs'),prayer_logs:all('SELECT * FROM prayer_logs'),quran_logs:all('SELECT * FROM quran_logs'),tahajjud_logs:all('SELECT * FROM tahajjud_logs'),faith_logs:all('SELECT * FROM faith_logs'),rhythm_records:all('SELECT * FROM rhythm_records'),self_control_logs:all('SELECT * FROM self_control_logs'),self_control_trackers:all('SELECT * FROM self_control_trackers'),self_control_entries:all('SELECT * FROM self_control_entries'),settings:all('SELECT * FROM settings'),email_events:all('SELECT * FROM email_events'),login_events:all('SELECT * FROM login_events'),xp_events:all('SELECT * FROM xp_events'),achievement_unlocks:all('SELECT * FROM achievement_unlocks'),weekly_challenges:all('SELECT * FROM weekly_challenges'),feedback_logs:all('SELECT * FROM feedback_logs')});});
app.post('/api/import',(q,s)=>{
 try {
  const imported=restoreBackup(db,q.body,workspaceTables);
  s.json({ok:true,imported});
 } catch(error) {
  s.status(400).json({error:error.message||'The backup could not be imported.'});
 }
});
app.get('*',(req,res,next)=>{
  if(req.path.startsWith('/api/')) return next();
  if (!fs.existsSync(frontendEntry)) {
    return res.status(503).type('text/plain').send('Atlas frontend build is missing. Please retry the deployment.');
  }
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.sendFile(frontendEntry, error => { if(error) next(error); });
});

if (!fs.existsSync(frontendEntry)) {
  throw new Error('Atlas frontend build is missing: expected dist/index.html. Refusing to serve the legacy public HTML shell.');
}
Promise.all([fetchAlQuranCloudPage(1), fetchAlQuranCloudPage(2)])
  .then(([page1, page2]) => {
    const coloredAyahs = page => page.ayahs.filter(ayah => (ayah.tajweedSegments || []).some(segment => segment.className)).length;
    const openingAyah = page2.ayahs.find(ayah => Number(ayah.surahNumber) === 2 && Number(ayah.numberInSurah) === 1);
    const openingMarked = (openingAyah?.tajweedSegments || []).filter(segment => segment.className).reduce((count, segment) => count + segment.text.length, 0);
    console.info('AlQuranCloud Uthmani/Sahih/Tajweed provider ready:', page1.ayahs.length, 'page 1 verses;', page2.ayahs.length, 'page 2 verses');
    console.info('Direct Tajweed tokens:', coloredAyahs(page1), '/', page1.ayahs.length, 'page 1 ayahs;', coloredAyahs(page2), '/', page2.ayahs.length, 'page 2 ayahs; 2:1 marked characters:', openingMarked);
  })
  .catch(error => console.warn('Quran reading data startup check failed:', error.message));
async function startServer() {
  const readiness = await checkEnvironmentMarker({
    appEnv: APP_ENV,
    supabaseUrl: supabaseConfig.url,
    apiKey: supabaseConfig.publishableKey,
    probeToken: process.env.ATLAS_ENVIRONMENT_PROBE_TOKEN
  });
  if (!readiness.ok) {
    throw new Error(`Environment guard failed (${readiness.reason || 'unknown'}). Refusing to start.`);
  }

  const httpServer = app.listen(PORT, '0.0.0.0', () => {
    console.info(JSON.stringify({ timestamp: new Date().toISOString(), level: 'info', event: 'server.started', environment: APP_ENV, port: Number(PORT) }));
  });
  let shuttingDown = false;
  const shutdown = signal => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.info(JSON.stringify({ timestamp: new Date().toISOString(), level: 'info', event: 'server.shutdown_started', signal }));
    const forceTimer = setTimeout(() => {
      console.error(JSON.stringify({ timestamp: new Date().toISOString(), level: 'error', event: 'server.shutdown_timeout', signal }));
      process.exit(1);
    }, 25_000);
    forceTimer.unref();
    httpServer.close(error => {
      clearTimeout(forceTimer);
      try { if (db?.open) db.close(); } catch (closeError) {
        console.error(JSON.stringify({ timestamp: new Date().toISOString(), level: 'error', event: 'database.close_failed', message: closeError.message }));
      }
      if (error) {
        console.error(JSON.stringify({ timestamp: new Date().toISOString(), level: 'error', event: 'server.shutdown_failed', message: error.message }));
        process.exitCode = 1;
      } else {
        console.info(JSON.stringify({ timestamp: new Date().toISOString(), level: 'info', event: 'server.shutdown_complete', signal }));
        process.exitCode = 0;
      }
    });
  };
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
  return httpServer;
}

startServer().catch(error => {
  console.error(JSON.stringify({ timestamp: new Date().toISOString(), level: 'error', event: 'server.startup_failed', environment: APP_ENV, message: error.message }));
  process.exitCode = 1;
});
