import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, BookOpen, Bookmark, Check, ChevronLeft, ChevronRight, Copy, Maximize2, Menu, Play, Share2, WifiOff, X } from 'lucide-react';
import { api, json } from '../lib/api';
import { QURAN_JUZ_STARTS, QURAN_SURAHS, getAyahLocation, getPageJuz } from '../data/quranSurahs';
import { triggerSparkBurst } from './fx/SparkBurst';

type Settings = Record<string, string>;
type MushafAyah = { number: number; numberInSurah: number; surahNumber: number; surahName: string; arabicName: string; text: string; translation: string };
type MushafPage = { page: number; juz: number; ayahs: MushafAyah[]; offlineFallback?: boolean };
type Props = { settings: Settings; settingsReady: boolean; onLogged: () => void };
const CACHE_PREFIX = 'atlas_mushaf_page_v3_';
const pageMemoryCache = new Map<number, MushafPage>();
const HIFZ_KEY = 'atlas_hifz_bookmark_v2';
const MURAJAAH_KEY = 'atlas_murajaah_bookmark_v2';
const clampPage = (value: number) => Math.max(1, Math.min(604, Number.isInteger(value) ? value : 1));
const arabicNumber = (value: number) => String(value).replace(/\d/g, digit => '٠١٢٣٤٥٦٧٨٩'[Number(digit)]);
const readBookmark = (key: string) => { try { const value = JSON.parse(localStorage.getItem(key) || '{}'); return { page: clampPage(Number(value.page) || 1), surah: Number(value.surah) || 1, ayah: Number(value.ayah) || 1 }; } catch { return { page: 1, surah: 1, ayah: 1 }; } };
function lagosDate() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
const reciters = [
  { id: 'ar.alafasy', label: 'Mishary Alafasy' },
  { id: 'ar.husary', label: 'Al-Husary' },
  { id: 'ar.minshawi', label: 'Al-Minshawi' },
  { id: 'ar.abdulbasitmurattal', label: 'Abdul Basit' }
];

