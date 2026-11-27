/* Central query-key contract for the workspace.
   Quran aliases below intentionally match the frozen reader's existing arrays. */
export const queryKeys = {
  settings: ['settings'] as const,
  overview: ['overview'] as const,
  tasks: ['tasks'] as const,
  goals: ['goals'] as const,
  projects: ['projects'] as const,
  sessions: ['sessions'] as const,
  deen: (date?: string) => date ? ['deen', date] as const : ['deen'] as const,
  habits: (date?: string) => date ? ['habits', date] as const : ['habits'] as const,
  faith: (date?: string) => date ? ['faith', date] as const : ['faith'] as const,
  rhythmSummary: (date?: string) => date ? ['rhythm-summary', date] as const : ['rhythm-summary'] as const,
  selfControl: (date?: string) => date ? ['self-control', date] as const : ['self-control'] as const,
  reviews: (scope: 'daily' | 'weekly' | 'monthly' = 'daily') => ['reviews', scope] as const,
  learningPaths: ['learning-paths'] as const,
  calendarSummary: (month: string) => ['calendar-summary', month] as const,
  announcements: ['announcements'] as const,
  // Compatibility exports for the frozen Qur'an page. Do not change these values.
  quranCompatibility: {
    settings: ['settings'] as const,
    deenInvalidation: ['deen'] as const,
    rhythmSummaryInvalidation: ['rhythm-summary'] as const,
    overviewInvalidation: ['overview'] as const
  }
} as const;
