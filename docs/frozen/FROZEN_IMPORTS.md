# Frozen Qur'an imports and dependencies

Baseline commit: `0c41e0f797c472a23af6c982ed992133330ec28f`.

## `client/src/components/QuranMushafReader.tsx`

- `import { Fragment, type CSSProperties, type FormEvent, type ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';`
- `import { createPortal } from 'react-dom';`
- `import { useNavigate } from 'react-router-dom';`
- `import { AnimatePresence, motion, useReducedMotion } from 'motion/react';`
- `import { AlignJustify, ArrowDown, ArrowUp, Bookmark, BookOpen, ChevronsUpDown, ChevronLeft, ChevronRight, Copy, Info, Palette, Search, Settings, WifiOff, X } from 'lucide-react';`
- `import { api, json } from '../lib/api';`
- `import { QURAN_JUZ_STARTS, QURAN_SURAHS, getAyahLocation, getPageJuz, getPageSurah } from '../data/quranSurahs';`

## `client/src/pages/QuranPage.tsx`

- `import { useQuery, useQueryClient } from '@tanstack/react-query';`
- `import { QuranMushafReader } from '../components/QuranMushafReader';`
- `import { api } from '../lib/api';`

## Dependency contract

- Keep the reader component path, props, exports and rendered behaviour unchanged.
- Keep `client/src/lib/api.ts` path and `api` / `json` exports unchanged for the reader.
- Keep `client/src/data/quranSurahs.ts` path and all exports/data unchanged.
- React, React DOM, React Router, TanStack Query, Motion and Lucide are direct dependencies of the frozen files. Do not replace or shim these dependencies in place; new UI primitives belong under `client/src/ui/`.
