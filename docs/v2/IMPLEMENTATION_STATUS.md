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
| 0 — Baseline & freeze | **Blocked** | Freeze audits, lock, checker and CI gate are committed. The Playwright baseline spec and manual local authentication capture utility are now committed; screenshots have not yet been captured. The phase gate is therefore not accepted. |
| 1 — Foundations | In progress / unaccepted | Theme tokens, four palettes, no-flash dual theme initialization, Fontsource packages, contrast gate and containment work exist on `atlas-v2`. Must be re-reviewed against the Phase 0 visual baseline before acceptance. |
| 2 — Shell & navigation | In progress / unaccepted | Route metadata and shell changes exist. Quran route avoids the v2 page class and route transition wrapper. Needs keyboard, mobile Safari and screenshot validation. |
| 3 — UI kit & FX | Not accepted | Shared visual primitives and removal of shell shader/pointer effects are partial. shadcn/Radix copy-in, kit route, axe and component tests remain. |
| 4 — Screens | Partial | Residence and authentication styling have started. Other routes remain legacy and are not marked v2. Route-by-route acceptance, loading/error/offline states and visual snapshots remain. |
| 5 — Data layer | Partial | Typed query-key factory and compatibility aliases are present; migration, date/timezone and storage utilities remain. |
| 6 — Backend modularisation | Not started | No backend extraction commits have been accepted. |
| 7 — Hardening | Not started | Bundle budgets, Playwright E2E, performance and staging smoke test remain. |

## Verified checks

- `npm run check:frozen` passed.
- `npm run check:contrast` passed after expanding coverage to all four text tokens against all four theme surfaces.
- TypeScript, production build, test suite and `npm audit` passed on head `c553e3c6d728de4bf9512096a79290a3c5b94218`.
- Atlas staging checks: [45943926549](https://github.com/AMSTREEM/amstreem-personal-os/actions/runs/45943926549) — success.
- Personal OS checks: [45943926487](https://github.com/AMSTREEM/amstreem-personal-os/actions/runs/45943926487) — success.
- The authenticated Playwright baseline capture script is committed; actual screenshots remain ungenerated until the local manual sign-in step is completed.

## Current hard blocker

The master spec requires baseline screenshots of the unchanged application, including the Qur'an at the specified viewports and themes, before Phase 1. A local manual Playwright capture path is now provided in `e2e/README.md`; it opens staging in a visible browser so a developer can sign in without sharing credentials. No screenshots have been fabricated. Until that baseline is captured and the Qur'an pixel-diff gate can be run, later phases remain unaccepted and staging deployment is prohibited.

## Next safe action

Run `npm run baseline:auth` and `npm run baseline:screenshots` as documented in `e2e/README.md`, commit the reviewed images, then review the v2 branch against that baseline. Keep production untouched.
