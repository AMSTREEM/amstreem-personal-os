import { Children, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import type { Variants } from 'motion/react';

const transition = { duration: 0.24, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] };
const containerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.04, delayChildren: 0 } }
};

type CascadeProps = { className?: string; children: ReactNode };

export function Cascade({ className, children }: CascadeProps) {
  const reduceMotion = useReducedMotion();
  const itemVariants: Variants = reduceMotion
    ? { hidden: { opacity: 1 }, visible: { opacity: 1, transition: { duration: 0 } } }
    : {
        hidden: { opacity: 0, y: 10 },
        visible: { opacity: 1, y: 0, transition }
      };

  return <motion.div
    className={className}
    variants={containerVariants}
    initial="hidden"
    animate="visible"
  >
    {Children.map(children, (child, index) => {
      if (child === null || child === undefined || typeof child === 'boolean') return child;
      return <motion.div
        className="atlas-cascade-item"
        variants={itemVariants}
        style={{ willChange: reduceMotion ? 'auto' : 'transform, opacity' }}
        key={index}
      >{child}</motion.div>;
    })}
  </motion.div>;
}
