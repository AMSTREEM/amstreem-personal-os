# Amstreem Atlas — Life System Foundation

## Product direction

Atlas is a user-directed personal life-development system. It helps people connect their chosen life direction to goals, projects, actions, focused work, reflection and evidence of progress. The product must remain calm, configurable and useful without requiring users to maintain an elaborate system.

## Product principles

1. The user chooses what matters; optional areas stay optional.
2. Every displayed metric must come from real persisted records.
3. Activity, progress and outcomes must be distinguished.
4. Suggestions must explain the evidence behind them.
5. Returning after a break must feel welcoming, not punitive.
6. Privacy is the default; sharing requires deliberate user action.
7. Mobile and desktop are designed as first-class experiences.
8. The product should reduce administration, not create more of it.

## First implementation slice

The first slice introduces a new Home experience and a Life Blueprint view using existing workspace APIs for goals, tasks and focus sessions, plus existing task creation and completion endpoints. It does not introduce database changes or new server endpoints.

The previous daily dashboard remains available at `/daily-rhythm` so its existing workflows are not silently discarded. The new Life Blueprint is available at `/blueprint` and groups existing goals by the categories the user has chosen. The Qur'an reader and its data, API, cache, bookmark, font and persistence logic are outside this implementation scope.

## Home experience

- Time-aware greeting and date.
- Personal direction statement and direct access to Goals and Growth.
- Real counts for active goals and open actions.
- Focus time derived from recorded focus sessions.
- Prioritised next actions with completion controls.
- Quick task capture.
- Current goal and linked-action context.
- Focus entry point linked to the current next action when available.
- Calendar entry point.
- Life Blueprint grouped from existing goal categories, with progress derived from linked records.
- Honest empty, loading and error states.

## Data integrity

- Reuse existing API contracts.
- Do not invent goal progress where there are no linked actions.
- Do not equate activity counts with personal worth.
- Do not fabricate insights or completion metrics.
- Avoid schema changes in this slice.

## Protected subsystem boundary

The following Qur'an subsystem files and behaviours must not be modified by this work:

- `client/src/pages/QuranPage.tsx`
- `client/src/components/QuranMushafReader.tsx`
- `client/src/data/quranSurahs.ts`
- `server/quran-fallback.json`
- Qur'an page data providers and routes.
- Tajweed rendering and Mushaf layout.
- Hifz and Muraja’ah bookmarks and local persistence.
- Qur'an caching, prefetching, fonts and offline behaviour.

Shared shell changes must be reviewed for regressions to the Qur'an route. This initial slice avoids changes to the shell and Qur'an routes.

## Rollout

Develop on a dedicated feature branch from `atlas-next`. Validate typecheck, automated tests and build before merging. Deploy to the isolated staging environment only after its Supabase and Render configuration has been verified. Production must not be modified as part of this initial implementation slice.
