import { useEffect, useState } from 'react';
import { animate, useMotionValue, useReducedMotion } from 'motion/react';

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
    return hours ? hours + 'h ' + minutes + 'm' : minutes + 'm';
  }
  return String(rounded);
}

export function AnimatedMetric({ value, suffix = '', format = 'integer' }: AnimatedMetricProps) {
  const motionValue = useMotionValue(0);
  const [display, setDisplay] = useState(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const unsubscribe = motionValue.on('change', latest => setDisplay(Math.round(latest)));
    if (reduceMotion) {
      motionValue.set(value);
      setDisplay(value);
      return () => unsubscribe();
    }
    const controls = animate(motionValue, value, {
      duration: 0.4,
      ease: [0.22, 1, 0.36, 1]
    });
    return () => {
      controls.stop();
      unsubscribe();
    };
  }, [motionValue, reduceMotion, value]);

  return <>{formatValue(display, format)}{format === 'minutes' ? '' : suffix}</>;
}
