import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { BookOpen, ChevronLeft, ChevronRight, WifiOff } from 'lucide-react';
import { api, json } from '../lib/api';
import { QURAN_JUZ_STARTS, QURAN_SURAHS, getAyahLocation, getPageJuz } from '../data/quranSurahs';
import { triggerSparkBurst } from './fx/SparkBurst';

type Settings = Record<string, string>;
type MushafAyah = {
  text: string;
  numberInSurah: number;
  juz: number;
  surah: { number: number; name: string; englishName: string };
};
type MushafPage = { ayahs: MushafAyah[] };
type Props = { settings: Settings; settingsReady: boolean; onLogged: () => void };
const CACHE_PREFIX = 'atlas_mushaf_page_v1_';
const pageMemoryCache = new Map<number, MushafPage>();
const HIFZ_KEY = 'atlas_hifz_page';
const MURAJAAH_KEY = 'atlas_murajaah_page';
const clampPage = (value: number) => Math.max(1, Math.min(604, Number.isInteger(value) ? value : 1));
const arabicNumber = (value: number) => String(value).replace(/\d/g, digit => '٠١٢٣٤٥٦٧٨٩'[Number(digit)]);
function savedPage(key: string) { try { return clampPage(Number(localStorage.getItem(key)) || 1); } catch { return 1; } }
function lagosDate() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }

