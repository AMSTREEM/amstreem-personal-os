# Atlas v2 — Phase 4: route-by-route redesign

Status: **in progress — Residence first**.

## Residence redesign

- Added `client/src/pages/ResidenceV2Page.tsx` as a clean-slate replacement for the Residence dashboard.
- Added `client/src/pages/residence-v2.css`; all new selectors are scoped under `.atlas-v2`.
- Routed `/residence` to the new page through lazy loading.
- Uses existing task, goal and focus-session API contracts and existing React Query keys.
- Preserves task capture and completion actions, focus-session entry, goals and calendar navigation.
- Uses the Phase 3 Atlas component primitives.
- Added `test/atlas-v2-residence.test.js` to verify route selection, Qur'an route isolation, component usage and style namespace.

## Design direction

A calm, editorial workspace: clear hierarchy, intentional negative space, a focused next-step panel, open actions, active direction and effort signals. Responsive layouts and reduced-motion support are included.

## Protected boundary

The `/quran` route remains mounted through the original `AppShell` and `QuranPage`. No Qur'an files, frozen styles, persistence keys, APIs, assets or schema are intentionally modified.

## Verification pending

The new commits have triggered CI. Do not mark this route complete until frozen-integrity, contrast, typecheck, production build, tests and dependency audit all pass. Authenticated visual review remains outstanding.

## Remaining Phase 4 routes

Daily Rhythm, Execution, Growth, Calendar, Goals, Settings and other non-Qur'an destinations still require individual review and redesign. Residence is the first route, not the completion of Phase 4.

No staging or production deployment has occurred. The Render staging service still needs a controlled branch switch/deploy plan; production remains untouched.
