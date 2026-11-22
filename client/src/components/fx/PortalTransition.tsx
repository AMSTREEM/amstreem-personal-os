import { useEffect, useRef, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';

let origin: { x: number; y: number } | null = null;

export function setPortalOrigin(x: number, y: number) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  origin = { x, y };
}

export function PortalTransition({ children }: { children: ReactNode }) {
  const location = useLocation();
  const reduce = useReducedMotion();
  const firstPath = useRef(location.pathname);
  const node = useRef<HTMLDivElement>(null);
  const isInitialPath = firstPath.current === location.pathname;
  const point = origin ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const radius = Math.max(window.innerWidth, window.innerHeight) * 1.5;

  // Consume the origin after commit, not during render: StrictMode may render twice.
  useEffect(() => {
    firstPath.current = location.pathname;
    origin = null;
  }, [location.pathname]);

  return (
    <motion.div
      ref={node}
      key={location.pathname}
      className="atlas-portal-room"
      initial={reduce || isInitialPath ? false : { clipPath: `circle(0px at ${point.x}px ${point.y}px)` }}
      animate={{ clipPath: `circle(${radius}px at ${point.x}px ${point.y}px)` }}
      transition={reduce ? { duration: 0 } : { duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
      onAnimationComplete={() => {
        if (node.current) node.current.style.clipPath = 'none';
      }}
    >
      {children}
    </motion.div>
  );
}
