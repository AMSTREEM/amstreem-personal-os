import { useEffect, useState, type ReactNode } from 'react';
import { MotionConfig } from 'motion/react';
import { getAtlasMotionPreference, type AtlasMotionPreference } from './theme';

export function AtlasMotionProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<AtlasMotionPreference>(getAtlasMotionPreference);
  useEffect(() => {
    const update = (event: Event) => {
      const value = (event as CustomEvent<AtlasMotionPreference>).detail;
      if (value === 'system' || value === 'reduced' || value === 'full') setPreference(value);
    };
    window.addEventListener('atlas:motion-preference-change', update);
    return () => window.removeEventListener('atlas:motion-preference-change', update);
  }, []);
  const reducedMotion = preference === 'system' ? 'user' : preference === 'reduced' ? 'always' : 'never';
  return <MotionConfig reducedMotion={reducedMotion}>{children}</MotionConfig>;
}