export function QuranMushafReader({ settings, settingsReady, onLogged }: Props) {
  const [mode, setMode] = useState<'hifz' | 'murajaah'>('hifz');
  const [hifzPage, setHifzPage] = useState(() => savedPage(HIFZ_KEY));
  const [murajaahPage, setMurajaahPage] = useState(() => savedPage(MURAJAAH_KEY));
  const [page, setPage] = useState(() => savedPage(HIFZ_KEY));
  const [pageData, setPageData] = useState<MushafPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [logging, setLogging] = useState(false);
  const [logMessage, setLogMessage] = useState('');
  const bookmarksLoaded = useRef(false);
  const activeKey = mode === 'hifz' ? HIFZ_KEY : MURAJAAH_KEY;
  const activeBookmark = mode === 'hifz' ? hifzPage : murajaahPage;
  const pageJuz = useMemo(() => pageData?.ayahs?.[0]?.juz || getPageJuz(page) || 1, [pageData, page]);

  useEffect(() => {
    if (!settingsReady || bookmarksLoaded.current) return;
    bookmarksLoaded.current = true;
    const hifz = savedPage(HIFZ_KEY) || clampPage(Number(settings.hifz_page) || 1);
    const murajaah = savedPage(MURAJAAH_KEY) || clampPage(Number(settings.murajaah_page) || 1);
    const resolvedHifz = localStorage.getItem(HIFZ_KEY) ? hifz : clampPage(Number(settings.hifz_page) || 1);
    const resolvedMurajaah = localStorage.getItem(MURAJAAH_KEY) ? murajaah : clampPage(Number(settings.murajaah_page) || 1);
    setHifzPage(resolvedHifz);
    setMurajaahPage(resolvedMurajaah);
    setPage(mode === 'hifz' ? resolvedHifz : resolvedMurajaah);
  }, [settingsReady, settings.hifz_page, settings.murajaah_page, mode]);

  useEffect(() => {
    if (!bookmarksLoaded.current) return;
    const key = mode === 'hifz' ? HIFZ_KEY : MURAJAAH_KEY;
    const value = mode === 'hifz' ? hifzPage : murajaahPage;
    try { localStorage.setItem(key, String(value)); } catch { /* local cache may be unavailable */ }
    void api('/settings', json('PATCH', { [mode === 'hifz' ? 'hifz_page' : 'murajaah_page']: String(value) })).catch(() => undefined);
  }, [mode, hifzPage, murajaahPage]);

  useEffect(() => {
    let cancelled = false;
    const cacheKey = CACHE_PREFIX + page;
    setLoading(true);
    setPageError('');
    setLogMessage('');
    setPageData(null);
    const memoryCached = pageMemoryCache.get(page);
    if (memoryCached?.ayahs?.length) {
      setPageData(memoryCached);
      setLoading(false);
      return () => { cancelled = true; };
    }
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as MushafPage;
        if (parsed?.ayahs?.length) {
          pageMemoryCache.set(page, parsed);
          setPageData(parsed);
          setLoading(false);
          return () => { cancelled = true; };
        }
      }
    } catch { /* ignore corrupt or unavailable cache */ }
    fetch('https://api.alquran.cloud/v1/page/' + page + '/quran-uthmani')
      .then(response => { if (!response.ok) throw new Error('The Mushaf page could not be loaded.'); return response.json(); })
      .then(payload => {
        const result = payload?.data as MushafPage | undefined;
        if (!result?.ayahs?.length) throw new Error('No Arabic text was returned for this page.');
        if (cancelled) return;
        pageMemoryCache.set(page, result);
        setPageData(result);
        setLoading(false);
        try { localStorage.setItem(cacheKey, JSON.stringify(result)); } catch { /* keep the in-memory page */ }
      })
      .catch(error => {
        if (cancelled) return;
        setLoading(false);
        setPageError(error instanceof Error ? error.message : 'You are offline and this page is not cached yet.');
      });
    return () => { cancelled = true; };
  }, [page]);

  const changePage = (next: number) => {
    const value = clampPage(next);
    setPage(value);
    if (mode === 'hifz') setHifzPage(value); else setMurajaahPage(value);
  };
  const changeMode = (next: 'hifz' | 'murajaah') => {
    if (next === mode) return;
    setMode(next);
    setPage(next === 'hifz' ? hifzPage : murajaahPage);
  };
  const jumpSurah = (number: number) => {
    const item = QURAN_SURAHS[number - 1];
    if (item) changePage(item.pageStart);
  };
  const jumpJuz = (number: number) => {
    const start = QURAN_JUZ_STARTS[number - 1];
    if (start) changePage(getAyahLocation(start[1], start[2])?.page || 1);
  };
  const logPage = async (event: MouseEvent<HTMLButtonElement>) => {
    if (!pageData?.ayahs?.length || logging) return;
    setLogging(true);
    setLogMessage('');
    const first = pageData.ayahs[0];
    const last = pageData.ayahs[pageData.ayahs.length - 1];
    const sameSurah = first.surah.number === last.surah.number;
    const surahLabel = sameSurah
      ? (QURAN_SURAHS[first.surah.number - 1]?.transliteration || first.surah.englishName)
      : 'Page ' + page + ' · ' + first.surah.englishName + '–' + last.surah.englishName;
    try {
      await api('/deen/quran', json('POST', {
        log_date: lagosDate(),
        activity: mode === 'hifz' ? 'memorisation' : 'revision',
        surah: surahLabel,
        ayah_start: sameSurah ? first.numberInSurah : null,
        ayah_end: sameSurah ? last.numberInSurah : null,
        pages: 1,
        juz: first.juz,
        reflection: 'Completed Mushaf page ' + page + ' in the ' + (mode === 'hifz' ? 'Hifz' : 'Muraja’ah') + ' reader.'
      }));
      const rect = event.currentTarget.getBoundingClientRect();
      triggerSparkBurst(rect.left + rect.width / 2, rect.top + rect.height / 2);
      setLogMessage('Page ' + page + ' logged successfully.');
      onLogged();
    } catch (error) {
      setLogMessage(error instanceof Error ? error.message : 'Could not log this page.');
    } finally { setLogging(false); }
  };

  return <section className="mushaf-reader" aria-label="604-page Madani Mushaf reader" style={{ display: 'grid', gap: 16, marginTop: 20 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
      <div><span className="module-kicker">604-PAGE MADANI MUSHAF</span><h3 style={{ margin: '5px 0 0' }}>Arabic Mushaf Reader</h3></div>
      <div role="group" aria-label="Reader mode" className="atlas-segmented-switcher" style={{ display: 'flex', gap: 6 }}>
        <button type="button" aria-pressed={mode === 'hifz'} className={mode === 'hifz' ? 'is-active' : ''} onClick={() => changeMode('hifz')}>Hifz · Memorization</button>
        <button type="button" aria-pressed={mode === 'murajaah'} className={mode === 'murajaah' ? 'is-active' : ''} onClick={() => changeMode('murajaah')}>Muraja’ah · Revision</button>
      </div>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
      <label style={{ display: 'grid', gap: 5, flex: '1 1 180px' }}><small className="module-kicker">SURAH</small><select className="field-input" value={pageData?.ayahs?.[0]?.surah.number || QURAN_SURAHS.find(s => page >= s.pageStart && page <= s.pageEnd)?.number || 1} onChange={event => jumpSurah(Number(event.target.value))}>{QURAN_SURAHS.map(s => <option key={s.number} value={s.number}>{s.number}. {s.transliteration} · {s.arabic}</option>)}</select></label>
      <label style={{ display: 'grid', gap: 5, flex: '0 1 120px' }}><small className="module-kicker">PAGE (1–604)</small><input className="field-input" type="number" min="1" max="604" value={page} onChange={event => { const n = Number(event.target.value); if (event.target.value && Number.isInteger(n) && n >= 1 && n <= 604) changePage(n); }}/></label>
      <label style={{ display: 'grid', gap: 5, flex: '0 1 120px' }}><small className="module-kicker">JUZ</small><select className="field-input" value={pageJuz} onChange={event => jumpJuz(Number(event.target.value))}>{Array.from({ length: 30 }, (_, i) => <option key={i + 1} value={i + 1}>Juz {i + 1}</option>)}</select></label>
      <div style={{ marginLeft: 'auto', textAlign: 'right' }}><small className="module-kicker">AUTO-RESUME BOOKMARK</small><div style={{ fontWeight: 650 }}>Page {activeBookmark} / 604</div></div>
    </div>
    <div className="mushaf-page" style={{ background: 'var(--surface-card, rgba(255,255,255,.035))', border: '1px solid var(--border-subtle, rgba(255,255,255,.12))', borderRadius: 18, padding: 'clamp(18px, 4vw, 34px)', minHeight: 420 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,.12))', paddingBottom: 12, marginBottom: 20 }}><span className="module-kicker">AL-MADINAH · HAFS</span><span className="module-kicker">PAGE {page} · JUZ {pageJuz}</span></div>
      {loading && <p className="muted" role="status">Opening page {page}…</p>}
      {!loading && pageError && <div role="alert" style={{ textAlign: 'center', padding: 30 }}><WifiOff size={22}/><p>{pageError}</p><button type="button" className="button button--secondary" onClick={() => changePage(page)}>Retry page</button></div>}
      {!loading && pageData && <div dir="rtl" lang="ar" style={{ textAlign: 'justify', fontFamily: '"KFGQPC Uthmanic Script HAFS", "Amiri Quran", "Noto Naskh Arabic", serif', fontSize: 'clamp(25px, 3.3vw, 32px)', lineHeight: 2.15, color: 'var(--text-primary, inherit)', wordSpacing: 2 }}>
        {pageData.ayahs.map((ayah, index) => <span key={ayah.surah.number + ':' + ayah.numberInSurah}>
          {(index === 0 || pageData.ayahs[index - 1].surah.number !== ayah.surah.number) && <span style={{ display: 'block', textAlign: 'center', margin: '22px 0 10px', padding: '8px 12px', border: '1px solid var(--border-subtle, rgba(255,255,255,.18))', borderRadius: 10, fontSize: 22 }}>{ayah.surah.name} · {ayah.surah.englishName}</span>}
          {ayah.text} <span style={{ whiteSpace: 'nowrap', fontSize: '.78em', color: 'var(--accent-primary, #b9a6ff)' }}>﴿{arabicNumber(ayah.numberInSurah)}﴾ </span>
        </span>)}
      </div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, paddingTop: 14, borderTop: '1px solid var(--border-subtle, rgba(255,255,255,.12))' }}>
        <button type="button" className="button button--secondary" disabled={page <= 1} onClick={() => changePage(page - 1)}><ChevronLeft size={15}/> Previous Page</button>
        <span className="module-kicker">{page} / 604</span>
        <button type="button" className="button button--secondary" disabled={page >= 604} onClick={() => changePage(page + 1)}>Next Page <ChevronRight size={15}/></button>
      </div>
    </div>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
      <div><small className="muted">{pageData?.ayahs?.length || 0} ayahs on this page · bookmark saves automatically</small>{logMessage && <div role="status" className="muted" style={{ marginTop: 4 }}>{logMessage}</div>}</div>
      <button type="button" className="button button--primary" disabled={!pageData?.ayahs?.length || loading || logging} onClick={logPage}><BookOpen size={15}/>{logging ? 'Logging…' : 'Complete & Log Page'}</button>
    </div>
  </section>;
}
