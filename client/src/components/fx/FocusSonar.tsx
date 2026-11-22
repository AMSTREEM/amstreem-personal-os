import { motion, useReducedMotion } from 'motion/react';

export function FocusSonar({ active, sessionKey }: { active: boolean; sessionKey?: string | null }) {
  const reduce = useReducedMotion();
  if (!active || reduce) return null;
  return (
    <motion.span
      key={sessionKey || 'focus-complete'}
      className="atlas-focus-sonar"
      initial={{ opacity: 1 }}
      animate={{ opacity: 0 }}
      transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
      aria-hidden="true"
    >
      <i />
      <i />
    </motion.span>
  );
}
