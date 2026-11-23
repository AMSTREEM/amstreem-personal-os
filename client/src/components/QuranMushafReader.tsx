import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bookmark, ChevronLeft, ChevronRight, Copy, Maximize2, Play, Search, WifiOff, X } from 'lucide-react';
import { api, json } from '../lib/api';
import { QURAN_JUZ_STARTS, QURAN_SURAHS, getAyahLocation, getPageJuz } from '../data/quranSurahs';
import { triggerSparkBurst } from './fx/SparkBurst';

type Settings = Record<string, string>;
type MushafWord = { text: string; codeV2: string; lineNumber: number; pageNumber: number; position: number; charTypeName: string };
type MushafAyah = { number: number; numberInSurah: number; surahNumber: number; surahName: string; arabicName: string; text: string; translation: string; translations?: Array<{ id: number; name: string; text: string }>; words?: MushafWord[] };
type MushafPage = { page: number; juz: number; qcfAvailable?: boolean; translationSource?: string; ayahs: MushafAyah[]; offlineFallback?: boolean };
type MushafLineWord = MushafWord & { surahNumber: number; numberInSurah: number };
const escapeGlyphHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
type Props = { settings: Settings; settingsReady: boolean; onLogged: () => void };
const CACHE_PREFIX = 'atlas_mushaf_page_v4_';
const pageMemoryCache = new Map<number, MushafPage>();
const HIFZ_KEY = 'atlas_hifz_bookmark_v2';
const MURAJAAH_KEY = 'atlas_murajaah_bookmark_v2';
const clampPage = (value: number) => Math.max(1, Math.min(604, Number.isInteger(value) ? value : 1));
const arabicNumber = (value: number) => String(value).replace(/\d/g, digit => '٠١٢٣٤٥٦٧٨٩'[Number(digit)]);
const stripAyahEndMarker = (value: string) => value.replace(/[\u06DD\u06DE\u06E9\u06DF-\u06E8\u06EA-\u06ED]/g, '').trim();
const sanitizeMushafPage = (payload: MushafPage): MushafPage => ({
  ...payload,
  ayahs: (payload.ayahs || []).map(ayah => ({
    ...ayah, text: stripAyahEndMarker(ayah.text || ''), translation: stripAyahEndMarker(ayah.translation || ''),
    translations: ayah.translations?.map(translation => ({ ...translation, text: stripAyahEndMarker(translation.text || '') })),
    words: ayah.words?.map(word => ({ ...word, text: stripAyahEndMarker(word.text || ''), codeV2: stripAyahEndMarker(word.codeV2 || '') }))
  }))
});
function AyahMedallion({ number, className }: { number: number; className: string }) {
  return <span className={'mushaf-ayah-number ' + className + (number >= 100 ? ' is-three-digit' : '')} role="img" aria-label={'Ayah ' + number}>
    <svg className="mushaf-ayah-medallion-frame" viewBox="0 0 36 36" aria-hidden="true" focusable="false">
      <path d="M18 1.5 21.8 8.2 29.8 6.2 27.8 14.2 34.5 18 27.8 21.8 29.8 29.8 21.8 27.8 18 34.5 14.2 27.8 6.2 29.8 8.2 21.8 1.5 18 8.2 14.2 6.2 6.2 14.2 8.2Z" />
      <circle cx="18" cy="18" r="13.2" />
    </svg>
    <span className="mushaf-fs-ayah-number-text">{arabicNumber(number)}</span>
  </span>;
}
function SurahCartouche({ arabicName, englishName, ayahs }: { arabicName: string; englishName: string; ayahs: number }) {
  return <div className="mushaf-surah-cartouche" role="group" aria-label={englishName + ', ' + ayahs + ' ayahs'}>
    <svg viewBox="0 0 620 74" preserveAspectRatio="none" aria-hidden="true">
      <path className="mushaf-cartouche-outer" d="M8 37 27 8H593L612 37 593 66H27Z"/>
      <path className="mushaf-cartouche-inner" d="M18 37 33 15H587L602 37 587 59H33Z"/>
      <path className="mushaf-cartouche-flourish" d="M38 37h42m-28-8 8 8-8 8m528-8h-42m28-8-8 8 8 8M310 5l7 7-7 7-7-7Z"/>
    </svg>
    <div className="mushaf-surah-cartouche-copy">
      <b lang="ar" dir="rtl">سُورَةُ {arabicName}</b>
      <span>{englishName} <i>·</i> {ayahs} Ayahs</span>
    </div>
  </div>;
}
function BismillahOrnament() {
  return <div className="mushaf-bismillah-ornament" lang="ar" dir="rtl">
    <span aria-hidden="true"/>
    <b>بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ</b>
    <span aria-hidden="true"/>
  </div>;
}
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
  const [surahAyahs, setSurahAyahs] = useState<MushafAyah[]>([]);
  const [surahLoading, setSurahLoading] = useState(false);
  const [surahError, setSurahError] = useState('');
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [fullScreen, setFullScreen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [surahSearch, setSurahSearch] = useState('');
  const [saveStatus, setSaveStatus] = useState('');
  const [selected, setSelected] = useState<{ surah: number; ayah: number } | null>(null);
  const [readingMode, setReadingMode] = useState<'translation' | 'reading'>('reading');
  const [qcfFontStatus, setQcfFontStatus] = useState<'loading' | 'ready' | 'fallback'>('fallback');
  const [fontSize, setFontSize] = useState(() => {
    try { const saved = Number(localStorage.getItem('atlas_mushaf_font_step_v1')); return [18, 20, 22, 24, 26].includes(saved) ? saved : 18; }
    catch { return 18; }
  });
  const [reciter, setReciter] = useState('ar.alafasy');
  const [pageInput, setPageInput] = useState(String(page));
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const readerRef = useRef<HTMLDivElement | null>(null);
  const autoLoggedPagesRef = useRef(new Set<string>());
  const selectedAyah = pageData?.ayahs.find(item => item.surahNumber === selected?.surah && item.numberInSurah === selected?.ayah) || null;
  const pageJuz = useMemo(() => pageData?.juz || getPageJuz(page) || 1, [pageData, page]);
  const bookmark = mode === 'hifz' ? hifzMark : murajaahMark;
  const readingLines = useMemo(() => {
    const grouped = new Map<number, MushafLineWord[]>();
    for (const ayah of pageData?.ayahs || []) for (const word of ayah.words || []) {
      if (word.pageNumber !== page || !word.lineNumber) continue;
      const line = grouped.get(word.lineNumber) || [];
      line.push({ ...word, surahNumber: ayah.surahNumber, numberInSurah: ayah.numberInSurah });
      grouped.set(word.lineNumber, line);
    }
    return [...grouped.entries()].sort((a,b) => a[0]-b[0]).map(([lineNumber, words]) => ({ lineNumber, words }));
  }, [pageData, page]);
  const fontSteps = [18, 20, 22, 24, 26];
  const changeFontSize = (direction: -1 | 1) => setFontSize(current => {
    const index = fontSteps.indexOf(current);
    const next = fontSteps[Math.max(0, Math.min(fontSteps.length - 1, (index < 0 ? 2 : index) + direction))];
    try { localStorage.setItem('atlas_mushaf_font_step_v1', String(next)); } catch { /* storage is optional */ }
    return next;
  });

  useEffect(() => {
    let cancelled = false;
    if (readingMode !== 'reading' || !pageData?.qcfAvailable || !pageData.ayahs.some(ayah => ayah.words?.some(word => word.codeV2))) { setQcfFontStatus('fallback'); return; }
    setQcfFontStatus('loading');
    const family = 'QCF_P' + page;
    if ([...document.fonts].some(font => font.family === family && font.status === 'loaded')) { setQcfFontStatus('ready'); return; }
    const font = new FontFace(family, 'url(https://verses.quran.foundation/fonts/quran/hafs/v2/woff2/p' + page + '.woff2)');
    font.display = 'swap';
    font.load().then(loaded => { if (!cancelled) { document.fonts.add(loaded); setQcfFontStatus('ready'); } }).catch(() => { if (!cancelled) setQcfFontStatus('fallback'); });
    return () => { cancelled = true; };
  }, [page, pageData, readingMode]);

  useEffect(() => {
    if (!fullScreen) return;
    const root = document.documentElement;
    const previousRootOverflow = root.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    root.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => { root.style.overflow = previousRootOverflow; document.body.style.overflow = previousBodyOverflow; };
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
    setSaveStatus('Auto-saved · Page ' + mark.page);
    if (!settingsReady) return;
    const timer = window.setTimeout(() => {
      void api('/settings', json('PATCH', {
        [mode === 'hifz' ? 'hifz_page' : 'murajaah_page']: String(mark.page),
        [mode === 'hifz' ? 'hifz_bookmark' : 'murajaah_bookmark']: JSON.stringify(mark)
      })).catch(() => undefined);
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [mode, hifzMark, murajaahMark, settingsReady]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setPageError(''); setPageData(null); setPageInput(String(page));
    const memory = pageMemoryCache.get(page);
    if (memory?.ayahs?.length) { setPageData(memory); setLoading(false); return () => { cancelled = true; }; }
    try {
      const cached = localStorage.getItem(CACHE_PREFIX + page);
      if (cached) {
        const parsed = sanitizeMushafPage(JSON.parse(cached) as MushafPage);
        if (parsed?.ayahs?.length) { pageMemoryCache.set(page, parsed); setPageData(parsed); setLoading(false); return () => { cancelled = true; }; }
      }
    } catch { /* ignore unavailable or malformed browser cache */ }
    fetch('/api/quran/page/' + page)
      .then(async response => { const payload = await response.json(); if (!response.ok) throw new Error(payload?.error || 'The Mushaf page could not be loaded.'); return payload; })
      .then(payload => {
        const result = payload ? sanitizeMushafPage(payload as MushafPage) : undefined;
        if (!result?.ayahs?.length) throw new Error('No Qur’an text was returned for this page.');
        if (cancelled) return;
        pageMemoryCache.set(page, result); setPageData(result); setLoading(false);
        try { localStorage.setItem(CACHE_PREFIX + page, JSON.stringify(result)); } catch { /* retain memory cache */ }
      })
      .catch(error => { if (!cancelled) { setLoading(false); setPageError(error instanceof Error ? error.message : 'This page is unavailable offline.'); } });
    return () => { cancelled = true; };
  }, [page]);

  const activeSurahNumber = selected?.surah || bookmark.surah || pageData?.ayahs?.[0]?.surahNumber || 1;
  const activeSurah = QURAN_SURAHS[activeSurahNumber - 1];
  useEffect(() => {
    if (!fullScreen || loading || !pageData?.ayahs?.length) return;
    const date = lagosDate();
    const dedupeKey = date + ':' + page;
    const storageKey = 'atlas_quran_auto_logged_pages_' + date;
    if (autoLoggedPagesRef.current.has(dedupeKey)) return;
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || '[]') as number[];
      if (stored.includes(page)) { autoLoggedPagesRef.current.add(dedupeKey); return; }
    } catch { /* continue with in-memory deduplication */ }
    autoLoggedPagesRef.current.add(dedupeKey);
    const first = pageData.ayahs[0];
    const last = pageData.ayahs[pageData.ayahs.length - 1];
    const sameSurah = first.surahNumber === last.surahNumber;
    const label = sameSurah ? (QURAN_SURAHS[first.surahNumber - 1]?.transliteration || first.surahName) : `Page ${page} · ${first.surahName}–${last.surahName}`;
    void api('/deen/quran', json('POST', {
      log_date: date,
      activity: mode === 'hifz' ? 'memorisation' : 'revision',
      surah: label,
      ayah_start: sameSurah ? first.numberInSurah : null,
      ayah_end: sameSurah ? last.numberInSurah : null,
      pages: 1,
      juz: pageData.juz || getPageJuz(page) || 1,
      reflection: `Automatically visited Mushaf page ${page}: ${first.surahName} ${first.numberInSurah}–${last.surahName} ${last.numberInSurah}. ${mode === 'hifz' ? 'Hifz' : 'Muraja’ah'} reading.`
    })).then(() => {
      try {
        const stored = JSON.parse(localStorage.getItem(storageKey) || '[]') as number[];
        if (!stored.includes(page)) localStorage.setItem(storageKey, JSON.stringify([...stored, page]));
      } catch { /* in-memory deduplication remains active */ }
      onLogged();
    }).catch(() => { autoLoggedPagesRef.current.delete(dedupeKey); });
  }, [fullScreen, loading, pageData, page, mode, onLogged]);
  useEffect(() => {
    if (readingMode !== 'translation' || !activeSurah) return;
    let cancelled = false;
    setSurahLoading(true); setSurahError(''); setSurahAyahs([]);
    const pageNumbers = Array.from({ length: activeSurah.pageEnd - activeSurah.pageStart + 1 }, (_, index) => activeSurah.pageStart + index);
    const load = async (pageNumber: number): Promise<MushafPage> => {
      const memory = pageMemoryCache.get(pageNumber);
      if (memory?.ayahs?.length) return memory;
      try {
        const cached = localStorage.getItem(CACHE_PREFIX + pageNumber);
        if (cached) { const parsed = sanitizeMushafPage(JSON.parse(cached) as MushafPage); if (parsed?.ayahs?.length) { pageMemoryCache.set(pageNumber, parsed); return parsed; } }
      } catch { /* ignore malformed local cache */ }
      const response = await fetch('/api/quran/page/' + pageNumber);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'A Surah section could not be loaded.');
      const result = sanitizeMushafPage(payload as MushafPage);
      if (!result.ayahs?.length) throw new Error('No Qur’an text was returned for page ' + pageNumber + '.');
      pageMemoryCache.set(pageNumber, result);
      try { localStorage.setItem(CACHE_PREFIX + pageNumber, JSON.stringify(result)); } catch { /* memory cache remains available */ }
      return result;
    };
    void (async () => {
      try {
        const pages: MushafPage[] = [];
        for (let offset = 0; offset < pageNumbers.length; offset += 5) pages.push(...await Promise.all(pageNumbers.slice(offset, offset + 5).map(load)));
        const unique = new Map<string, MushafAyah>();
        for (const result of pages) for (const ayah of result.ayahs) if (ayah.surahNumber === activeSurahNumber) unique.set(activeSurahNumber + ':' + ayah.numberInSurah, ayah);
        const ordered = [...unique.values()].sort((a, b) => a.numberInSurah - b.numberInSurah);
        if (!ordered.length) throw new Error('No verses were returned for ' + activeSurah.transliteration + '.');
        if (!cancelled) setSurahAyahs(ordered);
      } catch (error) { if (!cancelled) setSurahError(error instanceof Error ? error.message : 'This Surah could not be loaded.'); }
      finally { if (!cancelled) setSurahLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [readingMode, activeSurahNumber, activeSurah?.pageStart, activeSurah?.pageEnd]);

  const updateBookmark = useCallback((nextPage: number, ayah?: Pick<MushafAyah, 'surahNumber' | 'numberInSurah'> | null) => {
    const current = mode === 'hifz' ? hifzMark : murajaahMark;
    const next = { page: clampPage(nextPage), surah: ayah?.surahNumber ?? current.surah, ayah: ayah?.numberInSurah ?? current.ayah };
    if (current.page === next.page && current.surah === next.surah && current.ayah === next.ayah) return;
    if (mode === 'hifz') setHifzMark(next); else setMurajaahMark(next);
  }, [mode, hifzMark, murajaahMark]);
  const changePage = (next: number, location?: { surahNumber: number; numberInSurah: number }) => {
    const value = clampPage(next); setPage(value); setSelected(location ? { surah: location.surahNumber, ayah: location.numberInSurah } : null);
    updateBookmark(value, location ? { surahNumber: location.surahNumber, numberInSurah: location.numberInSurah } : null);
  };
  const changeMode = (next: 'hifz' | 'murajaah') => { if (next !== mode) { const active = mode === 'hifz' ? hifzMark : murajaahMark; updateBookmark(active.page, { surahNumber: active.surah, numberInSurah: active.ayah }); setMode(next); } };
  const changeReadingMode = (next: 'translation' | 'reading') => { if (next !== readingMode) { updateBookmark(page, selectedAyah); setReadingMode(next); } };
  const jumpSurah = (number: number) => { const item = QURAN_SURAHS[number - 1]; if (item) { changePage(item.pageStart, { surahNumber: number, numberInSurah: 1 }); setDrawerOpen(false); setSurahSearch(''); } };
  const jumpJuz = (number: number) => { const start = QURAN_JUZ_STARTS[number - 1]; if (start) changePage(getAyahLocation(start[1], start[2])?.page || 1); };
  const selectAyah = (ayah: MushafAyah) => { const ayahPage = getAyahLocation(ayah.surahNumber, ayah.numberInSurah)?.page || page; setSelected({ surah: ayah.surahNumber, ayah: ayah.numberInSurah }); setPage(ayahPage); updateBookmark(ayahPage, ayah); };
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
    try { await navigator.clipboard.writeText(text); } catch { /* clipboard is optional */ }
  };
  const shareAyah = async () => {
    if (!selectedAyah) return;
    const surah = QURAN_SURAHS[selectedAyah.surahNumber - 1];
    const text = `${selectedAyah.text}\n\n${surah.transliteration} ${selectedAyah.number}:${selectedAyah.numberInSurah}`;
    try { if (navigator.share) await navigator.share({ title: 'Qur’an · ' + surah.transliteration, text }); else await navigator.clipboard.writeText(text); } catch { /* share sheet dismissed */ }
  };
  useEffect(() => {
    if (readingMode !== 'reading' || !pageData?.ayahs?.length || loading) return;
    const savedAyah = pageData.ayahs.find(ayah => ayah.surahNumber === bookmark.surah && ayah.numberInSurah === bookmark.ayah);
    const target = savedAyah || pageData.ayahs[0];
    if (!savedAyah) setSelected({ surah: target.surahNumber, ayah: target.numberInSurah });
    updateBookmark(page, target);
  }, [pageData, loading, page, bookmark.surah, bookmark.ayah, bookmark.page, updateBookmark, readingMode]);
  const currentSurahNumber = activeSurahNumber;
  const currentSurah = QURAN_SURAHS[currentSurahNumber - 1];
  const readerContent = <>
    <header className="mushaf-fs-header">
      <div className="mushaf-fs-top-row">
        <div className="mushaf-fs-header-left">
          <button type="button" className="mushaf-fs-surah-trigger" aria-label="Open surah navigation" onClick={() => { setDrawerOpen(true); setSurahSearch(''); }}>
            <span>{currentSurahNumber}. {currentSurah?.transliteration || 'Al-Fatihah'} ▾</span>
          </button>
          <span className="mushaf-fs-page-meta">Page {page} · Juz {pageJuz}</span>
        </div>
        <div className="mushaf-fs-header-right">
          <div className="mushaf-mode-switch mushaf-fs-bookmark-switch" role="group" aria-label="Bookmark mode">
            <button type="button" className={mode === 'hifz' ? 'is-active' : ''} aria-pressed={mode === 'hifz'} onClick={() => changeMode('hifz')}>Hifz</button>
            <button type="button" className={mode === 'murajaah' ? 'is-active' : ''} aria-pressed={mode === 'murajaah'} onClick={() => changeMode('murajaah')}>Muraja’ah</button>
          </div>
          <div className="mushaf-top-font"><button type="button" aria-label="Decrease Arabic font size" onClick={() => changeFontSize(-1)}>A-</button><button type="button" aria-label="Increase Arabic font size" onClick={() => changeFontSize(1)}>A+</button></div>
          <button type="button" className="mushaf-fs-close" aria-label="Close Mushaf" onClick={() => { setDrawerOpen(false); setFullScreen(false); }}><X size={18}/></button>
        </div>
      </div>
      <nav className="mushaf-fs-tabs" aria-label="Qur’an display mode">
        <button type="button" className={readingMode === 'translation' ? 'is-active' : ''} aria-pressed={readingMode === 'translation'} onClick={() => changeReadingMode('translation')}>Verse by Verse</button>
        <button type="button" className={readingMode === 'reading' ? 'is-active' : ''} aria-pressed={readingMode === 'reading'} onClick={() => changeReadingMode('reading')}>Page by Page</button>
      </nav>
    </header>
    <div className={'mushaf-fs-stage mushaf-reading-layout ' + (readingMode === 'reading' ? 'is-page-by-page' : 'is-verse-by-verse')}>
      <main className="mushaf-fs-sheet mushaf-page-wrap" ref={readerRef}>
        {loading && <p className="mushaf-loading" role="status">Loading Mushaf page {page}…</p>}
        {!loading && pageError && readingMode === 'reading' && <div className="mushaf-error" role="alert"><WifiOff size={24}/><p>{pageError}</p><button type="button" onClick={() => changePage(page)}>Retry page</button></div>}
        {!loading && pageData && readingMode === 'reading' && <div className="mushaf-fs-qcf-page mushaf-fs-arabic" dir="rtl" lang="ar">
          {readingLines.length > 0 && qcfFontStatus === 'ready' ? readingLines.map(({ lineNumber, words }) => {
            const firstWord = words[0];
            const surah = firstWord?.numberInSurah === 1 ? pageData.ayahs.find(ayah => ayah.surahNumber === firstWord.surahNumber) : null;
            return <Fragment key={lineNumber}>
              {surah && <SurahCartouche arabicName={surah.arabicName} englishName={QURAN_SURAHS[surah.surahNumber - 1]?.english || surah.surahName} ayahs={QURAN_SURAHS[surah.surahNumber - 1]?.ayahs || 0} />}
              {surah && surah.surahNumber !== 1 && surah.surahNumber !== 9 && <BismillahOrnament />}
              <div className="mushaf-fs-qcf-line" data-line={lineNumber} style={fontSize === 18 ? undefined : { fontSize: fontSize + 'px' }}>
                {words.map((word, index) => word.charTypeName === 'end' ? <AyahMedallion key={word.surahNumber + ':' + word.numberInSurah + ':' + word.position + ':' + index} className="mushaf-fs-ayah-medallion" number={word.numberInSurah} /> : <span key={word.surahNumber + ':' + word.numberInSurah + ':' + word.position + ':' + index} className="mushaf-fs-qcf-word" style={{ fontFamily: 'QCF_P' + page }} dangerouslySetInnerHTML={{ __html: escapeGlyphHtml(word.codeV2 || word.text) }} />)}
              </div>
            </Fragment>;
          }) : readingLines.length > 0 ? <div className="mushaf-fs-unicode-lines" dir="rtl">
            {readingLines.map(({ lineNumber, words }) => <div className="mushaf-fs-qcf-line" key={lineNumber}>
              {words.map((word, index) => word.charTypeName === 'end' ? <AyahMedallion key={word.surahNumber + ':' + word.numberInSurah + ':' + word.position + ':' + index} className="mushaf-fs-ayah-medallion" number={word.numberInSurah} /> : <span key={word.surahNumber + ':' + word.numberInSurah + ':' + word.position + ':' + index}>{word.text}</span>)}
            </div>)}
          </div> : <div className="mushaf-ayah-flow mushaf-fs-unicode-flow" dir="rtl" lang="ar">
            {pageData.ayahs.map(ayah => <Fragment key={ayah.surahNumber + ':' + ayah.numberInSurah}>
              {ayah.numberInSurah === 1 && <SurahCartouche arabicName={ayah.arabicName} englishName={QURAN_SURAHS[ayah.surahNumber - 1]?.english || ayah.surahName} ayahs={QURAN_SURAHS[ayah.surahNumber - 1]?.ayahs || 0} />}
              {ayah.numberInSurah === 1 && ayah.surahNumber !== 1 && ayah.surahNumber !== 9 && <BismillahOrnament />}
              <button type="button" className={'mushaf-ayah ' + (selected?.surah === ayah.surahNumber && selected?.ayah === ayah.numberInSurah ? 'is-selected' : '')} onClick={() => selectAyah(ayah)} aria-pressed={selected?.surah === ayah.surahNumber && selected?.ayah === ayah.numberInSurah}>
                {ayah.text}<AyahMedallion className="mushaf-ayah-number" number={ayah.numberInSurah} />
              </button>
            </Fragment>)}
          </div>}
          {pageData.qcfAvailable && qcfFontStatus === 'fallback' && <p className="mushaf-fs-font-note">QCF page font unavailable — showing Uthmani text.</p>}
        </div>}
        {readingMode === 'translation' && <div className={`mushaf-fs-verse-list mushaf-fs-arabic mushaf-fs-arabic--${fontSize}`} dir="ltr" lang="en">
          <div className="mushaf-fs-surah-intro"><span>THE HOLY QUR’AN</span><h1>{activeSurah?.transliteration || 'Surah'}</h1><p>{activeSurah?.english || ''} <i>·</i> {activeSurah?.ayahs || surahAyahs.length} Ayahs</p><small>Translation: {pageData?.translationSource || 'Sahih International'}</small></div>
          {surahLoading && <p className="mushaf-loading" role="status">Loading all verses of {activeSurah?.transliteration || 'this Surah'}…</p>}
          {!surahLoading && surahError && <div className="mushaf-error" role="alert"><WifiOff size={24}/><p>{surahError}</p><button type="button" onClick={() => setReadingMode('reading')}>Return to Page by Page</button></div>}
          {!surahLoading && surahAyahs.map((ayah, index) => {
            const beginsSurah = index === 0;
            const isSelected = selected?.surah === ayah.surahNumber && selected?.ayah === ayah.numberInSurah;
            return <article className="mushaf-fs-verse-row" key={ayah.surahNumber + ':' + ayah.numberInSurah}>
              {beginsSurah && ayah.surahNumber !== 1 && ayah.surahNumber !== 9 && ayah.numberInSurah === 1 && <BismillahOrnament />}
              <div className="mushaf-fs-verse-actionbar">
                <div className="mushaf-fs-verse-actions"><small>{ayah.surahNumber}:{ayah.numberInSurah}</small><button type="button" aria-label={'Play ' + ayah.surahNumber + ':' + ayah.numberInSurah} onClick={() => { selectAyah(ayah); playAyah(ayah); }}><Play size={14}/></button><button type="button" aria-label={'Bookmark ' + ayah.surahNumber + ':' + ayah.numberInSurah} onClick={() => selectAyah(ayah)}><Bookmark size={14}/></button></div>
                <button type="button" className="mushaf-fs-verse-copy" onClick={() => { void navigator.clipboard?.writeText(ayah.text + '\n\n' + ayah.translation + '\n\n' + ayah.surahNumber + ':' + ayah.numberInSurah); }}><Copy size={13}/> Copy</button>
              </div>
              <div className="mushaf-fs-verse-arabic-line" dir="rtl" lang="ar">
                <button type="button" className={'mushaf-fs-verse-arabic ' + (isSelected ? 'is-selected' : '')} onClick={() => selectAyah(ayah)} aria-pressed={isSelected}>
                  {ayah.text}<AyahMedallion className="mushaf-ayah-number" number={ayah.numberInSurah} />
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
      {drawerOpen && <><button type="button" className="mushaf-drawer-scrim" aria-label="Close surah navigation" onClick={() => setDrawerOpen(false)}/><aside className="mushaf-surah-drawer mushaf-surah-drawer--designed" aria-label="114 Surahs">
      <header className="mushaf-surah-drawer-header"><div><b>Surah index</b><small>114 chapters · Madani Mushaf</small></div><button type="button" aria-label="Close surah index" onClick={() => setDrawerOpen(false)}><X size={18}/></button></header>
      <div className="mushaf-surah-search"><Search size={16}/><input type="search" value={surahSearch} onChange={event => setSurahSearch(event.target.value)} placeholder="Search Surah name or number..." aria-label="Search Surah name or number"/></div>
      <div className="mushaf-drawer-jumps"><label>Page <input type="number" min="1" max="604" value={pageInput} onChange={event => setPageInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { changePage(Number(pageInput) || page); setDrawerOpen(false); } }}/></label><label>Juz <select value={pageJuz} onChange={event => { jumpJuz(Number(event.target.value)); setDrawerOpen(false); }}>{Array.from({length:30},(_,i)=><option key={i+1} value={i+1}>Juz {i+1}</option>)}</select></label></div>
      <div className="mushaf-surah-list">{QURAN_SURAHS.filter(item => { const q=surahSearch.trim().toLowerCase(); return !q || String(item.number)===q || item.transliteration.toLowerCase().includes(q) || item.english.toLowerCase().includes(q) || item.arabic.includes(surahSearch.trim()); }).map(item => <button type="button" key={item.number} className={page >= item.pageStart && page <= item.pageEnd ? 'is-current' : ''} onClick={() => jumpSurah(item.number)}><span className="mushaf-surah-number"><i>{item.number}</i></span><span className="mushaf-surah-names"><b>{item.transliteration}</b><small>{item.english} · {item.ayahs} ayahs</small></span><strong lang="ar" dir="rtl">{item.arabic}</strong><em className="mushaf-surah-page-badge">p.{item.pageStart}</em></button>)}</div>
    </aside></>}
    </div>
    <footer className="mushaf-fs-footer">
      <div className="mushaf-fs-page-pill">
        {readingMode === 'reading' && <button type="button" className="mushaf-fs-page-nav" disabled={page <= 1} onClick={() => changePage(page - 1)}><ChevronLeft size={16}/> Previous Page</button>}
        <span className="mushaf-save-status" role="status">{saveStatus || 'Auto-save enabled'}</span>
        {readingMode === 'reading' && <button type="button" className="mushaf-fs-page-nav" disabled={page >= 604} onClick={() => changePage(page + 1)}>Next Page <ChevronRight size={16}/></button>}
      </div>
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

.mushaf-fs-overlay{position:fixed;inset:0;width:100vw;height:100dvh;z-index:9999;background:var(--bg-canvas);display:grid;grid-template-rows:52px minmax(0,1fr) 60px;overflow:hidden!important;box-sizing:border-box;font-family:"DM Sans",system-ui,sans-serif}
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


/* Quran.com-inspired two-row chrome and QCF V2 page layout */
.mushaf-fs-overlay{display:grid;grid-template-rows:auto minmax(0,1fr) 64px}
.mushaf-fs-header{height:auto;min-height:88px;max-width:none;width:100%;display:flex;flex-direction:column;gap:0;padding:0 20px;border-bottom:1px solid var(--border-hairline);background:var(--bg-surface)}
.mushaf-fs-top-row{height:50px;min-height:50px;width:100%;max-width:900px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:12px}
.mushaf-fs-header-left{display:flex;align-items:center;gap:12px;min-width:0}
.mushaf-fs-page-meta{font:500 10px/1.2 "DM Sans",sans-serif;color:var(--text-muted);white-space:nowrap}
.mushaf-fs-header-right{display:flex;align-items:center;gap:8px;flex:0 0 auto}
.mushaf-fs-surah-trigger{max-width:260px;min-height:34px;padding:0 9px;border:1px solid var(--border-hairline);border-radius:8px;background:var(--bg-elevated);color:var(--text-primary);font:600 12px/1 "DM Sans",sans-serif;white-space:nowrap}
.mushaf-fs-tabs{width:100%;max-width:900px;height:38px;min-height:38px;margin:0 auto;display:flex;align-items:stretch;gap:24px}
.mushaf-fs-tabs button{position:relative;min-width:120px;padding:0 5px;border:0;background:transparent;color:var(--text-muted);font:600 12px/1 "DM Sans",sans-serif}
.mushaf-fs-tabs button.is-active{color:var(--text-primary)}
.mushaf-fs-tabs button.is-active:after{position:absolute;content:"";height:2px;left:0;right:0;bottom:0;background:var(--accent,#b69b63);border-radius:2px}
.mushaf-fs-stage{align-items:flex-start;padding:14px 16px;overflow-y:auto}
.mushaf-fs-sheet{max-width:740px;width:100%;padding:22px 24px 48px;border:0;border-radius:0;background:transparent;box-shadow:none}
.mushaf-fs-qcf-page{max-width:580px;width:100%;margin:0 auto;display:flex;flex-direction:column;gap:0;direction:rtl}
.mushaf-fs-qcf-line{min-height:2.2em;width:100%;display:flex;align-items:center;justify-content:center;gap:4px;direction:rtl;text-align:center;white-space:nowrap;line-height:2.2;color:var(--text-primary)}
.mushaf-fs-qcf-word{display:inline-block;white-space:pre}
.mushaf-fs-unicode-lines .mushaf-fs-qcf-line{font-family:"Amiri Quran","Scheherazade New","Traditional Arabic",serif;white-space:normal;flex-wrap:wrap;font-size:26px}
.mushaf-fs-unicode-flow{font-family:"Amiri Quran","Scheherazade New","Traditional Arabic",serif;font-size:28px;line-height:2.2}
.mushaf-fs-font-note{text-align:center;color:var(--text-muted);font:11px "DM Sans",sans-serif}
.mushaf-fs-verse-list{max-width:740px;width:100%;margin:0 auto}
.mushaf-fs-translation-pill{width:max-content;max-width:100%;margin:0 auto 10px;padding:6px 12px;border:1px solid var(--border-hairline);border-radius:999px;background:var(--bg-elevated);color:var(--text-muted);font:500 10px/1.2 "DM Sans",sans-serif;text-align:center}
.mushaf-fs-verse-row{padding:24px 0;border-bottom:1px solid var(--border-hairline)}
.mushaf-fs-verse-row:first-of-type{border-top:0}
.mushaf-fs-verse-arabic-line{display:flex;align-items:flex-start;gap:14px;direction:ltr}
.mushaf-fs-verse-actions{display:flex;align-items:center;gap:8px;flex:0 0 auto;direction:ltr}
.mushaf-fs-verse-actions small{font:600 11px "DM Sans",sans-serif;color:var(--text-muted)}
.mushaf-fs-verse-actions button,.mushaf-fs-verse-copy button{display:inline-flex;align-items:center;gap:5px;padding:5px;border:0;border-radius:6px;background:transparent;color:var(--text-muted);font:500 10px "DM Sans",sans-serif}
.mushaf-fs-verse-actions button:hover,.mushaf-fs-verse-copy button:hover{background:var(--bg-elevated);color:var(--text-primary)}
.mushaf-fs-verse-arabic{flex:1;min-width:0;text-align:right;direction:rtl;font-family:"Amiri Quran","Scheherazade New","Traditional Arabic",serif;line-height:2.2}
.mushaf-fs-verse-translation{margin-top:12px;font:400 16px/1.75 "DM Sans",sans-serif;color:var(--text-primary)}
.mushaf-fs-verse-copy{display:flex;justify-content:flex-end;margin-top:7px}
.mushaf-fs-footer{height:64px;min-height:64px;max-width:none;width:100%;padding:0 12px}
.mushaf-fs-page-pill{width:100%;max-width:720px;justify-content:space-between;gap:5px;padding:5px 8px;border:0;border-radius:0;background:transparent;box-shadow:none}
.mushaf-fs-page-pill button{height:38px;min-height:38px;padding:0 12px;border:1px solid var(--border-hairline);border-radius:8px;background:var(--bg-elevated);font:500 11px "DM Sans",sans-serif}
.mushaf-fs-page-pill .mushaf-fs-log-page{background:var(--accent-wash,var(--bg-elevated));border-color:var(--accent,#b69b63)}
@media(max-width:700px){
 .mushaf-fs-header{padding:0 8px}
 .mushaf-fs-top-row{gap:4px}
 .mushaf-fs-header-left{gap:5px}
 .mushaf-fs-surah-trigger{max-width:145px;font-size:10px!important;padding:0 5px!important}
 .mushaf-fs-page-meta{font-size:9px}
 .mushaf-fs-header-right{gap:4px}
 .mushaf-fs-header-right .mushaf-mode-switch button{padding:5px 6px;font-size:9px}
 .mushaf-fs-header-right .mushaf-top-font button{padding:5px 5px;font-size:10px}
 .mushaf-fs-tabs{gap:12px}
 .mushaf-fs-tabs button{min-width:0;flex:1}
 .mushaf-fs-sheet{padding:16px 12px 36px}
 .mushaf-fs-qcf-line{gap:2px}
 .mushaf-fs-verse-row{padding:20px 0}
 .mushaf-fs-verse-arabic{font-size:25px;line-height:2.15}
 .mushaf-fs-verse-translation{font-size:14px}
 .mushaf-fs-page-pill button{padding:0 7px;font-size:9px}
}
@media(max-width:390px){
 .mushaf-fs-top-row{gap:2px}
 .mushaf-fs-surah-trigger{max-width:112px;font-size:9px!important}
 .mushaf-fs-page-meta{font-size:8px}
 .mushaf-fs-header-right{gap:2px}
 .mushaf-fs-header-right .mushaf-mode-switch button{padding:4px 4px;font-size:8px}
 .mushaf-fs-header-right .mushaf-top-font button{padding:4px 3px;font-size:9px}
 .mushaf-fs-close{width:26px;height:26px!important;min-height:26px!important}
 .mushaf-fs-page-pill{gap:3px;padding:4px}
 .mushaf-fs-page-pill button{padding:0 5px;font-size:8px}
}

.mushaf-fs-verse-actionbar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px}
.mushaf-fs-verse-actionbar .mushaf-fs-verse-actions{flex-direction:row;align-items:center}
.mushaf-fs-verse-actionbar .mushaf-fs-verse-copy{display:inline-flex;align-items:center;gap:5px;margin:0;padding:5px;border:0;border-radius:6px;background:transparent;color:var(--text-muted);font:500 10px "DM Sans",sans-serif}
.mushaf-fs-verse-actionbar .mushaf-fs-verse-copy:hover{background:var(--bg-elevated);color:var(--text-primary)}
.mushaf-fs-verse-arabic-line{display:block;direction:rtl}

.mushaf-fs-qcf-word.is-end{font-family:"Amiri Quran","Traditional Arabic",serif!important;font-size:.8em}

/* Ayah medallions: crisp eight-pointed frame with an independent numeral layer. */
.mushaf-fs-ayah-medallion,.mushaf-ayah-number{
 position:relative;isolation:isolate;display:inline-flex;align-items:center;justify-content:center;vertical-align:middle;
 flex:0 0 32px;box-sizing:border-box;width:32px;height:32px;min-width:32px;margin:0 6px;padding:0;
 border:0;border-radius:0;background:transparent;color:var(--accent-primary,var(--accent));line-height:1;white-space:nowrap;
}
.mushaf-fs-ayah-medallion.is-three-digit,.mushaf-ayah-number.is-three-digit{width:36px;min-width:36px;flex-basis:36px}
.mushaf-ayah-medallion-frame{position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none}
.mushaf-ayah-medallion-frame path{fill:color-mix(in srgb,var(--accent-primary,var(--accent)) 8%,var(--bg-surface));stroke:var(--accent-primary,var(--accent));stroke-width:1.15;stroke-linejoin:round}
.mushaf-ayah-medallion-frame circle{fill:none;stroke:color-mix(in srgb,var(--accent-primary,var(--accent)) 62%,transparent);stroke-width:.7}
.mushaf-fs-ayah-number-text{
 position:absolute;inset:0;display:grid;place-items:center;box-sizing:border-box;width:100%;height:100%;
 margin:0;padding:0;transform:none;font-family:"Plus Jakarta Sans",system-ui,sans-serif;
 font-size:11px;font-weight:700;line-height:1;text-align:center;direction:ltr;unicode-bidi:isolate;
 font-variant-numeric:tabular-nums;color:var(--accent-primary,var(--accent));pointer-events:none;
}
.mushaf-fs-qcf-line .mushaf-fs-ayah-medallion{width:32px;height:32px;min-width:32px;flex-basis:32px;margin:0 6px;vertical-align:middle}
.mushaf-fs-qcf-line .mushaf-fs-ayah-medallion.is-three-digit{width:36px;min-width:36px;flex-basis:36px}
.mushaf-fs-verse-arabic .mushaf-ayah-number{margin:0 6px}
@media(max-width:600px){
 .mushaf-fs-ayah-medallion,.mushaf-ayah-number{width:30px;height:30px;min-width:30px;flex-basis:30px;margin:0 5px}
 .mushaf-fs-ayah-medallion.is-three-digit,.mushaf-ayah-number.is-three-digit{width:36px;min-width:36px;flex-basis:36px}
 .mushaf-fs-qcf-line .mushaf-fs-ayah-medallion{width:30px;height:30px;min-width:30px;flex-basis:30px;margin:0 5px}
 .mushaf-fs-qcf-line .mushaf-fs-ayah-medallion.is-three-digit{width:36px;min-width:36px;flex-basis:36px}
}

/* Ornamental surah cartouche and calligraphic basmala. */
.mushaf-surah-cartouche{position:relative;width:min(100%,620px);height:58px;margin:4px auto 3px;display:grid;place-items:center;isolation:isolate}
.mushaf-surah-cartouche>svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.mushaf-cartouche-outer{fill:color-mix(in srgb,var(--accent-primary) 8%,var(--bg-surface));stroke:var(--accent-primary);stroke-width:1.35}
.mushaf-cartouche-inner{fill:none;stroke:color-mix(in srgb,var(--accent-primary) 52%,#c5a66d);stroke-width:.8}
.mushaf-cartouche-flourish{fill:none;stroke:#c5a66d;stroke-width:1.15;stroke-linecap:round;stroke-linejoin:round}
.mushaf-surah-cartouche-copy{position:relative;z-index:1;display:grid;gap:1px;justify-items:center;max-width:78%;text-align:center}
.mushaf-surah-cartouche-copy b{font:500 20px/1.15 "Amiri Quran","Noto Naskh Arabic",serif;color:var(--text-primary)}
.mushaf-surah-cartouche-copy span{font:600 9px/1.2 "DM Sans",sans-serif;letter-spacing:.025em;color:var(--text-muted)}
.mushaf-surah-cartouche-copy i{font-style:normal;color:#c5a66d}
.mushaf-bismillah-ornament{width:min(100%,620px);margin:2px auto 5px;display:flex;align-items:center;justify-content:center;gap:12px;color:var(--accent-primary)}
.mushaf-bismillah-ornament>span{height:1px;flex:1;max-width:120px;background:linear-gradient(90deg,transparent,color-mix(in srgb,var(--accent-primary) 62%,#c5a66d))}
.mushaf-bismillah-ornament>span:last-child{transform:scaleX(-1)}
.mushaf-bismillah-ornament b{font:500 20px/1.5 "Amiri Quran","Noto Naskh Arabic",serif;white-space:nowrap;color:var(--text-primary)}
/* Frosted-glass Surah index with a sticky search surface. */
.mushaf-surah-drawer--designed{background:color-mix(in srgb,var(--bg-surface) 84%,transparent);backdrop-filter:blur(24px) saturate(145%);-webkit-backdrop-filter:blur(24px) saturate(145%);border-right:1px solid color-mix(in srgb,var(--accent-primary) 24%,var(--border-hairline))}
.mushaf-surah-drawer--designed .mushaf-surah-drawer-header{position:sticky;top:0;z-index:3;flex:none;background:color-mix(in srgb,var(--bg-surface) 92%,transparent);backdrop-filter:blur(18px);padding:15px 16px}
.mushaf-surah-search{position:sticky;top:52px;z-index:2;display:flex;align-items:center;gap:9px;margin:10px 12px 0;padding:0 12px;height:42px;flex:none;border:1px solid var(--border-hairline);border-radius:11px;background:color-mix(in srgb,var(--bg-elevated) 88%,transparent);color:var(--text-muted)}
.mushaf-surah-search input{width:100%;min-width:0;height:100%;border:0;outline:0;background:transparent;color:var(--text-primary);font:500 11px "DM Sans",sans-serif}
.mushaf-surah-search input::placeholder{color:var(--text-muted)}
.mushaf-surah-drawer--designed .mushaf-drawer-jumps{position:sticky;top:104px;z-index:1;background:color-mix(in srgb,var(--bg-surface) 92%,transparent);padding:9px 14px}
.mushaf-surah-drawer--designed .mushaf-surah-list{flex:1;min-height:0;overscroll-behavior:contain;padding:8px 10px 20px}
.mushaf-surah-drawer--designed .mushaf-surah-list>button{gap:10px;padding:10px;border:1px solid transparent;border-radius:10px}
.mushaf-surah-drawer--designed .mushaf-surah-list>button.is-current{border-color:color-mix(in srgb,var(--accent-primary) 45%,var(--border-hairline));background:color-mix(in srgb,var(--accent-primary) 11%,var(--bg-elevated));box-shadow:inset 3px 0 var(--accent-primary)}
.mushaf-surah-drawer--designed .mushaf-surah-number{width:30px;height:30px;flex:0 0 30px;clip-path:polygon(25% 0,75% 0,100% 25%,100% 75%,75% 100%,25% 100%,0 75%,0 25%);border:0;border-radius:0;background:color-mix(in srgb,var(--accent-primary) 12%,var(--bg-elevated));color:var(--accent-primary);font:700 10px "Plus Jakarta Sans",sans-serif}
.mushaf-surah-number i{font-style:normal}
.mushaf-surah-drawer--designed .mushaf-surah-names{gap:3px}
.mushaf-surah-drawer--designed .mushaf-surah-names b{font:700 11px "Plus Jakarta Sans",sans-serif}
.mushaf-surah-drawer--designed .mushaf-surah-names small{font-size:9px}
.mushaf-surah-drawer--designed .mushaf-surah-list strong{font-size:20px;color:var(--text-primary)}
.mushaf-surah-page-badge{flex:none;padding:4px 6px;border:1px solid var(--border-hairline);border-radius:6px;color:var(--text-muted);font:600 8px "DM Sans",sans-serif;font-style:normal}
/* Page-by-page mode uses the viewport as its page frame; only Verse by Verse scrolls. */
.mushaf-fs-overlay{overflow:hidden!important;grid-template-rows:auto minmax(0,1fr) 58px}
.mushaf-fs-stage.is-page-by-page{display:flex;align-items:center;justify-content:center;overflow:hidden;padding:2px 8px;min-height:0}
.mushaf-fs-stage.is-page-by-page .mushaf-fs-sheet{width:100%;max-width:680px;height:100%;max-height:100%;margin:0 auto;padding:0 10px;display:flex;align-items:center;justify-content:center;overflow:hidden}
.mushaf-fs-stage.is-page-by-page .mushaf-fs-qcf-page{width:100%;max-width:640px;margin:0 auto;gap:0;justify-content:center}
.mushaf-fs-stage.is-page-by-page .mushaf-fs-qcf-line{min-height:0;line-height:1.72;font-size:clamp(16px,2.35vh,23px);gap:2px}
.mushaf-fs-stage.is-page-by-page .mushaf-fs-unicode-lines{width:100%;max-width:640px;display:flex;flex-direction:column;justify-content:center;gap:0}
.mushaf-fs-stage.is-page-by-page .mushaf-fs-unicode-lines .mushaf-fs-qcf-line{min-height:0;line-height:1.72;font-size:clamp(16px,2.35vh,23px);white-space:nowrap;flex-wrap:nowrap}
.mushaf-fs-stage.is-page-by-page .mushaf-fs-unicode-flow{width:100%;max-width:640px;font-size:clamp(16px,2.35vh,23px);line-height:1.72}
.mushaf-fs-stage.is-page-by-page .mushaf-surah-cartouche{height:38px;margin:1px auto}
.mushaf-fs-stage.is-page-by-page .mushaf-surah-cartouche-copy b{font-size:15px}
.mushaf-fs-stage.is-page-by-page .mushaf-surah-cartouche-copy span{font-size:8px}
.mushaf-fs-stage.is-page-by-page .mushaf-bismillah-ornament{margin:0 auto 1px;gap:8px}
.mushaf-fs-stage.is-page-by-page .mushaf-bismillah-ornament b{font-size:16px;line-height:1.2}
.mushaf-fs-footer{height:58px;min-height:58px;display:flex;align-items:center}
.mushaf-fs-footer>.mushaf-save-status{position:absolute;left:12px;bottom:2px;color:var(--text-muted);font:500 9px "DM Sans",sans-serif}
.mushaf-fs-footer>.mushaf-log-message{left:auto;right:12px;bottom:2px;text-align:right}
.mushaf-fs-footer .mushaf-fs-page-pill{padding:2px 8px}
@media(max-width:700px){
 .mushaf-surah-cartouche{height:50px}
 .mushaf-surah-cartouche-copy b{font-size:18px}
 .mushaf-bismillah-ornament b{font-size:17px}
 .mushaf-fs-stage.is-page-by-page{padding:1px 3px}
 .mushaf-fs-stage.is-page-by-page .mushaf-fs-sheet{padding:0 2px}
 .mushaf-fs-stage.is-page-by-page .mushaf-fs-qcf-line,.mushaf-fs-stage.is-page-by-page .mushaf-fs-unicode-lines .mushaf-fs-qcf-line{font-size:clamp(16px,2.35vh,23px);line-height:1.72}
 .mushaf-fs-stage.is-page-by-page .mushaf-surah-cartouche{height:34px}
 .mushaf-fs-stage.is-page-by-page .mushaf-surah-cartouche-copy b{font-size:13px}
 .mushaf-fs-stage.is-page-by-page .mushaf-bismillah-ornament b{font-size:14px}
 .mushaf-fs-footer>.mushaf-save-status{left:5px;font-size:8px}
 .mushaf-fs-footer>.mushaf-log-message{right:5px;font-size:8px}
}

/* Centered, balanced Mushaf layout and Surah-length verse reading. */
.mushaf-fs-overlay{grid-template-rows:88px minmax(0,1fr) 68px}
.mushaf-fs-header{height:88px;min-height:88px;max-width:none;padding:7px 22px 8px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;overflow:visible}
.mushaf-fs-top-row{width:min(100%,1180px);display:flex;align-items:center;justify-content:space-between;gap:16px;margin:0 auto}
.mushaf-fs-header-left,.mushaf-fs-header-right{display:flex;align-items:center;gap:12px}
.mushaf-fs-tabs{display:flex;align-items:center;justify-content:center;gap:4px;padding:3px;border:1px solid var(--border-hairline);border-radius:999px;background:var(--bg-elevated);margin:0 auto}
.mushaf-fs-tabs button{height:28px;min-height:28px;padding:0 17px;border:0;border-radius:999px;background:transparent;color:var(--text-muted);font:600 11px/1 "DM Sans",sans-serif}
.mushaf-fs-tabs button.is-active{background:var(--bg-canvas);color:var(--text-primary);box-shadow:0 1px 5px rgba(0,0,0,.12)}
.mushaf-fs-stage{padding:24px 20px;display:block;overflow-y:auto}
.mushaf-fs-stage.is-verse-by-verse{display:block;padding:24px 20px 32px}
.mushaf-fs-stage.is-verse-by-verse .mushaf-fs-sheet{width:100%;max-width:860px;height:auto!important;max-height:none!important;min-height:0;display:block;overflow:visible;padding:0 30px 34px;margin:0 auto;background:transparent;border:0;box-shadow:none;border-radius:0;text-align:left}
.mushaf-fs-verse-list{max-width:780px;margin:0 auto;text-align:left}
.mushaf-fs-surah-intro{text-align:center;padding:22px 12px 28px;margin:0 auto 6px;border-bottom:1px solid var(--border-hairline)}
.mushaf-fs-surah-intro>span{font:700 9px/1.4 "DM Sans",sans-serif;letter-spacing:.2em;color:var(--text-muted)}
.mushaf-fs-surah-intro h1{margin:7px 0 2px;font:600 28px/1.25 "DM Sans",sans-serif;color:var(--text-primary)}
.mushaf-fs-surah-intro p{margin:0 0 8px;color:var(--text-secondary);font:400 12px/1.5 "DM Sans",sans-serif}
.mushaf-fs-surah-intro p i{font-style:normal;padding:0 5px;color:var(--text-muted)}
.mushaf-fs-surah-intro small{font:400 10px/1.5 "DM Sans",sans-serif;color:var(--text-muted)}
.mushaf-fs-verse-row{padding:26px 4px;border-bottom:1px solid var(--border-hairline)}
.mushaf-fs-verse-row:last-child{border-bottom:0}
.mushaf-fs-verse-actionbar{max-width:100%;display:flex;align-items:center;justify-content:space-between;margin:0 0 12px;gap:10px}
.mushaf-fs-verse-arabic-line{display:flex;align-items:center;justify-content:center;gap:16px;width:100%;direction:ltr}
.mushaf-fs-verse-actions{flex-direction:row;flex:0 0 auto;gap:8px}
.mushaf-fs-verse-arabic{flex:1;text-align:center;font-size:clamp(23px,2.4vw,31px);line-height:2.05}
.mushaf-fs-verse-translation{max-width:720px;margin:12px auto 0;font-size:15px;line-height:1.8}
.mushaf-fs-verse-translation small{white-space:nowrap}
.mushaf-fs-footer{height:68px;min-height:68px;max-width:none;justify-content:center;padding:0 16px}
.mushaf-fs-footer .mushaf-fs-page-pill{min-width:220px;justify-content:center}
@media(max-width:700px){
 .mushaf-fs-overlay{grid-template-rows:100px minmax(0,1fr) 62px}
 .mushaf-fs-header{height:100px;min-height:100px;padding:6px 8px;gap:6px}
 .mushaf-fs-top-row{gap:4px}
 .mushaf-fs-header-left,.mushaf-fs-header-right{gap:4px}
 .mushaf-fs-page-meta{font-size:8px}
 .mushaf-fs-surah-trigger{font-size:10px!important;padding:0 4px!important}
 .mushaf-fs-header-right .mushaf-mode-switch button{padding:0 6px;font-size:9px}
 .mushaf-fs-tabs button{padding:0 13px;font-size:10px}
 .mushaf-fs-stage.is-verse-by-verse{padding:10px 8px 22px}
 .mushaf-fs-stage.is-verse-by-verse .mushaf-fs-sheet{padding:0 4px 20px}
 .mushaf-fs-surah-intro{padding:18px 8px 20px}
 .mushaf-fs-surah-intro h1{font-size:23px}
 .mushaf-fs-verse-row{padding:19px 2px}
 .mushaf-fs-verse-arabic-line{gap:7px}
 .mushaf-fs-verse-actions{gap:4px}
 .mushaf-fs-verse-actions button{width:27px;height:27px}
 .mushaf-fs-verse-arabic{font-size:23px;line-height:2}
 .mushaf-fs-verse-translation{font-size:14px;line-height:1.7}
 .mushaf-fs-footer{height:62px;min-height:62px}
}

/* Final Full-Screen Mushaf containment overrides. */
.mushaf-fs-overlay,.mushaf-fs-overlay *{box-sizing:border-box}
.mushaf-fs-header,.mushaf-fs-stage,.mushaf-fs-footer,.mushaf-surah-banner,.mushaf-surah-cartouche,.mushaf-bismillah,.mushaf-bismillah-ornament,.mushaf-surah-drawer{box-sizing:border-box;max-width:100%;min-width:0}
.mushaf-fs-overlay{max-width:100vw;overflow-x:hidden!important}
.mushaf-fs-header{width:100%;max-width:100%;min-width:0;overflow-x:hidden}
.mushaf-fs-top-row,.mushaf-fs-header-left,.mushaf-fs-header-right,.mushaf-fs-stage,.mushaf-fs-sheet,.mushaf-fs-footer{min-width:0;max-width:100%}
.mushaf-fs-stage{width:100%;overflow-x:hidden!important}
.mushaf-fs-sheet,.mushaf-fs-verse-list,.mushaf-fs-verse-row,.mushaf-fs-verse-actionbar,.mushaf-fs-verse-arabic-line,.mushaf-fs-verse-arabic,.mushaf-fs-verse-translation,.mushaf-surah-cartouche-copy{box-sizing:border-box;min-width:0;max-width:100%}
.mushaf-surah-drawer{width:min(360px,92vw)!important;max-width:92vw!important;overflow-x:hidden!important}
.mushaf-surah-list,.mushaf-surah-list>button,.mushaf-surah-names{box-sizing:border-box;min-width:0;max-width:100%;overflow-x:hidden}
.mushaf-fs-header button,.mushaf-fs-footer button{box-sizing:border-box;max-width:100%;min-width:0;padding:6px 10px;font-size:12px;white-space:nowrap}
.mushaf-fs-ayah-medallion,.mushaf-ayah-number{display:inline-flex;align-items:center;justify-content:center;vertical-align:middle;flex:0 0 32px;flex-shrink:0;width:32px!important;height:32px;min-width:32px!important;max-width:32px!important;box-sizing:border-box;margin:0 5px;padding:0}
.mushaf-fs-ayah-medallion.is-three-digit,.mushaf-ayah-number.is-three-digit{width:32px!important;min-width:32px!important;max-width:32px!important;flex-basis:32px}
.mushaf-ayah-medallion-frame{display:block;width:32px;height:32px;max-width:32px}
.mushaf-fs-ayah-number-text{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-family:"Plus Jakarta Sans",system-ui,sans-serif;font-size:11px;font-weight:700;line-height:1;font-variant-numeric:tabular-nums;text-align:center;direction:ltr;unicode-bidi:isolate}
.mushaf-fs-footer .mushaf-fs-page-pill{width:min(100%,540px);max-width:100%;min-width:0;display:flex;align-items:center;justify-content:space-between;gap:6px;padding:5px 7px;box-sizing:border-box}
.mushaf-fs-footer .mushaf-fs-page-pill button{flex:0 1 auto;min-width:0;max-width:100%;padding:6px 10px;font-size:12px}
.mushaf-fs-footer .mushaf-save-status{position:static!important;display:inline-flex;align-items:center;justify-content:center;max-width:100%;min-width:0;margin:0 auto;padding:6px 12px;border:1px solid var(--border-hairline);border-radius:999px;background:var(--bg-elevated);font:500 10px/1.2 "DM Sans",sans-serif;white-space:nowrap}
@media(max-width:480px){
 .mushaf-fs-header{padding:5px 6px;gap:4px}
 .mushaf-fs-top-row{flex-wrap:wrap;justify-content:center;row-gap:4px}
 .mushaf-fs-header-left,.mushaf-fs-header-right{gap:4px;max-width:100%}
 .mushaf-fs-header button,.mushaf-fs-footer button{padding:6px 7px;font-size:10px}
 .mushaf-fs-tabs{max-width:100%;gap:3px}
 .mushaf-fs-tabs button{padding:6px 10px;font-size:10px}
 .mushaf-fs-stage{padding-left:5px;padding-right:5px}
 .mushaf-fs-sheet{width:100%;padding-left:8px;padding-right:8px}
 .mushaf-fs-footer .mushaf-fs-page-pill{gap:3px;padding:4px}
 .mushaf-fs-footer .mushaf-fs-page-pill button{padding:6px;font-size:9px}
 .mushaf-fs-footer .mushaf-save-status{padding:5px 7px;font-size:8px}
}


`;