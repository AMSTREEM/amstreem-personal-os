export const atlasMotion = {
  duration: {
    instant: 0.08,
    fast: 0.12,
    base: 0.2,
    slow: 0.32,
    moment: 0.56
  },
  easing: {
    standard: [0.2, 0, 0, 1] as const,
    in: [0.3, 0, 1, 1] as const,
    out: [0, 0, 0, 1] as const
  },
  spring: {
    snappy: { type: 'spring' as const, stiffness: 420, damping: 34 },
    gentle: { type: 'spring' as const, stiffness: 260, damping: 28 },
    lively: { type: 'spring' as const, stiffness: 520, damping: 22 }
  }
} as const;

export type AtlasMotionTokens = typeof atlasMotion;
