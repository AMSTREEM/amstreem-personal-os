import { useLocation } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';

export function setPortalOrigin(_x: number, _y: number) {
  // Kept as a compatibility no-op for existing pointer and keyboard navigation hooks.
}

export function PortalTransition({ children }: { children: ReactNode }) {
  const location = useLocation();
  const reduce = useReducedMotion();
  return (
    <motion.div
      key={location.pathname}
      className="atlas-portal-room"
      initial={reduce ? false : { opacity: 0, scale: 0.985, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={reduce ? { duration: 0 } : { duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      style={{ willChange: reduce ? 'auto' : 'transform, opacity' }}
      onAnimationComplete={event => {
        const target = event?.target;
        if (target instanceof HTMLElement) target.style.willChange = 'auto';
      }}
    >
      {children}
    </motion.div>
  );
}
