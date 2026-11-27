import type { Transition, Variants } from 'motion/react';

export const dur = { instant: 0.09, fast: 0.15, base: 0.22, slow: 0.36, page: 0.3 } as const;
export const ease = {
  standard: [0.2, 0, 0, 1],
  decel: [0.05, 0.7, 0.1, 1],
  accel: [0.3, 0, 0.8, 0.15],
} as const;
export const spring = {
  nav: { type: 'spring', stiffness: 420, damping: 34, mass: 0.8 },
  soft: { type: 'spring', stiffness: 260, damping: 28, mass: 1 },
  pop: { type: 'spring', stiffness: 500, damping: 22, mass: 0.7 },
} as const satisfies Record<string, Transition>;
export const stagger = { step: 0.028, max: 8 } as const;
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: dur.base, ease: ease.decel } },
  exit: { opacity: 0, y: 4, transition: { duration: dur.fast, ease: ease.accel } },
};
export const fade: Variants = {
  hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: dur.fast } }, exit: { opacity: 0, transition: { duration: dur.instant } },
};
export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  show: { opacity: 1, scale: 1, transition: { duration: dur.base, ease: ease.decel } },
  exit: { opacity: 0, scale: 0.98, transition: { duration: dur.fast, ease: ease.accel } },
};
export const listContainer: Variants = { show: { transition: { staggerChildren: stagger.step } } };
export const press = { whileTap: { scale: 0.97 }, transition: { duration: dur.instant } } as const;
export const staggerDelay = (index: number) => Math.min(index, stagger.max) * stagger.step;
