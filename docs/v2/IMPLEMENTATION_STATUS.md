# Atlas v2 — implementation status

Last updated: 2026-11-27

## Deployment boundary

- Work is confined to the `atlas-v2` branch.
- The Render staging service still tracks `atlas-next`; the v2 branch is not deployed.
- Production branch and production Render service have not been changed or deployed.
- Staging auto-deploy remains disabled.

## Phase gates

| Phase | State | Notes |
|---|---|---|
| 0 — Baseline & freeze | **Blocked** | Freeze audits, lock, checker and CI gate are committed. Authenticated baseline screenshots for the unchanged app have not been captured. The phase gate is therefore not accepted. |
| 1 — Foundations | In progress / unaccepted | Theme tokens, four palettes, no-flash dual theme initialization, Fontsource packages, contrast gate and containment work exist on `atlas-v2`. Must be re-reviewed against the Phase 0 visual baseline before acceptance. |
| 2 — Shell & navigation | In progress / unaccepted | Route metadata and shell changes exist. Quran route avoids the v2 page class and route transition wrapper. Needs keyboard, mobile Safari and screenshot validation. |
| 3 — UI kit & FX | Not accepted | Shared visual primitives and removal of shell shader/pointer effects are partial. shadcn/Radix copy-in, kit route, axe and component tests remain. |
| 4 — Screens | Partial | Residence and authentication styling have started. Other routes remain legacy and are not marked v2. Route-by-route acceptance, loading/error/offline states and visual snapshots remain. |
| 5 — Data layer | Partial | Typed query-key factory and compatibility aliases are present; migration, date/timezone and storage utilities remain. |
| 6 — Backend modularisation | Not started | No backend extraction commits have been accepted. |
| 7 — Hardening | Not started | Bundle budgets, Playwright E2E, performance and staging smoke test remain. |

## Verified checks

- The frozen Qur'an integrity check passed in recent CI runs.
- The WCAG AA contrast script passed in recent CI runs.
- TypeScript passed in recent CI runs.
- The existing test suite passed on commit `04cba70f5df4b80ca44c065ec78ae3d49bcacf0a`.
- Newer commits are awaiting CI verification; do not treat them as accepted until both Atlas staging checks and Personal OS checks pass.

## Current hard blocker

The master spec requires baseline screenshots of the unchanged application, including the Qur'an at the specified viewports and themes, before Phase 1. The available repository integration does not provide an authenticated interactive browser session or a staging test account. No screenshots have been fabricated. Until that baseline is captured and the Qur'an pixel-diff gate can be run, later phases remain unaccepted and staging deployment is prohibited.

## Next safe action

Capture the Phase 0 screenshots from the unchanged `atlas-next` app using an authenticated browser session, then review the v2 branch against that baseline. Keep production untouched.