export function QuranMushafReader({ settings, settingsReady, onLogged }: Props) {
  const [mode, setMode] = useState<'hifz' | 'murajaah'>('hifz');
  const [hifzMark, setHifzMark] = useState(() => readBookmark(HIFZ_KEY));
  const [murajaahMark, setMurajaahMark] = useState(() => readBookmark(MURAJAAH_KEY));
  const [page, setPage] = useState(() => readBookmark(HIFZ_KEY).page);
  const [pageData, setPageData] = useState<MushafPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [logging, setLogging] = useState(false);
  const [logMessage, setLogMessage] = useState('');
  const [fullScreen, setFullScreen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected, setSelected] = useState<{ surah: number; ayah: number } | null>(null);
  const [readingMode, setReadingMode] = useState<'translation' | 'reading'>('reading');
  const [fontSize, setFontSize] = useState(() => {
    try { const saved = Number(localStorage.getItem('atlas_mushaf_font_step_v1')); return [24, 26, 28, 30, 32].includes(saved) ? saved : 28; }
    catch { return 28; }
  });
  const [reciter, setReciter] = useState('ar.alafasy');
  const [pageInput, setPageInput] = useState(String(page));
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const readerRef = useRef<HTMLDivElement | null>(null);
  const selectedAyah = pageData?.ayahs.find(item => item.surahNumber === selected?.surah && item.numberInSurah === selected?.ayah) || null;
  const pageJuz = useMemo(() => pageData?.juz || getPageJuz(page) || 1, [pageData, page]);
  const bookmark = mode === 'hifz' ? hifzMark : murajaahMark;
  const fontSteps = [24, 26, 28, 30, 32];
  const changeFontSize = (direction: -1 | 1) => setFontSize(current => {
    const index = fontSteps.indexOf(current);
    const next = fontSteps[Math.max(0, Math.min(fontSteps.length - 1, (index < 0 ? 2 : index) + direction))];
    try { localStorage.setItem('atlas_mushaf_font_step_v1', String(next)); } catch { /* storage is optional */ }
    return next;
  });

  useEffect(() => {
    if (!fullScreen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [fullScreen]);

  useEffect(() => {
    if (!fullScreen) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') { setDrawerOpen(false); setFullScreen(false); } };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [fullScreen]);

  useEffect(() => {
    if (!settingsReady) return;
    const remoteMark = (raw: string | undefined, fallbackPage: number) => {
      try { const parsed = JSON.parse(raw || 'null'); if (parsed && typeof parsed === 'object') return { page: clampPage(Number(parsed.page) || fallbackPage), surah: Number(parsed.surah) || 1, ayah: Number(parsed.ayah) || 1 }; } catch { /* older page-only bookmark */ }
      return { page: clampPage(fallbackPage), surah: 1, ayah: 1 };
    };
    const remoteHifz = remoteMark(settings.hifz_bookmark, Number(settings.hifz_page) || 1);
    const remoteMurajaah = remoteMark(settings.murajaah_bookmark, Number(settings.murajaah_page) || 1);
    setHifzMark(current => current.page === 1 && current.ayah === 1 ? remoteHifz : current);
    setMurajaahMark(current => current.page === 1 && current.ayah === 1 ? remoteMurajaah : current);
  }, [settingsReady, settings.hifz_page, settings.murajaah_page, settings.hifz_bookmark, settings.murajaah_bookmark]);

  useEffect(() => {
    const mark = mode === 'hifz' ? hifzMark : murajaahMark;
    setPage(mark.page);
    setSelected(mark.surah && mark.ayah ? { surah: mark.surah, ayah: mark.ayah } : null);
  }, [mode]);

  useEffect(() => {
    const mark = mode === 'hifz' ? hifzMark : murajaahMark;
    const key = mode === 'hifz' ? HIFZ_KEY : MURAJAAH_KEY;
    try { localStorage.setItem(key, JSON.stringify(mark)); } catch { /* storage is optional */ }
    void api('/settings', json('PATCH', {
      [mode === 'hifz' ? 'hifz_page' : 'murajaah_page']: String(mark.page),
      [mode === 'hifz' ? 'hifz_bookmark' : 'murajaah_bookmark']: JSON.stringify(mark)
    })).catch(() => undefined);
  }, [mode, hifzMark, murajaahMark]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setPageError(''); setLogMessage(''); setPageData(null); setPageInput(String(page));
    const memory = pageMemoryCache.get(page);
    if (memory?.ayahs?.length) { setPageData(memory); setLoading(false); return () => { cancelled = true; }; }
    try {
      const cached = localStorage.getItem(CACHE_PREFIX + page);
      if (cached) {
        const parsed = JSON.parse(cached) as MushafPage;
        if (parsed?.ayahs?.length) { pageMemoryCache.set(page, parsed); setPageData(parsed); setLoading(false); return () => { cancelled = true; }; }
      }
    } catch { /* ignore unavailable or malformed browser cache */ }
    fetch('/api/quran/page/' + page)
      .then(async response => { const payload = await response.json(); if (!response.ok) throw new Error(payload?.error || 'The Mushaf page could not be loaded.'); return payload; })
      .then(payload => {
        const result = payload as MushafPage | undefined;
        if (!result?.ayahs?.length) throw new Error('No Qur’an text was returned for this page.');
        if (cancelled) return;
        pageMemoryCache.set(page, result); setPageData(result); setLoading(false);
        try { localStorage.setItem(CACHE_PREFIX + page, JSON.stringify(result)); } catch { /* retain memory cache */ }
      })
      .catch(error => { if (!cancelled) { setLoading(false); setPageError(error instanceof Error ? error.message : 'This page is unavailable offline.'); } });
    return () => { cancelled = true; };
  }, [page]);

  const updateBookmark = useCallback((nextPage: number, ayah?: MushafAyah | null) => {
    const current = mode === 'hifz' ? hifzMark : murajaahMark;
    const next = { page: clampPage(nextPage), surah: ayah?.surahNumber ?? current.surah, ayah: ayah?.numberInSurah ?? current.ayah };
    if (mode === 'hifz') setHifzMark(next); else setMurajaahMark(next);
  }, [mode, hifzMark, murajaahMark]);
  const changePage = (next: number) => { const value = clampPage(next); setPage(value); setSelected(null); updateBookmark(value, null); };
  const changeMode = (next: 'hifz' | 'murajaah') => { if (next !== mode) setMode(next); };
  const jumpSurah = (number: number) => { const item = QURAN_SURAHS[number - 1]; if (item) { changePage(item.pageStart); setSelected({ surah: number, ayah: 1 }); setDrawerOpen(false); } };
  const jumpJuz = (number: number) => { const start = QURAN_JUZ_STARTS[number - 1]; if (start) changePage(getAyahLocation(start[1], start[2])?.page || 1); };
  const selectAyah = (ayah: MushafAyah) => { setSelected({ surah: ayah.surahNumber, ayah: ayah.numberInSurah }); updateBookmark(page, ayah); };
  const playAyah = (ayah = selectedAyah) => {
    if (!ayah) return;
    const audio = audioRef.current;
    if (!audio) return;
    audio.src = `https://islamic.network/quran/audio/128/${reciter}/${ayah.number}.mp3`;
    audio.currentTime = 0;
    void audio.play().catch(() => undefined);
  };
  
  const copyAyah = async () => {
    if (!selectedAyah) return;
    const surah = QURAN_SURAHS[selectedAyah.surahNumber - 1];
    const text = `${selectedAyah.text}\n\n${surah.transliteration} ${selectedAyah.surahNumber}:${selectedAyah.numberInSurah}`;
    try { await navigator.clipboard.writeText(text); setLogMessage('Ayah copied.'); } catch { setLogMessage('Clipboard access is unavailable in this browser.'); }
  };
  const shareAyah = async () => {
    if (!selectedAyah) return;
    const surah = QURAN_SURAHS[selectedAyah.surahNumber - 1];
    const text = `${selectedAyah.text}\n\n${surah.transliteration} ${selectedAyah.number}:${selectedAyah.numberInSurah}`;
    try { if (navigator.share) await navigator.share({ title: 'Qur’an · ' + surah.transliteration, text }); else await navigator.clipboard.writeText(text); } catch { /* share sheet dismissed */ }
  };
  const logPage = async (event: MouseEvent<HTMLButtonElement>) => {
    if (!pageData?.ayahs?.length || logging) return;
    const buttonRect = event.currentTarget.getBoundingClientRect();
    setLogging(true); setLogMessage('');
    const first = pageData.ayahs[0], last = pageData.ayahs[pageData.ayahs.length - 1];
    const sameSurah = first.surahNumber === last.surahNumber;
    const label = sameSurah ? (QURAN_SURAHS[first.surahNumber - 1]?.transliteration || first.surahName) : `Page ${page} · ${first.surahName}–${last.surahName}`;
    try {
      await api('/deen/quran', json('POST', { log_date: lagosDate(), activity: mode === 'hifz' ? 'memorisation' : 'revision', surah: label, ayah_start: sameSurah ? first.numberInSurah : null, ayah_end: sameSurah ? last.numberInSurah : null, pages: 1, juz: pageData.juz, reflection: `Mushaf page ${page}: ${first.surahName} ${first.numberInSurah}–${last.surahName} ${last.numberInSurah}. Completed in ${mode === 'hifz' ? 'Hifz' : 'Muraja’ah'}.` }));
      triggerSparkBurst(buttonRect.left + buttonRect.width / 2, buttonRect.top + buttonRect.height / 2);
      setLogMessage('Page ' + page + ' logged successfully.'); onLogged();
    } catch (error) { setLogMessage(error instanceof Error ? error.message : 'Could not log this page.'); }
    finally { setLogging(false); }
  };
  const currentSurahNumber = pageData?.ayahs?.[0]?.surahNumber || bookmark.surah || 1;
  const currentSurah = QURAN_SURAHS[currentSurahNumber - 1];
  const readerContent = <>
    <header className="mushaf-fs-header">
      <div className="mushaf-fs-header-left">
        <button type="button" className="mushaf-fs-surah-trigger" aria-label="Open surah navigation" onClick={() => setDrawerOpen(true)}>
          <span>{currentSurahNumber}. {currentSurah?.transliteration || 'Al-Fatihah'} · Page {page}</span><span aria-hidden="true">▾</span>
        </button>
      </div>
      <div className="mushaf-fs-view-switch" role="group" aria-label="Qur’an reading mode">
        <button type="button" className={readingMode === 'translation' ? 'is-active' : ''} aria-pressed={readingMode === 'translation'} onClick={() => setReadingMode('translation')}>Translation</button>
        <button type="button" className={readingMode === 'reading' ? 'is-active' : ''} aria-pressed={readingMode === 'reading'} onClick={() => setReadingMode('reading')}>Reading</button>
      </div>
      <div className="mushaf-fs-header-right">
        <div className="mushaf-mode-switch mushaf-fs-bookmark-switch" role="group" aria-label="Bookmark mode">
          <button type="button" className={mode === 'hifz' ? 'is-active' : ''} aria-pressed={mode === 'hifz'} onClick={() => changeMode('hifz')}>Hifz</button>
          <button type="button" className={mode === 'murajaah' ? 'is-active' : ''} aria-pressed={mode === 'murajaah'} onClick={() => changeMode('murajaah')}>Muraja’ah</button>
        </div>
        <div className="mushaf-top-font"><button type="button" aria-label="Decrease Arabic font size" onClick={() => changeFontSize(-1)}>A-</button><button type="button" aria-label="Increase Arabic font size" onClick={() => changeFontSize(1)}>A+</button></div>
        <button type="button" className="mushaf-fs-close" aria-label="Close Mushaf" onClick={() => { setDrawerOpen(false); setFullScreen(false); }}><X size={18}/></button>
      </div>
    </header>
    <div className="mushaf-fs-stage mushaf-reading-layout">
      <main className="mushaf-fs-sheet mushaf-page-wrap" ref={readerRef}>
        {loading && <p className="mushaf-loading" role="status">Loading Mushaf page {page}…</p>}
        {!loading && pageError && <div className="mushaf-error" role="alert"><WifiOff size={24}/><p>{pageError}</p><button type="button" onClick={() => changePage(page)}>Retry page</button></div>}
        {!loading && pageData && readingMode === 'reading' && <div className={`mushaf-ayah-flow mushaf-fs-arabic mushaf-fs-arabic--${fontSize}`} dir="rtl" lang="ar">
          {pageData.ayahs.map((ayah, index) => {
            const beginsSurah = index === 0 || pageData.ayahs[index - 1].surahNumber !== ayah.surahNumber;
            return <Fragment key={ayah.surahNumber + ':' + ayah.numberInSurah}>
              {beginsSurah && <div className="mushaf-surah-banner"><span className="mushaf-surah-ornament">۞</span><b>{ayah.arabicName}</b><small>{ayah.surahName}</small><span className="mushaf-surah-ornament">۞</span></div>}
              {beginsSurah && ayah.surahNumber !== 9 && ayah.numberInSurah === 1 && <div className="mushaf-bismillah" lang="ar">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>}
              <button type="button" className={'mushaf-ayah ' + (selected?.surah === ayah.surahNumber && selected?.ayah === ayah.numberInSurah ? 'is-selected' : '')} onClick={() => selectAyah(ayah)} aria-pressed={selected?.surah === ayah.surahNumber && selected?.ayah === ayah.numberInSurah}>
                {ayah.text}<span className="mushaf-ayah-number" aria-label={`Ayah ${ayah.numberInSurah}`}>﴿{arabicNumber(ayah.numberInSurah)}﴾</span>
              </button>
            </Fragment>;
          })}
        </div>}
        {!loading && pageData && readingMode === 'translation' && <div className={`mushaf-fs-verse-list mushaf-fs-arabic mushaf-fs-arabic--${fontSize}`} dir="ltr" lang="en">
          {pageData.ayahs.map((ayah, index) => {
            const beginsSurah = index === 0 || pageData.ayahs[index - 1].surahNumber !== ayah.surahNumber;
            const isSelected = selected?.surah === ayah.surahNumber && selected?.ayah === ayah.numberInSurah;
            return <article className="mushaf-fs-verse-row" key={ayah.surahNumber + ':' + ayah.numberInSurah}>
              {beginsSurah && <div className="mushaf-surah-banner mushaf-fs-verse-surah"><span className="mushaf-surah-ornament">۞</span><b>{ayah.arabicName}</b><small>{ayah.surahName}</small><span className="mushaf-surah-ornament">۞</span></div>}
              {beginsSurah && ayah.surahNumber !== 9 && ayah.numberInSurah === 1 && <div className="mushaf-bismillah mushaf-fs-verse-bismillah" lang="ar" dir="rtl">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>}
              <div className="mushaf-fs-verse-arabic-line" dir="rtl" lang="ar">
                <div className="mushaf-fs-verse-actions"><small>{ayah.surahNumber}:{ayah.numberInSurah}</small><button type="button" aria-label={`Play ${ayah.surahNumber}:${ayah.numberInSurah}`} onClick={() => { selectAyah(ayah); playAyah(ayah); }}><Play size={14}/></button></div>
                <button type="button" className={'mushaf-fs-verse-arabic ' + (isSelected ? 'is-selected' : '')} onClick={() => selectAyah(ayah)} aria-pressed={isSelected}>
                  {ayah.text}<span className="mushaf-ayah-number" aria-label={`Ayah ${ayah.numberInSurah}`}>﴿{arabicNumber(ayah.numberInSurah)}﴾</span>
                </button>
              </div>
              <div className="mushaf-fs-verse-translation" dir="ltr" lang="en">
                <span>{ayah.translation || 'Translation unavailable for this verse.'}</span>
                <small>{ayah.surahNumber}:{ayah.numberInSurah}</small>
              </div>
            </article>;
          })}
        </div>}
      </main>
      {drawerOpen && <><button type="button" className="mushaf-drawer-scrim" aria-label="Close surah navigation" onClick={() => setDrawerOpen(false)}/><aside className="mushaf-surah-drawer" aria-label="114 Surahs"><header><div><b>Surah index</b><small>114 chapters · Madani Mushaf</small></div><button type="button" aria-label="Close surah index" onClick={() => setDrawerOpen(false)}><X size={18}/></button></header><div className="mushaf-drawer-jumps"><label>Page <input type="number" min="1" max="604" value={pageInput} onChange={event => setPageInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { changePage(Number(pageInput) || page); setDrawerOpen(false); } }}/></label><label>Juz <select defaultValue={pageJuz} onChange={event => { jumpJuz(Number(event.target.value)); setDrawerOpen(false); }}>{Array.from({length:30},(_,i)=><option key={i+1} value={i+1}>Juz {i+1}</option>)}</select></label></div><div className="mushaf-surah-list">{QURAN_SURAHS.map(item => <button type="button" key={item.number} className={page >= item.pageStart && page <= item.pageEnd ? 'is-current' : ''} onClick={() => jumpSurah(item.number)}><span className="mushaf-surah-number">{item.number}</span><span className="mushaf-surah-names"><b>{item.transliteration}</b><small>{item.english} · {item.ayahs} ayahs · p.{item.pageStart}</small></span><strong lang="ar" dir="rtl">{item.arabic}</strong></button>)}</div></aside></>}
    </div>
    <footer className="mushaf-fs-footer">
      <div className="mushaf-fs-page-pill">
        <button type="button" className="mushaf-fs-page-nav" disabled={page <= 1} onClick={() => changePage(page - 1)}><ChevronLeft size={16}/> Previous Page</button>
        <button type="button" className="mushaf-fs-log-page" disabled={!pageData?.ayahs?.length || loading || logging} onClick={logPage}>Page {page} / 604 · {logging ? 'Logging…' : 'Log Page'}</button>
        <button type="button" className="mushaf-fs-page-nav" disabled={page >= 604} onClick={() => changePage(page + 1)}>Next Page <ChevronRight size={16}/></button>
      </div>
      <span className="mushaf-log-message" role="status">{logMessage}</span>
    </footer>
    <audio ref={audioRef} />
  </>;
  return <>
    <section className="mushaf-launch-card"><div><h3>Qur’an reading & memorisation</h3><p>Continue at your saved {mode === 'hifz' ? 'Hifz' : 'Muraja’ah'} position, or open the full-screen reader.</p><small>Hifz · page {hifzMark.page} &nbsp; / &nbsp; Muraja’ah · page {murajaahMark.page}</small></div><button type="button" className="button button--primary" onClick={() => setFullScreen(true)}><Maximize2 size={16}/> Open Full-Screen Mushaf</button></section>
    <style>{mushafStyles}</style>
    {fullScreen && createPortal(<div className="mushaf-fs-overlay" role="dialog" aria-modal="true" aria-label="Full-screen Qur’an Mushaf">{readerContent}</div>, document.body)}
  </>;
}

const mushafStyles = `
.mushaf-launch-card{display:flex;align-items:center;justify-content:space-between;gap:18px;flex-wrap:wrap;padding:20px;border:1px solid var(--border-subtle,rgba(255,255,255,.12));border-radius:16px;background:var(--surface-card,rgba(255,255,255,.035))}
.mushaf-launch-card h3{margin:5px 0;font-size:18px}.mushaf-launch-card p{margin:4px 0 8px;color:var(--text-muted);font-size:13px}.mushaf-launch-card small{color:var(--text-muted);font-size:11px}
.mushaf-fullscreen{position:fixed;inset:0;width:100vw;height:100dvh;z-index:9999;background:var(--bg-canvas);color:var(--text-primary);display:flex;flex-direction:column;overflow:hidden;font-family:Inter,system-ui,sans-serif}
.mushaf-toolbar{height:48px;min-height:48px;flex:0 0 48px;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 14px;border-bottom:1px solid var(--border-hairline);background:var(--bg-surface);white-space:nowrap;overflow-x:auto;overflow-y:hidden;scrollbar-width:none}.mushaf-toolbar::-webkit-scrollbar{display:none}
.mushaf-toolbar__left,.mushaf-toolbar__right{display:flex;align-items:center;gap:8px;min-width:0;flex:0 0 auto}.mushaf-toolbar__identity{min-width:0}.mushaf-toolbar__identity b{font-size:11px;font-weight:600;white-space:nowrap}.mushaf-toolbar__identity span{color:var(--text-muted);padding:0 2px}
.mushaf-toolbar button,.mushaf-page-control,.mushaf-audio-controls button{display:inline-flex;align-items:center;justify-content:center;gap:5px;border:1px solid var(--border-hairline);border-radius:8px;background:var(--bg-elevated);color:var(--text-primary);padding:6px 9px;font:inherit;font-size:11px;cursor:pointer;white-space:nowrap;flex:0 0 auto}
.mushaf-mode-switch{display:flex;align-items:center;gap:2px;padding:2px;border:1px solid var(--border-hairline);border-radius:999px;background:var(--bg-canvas);flex:0 0 auto}.mushaf-mode-switch button{border:0;border-radius:999px;background:transparent;padding:5px 10px}.mushaf-mode-switch button.is-active{background:var(--bg-elevated);box-shadow:0 1px 4px rgba(0,0,0,.12);font-weight:650}
.mushaf-top-font{display:flex;gap:3px}.mushaf-top-font button{padding:6px 8px}.mushaf-meaning-toggle.is-active{border-color:var(--accent,#b69b63);background:var(--bg-elevated)}.mushaf-exit-button{background:transparent}
.mushaf-reading-layout{position:relative;min-height:0;flex:1;overflow-y:auto;padding:12px 16px;overscroll-behavior:contain;display:flex;align-items:flex-start;justify-content:center}
.mushaf-page-wrap{max-width:620px;width:100%;min-height:0;margin:0 auto;padding:18px 22px;border-radius:14px;background:var(--bg-surface);border:1px solid var(--border-hairline);box-shadow:0 8px 28px rgba(0,0,0,.06);color:var(--text-primary)}
.mushaf-page-heading{display:flex;justify-content:space-between;gap:12px;padding-bottom:7px;border-bottom:1px solid var(--border-hairline);font-size:9px;letter-spacing:.09em;color:var(--text-muted)}
.mushaf-ayah-flow{padding:8px 0;text-align:justify;text-align-last:center;font-family:"KFGQPC Uthmanic Script HAFS","Amiri Quran","Noto Naskh Arabic",serif;line-height:1.85;color:var(--text-primary)}
.mushaf-ayah-unit{display:inline}.mushaf-surah-banner{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;margin:10px 0 5px;padding:6px 14px;border:1px solid var(--border-hairline);border-radius:8px;background:var(--bg-elevated);text-align:center}.mushaf-surah-banner b{font-size:16px;font-weight:500}.mushaf-surah-banner small{font:10px Inter,system-ui,sans-serif;color:var(--text-muted)}.mushaf-surah-ornament{color:var(--accent,#b69b63);font-size:13px}
.mushaf-bismillah{width:100%;margin:6px 0 10px;text-align:center;font:18px/1.6 "Amiri Quran","Noto Naskh Arabic",serif;color:var(--text-primary)}
.mushaf-ayah{display:inline;border:0;border-radius:6px;background:transparent;color:inherit;font:inherit;line-height:inherit;cursor:pointer;padding:0 1px}.mushaf-ayah.is-selected{background:color-mix(in srgb,var(--accent,#b69b63) 18%,transparent);box-shadow:0 0 0 2px color-mix(in srgb,var(--accent,#b69b63) 16%,transparent)}
.mushaf-ayah-number{display:inline-flex;align-items:center;justify-content:center;min-width:1.45em;height:1.45em;margin:0 .06em;border:1px solid color-mix(in srgb,var(--accent,#b69b63) 55%,var(--border-hairline));border-radius:50%;font-size:.55em;line-height:1;color:var(--accent,#a58a54);white-space:nowrap;vertical-align:middle}
.mushaf-translation{display:block;margin:2px auto 10px;max-width:590px;text-align:left;direction:ltr;font:12px/1.55 Inter,system-ui,sans-serif;color:var(--text-muted)}
.mushaf-loading,.mushaf-error{padding:30px;text-align:center;color:var(--text-muted)}.mushaf-error button{padding:8px 11px;border:1px solid var(--border-hairline);border-radius:8px;background:var(--bg-elevated);color:var(--text-primary)}
.mushaf-bottom-bar{height:54px;min-height:54px;flex:0 0 54px;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 14px calc(env(safe-area-inset-bottom,0px));border-top:1px solid var(--border-hairline);background:var(--bg-surface);white-space:nowrap;overflow-x:auto;overflow-y:hidden;scrollbar-width:none}.mushaf-bottom-bar::-webkit-scrollbar{display:none}
.mushaf-page-control{background:transparent}.mushaf-page-control:disabled{opacity:.35;cursor:not-allowed}.mushaf-audio-controls{display:flex;align-items:center;justify-content:center;gap:6px;min-width:0;flex:0 0 auto}.mushaf-selected-ref{font-size:10px;color:var(--text-muted);white-space:nowrap}.mushaf-audio-controls button{padding:6px 8px}.mushaf-audio-controls button.is-active{background:var(--bg-elevated);border-color:var(--accent,#b69b63)}.mushaf-reciter{display:flex;align-items:center;gap:4px;white-space:nowrap}.mushaf-reciter select{max-width:125px;padding:6px;border:1px solid var(--border-hairline);border-radius:7px;background:var(--bg-canvas);color:var(--text-primary);font:10px Inter,system-ui,sans-serif}.mushaf-bottom-hint,.mushaf-log-message{font-size:9px;color:var(--text-muted)}.mushaf-complete-button{white-space:nowrap}.mushaf-bottom-bar .button{padding:7px 10px;font-size:10px}
.mushaf-drawer-scrim{position:fixed;inset:48px 0 0;z-index:10000;border:0;background:rgba(0,0,0,.52)}.mushaf-surah-drawer{position:fixed;z-index:10001;top:48px;bottom:0;left:0;width:min(350px,88vw);display:flex;flex-direction:column;background:var(--bg-surface);color:var(--text-primary);border-right:1px solid var(--border-hairline);box-shadow:15px 0 55px rgba(0,0,0,.25)}
.mushaf-surah-drawer header{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--border-hairline)}.mushaf-surah-drawer header div{display:grid;gap:3px}.mushaf-surah-drawer header b{font-size:13px}.mushaf-surah-drawer header small{font-size:10px;color:var(--text-muted)}.mushaf-surah-drawer header button{border:0;background:transparent;color:inherit}
.mushaf-drawer-jumps{display:flex;gap:10px;padding:10px 14px;border-bottom:1px solid var(--border-hairline)}.mushaf-drawer-jumps label{display:flex;align-items:center;gap:6px;color:var(--text-muted);font-size:10px}.mushaf-drawer-jumps input,.mushaf-drawer-jumps select{width:72px;padding:7px;border:1px solid var(--border-hairline);border-radius:7px;background:var(--bg-canvas);color:var(--text-primary);font:inherit}.mushaf-surah-list{overflow:auto;padding:7px}.mushaf-surah-list>button{width:100%;display:flex;align-items:center;gap:9px;padding:9px;border:0;border-radius:8px;background:transparent;color:var(--text-primary);text-align:left;cursor:pointer}.mushaf-surah-list>button.is-current,.mushaf-surah-list>button:hover{background:var(--bg-elevated)}.mushaf-surah-number{width:26px;height:26px;display:grid;place-items:center;border:1px solid var(--border-hairline);border-radius:7px;font-size:9px}.mushaf-surah-names{display:grid;gap:2px;flex:1}.mushaf-surah-names b{font-size:10px}.mushaf-surah-names small{font-size:9px;color:var(--text-muted)}.mushaf-surah-list strong{font:18px/1.2 "Amiri Quran","Noto Naskh Arabic",serif}
@media(max-width:600px){
 .mushaf-toolbar{padding:0 6px;gap:5px}.mushaf-toolbar__left,.mushaf-toolbar__right{gap:4px}.mushaf-toolbar__identity b{font-size:8px}.mushaf-toolbar button{padding:5px 6px;font-size:9px}.mushaf-toolbar button svg{width:13px;height:13px}.mushaf-mode-switch button{padding:5px 7px;font-size:9px}.mushaf-top-font button{padding:5px 6px}
 .mushaf-reading-layout{padding:6px 5px}.mushaf-page-wrap{padding:14px 12px;border-radius:10px}.mushaf-page-heading{font-size:8px}.mushaf-ayah-flow{padding:5px 0;line-height:1.85}.mushaf-surah-banner{margin:7px 0 3px;padding:5px 8px}.mushaf-surah-banner b{font-size:15px}.mushaf-bismillah{font-size:17px;margin:5px 0 7px}
 .mushaf-bottom-bar{padding:0 6px calc(env(safe-area-inset-bottom,0px));gap:5px}.mushaf-bottom-bar button{padding:5px 6px;font-size:9px;gap:3px}.mushaf-bottom-bar button svg{width:12px;height:12px}.mushaf-audio-controls{gap:4px}.mushaf-selected-ref,.mushaf-bottom-hint,.mushaf-log-message{display:none}.mushaf-reciter select{max-width:78px;font-size:9px;padding:5px 3px}.mushaf-audio-controls button{padding:5px 6px;font-size:9px}.mushaf-complete-button{font-size:9px!important}
 .mushaf-surah-drawer{top:0;width:min(330px,92vw)}.mushaf-drawer-scrim{inset:0}
}
/* Isolated Full-Screen Mushaf system. Keep this block last to defeat legacy reader styles. */
.mushaf-fs-arabic--17 .mushaf-fs-verse-arabic{font-size:17px}
.mushaf-fs-arabic--19 .mushaf-fs-verse-arabic{font-size:19px}
.mushaf-fs-arabic--21 .mushaf-fs-verse-arabic{font-size:21px}
.mushaf-fs-arabic--25 .mushaf-fs-verse-arabic{font-size:25px}
.mushaf-fs-arabic--29 .mushaf-fs-verse-arabic{font-size:29px}
.mushaf-fs-verse-arabic-line{direction:ltr}
.mushaf-fs-verse-arabic{direction:rtl;text-align:right}

.mushaf-fs-overlay{position:fixed;inset:0;width:100vw;height:100dvh;z-index:9999;background:var(--bg-canvas);display:grid;grid-template-rows:52px minmax(0,1fr) 60px;overflow:hidden;box-sizing:border-box;font-family:"DM Sans",system-ui,sans-serif}
.mushaf-fs-overlay *{box-sizing:border-box}
.mushaf-fs-header{width:100%;max-width:720px;margin:0 auto;height:52px;min-height:52px;padding:0 12px;display:flex;align-items:center;justify-content:center;gap:12px;border-bottom:1px solid var(--border-hairline);background:var(--bg-surface);white-space:nowrap;overflow-x:auto;overflow-y:hidden;scrollbar-width:none}
.mushaf-fs-header::-webkit-scrollbar,.mushaf-fs-footer::-webkit-scrollbar{display:none}
.mushaf-fs-controls{display:flex;align-items:center;justify-content:center;gap:7px;flex:0 0 auto;white-space:nowrap}
.mushaf-fs-header button{height:32px;min-height:32px;padding:0 9px;border:1px solid var(--border-hairline);border-radius:8px;background:var(--bg-elevated);color:var(--text-primary);font:600 11px/1 "DM Sans",sans-serif;white-space:nowrap;flex:0 0 auto}
.mushaf-fs-header .mushaf-mode-switch{height:32px;padding:2px;gap:2px;border-radius:999px;flex:0 0 auto}
.mushaf-fs-header .mushaf-mode-switch button{height:26px;min-height:26px;padding:0 9px;border:0;border-radius:999px}
.mushaf-fs-view-switch{display:flex;align-items:center;gap:2px;padding:3px;border:1px solid var(--border-hairline);border-radius:999px;background:var(--bg-canvas);flex:0 0 auto}
.mushaf-fs-view-switch button{height:28px;min-height:28px;padding:0 12px;border:0;border-radius:999px;background:transparent;color:var(--text-muted);font:600 11px/1 "DM Sans",sans-serif;white-space:nowrap}
.mushaf-fs-view-switch button.is-active{background:var(--bg-elevated);color:var(--text-primary);box-shadow:0 1px 4px rgba(0,0,0,.14)}
.mushaf-fs-stage{width:100%;height:100%;min-height:0;overflow-y:auto;overflow-x:hidden;display:grid;place-items:center;padding:14px 16px;box-sizing:border-box;overscroll-behavior:contain}
.mushaf-fs-sheet{width:100%;max-width:560px;margin:0 auto;padding:20px 24px;border-radius:16px;background:var(--bg-surface);border:1px solid var(--border-hairline);box-shadow:0 12px 40px rgba(0,0,0,.16);text-align:center;box-sizing:border-box;color:var(--text-primary)}
.mushaf-fs-sheet .mushaf-page-heading{display:flex;justify-content:center;gap:8px;text-align:center;font-size:12px;color:var(--text-muted);margin-bottom:10px;border:0;letter-spacing:0}
.mushaf-fs-sheet .mushaf-page-heading span+span:before{content:"·";margin-right:8px}
.mushaf-fs-arabic,.mushaf-fs-verse-arabic{font-family:"Amiri Quran","Scheherazade New","Traditional Arabic",Amiri,serif;font-weight:400}
.mushaf-fs-sheet .mushaf-ayah-flow{display:block;width:100%;max-width:560px;margin:0 auto;padding:0;direction:rtl;text-align:justify;text-align-last:center;line-height:2.1;font-family:"Amiri Quran","Scheherazade New","Traditional Arabic",Amiri,serif}
.mushaf-fs-sheet .mushaf-ayah-unit{display:inline}
.mushaf-fs-sheet .mushaf-surah-banner{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;text-align:center;margin:12px auto 7px;padding:7px 14px}
.mushaf-fs-sheet .mushaf-bismillah{display:block;width:100%;text-align:center;margin:7px 0 12px;font-family:"Amiri Quran","Scheherazade New","Traditional Arabic",Amiri,serif}
.mushaf-fs-sheet .mushaf-ayah{font-family:inherit;font-size:inherit;line-height:inherit}
.mushaf-fs-sheet .mushaf-ayah-number{font-family:inherit}
.mushaf-fs-verse-list{width:100%;max-width:720px;margin:0 auto;text-align:left}
.mushaf-fs-verse-row{width:100%;padding:18px 0;border-bottom:1px solid var(--border-hairline)}
.mushaf-fs-verse-surah{display:flex;margin:0 auto 12px}
.mushaf-fs-verse-bismillah{margin:0 auto 12px}
.mushaf-fs-verse-arabic-line{display:flex;flex-direction:row;align-items:center;gap:14px;width:100%;direction:rtl}
.mushaf-fs-verse-actions{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;flex:0 0 34px;direction:ltr}
.mushaf-fs-verse-actions button{width:30px;height:30px;display:grid;place-items:center;padding:0;border:1px solid var(--border-hairline);border-radius:50%;background:var(--bg-elevated);color:var(--text-muted)}
.mushaf-fs-verse-arabic{display:block;flex:1;min-width:0;padding:0;border:0;background:transparent;color:var(--text-primary);font-size:var(--mushaf-font-size,21px);line-height:2;text-align:right;direction:rtl;cursor:pointer}
.mushaf-fs-verse-arabic.is-selected{background:color-mix(in srgb,var(--accent,#b69b63) 12%,transparent);border-radius:8px}
.mushaf-fs-verse-translation{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-top:10px;direction:ltr;text-align:left;font:400 15px/1.65 "DM Sans",sans-serif;color:var(--text-secondary,var(--text-muted))}
.mushaf-fs-verse-translation small{flex:0 0 auto;padding:3px 7px;border-radius:6px;background:var(--bg-elevated);color:var(--text-muted);font:500 10px/1.4 "DM Sans",sans-serif}
.mushaf-fs-footer{width:100%;max-width:720px;margin:0 auto;height:60px;min-height:60px;padding:0 16px env(safe-area-inset-bottom);display:flex;align-items:center;justify-content:center;gap:10px;border-top:1px solid var(--border-hairline);background:var(--bg-surface);box-sizing:border-box;white-space:nowrap;overflow-x:auto;overflow-y:hidden;scrollbar-width:none}
.mushaf-fs-footer button{height:36px;min-height:36px;padding:0 12px;border-radius:8px;white-space:nowrap;flex:0 0 auto}
.mushaf-fs-footer .mushaf-complete-button{background:var(--accent,#b69b63);color:#111;border-color:transparent}
.mushaf-fs-sheet .mushaf-loading,.mushaf-fs-sheet .mushaf-error{font-family:"DM Sans",sans-serif}
@media(max-width:600px){
 .mushaf-fs-header{justify-content:center;gap:4px;padding:0 4px}
 .mushaf-fs-controls{gap:3px}
 .mushaf-fs-header button{padding:0 5px;font-size:9px}
 .mushaf-fs-header .mushaf-mode-switch button{padding:0 5px;font-size:8px}
 .mushaf-fs-view-switch button{padding:0 6px;font-size:9px}
 .mushaf-fs-stage{padding:8px 6px;place-items:center}
 .mushaf-fs-sheet{padding:15px 12px;border-radius:12px}
 .mushaf-fs-verse-row{padding:15px 0}
 .mushaf-fs-verse-arabic-line{gap:8px}
 .mushaf-fs-verse-actions{flex-basis:28px}
 .mushaf-fs-verse-actions button{width:27px;height:27px}
 .mushaf-fs-verse-translation{font-size:14px}
 .mushaf-fs-footer{padding-left:6px;padding-right:6px;gap:6px}
 .mushaf-fs-footer button{padding:0 8px;font-size:10px}
}

/* Spacious Quran.com-inspired full-screen canvas and controls. */
.mushaf-fs-overlay{grid-template-rows:56px minmax(0,1fr) 76px;background:var(--bg-canvas)}
.mushaf-fs-header{height:56px;min-height:56px;width:100%;max-width:900px;padding:0 20px;margin:0 auto;display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);gap:18px;justify-content:stretch;border:0;background:var(--bg-canvas);overflow:visible}
.mushaf-fs-header-left{justify-self:start;min-width:0}
.mushaf-fs-header-right{justify-self:end;display:flex;align-items:center;gap:12px;min-width:0}
.mushaf-fs-surah-trigger{height:38px!important;max-width:100%;padding:0 10px!important;display:flex;align-items:center;gap:8px;border:0!important;background:transparent!important;color:var(--text-primary)!important;font:600 13px/1.2 "DM Sans",sans-serif!important}
.mushaf-fs-view-switch{justify-self:center;padding:4px;gap:3px;border:0;border-radius:999px;background:var(--bg-elevated)}
.mushaf-fs-view-switch button{height:34px;min-height:34px;padding:0 18px;font-size:12px;border-radius:999px}
.mushaf-fs-view-switch button.is-active{background:var(--bg-canvas);box-shadow:0 1px 5px rgba(0,0,0,.12)}
.mushaf-fs-header-right .mushaf-mode-switch{padding:3px;border:0;background:var(--bg-elevated)}
.mushaf-fs-header-right .mushaf-mode-switch button{height:30px;min-height:30px;padding:0 10px;border:0;background:transparent;font-size:11px}
.mushaf-fs-header-right .mushaf-mode-switch button.is-active{background:var(--bg-canvas);box-shadow:0 1px 5px rgba(0,0,0,.12)}
.mushaf-fs-header-right .mushaf-top-font{display:flex;align-items:center;gap:3px}
.mushaf-fs-header-right .mushaf-top-font button{height:32px;min-height:32px;padding:0 7px;border:0;background:transparent;font-size:12px}
.mushaf-fs-close{width:34px;height:34px!important;min-height:34px!important;display:grid;place-items:center;padding:0!important;border:0!important;border-radius:50%!important;background:var(--bg-elevated)!important;color:var(--text-primary)!important}
.mushaf-fs-stage{width:100%;height:100%;min-height:0;display:block;overflow-y:auto;padding:0;place-items:unset}
.mushaf-fs-sheet{width:100%;max-width:700px;min-height:100%;margin:0 auto;padding:32px 24px 96px;border:0;border-radius:0;background:var(--bg-canvas);box-shadow:none;text-align:center}
.mushaf-fs-sheet .mushaf-ayah-flow{width:100%;max-width:none;padding:0;margin:0;direction:rtl;text-align:justify;text-align-last:center;font-family:"Amiri Quran","Scheherazade New",serif;font-size:28px;line-height:2.35;color:var(--text-primary)}
.mushaf-fs-sheet .mushaf-ayah{display:inline;padding:0;border:0;background:transparent;font:inherit;line-height:inherit}
.mushaf-fs-sheet .mushaf-ayah-number{display:inline-flex;margin:0 .12em;color:var(--accent,#b69b63);border-color:color-mix(in srgb,var(--accent,#b69b63) 60%,transparent);font-size:.52em}
.mushaf-fs-sheet .mushaf-surah-banner{display:flex;gap:12px;margin:0 auto 16px;padding:12px 14px;border:0;border-radius:0;background:transparent}
.mushaf-fs-sheet .mushaf-surah-banner b{font:28px/1.5 "Amiri Quran","Scheherazade New",serif}
.mushaf-fs-sheet .mushaf-surah-banner small{font:11px "DM Sans",sans-serif}
.mushaf-fs-sheet .mushaf-bismillah{margin:8px 0 18px;font:26px/1.8 "Amiri Quran","Scheherazade New",serif}
.mushaf-fs-verse-list{width:100%;max-width:700px;margin:0 auto;text-align:left}
.mushaf-fs-verse-row{padding:24px 0;border-bottom:1px solid var(--border-hairline)}
.mushaf-fs-verse-arabic-line{display:flex;flex-direction:row;align-items:center;gap:20px;width:100%;direction:ltr}
.mushaf-fs-verse-actions{display:flex;flex-direction:row;align-items:center;justify-content:flex-start;gap:10px;flex:0 0 auto;direction:ltr}
.mushaf-fs-verse-actions small{color:var(--text-muted);font:500 11px/1.4 "DM Sans",sans-serif}
.mushaf-fs-verse-actions button{width:30px;height:30px;display:grid;place-items:center;padding:0;border:0;border-radius:50%;background:transparent;color:var(--text-muted)}
.mushaf-fs-verse-arabic{display:block;flex:1;min-width:0;padding:0;border:0;background:transparent;color:var(--text-primary);font:28px/2.3 "Amiri Quran","Scheherazade New",serif;text-align:right;direction:rtl;cursor:pointer}
.mushaf-fs-verse-arabic .mushaf-ayah-number{color:var(--accent,#b69b63)}
.mushaf-fs-verse-translation{display:block;margin-top:14px;text-align:left;direction:ltr;font:400 16px/1.7 "DM Sans",sans-serif;color:var(--text-secondary,var(--text-muted))}
.mushaf-fs-verse-translation small{display:block;margin-top:5px;padding:0;background:transparent;font:500 10px/1.4 "DM Sans",sans-serif;color:var(--text-muted)}
.mushaf-fs-footer{position:relative;width:100%;max-width:900px;height:76px;min-height:76px;margin:0 auto;padding:0 16px;display:flex;align-items:center;justify-content:center;border:0;background:var(--bg-canvas);overflow:visible}
.mushaf-fs-page-pill{display:flex;align-items:center;justify-content:center;gap:12px;padding:7px 10px;border:1px solid var(--border-hairline);border-radius:999px;background:var(--bg-surface);box-shadow:0 5px 22px rgba(0,0,0,.08)}
.mushaf-fs-page-pill button{height:38px;min-height:38px;padding:0 13px;border:0;border-radius:999px;background:transparent;color:var(--text-primary);font:500 12px/1 "DM Sans",sans-serif;white-space:nowrap}
.mushaf-fs-page-pill .mushaf-fs-log-page{background:var(--bg-elevated);font-weight:600}
.mushaf-fs-page-pill button:disabled{opacity:.35}
.mushaf-fs-footer>.mushaf-log-message{position:absolute;bottom:2px;left:0;right:0;text-align:center;font-size:10px}
.mushaf-fs-arabic--24 .mushaf-fs-verse-arabic{font-size:24px}
.mushaf-fs-arabic--26 .mushaf-fs-verse-arabic{font-size:26px}
.mushaf-fs-arabic--28 .mushaf-fs-verse-arabic{font-size:28px}
.mushaf-fs-arabic--30 .mushaf-fs-verse-arabic{font-size:30px}
.mushaf-fs-arabic--32 .mushaf-fs-verse-arabic{font-size:32px}
@media(max-width:700px){
 .mushaf-fs-header{padding:0 10px;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);gap:5px}
 .mushaf-fs-surah-trigger{font-size:10px!important;padding:0 4px!important;gap:3px}
 .mushaf-fs-header-right{gap:4px}
 .mushaf-fs-header-right .mushaf-mode-switch button{padding:0 6px;font-size:9px}
 .mushaf-fs-header-right .mushaf-top-font button{padding:0 4px;font-size:10px}
 .mushaf-fs-view-switch{padding:3px;gap:1px}
 .mushaf-fs-view-switch button{padding:0 8px;font-size:10px}
 .mushaf-fs-close{width:28px;height:28px!important;min-height:28px!important}
 .mushaf-fs-sheet{padding:24px 18px 72px}
 .mushaf-fs-sheet .mushaf-ayah-flow{font-size:28px;line-height:2.25}
 .mushaf-fs-verse-row{padding:22px 0}
 .mushaf-fs-verse-arabic-line{gap:8px}
 .mushaf-fs-verse-actions{gap:5px}
 .mushaf-fs-verse-arabic{font-size:26px;line-height:2.2}
 .mushaf-fs-verse-translation{font-size:15px}
 .mushaf-fs-page-pill{gap:2px;padding:5px}
 .mushaf-fs-page-pill button{padding:0 8px;font-size:10px}
}
@media(max-width:390px){
 .mushaf-fs-header{padding:0 5px;gap:2px}
 .mushaf-fs-surah-trigger{font-size:9px!important}
 .mushaf-fs-header-right{gap:2px}
 .mushaf-fs-header-right .mushaf-mode-switch button{padding:0 4px;font-size:8px}
 .mushaf-fs-view-switch button{padding:0 6px;font-size:9px}
 .mushaf-fs-sheet{padding-left:14px;padding-right:14px}
 .mushaf-fs-page-pill button{padding:0 6px;font-size:9px}
}

`;