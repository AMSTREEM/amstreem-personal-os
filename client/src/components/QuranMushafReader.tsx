import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, BookOpen, Check, ChevronLeft, ChevronRight, Copy, Headphones, Maximize2, Menu, Pause, Play, Repeat, Share2, WifiOff, X } from 'lucide-react';
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
  const [showTranslation, setShowTranslation] = useState(false);
  const [fontSize, setFontSize] = useState(() => {
    try { const saved = Number(localStorage.getItem('atlas_mushaf_font_step_v1')); return [17, 19, 21, 25, 29].includes(saved) ? saved : 21; }
    catch { return 21; }
  });
  const [reciter, setReciter] = useState('ar.alafasy');
  const [repeatMode, setRepeatMode] = useState<'off' | 'ayah' | 'page'>('off');
  const [playing, setPlaying] = useState(false);
  const [pageInput, setPageInput] = useState(String(page));
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const readerRef = useRef<HTMLDivElement | null>(null);
  const selectedAyah = pageData?.ayahs.find(item => item.surahNumber === selected?.surah && item.numberInSurah === selected?.ayah) || null;
  const pageJuz = useMemo(() => pageData?.juz || getPageJuz(page) || 1, [pageData, page]);
  const bookmark = mode === 'hifz' ? hifzMark : murajaahMark;
  const fontSteps = [17, 19, 21, 25, 29];
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
    void audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  };
  const togglePlay = () => { if (playing) { audioRef.current?.pause(); setPlaying(false); } else playAyah(); };
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
    setLogging(true); setLogMessage('');
    const first = pageData.ayahs[0], last = pageData.ayahs[pageData.ayahs.length - 1];
    const sameSurah = first.surahNumber === last.surahNumber;
    const label = sameSurah ? (QURAN_SURAHS[first.surahNumber - 1]?.transliteration || first.surahName) : `Page ${page} · ${first.surahName}–${last.surahName}`;
    try {
      await api('/deen/quran', json('POST', { log_date: lagosDate(), activity: mode === 'hifz' ? 'memorisation' : 'revision', surah: label, ayah_start: sameSurah ? first.numberInSurah : null, ayah_end: sameSurah ? last.numberInSurah : null, pages: 1, juz: pageData.juz, reflection: `Mushaf page ${page}: ${first.surahName} ${first.numberInSurah}–${last.surahName} ${last.numberInSurah}. Completed in ${mode === 'hifz' ? 'Hifz' : 'Muraja’ah'}.` }));
      const rect = event.currentTarget.getBoundingClientRect(); triggerSparkBurst(rect.left + rect.width / 2, rect.top + rect.height / 2);
      setLogMessage('Page ' + page + ' logged successfully.'); onLogged();
    } catch (error) { setLogMessage(error instanceof Error ? error.message : 'Could not log this page.'); }
    finally { setLogging(false); }
  };
  const readerContent = <>
    <header className="mushaf-toolbar">
      <div className="mushaf-toolbar__left">
        <button type="button" className="mushaf-surahs-trigger" aria-label="Open surah navigation" onClick={() => setDrawerOpen(true)}><Menu size={17}/><span>Surahs</span></button>
        <div className="mushaf-toolbar__identity"><b>{pageData?.ayahs?.[0]?.surahName || 'Al-Qur’an'} <span>·</span> Juz {pageJuz} <span>·</span> Page {page} / 604</b></div>
      </div>
      <div className="mushaf-mode-switch" role="group" aria-label="Bookmark mode"><button type="button" className={mode === 'hifz' ? 'is-active' : ''} aria-pressed={mode === 'hifz'} onClick={() => changeMode('hifz')}>Hifz</button><button type="button" className={mode === 'murajaah' ? 'is-active' : ''} aria-pressed={mode === 'murajaah'} onClick={() => changeMode('murajaah')}>Muraja’ah</button></div>
      <div className="mushaf-toolbar__right">
        <div className="mushaf-top-font"><button type="button" aria-label="Decrease Arabic font size" onClick={() => changeFontSize(-1)}>A-</button><button type="button" aria-label="Increase Arabic font size" onClick={() => changeFontSize(1)}>A+</button></div>
        <button type="button" className={'mushaf-meaning-toggle ' + (showTranslation ? 'is-active' : '')} aria-pressed={showTranslation} onClick={() => setShowTranslation(v => !v)}>Meaning</button>
        <button type="button" className="mushaf-exit-button" onClick={() => { setDrawerOpen(false); setFullScreen(false); }}><X size={16}/> Exit</button>
      </div>
    </header>
    <div className="mushaf-reading-layout">
      <main className="mushaf-page-wrap" ref={readerRef}>
        <div className="mushaf-page-heading"><span>{pageData?.ayahs?.[0]?.surahName || 'Al-Qur’an'}</span><span>JUZ {pageJuz} · PAGE {page} / 604</span></div>
        {loading && <p className="mushaf-loading" role="status">Loading Mushaf page {page}…</p>}
        {!loading && pageError && <div className="mushaf-error" role="alert"><WifiOff size={24}/><p>{pageError}</p><button type="button" onClick={() => changePage(page)}>Retry page</button></div>}
        {!loading && pageData && <div className="mushaf-ayah-flow" dir="rtl" lang="ar" style={{ fontSize: `${fontSize}px` }}>
          {pageData.ayahs.map((ayah, index) => {
            const beginsSurah = index === 0 || pageData.ayahs[index - 1].surahNumber !== ayah.surahNumber;
            return <span className="mushaf-ayah-unit" key={ayah.surahNumber + ':' + ayah.numberInSurah}>
              {beginsSurah && <div className="mushaf-surah-banner"><span className="mushaf-surah-ornament">۞</span><b>{ayah.arabicName}</b><small>{ayah.surahName}</small><span className="mushaf-surah-ornament">۞</span></div>}
              {beginsSurah && ayah.surahNumber !== 9 && ayah.numberInSurah === 1 && <div className="mushaf-bismillah" lang="ar">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>}
              <button type="button" className={'mushaf-ayah ' + (selected?.surah === ayah.surahNumber && selected?.ayah === ayah.numberInSurah ? 'is-selected' : '')} onClick={() => selectAyah(ayah)} aria-pressed={selected?.surah === ayah.surahNumber && selected?.ayah === ayah.numberInSurah}>
                {ayah.text}<span className="mushaf-ayah-number" aria-label={`Ayah ${ayah.numberInSurah}`}>﴿{arabicNumber(ayah.numberInSurah)}﴾</span>
              </button>
              {showTranslation && ayah.translation && <span className="mushaf-translation" dir="ltr" lang="en">{ayah.translation}</span>}
            </span>;
          })}
        </div>}
      </main>
      {drawerOpen && <><button type="button" className="mushaf-drawer-scrim" aria-label="Close surah navigation" onClick={() => setDrawerOpen(false)}/><aside className="mushaf-surah-drawer" aria-label="114 Surahs"><header><div><b>Surah index</b><small>114 chapters · Madani Mushaf</small></div><button type="button" aria-label="Close surah index" onClick={() => setDrawerOpen(false)}><X size={18}/></button></header><div className="mushaf-drawer-jumps"><label>Page <input type="number" min="1" max="604" value={pageInput} onChange={event => setPageInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { changePage(Number(pageInput) || page); setDrawerOpen(false); } }}/></label><label>Juz <select defaultValue={pageJuz} onChange={event => { jumpJuz(Number(event.target.value)); setDrawerOpen(false); }}>{Array.from({length:30},(_,i)=><option key={i+1} value={i+1}>Juz {i+1}</option>)}</select></label></div><div className="mushaf-surah-list">{QURAN_SURAHS.map(item => <button type="button" key={item.number} className={page >= item.pageStart && page <= item.pageEnd ? 'is-current' : ''} onClick={() => jumpSurah(item.number)}><span className="mushaf-surah-number">{item.number}</span><span className="mushaf-surah-names"><b>{item.transliteration}</b><small>{item.english} · {item.ayahs} ayahs · p.{item.pageStart}</small></span><strong lang="ar" dir="rtl">{item.arabic}</strong></button>)}</div></aside></>}
    </div>
    <footer className="mushaf-bottom-bar">
      <button type="button" className="mushaf-page-control" disabled={page <= 1} onClick={() => changePage(page - 1)}><ChevronLeft size={16}/> Previous Page</button>
      {selectedAyah ? <div className="mushaf-audio-controls">
        <span className="mushaf-selected-ref">{selectedAyah.surahName} · {selectedAyah.surahNumber}:{selectedAyah.numberInSurah}</span>
        <button type="button" onClick={togglePlay}>{playing ? <Pause size={16}/> : <Play size={16}/>} {playing ? 'Pause' : 'Play'}</button>
        <label className="mushaf-reciter"><Headphones size={15}/><select aria-label="Reciter" value={reciter} onChange={event => setReciter(event.target.value)}>{reciters.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <button type="button" className={repeatMode === 'ayah' ? 'is-active' : ''} onClick={() => setRepeatMode(v => v === 'ayah' ? 'off' : 'ayah')}><Repeat size={15}/> Repeat</button>
      </div> : <span className="mushaf-bottom-hint">Tap an ayah to play, repeat or review it</span>}
      <button type="button" className="button button--primary mushaf-complete-button" disabled={!pageData?.ayahs?.length || loading || logging} onClick={logPage}><Check size={15}/>{logging ? 'Logging…' : 'Complete & Log Page'}</button>
      <button type="button" className="mushaf-page-control" disabled={page >= 604} onClick={() => changePage(page + 1)}>Next Page <ChevronRight size={16}/></button>
      <span className="mushaf-log-message" role="status">{logMessage}</span>
    </footer>
    <audio ref={audioRef} onEnded={() => { if (repeatMode === 'ayah' && selectedAyah) playAyah(selectedAyah); else if (repeatMode === 'page' && pageData?.ayahs?.length) { const index = pageData.ayahs.findIndex(item => item.number === selectedAyah?.number); const next = pageData.ayahs[index + 1] || pageData.ayahs[0]; setSelected({ surah: next.surahNumber, ayah: next.numberInSurah }); playAyah(next); } else setPlaying(false); }} onPause={() => setPlaying(false)} onPlay={() => setPlaying(true)} />
  </>;
  return <>
    <section className="mushaf-launch-card"><div><h3>Qur’an reading & memorisation</h3><p>Continue at your saved {mode === 'hifz' ? 'Hifz' : 'Muraja’ah'} position, or open the full-screen reader.</p><small>Hifz · page {hifzMark.page} &nbsp; / &nbsp; Muraja’ah · page {murajaahMark.page}</small></div><button type="button" className="button button--primary" onClick={() => setFullScreen(true)}><Maximize2 size={16}/> Open Full-Screen Mushaf</button></section>
    <style>{mushafStyles}</style>
    {fullScreen && createPortal(<div className="mushaf-fullscreen" role="dialog" aria-modal="true" aria-label="Full-screen Qur’an Mushaf">{readerContent}</div>, document.body)}
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
`;
