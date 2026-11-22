import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

type AnimatedMetricProps = {
  value: number;
  suffix?: string;
  format?: 'integer' | 'minutes';
};

function formatValue(value: number, format: AnimatedMetricProps['format']) {
  const rounded = Math.max(0, Math.round(value));
  if (format === 'minutes') {
    const hours = Math.floor(rounded / 60);
    const minutes = rounded % 60;
    return hours ? hours + 'h ' + String(minutes).padStart(2, '0') + 'm' : String(minutes) + 'm';
  }
  return String(rounded);
}

export function OdometerText({ value, className }: { value: string; className?: string }) {
  const reduceMotion = useReducedMotion();
  return <span className={['atlas-odometer', className].filter(Boolean).join(' ')} aria-label={value}>
    {Array.from(value).map((character, index) => (
      <span className="atlas-odometer__slot" aria-hidden="true" key={index}>
        <AnimatePresence initial={false} mode="sync">
          <motion.span
            className="atlas-odometer__digit"
            key={index + ':' + character}
            initial={reduceMotion ? false : { y: '105%', opacity: 0.65 }}
            animate={{ y: '0%', opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { y: '-105%', opacity: 0.35 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >{character === ' ' ? '\u00a0' : character}</motion.span>
        </AnimatePresence>
      </span>
    ))}
  </span>;
}

export function AnimatedMetric({ value, suffix = '', format = 'integer' }: AnimatedMetricProps) {
  return <><OdometerText value={formatValue(value, format)} />{format === 'minutes' ? '' : suffix}</>;
}
