import { Children, type ReactNode, useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import type { Variants } from 'motion/react';

const containerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.03, delayChildren: 0 } }
};

const assemblySpring = { type: 'spring' as const, stiffness: 380, damping: 30, mass: 0.8 };

type CascadeProps = { className?: string; children: ReactNode };

export function Cascade({ className, children }: CascadeProps) {
  const reduceMotion = useReducedMotion();
  const [mobileViewport, setMobileViewport] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(max-width: 767px)');
    const update = () => setMobileViewport(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  const offset = mobileViewport ? 8 : 18;
  const variants = reduceMotion ? { hidden: {}, visible: {} } : containerVariants;

  return <motion.div className={className} variants={variants} initial="hidden" animate="visible">
    {Children.map(children, (child, index) => {
      if (child === null || child === undefined || typeof child === 'boolean') return child;
      const hero = index === 0;
      const primary = index === 1;
      const secondary = index === 2;
      const hidden = reduceMotion
        ? { opacity: 1, x: 0, y: 0, scale: 1 }
        : hero
          ? { opacity: 0, y: -14, scale: 1 }
          : primary
            ? { opacity: 0, x: -offset, y: 0, scale: 0.975 }
            : secondary
              ? { opacity: 0, x: offset, y: 0, scale: 0.975 }
              : { opacity: 0, y: 16, x: 0, scale: 0.975 };
      const visible = reduceMotion
        ? { opacity: 1, x: 0, y: 0, scale: 1 }
        : { opacity: 1, x: 0, y: 0, scale: 1, transition: assemblySpring };
      const itemVariants: Variants = { hidden, visible };
      return <motion.div className="atlas-cascade-item" variants={itemVariants} key={index}>{child}</motion.div>;
    })}
  </motion.div>;
}
