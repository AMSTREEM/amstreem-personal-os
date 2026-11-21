import { Children, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import type { Variants } from 'motion/react';

const assemblySpring = { type: 'spring' as const, stiffness: 340, damping: 28, mass: 0.85 };
const containerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.045, delayChildren: 0 } }
};

type CascadeProps = { className?: string; children: ReactNode };

export function Cascade({ className, children }: CascadeProps) {
  const reduceMotion = useReducedMotion();
  const itemVariants: Variants = reduceMotion
    ? { hidden: { opacity: 1 }, visible: { opacity: 1, transition: { duration: 0 } } }
    : {
        hidden: { opacity: 0, scale: 0.94, y: 26, rotateX: 4 },
        visible: { opacity: 1, scale: 1, y: 0, rotateX: 0, transition: assemblySpring }
      };

  return <motion.div
    className={className}
    variants={containerVariants}
    initial="hidden"
    animate="visible"
    style={{ perspective: 1200, transformStyle: 'preserve-3d' }}
  >
    {Children.map(children, (child, index) => {
      if (child === null || child === undefined || typeof child === 'boolean') return child;
      return <motion.div className="atlas-cascade-item" variants={itemVariants} key={index}>{child}</motion.div>;
    })}
  </motion.div>;
}
