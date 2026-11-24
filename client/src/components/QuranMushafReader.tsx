import { Fragment, type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bookmark, Copy, Search, WifiOff, X } from 'lucide-react';
import { api, json } from '../lib/api';
import { QURAN_JUZ_STARTS, QURAN_SURAHS, getAyahLocation, getPageJuz } from '../data/quranSurahs';

type Settings = Record<string, string>;
type TajweedSegment = { text: string; className: string };
type MushafAyah = { number: number; numberInSurah: number; surahNumber: number; surahName: string; arabicName: string; text: string; tajweedText?: string; tajweedSegments?: TajweedSegment[]; translation: string; translations?: Array<{ id: number; name: string; text: string }>; };
type MushafPage = { page: number; juz: number; tajweedComplete?: boolean; qcfAvailable?: boolean; translationSource?: string; ayahs: MushafAyah[]; offlineFallback?: boolean };
type Props = { settings: Settings; settingsReady: boolean; onLogged: () => void; autoOpen?: boolean };
const CACHE_PREFIX = 'atlas_mushaf_page_v9_';
const pageMemoryCache = new Map<number, MushafPage>();
const HIFZ_KEY = 'atlas_hifz_bookmark_v2';
const MURAJAAH_KEY = 'atlas_murajaah_bookmark_v2';
const clampPage = (value: number) => Math.max(1, Math.min(604, Number.isInteger(value) ? value : 1));
const arabicNumber = (value: number) => String(value).replace(/\d/g, digit => '٠١٢٣٤٥٦٧٨٩'[Number(digit)]);
const TAJWEED_CLASSES = new Set(['tj-hamza','tj-silent','tj-madd','tj-qalqalah','tj-ghunnah','tj-ikhfa','tj-idgham']);
function renderTajweedMarkup(markup: string, segments?: TajweedSegment[], fallback = ''): ReactNode {
  const source = String(markup || '');
  const parsed = segments?.length ? segments : (() => {
    const classes: Record<string,string> = { h:'tj-hamza',s:'tj-silent',l:'tj-silent',n:'tj-madd',p:'tj-madd',m:'tj-madd',o:'tj-madd',q:'tj-qalqalah',g:'tj-ghunnah',c:'tj-idgham',f:'tj-ikhfa',i:'tj-ikhfa',w:'tj-ghunnah',a:'tj-ghunnah',u:'tj-idgham',d:'tj-idgham',b:'tj-idgham' };
    const result: TajweedSegment[] = [];
    const pattern = /\[([a-z])(?::\d+)?\[([\s\S]*?)\]\]?/g;
    let cursor = 0, match;
    while ((match = pattern.exec(source))) {
      if (match.index > cursor) result.push({ text: source.slice(cursor, match.index), className: '' });
      result.push({ text: match[2], className: classes[match[1]] || '' });
      cursor = pattern.lastIndex;
    }
    if (cursor < source.length) result.push({ text: source.slice(cursor), className: '' });
    return result;
  })();
  if (!parsed.length || (parsed.length === 1 && !parsed[0].className && !source.includes('['))) return stripAyahEndMarker(fallback || source);
  return <>{parsed.map((segment, index) => {
    const className = TAJWEED_CLASSES.has(segment.className) ? segment.className : '';
    const text = stripAyahEndMarker(String(segment.text || ''));
    return className ? <span key={index} className={className}>{text}</span> : <Fragment key={index}>{text}</Fragment>;
  })}</>;
}
const stripAyahEndMarker = (value: string) => value.replace(/\u06DD/g, '').trim();
const sanitizeMushafPage = (payload: MushafPage): MushafPage => ({
  ...payload,
  ayahs: (payload.ayahs || []).map(ayah => ({
    ...ayah,
    text: stripAyahEndMarker(ayah.text || ''),
    tajweedText: ayah.tajweedText || '',
    tajweedSegments: ayah.tajweedSegments?.map(segment => ({ text: String(segment.text || ''), className: TAJWEED_CLASSES.has(segment.className) ? segment.className : '' })),
    translation: stripAyahEndMarker(ayah.translation || ''),
    translations: ayah.translations?.map(translation => ({ ...translation, text: stripAyahEndMarker(translation.text || '') })),
  }))
});
function AyahMedallion({ number, className }: { number: number; className: string }) {
  return <span className={'mushaf-medallion ' + (number >= 100 ? 'mushaf-medallion--wide ' : '') + className} aria-label={'Ayah ' + number}>
    <span>{arabicNumber(number)}</span>
  </span>;
}
function BismillahOrnament() {
  return <div className="mushaf-bismillah" lang="ar" dir="rtl"><b>بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ</b><span>In the Name of Allah—the Most Compassionate, Most Merciful</span></div>;
}
const readBookmark = (key: string) => { try { const value = JSON.parse(localStorage.getItem(key) || '{}'); return { page: clampPage(Number(value.page) || 1), surah: Number(value.surah) || 1, ayah: Number(value.ayah) || 1 }; } catch { return { page: 1, surah: 1, ayah: 1 }; } };
function lagosDate() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
export function QuranMushafReader({ settings, settingsReady, onLogged, autoOpen = false }: Props) {
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
  const [surahSearch, setSurahSearch] = useState('');
  const [sidebarTab, setSidebarTab] = useState<'surah' | 'juz' | 'page'>('surah');
  const [sidebarOpen, setSidebarOpen] = useState(() => window.matchMedia('(min-width: 768px)').matches);
  const [starredAyahs, setStarredAyahs] = useState<Array<{ surah: number; ayah: number }>>(() => { try { return JSON.parse(localStorage.getItem('atlas_mushaf_starred_ayahs_v1') || '[]'); } catch { return []; } });
  const [selected, setSelected] = useState<{ surah: number; ayah: number } | null>(null);
  const [readingMode, setReadingMode] = useState<'translation' | 'reading'>('reading');
  const [arabicFontSize, setArabicFontSize] = useState(() => {
    try { const saved = Number(localStorage.getItem('atlas_mushaf_arabic_font_size_v2')); return [16, 18, 20, 23, 26, 30, 34].includes(saved) ? saved : 20; }
    catch { return 20; }
  });
  const [pageInput, setPageInput] = useState(String(page));
  const readerRef = useRef<HTMLDivElement | null>(null);
  const autoLoggedPagesRef = useRef(new Set<string>());

  useEffect(() => {
    pageMemoryCache.clear();
    try {
      const staleKeys: string[] = [];
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (key && (/^atlas_mushaf_page_v\d+_/.test(key) || /^atlas_mushaf_cache_/.test(key) || /^atlas_quran_page_cache_/.test(key))) staleKeys.push(key);
      }
      staleKeys.forEach(key => localStorage.removeItem(key));
    } catch { /* local storage is optional */ }
  }, []);
  const selectedAyah = pageData?.ayahs.find(item => item.surahNumber === selected?.surah && item.numberInSurah === selected?.ayah) || null;
  const pageJuz = useMemo(() => pageData?.juz || getPageJuz(page) || 1, [pageData, page]);
  const bookmark = mode === 'hifz' ? hifzMark : murajaahMark;
  const fontSteps = [16, 18, 20, 23, 26, 30, 34];
  const changeFontSize = (direction: -1 | 1) => setArabicFontSize(current => {
    const index = fontSteps.indexOf(current);
    const next = fontSteps[Math.max(0, Math.min(fontSteps.length - 1, (index < 0 ? 2 : index) + direction))];
    try { localStorage.setItem('atlas_mushaf_arabic_font_size_v2', String(next)); } catch { /* storage is optional */ }
    return next;
  });

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
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') { setSidebarOpen(false); setFullScreen(false); } };
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
    if (!fullScreen) return;
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
  }, [page, fullScreen]);

  const activeSurahNumber = selected?.surah || pageData?.ayahs?.[0]?.surahNumber || bookmark.surah || 1;
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
    const value = clampPage(next);
    if (value !== page) { setLoading(true); setPageData(null); setPageError(''); }
    setPage(value); setSelected(location ? { surah: location.surahNumber, ayah: location.numberInSurah } : null);
    updateBookmark(value, location ? { surahNumber: location.surahNumber, numberInSurah: location.numberInSurah } : null);
  };
  const changeMode = (next: 'hifz' | 'murajaah') => { if (next !== mode) { const active = mode === 'hifz' ? hifzMark : murajaahMark; const target = next === 'hifz' ? hifzMark : murajaahMark; updateBookmark(active.page, { surahNumber: active.surah, numberInSurah: active.ayah }); if (target.page !== page) { setLoading(true); setPageData(null); setPageError(''); } setMode(next); } };
  const openReader = (next: 'hifz' | 'murajaah') => {
    const mark = next === 'hifz' ? hifzMark : murajaahMark;
    setMode(next);
    setPage(mark.page);
    setPageInput(String(mark.page));
    setSelected(mark.surah && mark.ayah ? { surah: mark.surah, ayah: mark.ayah } : null);
    setSidebarOpen(false);
    setLoading(true); setPageData(null); setPageError('');
    setFullScreen(true);
  };
  const autoOpenHandled = useRef(false);
  useEffect(() => {
    if (!autoOpen || !settingsReady || autoOpenHandled.current) return;
    autoOpenHandled.current = true;
    openReader('hifz');
  }, [autoOpen, settingsReady]);
  const changeReadingMode = (next: 'translation' | 'reading') => { if (next !== readingMode) { updateBookmark(page, selectedAyah); setReadingMode(next); } };
  const jumpSurah = (number: number) => { const item = QURAN_SURAHS[number - 1]; if (item) { changePage(item.pageStart, { surahNumber: number, numberInSurah: 1 }); setSidebarOpen(false); setSurahSearch(''); } };
  const jumpJuz = (number: number) => { const start = QURAN_JUZ_STARTS[number - 1]; if (start) changePage(getAyahLocation(start[1], start[2])?.page || 1); };
  const selectAyah = (ayah: MushafAyah) => { const ayahPage = getAyahLocation(ayah.surahNumber, ayah.numberInSurah)?.page || page; setSelected({ surah: ayah.surahNumber, ayah: ayah.numberInSurah }); setPage(ayahPage); updateBookmark(ayahPage, ayah); };
  const toggleStarredAyah = (ayah: MushafAyah) => setStarredAyahs(current => {
    const exists = current.some(item => item.surah === ayah.surahNumber && item.ayah === ayah.numberInSurah);
    const next = exists ? current.filter(item => !(item.surah === ayah.surahNumber && item.ayah === ayah.numberInSurah)) : [...current, { surah: ayah.surahNumber, ayah: ayah.numberInSurah }];
    try { localStorage.setItem('atlas_mushaf_starred_ayahs_v1', JSON.stringify(next)); } catch { /* storage is optional */ }
    return next;
  });
  const quickJump = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const target = clampPage(Number(pageInput)); changePage(target); setSidebarOpen(false); };
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
  const readerContent = <div className="mushaf-app">
    <header className="mushaf-topbar">
      <button type="button" className="mushaf-surah-trigger" onClick={() => setSidebarOpen(value => !value)} aria-expanded={sidebarOpen}>
        <span>{activeSurahNumber}. {activeSurah?.transliteration || 'Al-Fatihah'}</span><span aria-hidden="true">▾</span>
      </button>
      <div className="mushaf-topbar-center"><Bookmark size={14}/><span>Page {page} · Juz {pageJuz}</span><span className="mushaf-autosaved">Auto-saved</span></div>
      <div className="mushaf-topbar-actions">
        <div className="mushaf-view-switch" role="group" aria-label="Reading view">
          <button type="button" className={readingMode === 'translation' ? 'is-active' : ''} onClick={() => changeReadingMode('translation')}>Verse by Verse</button>
          <button type="button" className={readingMode === 'reading' ? 'is-active' : ''} onClick={() => changeReadingMode('reading')}>Page by Page</button>
        </div>
        <div className="mushaf-mode-switch" role="group" aria-label="Bookmark mode">
          <button type="button" className={mode === 'hifz' ? 'is-active' : ''} onClick={() => changeMode('hifz')}>Hifz</button>
          <button type="button" className={mode === 'murajaah' ? 'is-active' : ''} onClick={() => changeMode('murajaah')}>Muraja'ah</button>
        </div>
        <button type="button" className="mushaf-font-button" onClick={() => changeFontSize(-1)} aria-label="Decrease Arabic font size">A−</button>
        <button type="button" className="mushaf-font-button" onClick={() => changeFontSize(1)} aria-label="Increase Arabic font size">A+</button>
        <button type="button" className="mushaf-exit" onClick={() => setFullScreen(false)} aria-label="Exit Qur’an reader"><X size={16}/></button>
      </div>
    </header>
    <div className="mushaf-workspace">
      {sidebarOpen && <button type="button" className="mushaf-sidebar-scrim" aria-label="Close Surah navigation" onClick={() => setSidebarOpen(false)}/>}
      {sidebarOpen && <aside className="mushaf-sidebar" aria-label="Qur’an navigation">
        <div className="mushaf-sidebar-tabs" role="tablist" aria-label="Browse Qur’an">
          <button type="button" role="tab" aria-selected={sidebarTab === 'surah'} className={sidebarTab === 'surah' ? 'is-active' : ''} onClick={() => setSidebarTab('surah')}>Surah</button>
          <button type="button" role="tab" aria-selected={sidebarTab === 'juz'} className={sidebarTab === 'juz' ? 'is-active' : ''} onClick={() => setSidebarTab('juz')}>Juz</button>
          <button type="button" role="tab" aria-selected={sidebarTab === 'page'} className={sidebarTab === 'page' ? 'is-active' : ''} onClick={() => setSidebarTab('page')}>Page</button>
        </div>
        <label className="mushaf-sidebar-search"><Search size={15}/><input value={surahSearch} onChange={event => setSurahSearch(event.target.value)} placeholder={sidebarTab === 'surah' ? 'Search Surah' : sidebarTab === 'juz' ? 'Search Juz' : 'Search page'} aria-label="Search Qur’an navigation"/></label>
        <div className="mushaf-sidebar-list">
          {sidebarTab === 'surah' && QURAN_SURAHS.filter(item => { const q=surahSearch.trim().toLowerCase(); return !q || String(item.number)===q || item.transliteration.toLowerCase().includes(q) || item.english.toLowerCase().includes(q); }).map(item => <button type="button" key={item.number} className={item.number === activeSurahNumber ? 'is-active' : ''} onClick={() => { jumpSurah(item.number); setSurahSearch(''); }}>
            <span className="mushaf-sidebar-number">{item.number}</span><span className="mushaf-sidebar-name"><b>{item.transliteration}</b><small>{item.ayahs} ayahs · {item.revelation}</small></span><strong lang="ar" dir="rtl">{item.arabic}</strong>
          </button>)}
          {sidebarTab === 'juz' && QURAN_JUZ_STARTS.filter(([juz]) => !surahSearch.trim() || String(juz).includes(surahSearch.trim())).map(([juz,surah,ayah]) => <button type="button" key={juz} onClick={() => { jumpJuz(juz); setSurahSearch(''); }}><span className="mushaf-sidebar-number">{juz}</span><span className="mushaf-sidebar-name"><b>Juz {juz}</b><small>{QURAN_SURAHS[surah-1]?.transliteration} · Ayah {ayah}</small></span></button>)}
          {sidebarTab === 'page' && <form className="mushaf-page-jump" onSubmit={quickJump}><label htmlFor="mushaf-page-number">Go to page (1–604)</label><div><input id="mushaf-page-number" type="number" min="1" max="604" value={pageInput} onChange={event => setPageInput(event.target.value)}/><button type="submit">Go</button></div><div className="mushaf-page-grid">{Array.from({length:604},(_,index)=>index+1).filter(value=>!surahSearch.trim()||String(value).includes(surahSearch.trim())).map(value=><button type="button" key={value} className={value===page?'is-active':''} onClick={()=>{changePage(value);setSurahSearch('');setSidebarOpen(false);}}>{value}</button>)}</div></form>}
        </div>
      </aside>}
      <main className="mushaf-main">
        <div className="mushaf-canvas" ref={readerRef}>
          {loading && <div className="mushaf-loading" role="status" aria-label={'Loading page ' + page}>Loading Qur’an page {page}…</div>}
          {!loading && pageError && <div className="mushaf-error" role="alert"><WifiOff size={22}/><p>{pageError}</p><button type="button" onClick={() => changePage(page)}>Retry</button></div>}
          {!loading && pageData && readingMode === 'translation' && <section className="mushaf-verse-view" dir="ltr" lang="en">
            <header className="mushaf-surah-hero">
              <b className="mushaf-hero-arabic" lang="ar" dir="rtl">{activeSurah?.arabic || ''}</b>
              <div className="mushaf-hero-copy"><h1>{activeSurahNumber}. Surah {activeSurah?.transliteration || 'Surah'}</h1><p>{activeSurah?.english || ''} · {activeSurah?.ayahs || surahAyahs.length} Ayahs</p></div>
              <div className="mushaf-hero-modes"><button type="button" className={mode === 'hifz' ? 'is-active' : ''} onClick={() => changeMode('hifz')}>Hifz</button><button type="button" className={mode === 'murajaah' ? 'is-active' : ''} onClick={() => changeMode('murajaah')}>Muraja'ah</button></div>
            </header>
            {activeSurahNumber !== 9 && <BismillahOrnament/>}
            {surahLoading && <p className="mushaf-loading" role="status">Loading {activeSurah?.transliteration || 'Surah'}…</p>}
            {!surahLoading && surahError && <div className="mushaf-error" role="alert"><p>{surahError}</p><button type="button" onClick={() => setReadingMode('reading')}>Return to Page by Page</button></div>}
            {!surahLoading && surahAyahs.map(ayah => <article className="mushaf-verse-row" key={ayah.surahNumber + ':' + ayah.numberInSurah}>
              <div className="mushaf-verse-top">
                <div className="mushaf-verse-tools"><small>{ayah.surahNumber}:{ayah.numberInSurah}</small>
                  <button type="button" aria-label="Bookmark verse" aria-pressed={starredAyahs.some(item => item.surah === ayah.surahNumber && item.ayah === ayah.numberInSurah)} onClick={() => toggleStarredAyah(ayah)}><Bookmark size={15}/></button>
                  <button type="button" aria-label="Copy verse" onClick={() => { void navigator.clipboard?.writeText(ayah.text + '\\n' + ayah.surahNumber + ':' + ayah.numberInSurah); }}><Copy size={14}/></button>
                </div>
                <button type="button" className="mushaf-verse-arabic" dir="rtl" lang="ar" style={{ fontSize: arabicFontSize + 'px' }} onClick={() => selectAyah(ayah)} aria-pressed={selected?.surah === ayah.surahNumber && selected?.ayah === ayah.numberInSurah}>
                  {renderTajweedMarkup(ayah.tajweedText || '', ayah.tajweedSegments, ayah.text)}<AyahMedallion className="mushaf-verse-medallion" number={ayah.numberInSurah}/>
                </button>
              </div>
              <p className="mushaf-verse-translation">{ayah.translation || 'Translation unavailable.'}</p>
            </article>)}
          </section>}
          {!loading && pageData && readingMode === 'reading' && <section className="mushaf-page-view" dir="rtl" lang="ar" style={{ fontSize: arabicFontSize + 'px' }}>
            <div className="mushaf-page-text">{pageData.ayahs.map((ayah, index) => {
              const surah = QURAN_SURAHS[ayah.surahNumber - 1];
              const startsSurah = ayah.numberInSurah === 1;
              return <Fragment key={ayah.surahNumber + ':' + ayah.numberInSurah}>
                {startsSurah && <header className="mushaf-page-surah-banner"><b>{surah?.arabic || ayah.arabicName}</b><span>{ayah.surahNumber}. {surah?.transliteration || ayah.surahName}</span></header>}
                {startsSurah && ayah.surahNumber !== 9 && <div className="mushaf-page-bismillah">بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ</div>}
                {index === 0 && !startsSurah && <div className="mushaf-page-context">{surah?.transliteration || ayah.surahName}</div>}
                <span className="mushaf-page-ayah">{renderTajweedMarkup(ayah.tajweedText || '', ayah.tajweedSegments, ayah.text)}<AyahMedallion className="mushaf-page-medallion" number={ayah.numberInSurah}/></span>{' '}
              </Fragment>;
            })}</div>
            <footer className="mushaf-page-footer" dir="ltr">— Page {page} · Juz {pageJuz} —</footer>
          </section>}
        </div>
        {readingMode === 'reading' && <nav className="mushaf-page-arrows" aria-label="Page navigation">
          <button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => changePage(page - 1)}>▲</button>
          <button type="button" aria-label="Next page" disabled={page >= 604} onClick={() => changePage(page + 1)}>▼</button>
        </nav>}
      </main>
    </div>
  </div>;
  return <>
    <section className="mushaf-launch-card faith-section-secondary" aria-label="Continue Qur’an reading"><div className="mushaf-launch-copy"><h3>Qur’an · Hifz & Muraja’ah</h3><p>Your reading positions are saved automatically.</p><div className="mushaf-bookmark-positions"><span>Hifz · Page {hifzMark.page}</span><span>Muraja’ah · Page {murajaahMark.page}</span></div></div><div className="mushaf-launch-actions"><button type="button" className="button button--primary" onClick={() => openReader('hifz')}>Continue Hifz</button><button type="button" className="button button--secondary" onClick={() => openReader('murajaah')}>Continue Muraja’ah</button></div></section>
    {fullScreen && createPortal(<div className="mushaf-fs-overlay" role="dialog" aria-modal="true" aria-label="Full-screen Qur’an Mushaf">{readerContent}</div>, document.body)}
  </>;
}

