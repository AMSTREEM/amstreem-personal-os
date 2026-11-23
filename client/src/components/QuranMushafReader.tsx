import { Fragment, type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bookmark, ChevronLeft, ChevronRight, Copy, Search, WifiOff, X } from 'lucide-react';
import { api, json } from '../lib/api';
import { QURAN_JUZ_STARTS, QURAN_SURAHS, getAyahLocation, getPageJuz } from '../data/quranSurahs';
import { triggerSparkBurst } from './fx/SparkBurst';

type Settings = Record<string, string>;
type MushafWord = { text: string; codeV2: string; lineNumber: number; pageNumber: number; position: number; charTypeName: string };
type MushafAyah = { number: number; numberInSurah: number; surahNumber: number; surahName: string; arabicName: string; text: string; translation: string; translations?: Array<{ id: number; name: string; text: string }>; words?: MushafWord[] };
type MushafPage = { page: number; juz: number; qcfAvailable?: boolean; translationSource?: string; ayahs: MushafAyah[]; offlineFallback?: boolean };
type MushafLineWord = MushafWord & { surahNumber: number; numberInSurah: number };
const escapeGlyphHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
type Props = { settings: Settings; settingsReady: boolean; onLogged: () => void; autoOpen?: boolean };
const CACHE_PREFIX = 'atlas_mushaf_page_v5_';
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
    words: ayah.words?.map(word => ({ ...word, text: stripAyahEndMarker(word.text || ''), codeV2: word.codeV2 || '' }))
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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [surahSearch, setSurahSearch] = useState('');
  const [contentsTab, setContentsTab] = useState<'surah' | 'juz' | 'bookmarks'>('surah');
  const [sidebarTab, setSidebarTab] = useState<'surah' | 'juz' | 'page'>('surah');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [hudVisible, setHudVisible] = useState(false);
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
    setDrawerOpen(false);
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
  const jumpSurah = (number: number) => { const item = QURAN_SURAHS[number - 1]; if (item) { changePage(item.pageStart, { surahNumber: number, numberInSurah: 1 }); setDrawerOpen(false); setSurahSearch(''); } };
  const jumpJuz = (number: number) => { const start = QURAN_JUZ_STARTS[number - 1]; if (start) changePage(getAyahLocation(start[1], start[2])?.page || 1); };
  const selectAyah = (ayah: MushafAyah) => { const ayahPage = getAyahLocation(ayah.surahNumber, ayah.numberInSurah)?.page || page; setSelected({ surah: ayah.surahNumber, ayah: ayah.numberInSurah }); setPage(ayahPage); updateBookmark(ayahPage, ayah); };
  const toggleStarredAyah = (ayah: MushafAyah) => setStarredAyahs(current => {
    const exists = current.some(item => item.surah === ayah.surahNumber && item.ayah === ayah.numberInSurah);
    const next = exists ? current.filter(item => !(item.surah === ayah.surahNumber && item.ayah === ayah.numberInSurah)) : [...current, { surah: ayah.surahNumber, ayah: ayah.numberInSurah }];
    try { localStorage.setItem('atlas_mushaf_starred_ayahs_v1', JSON.stringify(next)); } catch { /* storage is optional */ }
    return next;
  });
  const quickJump = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const target = clampPage(Number(pageInput)); changePage(target); setHudVisible(false); };
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
    <div className="mushaf-desktop-shell">
      <header className="mushaf-desktop-header" onClick={event => event.stopPropagation()}>
        <button type="button" className="mushaf-desktop-surah-trigger" onClick={() => setSidebarOpen(value => !value)}>{activeSurahNumber}. {activeSurah?.transliteration || 'Al-Fatihah'} ▾</button>
        <div className="mushaf-desktop-header-center"><span>Page {page} · Juz {pageJuz}</span><span className="mushaf-header-autosaved">Auto-saved</span><div className="mushaf-desktop-mode"><button type="button" className={mode === 'hifz' ? 'is-active' : ''} onClick={() => changeMode('hifz')}>Hifz</button><button type="button" className={mode === 'murajaah' ? 'is-active' : ''} onClick={() => changeMode('murajaah')}>Muraja'ah</button></div></div>
        <div className="mushaf-desktop-header-actions"><div className="mushaf-desktop-reading-switch"><button type="button" className={readingMode === 'translation' ? 'is-active' : ''} onClick={() => changeReadingMode('translation')}>Verse by Verse</button><button type="button" className={readingMode === 'reading' ? 'is-active' : ''} onClick={() => changeReadingMode('reading')}>Page by Page</button></div><button type="button" onClick={() => changeFontSize(-1)}>A−</button><button type="button" onClick={() => changeFontSize(1)}>A+</button><button type="button" className="mushaf-desktop-exit" onClick={() => setFullScreen(false)} aria-label="Exit Mushaf"><X size={16}/></button></div>
      </header>
      <div className="mushaf-desktop-workspace">
        {sidebarOpen && <aside className="mushaf-desktop-sidebar" onClick={event => event.stopPropagation()}>
          <div className="mushaf-desktop-sidebar-tabs"><button type="button" className={sidebarTab === 'surah' ? 'is-active' : ''} onClick={() => setSidebarTab('surah')}>Surah</button><button type="button" className={sidebarTab === 'juz' ? 'is-active' : ''} onClick={() => setSidebarTab('juz')}>Juz</button><button type="button" className={sidebarTab === 'page' ? 'is-active' : ''} onClick={() => setSidebarTab('page')}>Page</button><button type="button" className="mushaf-desktop-sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="Collapse sidebar"><X size={14}/></button></div>
          <div className="mushaf-desktop-sidebar-search"><Search size={15}/><input value={surahSearch} onChange={event => setSurahSearch(event.target.value)} placeholder={sidebarTab === 'surah' ? 'Search Surah' : sidebarTab === 'juz' ? 'Find Juz' : 'Find page'} aria-label="Search contents"/></div>
          <div className="mushaf-desktop-sidebar-list">
            {sidebarTab === 'surah' && QURAN_SURAHS.filter(item => { const q=surahSearch.trim().toLowerCase(); return !q || String(item.number)===q || item.transliteration.toLowerCase().includes(q) || item.english.toLowerCase().includes(q); }).map(item => <button type="button" key={item.number} className={item.number === activeSurahNumber ? 'is-active' : ''} onClick={() => { jumpSurah(item.number); setSurahSearch(''); }}>{item.number}. {item.transliteration}<small>{item.ayahs} verses · {item.revelation}</small></button>)}
            {sidebarTab === 'juz' && QURAN_JUZ_STARTS.filter(([juz]) => !surahSearch.trim() || String(juz).includes(surahSearch.trim())).map(([juz,surah,ayah]) => <button type="button" key={juz} onClick={() => { jumpJuz(juz); setSurahSearch(''); }}>Juz {juz}<small>{QURAN_SURAHS[surah-1]?.transliteration} · Ayah {ayah}</small></button>)}
            {sidebarTab === 'page' && <form className="mushaf-desktop-page-jump" onSubmit={quickJump}><label htmlFor="mushaf-desktop-page">Go to Mushaf page</label><input id="mushaf-desktop-page" type="number" min="1" max="604" value={pageInput} onChange={event => setPageInput(event.target.value)}/><button type="submit">Go</button><div className="mushaf-desktop-page-grid">{Array.from({length:604},(_,index)=>index+1).filter(value=>!surahSearch.trim()||String(value).includes(surahSearch.trim())).map(value=><button type="button" key={value} className={value===page?'is-active':''} onClick={()=>{changePage(value);setSurahSearch('');}}>{value}</button>)}</div></form>}
          </div>
        </aside>}
        <div className="mushaf-desktop-main">
    <div className="mushaf-reading-screen" onClick={() => setHudVisible(value => !value)} onMouseMove={event => { if (window.matchMedia('(hover: hover)').matches && (event.clientY < 96 || event.clientY > window.innerHeight - 96)) setHudVisible(true); }} onMouseLeave={() => { if (window.matchMedia('(hover: hover)').matches) setHudVisible(false); }}>
      <main className={'mushaf-reading-canvas ' + (readingMode === 'reading' ? 'is-page-mode' : 'is-verse-mode')} ref={readerRef}>
        {loading && <div className="mushaf-loading-skeleton is-page" role="status" aria-label={'Loading Mushaf page ' + page}>{Array.from({ length: 11 }, (_, index) => <span key={index}/>)}</div>}
        {!loading && pageError && <div className="mushaf-error" role="alert"><WifiOff size={24}/><p>{pageError}</p><button type="button" onClick={event => { event.stopPropagation(); changePage(page); }}>Retry page</button></div>}
        {!loading && pageData && readingMode === 'reading' && <div className="mushaf-fs-qcf-page" dir="rtl" lang="ar">
          <div className="mushaf-page-running-header" dir="ltr"><span>{activeSurah?.transliteration || pageData.ayahs[0]?.surahName || 'Al-Qur’an'}</span><span>Juz {pageJuz}</span></div>
          {pageData.ayahs[0]?.numberInSurah === 1 && activeSurah && <div className="mushaf-page-surah-opening"><div className="mushaf-page-surah-title"><span lang="ar" dir="rtl">{activeSurah.arabic}</span><b>{activeSurah.transliteration}</b></div>{activeSurahNumber !== 1 && activeSurahNumber !== 9 && <div className="mushaf-page-bismillah" lang="ar" dir="rtl">بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</div>}</div>}
          <div className="mushaf-page-lines">
            {readingLines.length > 0 ? readingLines.map(({ lineNumber, words }) => <div className="mushaf-fs-qcf-line" data-line={lineNumber} key={lineNumber} style={{ fontFamily: "'KFGQPC Uthmanic Script HAFS', 'Amiri Quran', serif", fontSize: `${arabicFontSize}px`, fontWeight: 500, letterSpacing: 0, lineHeight: 2.05 }}>{words.map((word, index) => word.charTypeName === 'end' ? <AyahMedallion key={word.surahNumber + ':' + word.numberInSurah + ':' + word.position + ':' + index} className="mushaf-fs-ayah-medallion" number={word.numberInSurah}/> : <span key={word.surahNumber + ':' + word.numberInSurah + ':' + word.position + ':' + index} className="mushaf-fs-qcf-word">{stripAyahEndMarker(word.text)}</span>)}</div>) :
              readingLines.length > 0 ? <div className="mushaf-fs-unicode-lines" dir="rtl">{readingLines.map(({ lineNumber, words }) => <div className="mushaf-fs-qcf-line" key={lineNumber} style={{ fontSize: `${arabicFontSize}px` }}>{words.map((word, index) => word.charTypeName === 'end' ? <AyahMedallion key={word.surahNumber + ':' + word.numberInSurah + ':' + word.position + ':' + index} className="mushaf-fs-ayah-medallion" number={word.numberInSurah}/> : <span key={word.surahNumber + ':' + word.numberInSurah + ':' + word.position + ':' + index}>{stripAyahEndMarker(word.text)}</span>)}</div>)}</div> :
              <div className="mushaf-fs-unicode-flow" dir="rtl" lang="ar" style={{ fontSize: `${arabicFontSize}px` }}>{pageData.ayahs.map(ayah => <button type="button" key={ayah.surahNumber + ':' + ayah.numberInSurah} className={'mushaf-ayah ' + (selected?.surah === ayah.surahNumber && selected?.ayah === ayah.numberInSurah ? 'is-selected' : '')} onClick={event => { event.stopPropagation(); selectAyah(ayah); }} aria-pressed={selected?.surah === ayah.surahNumber && selected?.ayah === ayah.numberInSurah}>{stripAyahEndMarker(ayah.text)}<AyahMedallion className="mushaf-ayah-number" number={ayah.numberInSurah}/></button>)}</div>}
          </div>
          <div className="mushaf-page-number" dir="ltr"><span>{page}</span></div>
        </div>}
        {!loading && pageData && readingMode === 'translation' && <div className="mushaf-fs-verse-list" dir="ltr" lang="en">
          <div className="mushaf-fs-surah-intro"><span>THE HOLY QUR’AN</span><h1>{activeSurahNumber}. {activeSurah?.transliteration || 'Surah'}</h1><b className="mushaf-fs-surah-arabic-title" lang="ar" dir="rtl">{activeSurah?.arabic || ''}</b><p>{activeSurah?.english || ''} · {activeSurah?.ayahs || surahAyahs.length} Ayahs</p><small>Translation: {pageData.translationSource || 'Sahih International'}</small></div>
          {surahLoading && <p className="mushaf-loading" role="status">Loading {activeSurah?.transliteration || 'Surah'}…</p>}
          {!surahLoading && surahError && <div className="mushaf-error" role="alert"><p>{surahError}</p><button type="button" onClick={() => setReadingMode('reading')}>Return to page</button></div>}
          {!surahLoading && surahAyahs.map((ayah, index) => <article className="mushaf-fs-verse-row" key={ayah.surahNumber + ':' + ayah.numberInSurah}>
            {index === 0 && ayah.surahNumber !== 1 && ayah.surahNumber !== 9 && <BismillahOrnament/>}
            <div className="mushaf-fs-verse-actionbar"><div className="mushaf-fs-verse-actions"><small>{ayah.surahNumber}:{ayah.numberInSurah}</small><button type="button" aria-label="Star verse" aria-pressed={starredAyahs.some(item => item.surah === ayah.surahNumber && item.ayah === ayah.numberInSurah)} onClick={() => toggleStarredAyah(ayah)}><Bookmark size={14}/></button></div><button type="button" className="mushaf-fs-verse-copy" onClick={() => { void navigator.clipboard?.writeText(ayah.text + '\n' + ayah.surahNumber + ':' + ayah.numberInSurah); }}><Copy size={13}/> Copy</button></div>
            <button type="button" className={'mushaf-fs-verse-arabic ' + (selected?.surah === ayah.surahNumber && selected?.ayah === ayah.numberInSurah ? 'is-selected' : '')} style={{ fontFamily: "'Noto Naskh Arabic', 'Amiri Quran', serif", fontSize: `${arabicFontSize}px`, fontWeight: 500, lineHeight: 2.15, wordSpacing: '2px' }} onClick={() => selectAyah(ayah)}>{stripAyahEndMarker(ayah.text)}<AyahMedallion className="mushaf-ayah-number" number={ayah.numberInSurah}/></button>
            <div className="mushaf-fs-verse-translation"><span>{ayah.translation || 'Translation unavailable.'}</span><small>{ayah.surahNumber}:{ayah.numberInSurah}</small></div>
          </article>)}
        </div>}
        <div className="mushaf-minimal-page-pill"><b>{page}</b></div>
          {readingMode === 'reading' && <div className="mushaf-page-desktop-arrows"><button type="button" aria-label="Previous page" disabled={page <= 1} onClick={event => { event.stopPropagation(); changePage(page - 1); }}>▲</button><button type="button" aria-label="Next page" disabled={page >= 604} onClick={event => { event.stopPropagation(); changePage(page + 1); }}>▼</button></div>}
      </main>
      
      {hudVisible && <div className="mushaf-floating-top" onClick={event => event.stopPropagation()}>
        <button type="button" className="mushaf-hud-pill" onClick={() => { setContentsTab('surah'); setDrawerOpen(true); }}>☷ Contents</button>
        <div className="mushaf-hud-segment"><button type="button" className={mode === 'hifz' ? 'is-active' : ''} onClick={() => changeMode('hifz')}>Hifz</button><button type="button" className={mode === 'murajaah' ? 'is-active' : ''} onClick={() => changeMode('murajaah')}>Muraja’ah</button></div>
        <div className="mushaf-hud-settings"><button type="button" className="mushaf-hud-pill" onClick={() => changeFontSize(-1)}>A−</button><button type="button" className="mushaf-hud-pill" onClick={() => changeFontSize(1)}>A+</button><button type="button" className="mushaf-hud-pill" onClick={() => changeReadingMode(readingMode === 'reading' ? 'translation' : 'reading')}>{readingMode === 'reading' ? 'Verse by Verse' : 'Page by Page'}</button><button type="button" className="mushaf-hud-exit" aria-label="Exit Mushaf" onClick={() => { setHudVisible(false); setFullScreen(false); }}>✕</button></div>
      </div>}
      {hudVisible && <div className="mushaf-floating-bottom" onClick={event => event.stopPropagation()}>
        <button type="button" className="mushaf-hud-pill mushaf-prev" disabled={page <= 1} onClick={() => changePage(page - 1)}>Prev</button>
        <input className="mushaf-page-scrubber" type="range" min="1" max="604" value={page} aria-label="Mushaf page" onChange={event => changePage(Number(event.target.value))}/>
        <button type="button" className="mushaf-hud-pill mushaf-next" disabled={page >= 604} onClick={() => changePage(page + 1)}>Next</button>
        <form className="mushaf-quick-jump" onSubmit={quickJump}><input type="number" min="1" max="604" value={pageInput} onChange={event => setPageInput(event.target.value)} aria-label="Jump to page"/><button type="submit">Go</button></form>
      </div>}
      {drawerOpen && <div className="mushaf-contents-overlay" onClick={() => setDrawerOpen(false)}>
        <section className="mushaf-contents-panel" aria-label="Qur’an contents" onClick={event => event.stopPropagation()}>
          <header className="mushaf-contents-header"><div className="mushaf-contents-tabs" role="tablist" aria-label="Contents"><button type="button" role="tab" aria-selected={contentsTab === 'surah'} className={contentsTab === 'surah' ? 'is-active' : ''} onClick={() => setContentsTab('surah')}>Surah</button><button type="button" role="tab" aria-selected={contentsTab === 'juz'} className={contentsTab === 'juz' ? 'is-active' : ''} onClick={() => setContentsTab('juz')}>Juz</button><button type="button" role="tab" aria-selected={contentsTab === 'bookmarks'} className={contentsTab === 'bookmarks' ? 'is-active' : ''} onClick={() => setContentsTab('bookmarks')}>Bookmarks</button></div><button type="button" className="mushaf-contents-close" aria-label="Close contents" onClick={() => setDrawerOpen(false)}>›</button></header>
          {contentsTab === 'surah' && <div className="mushaf-contents-search"><Search size={16}/><input value={surahSearch} onChange={event => setSurahSearch(event.target.value)} placeholder="Search Surah" aria-label="Search Surah"/></div>}
          <div className="mushaf-contents-body">
            <div className="mushaf-contents-list">
              {contentsTab === 'surah' && QURAN_SURAHS.filter(item => { const q = surahSearch.trim().toLowerCase(); return !q || String(item.number) === q || item.transliteration.toLowerCase().includes(q) || item.english.toLowerCase().includes(q); }).map(item => <button type="button" key={item.number} className={page >= item.pageStart && page <= item.pageEnd ? 'is-current' : ''} onClick={() => jumpSurah(item.number)}><span className="mushaf-contents-number">{item.number}</span><span className="mushaf-contents-names"><b>{item.transliteration}</b><small>{item.ayahs} verses · {item.revelation}</small></span><strong lang="ar" dir="rtl">{item.arabic}</strong><span className="mushaf-contents-page">{item.pageStart}</span><ChevronRight size={17}/></button>)}
              {contentsTab === 'juz' && QURAN_JUZ_STARTS.map(([juz, surah, ayah]) => { const location = getAyahLocation(surah, ayah); return <button type="button" key={juz} onClick={() => { jumpJuz(juz); setDrawerOpen(false); }}><span className="mushaf-contents-number">{juz}</span><span className="mushaf-contents-names"><b>Juz {juz}</b><small>{QURAN_SURAHS[surah - 1]?.transliteration} · Ayah {ayah}</small></span><span className="mushaf-contents-page">{location?.page}</span><ChevronRight size={17}/></button>; })}
              {contentsTab === 'bookmarks' && <><button type="button" onClick={() => { openReader('hifz'); setDrawerOpen(false); }}><span className="mushaf-contents-number">H</span><span className="mushaf-contents-names"><b>Hifz (Memorization)</b><small>Resume your saved position</small></span><span className="mushaf-contents-page">{hifzMark.page}</span><ChevronRight size={17}/></button><button type="button" onClick={() => { openReader('murajaah'); setDrawerOpen(false); }}><span className="mushaf-contents-number">M</span><span className="mushaf-contents-names"><b>Muraja’ah (Revision)</b><small>Resume your saved position</small></span><span className="mushaf-contents-page">{murajaahMark.page}</span><ChevronRight size={17}/></button>{starredAyahs.map(item => <button type="button" key={item.surah + ':' + item.ayah} onClick={() => { const target = getAyahLocation(item.surah,item.ayah); if (target) changePage(target.page,{surahNumber:item.surah,numberInSurah:item.ayah}); setDrawerOpen(false); }}><span className="mushaf-contents-number">★</span><span className="mushaf-contents-names"><b>{QURAN_SURAHS[item.surah - 1]?.transliteration} · {item.ayah}</b><small>Starred verse</small></span><span className="mushaf-contents-page">{getAyahLocation(item.surah,item.ayah)?.page}</span><ChevronRight size={17}/></button>)}</>}
            </div>
            {contentsTab === 'surah' && <nav className="mushaf-contents-rail" aria-label="Surah quick jump">{QURAN_SURAHS.map(item => <button type="button" key={item.number} className={item.number === activeSurahNumber ? 'is-current' : ''} onClick={() => jumpSurah(item.number)}>{item.number}<i/></button>)}</nav>}
          </div>
        </section>
      </div>}
    </div></div></div></div>
  </>;

  return <>
    <section className="mushaf-launch-card faith-section-secondary" aria-label="Continue Qur’an reading"><div className="mushaf-launch-copy"><h3>Qur’an · Hifz & Muraja’ah</h3><p>Your reading positions are saved automatically.</p><div className="mushaf-bookmark-positions"><span>Hifz · Page {hifzMark.page}</span><span>Muraja’ah · Page {murajaahMark.page}</span></div></div><div className="mushaf-launch-actions"><button type="button" className="button button--primary" onClick={() => openReader('hifz')}>Continue Hifz</button><button type="button" className="button button--secondary" onClick={() => openReader('murajaah')}>Continue Muraja’ah</button></div></section>
    {fullScreen && createPortal(<div className="mushaf-fs-overlay" role="dialog" aria-modal="true" aria-label="Full-screen Qur’an Mushaf">{readerContent}</div>, document.body)}
  </>;
}

