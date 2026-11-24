import { Fragment, type CSSProperties, type FormEvent, type ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Bookmark, Copy, Info, Search, Settings, WifiOff, X } from 'lucide-react';
import { api, json } from '../lib/api';
import { QURAN_JUZ_STARTS, QURAN_SURAHS, getAyahLocation, getPageJuz, getPageSurah } from '../data/quranSurahs';

type Settings = Record<string, string>;
type TajweedSegment = { text: string; className: string };
type MushafWord = { text: string; tajweed?: string; codeV2?: string; lineNumber?: number; pageNumber?: number; position?: number; verseKey?: string; charTypeName?: string };
type MushafAyah = { textSource?: string; number: number; numberInSurah: number; surahNumber: number; surahName: string; arabicName: string; text: string; tajweedText?: string; tajweedSegments?: TajweedSegment[]; translation: string; transliteration?: string; translations?: Array<{ id: number; name: string; text: string }>; words?: MushafWord[] };
type MushafPage = { textSource?: string; page: number; juz: number; hizb?: number; tajweedComplete?: boolean; qcfAvailable?: boolean; translationSource?: string; ayahs: MushafAyah[]; offlineFallback?: boolean };
type Props = { settings: Settings; settingsReady: boolean; onLogged: () => void; autoOpen?: boolean };
const CACHE_PREFIX = 'atlas_mushaf_page_v12_';
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
function renderTajweedMarkup(markup: string, segments?: TajweedSegment[], fallback = '', enabled = true): ReactNode {
  const source = String(markup || '');
  if (!enabled) return normalizeMadinahArabic(stripAyahEndMarker(stripRawQuranMarkup(fallback || source)));
  const hasRawMarkup = /<[^>]+>|\[[a-zA-Z][a-zA-Z0-9_-]*(?::\d+)?\[/i.test(source);
  const parsed = hasRawMarkup ? parseBracketTajweed(source) : segments?.length ? segments : parseBracketTajweed(source);
  if (!parsed.length || (parsed.length === 1 && !parsed[0].className && !source.includes('['))) return stripAyahEndMarker(stripRawQuranMarkup(fallback || source));
  return <>{parsed.map((segment, index) => {
    const className = TAJWEED_CLASSES.has(segment.className) ? segment.className : '';
    const text = normalizeMadinahArabic(stripRawQuranMarkup(String(segment.text || ''))).replace(/\u06DD/g, '');
    return className ? <span key={index} className={className}>{text}</span> : <Fragment key={index}>{text}</Fragment>;
  })}</>;
}
const stripAyahEndMarker = (value: string) => value.replace(/\u06DD/g, '').trim();
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

function AyahMedallion({ number, className }: { number: number; className: string }) {
  return <span className={'mushaf-medallion ' + (number >= 100 ? 'mushaf-medallion--wide ' : '') + className} aria-label={'Ayah ' + number}>
    <svg className="mushaf-medallion-ornament" viewBox="0 0 36 36" aria-hidden="true" focusable="false">
      <path className="mushaf-medallion-scallop" d={AYAH_ROSETTE_PATH} />
      <circle cx="18" cy="18" r="11.6" />
      <circle cx="18" cy="18" r="9.9" className="mushaf-medallion-inner" />
      <path className="mushaf-medallion-crown" d="M13.5 4.2 C14.2 2.8 15.8 2.8 18 4.4 C20.2 2.8 21.8 2.8 22.5 4.2" />
    </svg>
    <span>{arabicNumber(number)}</span>
  </span>;
}
function BismillahOrnament() {
  return <div className="mushaf-bismillah" lang="ar" dir="rtl"><b>بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ</b><span>In the Name of Allah—the Most Compassionate, Most Merciful</span></div>;
}
const readBookmark = (key: string) => { try { const value = JSON.parse(localStorage.getItem(key) || '{}') || {}; return { page: clampPage(Number(value.page) || 1), surah: Number(value.surah) || 1, ayah: Number(value.ayah) || 1, updatedAt: String(value.updatedAt || '') }; } catch { return { page: 1, surah: 1, ayah: 1, updatedAt: '' }; } };
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
  const [isMobileViewport, setIsMobileViewport] = useState(() => window.matchMedia('(max-width: 767px)').matches);
  const [mobileControlsVisible, setMobileControlsVisible] = useState(false);
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
      const staleKeys: string[] = [];
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (key && (key.startsWith('atlas_mushaf_page_v11_') || /^atlas_mushaf_page_v(?:[1-9]|10)_/.test(key) || /^atlas_mushaf_cache_/.test(key) || /^atlas_quran_page_cache_/.test(key))) staleKeys.push(key);
      }
      staleKeys.forEach(key => localStorage.removeItem(key));
    } catch { /* local storage is optional */ }
  }, []);
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

  const activeSurahNumber = selected?.surah || pageData?.ayahs?.[0]?.surahNumber || bookmark.surah || 1;
  useEffect(() => {
    if (!sidebarOpen) return;
    activeSurahItemRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [sidebarOpen, activeSurahNumber]);

  const activeSurah = QURAN_SURAHS[activeSurahNumber - 1];
  const mobileActiveSurahNumber = pageData?.ayahs?.[0]?.surahNumber || getPageSurah(page)?.number || activeSurahNumber;
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
    const root = readingMode === 'reading' ? pageTextRef.current : readerRef.current;
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
      const pageNumber = clampPage(Number(topmost.dataset.page) || page);
      if (!surahNumber || !ayahNumber) return;
      setSelected(current => current?.surah === surahNumber && current.ayah === ayahNumber ? current : { surah: surahNumber, ayah: ayahNumber });
      updateBookmark(pageNumber, { surahNumber, numberInSurah: ayahNumber });
    }, { root, threshold: 0.01 });
    targets.forEach(target => observer.observe(target));
    return () => { observer.disconnect(); visible.clear(); };
  }, [fullScreen, readingMode, surahAyahs, pageData, page, updateBookmark]);
  const changePage = (next: number, location?: { surahNumber: number; numberInSurah: number }) => {
    userScrolledRef.current = false;
    const value = clampPage(next);
    if (value !== page) {
      setPageDirection(value > page ? 1 : -1);
      const cachedPage = readCachedMushafPage(value);
      setPageData(cachedPage);
      setLoading(!cachedPage);
      setPageError('');
    }
    restoreTargetRef.current = location ? location.surahNumber + ':' + location.numberInSurah : null;
    setPage(value); readerRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); setSelected(location ? { surah: location.surahNumber, ayah: location.numberInSurah } : null);
    updateBookmark(value, location ? { surahNumber: location.surahNumber, numberInSurah: location.numberInSurah } : null);
  };
  const changeMode = (next: 'hifz' | 'murajaah') => {
    if (next === mode) return;
    userScrolledRef.current = false;
    const target = next === 'hifz' ? hifzMark : murajaahMark;
    restoreTargetRef.current = readingMode === 'reading' ? null : target.surah + ':' + target.ayah;
    if (target.page !== page) { setLoading(true);  setPageError(''); }
    setPage(target.page); setPageInput(String(target.page)); setSelected({ surah: target.surah, ayah: target.ayah }); setMode(next);
  };
  const openReader = (next: 'hifz' | 'murajaah') => {
    userScrolledRef.current = false;
    const mark = next === 'hifz' ? hifzMark : murajaahMark;
    restoreTargetRef.current = readingMode === 'reading' ? null : mark.surah + ':' + mark.ayah;
    setMode(next);
    setPage(mark.page);
    setPageInput(String(mark.page));
    setSelected(mark.surah && mark.ayah ? { surah: mark.surah, ayah: mark.ayah } : null);
    setSidebarOpen(false);
    setLoading(true);  setPageError('');
    setFullScreen(true);
  };
  const autoOpenHandled = useRef(false);
  useEffect(() => {
    if (!autoOpen || !settingsReady || autoOpenHandled.current) return;
    autoOpenHandled.current = true;
    openReader('hifz');
  }, [autoOpen, settingsReady]);
  const changeReadingMode = (next: 'translation' | 'reading' | 'arabic') => { if (next !== readingMode) { updateBookmark(page, selectedAyah); setReadingMode(next); try { localStorage.setItem('atlas_mushaf_layout_v1', next); } catch { /* storage is optional */ } } };
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
  const readerContent = <div className={'mushaf-app' + (readingMode === 'reading' ? ' is-page-reading' : '') + (isMobileViewport && readingMode === 'reading' ? ' is-mobile-page-reading' : '') + (isMobileViewport && readingMode === 'translation' ? ' is-mobile-verse-reading' : '') + (mobileControlsVisible ? ' mobile-controls-visible' : '')} style={{ '--mushaf-arabic-font': "'" + arabicFontFamily + "', 'Amiri Quran', 'Traditional Arabic', serif" } as CSSProperties}>
    <header className={'mushaf-topbar mushaf-fs-header mushaf-mobile-header-shell' + (readingMode === 'translation' ? ' mushaf-verse-header' : '')}><div className="mushaf-mobile-topbar">
      {readingMode === 'translation' && isMobileViewport && <button type="button" className="mushaf-verse-back" onClick={() => setFullScreen(false)} aria-label="Back to Atlas"><X size={17}/></button>}
      <button type="button" className="mushaf-surah-trigger" onClick={() => setSidebarOpen(value => !value)} aria-expanded={sidebarOpen}>
        <span>{currentPageSurahLabel}</span><span aria-hidden="true">▾</span>
      </button>
      {readingMode === 'translation' && isMobileViewport && <div className="mushaf-verse-header-actions">
        <button type="button" className="mushaf-verse-icon-button" onClick={() => setTajweedLegendVisible(value => !value)} aria-label="Toggle Tajweed color key" aria-expanded={tajweedLegendVisible}><Info size={17}/></button>
      </div>}
      <div className="mushaf-topbar-view-toggle" role="group" aria-label="Reading view">
        <button type="button" className={readingMode === 'translation' ? 'is-active' : ''} aria-pressed={readingMode === 'translation'} onClick={() => changeReadingMode('translation')}>Verse by Verse</button>
        <button type="button" className={readingMode === 'reading' ? 'is-active' : ''} aria-pressed={readingMode === 'reading'} onClick={() => changeReadingMode('reading')}>Page by Page</button>
      </div>
      {isMobileViewport && <div className="mushaf-mobile-study-toggle" role="group" aria-label="Memorisation mode">
        <button type="button" className={mode === 'hifz' ? 'is-active' : ''} aria-pressed={mode === 'hifz'} onClick={() => changeMode('hifz')}>Hifz</button>
        <button type="button" className={mode === 'murajaah' ? 'is-active' : ''} aria-pressed={mode === 'murajaah'} onClick={() => changeMode('murajaah')}>Muraja’ah</button>
      </div>}
      <div className="mushaf-topbar-center"><Bookmark size={14}/><span>Page {page} · Juz {pageJuz} / Hizb {pageHizb}</span><span className="mushaf-autosaved">Auto-saved · {bookmarkSurahName} {bookmark.surah}:{bookmark.ayah}</span></div>
      <div className="mushaf-topbar-actions">
        <div className="mushaf-settings-anchor">
          <button type="button" className={readingMode === 'translation' && isMobileViewport ? 'mushaf-settings-trigger mushaf-verse-icon-button' : 'mushaf-settings-trigger'} onClick={() => setSettingsOpen(value => !value)} aria-label="Reading settings" aria-expanded={settingsOpen}><Settings size={17} strokeWidth={1.8}/></button>
          {settingsOpen && <section className="mushaf-settings-popover" role="dialog" aria-label="Reading settings">
            <div className="mushaf-settings-heading"><b>Reading settings</b><button type="button" onClick={() => setSettingsOpen(false)} aria-label="Close reading settings">×</button></div>
            <div className="mushaf-setting-field"><span>Reading view</span><div className="mushaf-layout-options" role="group" aria-label="Reading view">
              <button type="button" className={readingMode === 'translation' ? 'is-active' : ''} aria-pressed={readingMode === 'translation'} onClick={() => changeReadingMode('translation')}>Verse by Verse</button>
              <button type="button" className={readingMode === 'reading' ? 'is-active' : ''} aria-pressed={readingMode === 'reading'} onClick={() => changeReadingMode('reading')}>Page by Page</button>
            </div></div>
            <div className="mushaf-setting-field"><span>Arabic display</span><div className="mushaf-layout-options" role="group" aria-label="Arabic display">
              <button type="button" className={readingMode === 'arabic' ? 'is-active' : ''} aria-pressed={readingMode === 'arabic'} onClick={() => changeReadingMode('arabic')}>Arabic Only</button>
            </div></div>
            <div className="mushaf-setting-field"><span>Study mode</span><div className="mushaf-layout-options" role="group" aria-label="Study mode">
              <button type="button" className={mode === 'hifz' ? 'is-active' : ''} aria-pressed={mode === 'hifz'} onClick={() => changeMode('hifz')}>Hifz</button>
              <button type="button" className={mode === 'murajaah' ? 'is-active' : ''} aria-pressed={mode === 'murajaah'} onClick={() => changeMode('murajaah')}>Muraja’ah</button>
            </div></div>
            <div className="mushaf-setting-field"><span>Qur’an calligraphy</span><div className="mushaf-font-preview-list">{MUSHAF_FONTS.map(font => <button type="button" key={font.name} className={'mushaf-font-preview-card' + (arabicFontFamily === font.name ? ' is-active' : '')} aria-pressed={arabicFontFamily === font.name} onClick={() => changeArabicFont(font.name)}><span className="mushaf-font-preview-copy"><b>{font.name}</b><small>{font.label}</small></span><span className="mushaf-font-preview-sample" lang="ar" dir="rtl" style={{ fontFamily: "'" + font.name + "', 'Amiri Quran', 'Traditional Arabic', serif", fontSize: 22, letterSpacing: 0, fontWeight: 400 }}>{MUSHAF_FONT_SAMPLE}</span></button>)}</div></div>
            <div className="mushaf-setting-field"><span>Font size</span><div className="mushaf-setting-options">{[20,24,28,32,36].map(size => <button type="button" key={size} className={arabicFontSize === size ? 'is-active' : ''} aria-pressed={arabicFontSize === size} onClick={() => changeArabicFontSize(size)}>{size}</button>)}</div></div>
            <div className="mushaf-setting-field"><span>Tajweed colors</span><button type="button" className={'mushaf-tajweed-toggle' + (tajweedEnabled ? ' is-active' : '')} onClick={toggleTajweed} aria-pressed={tajweedEnabled}>{tajweedEnabled ? 'On' : 'Off'}</button></div>
            <div className="mushaf-setting-field"><span>Transliteration</span><button type="button" className={'mushaf-tajweed-toggle' + (transliterationEnabled ? ' is-active' : '')} onClick={toggleTransliteration} aria-pressed={transliterationEnabled}>{transliterationEnabled ? 'On' : 'Off'}</button></div>
            <div className="mushaf-settings-key" aria-label="Tajweed color key">
              <span><i className="tj-madd"/>Madd Lazim · 6 counts</span><span><i className="tj-madd-wajib"/>Madd Wajib · 2–5 counts</span>
              <span><i className="tj-ghunnah"/>Ghunnah / Ikhfa / Idgham</span><span><i className="tj-qalqalah"/>Qalqalah</span>
              <span><i className="tj-tafkhim"/>Tafkheem · Heavy letters</span><span><i className="tj-silent"/>Silent / Hamzat Wasl</span>
            </div>
          </section>}
        </div>
        <button type="button" className="mushaf-exit" onClick={() => setFullScreen(false)} aria-label="Exit Qur’an reader"><X size={16}/></button>
      </div>
      {isMobileViewport && (readingMode === 'reading' || readingMode === 'translation') && <div className="mushaf-page-mobile-chrome">
        <div className="mushaf-page-mobile-meta">
          <span className="mushaf-page-mobile-bookmark"><Bookmark size={14}/><b>Page {page}</b><i aria-hidden="true"/><small>Auto-saved</small></span>
          <span>Juz {pageJuz}</span>
        </div>
        <div className="mushaf-page-mobile-controls">
          <button type="button" className="mushaf-page-surah-trigger" onClick={() => setSidebarOpen(value => !value)} aria-expanded={sidebarOpen}><span>{activeSurahNumber}. {activeSurah?.transliteration || currentPageSurahLabel}</span><span aria-hidden="true">▾</span></button>
          <div className="mushaf-topbar-view-toggle" role="group" aria-label="Reading view">
            <button type="button" className={readingMode === 'translation' ? 'is-active' : ''} aria-pressed={readingMode === 'translation'} onClick={() => changeReadingMode('translation')}>Verse by Verse</button>
            <button type="button" className={readingMode === 'reading' ? 'is-active' : ''} aria-pressed={readingMode === 'reading'} onClick={() => changeReadingMode('reading')}>Page by Page</button>
          </div>
          <div className="mushaf-settings-anchor">
            <button type="button" className="mushaf-settings-trigger" onClick={() => setSettingsOpen(value => !value)} aria-label="Reading settings" aria-expanded={settingsOpen}><Settings size={17} strokeWidth={1.8}/></button>
            {settingsOpen && <section className="mushaf-settings-popover" role="dialog" aria-label="Reading settings">
              <div className="mushaf-settings-heading"><b>Reading settings</b><button type="button" onClick={() => setSettingsOpen(false)} aria-label="Close reading settings">×</button></div>
              <div className="mushaf-setting-field"><span>Study mode</span><div className="mushaf-layout-options" role="group" aria-label="Study mode">
                <button type="button" className={mode === 'hifz' ? 'is-active' : ''} aria-pressed={mode === 'hifz'} onClick={() => changeMode('hifz')}>Hifz</button>
                <button type="button" className={mode === 'murajaah' ? 'is-active' : ''} aria-pressed={mode === 'murajaah'} onClick={() => changeMode('murajaah')}>Muraja'ah</button>
              </div></div>
              <div className="mushaf-setting-field"><span>Qur'an calligraphy</span><div className="mushaf-font-preview-list">{MUSHAF_FONTS.map(font => <button type="button" key={font.name} className={'mushaf-font-preview-card' + (arabicFontFamily === font.name ? ' is-active' : '')} aria-pressed={arabicFontFamily === font.name} onClick={() => changeArabicFont(font.name)}><span className="mushaf-font-preview-copy"><b>{font.name}</b><small>{font.label}</small></span><span className="mushaf-font-preview-sample" lang="ar" dir="rtl" style={{ fontFamily: "'" + font.name + "', 'Amiri Quran', 'Traditional Arabic', serif", fontSize: 22, letterSpacing: 0, fontWeight: 400 }}>{MUSHAF_FONT_SAMPLE}</span></button>)}</div></div>
              <div className="mushaf-setting-field"><span>Font size</span><div className="mushaf-setting-options">{[20,24,28,32,36].map(size => <button type="button" key={size} className={arabicFontSize === size ? 'is-active' : ''} aria-pressed={arabicFontSize === size} onClick={() => changeArabicFontSize(size)}>{size}</button>)}</div></div>
              <div className="mushaf-setting-field"><span>Tajweed colors</span><button type="button" className={'mushaf-tajweed-toggle' + (tajweedEnabled ? ' is-active' : '')} onClick={toggleTajweed} aria-pressed={tajweedEnabled}>{tajweedEnabled ? 'On' : 'Off'}</button></div>
              <div className="mushaf-settings-key" aria-label="Tajweed color key">
                <span><i className="tj-madd"/>Madd Lazim · 6 counts</span><span><i className="tj-madd-wajib"/>Madd Wajib · 2–5 counts</span>
                <span><i className="tj-ghunnah"/>Ghunnah / Ikhfa / Idgham</span><span><i className="tj-qalqalah"/>Qalqalah</span>
                <span><i className="tj-tafkhim"/>Tafkheem · Heavy letters</span><span><i className="tj-silent"/>Silent / Hamzat Wasl</span>
              </div>
            </section>}
          </div>
          <button type="button" className="mushaf-exit" onClick={() => setFullScreen(false)} aria-label="Exit Qur’an reader"><X size={16}/></button>
        </div>
      </div>}
      </div>
    </header>

    {tajweedEnabled && readingMode !== 'translation' && <div className="mushaf-tajweed-keybar" role="group" aria-label="Tajweed color key">
      <span><i className="tj-madd"/>Madd Lazim</span><span><i className="tj-madd-wajib"/>Madd Wajib</span><span><i className="tj-ghunnah"/>Ghunnah / Ikhfa / Idgham</span><span><i className="tj-qalqalah"/>Qalqalah</span><span><i className="tj-heavy"/>Tafkheem</span><span><i className="tj-silent"/>Silent</span>
    </div>}
    <div className="mushaf-workspace">
      <AnimatePresence initial={false}>{sidebarOpen && <motion.button type="button" className="mushaf-sidebar-scrim" aria-label="Close Surah navigation" onClick={() => setSidebarOpen(false)} initial={prefersReducedMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.2 }} />}{sidebarOpen && <motion.aside className="mushaf-sidebar" aria-label="Qur’an navigation" initial={prefersReducedMotion ? false : { x: '-100%', opacity: 0.6 }} animate={{ x: 0, opacity: 1 }} exit={{ x: '-100%', opacity: 0.6 }} transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.24, ease: [0.16, 1, 0.3, 1] }}>
        <div className="mushaf-sidebar-head">
          <div className="mushaf-sidebar-tabs" role="tablist" aria-label="Browse Qur’an">
            <button type="button" role="tab" aria-selected={sidebarTab === 'surah'} className={sidebarTab === 'surah' ? 'is-active' : ''} onClick={() => setSidebarTab('surah')}>Surah</button>
            <button type="button" role="tab" aria-selected={sidebarTab === 'verse'} className={sidebarTab === 'verse' ? 'is-active' : ''} onClick={() => setSidebarTab('verse')}>Verse</button>
            <button type="button" role="tab" aria-selected={sidebarTab === 'juz'} className={sidebarTab === 'juz' ? 'is-active' : ''} onClick={() => setSidebarTab('juz')}>Juz</button>
            <button type="button" role="tab" aria-selected={sidebarTab === 'page'} className={sidebarTab === 'page' ? 'is-active' : ''} onClick={() => setSidebarTab('page')}>Page</button>
          </div>
          <button type="button" className="mushaf-sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="Close navigation"><X size={15}/></button>
        </div>
        <small className="mushaf-sidebar-tip">Tip: try navigating with ctrl K</small>
        <label className="mushaf-sidebar-search"><Search size={15}/><input value={surahSearch} onChange={event => setSurahSearch(event.target.value)} placeholder={sidebarTab === 'surah' ? 'Search Surah' : sidebarTab === 'juz' ? 'Search Juz' : sidebarTab === 'verse' ? 'Surah:Ayah (e.g. 2:27)' : 'Search page'} aria-label="Search Qur’an navigation"/></label>
        <div className="mushaf-sidebar-list">
          {sidebarTab === 'surah' && QURAN_SURAHS.filter(item => { const q=surahSearch.trim().toLowerCase(); return !q || String(item.number)===q || item.transliteration.toLowerCase().includes(q) || item.english.toLowerCase().includes(q); }).map(item => <button ref={item.number === activeSurahNumber ? activeSurahItemRef : undefined} type="button" key={item.number} className={item.number === activeSurahNumber ? 'is-active' : ''} onClick={() => { jumpSurah(item.number); setSurahSearch(''); }}>
            <span className="mushaf-sidebar-number">{item.number}</span><span className="mushaf-sidebar-name"><b>{item.transliteration}</b><small>{item.ayahs} ayahs · {item.revelation}</small></span><strong lang="ar" dir="rtl">{item.arabic}</strong>
          </button>)}
          {sidebarTab === 'verse' && <div className="mushaf-page-jump"><label>Enter Surah:Ayah above</label><button type="button" onClick={() => {
            const match = surahSearch.trim().match(/^(\d{1,3})\s*:\s*(\d{1,3})$/);
            if (!match) return;
            const surahNumber = Number(match[1]); const ayahNumber = Number(match[2]);
            const surah = QURAN_SURAHS[surahNumber - 1];
            if (!surah || ayahNumber < 1 || ayahNumber > surah.ayahs) return;
            changePage(getAyahLocation(surahNumber, ayahNumber)?.page || surah.pageStart, { surahNumber, numberInSurah: ayahNumber });
            setSurahSearch(''); setSidebarOpen(false);
          }}>Go to verse</button></div>}
          {sidebarTab === 'juz' && QURAN_JUZ_STARTS.filter(([juz]) => !surahSearch.trim() || String(juz).includes(surahSearch.trim())).map(([juz,surah,ayah]) => <button type="button" key={juz} onClick={() => { jumpJuz(juz); setSurahSearch(''); }}><span className="mushaf-sidebar-number">{juz}</span><span className="mushaf-sidebar-name"><b>Juz {juz}</b><small>{QURAN_SURAHS[surah-1]?.transliteration} · Ayah {ayah}</small></span></button>)}
          {sidebarTab === 'page' && <form className="mushaf-page-jump" onSubmit={quickJump}><label htmlFor="mushaf-page-number">Go to page (1–604)</label><div><input id="mushaf-page-number" type="number" min="1" max="604" value={pageInput} onChange={event => setPageInput(event.target.value)}/><button type="submit">Go</button></div><div className="mushaf-page-grid">{Array.from({length:604},(_,index)=>index+1).filter(value=>!surahSearch.trim()||String(value).includes(surahSearch.trim())).map(value=><button type="button" key={value} className={value===page?'is-active':''} onClick={()=>{changePage(value);setSurahSearch('');setSidebarOpen(false);}}>{value}</button>)}</div></form>}
        </div>
      </motion.aside>}</AnimatePresence>
      <main className="mushaf-main">
        <div className="mushaf-canvas" ref={readerRef} onClick={() => { if (isMobileViewport && readingMode === 'reading') setMobileControlsVisible(value => !value); }} onWheel={() => { userScrolledRef.current = true; }} onTouchMove={() => { userScrolledRef.current = true; }} onKeyDown={() => { userScrolledRef.current = true; }}>
          {loading && <div className="mushaf-loading" role="status" aria-label={'Loading page ' + page}>Loading Qur’an page {page}…</div>}
          {!loading && pageError && <div className="mushaf-error" role="alert"><WifiOff size={22}/><p>{pageError}</p><button type="button" onClick={() => changePage(page)}>Retry</button></div>}
          <AnimatePresence initial={false}>{!loading && pageData && readingMode !== 'reading' && <motion.section key={'verse-' + activeSurahNumber} className="mushaf-verse-view" dir="ltr" lang="en" initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.18, ease: 'easeOut' }}>
            {tajweedLegendVisible && readingMode === 'translation' && isMobileViewport && <div className="mushaf-verse-tajweed-key" role="group" aria-label="Tajweed color key">
              <span><i className="tj-madd"/>Madd Lazim</span><span><i className="tj-madd-wajib"/>Madd Wajib</span><span><i className="tj-ghunnah"/>Ghunnah / Ikhfa / Idgham</span><span><i className="tj-qalqalah"/>Qalqalah</span><span><i className="tj-heavy"/>Tafkheem</span><span><i className="tj-silent"/>Silent</span>
            </div>}
            {true && <>
              <header className="mushaf-surah-hero">
                <b className="mushaf-hero-arabic" lang="ar" dir="rtl">{activeSurah?.arabic || ''}</b>
                <div className="mushaf-hero-copy"><h1>{activeSurahNumber}. Surah {activeSurah?.transliteration || 'Surah'}</h1><p>{activeSurah?.english || ''} · {activeSurah?.ayahs || surahAyahs.length} Ayahs</p></div>
                <div className="mushaf-hero-modes"><button type="button" className={mode === 'hifz' ? 'is-active' : ''} onClick={() => changeMode('hifz')}>Hifz</button><button type="button" className={mode === 'murajaah' ? 'is-active' : ''} onClick={() => changeMode('murajaah')}>Muraja'ah</button></div>
              </header>
              {activeSurahNumber !== 9 && <BismillahOrnament/>}
            </>}
            {surahLoading && <p className="mushaf-loading" role="status">Loading {activeSurah?.transliteration || 'Surah'}…</p>}
            {!surahLoading && surahError && <div className="mushaf-error" role="alert"><p>{surahError}</p><button type="button" onClick={() => setReadingMode('reading')}>Return to Page by Page</button></div>}
            {!surahLoading && <motion.div className="mushaf-verse-list" initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.0012 } } }}>{surahAyahs.map(ayah => <motion.article ref={node => { const key = ayah.surahNumber + ':' + ayah.numberInSurah; if (node) verseRowRefs.current.set(key, node); else verseRowRefs.current.delete(key); }} variants={{ hidden: { opacity: 0, y: 5 }, visible: { opacity: 1, y: 0 } }} transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.2, ease: 'easeOut', delay: Math.min(ayah.numberInSurah * 0.012, 0.14) }} className="mushaf-verse-row" key={ayah.surahNumber + ':' + ayah.numberInSurah} data-mushaf-verse="true" data-surah={ayah.surahNumber} data-ayah={ayah.numberInSurah} data-page={getAyahLocation(ayah.surahNumber, ayah.numberInSurah)?.page || page}>
              <div className="mushaf-verse-top">
                <span className="mushaf-verse-aya-pill">Aya {ayah.surahNumber}:{ayah.numberInSurah}</span>
                <div className="mushaf-verse-tools">
                  <button type="button" aria-label="Bookmark verse" aria-pressed={starredAyahs.some(item => item.surah === ayah.surahNumber && item.ayah === ayah.numberInSurah)} onClick={() => toggleStarredAyah(ayah)}><Bookmark size={15}/></button>
                  <button type="button" aria-label="Copy verse" onClick={() => { void navigator.clipboard?.writeText(ayah.text + '\\n' + ayah.surahNumber + ':' + ayah.numberInSurah); }}><Copy size={14}/></button>
                </div>
              </div>
              <button type="button" className="mushaf-verse-arabic" dir="rtl" lang="ar" style={{ fontSize: arabicFontSize + 'px', fontFamily: "'UthmanicHafs', serif", fontWeight: 400, letterSpacing: '0px', fontFeatureSettings: '"kern" 1, "liga" 1, "calt" 1, "mark" 1, "mkmk" 1' }} onClick={() => selectAyah(ayah)} aria-pressed={selected?.surah === ayah.surahNumber && selected?.ayah === ayah.numberInSurah}>
                {ayah.textSource === 'quran-uthmani' ? ayah.text : renderTajweedMarkup(ayah.tajweedText || '', ayah.tajweedSegments, ayah.text, tajweedEnabled)}<AyahMedallion className="mushaf-verse-medallion" number={ayah.numberInSurah}/>
              </button>
              {transliterationEnabled && ayah.transliteration && <p className="mushaf-verse-transliteration">{ayah.transliteration}</p>}
              {readingMode !== 'arabic' && <p className="mushaf-verse-translation">{ayah.translation || 'Translation unavailable.'}</p>}
            </motion.article>)}</motion.div>}
          </motion.section>}</AnimatePresence>
          <AnimatePresence mode="wait" custom={pageDirection} initial={false}>{pageData?.ayahs?.length > 0 && readingMode === 'reading' && <motion.section key={'page-' + pageData.page} className="mushaf-page-view" dir="rtl" lang="ar" style={{ fontSize: arabicFontSize + 'px', fontFamily: "'UthmanicHafs', serif", fontWeight: 400, letterSpacing: '0px' }} drag={isMobileViewport ? 'x' : false} dragConstraints={{ left: 0, right: 0 }} dragElastic={0.25} dragDirectionLock onDragEnd={(_, info) => { const offsetX = info.offset.x; const velocityX = info.velocity.x; if (Math.abs(offsetX) > 55 || Math.abs(velocityX) > 350) { const direction = Math.abs(offsetX) > 55 ? offsetX : velocityX; if (direction > 0 && page < 604) changePage(page + 1); else if (direction < 0 && page > 1) changePage(page - 1); }} } initial={prefersReducedMotion ? false : { opacity: 0, x: pageDirection * 36, scale: 0.985 }} animate={{ opacity: 1, x: 0, scale: 1 }} whileDrag={{ opacity: 0.985, scale: 0.985 }} exit={{ opacity: 0, x: pageDirection * -36, scale: 0.985 }} transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.22, ease: [0.22, 1, 0.36, 1] }}>
            {isMobileViewport && <div className="mushaf-mobile-page-header" aria-hidden="true"><span>{mobileActiveSurahName}</span><span>Juz {pageJuz}</span></div>}
            <div className="mushaf-page-text" ref={pageTextRef} dir="rtl" onScroll={() => { userScrolledRef.current = true; }} style={{ '--mushaf-fit-font-size': mobilePageFit.fontSize + 'px', '--mushaf-fit-line-height': String(mobilePageFit.lineHeight), fontSize: arabicFontSize + 'px', fontFamily: "'" + arabicFontFamily + "', 'Amiri Quran', 'Traditional Arabic', serif", fontWeight: 400, letterSpacing: '0px', fontFeatureSettings: '"kern" 1, "liga" 1, "calt" 1, "mark" 1, "mkmk" 1' } as CSSProperties}>{pageData.ayahs.map((ayah, index) => {
              const surah = QURAN_SURAHS[ayah.surahNumber - 1];
              const startsSurah = ayah.numberInSurah === 1;
              return <Fragment key={ayah.surahNumber + ':' + ayah.numberInSurah}>
                {startsSurah && <header className="mushaf-page-surah-banner">
                  <div className="mushaf-page-surah-hero-main"><b lang="ar" dir="rtl">{surah?.arabic || ayah.arabicName}</b><div><strong>{ayah.surahNumber}. Surah {surah?.transliteration || ayah.surahName}</strong><span>{surah?.english || ''}</span></div></div>
                  <p>{surah?.revelation || 'Qur’an'} · {surah?.ayahs || 0} verses</p>
                  <div className="mushaf-page-hero-modes" role="group" aria-label="Bookmark mode">
                    <button type="button" className={mode === 'hifz' ? 'is-active' : ''} aria-pressed={mode === 'hifz'} onClick={() => changeMode('hifz')}>Hifz</button>
                    <button type="button" className={mode === 'murajaah' ? 'is-active' : ''} aria-pressed={mode === 'murajaah'} onClick={() => changeMode('murajaah')}>Muraja'ah</button>
                  </div>
                </header>}
                {startsSurah && ayah.surahNumber !== 9 && <div className="mushaf-page-bismillah"><b>بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ</b><span>In the Name of Allah—the Most Compassionate, Most Merciful</span></div>}
                {index === 0 && !startsSurah && <div className="mushaf-page-context">{surah?.transliteration || ayah.surahName}</div>}
                <span ref={node => { const key = ayah.surahNumber + ':' + ayah.numberInSurah; if (node) verseRowRefs.current.set(key, node); else verseRowRefs.current.delete(key); }} className="mushaf-page-ayah" data-mushaf-verse="true" data-surah={ayah.surahNumber} data-ayah={ayah.numberInSurah} data-page={pageData.page}>{ayah.textSource === 'quran-uthmani' ? ayah.text : renderTajweedMarkup(ayah.tajweedText || '', ayah.tajweedSegments, ayah.text, tajweedEnabled)}<AyahMedallion className="mushaf-page-medallion" number={ayah.numberInSurah}/></span>{' '}
              </Fragment>;
            })}</div><footer className="mushaf-page-footer" dir="ltr">{/* Legacy footer contract: — Page {page} · Juz {pageJuz} — */}<span className="mushaf-page-footer-desktop">— Page {pageData.page} · Juz {pageJuz} —</span>{isMobileViewport && <span className="mushaf-page-footer-mobile">Page {pageData.page}</span>}</footer>
          </motion.section>}</AnimatePresence>
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
    {fullScreen && createPortal(<div className={'mushaf-fs-overlay' + (sidebarOpen ? ' is-sidebar-open' : '')} role="dialog" aria-modal="true" aria-label="Full-screen Qur’an Mushaf">{readerContent}</div>, document.body)}
  </>;
}

