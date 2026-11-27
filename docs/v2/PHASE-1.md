# Atlas v2 — Phase 1: design foundation and isolation

Status: **implementation and automated gates complete; visual comparison exception documented**.

## Delivered

- Namespaced design tokens, theme definitions, containment rules, component mapping and visual-effects styles under `client/src/design/`.
- Four Atlas themes: Obsidian, Dusk, Ivory and Sahara.
- Geist, Geist Mono and Fraunces variable fonts.
- Theme helpers and no-flash initialization with a separate Atlas preference key.
- Motion and class-name utilities.
- Automated WCAG contrast check across the four themes.
- Automated frozen Qur'an integrity check, wired into the dedicated Atlas staging workflow.

## Verification

Latest branch commit at phase close: `68428047b89ad2e5363ce4f622e6987eee5d7556`.

Successful GitHub Actions runs:
- Personal OS checks: [46038136012](https://github.com/AMSTREEM/amstreem-personal-os/actions/runs/46038136012)
- Atlas staging checks: [46038135872](https://github.com/AMSTREEM/amstreem-personal-os/actions/runs/46038135872)

Both workflows passed their applicable dependency installation, frozen Qur'an integrity, theme contrast, typecheck, production build, test and dependency audit steps. The duplicate freeze/contrast gates were removed from the general test workflow; the dedicated Atlas workflow remains the source of those gates.

## Acceptance exception

Authenticated visual baseline screenshots were not captured because no authenticated staging browser session or test account was available to this implementation workflow. The user has explicitly chosen a clean-slate redesign and agreed to proceed without using the existing site's appearance as a design baseline.

Consequences:
- No claim is made that the old site's visual appearance has been pixel-compared.
- The existing site is treated only as a source of current functionality, routes and data contracts.
- The Qur'an implementation remains protected by the frozen-file integrity gate.
- Visual regression checks for the frozen Qur'an still require authenticated browser capture before final release acceptance.

## Phase boundary

Phase 1 is closed for implementation. No production deployment has occurred. Work remains isolated on `atlas-v2`.
