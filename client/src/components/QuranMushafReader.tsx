import { Fragment, type CSSProperties, type FormEvent, type ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { AlignJustify, ArrowDown, ArrowUp, Bookmark, BookOpen, ChevronsUpDown, ChevronLeft, ChevronRight, Copy, Info, Palette, Search, Settings, WifiOff, X } from 'lucide-react';
import { api, json } from '../lib/api';
import { QURAN_JUZ_STARTS, QURAN_SURAHS, getAyahLocation, getPageJuz, getPageSurah } from '../data/quranSurahs';

type Settings = Record<string, string>;
type TajweedSegment = { text: string; className: string };
type MushafWord = { text: string; tajweed?: string; codeV2?: string; lineNumber?: number; pageNumber?: number; position?: number; verseKey?: string; charTypeName?: string };
type MushafAyah = { textSource?: string; pageNumber?: number; number: number; numberInSurah: number; surahNumber: number; surahName: string; arabicName: string; text: string; tajweedText?: string; tajweedSegments?: TajweedSegment[]; translation: string; transliteration?: string; translations?: Array<{ id: number; name: string; text: string }>; words?: MushafWord[] };
type MushafPage = { textSource?: string; page: number; juz: number; hizb?: number; tajweedComplete?: boolean; tajweedCoverage?: { totalAyahs: number; sourcedAyahs: number; coloredAyahs: number; uncoloredAyahs: string[]; missingAyahs: string[]; mismatchedAyahs: string[] }; qcfAvailable?: boolean; translationSource?: string; ayahs: MushafAyah[]; offlineFallback?: boolean };
type Props = { settings: Settings; settingsReady: boolean; onLogged: () => void; autoOpen?: boolean };
const CACHE_PREFIX = 'atlas_mushaf_page_v18_';
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
const TAJWEED_CLASSES = new Set(["tj-silent","tj-madd-normal","tj-madd-permissible","tj-madd-necessary","tj-madd-obligatory","tj-madd-obligatory-connected","tj-madd-obligatory-separated","tj-madd","tj-madd-wajib","tj-qalqalah","tj-ikhfa","tj-ikhfa-shafawi","tj-iqlab","tj-idgham-shafawi","tj-idgham-ghunnah","tj-idgham-no-ghunnah","tj-idgham-mutajanisayn","tj-idgham-mutaqaribayn","tj-idgham","tj-ghunnah","tj-tafkhim","tj-heavy"]);
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
  ham_wasl:'tj-silent',hamzat_wasl:'tj-silent',hamzat_al_wasl:'tj-silent',h:'tj-silent',
  slnt:'tj-silent',silent:'tj-silent',s:'tj-silent',laam_shamsiyah:'tj-silent',laam_shamsiyyah:'tj-silent',
  lam_shamsiyah:'tj-silent',lam_shamsiyyah:'tj-silent',l:'tj-silent',
  madda_normal:'tj-madd-normal',n:'tj-madd-normal',
  madda_permissible:'tj-madd-permissible',p:'tj-madd-permissible',
  madda_necessary:'tj-madd-necessary',m:'tj-madd-necessary',
  madda_obligatory:'tj-madd-obligatory',madda_obligatory_mottasel:'tj-madd-obligatory-connected',
  madda_obligatory_monfasel:'tj-madd-obligatory-separated',o:'tj-madd-obligatory',
  qalaqah:'tj-qalqalah',qalqalah:'tj-qalqalah',qalqala:'tj-qalqalah',q:'tj-qalqalah',qlq:'tj-qalqalah',
  ikhafa:'tj-ikhfa',ikhfa:'tj-ikhfa',f:'tj-ikhfa',
  ikhafa_shafawi:'tj-ikhfa-shafawi',ikhfa_shafawi:'tj-ikhfa-shafawi',c:'tj-ikhfa-shafawi',
  iqlab:'tj-iqlab',iqlb:'tj-iqlab',i:'tj-iqlab',
  idgham_shafawi:'tj-idgham-shafawi',idghm_shfw:'tj-idgham-shafawi',w:'tj-idgham-shafawi',
  idgham_ghunnah:'tj-idgham-ghunnah',idgh_w_ghn:'tj-idgham-ghunnah',a:'tj-idgham-ghunnah',
  idgham_wo_ghunnah:'tj-idgham-no-ghunnah',u:'tj-idgham-no-ghunnah',
  idgham_mutajanisayn:'tj-idgham-mutajanisayn',idgh_mus:'tj-idgham-mutajanisayn',d:'tj-idgham-mutajanisayn',
  idgham_mutaqaribayn:'tj-idgham-mutaqaribayn',b:'tj-idgham-mutaqaribayn',
  ghunnah:'tj-ghunnah',ghn:'tj-ghunnah',g:'tj-ghunnah',
  tafkhim:'tj-tafkhim',tafkheem:'tj-tafkhim',heavy:'tj-tafkhim',r:'tj-tafkhim',
  'tj-silent':'tj-silent','tj-madd':'tj-madd-normal','tj-madd-wajib':'tj-madd-obligatory',
  'tj-qalqalah':'tj-qalqalah','tj-ikhfa':'tj-ikhfa','tj-ikhfa-shafawi':'tj-ikhfa-shafawi',
  'tj-iqlab':'tj-iqlab','tj-idgham':'tj-idgham-ghunnah','tj-idgham-shafawi':'tj-idgham-shafawi',
  'tj-idgham-ghunnah':'tj-idgham-ghunnah','tj-idgham-no-ghunnah':'tj-idgham-no-ghunnah',
  'tj-idgham-mutajanisayn':'tj-idgham-mutajanisayn','tj-idgham-mutaqaribayn':'tj-idgham-mutaqaribayn',
  'tj-ghunnah':'tj-ghunnah','tj-tafkhim':'tj-tafkhim','tj-heavy':'tj-tafkhim',
  'tj-madd-normal':'tj-madd-normal','tj-madd-permissible':'tj-madd-permissible',
  'tj-madd-necessary':'tj-madd-necessary','tj-madd-obligatory':'tj-madd-obligatory','tj-madd-obligatory-connected':'tj-madd-obligatory-connected','tj-madd-obligatory-separated':'tj-madd-obligatory-separated'
};
const stripRawQuranMarkup = (value: string) => value
  .replace(/<span\s+class=["']?end["']?[^>]*>[\s\S]*?<\/span>/gi, '')
  .replace(/<[^>]+>/g, '')
  .replace(/\[[a-zA-Z]+(?::\d+)?\[/g, '')
  .replace(/\]/g, '')
  .replace(/(?:\\u25CC|\\u{25CC}|&#(?:x0*25cc|0*9676);|&#x0*25cc;)/gi, '')
  .replace(/\u25CC/g, '');
function parseBracketTajweed(markup: string): TajweedSegment[] {
  const source = String(markup || '').replace(/<span\s+class=["']?end["']?[^>]*>[\s\S]*?<\/span>/gi, '');
  const result: TajweedSegment[] = [];
  const stack: string[] = [];
  let leadingMarks = '';
  const append = (text: string, className: string) => {
    if (!text) return;
    const normalized = normalizeMadinahArabic(stripRawQuranMarkup(text));
    for (const character of Array.from(normalized)) {
      const previous = result[result.length - 1];
      if (/\p{M}/u.test(character)) {
        // A mark with no preceding Arabic base must wait for the next base.
        // Rendering it alone makes some fonts draw a dotted-circle placeholder.
        if (previous) previous.text += character;
        else leadingMarks += character;
      } else {
        const clustered = character + leadingMarks;
        leadingMarks = '';
        if (previous && previous.className === className) previous.text += clustered;
        else result.push({ text: clustered, className });
      }
    }
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
    const tajweedSegments: TajweedSegment[] = [];
    let leadingMarks = '';
    sourceSegments.forEach(segment => {
      const className = TAJWEED_CLASSES.has(segment.className) ? segment.className : '';
      for (const character of Array.from(stripRawQuranMarkup(String(segment.text || '')))) {
        if (/\p{M}/u.test(character)) {
          const previous = tajweedSegments[tajweedSegments.length - 1];
          const lastCharacter = previous ? Array.from(previous.text).slice(-1)[0] || '' : '';
          if (previous) previous.text += character;
          else leadingMarks += character;
        } else {
          const clustered = character + leadingMarks;
          leadingMarks = '';
          const previous = tajweedSegments[tajweedSegments.length - 1];
          if (previous && previous.className === className) previous.text += clustered;
          else tajweedSegments.push({ text: clustered, className });
        }
      }
    });
    const tajweedText = tajweedSegments.map(segment => segment.text).join('') || stripRawQuranMarkup(rawTajweed);
    return {
      ...ayah,
      text: stripAyahEndMarker(stripRawQuranMarkup(ayah.text || '')) || tajweedText,
      tajweedText,
      tajweedSegments,
      translation: stripAyahEndMarker(stripRawQuranMarkup(ayah.translation || '')),
      translations: ayah.translations?.map(translation => ({ ...translation, text: stripAyahEndMarker(stripRawQuranMarkup(translation.text || '')) })),
      words: ayah.words?.map(word => ({ ...word, text: stripRawQuranMarkup(word.text || ''), tajweed: stripRawQuranMarkup(word.tajweed || ''), codeV2: word.codeV2 ? stripRawQuranMarkup(word.codeV2) : word.codeV2 }))
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

type QcfV4Font = { family: string; palette?: string; theme: 'light' | 'dark' | 'sepia' };
const qcfV4FontCache = new Map<string, Promise<QcfV4Font>>();
async function loadQcfV4PageFont(page: number): Promise<QcfV4Font> {
  const themeId = document.documentElement.getAttribute('data-theme') || 'shadowed-alchemist';
  const theme: 'light' | 'dark' | 'sepia' = themeId.startsWith('light-') ? 'light' : themeId.includes('sepia') ? 'sepia' : 'dark';
  const firefox = /firefox/i.test(navigator.userAgent);
  const format = firefox ? 'ot-svg' : 'colrv1';
  const key = page + ':' + format + ':' + theme;
  const cached = qcfV4FontCache.get(key);
  if (cached) return cached;
  const task: Promise<QcfV4Font> = (async (): Promise<QcfV4Font> => {
    const family = 'AtlasQcfV4P' + page + theme + (firefox ? '' : 'Color');
    const fontUrl = format === 'ot-svg'
      ? 'https://verses.quran.foundation/fonts/quran/hafs/v4/ot-svg/' + theme + '/woff2/p' + page + '.woff2'
      : 'https://verses.quran.foundation/fonts/quran/hafs/v4/colrv1/woff2/p' + page + '.woff2';
    const fontFace = new FontFace(family, 'url(' + fontUrl + ')');
    fontFace.display = 'block';
    await fontFace.load();
    if (fontFace.status !== 'loaded') throw new Error('QCF V4 font did not reach the loaded state for page ' + page);
    document.fonts.add(fontFace);
    await document.fonts.load('16px "' + family + '"');
    if (!document.fonts.check('16px "' + family + '"')) throw new Error('QCF V4 font is not available for page ' + page);
    if (format === 'ot-svg') return { family, theme };
    const palette = '--AtlasQcfV4P' + page + theme;
    let style = document.getElementById('atlas-qcf-v4-palettes') as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement('style');
      style.id = 'atlas-qcf-v4-palettes';
      document.head.appendChild(style);
    }
    const basePalette = theme === 'dark' ? 1 : theme === 'sepia' ? 2 : 0;
    style.textContent += '\n@font-palette-values ' + palette + ' { font-family: "' + family + '"; base-palette: ' + basePalette + '; }';
    return { family, palette, theme };
  })();
  qcfV4FontCache.set(key, task);
  try { return await task; } catch (error) { qcfV4FontCache.delete(key); throw error; }
}
const escapeQcfGlyphHtml = (value: string) => String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&#39;');
const qcfV4WordStyle = (font: QcfV4Font): CSSProperties => ({
  // QCF code_v2 contains font-specific glyph IDs; never permit a system-font fallback.
  fontFamily: '"' + font.family + '"',
  ...(font.palette ? { fontPalette: font.palette } : {})
} as CSSProperties);
const readBookmark = (key: string) => { try { const value = JSON.parse(localStorage.getItem(key) || '{}') || {}; return { page: clampPage(Number(value.page) || 1), surah: Number(value.surah) || 1, ayah: Number(value.ayah) || 1, updatedAt: String(value.updatedAt || '') }; } catch { return { page: 1, surah: 1, ayah: 1, updatedAt: '' }; } };
function lagosDate() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
function TajweedColourGuide() {
  const items = [
    { tone: 'deep-red', colour: 'Deep red', rule: 'Madd', cue: 'Prolong for 6 counts' },
    { tone: 'red', colour: 'Red', rule: 'Madd', cue: 'Prolong for 4–5 counts' },
    { tone: 'orange-red', colour: 'Orange-red', rule: 'Madd', cue: 'Prolong for 2, 4 or 6 counts' },
    { tone: 'green', colour: 'Green', rule: 'Ghunnah', cue: 'Nasal sound for 2 counts' },
    { tone: 'dark-blue', colour: 'Dark blue', rule: 'Tafkheem', cue: 'Pronounce heavily, with a full sound' },
    { tone: 'light-blue', colour: 'Light blue', rule: 'Qalqalah', cue: 'Give the letter a slight bouncing sound' },
    { tone: 'grey', colour: 'Grey', rule: 'Silent / merged letters (Idgham)', cue: 'Skip letters that are not pronounced' }
  ];
  return <div className="quran-tajweed-guide">
    <p>Each colour signals a recitation rule. Use the cue as you read.</p>
    <div className="quran-tajweed-guide-grid">
      {items.map(item => <div className="quran-tajweed-guide-item" key={item.tone}>
        <span className={'quran-tajweed-guide-swatch quran-tajweed-guide-swatch--' + item.tone} aria-hidden="true" />
        <span className="quran-tajweed-guide-copy"><b>{item.colour} · {item.rule}</b><small>{item.cue}</small></span>
      </div>)}
    </div>
  </div>;
}

export function QuranMushafReader({ settings, settingsReady, onLogged, autoOpen = false }: Props) {
  const navigate = useNavigate();
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
  const [sidebarOpen, setSidebarOpen] = useState(() => window.matchMedia('(min-width: 1024px)').matches);
  const [starredAyahs, setStarredAyahs] = useState<Array<{ surah: number; ayah: number }>>(() => { try { return JSON.parse(localStorage.getItem('atlas_mushaf_starred_ayahs_v1') || '[]'); } catch { return []; } });
  const [selected, setSelected] = useState<{ surah: number; ayah: number } | null>(null);
  const [readingMode, setReadingMode] = useState<'translation' | 'reading' | 'arabic'>(() => { try { const saved = localStorage.getItem('atlas_mushaf_layout_v1'); return saved === 'translation' || saved === 'arabic' || saved === 'reading' ? saved : 'reading'; } catch { return 'reading'; } });
  const [tajweedEnabled, setTajweedEnabled] = useState(() => { try { return localStorage.getItem('atlas_mushaf_tajweed_v1') !== 'off'; } catch { return true; } });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tajweedLegendVisible, setTajweedLegendVisible] = useState(false);
  const [transliterationEnabled, setTransliterationEnabled] = useState(() => { try { return localStorage.getItem('atlas_mushaf_transliteration_v1') === 'on'; } catch { return false; } });
  const [arabicFontFamily, setArabicFontFamily] = useState(() => { try { const saved = localStorage.getItem('atlas_mushaf_font_family_v1'); return MUSHAF_FONTS.some(font => font.name === saved) ? saved as typeof MUSHAF_FONTS[number]['name'] : 'UthmanicHafs'; } catch { return 'UthmanicHafs'; } });
  const [arabicFontSize, setArabicFontSize] = useState(() => { try { const saved = Number(localStorage.getItem('atlas_mushaf_font_size_v1')); return Number.isInteger(saved) && saved >= 16 && saved <= 44 ? saved : 24; } catch { return 24; } });
  const [pageInput, setPageInput] = useState(String(page));
  const [desktopPageWindow, setDesktopPageWindow] = useState<MushafPage[]>([]);
  const [desktopVisiblePage, setDesktopVisiblePage] = useState(page);
  const [qcfV4Fonts, setQcfV4Fonts] = useState<Record<number, QcfV4Font>>({});
  const [qcfPaletteTheme, setQcfPaletteTheme] = useState<'light' | 'dark' | 'sepia'>(() => { const id = document.documentElement.getAttribute('data-theme') || 'shadowed-alchemist'; return id.startsWith('light-') ? 'light' : id.includes('sepia') ? 'sepia' : 'dark'; });
  const desktopPrefetchRef = useRef(new Set<number>());
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
    const root = document.documentElement;
    const updateTheme = () => {
      const id = root.getAttribute('data-theme') || 'shadowed-alchemist';
      setQcfPaletteTheme(id.startsWith('light-') ? 'light' : id.includes('sepia') ? 'sepia' : 'dark');
    };
    const observer = new MutationObserver(updateTheme);
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    updateTheme();
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!fullScreen || !tajweedEnabled || readingMode !== 'reading') return;
    const visiblePages = [...new Set([pageData?.page, ...desktopPageWindow.map(item => item.page)].filter((value): value is number => Number.isInteger(value)))];
    let cancelled = false;
    visiblePages.forEach(number => {
      if (qcfV4Fonts[number]?.theme === qcfPaletteTheme) return;
      void loadQcfV4PageFont(number).then(font => {
        if (!cancelled) setQcfV4Fonts(current => current[number]?.theme === font.theme ? current : { ...current, [number]: font });
      }).catch(error => {
        console.warn('QCF V4 Tajweed font could not be loaded for page ' + number + ':', error);
      });
    });
    return () => { cancelled = true; };
  }, [fullScreen, tajweedEnabled, readingMode, pageData?.page, desktopPageWindow, qcfV4Fonts, qcfPaletteTheme]);

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
    let firstFrame = 0;
    let secondFrame = 0;
    firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        const root = readerRef.current;
        const row = verseRowRefs.current.get(key);
        if (!root || !row || restoreTargetRef.current !== key) return;
        const header = root.querySelector<HTMLElement>('.quran-mobile-header');
        const rootRect = root.getBoundingClientRect();
        const rowRect = row.getBoundingClientRect();
        const headerHeight = header?.getBoundingClientRect().height || 0;
        const targetTop = root.scrollTop + rowRect.top - rootRect.top - headerHeight - 12;
        root.scrollTo({ top: Math.max(0, targetTop), behavior: 'instant' });
      });
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
    };
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
    if (!fullScreen) return;
    const root = readerRef.current;
    if (!root) return;
    const markUserScroll = () => { userScrolledRef.current = true; };
    root.addEventListener('touchmove', markUserScroll, { passive: true });
    root.addEventListener('wheel', markUserScroll, { passive: true });
    return () => {
      root.removeEventListener('touchmove', markUserScroll);
      root.removeEventListener('wheel', markUserScroll);
    };
  }, [fullScreen]);

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
    const payload = mode === 'hifz'
      ? { hifz_page: String(mark.page), hifz_bookmark: JSON.stringify(mark) }
      : { murajaah_page: String(mark.page), murajaah_bookmark: JSON.stringify(mark) };
    let cancelled = false;
    let inFlight = false;
    let retryTimer: number | null = null;
    const sync = async () => {
      if (cancelled || inFlight) return;
      inFlight = true;
      try {
        await api('/settings', json('PATCH', payload));
        if (!cancelled) lastSavedKeyRef.current = saveKey;
      } catch {
        // Keep retrying silently: local storage already has the latest bookmark.
        if (!cancelled) retryTimer = window.setTimeout(() => { void sync(); }, 5000);
      } finally {
        inFlight = false;
      }
    };
    const retryWhenOnline = () => {
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      retryTimer = null;
      void sync();
    };
    const debounceTimer = window.setTimeout(() => { void sync(); }, 1200);
    window.addEventListener('online', retryWhenOnline);
    return () => {
      cancelled = true;
      window.clearTimeout(debounceTimer);
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      window.removeEventListener('online', retryWhenOnline);
    };
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

  const mobileActiveSurahNumber = (readingMode === 'reading' ? pageData?.ayahs?.[0]?.surahNumber : selected?.surah)
    || pageData?.ayahs?.[0]?.surahNumber || getPageSurah(page)?.number || activeSurahNumber;
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

  // Desktop Page-by-Page uses a small forward window so pages flow naturally.
  useEffect(() => {
    if (isMobileViewport || !fullScreen || readingMode !== 'reading' || !pageData?.ayahs?.length) {
      if (isMobileViewport || readingMode !== 'reading' || !fullScreen) setDesktopPageWindow([]);
      return;
    }
    let cancelled = false;
    setDesktopVisiblePage(page);
    setDesktopPageWindow([pageData]);
    const loadFollowing = async () => {
      const following: MushafPage[] = [];
      for (let offset = 1; offset <= 2; offset += 1) {
        const number = page + offset;
        if (number > 604) break;
        try {
          const cached = readCachedMushafPage(number);
          if (cached?.ayahs?.length) { following.push(cached); continue; }
          const response = await fetch('/api/quran/page/' + number);
          if (!response.ok) continue;
          const payload = await response.json();
          const result = payload ? sanitizeMushafPage(payload as MushafPage) : null;
          if (!result?.ayahs?.length) continue;
          pageMemoryCache.set(number, result);
          try { localStorage.setItem(CACHE_PREFIX + number, JSON.stringify(result)); } catch { /* memory cache remains */ }
          following.push(result);
        } catch { /* a neighbor must not interrupt reading */ }
      }
      if (!cancelled) setDesktopPageWindow(current => {
        const merged = new Map<number, MushafPage>(current.map(item => [item.page, item]));
        following.forEach(item => merged.set(item.page, item));
        return [...merged.values()].sort((left, right) => left.page - right.page);
      });
    };
    void loadFollowing();
    return () => { cancelled = true; };
  }, [isMobileViewport, fullScreen, readingMode, page, pageData]);

  useEffect(() => {
    if (isMobileViewport || !fullScreen || readingMode !== 'reading' || !desktopPageWindow.length) return;
    const root = readerRef.current;
    if (!root) return;
    const nodes = Array.from(root.querySelectorAll<HTMLElement>('[data-desktop-page]'));
    if (!nodes.length) return;
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting)
        .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
      if (!visible) return;
      const node = visible.target as HTMLElement;
      const nextPage = Number(node.dataset.desktopPage);
      if (!nextPage) return;
      setDesktopVisiblePage(current => current === nextPage ? current : nextPage);
      const firstAyah = node.querySelector<HTMLElement>('[data-mushaf-verse="true"]');
      if (firstAyah) {
        const location = { surahNumber: Number(firstAyah.dataset.surah), numberInSurah: Number(firstAyah.dataset.ayah) };
        setSelected(current => current?.surah === location.surahNumber && current.ayah === location.numberInSurah ? current : { surah: location.surahNumber, ayah: location.numberInSurah });
        updateBookmark(nextPage, location);
      }
      const lastPage = desktopPageWindow[desktopPageWindow.length - 1]?.page || nextPage;
      if (nextPage >= lastPage - 1 && lastPage < 604 && !desktopPrefetchRef.current.has(lastPage + 1)) {
        desktopPrefetchRef.current.add(lastPage + 1);
        const number = lastPage + 1;
        void fetch('/api/quran/page/' + number).then(async response => {
          if (!response.ok) return null;
          const payload = await response.json();
          return payload ? sanitizeMushafPage(payload as MushafPage) : null;
        }).then(result => {
          if (!result?.ayahs?.length) return;
          pageMemoryCache.set(number, result);
          try { localStorage.setItem(CACHE_PREFIX + number, JSON.stringify(result)); } catch { /* memory cache remains */ }
          setDesktopPageWindow(current => current.some(item => item.page === number) ? current : [...current, result].sort((left, right) => left.page - right.page));
        }).catch(() => { desktopPrefetchRef.current.delete(number); });
      }
    }, { root, threshold: [0.2, 0.45, 0.7] });
    nodes.forEach(node => observer.observe(node));
    return () => observer.disconnect();
  }, [isMobileViewport, fullScreen, readingMode, desktopPageWindow, updateBookmark]);


  useEffect(() => {
    if (!fullScreen || readingMode === 'reading') return;
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
      if (surahNumber !== pageReadingSurah) return;
      const pageNumber = clampPage(Number(topmost.dataset.page) || page);
      if (!surahNumber || !ayahNumber) return;
      setSelected(current => current?.surah === surahNumber && current.ayah === ayahNumber ? current : { surah: surahNumber, ayah: ayahNumber });
      updateBookmark(pageNumber, { surahNumber, numberInSurah: ayahNumber });
    }, { root, threshold: 0.01 });
    targets.forEach(target => observer.observe(target));
    return () => { observer.disconnect(); visible.clear(); };
  }, [fullScreen, readingMode, surahAyahs, pageData, page, pageReadingSurah, updateBookmark]);

  // In Page by Page mode, let natural scrolling finish, then lock the ayah
  // closest to the reader's focus line and persist that exact location.
  useEffect(() => {
    if (!fullScreen || readingMode !== 'reading' || loading || !pageData?.ayahs?.length) return;
    const root = readerRef.current;
    if (!root) return;
    let settleTimer = 0;
    const lockNearestAyah = () => {
      const nodes = Array.from(root.querySelectorAll<HTMLElement>('[data-mushaf-verse="true"]'));
      if (!nodes.length) return;
      const header = root.querySelector<HTMLElement>('.quran-mobile-header');
      const rootRect = root.getBoundingClientRect();
      const headerHeight = header?.getBoundingClientRect().height || 0;
      const focusY = rootRect.top + headerHeight + Math.max(36, (root.clientHeight - headerHeight) * 0.38);
      let best: { node: HTMLElement; distance: number } | null = null;
      for (const node of nodes) {
        if (Number(node.dataset.surah) !== pageReadingSurah) continue;
        const fragments = Array.from(node.getClientRects());
        for (const rect of fragments) {
          const distance = focusY < rect.top ? rect.top - focusY : focusY > rect.bottom ? focusY - rect.bottom : 0;
          if (!best || distance < best.distance) best = { node, distance };
        }
      }
      if (!best) return;
      const surahNumber = Number(best.node.dataset.surah);
      const ayahNumber = Number(best.node.dataset.ayah);
      const pageNumber = clampPage(Number(best.node.dataset.page) || page);
      if (!surahNumber || !ayahNumber) return;
      setSelected(current => current?.surah === surahNumber && current.ayah === ayahNumber ? current : { surah: surahNumber, ayah: ayahNumber });
      updateBookmark(pageNumber, { surahNumber, numberInSurah: ayahNumber });
    };
    const scheduleLock = () => {
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(lockNearestAyah, 220);
    };
    root.addEventListener('scroll', scheduleLock, { passive: true });
    // Establish a visible lock when a page first opens, including a restored bookmark.
    scheduleLock();
    return () => {
      window.clearTimeout(settleTimer);
      root.removeEventListener('scroll', scheduleLock);
    };
  }, [fullScreen, readingMode, loading, pageData, page, pageReadingSurah, updateBookmark]);

  const changePage = (next: number, location?: { surahNumber: number; numberInSurah: number }) => {
    userScrolledRef.current = false;
    // Mushaf page navigation is global: a printed page may end one Surah and
    // continue into the next. Never clamp page turns to the currently active Surah.
    const value = clampPage(next);
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
    // This source uses U+0672 where the Uthmani text requires superscript alef U+0670.
    // Correct only that character; keep each original Tajweed segment and its colour class intact.
    return <>{segments.map((segment, index) => <span key={index} className={tajweedEnabled ? segment.className : ''}>{segment.text.replace(/ٲ/g, 'ٰ')}</span>)}{renderMedallion(ayah.numberInSurah)}</>;
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
  const renderPageAyah = (ayah: MushafAyah, data: MushafPage) => {
    const font = qcfV4Fonts[data.page];
    const words = (ayah.words || []).filter(word => word.charTypeName !== 'end' && word.charTypeName !== 'pause' && word.text);
    if (tajweedEnabled && font && words.length && words.every(word => Boolean(word.codeV2)) && !ayah.text.includes('ٲ')) {
      return <>{words.map((word, index) => <Fragment key={ayah.number + ':qcf:' + index}><span className="quran-qcf-v4-word" style={qcfV4WordStyle(font)} dangerouslySetInnerHTML={{ __html: escapeQcfGlyphHtml(word.codeV2 || '') }} />{' '}</Fragment>)}{renderMedallion(ayah.numberInSurah)}</>;
    }
    return renderArabic(ayah);
  };
  const renderPageBlock = (data: MushafPage, firstBlock: boolean) => {
    const runs: Array<{ surahNumber: number; surahName: string; arabicName: string; startsSurah: boolean; ayahs: MushafAyah[] }> = [];
    // Render every Ayah on the printed Mushaf page, including pages that cross
    // a Surah boundary. pageReadingSurah is only relevant to verse-by-verse mode.
    data.ayahs.forEach(ayah => {
      const last = runs[runs.length - 1];
      if (last && last.surahNumber === ayah.surahNumber) last.ayahs.push(ayah);
      else runs.push({ surahNumber: ayah.surahNumber, surahName: ayah.surahName, arabicName: ayah.arabicName, startsSurah: ayah.numberInSurah === 1, ayahs: [ayah] });
    });
    return <section className="quran-mobile-page-block" data-mobile-page-block="true" data-mobile-page={data.page} key={data.page}>
      {runs.map(run => <Fragment key={`run-${run.surahNumber}`}>
        {run.startsSurah && renderSurahIntro(run.surahNumber, run.surahName, run.arabicName, run.surahNumber !== 9)}
        <p className="quran-mobile-page-arabic" dir="rtl" lang="ar" style={mobileArabicStyle}>
          {run.ayahs.map(ayah => <span className="quran-mobile-page-ayah" key={ayah.number} data-mushaf-verse="true" data-surah={ayah.surahNumber} data-ayah={ayah.numberInSurah} data-page={data.page}>{renderPageAyah(ayah, data)}{' '}</span>)}
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

  const renderDesktopHero = (surahNumber: number, surahName: string, arabicName: string) => {
    const meta = QURAN_SURAHS[surahNumber - 1];
    return <section className="mushaf-desktop-hero">
      <div className="mushaf-desktop-hero-main">
        <div className="mushaf-desktop-hero-arabic" lang="ar" dir="rtl">{arabicName || meta?.arabic}</div>
        <div className="mushaf-desktop-hero-copy">
          <h2>{surahNumber}. Surah {surahName || meta?.transliteration}</h2>
          <p className="mushaf-desktop-hero-subtitle">{meta?.english || 'The Qur’an'} · {meta?.revelation || 'Revelation'} · {meta?.ayahs || 0} Ayahs</p>
          <p className="mushaf-desktop-hero-description">A Surah of guidance, reflection and remembrance. Read its verses with the Arabic text and clear English translation.<br />Continue your memorisation or revision from your saved position.</p>
        </div>
      </div>
      <div className="mushaf-desktop-hero-actions">
        <div className="mushaf-desktop-bookmark-pills">
          <button className={mode === 'hifz' ? 'is-active' : ''} onClick={() => changeMode('hifz')}>Hifz</button>
          <button className={mode === 'murajaah' ? 'is-active' : ''} onClick={() => changeMode('murajaah')}>Muraja’ah</button>
        </div>
        <button className="mushaf-desktop-key-toggle" onClick={() => setTajweedLegendVisible(value => !value)}>Tajweed Key</button>
      </div>
    </section>;
  };
  const renderDesktopPage = (data: MushafPage) => {
    const lineMap = new Map<number, ReactNode[]>();
    let hasLineData = false;
    data.ayahs.forEach(ayah => {
      const words = ayah.words || [];
      const readableWords = words.filter(word => word.charTypeName !== 'end' && word.text);
      if (readableWords.some(word => word.lineNumber)) hasLineData = true;
      readableWords.forEach((word, index) => {
        const line = word.lineNumber || 1;
        const content = lineMap.get(line) || [];
        const qcfFont = qcfV4Fonts[data.page];
        if (tajweedEnabled && qcfFont && word.codeV2) {
          content.push(<span key={ayah.surahNumber + ':' + ayah.numberInSurah + ':' + index} className="quran-qcf-v4-word" style={qcfV4WordStyle(qcfFont)} dangerouslySetInnerHTML={{ __html: escapeQcfGlyphHtml(word.codeV2 || '') }} />);
        } else {
          const segments = tajweedEnabled && word.tajweed
            ? parseBracketTajweed(word.tajweed)
            : [{ text: word.text, className: '' }];
          content.push(<span key={ayah.surahNumber + ':' + ayah.numberInSurah + ':' + index}>
            {segments.map((segment, segmentIndex) => <span key={segmentIndex} className={tajweedEnabled ? segment.className : ''}>{segment.text}</span>)}
          </span>);
        }
        if (index === readableWords.length - 1) content.push(renderMedallion(ayah.numberInSurah));
        content.push(' ');
        lineMap.set(line, content);
      });
    });
    const surahStarts = data.ayahs.filter(ayah => ayah.numberInSurah === 1);
    return <section className="mushaf-desktop-page" data-desktop-page={data.page} key={data.page}>
      {surahStarts.map(ayah => <div className="mushaf-desktop-page-surah-heading" key={'heading-' + ayah.surahNumber}>
        <div className="mushaf-desktop-page-surah-arabic" lang="ar" dir="rtl">{ayah.arabicName || QURAN_SURAHS[ayah.surahNumber - 1]?.arabic}</div>
        <div>{ayah.surahNumber}. {ayah.surahName || QURAN_SURAHS[ayah.surahNumber - 1]?.transliteration}</div>
        {ayah.surahNumber !== 1 && ayah.surahNumber !== 9 && <div className="mushaf-desktop-page-bismillah" lang="ar" dir="rtl" style={mobileArabicStyle}>{bismillah}</div>}
      </div>)}
      <div className="mushaf-desktop-page-text" lang="ar" dir="rtl" style={mobileArabicStyle}>
        {hasLineData
          ? Array.from({ length: 15 }, (_, index) => index + 1).map(line => <div className="mushaf-desktop-qcf-line" key={line}>{lineMap.get(line) || []}</div>)
          : <div className="mushaf-desktop-page-fallback">{data.ayahs.map(ayah => <span className="mushaf-desktop-page-ayah" key={ayah.number} data-mushaf-verse="true" data-surah={ayah.surahNumber} data-ayah={ayah.numberInSurah} data-page={data.page}>{renderArabic(ayah)}{' '}</span>)}</div>}
      </div>
      {data.ayahs.map(ayah => <span className="mushaf-desktop-page-bookmark-anchor" key={'anchor-' + ayah.number} data-mushaf-verse="true" data-surah={ayah.surahNumber} data-ayah={ayah.numberInSurah} data-page={data.page} />)}
      <div className="mushaf-desktop-page-divider"><span></span><b>{data.page}</b><span></span></div>
    </section>;
  };
  const desktopReader = <div className="quran-mobile-shell quran-desktop-shell" ref={readerRef}>
    <header className="mushaf-desktop-topbar">
      <div className="mushaf-desktop-topbar-left">
        <button className="mushaf-desktop-surah-trigger" onClick={() => setSidebarOpen(value => !value)}>
          {activeSurahNumber}. {activeSurah?.transliteration || 'Al-Fatihah'} <ChevronsUpDown size={17} strokeWidth={1.9} />
        </button>
      </div>
      <div className="mushaf-desktop-topbar-center">
        <Bookmark size={16} />
        <span>Page {desktopVisiblePage} · Juz {getPageJuz(desktopVisiblePage)}</span>
        <span className="mushaf-desktop-saved"><i></i>Auto-saved</span>
      </div>
      <div className="mushaf-desktop-topbar-right">
        <div className="mushaf-desktop-segmented">
          <button className={readingMode !== 'reading' ? 'is-active' : ''} onClick={() => changeReadingMode('arabic')}>Verse by Verse</button>
          <button className={readingMode === 'reading' ? 'is-active' : ''} onClick={() => changeReadingMode('reading')}>Page by Page</button>
        </div>
        <div className="mushaf-desktop-bookmark-pills">
          <button className={mode === 'hifz' ? 'is-active' : ''} onClick={() => changeMode('hifz')}>Hifz</button>
          <button className={mode === 'murajaah' ? 'is-active' : ''} onClick={() => changeMode('murajaah')}>Muraja’ah</button>
        </div>
        <button className="mushaf-desktop-icon-button" aria-label="Settings" title="Settings" onClick={() => setSettingsOpen(true)}><Settings size={18} /></button>
        <button className="mushaf-desktop-exit" aria-label="Exit reader" onClick={() => setFullScreen(false)}><X size={17} /></button>
      </div>
    </header>
    {sidebarOpen && <aside className="mushaf-desktop-sidebar">
      <div className="mushaf-desktop-sidebar-head">
        <div className="mushaf-desktop-sidebar-tabs">
          {(['surah','verse','juz','page'] as const).map(tab => <button key={tab} className={sidebarTab === tab ? 'is-active' : ''} onClick={() => setSidebarTab(tab)}>{tab[0].toUpperCase() + tab.slice(1)}</button>)}
        </div>
        <button aria-label="Close sidebar" onClick={() => setSidebarOpen(false)}><X size={17} /></button>
      </div>
      <p className="mushaf-desktop-tip">Tip: try navigating with <kbd>Ctrl</kbd> + <kbd>K</kbd></p>
      <div className="mushaf-sidebar-search"><Search size={15}/><input value={surahSearch} onChange={event => setSurahSearch(event.target.value)} placeholder={sidebarTab === 'surah' ? 'Search Surah' : 'Search ' + sidebarTab} /></div>
      <div className="mushaf-desktop-sidebar-list">
        {sidebarTab === 'surah' && QURAN_SURAHS.filter(surah => (surah.transliteration + ' ' + surah.english + ' ' + surah.number).toLowerCase().includes(surahSearch.toLowerCase())).map(surah =>
          <button key={surah.number} ref={surah.number === activeSurahNumber ? activeSurahItemRef : undefined} className={surah.number === activeSurahNumber ? 'is-active' : ''} onClick={() => jumpSurah(surah.number)}>
            <span className="mushaf-desktop-sidebar-number">{surah.number}</span><span className="mushaf-desktop-sidebar-name"><b>{surah.transliteration}</b><small>{surah.english}</small></span><strong>{surah.arabic}</strong>
          </button>)}
        {sidebarTab === 'verse' && Array.from({length:activeSurah?.ayahs || 0},(_,index)=>index+1).filter(number => !surahSearch || String(number).includes(surahSearch)).map(number =>
          <button key={number} onClick={() => { const location=getAyahLocation(activeSurahNumber,number); if(location) changePage(location.page,{surahNumber:activeSurahNumber,numberInSurah:number}); setSidebarOpen(false); }}>
            <span className="mushaf-desktop-sidebar-number">{number}</span><span className="mushaf-desktop-sidebar-name"><b>Ayah {number}</b><small>{activeSurah?.transliteration} · {activeSurahNumber}:{number}</small></span>
          </button>)}
        {sidebarTab === 'juz' && Array.from({length:30},(_,index)=>index+1).filter(number => !surahSearch || String(number).includes(surahSearch)).map(number =>
          <button key={number} onClick={() => { jumpJuz(number); setSidebarOpen(false); }}><span className="mushaf-desktop-sidebar-number">{number}</span><span className="mushaf-desktop-sidebar-name"><b>Juz {number}</b><small>Juz {number} starting point</small></span></button>)}
        {sidebarTab === 'page' && <form className="mushaf-desktop-page-jump" onSubmit={quickJump}><label htmlFor="mushaf-desktop-page-input">Go to Mushaf page</label><input id="mushaf-desktop-page-input" type="number" min="1" max="604" value={pageInput} onChange={event => setPageInput(event.target.value)} /><button type="submit">Go to page</button><p>Pages 1–604 · Madinah Mushaf</p></form>}
      </div>
    </aside>}
    {tajweedLegendVisible && <aside className="mushaf-desktop-tajweed-key"><b>Tajweed colour guide</b><TajweedColourGuide /><button onClick={() => setTajweedLegendVisible(false)}>Close</button></aside>}
    <main className={'mushaf-desktop-content ' + (readingMode === 'reading' ? 'is-page-mode' : 'is-verse-mode')}>
      {loading && <div className="quran-mobile-loading">Loading Qur’an…</div>}
      {pageError && <div className="quran-mobile-error">{pageError}<button onClick={() => changePage(page)}>Retry</button></div>}
      {!loading && !pageError && readingMode === 'reading' && desktopPageWindow.map(renderDesktopPage)}
      {!loading && !pageError && readingMode !== 'reading' && <>
        {surahLoading && <div className="quran-mobile-loading">Loading Surah…</div>}
        {!surahLoading && surahAyahs.length > 0 && <>
          {surahAyahs[0].numberInSurah === 1 && renderDesktopHero(activeSurahNumber, activeSurah?.transliteration || surahAyahs[0].surahName, surahAyahs[0].arabicName)}
          {activeSurahNumber !== 1 && activeSurahNumber !== 9 && surahAyahs[0].numberInSurah === 1 && <div className="mushaf-desktop-bismillah"><div lang="ar" dir="rtl" style={mobileArabicStyle}>{bismillah}</div><p>In the Name of Allah—the Most Compassionate, Most Merciful</p></div>}
          {renderVerseRows(surahAyahs)}
        </>}
        {surahError && <div className="quran-mobile-error">{surahError}</div>}
      </>}
    </main>
    {readingMode === 'reading' && <div className="mushaf-desktop-page-controls">
      <button aria-label="Previous Page" title="Previous Page" disabled={desktopVisiblePage <= 1} onClick={() => changePage(desktopVisiblePage - 1)}><ArrowUp size={18} /></button>
      <button aria-label="Next Page" title="Next Page" disabled={desktopVisiblePage >= 604} onClick={() => changePage(desktopVisiblePage + 1)}><ArrowDown size={18} /></button>
    </div>}
    {settingsOpen && <div className="mushaf-desktop-settings-backdrop" onClick={() => setSettingsOpen(false)}>
      <section className="mushaf-desktop-settings" onClick={event => event.stopPropagation()}>
        <header><b>Qur’an display settings</b><button aria-label="Close settings" onClick={() => setSettingsOpen(false)}><X size={18}/></button></header>
        <h4>Arabic font</h4>
        <div className="mushaf-desktop-font-grid">{MUSHAF_FONTS.map(font => <button key={font.name} className={arabicFontFamily === font.name ? 'is-active' : ''} onClick={() => changeArabicFont(font.name)}><span style={{fontFamily:'"' + font.name + '", "Amiri Quran", serif'}}>{MUSHAF_FONT_SAMPLE}</span><small>{font.label}</small></button>)}</div>
        <h4>Arabic font size</h4>
        <div className="mushaf-desktop-size-options">{[20,24,28,32,36].map(size => <button key={size} className={arabicFontSize === size ? 'is-active' : ''} onClick={() => changeArabicFontSize(size)}>{size}px</button>)}</div>
        <button className="mushaf-desktop-key-toggle" onClick={() => setTajweedLegendVisible(value => !value)}>Tajweed Color Key <span>{tajweedEnabled ? 'Enabled' : 'Disabled'}</span></button>
        <button className="mushaf-desktop-key-toggle" onClick={toggleTajweed}>Tajweed colors <span>{tajweedEnabled ? 'On' : 'Off'}</span></button>
      </section>
    </div>}
  </div>;

  if (!fullScreen) return <section className="faith-section-secondary quran-mobile-launch"><div><h3>Qur’an</h3><p>Continue from your saved Hifz or Muraja’ah position.</p><div><button onClick={() => openReader('hifz')}>Open Qur’an</button><button onClick={() => openReader('murajaah')}>Resume Muraja’ah</button></div></div></section>;
  // The Atlas route containers use overflow clipping and animated transforms. A fixed
  // full-screen reader rendered inside them can be clipped/painted behind the shell.
  // Portal the entire Mushaf to document.body so it has a true viewport-level layer.
  void desktopReader;
  return createPortal(<div className={`quran-mobile-shell${!isMobileViewport ? ' quran-desktop-shell' : ''}${readingMode !== 'reading' ? ' is-verse-mode' : ''}`} ref={readerRef} style={{ '--mushaf-user-font-size': `${arabicFontSize}px` } as CSSProperties}>
    <header className="quran-mobile-header">
      <div className="quran-mobile-top-row">
        <motion.button className="quran-mobile-surah-trigger" onClick={() => setMobileSurahDrawerOpen(true)} whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }} transition={{ type: 'spring', stiffness: 420, damping: 28 }}>{mobileActiveSurahNumber}. {mobileActiveSurahName} <motion.span animate={{ rotate: mobileSurahDrawerOpen ? 180 : 0 }} transition={{ duration: prefersReducedMotion ? 0 : 0.22 }}><ChevronsUpDown size={17} strokeWidth={1.9} /></motion.span></motion.button>
        <div className="quran-mobile-page-meta-desktop"><span>Page {page}</span><span>Juz {getPageJuz(page)}{pageData?.hizb ? ` / Hizb ${pageData.hizb}` : ''}</span></div>
        <div className="quran-mobile-mode-tabs">
          <button aria-label="Verse by Verse" title="Verse by Verse" className={readingMode === 'arabic' ? 'is-active' : ''} onClick={() => changeReadingMode('arabic')}><span className="quran-mode-desktop-label">Verse by Verse</span><span className="quran-mode-mobile-icon"><AlignJustify size={16} strokeWidth={1.9} /></span></button>
          <button aria-label="Page by Page" title="Page by Page" className={readingMode === 'reading' ? 'is-active' : ''} onClick={() => changeReadingMode('reading')}><span className="quran-mode-desktop-label">Page by Page</span><span className="quran-mode-mobile-icon"><BookOpen size={16} strokeWidth={1.9} /></span></button>
        </div>
        <div className="quran-mobile-tajweed-center">
          <button className={tajweedLegendVisible ? 'is-active' : ''} aria-expanded={tajweedLegendVisible} onClick={() => setTajweedLegendVisible(value => !value)}>
            <Palette size={15} strokeWidth={2} /><span>Tajweed</span>
          </button>
        </div>
        <div className="quran-mobile-header-actions"><button aria-label="Settings" onClick={() => setSettingsOpen(true)}><Settings size={isMobileViewport ? 23 : 20} strokeWidth={1.8} /></button><button className="quran-mobile-leave-button" aria-label="Leave Qur’an" onClick={() => { if (autoOpen) navigate('/residence'); else setFullScreen(false); }}><X size={isMobileViewport ? 17 : 16} strokeWidth={2} /><span>Leave</span></button></div>
      </div>
    </header>
    <AnimatePresence initial={false}>{tajweedLegendVisible && <motion.aside className="quran-mobile-tajweed-legend" initial={{ opacity: 0, height: 0, y: -8 }} animate={{ opacity: 1, height: 'auto', y: 0 }} exit={{ opacity: 0, height: 0, y: -8 }} transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.28, ease: [0.22, 1, 0.36, 1] }}><b>Tajweed colour guide</b><TajweedColourGuide /></motion.aside>}</AnimatePresence>
    <main className="quran-mobile-content">
      {loading && <div className="quran-mobile-loading">Loading Qur’an…</div>}
      {pageError && <div className="quran-mobile-error">{pageError}<button onClick={() => changePage(page)}>Retry</button></div>}
      {!loading && !pageError && readingMode === 'reading' && pageData && <>
        {renderPageBlock(pageData, true)}
        <div className="quran-mobile-bottom-nav"><button disabled={page <= 1} onClick={() => changePage(page - 1)}><ChevronLeft size={17} strokeWidth={2.2} /><span>Previous Page</span></button><button disabled={page >= 604} onClick={() => changePage(page + 1)}><span>Next Page</span><ChevronRight size={17} strokeWidth={2.2} /></button></div>
      </>}
      {!loading && !pageError && readingMode !== 'reading' && <>
        {surahLoading && <div className="quran-mobile-loading">Loading Surah…</div>}
        {!surahLoading && surahAyahs.length > 0 && <>
          {surahAyahs[0].numberInSurah === 1 && renderSurahIntro(activeSurahNumber, activeSurah?.transliteration || surahAyahs[0].surahName, surahAyahs[0].arabicName, activeSurahNumber !== 9)}
          {renderVerseRows(surahAyahs)}
          <div className="quran-mobile-bottom-nav quran-mobile-surah-nav"><button disabled={activeSurahNumber <= 1} onClick={() => jumpSurah(activeSurahNumber - 1)}><ChevronLeft size={16} /> Previous Surah</button><button disabled={activeSurahNumber >= 114} onClick={() => jumpSurah(activeSurahNumber + 1)}>Next Surah <ChevronRight size={16} /></button></div>
        </>}
        {surahError && <div className="quran-mobile-error">{surahError}</div>}
      </>}
    </main>
    <AnimatePresence initial={false}>{settingsOpen && <motion.div className="quran-mobile-settings-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: prefersReducedMotion ? 0 : 0.2 }} onClick={() => setSettingsOpen(false)}><motion.section className="quran-mobile-settings" initial={{ x: '100%', opacity: 0.7 }} animate={{ x: 0, opacity: 1 }} exit={{ x: '100%', opacity: 0.7 }} transition={prefersReducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 360, damping: 36, mass: 0.82 }} onClick={event => event.stopPropagation()}>
      <header><b>Reading settings</b><button aria-label="Close settings" onClick={() => setSettingsOpen(false)}><X size={20} /></button></header>
      <label>Arabic font<select value={arabicFontFamily} onChange={event => changeArabicFont(event.target.value)}>{MUSHAF_FONTS.map(font => <option key={font.name} value={font.name}>{font.label}</option>)}</select></label>
      <div className="quran-mobile-font-preview" dir="rtl" lang="ar" style={mobileArabicStyle}>{MUSHAF_FONT_SAMPLE}</div>
      <label>Font size <strong>{arabicFontSize}px</strong><input type="range" min="16" max="44" step="1" value={arabicFontSize} onChange={event => changeArabicFontSize(Number(event.target.value))} /></label>
      <button className="quran-mobile-setting-toggle" onClick={toggleTajweed}><span>Tajweed colors</span><strong>{tajweedEnabled ? 'On' : 'Off'}</strong></button>
      <button className="quran-mobile-setting-toggle" onClick={toggleTransliteration}><span>Transliteration</span><strong>{transliterationEnabled ? 'On' : 'Off'}</strong></button>
      <div className="quran-mobile-bookmark-modes"><button className={mode === 'hifz' ? 'is-active' : ''} onClick={() => changeMode('hifz')}>Hifz</button><button className={mode === 'murajaah' ? 'is-active' : ''} onClick={() => changeMode('murajaah')}>Muraja’ah</button></div>
    </motion.section></motion.div>}</AnimatePresence>
    <AnimatePresence initial={false}>{mobileSurahDrawerOpen && <motion.div className="quran-mobile-drawer-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: prefersReducedMotion ? 0 : 0.2 }} onClick={() => setMobileSurahDrawerOpen(false)}><motion.aside className="quran-mobile-surah-drawer" initial={{ x: '-100%', opacity: 0.7 }} animate={{ x: 0, opacity: 1 }} exit={{ x: '-100%', opacity: 0.7 }} transition={prefersReducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 360, damping: 36, mass: 0.82 }} onClick={event => event.stopPropagation()}>
      <header><b>Surahs</b><button aria-label="Close Surah list" onClick={() => setMobileSurahDrawerOpen(false)}><X size={20} /></button></header>
      <input value={surahSearch} onChange={event => setSurahSearch(event.target.value)} placeholder="Search 114 Surahs" />
      <div className="quran-mobile-surah-list">{QURAN_SURAHS.filter(surah => (surah.transliteration + ' ' + surah.english + ' ' + surah.number).toLowerCase().includes(surahSearch.toLowerCase())).map((surah, index) => <motion.button key={surah.number} initial={prefersReducedMotion ? false : { opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={prefersReducedMotion ? { duration: 0 } : { delay: Math.min(index * 0.012, 0.18), duration: 0.22, ease: [0.22, 1, 0.36, 1] }} className={surah.number === mobileActiveSurahNumber ? 'is-active' : ''} onClick={() => { jumpSurah(surah.number); setMobileSurahDrawerOpen(false); }}><span><b>{surah.number}. {surah.transliteration}</b><small>{surah.english} · {surah.ayahs} verses</small></span><strong>{surah.arabic}</strong></motion.button>)}</div>
    </motion.aside></motion.div>}</AnimatePresence>
  </div>, document.body);
}
