import { Children, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import type { Variants } from 'motion/react';
import { entranceFrame, entranceStagger, useCompactMotionViewport, useEntrancePresetContext } from './EntranceMotion';

type CascadeProps = { className?: string; children: ReactNode };

export function Cascade({ className, children }: CascadeProps) {
  const reduceMotion = useReducedMotion();
  const preset = useEntrancePresetContext();
  const compact = useCompactMotionViewport();
  const containerVariants: Variants = {
    hidden: {},
    visible: { transition: { staggerChildren: entranceStagger(preset), delayChildren: 0 } }
  };

  return <motion.div
    className={className}
    variants={containerVariants}
    initial="hidden"
    animate="visible"
  >
    {Children.map(children, (child, index) => {
      if (child === null || child === undefined || typeof child === 'boolean') return child;
      const frame = entranceFrame(preset, index, compact);
      const itemVariants: Variants = reduceMotion
        ? { hidden: { opacity: 1 }, visible: { opacity: 1, transition: { duration: 0 } } }
        : {
            hidden: frame.initial,
            visible: { ...frame.animate, transition: frame.transition }
          };
      return <motion.div
        className="atlas-cascade-item"
        variants={itemVariants}
        style={{ willChange: reduceMotion ? 'auto' : 'transform, opacity' }}
        key={index}
      >{child}</motion.div>;
    })}
  </motion.div>;
}
