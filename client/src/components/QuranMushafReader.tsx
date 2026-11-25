import { Fragment, type CSSProperties, type FormEvent, type ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Bookmark, Copy, Info, Search, Settings, WifiOff, X } from 'lucide-react';
import { api, json } from '../lib/api';
import { QURAN_JUZ_STARTS, QURAN_SURAHS, getAyahLocation, getPageJuz, getPageSurah } from '../data/quranSurahs';

type Settings = Record<string, string>;
type TajweedSegment = { text: string; className: string };
type MushafWord = { text: string; tajweed?: string; codeV2?: string; lineNumber?: number; pageNumber?: number; position?: number; verseKey?: string; charTypeName?: string };
type MushafAyah = { textSource?: string; pageNumber?: number; number: number; numberInSurah: number; surahNumber: number; surahName: string; arabicName: string; text: string; tajweedText?: string; tajweedSegments?: TajweedSegment[]; translation: string; transliteration?: string; translations?: Array<{ id: number; name: string; text: string }>; words?: MushafWord[] };
type MushafPage = { textSource?: string; page: number; juz: number; hizb?: number; tajweedComplete?: boolean; qcfAvailable?: boolean; translationSource?: string; ayahs: MushafAyah[]; offlineFallback?: boolean };
type Props = { settings: Settings; settingsReady: boolean; onLogged: () => void; autoOpen?: boolean };
const CACHE_PREFIX = 'atlas_mushaf_page_v16_';
const pageMemoryCache = new Map<number, MushafPage>();
const HIFZ_KEY = 'atlas_hifz_bookmark_v2';
const MURAJAAH_KEY = 'atlas_murajaah_bookmark_v2';
const clampPage = (value: number) => Math.max(1, Math.min(604, Number.isInteger(value) ? value : 1));
const arabicNumber = (value: number) => String(value).replace(/\d/g, digit => '٠١٢٣٤٥٦٧٨٩'[Number(digit)]);
const AYAH_ROSETTE_PATH = Array.from({ length: 120 }, (_, index) => {
  const angle = (Math.PI * 2 * index / 120) - Math.PI / 2;
  const radius = 14.25 + 0.85 * Math.cos(12 * angle);
  const x = (18 + Math.cos(angle) * radius).toFixed(2);
  const y = (18 + Math.sin(angle) * radius).toFixed(2);
  return (index === 0 ? 'M' : 'L') + x + ' ' + y;
}).join(' ') + ' Z';
const TAJWEED_CLASSES = new Set(['tj-hamza','tj-silent','tj-madd','tj-madd-wajib','tj-qalqalah','tj-ghunnah','tj-ikhfa','tj-idgham','tj-tafkhim','tj-heavy','ham_wasl','slnt','laam_shamsiyah','madda_normal','madda_permissible','madda_necessary','madda_obligatory','madda_obligatory_mottasel','madda_obligatory_monfasel','qalaqah','ikhafa','ikhafa_shafawi','iqlab','idgham_shafawi','idgham_ghunnah','idgham_wo_ghunnah','idgham_mutajanisayn','idgham_mutaqaribayn','ghunnah']);
const MUSHAF_FONTS = [
  { name: 'UthmanicHafs', label: 'Madinah Uthmani · King Fahd Complex' },
  { name: 'Scheherazade New', label: 'Traditional Calligraphic' },
  { name: 'Noto Naskh Arabic', label: 'Modern Naskh Clarity' },
  { name: 'Amiri', label: 'Classic Book Naskh' },
  { name: 'Lateef', label: 'Refined Open Script' },
  { name: 'Aref Ruqaa', label: "Calligraphic Ruq'ah" }
] as const;
const MUSHAF_FONT_SAMPLE = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ';
const normalizeMadinahArabic = (value: string) => value.replace(/[\u06CC\u06A9\u06C1]/g, character => ({
  '\u06CC': '\u064A', '\u06A9': '\u0643', '\u06C1': '\u0647'
})[character] || character);
const TAJWEED_RULE_CLASSES: Record<string,string> = {
  ham_wasl:'ham_wasl',slnt:'slnt',laam_shamsiyah:'laam_shamsiyah',
  madda_normal:'madda_normal',madda_permissible:'madda_permissible',madda_necessary:'madda_necessary',
  madda_obligatory:'madda_obligatory',madda_obligatory_mottasel:'madda_obligatory_mottasel',madda_obligatory_monfasel:'madda_obligatory_monfasel',
  qalaqah:'qalaqah',ikhafa:'ikhafa',ikhafa_shafawi:'ikhafa_shafawi',iqlab:'iqlab',
  idgham_shafawi:'idgham_shafawi',idgham_ghunnah:'idgham_ghunnah',idgham_wo_ghunnah:'idgham_wo_ghunnah',
  idgham_mutajanisayn:'idgham_mutajanisayn',idgham_mutaqaribayn:'idgham_mutaqaribayn',ghunnah:'ghunnah',
  h:'tj-silent',s:'tj-silent',l:'tj-silent',u:'tj-silent',hamzat_wasl:'tj-silent',
  lam_shamsiyyah:'tj-silent',lam_shamsiyah:'tj-silent',laam_shamsiyyah:'tj-silent',
  m:'tj-madd',o:'tj-madd',madd:'tj-madd',n:'tj-madd-wajib',p:'tj-madd-wajib',
  q:'tj-qalqalah',qalqalah:'tj-qalqalah',
  g:'tj-ghunnah',i:'tj-ghunnah',c:'tj-ghunnah',a:'tj-ghunnah',w:'tj-ghunnah',f:'tj-ghunnah',
  d:'tj-ghunnah',b:'tj-ghunnah',idgham:'tj-ghunnah',idghaam:'tj-ghunnah',ikhfa:'tj-ghunnah',
  r:'tj-heavy',heavy:'tj-heavy',tafkhim:'tj-heavy'
};
const stripRawQuranMarkup = (value: string) => value
  .replace(/<span\s+class=["']?end["']?[^>]*>[\s\S]*?<\/span>/gi, '')
  .replace(/<[^>]+>/g, '')
  .replace(/\[[a-zA-Z]+(?::\d+)?\[/g, '')
  .replace(/\]/g, '');
function parseBracketTajweed(markup: string): TajweedSegment[] {
  const source = String(markup || '').replace(/<span\s+class=["']?end["']?[^>]*>[\s\S]*?<\/span>/gi, '');
  const result: TajweedSegment[] = [];
  const stack: string[] = [];
  const append = (text: string, className: string) => {
    if (!text) return;
    const normalized = normalizeMadinahArabic(stripRawQuranMarkup(text));
    const previous = result[result.length - 1];
    if (previous && previous.className === className) previous.text += normalized;
    else if (normalized) result.push({ text: normalized, className });
  };
  // Accept every HTML tag as syntax so generic tag names and attributes never leak.
  if (/<[^>]+>/.test(source)) {
    const xmlStack: Array<{ tag: string; className: string }> = [];
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
        const className = rule.split(/\s+/).map(value => TAJWEED_RULE_CLASSES[value.toLowerCase()] || '').find(Boolean) || '';
        xmlStack.push({ tag: tagName, className });
      }
    }
    return result.map(segment => ({ ...segment, text: stripRawQuranMarkup(segment.text) }));
  }
  let index = 0;
  while (index < source.length) {
    if (source[index] === '[') {
      const opening = source.slice(index).match(/^\[([a-zA-Z][a-zA-Z0-9_-]*)(?::\d+)?\[/);
      if (opening) {
        stack.push(TAJWEED_RULE_CLASSES[opening[1].toLowerCase()] || '');
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
  return result.map(segment => ({ ...segment, text: stripRawQuranMarkup(segment.text) }));
}
const stripAyahEndMarker = (value: string) => value.replace(/\u06DD[\u0660-\u0669\u06F0-\u06F9]*/g, '').trim();
const sanitizeMushafPage = (payload: MushafPage): MushafPage => ({
  ...payload,
  ayahs: (payload.ayahs || []).map(ayah => {
    const tajweedSource = String(ayah.tajweedText || '');
    const plainSource = String(ayah.text || '');
    const hasMarkup = (value: string) => /<[^>]+>|\[[a-zA-Z]/i.test(value);
    const rawTajweed = hasMarkup(tajweedSource) ? tajweedSource : (hasMarkup(plainSource) ? plainSource : tajweedSource);
    const hasRawMarkup = hasMarkup(rawTajweed);
    const parsed = hasRawMarkup ? parseBracketTajweed(rawTajweed) : [];
    const sourceSegments = parsed.length ? parsed : (ayah.tajweedSegments || []);
    const tajweedSegments = sourceSegments.map(segment => ({
      text: stripRawQuranMarkup(String(segment.text || '')),
      className: TAJWEED_CLASSES.has(segment.className) ? segment.className : ''
    })).filter(segment => segment.text);
    const tajweedText = tajweedSegments.map(segment => segment.text).join('') || stripRawQuranMarkup(rawTajweed);
    return {
      ...ayah,
      text: stripAyahEndMarker(stripRawQuranMarkup(ayah.text || '')) || tajweedText,
      tajweedText,
      tajweedSegments,
      translation: stripAyahEndMarker(stripRawQuranMarkup(ayah.translation || '')),
      translations: ayah.translations?.map(translation => ({ ...translation, text: stripAyahEndMarker(stripRawQuranMarkup(translation.text || '')) })),
      words: ayah.words?.map(word => ({ ...word, text: stripRawQuranMarkup(word.text || ''), tajweed: stripRawQuranMarkup(word.tajweed || '') }))
    };
  })
});
const readCachedMushafPage = (pageNumber: number): MushafPage | null => {
  const memory = pageMemoryCache.get(pageNumber);
  if (memory?.ayahs?.length) return memory;
  try {
    const cached = localStorage.getItem(CACHE_PREFIX + pageNumber);
    if (!cached) return null;
    const parsed = sanitizeMushafPage(JSON.parse(cached) as MushafPage);
    if (parsed?.ayahs?.length) { pageMemoryCache.set(pageNumber, parsed); return parsed; }
  } catch { /* cache is optional */ }
  return null;
};
const prefetchPage = async (pageNumber: number): Promise<void> => {
  const target = clampPage(pageNumber);
  if (target !== pageNumber || readCachedMushafPage(target)) return;
  try {
    const response = await fetch('/api/quran/page/' + target);
    if (!response.ok) return;
    const payload = await response.json();
    const result = payload ? sanitizeMushafPage(payload as MushafPage) : null;
    if (!result?.ayahs?.length) return;
    pageMemoryCache.set(target, result);
    try { localStorage.setItem(CACHE_PREFIX + target, JSON.stringify(result)); } catch { /* memory cache remains available */ }
  } catch { /* prefetch must never interrupt the current reading page */ }
};

const readBookmark = (key: string) => { try { const value = JSON.parse(localStorage.getItem(key) || '{}') || {}; return { page: clampPage(Number(value.page) || 1), surah: Number(value.surah) || 1, ayah: Number(value.ayah) || 1, updatedAt: String(value.updatedAt || '') }; } catch { return { page: 1, surah: 1, ayah: 1, updatedAt: '' }; } };
function lagosDate() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
export function QuranMushafReader({ settings, settingsReady, onLogged, autoOpen = false }: Props) {
  const [mode, setMode] = useState<'hifz' | 'murajaah'>('hifz');
  const [hifzMark, setHifzMark] = useState(() => readBookmark(HIFZ_KEY));
  const [murajaahMark, setMurajaahMark] = useState(() => readBookmark(MURAJAAH_KEY));
  const [page, setPage] = useState(() => readBookmark(HIFZ_KEY).page);
  const [pageReadingSurah, setPageReadingSurah] = useState(() => readBookmark(HIFZ_KEY).surah || 1);
  const [pageData, setPageData] = useState<MushafPage | null>(null);
  const [surahAyahs, setSurahAyahs] = useState<MushafAyah[]>([]);
  const [surahLoading, setSurahLoading] = useState(false);
  const [surahError, setSurahError] = useState('');
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  // The standalone Qur’an route must mount directly into the reader. Initializing
  // this state avoids a launcher flash and prevents effect timing/StrictMode from
  // leaving the dedicated route on the closed launcher after its first paint.
  const [fullScreen, setFullScreen] = useState(() => autoOpen);
  const [isMobileViewport, setIsMobileViewport] = useState(() => window.matchMedia('(max-width: 767px)').matches);
  const [mobileControlsVisible, setMobileControlsVisible] = useState(false);
  const [mobileSurahDrawerOpen, setMobileSurahDrawerOpen] = useState(false);
  const pageSwipeStartRef = useRef<{ x: number; y: number } | null>(null);

  const [mobilePageFit, setMobilePageFit] = useState({ fontSize: 21, lineHeight: 2.05 });
  const [surahSearch, setSurahSearch] = useState('');
  const [sidebarTab, setSidebarTab] = useState<'surah' | 'verse' | 'juz' | 'page'>('surah');
  const [sidebarOpen, setSidebarOpen] = useState(() => window.matchMedia('(min-width: 768px)').matches);
  const [starredAyahs, setStarredAyahs] = useState<Array<{ surah: number; ayah: number }>>(() => { try { return JSON.parse(localStorage.getItem('atlas_mushaf_starred_ayahs_v1') || '[]'); } catch { return []; } });
  const [selected, setSelected] = useState<{ surah: number; ayah: number } | null>(null);
  const [readingMode, setReadingMode] = useState<'translation' | 'reading' | 'arabic'>(() => { try { const saved = localStorage.getItem('atlas_mushaf_layout_v1'); return saved === 'translation' || saved === 'arabic' || saved === 'reading' ? saved : 'reading'; } catch { return 'reading'; } });
  const [tajweedEnabled, setTajweedEnabled] = useState(() => { try { return localStorage.getItem('atlas_mushaf_tajweed_v1') !== 'off'; } catch { return true; } });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tajweedLegendVisible, setTajweedLegendVisible] = useState(false);
  const [transliterationEnabled, setTransliterationEnabled] = useState(() => { try { return localStorage.getItem('atlas_mushaf_transliteration_v1') === 'on'; } catch { return false; } });
  const [arabicFontFamily, setArabicFontFamily] = useState(() => { try { const saved = localStorage.getItem('atlas_mushaf_font_family_v1'); return MUSHAF_FONTS.some(font => font.name === saved) ? saved as typeof MUSHAF_FONTS[number]['name'] : 'UthmanicHafs'; } catch { return 'UthmanicHafs'; } });
  const [arabicFontSize, setArabicFontSize] = useState(() => { try { const saved = Number(localStorage.getItem('atlas_mushaf_font_size_v1')); return [20, 24, 28, 32, 36].includes(saved) ? saved : 24; } catch { return 24; } });
  const [pageInput, setPageInput] = useState(String(page));
  const readerRef = useRef<HTMLDivElement | null>(null);
  const pageTextRef = useRef<HTMLDivElement | null>(null);
  const activeSurahItemRef = useRef<HTMLButtonElement | null>(null);
  const verseRowRefs = useRef(new Map<string, HTMLElement>());
  const restoreTargetRef = useRef<string | null>(null);
  const userScrolledRef = useRef(false);
  const [pageDirection, setPageDirection] = useState<1 | -1>(1);
  const prefersReducedMotion = useReducedMotion();
  const lastSavedKeyRef = useRef('');
  const loggedPagesTodayRef = useRef(new Set<string>());
  const onLoggedRef = useRef(onLogged);
  onLoggedRef.current = onLogged;

  useEffect(() => {
    pageMemoryCache.clear();
    try {
      const stalePageCacheKeys: string[] = [];
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (key && (
          /^atlas_mushaf_page_v\d+_/.test(key) ||
          /^atlas_mushaf_cache_/.test(key) ||
          /^atlas_quran_page_cache_/.test(key)
        )) stalePageCacheKeys.push(key);
      }
      stalePageCacheKeys.forEach(key => localStorage.removeItem(key));
    } catch { /* local storage is optional */ }
  }, []);
  const pageSurahRuns = useMemo(() => {
    const runs: Array<{ surahNumber: number; surahName: string; arabicName: string; startsSurah: boolean; ayahs: MushafAyah[] }> = [];
    for (const ayah of pageData?.ayahs || []) {
      const currentRun = runs[runs.length - 1];
      if (currentRun && currentRun.surahNumber === ayah.surahNumber) currentRun.ayahs.push(ayah);
      else runs.push({ surahNumber: ayah.surahNumber, surahName: ayah.surahName, arabicName: ayah.arabicName, startsSurah: ayah.numberInSurah === 1, ayahs: [ayah] });
    }
    return runs;
  }, [pageData]);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const updateViewport = () => setIsMobileViewport(media.matches);
    updateViewport();
    media.addEventListener('change', updateViewport);
    return () => media.removeEventListener('change', updateViewport);
  }, []);
  useLayoutEffect(() => {
    const element = pageTextRef.current;
    if (!element || !fullScreen || !isMobileViewport || readingMode !== 'reading' || loading || !pageData?.ayahs?.length) {
      setMobilePageFit({ fontSize: 21, lineHeight: 2.05 });
      return;
    }
    let frame = 0;
    let cancelled = false;
    const measure = () => {
      if (cancelled || !pageTextRef.current) return;
      const target = pageTextRef.current;
      const previousTransition = target.style.getPropertyValue('transition');
      const previousPriority = target.style.getPropertyPriority('transition');
      const previousFont = target.style.getPropertyValue('--mushaf-fit-font-size');
      const previousLineHeight = target.style.getPropertyValue('--mushaf-fit-line-height');
      target.style.setProperty('transition', 'none', 'important');
      let fontSize = 21;
      const lineHeight = 2.05;
      const fits = () => {
        target.style.setProperty('--mushaf-fit-font-size', fontSize + 'px');
        target.style.setProperty('--mushaf-fit-line-height', String(lineHeight));
        void target.offsetHeight;
        return target.scrollHeight <= target.clientHeight + 1;
      };
      while (fontSize > 14 && !fits()) fontSize = Math.max(14, Number((fontSize - 0.5).toFixed(1)));
      fits();
      if (previousFont) target.style.setProperty('--mushaf-fit-font-size', previousFont);
      else target.style.removeProperty('--mushaf-fit-font-size');
      if (previousLineHeight) target.style.setProperty('--mushaf-fit-line-height', previousLineHeight);
      else target.style.removeProperty('--mushaf-fit-line-height');
      if (previousTransition) target.style.setProperty('transition', previousTransition, previousPriority);
      else target.style.removeProperty('transition');
      setMobilePageFit(current => current.fontSize === fontSize && current.lineHeight === lineHeight ? current : { fontSize, lineHeight });
    };
    const schedule = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(measure);
    };
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null;
    if (element.parentElement) observer?.observe(element.parentElement);
    observer?.observe(element);
    window.addEventListener('resize', schedule, { passive: true });
    schedule();
    void document.fonts?.ready.then(schedule);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('resize', schedule);
    };
  }, [fullScreen, isMobileViewport, readingMode, loading, page, pageData, arabicFontFamily]);

  useEffect(() => {
    if (!isMobileViewport || !fullScreen || readingMode !== 'reading') setMobileControlsVisible(false);
  }, [isMobileViewport, fullScreen, readingMode]);

  useEffect(() => {
    if (!fullScreen) return;
    readerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [page, fullScreen]);

  useEffect(() => {
    if (!fullScreen || readingMode === 'reading' || !selected || !restoreTargetRef.current || loading || surahLoading || !surahAyahs.length) return;
    const key = selected.surah + ':' + selected.ayah;
    if (restoreTargetRef.current !== key) return;
    verseRowRefs.current.get(key)?.scrollIntoView({ behavior: 'auto', block: 'center' });
  }, [fullScreen, selected, loading, surahLoading, surahAyahs, readingMode]);

  const selectedAyah = pageData?.ayahs.find(item => item.surahNumber === selected?.surah && item.numberInSurah === selected?.ayah) || null;
  const pageJuz = useMemo(() => pageData?.juz || getPageJuz(page) || 1, [pageData, page]);
  const pageHizb = pageData?.hizb || 1;
  const bookmark = mode === 'hifz' ? hifzMark : murajaahMark;
  const bookmarkSurahName = QURAN_SURAHS[bookmark.surah - 1]?.transliteration || 'Al-Fatihah';


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
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault(); setSidebarOpen(true);
        window.setTimeout(() => document.querySelector<HTMLInputElement>('.mushaf-sidebar-search input')?.focus(), 0);
      }
      if (event.key === 'Escape') { setSidebarOpen(false); setFullScreen(false); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [fullScreen]);

  useEffect(() => {
    if (!settingsReady) return;
    const remoteMark = (raw: string | undefined, fallbackPage: number) => {
      try { const parsed = JSON.parse(raw || 'null'); if (parsed && typeof parsed === 'object') return { page: clampPage(Number(parsed.page) || fallbackPage), surah: Number(parsed.surah) || 1, ayah: Number(parsed.ayah) || 1, updatedAt: String(parsed.updatedAt || '') }; } catch { /* older page-only bookmark */ }
      return { page: clampPage(fallbackPage), surah: 1, ayah: 1, updatedAt: '' };
    };
    const remoteHifz = remoteMark(settings.hifz_bookmark, Number(settings.hifz_page) || 1);
    const remoteMurajaah = remoteMark(settings.murajaah_bookmark, Number(settings.murajaah_page) || 1);
    setHifzMark(current => (remoteHifz.updatedAt && (!current.updatedAt || remoteHifz.updatedAt > current.updatedAt)) || (!current.updatedAt && current.page === 1 && current.surah === 1 && current.ayah === 1 && (remoteHifz.page !== 1 || remoteHifz.surah !== 1 || remoteHifz.ayah !== 1)) ? remoteHifz : current);
    setMurajaahMark(current => (remoteMurajaah.updatedAt && (!current.updatedAt || remoteMurajaah.updatedAt > current.updatedAt)) || (!current.updatedAt && current.page === 1 && current.surah === 1 && current.ayah === 1 && (remoteMurajaah.page !== 1 || remoteMurajaah.surah !== 1 || remoteMurajaah.ayah !== 1)) ? remoteMurajaah : current);
  }, [settingsReady, settings.hifz_page, settings.murajaah_page, settings.hifz_bookmark, settings.murajaah_bookmark]);

  useEffect(() => {
    const mark = mode === 'hifz' ? hifzMark : murajaahMark;
    userScrolledRef.current = false;
    restoreTargetRef.current = readingMode === 'reading' ? null : mark.surah + ':' + mark.ayah;
    setPage(mark.page);
    setSelected(mark.surah && mark.ayah ? { surah: mark.surah, ayah: mark.ayah } : null);
  }, [mode, readingMode]);

  useEffect(() => {
    try {
      localStorage.setItem(HIFZ_KEY, JSON.stringify(hifzMark));
      localStorage.setItem(MURAJAAH_KEY, JSON.stringify(murajaahMark));
    } catch { /* storage is optional */ }
    if (!settingsReady) return;
    const mark = mode === 'hifz' ? hifzMark : murajaahMark;
    const saveKey = `${mode}:${mark.surah}:${mark.ayah}:${mark.page}`;
    if (lastSavedKeyRef.current === saveKey) return;
    lastSavedKeyRef.current = saveKey;
    const payload = mode === 'hifz'
      ? { hifz_page: String(mark.page), hifz_bookmark: JSON.stringify(mark) }
      : { murajaah_page: String(mark.page), murajaah_bookmark: JSON.stringify(mark) };
    const timer = window.setTimeout(() => {
      void api('/settings', json('PATCH', payload)).catch(() => {
        // The local bookmark is already durable; a later bookmark change can retry remote sync.
      });
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [hifzMark, murajaahMark, mode, settingsReady]);

  useEffect(() => {
    if (!fullScreen || loading || !pageData?.ayahs?.length) return;
    if (page > 1) void prefetchPage(page - 1);
    if (page < 604) void prefetchPage(page + 1);
  }, [fullScreen, loading, page, pageData]);

  useEffect(() => {
    if (!fullScreen) return;
    let cancelled = false;
    setLoading(true); setPageError('');  setPageInput(String(page));
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


  useEffect(() => {
    if (readerRef.current) readerRef.current.scrollTop = 0;
  }, [page]);

  const activeSurahNumber = selected?.surah || pageData?.ayahs?.[0]?.surahNumber || bookmark.surah || 1;
  useEffect(() => {
    if (!sidebarOpen) return;
    activeSurahItemRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [sidebarOpen, activeSurahNumber]);

  const activeSurah = QURAN_SURAHS[activeSurahNumber - 1];
  const mobileActiveSurahNumber = selected?.surah || pageData?.ayahs?.[0]?.surahNumber || getPageSurah(page)?.number || activeSurahNumber;
  const mobileActiveSurahName = QURAN_SURAHS[mobileActiveSurahNumber - 1]?.transliteration || activeSurah?.transliteration || 'Al-Fatihah';
  const currentPageSurahLabel = useMemo(() => {
    const pageSurahs = new Map<number, string>();
    for (const ayah of pageData?.ayahs || []) {
      if (!pageSurahs.has(ayah.surahNumber)) {
        pageSurahs.set(ayah.surahNumber, ayah.surahName || QURAN_SURAHS[ayah.surahNumber - 1]?.transliteration || 'Surah');
      }
    }
    if (pageSurahs.size) return [...pageSurahs.entries()].map(([number, name]) => `${number}. ${name}`).join(' – ');
    const fallbackSurah = getPageSurah(page);
    const fallbackNumber = fallbackSurah?.number || activeSurahNumber;
    return `${fallbackNumber}. ${fallbackSurah?.transliteration || activeSurah?.transliteration || 'Al-Fatihah'}`;
  }, [pageData, page, activeSurahNumber, activeSurah]);
  useEffect(() => {
    if (!fullScreen || loading || !pageData?.ayahs?.length) return;
    const date = lagosDate();
    const dedupeKey = date + ':' + page;
    const storageKey = 'atlas_quran_auto_logged_pages_' + date;
    if (loggedPagesTodayRef.current.has(dedupeKey)) return;
    let stored: number[] = [];
    try {
      stored = JSON.parse(localStorage.getItem(storageKey) || '[]') as number[];
      if (stored.includes(page)) {
        loggedPagesTodayRef.current.add(dedupeKey);
        return;
      }
    } catch { /* continue with in-memory deduplication */ }
    // Claim this page before sending the request so rerenders and remounts cannot
    // enqueue duplicate daily logs while the network request is in flight.
    loggedPagesTodayRef.current.add(dedupeKey);
    try { localStorage.setItem(storageKey, JSON.stringify([...stored, page])); } catch { /* in-memory deduplication remains active */ }
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
    })).then(() => onLoggedRef.current()).catch(() => {
      // Keep the at-most-once guard for today; do not create a request loop on 429.
    });
  }, [fullScreen, loading, pageData, page, mode]);
  useEffect(() => {
    if (readingMode === 'reading' || !activeSurah) return;
    let cancelled = false;
    setSurahLoading(true); setSurahError(''); setSurahAyahs([]);
    fetch('/api/quran/surah/' + activeSurahNumber)
      .then(async response => { const payload = await response.json(); if (!response.ok) throw new Error(payload?.error || 'The Surah could not be loaded.'); return payload; })
      .then(payload => {
        const result = sanitizeMushafPage(payload as MushafPage);
        if (!result.ayahs?.length) throw new Error('No verses were returned for ' + activeSurah.transliteration + '.');
        const ordered = [...result.ayahs].sort((a, b) => a.numberInSurah - b.numberInSurah);
        if (ordered.length !== activeSurah.ayahs) throw new Error('The Surah response is incomplete (' + ordered.length + '/' + activeSurah.ayahs + ' ayahs).');
        if (!cancelled) setSurahAyahs(ordered);
      })
      .catch(error => { if (!cancelled) setSurahError(error instanceof Error ? error.message : 'This Surah could not be loaded.'); })
      .finally(() => { if (!cancelled) setSurahLoading(false); });
    return () => { cancelled = true; };
  }, [readingMode, activeSurahNumber, activeSurah?.ayahs, activeSurah?.transliteration]);

  const updateBookmark = useCallback((nextPage: number, ayah?: Pick<MushafAyah, 'surahNumber' | 'numberInSurah'> | null) => {
    const current = mode === 'hifz' ? hifzMark : murajaahMark;
    const next = { page: clampPage(nextPage), surah: ayah?.surahNumber ?? current.surah, ayah: ayah?.numberInSurah ?? current.ayah, updatedAt: new Date().toISOString() };
    if (current.page === next.page && current.surah === next.surah && current.ayah === next.ayah) return;
    const storageKey = mode === 'hifz' ? HIFZ_KEY : MURAJAAH_KEY;
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* localStorage can be unavailable */ }
    if (mode === 'hifz') setHifzMark(next); else setMurajaahMark(next);
  }, [mode, hifzMark, murajaahMark]);

  useEffect(() => {
    if (!fullScreen) return;
    const root = readerRef.current;
    if (!root) return;
    const targets = Array.from(root.querySelectorAll<HTMLElement>('[data-mushaf-verse="true"]'));
    if (!targets.length) return;
    const visible = new Map<HTMLElement, IntersectionObserverEntry>();
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const node = entry.target as HTMLElement;
        if (entry.isIntersecting) visible.set(node, entry);
        else visible.delete(node);
      });
      if (!userScrolledRef.current) return;
      const restoreKey = restoreTargetRef.current;
      if (restoreKey) {
        const restoreNode = targets.find(node => node.dataset.surah + ':' + node.dataset.ayah === restoreKey);
        if (!restoreNode) restoreTargetRef.current = null;
        else {
          if (visible.has(restoreNode)) restoreTargetRef.current = null;
          return;
        }
      }
      const topmost = [...visible.keys()].sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)[0];
      if (!topmost) return;
      const surahNumber = Number(topmost.dataset.surah);
      const ayahNumber = Number(topmost.dataset.ayah);
      if (readingMode === 'reading' && surahNumber !== pageReadingSurah) return;
      const pageNumber = clampPage(Number(topmost.dataset.page) || page);
      if (!surahNumber || !ayahNumber) return;
      setSelected(current => current?.surah === surahNumber && current.ayah === ayahNumber ? current : { surah: surahNumber, ayah: ayahNumber });
      updateBookmark(pageNumber, { surahNumber, numberInSurah: ayahNumber });
    }, { root, threshold: 0.01 });
    targets.forEach(target => observer.observe(target));
    return () => { observer.disconnect(); visible.clear(); };
  }, [fullScreen, readingMode, surahAyahs, pageData, page, pageReadingSurah, updateBookmark]);
  const changePage = (next: number, location?: { surahNumber: number; numberInSurah: number }) => {
    userScrolledRef.current = false;
    const requestedPage = clampPage(next);
    const readingSurahStart = activeSurah?.pageStart || 1;
    const readingSurahEnd = getAyahLocation(activeSurahNumber, activeSurah?.ayahs || 1)?.page || 604;
    const value = !location && readingMode === 'reading'
      ? Math.max(readingSurahStart, Math.min(requestedPage, readingSurahEnd))
      : requestedPage;
    if (value !== page) {
      setPageDirection(value > page ? 1 : -1);
      const cachedPage = readCachedMushafPage(value);
      setPageData(cachedPage);
      setLoading(!cachedPage);
      setPageError('');
    }
    restoreTargetRef.current = location ? location.surahNumber + ':' + location.numberInSurah : null;
    if (location) setPageReadingSurah(location.surahNumber);
    setPage(value); readerRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); setSelected(location ? { surah: location.surahNumber, ayah: location.numberInSurah } : null);
    updateBookmark(value, location ? { surahNumber: location.surahNumber, numberInSurah: location.numberInSurah } : null);
  };
  const changeMode = (next: 'hifz' | 'murajaah') => {
    if (next === mode) return;
    userScrolledRef.current = false;
    const target = next === 'hifz' ? hifzMark : murajaahMark;
    restoreTargetRef.current = readingMode === 'reading' ? null : target.surah + ':' + target.ayah;
    if (target.page !== page) { setLoading(true);  setPageError(''); }
    setPage(target.page); setPageInput(String(target.page)); setSelected({ surah: target.surah, ayah: target.ayah }); setPageReadingSurah(target.surah); setMode(next);
  };
  const openReader = (next: 'hifz' | 'murajaah') => {
    userScrolledRef.current = false;
    const mark = next === 'hifz' ? hifzMark : murajaahMark;
    restoreTargetRef.current = readingMode === 'reading' ? null : mark.surah + ':' + mark.ayah;
    setMode(next);
    setPageReadingSurah(mark.surah || 1);
    setPage(mark.page);
    setPageInput(String(mark.page));
    setSelected(mark.surah && mark.ayah ? { surah: mark.surah, ayah: mark.ayah } : null);
    setSidebarOpen(false);
    setLoading(true);  setPageError('');
    setFullScreen(true);
  };
  const changeReadingMode = (next: 'translation' | 'reading' | 'arabic') => { if (next !== readingMode) { if (next === 'reading') setPageReadingSurah(selected?.surah || pageData?.ayahs?.[0]?.surahNumber || bookmark.surah || 1); updateBookmark(page, selectedAyah); setReadingMode(next); try { localStorage.setItem('atlas_mushaf_layout_v1', next); } catch { /* storage is optional */ } } };
  const changeArabicFont = (next: string) => { if (!MUSHAF_FONTS.some(font => font.name === next)) return; const selectedFont = next as typeof MUSHAF_FONTS[number]['name']; setArabicFontFamily(selectedFont); try { localStorage.setItem('atlas_mushaf_font_family_v1', selectedFont); } catch { /* storage is optional */ } };
  const changeArabicFontSize = (next: number) => { setArabicFontSize(next); try { localStorage.setItem('atlas_mushaf_font_size_v1', String(next)); } catch { /* storage is optional */ } };
  const toggleTajweed = () => setTajweedEnabled(current => { const next = !current; try { localStorage.setItem('atlas_mushaf_tajweed_v1', next ? 'on' : 'off'); } catch { /* storage is optional */ } return next; });
  const toggleTransliteration = () => setTransliterationEnabled(current => { const next = !current; try { localStorage.setItem('atlas_mushaf_transliteration_v1', next ? 'on' : 'off'); } catch { /* storage is optional */ } return next; });
  const jumpSurah = (number: number) => { const item = QURAN_SURAHS[number - 1]; if (item) { changePage(item.pageStart, { surahNumber: number, numberInSurah: 1 }); setSidebarOpen(false); setSurahSearch(''); } };
  const jumpJuz = (number: number) => { const start = QURAN_JUZ_STARTS[number - 1]; if (start) changePage(getAyahLocation(start[1], start[2])?.page || 1); };
  const selectAyah = (ayah: MushafAyah) => { const ayahPage = getAyahLocation(ayah.surahNumber, ayah.numberInSurah)?.page || page; setSelected({ surah: ayah.surahNumber, ayah: ayah.numberInSurah }); setPage(ayahPage); updateBookmark(ayahPage, ayah); };
  const toggleStarredAyah = (ayah: MushafAyah) => { setSelected({ surah: ayah.surahNumber, ayah: ayah.numberInSurah }); verseRowRefs.current.get(ayah.surahNumber + ':' + ayah.numberInSurah)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); setStarredAyahs(current => {
    const exists = current.some(item => item.surah === ayah.surahNumber && item.ayah === ayah.numberInSurah);
    const next = exists ? current.filter(item => !(item.surah === ayah.surahNumber && item.ayah === ayah.numberInSurah)) : [...current, { surah: ayah.surahNumber, ayah: ayah.numberInSurah }];
    try { localStorage.setItem('atlas_mushaf_starred_ayahs_v1', JSON.stringify(next)); } catch { /* storage is optional */ }
    return next;
  }); };
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
    const first = pageData.ayahs[0];
    setSelected({ surah: first.surahNumber, ayah: first.numberInSurah });
    updateBookmark(page, first);
  }, [pageData, loading, page, readingMode, updateBookmark]);

  useEffect(() => {
    if (readingMode === 'reading' || !pageData?.ayahs?.length || loading) return;
    const savedAyah = pageData.ayahs.find(ayah => ayah.surahNumber === bookmark.surah && ayah.numberInSurah === bookmark.ayah);
    const target = savedAyah || pageData.ayahs[0];
    if (!savedAyah) setSelected({ surah: target.surahNumber, ayah: target.numberInSurah });
    updateBookmark(page, target);
  }, [pageData, loading, page, bookmark.surah, bookmark.ayah, bookmark.page, updateBookmark, readingMode]);
  const renderMedallion = (number: number) => (
    <span className="quran-mobile-medallion" aria-label={`Ayah ${number}`}>
      <svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="17.2" /><circle cx="20" cy="20" r="14.2" /><path d={AYAH_ROSETTE_PATH} /></svg>
      <span>{arabicNumber(number)}</span>
    </span>
  );
  const renderArabic = (ayah: MushafAyah) => {
    const segments = tajweedEnabled && ayah.tajweedSegments?.length ? ayah.tajweedSegments : [{ text: ayah.text, className: '' }];
    return <>{segments.map((segment, index) => <span key={index} className={tajweedEnabled ? segment.className : ''}>{segment.text}</span>)}{renderMedallion(ayah.numberInSurah)}</>;
  };
  const bismillah = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ';
  const mobileArabicStyle = { fontFamily: `"${arabicFontFamily}", "Amiri Quran", serif`, fontSize: `${arabicFontSize}px` } as CSSProperties;
  const renderSurahIntro = (surahNumber: number, surahName: string, arabicName: string, showBismillah: boolean) => {
    const meta = QURAN_SURAHS[surahNumber - 1];
    return <Fragment key={`intro-${surahNumber}`}>
      <section className="quran-mobile-hero">
        <div className="quran-mobile-hero-main">
          <div className="quran-mobile-hero-arabic" lang="ar" dir="rtl">{arabicName || meta?.arabic}</div>
          <div className="quran-mobile-hero-copy">
            <h2>{surahNumber}. Surah {surahName || meta?.transliteration}</h2>
            <p className="quran-mobile-hero-subtitle">{meta?.english || 'The Qur’an'}</p>
            <p className="quran-mobile-hero-description">{meta?.revelation || 'Revelation'} · {meta?.ayahs || 0} verses · {meta?.juzStart ? `Juz ${meta.juzStart}` : 'Madinah Mushaf'}<br />Read the complete Surah with its Arabic text and translation.<br />Follow your memorisation and revision from your saved position.</p>
          </div>
        </div>
        <div className="quran-mobile-bookmark-modes">
          <button className={mode === 'hifz' ? 'is-active' : ''} onClick={() => changeMode('hifz')}>Hifz</button>
          <button className={mode === 'murajaah' ? 'is-active' : ''} onClick={() => changeMode('murajaah')}>Muraja’ah</button>
        </div>
      </section>
      {showBismillah && <div className="quran-mobile-bismillah">
        <div lang="ar" dir="rtl" style={mobileArabicStyle}>{bismillah}</div>
        <p>In the Name of Allah—the Most Compassionate, Most Merciful</p>
      </div>}
    </Fragment>;
  };
  const renderPageBlock = (data: MushafPage, firstBlock: boolean) => {
    const runs: Array<{ surahNumber: number; surahName: string; arabicName: string; startsSurah: boolean; ayahs: MushafAyah[] }> = [];
    const readingSurahNumber = pageReadingSurah;
    data.ayahs.filter(ayah => ayah.surahNumber === readingSurahNumber).forEach(ayah => {
      const last = runs[runs.length - 1];
      if (last && last.surahNumber === ayah.surahNumber) last.ayahs.push(ayah);
      else runs.push({ surahNumber: ayah.surahNumber, surahName: ayah.surahName, arabicName: ayah.arabicName, startsSurah: ayah.numberInSurah === 1, ayahs: [ayah] });
    });
    return <section className="quran-mobile-page-block" data-mobile-page-block="true" data-mobile-page={data.page} key={data.page}>
      {runs.map(run => <Fragment key={`run-${run.surahNumber}`}>
        {run.startsSurah && renderSurahIntro(run.surahNumber, run.surahName, run.arabicName, run.surahNumber !== 9)}
        <p className="quran-mobile-page-arabic" dir="rtl" lang="ar" style={mobileArabicStyle}>
          {run.ayahs.map(ayah => <span className="quran-mobile-page-ayah" key={ayah.number} data-mushaf-verse="true" data-surah={ayah.surahNumber} data-ayah={ayah.numberInSurah} data-page={data.page}>{renderArabic(ayah)}{' '}</span>)}
        </p>
      </Fragment>)}
      <div className="quran-mobile-page-divider"><span></span><b>{data.page}</b><span></span></div>
    </section>;
  };
  const renderVerseRows = (ayahs: MushafAyah[]) => ayahs.map(ayah => {
    const surahMeta = QURAN_SURAHS[ayah.surahNumber - 1];
    const starred = starredAyahs.some(item => item.surah === ayah.surahNumber && item.ayah === ayah.numberInSurah);
    return <article className="quran-mobile-verse-row" key={ayah.surahNumber + ':' + ayah.numberInSurah} data-mushaf-verse="true" data-surah={ayah.surahNumber} data-ayah={ayah.numberInSurah} data-page={ayah.pageNumber || getAyahLocation(ayah.surahNumber, ayah.numberInSurah)?.page || page} ref={node => { if (node) verseRowRefs.current.set(ayah.surahNumber + ':' + ayah.numberInSurah, node); }}>
      <div className="quran-mobile-verse-toolbar">
        <span>{ayah.surahNumber}:{ayah.numberInSurah}</span>
        <button aria-label={starred ? 'Remove bookmark' : 'Bookmark ayah'} className={starred ? 'is-active' : ''} onClick={() => toggleStarredAyah(ayah)}><Bookmark size={18} /></button>
        <button aria-label="Copy ayah" onClick={() => { setSelected({ surah: ayah.surahNumber, ayah: ayah.numberInSurah }); void navigator.clipboard?.writeText(ayah.text + `\n\n${surahMeta?.transliteration} ${ayah.surahNumber}:${ayah.numberInSurah}`); }}><Copy size={18} /></button>
      </div>
      <div className="quran-mobile-verse-arabic" dir="rtl" lang="ar" style={mobileArabicStyle}>{renderArabic(ayah)}</div>
      <p className="quran-mobile-translation">{ayah.translation || ayah.translations?.find(item => item.id === 131)?.text || ayah.translations?.find(item => item.id === 20)?.text || 'Translation is temporarily unavailable.'}</p>
    </article>;
  });
  if (!fullScreen) return <section className="faith-section-secondary quran-mobile-launch"><div><h3>Qur’an</h3><p>Continue from your saved Hifz or Muraja’ah position.</p><div><button onClick={() => openReader('hifz')}>Open Qur’an</button><button onClick={() => openReader('murajaah')}>Resume Muraja’ah</button></div></div></section>;
  // The Atlas route containers use overflow clipping and animated transforms. A fixed
  // full-screen reader rendered inside them can be clipped/painted behind the shell.
  // Portal the entire Mushaf to document.body so it has a true viewport-level layer.
  return createPortal(<div className="quran-mobile-shell" ref={readerRef}>
    <header className="quran-mobile-header">
      <div className="quran-mobile-top-row">
        <button className="quran-mobile-surah-trigger" onClick={() => setMobileSurahDrawerOpen(true)}>{mobileActiveSurahNumber}. {mobileActiveSurahName} <span>⌄</span></button>
        <div className="quran-mobile-header-actions"><button aria-label="Settings" onClick={() => setSettingsOpen(true)}><Settings size={23} /></button><button aria-label="Exit reader" onClick={() => setFullScreen(false)}><X size={23} /></button></div>
      </div>
      <div className="quran-mobile-mode-tabs">
        <button className={readingMode === 'arabic' ? 'is-active' : ''} onClick={() => changeReadingMode('arabic')}>Verse by Verse</button>
        <button className={readingMode === 'reading' ? 'is-active' : ''} onClick={() => changeReadingMode('reading')}>Page by Page <small>Reading</small></button>
      </div>
      <div className="quran-mobile-tajweed-center"><button onClick={() => setTajweedLegendVisible(value => !value)}>Tajweed colors <span>⌄</span></button></div>
    </header>
    {tajweedLegendVisible && <aside className="quran-mobile-tajweed-legend"><b>Tajweed color key</b><div><span className="tj-madd">Madd</span><span className="tj-ghunnah">Ghunnah</span><span className="tj-qalqalah">Qalqalah</span><span className="tj-ikhfa">Ikhfa</span><span className="tj-idgham">Idgham</span></div></aside>}
    <main className="quran-mobile-content">
      {loading && <div className="quran-mobile-loading">Loading Qur’an…</div>}
      {pageError && <div className="quran-mobile-error">{pageError}<button onClick={() => changePage(page)}>Retry</button></div>}
      {!loading && !pageError && readingMode === 'reading' && pageData && <>
        {renderPageBlock(pageData, true)}
        {page >= (getAyahLocation(pageReadingSurah, QURAN_SURAHS[pageReadingSurah - 1]?.ayahs || 1)?.page || 604) ? <div className="quran-mobile-bottom-nav quran-mobile-surah-nav"><button disabled={pageReadingSurah <= 1} onClick={() => jumpSurah(pageReadingSurah - 1)}>‹ Previous Surah</button><button disabled={pageReadingSurah >= 114} onClick={() => jumpSurah(pageReadingSurah + 1)}>Next Surah ›</button></div> : <div className="quran-mobile-bottom-nav"><button disabled={page <= (QURAN_SURAHS[pageReadingSurah - 1]?.pageStart || 1)} onClick={() => changePage(page - 1)}>‹ Previous Page</button><button onClick={() => changePage(page + 1)}>Next Page ›</button></div>}
      </>}
      {!loading && !pageError && readingMode !== 'reading' && <>
        {surahLoading && <div className="quran-mobile-loading">Loading Surah…</div>}
        {!surahLoading && surahAyahs.length > 0 && <>
          {surahAyahs[0].numberInSurah === 1 && renderSurahIntro(activeSurahNumber, activeSurah?.transliteration || surahAyahs[0].surahName, surahAyahs[0].arabicName, activeSurahNumber !== 9)}
          {renderVerseRows(surahAyahs)}
          <div className="quran-mobile-bottom-nav quran-mobile-surah-nav"><button disabled={activeSurahNumber <= 1} onClick={() => jumpSurah(activeSurahNumber - 1)}>‹ Previous Surah</button><button disabled={activeSurahNumber >= 114} onClick={() => jumpSurah(activeSurahNumber + 1)}>Next Surah ›</button></div>
        </>}
        {surahError && <div className="quran-mobile-error">{surahError}</div>}
      </>}
    </main>
    {settingsOpen && <div className="quran-mobile-settings-backdrop" onClick={() => setSettingsOpen(false)}><section className="quran-mobile-settings" onClick={event => event.stopPropagation()}>
      <header><b>Reading settings</b><button aria-label="Close settings" onClick={() => setSettingsOpen(false)}><X size={20} /></button></header>
      <label>Arabic font<select value={arabicFontFamily} onChange={event => changeArabicFont(event.target.value)}>{MUSHAF_FONTS.map(font => <option key={font.name} value={font.name}>{font.label}</option>)}</select></label>
      <div className="quran-mobile-font-preview" dir="rtl" lang="ar" style={mobileArabicStyle}>{MUSHAF_FONT_SAMPLE}</div>
      <label>Font size <strong>{arabicFontSize}px</strong><input type="range" min="20" max="36" step="4" value={arabicFontSize} onChange={event => changeArabicFontSize(Number(event.target.value))} /></label>
      <button className="quran-mobile-setting-toggle" onClick={toggleTajweed}><span>Tajweed colors</span><strong>{tajweedEnabled ? 'On' : 'Off'}</strong></button>
      <button className="quran-mobile-setting-toggle" onClick={toggleTransliteration}><span>Transliteration</span><strong>{transliterationEnabled ? 'On' : 'Off'}</strong></button>
      <div className="quran-mobile-bookmark-modes"><button className={mode === 'hifz' ? 'is-active' : ''} onClick={() => changeMode('hifz')}>Hifz</button><button className={mode === 'murajaah' ? 'is-active' : ''} onClick={() => changeMode('murajaah')}>Muraja’ah</button></div>
    </section></div>}
    {mobileSurahDrawerOpen && <div className="quran-mobile-drawer-backdrop" onClick={() => setMobileSurahDrawerOpen(false)}><aside className="quran-mobile-surah-drawer" onClick={event => event.stopPropagation()}>
      <header><b>Surahs</b><button aria-label="Close Surah list" onClick={() => setMobileSurahDrawerOpen(false)}><X size={20} /></button></header>
      <input value={surahSearch} onChange={event => setSurahSearch(event.target.value)} placeholder="Search 114 Surahs" />
      <div className="quran-mobile-surah-list">{QURAN_SURAHS.filter(surah => (surah.transliteration + ' ' + surah.english + ' ' + surah.number).toLowerCase().includes(surahSearch.toLowerCase())).map(surah => <button key={surah.number} className={surah.number === mobileActiveSurahNumber ? 'is-active' : ''} onClick={() => { jumpSurah(surah.number); setMobileSurahDrawerOpen(false); }}><span><b>{surah.number}. {surah.transliteration}</b><small>{surah.english} · {surah.ayahs} verses</small></span><strong>{surah.arabic}</strong></button>)}</div>
    </aside></div>}
  </div>, document.body);
}
