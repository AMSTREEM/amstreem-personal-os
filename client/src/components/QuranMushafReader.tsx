import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { ArrowLeft, BookOpen, Check, ChevronLeft, ChevronRight, Copy, Headphones, Maximize2, Menu, Pause, Play, Repeat, Share2, WifiOff, X } from 'lucide-react';
import { api, json } from '../lib/api';
import { QURAN_JUZ_STARTS, QURAN_SURAHS, getAyahLocation, getPageJuz } from '../data/quranSurahs';
import { triggerSparkBurst } from './fx/SparkBurst';

type Settings = Record<string, string>;
type MushafAyah = { number: number; numberInSurah: number; surahNumber: number; surahName: string; arabicName: string; text: string; translation: string };
type MushafPage = { page: number; juz: number; ayahs: MushafAyah[]; offlineFallback?: boolean };
type Props = { settings: Settings; settingsReady: boolean; onLogged: () => void };
const CACHE_PREFIX = 'atlas_mushaf_page_v2_';
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
  const [showTranslation, setShowTranslation] = useState(true);
  const [fontSize, setFontSize] = useState(32);
  const [reciter, setReciter] = useState('ar.alafasy');
  const [repeatMode, setRepeatMode] = useState<'off' | 'ayah' | 'page'>('off');
  const [playing, setPlaying] = useState(false);
  const [pageInput, setPageInput] = useState(String(page));
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const readerRef = useRef<HTMLDivElement | null>(null);
  const selectedAyah = pageData?.ayahs.find(item => item.surahNumber === selected?.surah && item.numberInSurah === selected?.ayah) || null;
  const pageJuz = useMemo(() => pageData?.juz || getPageJuz(page) || 1, [pageData, page]);
  const bookmark = mode === 'hifz' ? hifzMark : murajaahMark;

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
    <div className="mushaf-toolbar">
      <button type="button" className="mushaf-surahs-trigger" aria-label="Open surah navigation" onClick={() => setDrawerOpen(true)}><Menu size={18}/><span>Surahs</span></button>
      <div className="mushaf-mode-switch" role="group" aria-label="Bookmark mode"><button type="button" className={mode === 'hifz' ? 'is-active' : ''} aria-pressed={mode === 'hifz'} onClick={() => changeMode('hifz')}>Hifz</button><button type="button" className={mode === 'murajaah' ? 'is-active' : ''} aria-pressed={mode === 'murajaah'} onClick={() => changeMode('murajaah')}>Muraja’ah</button></div>
      <label className="mushaf-top-jump">Page <input type="number" min="1" max="604" value={pageInput} onChange={event => setPageInput(event.target.value)} onBlur={() => changePage(Number(pageInput) || page)} onKeyDown={event => { if (event.key === 'Enter') changePage(Number(pageInput) || page); }}/></label>
      <label className="mushaf-top-jump">Juz <select value={pageJuz} onChange={event => jumpJuz(Number(event.target.value))}>{Array.from({ length: 30 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}</select></label>
      <span className="mushaf-bookmark-label">{mode === 'hifz' ? 'HIFZ' : 'MURAJA’AH'} · P.{bookmark.page}{bookmark.ayah > 1 ? ` · AYAH ${bookmark.ayah}` : ''}</span>
      <div className="mushaf-top-font"><button type="button" aria-label="Decrease Arabic font size" onClick={() => setFontSize(v => Math.max(22, v - 2))}>A-</button><button type="button" aria-label="Increase Arabic font size" onClick={() => setFontSize(v => Math.min(48, v + 2))}>A+</button></div>
      <button type="button" className="mushaf-exit-button" onClick={() => setFullScreen(false)}><ArrowLeft size={16}/> Exit</button>
    </div>
    <div className="mushaf-reading-layout">
      <main className="mushaf-page-wrap" ref={readerRef}>
        <div className="mushaf-page-heading"><span>{pageData?.ayahs?.[0]?.surahName || 'Al-Qur’an'}</span><span>PAGE {page} · JUZ {pageJuz}</span></div>
        {loading && <p className="mushaf-loading" role="status">Loading Mushaf page {page}…</p>}
        {!loading && pageError && <div className="mushaf-error" role="alert"><WifiOff size={24}/><p>{pageError}</p><button type="button" onClick={() => changePage(page)}>Retry page</button></div>}
        {!loading && pageData && <div className="mushaf-ayah-flow" dir="rtl" lang="ar" style={{ fontSize }}>
          {pageData.ayahs.map((ayah, index) => <span key={ayah.surahNumber + ':' + ayah.numberInSurah}>
            {(index === 0 || pageData.ayahs[index - 1].surahNumber !== ayah.surahNumber) && <span className="mushaf-surah-heading"><b>{ayah.arabicName}</b><small>{ayah.surahName}</small></span>}
            <button type="button" className={'mushaf-ayah ' + (selected?.surah === ayah.surahNumber && selected?.ayah === ayah.numberInSurah ? 'is-selected' : '')} onClick={() => selectAyah(ayah)} aria-pressed={selected?.surah === ayah.surahNumber && selected?.ayah === ayah.numberInSurah}>{ayah.text} <span className="mushaf-ayah-number">۞{arabicNumber(ayah.numberInSurah)}۞</span></button>
            {showTranslation && ayah.translation && <span className="mushaf-translation" dir="ltr" lang="en">{ayah.translation}</span>}
          </span>)}
        </div>}
        <div className="mushaf-page-navigation"><button type="button" disabled={page <= 1} onClick={() => changePage(page - 1)}><ChevronLeft size={16}/> Previous</button><span>{page} / 604</span><button type="button" disabled={page >= 604} onClick={() => changePage(page + 1)}>Next <ChevronRight size={16}/></button></div>
      </main>
      {drawerOpen && <><button type="button" className="mushaf-drawer-scrim" aria-label="Close surah navigation" onClick={() => setDrawerOpen(false)}/><aside className="mushaf-surah-drawer" aria-label="114 Surahs"><header><div><b>Surah index</b><small>114 chapters · Madani Mushaf</small></div><button type="button" aria-label="Close surah index" onClick={() => setDrawerOpen(false)}><X size={18}/></button></header><div className="mushaf-drawer-jumps"><label>Page <input type="number" min="1" max="604" value={pageInput} onChange={event => setPageInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { changePage(Number(pageInput) || page); setDrawerOpen(false); } }}/></label><label>Juz <select defaultValue={pageJuz} onChange={event => { jumpJuz(Number(event.target.value)); setDrawerOpen(false); }}>{Array.from({length:30},(_,i)=><option key={i+1} value={i+1}>Juz {i+1}</option>)}</select></label></div><div className="mushaf-surah-list">{QURAN_SURAHS.map(item => <button type="button" key={item.number} className={page >= item.pageStart && page <= item.pageEnd ? 'is-current' : ''} onClick={() => jumpSurah(item.number)}><span className="mushaf-surah-number">{item.number}</span><span className="mushaf-surah-names"><b>{item.transliteration}</b><small>{item.english} · {item.ayahs} ayahs · p.{item.pageStart}</small></span><strong lang="ar" dir="rtl">{item.arabic}</strong></button>)}</div></aside></>}
    </div>
    {selectedAyah && <div className="mushaf-ayah-actionbar"><div className="mushaf-selected-ref"><b>{selectedAyah.surahName} · {selectedAyah.surahNumber}:{selectedAyah.numberInSurah}</b><small>{selectedAyah.arabicName}</small></div><button type="button" onClick={togglePlay}>{playing ? <Pause size={16}/> : <Play size={16}/>}<span>{playing ? 'Pause' : 'Play ayah'}</span></button><label className="mushaf-reciter"><Headphones size={15}/><select value={reciter} onChange={event => setReciter(event.target.value)}>{reciters.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><button type="button" className={repeatMode === 'ayah' ? 'is-active' : ''} onClick={() => setRepeatMode(v => v === 'ayah' ? 'off' : 'ayah')}><Repeat size={15}/> Ayah loop</button><button type="button" className={repeatMode === 'page' ? 'is-active' : ''} onClick={() => setRepeatMode(v => v === 'page' ? 'off' : 'page')}><Repeat size={15}/> Page loop</button><button type="button" onClick={() => setShowTranslation(v => !v)}>{showTranslation ? 'Hide meaning' : 'Show meaning'}</button><button type="button" onClick={copyAyah}><Copy size={15}/> Copy</button><button type="button" onClick={shareAyah}><Share2 size={15}/> Share</button></div>}
    <div className="mushaf-bottom-bar"><span>{pageData?.ayahs?.length || 0} ayahs · bookmark auto-saved · {logMessage}</span><button type="button" className="button button--primary" disabled={!pageData?.ayahs?.length || loading || logging} onClick={logPage}><Check size={15}/>{logging ? 'Logging…' : 'Complete & Log Page'}</button></div>
    <audio ref={audioRef} onEnded={() => { if (repeatMode === 'ayah' && selectedAyah) playAyah(selectedAyah); else if (repeatMode === 'page' && pageData?.ayahs?.length) { const index = pageData.ayahs.findIndex(item => item.number === selectedAyah?.number); const next = pageData.ayahs[index + 1] || pageData.ayahs[0]; setSelected({ surah: next.surahNumber, ayah: next.numberInSurah }); playAyah(next); } else setPlaying(false); }} onPause={() => setPlaying(false)} onPlay={() => setPlaying(true)} />
  </>;

  return <>
    <section className="mushaf-launch-card"><div><h3>Qur’an reading & memorisation</h3><p>Continue at your saved {mode === 'hifz' ? 'Hifz' : 'Muraja’ah'} position, or open the full-screen reader.</p><small>Hifz · page {hifzMark.page} &nbsp; / &nbsp; Muraja’ah · page {murajaahMark.page}</small></div><button type="button" className="button button--primary" onClick={() => setFullScreen(true)}><Maximize2 size={16}/> Open Full-Screen Mushaf</button></section>
    {fullScreen && <div className="mushaf-fullscreen" role="dialog" aria-modal="true" aria-label="Full-screen Qur’an Mushaf"><style>{mushafStyles}</style>{readerContent}</div>}
    {!fullScreen && <style>{mushafStyles}</style>}
  </>;
}

const mushafStyles = `
.mushaf-launch-card{display:flex;align-items:center;justify-content:space-between;gap:18px;flex-wrap:wrap;padding:20px;border:1px solid var(--border-subtle,rgba(255,255,255,.12));border-radius:16px;background:var(--surface-card,rgba(255,255,255,.035))}
.mushaf-launch-card h3{margin:5px 0;font-size:18px}.mushaf-launch-card p{margin:4px 0 8px;color:var(--text-muted);font-size:13px}.mushaf-launch-card small{color:var(--text-muted);font-size:11px}
.mushaf-fullscreen{position:fixed;inset:0;z-index:9999;width:100vw;height:100dvh;overflow:hidden;background:var(--bg-canvas,#10130f);color:var(--text-primary,#f0eee6);display:flex;flex-direction:column;font-family:Inter,system-ui,sans-serif}
.mushaf-toolbar{min-height:64px;flex:0 0 auto;display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px clamp(14px,3vw,32px);border-bottom:1px solid rgba(255,255,255,.12);background:#151a15}
.mushaf-top-jump{display:flex;align-items:center;gap:6px;color:#aeb4a9;font-size:11px}.mushaf-top-jump input,.mushaf-top-jump select{width:68px;padding:8px;border:1px solid rgba(255,255,255,.16);border-radius:8px;background:#20271f;color:#f2f0e8;font:inherit}
.mushaf-bookmark-label{margin-left:auto;color:#b8bdaf;font-size:10px;letter-spacing:.08em}
.mushaf-top-font{display:flex;gap:4px}.mushaf-top-font button,.mushaf-exit-button,.mushaf-surahs-trigger{display:inline-flex;align-items:center;gap:6px;border:1px solid rgba(255,255,255,.14);border-radius:9px;background:rgba(255,255,255,.055);color:inherit;padding:9px 11px;font:inherit;font-size:12px;cursor:pointer}
.mushaf-exit-button{background:rgba(214,198,154,.14);border-color:rgba(214,198,154,.35)}
.mushaf-toolbar__identity,.mushaf-toolbar__actions{display:flex;align-items:center;gap:12px}.mushaf-toolbar__identity span{display:grid;gap:3px}.mushaf-toolbar__identity b{font-size:11px;letter-spacing:.14em}.mushaf-toolbar__identity small{font-size:9px;color:#a4aa9d;letter-spacing:.12em}
.mushaf-toolbar button,.mushaf-reading-controls button,.mushaf-ayah-actionbar button{display:inline-flex;align-items:center;justify-content:center;gap:7px;border:1px solid rgba(255,255,255,.14);border-radius:9px;background:rgba(255,255,255,.055);color:inherit;padding:9px 11px;font:inherit;font-size:12px;cursor:pointer}
.mushaf-reading-controls{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:12px clamp(14px,3vw,32px);border-bottom:1px solid rgba(255,255,255,.1);background:#131813}
.mushaf-mode-switch{display:flex;gap:4px;padding:3px;border-radius:10px;background:rgba(255,255,255,.06)}.mushaf-mode-switch button{border:0}.mushaf-mode-switch button.is-active,.mushaf-ayah-actionbar button.is-active{background:#d6c69a;color:#1d211a}
.mushaf-reading-controls label,.mushaf-drawer-jumps label{display:flex;align-items:center;gap:7px;color:#aeb4a9;font-size:11px}.mushaf-reading-controls input,.mushaf-reading-controls select,.mushaf-drawer-jumps input,.mushaf-drawer-jumps select,.mushaf-reciter select{width:76px;padding:8px;border:1px solid rgba(255,255,255,.16);border-radius:8px;background:#20271f;color:#f2f0e8;font:inherit}
.mushaf-bookmark-label{margin-left:auto;color:#b8bdaf;font-size:10px;letter-spacing:.08em}
.mushaf-reading-layout{position:relative;min-height:0;flex:1;display:flex;justify-content:center;overflow:auto;padding:22px clamp(12px,4vw,48px) 26px}
.mushaf-page-wrap{width:min(100%,720px);min-height:100%;margin:0 auto;padding:32px 24px;border:0;border-radius:4px;background:#f4f0e5;color:#24271f;box-shadow:0 18px 55px rgba(0,0,0,.18)}
.mushaf-page-heading{display:flex;justify-content:space-between;gap:12px;padding-bottom:12px;border-bottom:1px solid rgba(36,39,31,.18);font-size:10px;letter-spacing:.13em;color:#686b5e}
.mushaf-ayah-flow{padding:20px 0;text-align:justify;text-align-last:center;font-family:"KFGQPC Uthmanic Script HAFS","Amiri Quran","Noto Naskh Arabic",serif;line-height:2.05;color:#25291f}
.mushaf-ayah{display:inline;border:0;border-radius:7px;background:transparent;color:inherit;font:inherit;line-height:inherit;cursor:pointer;padding:0 2px}.mushaf-ayah.is-selected{background:rgba(183,155,91,.24);box-shadow:0 0 0 2px rgba(183,155,91,.18)}
.mushaf-ayah-number{font-size:.65em;color:#9b814b;white-space:nowrap}.mushaf-translation{display:block;margin:0 auto 14px;max-width:720px;text-align:left;direction:ltr;font:13px/1.7 Inter,system-ui,sans-serif;color:#66695e}
.mushaf-surah-heading{display:flex;align-items:center;justify-content:center;gap:14px;margin:18px 0;padding:9px;border:1px solid rgba(40,43,33,.18);border-radius:8px;color:#4e5544}.mushaf-surah-heading b{font-size:24px}.mushaf-surah-heading small{font:11px Inter,system-ui,sans-serif}
.mushaf-loading,.mushaf-error{padding:40px;text-align:center;color:#656a5d}.mushaf-error button{padding:9px 13px;border:1px solid #b5aa8b;border-radius:8px;background:#fff;color:#333}
.mushaf-page-navigation{display:flex;justify-content:space-between;align-items:center;gap:12px;padding-top:14px;border-top:1px solid rgba(36,39,31,.18);color:#65695d;font-size:11px}.mushaf-page-navigation button{display:flex;align-items:center;gap:5px;padding:8px 10px;border:1px solid rgba(36,39,31,.2);border-radius:8px;background:#ebe6d8;color:#34382f}.mushaf-page-navigation button:disabled{opacity:.4}
.mushaf-ayah-actionbar{display:flex;align-items:center;gap:7px;flex-wrap:wrap;padding:10px clamp(12px,3vw,28px);border-top:1px solid rgba(255,255,255,.12);background:#171d17}.mushaf-ayah-actionbar button{padding:8px 9px;font-size:11px}.mushaf-selected-ref{display:grid;gap:2px;margin-right:auto;font-size:11px}.mushaf-selected-ref small{color:#aab0a4}.mushaf-reciter{display:flex;align-items:center;gap:5px}.mushaf-reciter select{width:auto;max-width:150px;padding:7px;font-size:11px}
.mushaf-bottom-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px clamp(14px,3vw,32px);background:#151a15;border-top:1px solid rgba(255,255,255,.1);font-size:10px;color:#aeb4a9}.mushaf-bottom-bar .button{white-space:nowrap}
.mushaf-drawer-scrim{position:fixed;inset:64px 0 0;z-index:10000;border:0;background:rgba(0,0,0,.58)}.mushaf-surah-drawer{position:fixed;z-index:10001;top:64px;bottom:0;left:0;width:min(370px,88vw);display:flex;flex-direction:column;background:#1a2119;border-right:1px solid rgba(255,255,255,.12);box-shadow:15px 0 55px rgba(0,0,0,.35)}
.mushaf-surah-drawer header{display:flex;align-items:center;justify-content:space-between;padding:18px;border-bottom:1px solid rgba(255,255,255,.1)}.mushaf-surah-drawer header div{display:grid;gap:4px}.mushaf-surah-drawer header b{font-size:14px}.mushaf-surah-drawer header small{font-size:10px;color:#aab0a4}.mushaf-surah-drawer header button{border:0;background:transparent;color:inherit}
.mushaf-drawer-jumps{display:flex;gap:12px;padding:12px 16px;border-bottom:1px solid rgba(255,255,255,.1)}.mushaf-surah-list{overflow:auto;padding:8px}.mushaf-surah-list>button{width:100%;display:flex;align-items:center;gap:10px;padding:10px;border:0;border-radius:9px;background:transparent;color:#e8e8dd;text-align:left;cursor:pointer}.mushaf-surah-list>button.is-current,.mushaf-surah-list>button:hover{background:rgba(214,198,154,.12)}.mushaf-surah-number{width:28px;height:28px;display:grid;place-items:center;border:1px solid rgba(255,255,255,.14);border-radius:8px;font-size:10px}.mushaf-surah-names{display:grid;gap:3px;flex:1}.mushaf-surah-names b{font-size:11px}.mushaf-surah-names small{font-size:9px;color:#aeb4a9}.mushaf-surah-list strong{font:20px/1.2 "Amiri Quran","Noto Naskh Arabic",serif}
@media(max-width:700px){.mushaf-toolbar{min-height:56px;padding:8px 9px;gap:6px}.mushaf-toolbar__identity{display:none}.mushaf-top-jump{font-size:10px}.mushaf-top-jump input,.mushaf-top-jump select{width:54px;padding:6px}.mushaf-top-font button,.mushaf-exit-button,.mushaf-surahs-trigger{padding:7px 8px;font-size:10px}.mushaf-bookmark-label{width:100%;margin:0}.mushaf-reading-controls{gap:7px;padding:9px 10px}.mushaf-reading-controls label{font-size:10px}.mushaf-reading-controls input,.mushaf-reading-controls select{width:58px;padding:7px}.mushaf-reading-layout{padding:10px 7px}.mushaf-page-wrap{padding:20px 14px;border-radius:4px}.mushaf-ayah-actionbar{gap:5px;padding:8px}.mushaf-ayah-actionbar button{font-size:10px;padding:7px}.mushaf-selected-ref{width:100%;margin:0}.mushaf-bottom-bar{padding:8px 10px}.mushaf-bottom-bar>span{max-width:52%;line-height:1.4}.mushaf-bottom-bar .button{font-size:10px;padding:8px}.mushaf-surah-drawer{top:56px;width:min(350px,92vw)}.mushaf-drawer-scrim{top:56px}}
`;
