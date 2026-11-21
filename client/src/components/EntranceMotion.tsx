import { createContext, useContext, useEffect, useRef, useState } from 'react';

export type EntrancePreset = 0 | 1 | 2 | 3;

export const EntrancePresetContext = createContext<EntrancePreset>(0);

export function useEntrancePreset(navigationKey: string): EntrancePreset {
  const previous = useRef<{ key: string; preset: EntrancePreset } | null>(null);
  if (!previous.current) {
    previous.current = { key: navigationKey, preset: Math.floor(Math.random() * 4) as EntrancePreset };
  } else if (previous.current.key !== navigationKey) {
    const last = previous.current.preset;
    const draw = Math.floor(Math.random() * 3);
    const next = (draw >= last ? draw + 1 : draw) as EntrancePreset;
    previous.current = { key: navigationKey, preset: next };
  }
  return previous.current.preset;
}

export function useCompactMotionViewport() {
  const [compact, setCompact] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 767px)');
    const update = () => setCompact(query.matches);
    update();
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);
  return compact;
}

export function entranceFrame(preset: EntrancePreset, itemIndex = 0, compact = false) {
  const lateral = compact ? 8 : 18;
  const diagonal = compact ? 8 : 12;
  const transition = { duration: 0.26, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] };
  switch (preset) {
    case 0:
      return { initial: { opacity: 0, y: 16, scale: 0.985 }, animate: { opacity: 1, y: 0, scale: 1 }, transition };
    case 1:
      return { initial: { opacity: 0, x: itemIndex % 2 === 0 ? -lateral : lateral, scale: 0.985 }, animate: { opacity: 1, x: 0, scale: 1 }, transition };
    case 2:
      return { initial: { opacity: 0, scale: 0.95 }, animate: { opacity: 1, scale: 1 }, transition };
    default:
      return { initial: { opacity: 0, x: -diagonal, y: diagonal, scale: 0.985 }, animate: { opacity: 1, x: 0, y: 0, scale: 1 }, transition };
  }
}

export function entranceStagger(preset: EntrancePreset) {
  if (preset === 0) return 0.035;
  if (preset === 2) return 0.03;
  return 0.03;
}

export function useEntrancePresetContext() {
  return useContext(EntrancePresetContext);
}
