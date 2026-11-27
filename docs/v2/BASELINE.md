# Atlas v2 Phase 0 — baseline and freeze

- Repository: `AMSTREEM/amstreem-personal-os`
- Source branch: `atlas-next`
- New implementation branch: `atlas-v2`
- Baseline commit: `0c41e0f797c472a23af6c982ed992133330ec28f`
- Baseline captured: 2026-11-27
- Existing source-branch CI run: [45901096683](https://github.com/AMSTREEM/amstreem-personal-os/actions/runs/45901096683) — Atlas staging checks completed successfully.
- Existing scripts: `typecheck`, `test`, `build`; no Playwright, frozen-file or contrast-check scripts existed.

## Baseline facts

- React 19 + TypeScript 5.9, Vite 7, Tailwind CSS 4, React Router 7, TanStack Query 5, Motion, Express, request-scoped SQLite, Supabase Auth and Postgres workspace snapshots.
- The current application already has the four-room IA and a legacy stylesheet plus a separate Renaissance stylesheet.
- The Qur'an reader is mounted as a direct route inside the existing shell; route metadata for the isolated v2 surface does not yet exist.
- Theme initialization uses legacy `atlas_theme` and ten legacy theme variants. The v2 theme names and dual-attribute no-flash initialization are not implemented.
- No `FROZEN.lock.json`, `check:frozen` script, Playwright baseline suite or frozen audit documents existed at the baseline commit.

## Phase 0 deliverables

- Frozen import, CSS, query-key and theme audits are committed under `docs/frozen/`.
- `FROZEN.lock.json` SHA-256 locks the reader, page, Quran data, offline fallback, reader API helper, complete legacy stylesheet, Tajweed coverage test and both Uthmanic font assets. It also locks Quran provider/font/cache/API server regions and the reader's CSP source allowlist.
- `scripts/check-frozen.mjs` verifies file bytes and server regions and exits non-zero on any mismatch.
- CI runs the freeze gate on `atlas-v2`.

## Screenshot baseline status

The required six authenticated Qur'an screenshots (390×844, 768×1024 and 1440×900, light and dark), plus the unchanged-app route baselines, have **not** yet been captured. The available repository integration does not provide an authenticated interactive browser session or staging-specific test account credentials. No fabricated screenshots or placeholders are committed. This remains an explicitly documented visual-verification exception. The user selected a clean-slate redesign and agreed to proceed without using the old site's appearance as a design baseline. No pixel-parity claim is made; authenticated Qur'an visual regression capture remains a final-release acceptance item.

## Baseline gate status

- Existing source-branch CI: passed at baseline commit.
- New branch frozen gate: introduced in this phase; result recorded after CI runs.
- Visual baseline: not captured; accepted exception for the clean-slate redesign. See [Phase 1 closure](PHASE-1.md).
- No application runtime, schema, API, production branch or production service changes are made in Phase 0.
