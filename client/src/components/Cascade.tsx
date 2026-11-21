import { Children, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import type { Variants } from 'motion/react';

const containerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.035, delayChildren: 0 } }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] } }
};

type CascadeProps = { className?: string; children: ReactNode };

export function Cascade({ className, children }: CascadeProps) {
  const reduceMotion = useReducedMotion();
  const variants = reduceMotion
    ? { hidden: {}, visible: {} }
    : containerVariants;
  const childVariants = reduceMotion
    ? { hidden: { opacity: 1, y: 0 }, visible: { opacity: 1, y: 0 } }
    : itemVariants;

  return <motion.div
    className={className}
    variants={variants}
    initial="hidden"
    animate="visible"
  >
    {Children.map(children, (child, index) => child === null || child === undefined || typeof child === 'boolean'
      ? child
      : <motion.div className="atlas-cascade-item" variants={childVariants} key={index}>{child}</motion.div>)}
  </motion.div>;
}
