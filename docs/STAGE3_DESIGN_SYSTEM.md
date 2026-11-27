# Stage 3 — Design Tokens and Unified Atlas Shell

**Status:** merged to `atlas-next`; staging deployment live; authenticated browser QA pending  
**Branch:** `atlas-stage3-design-system`  
**Base:** `atlas-next`  
**Release target:** `atlas-next` staging only
**Merge commit:** `ac0dad3f8ef666b3d55b2a7c881bcc9b4f14273c`
**Render deploy:** `dep-dc4nghuc6qcc73e9d95g` — live 2026-11-27

## Objective

Establish one maintainable design-token layer and one canonical workspace navigation model for the authenticated Atlas experience. This is a frontend-only stage: it does not change API contracts, workspace persistence, database schemas, authentication, or production infrastructure.

## Scope

1. Introduce scoped semantic tokens for the authenticated Atlas shell: palette, spacing, radii, elevation, layout dimensions and motion.
2. Keep the token layer isolated from the specialist Qur’an reader. The reader remains on its own route and styling mode.
3. Move the four-room navigation and command destinations into one typed navigation registry consumed by the shell.
4. Keep desktop sidebar, mobile navigation, room sub-navigation, command search and keyboard room shortcuts derived from the same registry.
5. Improve shell accessibility with a keyboard-visible skip link and explicit navigation landmark naming.
6. Add regression tests for token scope, navigation registry coverage and Qur’an isolation.
7. Extend the staged-implementation CI guard so this branch cannot modify protected Qur’an/Tajweed source or assets.

## Non-goals

- No redesign or feature rewrite of individual pages.
- No change to route paths, legacy redirects, room membership or existing shortcuts.
- No changes to Qur’an reader, Tajweed rules/colours, fonts, recitation, bookmarks or reader layout.
- No backend, database, snapshot, auth, API, or production changes.
- No removal of existing visual effects or motion preferences.

## Acceptance criteria

- All four rooms and eight canonical views remain available from the shared registry.
- Desktop, mobile, command palette and keyboard navigation consume the same room definitions.
- Existing route URLs and deep links remain unchanged.
- Skip link is visible on keyboard focus and targets the main workspace.
- Tokens are scoped to `.app-frame.atlas-renaissance`; they do not style the Qur’an route.
- Typecheck, tests, boundary checks, dependency audit and production build passed in both GitHub Actions workflows.
- Qur’an/Tajweed protection CI passed with no protected reader or Tajweed files changed.
- Merged only to `atlas-next`; the staging build and deployment completed successfully. Production remains untouched.

## Staging browser QA — pending

Use the existing staging test account and verify:
1. On a workspace route, press Tab after load; the **Skip to content** link should become visible. Activate it and confirm focus moves to the main workspace.
2. Check all four desktop room links and their sub-navigation. Confirm the 1–4 keyboard shortcuts still navigate to the matching rooms.
3. Open Command with Ctrl/Cmd+K and confirm room and destination search still works.
4. At mobile width, check the room dock, Qur’an shortcut and More drawer; open and close the drawer and follow a destination.
5. Open `/quran`. Confirm the reader remains in its specialist mode, loads normally, and its Tajweed colours and controls are unchanged.

No database migration or API-specific browser drill is required for Stage 3. Stage 2's authenticated API QA remains the baseline.
