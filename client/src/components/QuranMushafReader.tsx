import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bookmark, ChevronLeft, ChevronRight, Copy, Play, Search, WifiOff, X } from 'lucide-react';
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
  const [selected, setSelected] = useState<{ surah: number; ayah: number } | null>(null);
  const [readingMode, setReadingMode] = useState<'translation' | 'reading'>('reading');
  const [qcfFontStatus, setQcfFontStatus] = useState<'loading' | 'ready' | 'fallback'>('fallback');
  const [arabicFontSize, setArabicFontSize] = useState(() => {
    try { const saved = Number(localStorage.getItem('atlas_mushaf_arabic_font_size_v2')); return [16, 18, 20, 23, 26, 30, 34].includes(saved) ? saved : 20; }
    catch { return 20; }
  });
  const [reciter, setReciter] = useState('ar.alafasy');
  const [pageInput, setPageInput] = useState(String(page));
  const audioRef = useRef<HTMLAudioElement | null>(null);
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
    let cancelled = false;
    if (readingMode !== 'reading' || !pageData?.qcfAvailable || !pageData.ayahs.some(ayah => ayah.words?.some(word => word.codeV2))) { setQcfFontStatus('fallback'); return; }
    setQcfFontStatus('loading');
    const family = 'QCF2' + String(page).padStart(3, '0');
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
  const openReader = (next: 'hifz' | 'murajaah') => {
    const mark = next === 'hifz' ? hifzMark : murajaahMark;
    setMode(next);
    setPage(mark.page);
    setPageInput(String(mark.page));
    setSelected(mark.surah && mark.ayah ? { surah: mark.surah, ayah: mark.ayah } : null);
    setDrawerOpen(false);
    setFullScreen(true);
  };
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
      <div className="mushaf-fs-header-group mushaf-fs-header-left">
        <button type="button" className="mushaf-fs-surah-trigger" aria-label="Open Surah navigation" onClick={() => { setDrawerOpen(true); setSurahSearch(''); }}>Surahs ▾</button>
        <span className="mushaf-fs-page-meta">P.{page}</span>
      </div>
      <div className="mushaf-fs-header-group mushaf-fs-header-center mushaf-mode-switch" role="group" aria-label="Qur’an display mode">
        <button type="button" className={readingMode === 'translation' ? 'is-active' : ''} aria-pressed={readingMode === 'translation'} onClick={() => changeReadingMode('translation')}>Verse by Verse</button>
        <button type="button" className={readingMode === 'reading' ? 'is-active' : ''} aria-pressed={readingMode === 'reading'} onClick={() => changeReadingMode('reading')}>Page by Page</button>
      </div>
      <div className="mushaf-fs-header-group mushaf-fs-header-right">
        <div className="mushaf-mode-switch mushaf-fs-bookmark-switch" role="group" aria-label="Bookmark mode">
          <button type="button" className={mode === 'hifz' ? 'is-active' : ''} aria-pressed={mode === 'hifz'} onClick={() => changeMode('hifz')}>Hifz</button>
          <button type="button" className={mode === 'murajaah' ? 'is-active' : ''} aria-pressed={mode === 'murajaah'} onClick={() => changeMode('murajaah')}>Muraja’ah</button>
        </div>
        <div className="mushaf-top-font"><button type="button" aria-label="Decrease Arabic font size" onClick={() => changeFontSize(-1)}>A-</button><button type="button" aria-label="Increase Arabic font size" onClick={() => changeFontSize(1)}>A+</button></div>
        <button type="button" className="mushaf-fs-close" aria-label="Exit Mushaf" title="Exit" onClick={() => { setDrawerOpen(false); setFullScreen(false); }}>✕</button>
      </div>
    </header>
    <div className={'mushaf-fs-stage mushaf-reading-layout ' + (readingMode === 'reading' ? 'is-page-by-page' : 'is-verse-by-verse')}>
      <main className="mushaf-fs-sheet mushaf-page-wrap" ref={readerRef}>
        {loading && <div className={'mushaf-loading-skeleton ' + (readingMode === 'reading' ? 'is-page' : 'is-verses')} role="status" aria-label={'Loading Mushaf page ' + page}>{Array.from({ length: readingMode === 'reading' ? 11 : 4 }, (_, index) => <span key={index}/>)}</div>}
        {!loading && pageError && readingMode === 'reading' && <div className="mushaf-error" role="alert"><WifiOff size={24}/><p>{pageError}</p><button type="button" onClick={() => changePage(page)}>Retry page</button></div>}
        {!loading && pageData && readingMode === 'reading' && <div className="mushaf-fs-qcf-page mushaf-fs-arabic" dir="rtl" lang="ar">
          {readingLines.length > 0 && qcfFontStatus === 'ready' ? readingLines.map(({ lineNumber, words }) => {
            const firstWord = words[0];
            const surah = firstWord?.numberInSurah === 1 ? pageData.ayahs.find(ayah => ayah.surahNumber === firstWord.surahNumber) : null;
            return <Fragment key={lineNumber}>
              {surah && <SurahCartouche arabicName={surah.arabicName} englishName={QURAN_SURAHS[surah.surahNumber - 1]?.english || surah.surahName} ayahs={QURAN_SURAHS[surah.surahNumber - 1]?.ayahs || 0} />}
              {surah && surah.surahNumber !== 1 && surah.surahNumber !== 9 && <BismillahOrnament />}
              <div className="mushaf-fs-qcf-line" data-line={lineNumber} style={{ fontFamily: 'QCF2' + String(page).padStart(3, '0'), fontSize: `${arabicFontSize}px` }}>
                {words.map((word, index) => <span key={word.surahNumber + ':' + word.numberInSurah + ':' + word.position + ':' + index} className={'mushaf-fs-qcf-word' + (word.charTypeName === 'end' ? ' is-end' : '')} dangerouslySetInnerHTML={{ __html: escapeGlyphHtml(word.codeV2 || word.text) }} />)}
              </div>
            </Fragment>;
          }) : readingLines.length > 0 ? <div className="mushaf-fs-unicode-lines" dir="rtl">
            {readingLines.map(({ lineNumber, words }) => <div className="mushaf-fs-qcf-line" key={lineNumber} style={{ fontSize: `${arabicFontSize}px` }}>
              {words.map((word, index) => word.charTypeName === 'end' ? <AyahMedallion key={word.surahNumber + ':' + word.numberInSurah + ':' + word.position + ':' + index} className="mushaf-fs-ayah-medallion" number={word.numberInSurah} /> : <span key={word.surahNumber + ':' + word.numberInSurah + ':' + word.position + ':' + index}>{word.text}</span>)}
            </div>)}
          </div> : <div className="mushaf-ayah-flow mushaf-fs-unicode-flow" dir="rtl" lang="ar" style={{ fontSize: `${arabicFontSize}px` }}>
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
        {readingMode === 'translation' && <div className="mushaf-fs-verse-list mushaf-fs-arabic" dir="ltr" lang="en">
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
                <button type="button" className={'mushaf-fs-verse-arabic ' + (isSelected ? 'is-selected' : '')} style={{ fontSize: `${arabicFontSize}px` }} onClick={() => selectAyah(ayah)} aria-pressed={isSelected}>
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
        <span className="mushaf-fs-page-count" aria-live="off">Page {page} / 604</span>
        {readingMode === 'reading' && <button type="button" className="mushaf-fs-page-nav" disabled={page >= 604} onClick={() => changePage(page + 1)}>Next Page <ChevronRight size={16}/></button>}
      </div>
    </footer>
    <audio ref={audioRef} />
  </>;
  return <>
    <section className="mushaf-launch-card" aria-label="Continue Qur’an reading"><div className="mushaf-launch-copy"><h3>Qur’an · Hifz & Muraja’ah</h3><p>Your reading positions are saved automatically.</p><div className="mushaf-bookmark-positions"><span>Hifz · Page {hifzMark.page}</span><span>Muraja’ah · Page {murajaahMark.page}</span></div></div><div className="mushaf-launch-actions"><button type="button" className="button button--primary" onClick={() => openReader('hifz')}>Continue Hifz</button><button type="button" className="button button--secondary" onClick={() => openReader('murajaah')}>Continue Muraja’ah</button></div></section>
    <style>{mushafStyles}</style>
    {fullScreen && createPortal(<div className="mushaf-fs-overlay" role="dialog" aria-modal="true" aria-label="Full-screen Qur’an Mushaf">{readerContent}</div>, document.body)}
  </>;
}

const mushafStyles = `
/* Atlas Mushaf — one layout system, isolated from the rest of the workspace. */
.mushaf-launch-card{display:flex;align-items:center;justify-content:space-between;gap:18px;flex-wrap:wrap;padding:20px;border:1px solid var(--border-subtle,rgba(255,255,255,.12));border-radius:16px;background:var(--surface-card,rgba(255,255,255,.035))}
.mushaf-launch-copy{display:grid;gap:6px;min-width:0}.mushaf-launch-card h3{margin:0;font-size:17px}.mushaf-launch-card p{margin:0;color:var(--text-muted);font-size:12px}.mushaf-bookmark-positions{display:flex;flex-wrap:wrap;gap:8px}.mushaf-bookmark-positions span{padding:5px 8px;border:1px solid var(--border-hairline);border-radius:7px;color:var(--text-secondary,var(--text-muted));font:600 10px/1.2 "DM Sans",sans-serif}.mushaf-launch-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.mushaf-launch-actions button{min-height:36px;padding:0 12px;white-space:nowrap}
.mushaf-fs-overlay,.mushaf-fs-overlay *{box-sizing:border-box}
 .mushaf-fs-overlay{position:fixed;inset:0;z-index:9999;width:100vw;height:100vh;height:100dvh;display:grid;grid-template-rows:40px minmax(0,1fr) 62px;overflow:hidden;background:var(--bg-canvas);color:var(--text-primary);font-family:"DM Sans",system-ui,sans-serif}
.mushaf-fs-header{width:100%;height:40px;min-height:40px;max-height:40px;padding:0 12px;display:flex;align-items:center;justify-content:space-between;gap:6px;border-bottom:1px solid var(--border-hairline);box-sizing:border-box;background:var(--bg-surface);overflow:hidden}
.mushaf-fs-header-group{display:flex;align-items:center;gap:6px;min-width:0;flex:0 0 auto}
.mushaf-fs-header-left{justify-content:flex-start}
.mushaf-fs-header-center{justify-content:center;flex:1 1 auto;min-width:0}
.mushaf-fs-header-right{justify-content:flex-end;gap:5px}
.mushaf-fs-header button{height:26px;min-height:26px;max-height:26px;padding:2px 8px;font-size:11.5px;white-space:nowrap;line-height:1;box-sizing:border-box}
.mushaf-fs-surah-trigger{min-width:0;max-width:112px;overflow:hidden;text-overflow:ellipsis;border:1px solid var(--border-hairline);border-radius:7px;background:var(--bg-elevated);color:var(--text-primary);font-weight:600}
.mushaf-fs-page-meta{flex:0 0 auto;color:var(--text-muted);font:500 10px/1 "DM Sans",sans-serif;white-space:nowrap}
.mushaf-mode-switch{display:flex;align-items:center;gap:2px;padding:2px;border:1px solid var(--border-hairline);border-radius:8px;background:var(--bg-elevated)}
 .mushaf-mode-switch button{border:0;border-radius:5px;background:transparent;color:var(--text-muted);font:600 11.5px/1 "DM Sans",sans-serif}
.mushaf-mode-switch button.is-active{background:var(--bg-canvas);color:var(--text-primary);box-shadow:0 1px 4px rgba(0,0,0,.1)}
.mushaf-fs-header-center button{padding:2px 8px}
.mushaf-top-font{display:flex;align-items:center;gap:2px;flex:0 0 auto}
.mushaf-top-font button{min-width:27px;border:1px solid var(--border-hairline);border-radius:6px;background:var(--bg-elevated);color:var(--text-primary);font:600 11.5px/1 "DM Sans",sans-serif}
.mushaf-fs-close{width:26px;min-width:26px;padding:0!important;display:grid;place-items:center;border:0;border-radius:6px;background:var(--bg-elevated);color:var(--text-primary);font:600 15px/1 "DM Sans",sans-serif}
.mushaf-fs-stage{width:100%;min-width:0;min-height:0;overflow-x:hidden;overflow-y:auto;padding:18px 16px;overscroll-behavior:contain}
.mushaf-fs-stage.is-page-by-page{display:flex;align-items:center;justify-content:center;overflow:hidden;padding:6px 12px}
.mushaf-fs-sheet{width:100%;max-width:740px;min-width:0;margin:0 auto;padding:12px 20px 28px;border:0;background:transparent;box-shadow:none}
.mushaf-fs-stage.is-page-by-page .mushaf-fs-sheet{width:100%;max-width:660px;height:100%;max-height:100%;min-height:0;margin:0 auto;padding:0 8px;display:flex;align-items:center;justify-content:center;overflow:visible}
.mushaf-fs-qcf-page{width:100%;max-width:640px;min-width:0;margin:0 auto;display:flex;flex-direction:column;justify-content:center;gap:0;direction:rtl;overflow:visible}
.mushaf-fs-qcf-line{width:100%;min-width:0;min-height:0;margin:0 auto;overflow:visible;text-align:center;direction:rtl;white-space:nowrap;line-height:1.68;color:var(--text-primary);font-family:inherit;font-weight:400}
.mushaf-fs-qcf-word{display:inline;white-space:pre;font:inherit}
.mushaf-fs-stage.is-page-by-page .mushaf-fs-qcf-line{line-height:1.68}
.mushaf-fs-unicode-lines{width:100%;max-width:580px;margin:0 auto;display:flex;flex-direction:column;justify-content:center;gap:0}
.mushaf-fs-unicode-lines .mushaf-fs-qcf-line{font-family:"Amiri Quran","Scheherazade New","Traditional Arabic",serif;font-size:clamp(15px,2.2vh,22px);line-height:1.62;white-space:normal;overflow-wrap:anywhere}
.mushaf-fs-unicode-flow{width:100%;max-width:580px;margin:0 auto;font-family:"Amiri Quran","Scheherazade New","Traditional Arabic",serif;font-size:clamp(15px,2.2vh,22px);line-height:1.65;text-align:justify;text-align-last:center}
.mushaf-fs-font-note{margin:12px 0 0;text-align:center;color:var(--text-muted);font:11px/1.5 "DM Sans",sans-serif}
/* Surah title cartouche: two balanced lines, fully contained at every width. */
.mushaf-surah-cartouche{position:relative;isolation:isolate;box-sizing:border-box;width:min(100%,620px);min-width:0;height:64px;margin:7px auto 5px;padding:8px 42px;display:grid;place-items:center;overflow:hidden}
.mushaf-surah-cartouche>svg{position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none}
.mushaf-cartouche-outer{fill:color-mix(in srgb,var(--accent-primary,var(--accent)) 6%,var(--bg-surface));stroke:var(--accent-primary,var(--accent));stroke-width:1.2}
.mushaf-cartouche-inner{fill:none;stroke:color-mix(in srgb,var(--accent-primary,var(--accent)) 48%,#c5a66d);stroke-width:.7}
.mushaf-cartouche-flourish{fill:none;stroke:#c5a66d;stroke-width:1;stroke-linecap:round;stroke-linejoin:round}
.mushaf-surah-cartouche-copy{position:relative;z-index:1;box-sizing:border-box;width:100%;max-width:100%;min-width:0;display:grid;grid-template-rows:auto auto;justify-items:center;align-content:center;gap:3px;text-align:center;overflow:hidden}
.mushaf-surah-cartouche-copy b{display:block;width:100%;max-width:100%;min-width:0;margin:0;color:var(--text-primary);font:500 clamp(16px,2.1vh,20px)/1.35 "Amiri Quran","Noto Naskh Arabic",serif;white-space:nowrap;overflow:hidden;text-overflow:clip;direction:rtl;text-align:center}
.mushaf-surah-cartouche-copy span{display:block;width:100%;max-width:100%;min-width:0;margin:0;color:var(--text-muted);font:600 clamp(9px,1.15vh,11px)/1.25 "DM Sans",sans-serif;letter-spacing:.01em;white-space:normal;overflow-wrap:anywhere;text-align:center}
.mushaf-surah-cartouche-copy i{font-style:normal;color:#c5a66d;padding:0 3px}
.mushaf-bismillah-ornament{width:min(100%,580px);min-width:0;margin:1px auto 3px;display:flex;align-items:center;justify-content:center;gap:10px;color:var(--accent-primary,var(--accent))}
.mushaf-bismillah-ornament>span{height:1px;flex:1;max-width:100px;background:linear-gradient(90deg,transparent,color-mix(in srgb,var(--accent-primary,var(--accent)) 55%,#c5a66d))}
.mushaf-bismillah-ornament>span:last-child{transform:scaleX(-1)}
.mushaf-bismillah-ornament b{font:500 18px/1.3 "Amiri Quran","Noto Naskh Arabic",serif;white-space:nowrap;color:var(--text-primary)}
.mushaf-fs-verse-list{width:100%;max-width:740px;min-width:0;margin:0 auto;text-align:left}
.mushaf-fs-surah-intro{margin:0 auto 14px;padding:12px 0 16px;text-align:center;border-bottom:1px solid var(--border-hairline)}
.mushaf-fs-surah-intro>span{font:600 9px/1.4 "DM Sans",sans-serif;letter-spacing:.16em;color:var(--text-muted)}
.mushaf-fs-surah-intro h1{margin:5px 0 2px;font:600 22px/1.3 "DM Sans",sans-serif;color:var(--text-primary)}
.mushaf-fs-surah-intro p{margin:0;color:var(--text-muted);font:11px/1.5 "DM Sans",sans-serif}
.mushaf-fs-surah-intro small{display:block;margin-top:5px;color:var(--text-muted);font:10px/1.4 "DM Sans",sans-serif}
.mushaf-fs-verse-row{padding:20px 0 22px;border-bottom:1px solid var(--border-hairline)}
.mushaf-fs-verse-actionbar{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 8px}
.mushaf-fs-verse-actions{display:flex;align-items:center;gap:7px;min-width:0;direction:ltr}
.mushaf-fs-verse-actions small{color:var(--text-muted);font:600 10px/1.3 "DM Sans",sans-serif}
.mushaf-fs-verse-actions button,.mushaf-fs-verse-copy{height:28px;min-height:28px;display:inline-flex;align-items:center;justify-content:center;gap:5px;padding:0 7px;border:0;border-radius:7px;background:transparent;color:var(--text-muted);font:500 10px/1 "DM Sans",sans-serif}
.mushaf-fs-verse-actions button:hover,.mushaf-fs-verse-copy:hover{background:var(--bg-elevated);color:var(--text-primary)}
.mushaf-fs-verse-arabic-line{width:100%;min-width:0;display:block;direction:rtl}
 .mushaf-fs-verse-arabic{width:100%;min-width:0;display:block;padding:0;border:0;background:transparent;color:var(--text-primary);font:inherit;font-family:"Amiri Quran","Scheherazade New","Traditional Arabic",serif;line-height:2.05;text-align:right;direction:rtl;cursor:pointer}
.mushaf-fs-verse-arabic.is-selected{color:var(--accent-primary,var(--text-primary))}
.mushaf-fs-verse-translation{margin-top:10px;display:flex;flex-direction:column;gap:5px;text-align:left;direction:ltr;color:var(--text-secondary,var(--text-muted));font:400 15px/1.7 "DM Sans",sans-serif}
.mushaf-fs-verse-translation small{color:var(--text-muted);font:600 10px/1.4 "DM Sans",sans-serif}

.mushaf-ayah-number,.mushaf-fs-ayah-medallion{position:relative;isolation:isolate;display:inline-flex;align-items:center;justify-content:center;vertical-align:middle;flex:0 0 32px;box-sizing:border-box;width:32px;height:32px;min-width:32px;margin:0 5px;padding:0;border:0;border-radius:0;background:transparent;color:var(--accent-primary,var(--accent));line-height:1;white-space:nowrap}
.mushaf-ayah-number.is-three-digit,.mushaf-fs-ayah-medallion.is-three-digit{width:36px;min-width:36px;flex-basis:36px}
.mushaf-ayah-medallion-frame{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.mushaf-ayah-medallion-frame path{fill:color-mix(in srgb,var(--accent-primary,var(--accent)) 8%,var(--bg-surface));stroke:var(--accent-primary,var(--accent));stroke-width:1.15;stroke-linejoin:round}
.mushaf-ayah-medallion-frame circle{fill:none;stroke:color-mix(in srgb,var(--accent-primary,var(--accent)) 62%,transparent);stroke-width:.7}
.mushaf-fs-ayah-number-text{position:absolute;inset:0;display:grid;place-items:center;width:100%;height:100%;margin:0;padding:0;font:700 11px/1 "Plus Jakarta Sans",system-ui,sans-serif;text-align:center;direction:ltr;unicode-bidi:isolate;font-variant-numeric:tabular-nums;color:var(--accent-primary,var(--accent));pointer-events:none}
.mushaf-fs-footer{width:100%;min-width:0;height:62px;min-height:62px;padding:0 14px env(safe-area-inset-bottom,0px);display:flex;align-items:center;justify-content:center;border-top:1px solid var(--border-hairline);background:var(--bg-surface)}
.mushaf-fs-page-pill{width:min(100%,540px);min-width:0;display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 auto;padding:3px 5px}
.mushaf-fs-page-count{flex:0 0 auto;color:var(--text-muted);font:600 10px/1 "DM Sans",sans-serif;white-space:nowrap}
.mushaf-fs-page-pill button{min-width:0;height:36px;min-height:36px;display:inline-flex;align-items:center;justify-content:center;gap:5px;padding:0 11px;border:1px solid var(--border-hairline);border-radius:8px;background:var(--bg-elevated);color:var(--text-primary);font:600 10px/1 "DM Sans",sans-serif;white-space:nowrap}
.mushaf-fs-page-pill button:disabled{opacity:.35;cursor:not-allowed}
.mushaf-drawer-scrim{position:fixed;inset:0;z-index:10000;border:0;background:rgba(0,0,0,.38)}
.mushaf-surah-drawer{position:fixed;z-index:10001;inset:0 auto 0 0;width:min(360px,92vw);max-width:92vw;min-width:0;display:flex;flex-direction:column;overflow-x:hidden;overflow-y:auto;background:var(--bg-surface);border-right:1px solid var(--border-hairline);box-shadow:12px 0 40px rgba(0,0,0,.16)}
.mushaf-surah-drawer--designed{background:color-mix(in srgb,var(--bg-surface) 94%,transparent);backdrop-filter:blur(20px) saturate(140%);-webkit-backdrop-filter:blur(20px) saturate(140%)}
.mushaf-surah-drawer-header{position:sticky;top:0;z-index:3;min-width:0;flex:none;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px;background:var(--bg-surface);border-bottom:1px solid var(--border-hairline)}
.mushaf-surah-drawer-header>div{display:grid;gap:3px}.mushaf-surah-drawer-header b{font-size:13px}.mushaf-surah-drawer-header small{color:var(--text-muted);font-size:10px}
.mushaf-surah-drawer-header button{width:32px;height:32px;display:grid;place-items:center;border:0;border-radius:8px;background:var(--bg-elevated);color:var(--text-primary)}
.mushaf-surah-search{position:sticky;top:65px;z-index:2;flex:none;height:40px;margin:10px 12px 0;padding:0 11px;display:flex;align-items:center;gap:8px;border:1px solid var(--border-hairline);border-radius:9px;background:var(--bg-elevated);color:var(--text-muted)}
.mushaf-surah-search input{width:100%;min-width:0;height:100%;border:0;outline:0;background:transparent;color:var(--text-primary);font:500 11px "DM Sans",sans-serif}
.mushaf-drawer-jumps{position:sticky;top:115px;z-index:1;display:flex;gap:10px;padding:10px 12px;background:var(--bg-surface)}
.mushaf-drawer-jumps label{flex:1;min-width:0;display:flex;align-items:center;gap:6px;color:var(--text-muted);font:600 10px "DM Sans",sans-serif}
.mushaf-drawer-jumps input,.mushaf-drawer-jumps select{width:100%;min-width:0;height:32px;padding:0 7px;border:1px solid var(--border-hairline);border-radius:7px;background:var(--bg-elevated);color:var(--text-primary);font:500 10px "DM Sans",sans-serif}
.mushaf-surah-list{flex:1;min-height:0;overflow-x:hidden;overflow-y:auto;padding:8px 10px 20px;overscroll-behavior:contain}
.mushaf-surah-list>button{width:100%;min-width:0;display:flex;align-items:center;gap:9px;padding:10px;border:1px solid transparent;border-radius:9px;background:transparent;text-align:left;color:var(--text-primary)}
.mushaf-surah-list>button:hover,.mushaf-surah-list>button.is-current{background:var(--bg-elevated);border-color:var(--border-hairline)}
.mushaf-surah-number{width:28px;height:28px;flex:0 0 28px;display:grid;place-items:center;border-radius:7px;background:var(--bg-elevated);color:var(--accent-primary,var(--text-primary));font:700 10px "DM Sans",sans-serif}
.mushaf-surah-number i{font-style:normal}.mushaf-surah-names{flex:1;min-width:0;display:grid;gap:3px}.mushaf-surah-names b{font:700 11px "DM Sans",sans-serif}.mushaf-surah-names small{color:var(--text-muted);font:10px "DM Sans",sans-serif}
.mushaf-surah-list>button strong{flex:0 0 auto;max-width:76px;overflow:hidden;color:var(--text-primary);font:500 18px "Amiri Quran","Noto Naskh Arabic",serif}
.mushaf-surah-page-badge{flex:0 0 auto;padding:4px 5px;border:1px solid var(--border-hairline);border-radius:6px;color:var(--text-muted);font:600 8px "DM Sans",sans-serif;font-style:normal}
.mushaf-error{max-width:440px;margin:24px auto;padding:24px;text-align:center;border:1px solid var(--border-hairline);border-radius:12px;background:var(--bg-surface)}
.mushaf-error button{height:34px;padding:0 12px;border:1px solid var(--border-hairline);border-radius:8px;background:var(--bg-elevated);color:var(--text-primary)}
 .mushaf-loading{margin:20px auto;text-align:center;color:var(--text-muted);font:12px/1.5 "DM Sans",sans-serif}
.mushaf-loading-skeleton{width:min(100%,640px);margin:0 auto;display:grid;gap:15px;align-content:center;min-height:100%;padding:24px 10px}
.mushaf-loading-skeleton span{display:block;height:18px;border-radius:6px;background:linear-gradient(90deg,var(--bg-elevated),color-mix(in srgb,var(--bg-elevated) 55%,var(--text-muted) 8%),var(--bg-elevated));background-size:200% 100%;animation:mushaf-skeleton-pulse 1.3s ease-in-out infinite}
.mushaf-loading-skeleton.is-page span{height:22px;width:100%}.mushaf-loading-skeleton.is-page span:nth-child(3n){width:88%;margin-inline:auto}.mushaf-loading-skeleton.is-page span:nth-child(3n + 1){width:95%;margin-inline:auto}
.mushaf-loading-skeleton.is-verses{align-content:start}.mushaf-loading-skeleton.is-verses span{height:86px;border-radius:10px}
@keyframes mushaf-skeleton-pulse{0%{background-position:100% 0}100%{background-position:-100% 0}}
@media(max-width:700px){
  .mushaf-fs-overlay{grid-template-rows:40px minmax(0,1fr) 58px}
  .mushaf-fs-header{padding:0 6px;gap:2px}
  .mushaf-fs-header-group{gap:2px}
  .mushaf-fs-header-right{gap:2px}
  .mushaf-fs-header button{height:26px;min-height:26px;max-height:26px;padding:2px 4px;font-size:9px}
  .mushaf-fs-surah-trigger{max-width:68px;font-size:9px}
  .mushaf-fs-page-meta{font-size:9px}
  .mushaf-mode-switch{gap:1px;padding:1px}
  .mushaf-mode-switch button{padding:2px 4px;font-size:9px}
  .mushaf-fs-header-center button{padding:2px 4px;font-size:9px}
  .mushaf-top-font button{min-width:22px;padding:2px 3px;font-size:9px}
  .mushaf-fs-close{width:22px;min-width:22px;padding:0!important}
  .mushaf-fs-stage{padding:12px 8px}.mushaf-fs-stage.is-page-by-page{padding:2px 4px}
  .mushaf-fs-stage.is-page-by-page .mushaf-fs-sheet{padding:0 2px}
  .mushaf-fs-qcf-line{line-height:1.62}
  .mushaf-surah-cartouche{height:58px;padding:7px 27px;margin:5px auto 4px}.mushaf-surah-cartouche-copy{gap:2px}.mushaf-surah-cartouche-copy b{font-size:clamp(15px,4.1vw,18px);line-height:1.3}.mushaf-surah-cartouche-copy span{font-size:clamp(8px,2.5vw,10px);line-height:1.2}
  .mushaf-bismillah-ornament{gap:6px}.mushaf-bismillah-ornament b{font-size:15px}
  .mushaf-fs-verse-row{padding:17px 0 19px}.mushaf-fs-verse-arabic{line-height:2}
  .mushaf-fs-verse-translation{font-size:14px}
  .mushaf-fs-footer{height:58px;min-height:58px;padding:0 5px}
  .mushaf-fs-page-pill{gap:4px;padding:2px}
  .mushaf-fs-page-pill button{height:34px;min-height:34px;padding:0 7px;font-size:9px}
  .mushaf-fs-page-count{font-size:9px}
}
@media(max-width:390px){
 .mushaf-surah-cartouche{height:54px;padding:6px 23px;margin:4px auto 3px}
 .mushaf-surah-cartouche-copy{gap:1px}
 .mushaf-surah-cartouche-copy b{font-size:15px}
 .mushaf-surah-cartouche-copy span{font-size:8px;letter-spacing:0}
  .mushaf-fs-header{padding-left:5px;padding-right:5px}
 .mushaf-fs-header-left,.mushaf-fs-header-right{gap:3px}
 .mushaf-fs-surah-trigger{max-width:118px;padding:0 5px;font-size:9px}
 .mushaf-fs-page-meta{font-size:8px}
 .mushaf-mode-switch button{padding:0 4px;font-size:8px}
 .mushaf-top-font button{min-width:25px;padding:0 3px;font-size:9px}
 .mushaf-fs-tabs button{padding:0 9px;font-size:9px}
 .mushaf-fs-page-pill button{padding:0 5px;font-size:8px}
}
`;;