# Stage 3 — Design Tokens and Unified Atlas Shell

**Status:** implementation in progress  
**Branch:** `atlas-stage3-design-system`  
**Base:** `atlas-next`  
**Release target:** `atlas-next` staging only

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
- Typecheck, tests, boundary checks, audit and production build pass.
- Qur’an/Tajweed protection CI passes with no protected file changes.
- Changes are merged only to `atlas-next`, then manually deployed to staging for authenticated browser QA.
