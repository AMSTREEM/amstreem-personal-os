# Amstreem Atlas — Rebuild Progress

## Current work status — 2026-11-21
- Active product work is isolated on `atlas-six-pillar-navigation`, based on `atlas-next`.
- Draft PR #3 targets `atlas-next`; it is open and unmerged.
- Production remains on `audit-and-hardening`; no Render deployment, production Supabase schema change, or production workspace write has been performed.
- The six-pillar navigation, Residence command view, goal-to-project/task/habit links, and Focus-to-Learning links are implemented on the development branch.
- GitHub Actions passed on the implementation commit (`c6c983f`) and the latest documentation follow-up (`00ebe7e`): production dependency audit, server syntax, TypeScript typecheck, frontend build, and automated tests.
- Browser-level visual QA and isolated staging verification are still outstanding. Do not mark the work ready for release until those checks pass.

## Historical baseline — 2026-11-20
Discovery and baseline protection. No production code, Supabase data, or Render configuration had been changed at that point.

## Source and isolation
- Repository: `AMSTREEM/amstreem-personal-os`
- New working branch: `atlas-next`
- Branch created from: `audit-and-hardening`
- Live Render service: `amstreematlas`
- Live Render deployment branch: `audit-and-hardening`
- Production URL: https://amstreematlas.onrender.com
- The live service continues tracking `audit-and-hardening`; work on `atlas-next` does not deploy to production.

## Verified current architecture
- Express server with a vanilla JavaScript, HTML, and CSS frontend.
- Supabase Auth authenticates users.
- Each user's workspace is stored as a JSONB snapshot in `public.personal_os_workspaces`.
- The server loads the signed-in user's snapshot into a request-scoped in-memory SQLite database, executes the existing API handlers, then saves the snapshot using that user's access token. Supabase RLS enforces row ownership.
- A per-user in-process request queue protects snapshot writes within the single Render instance.
- Render currently runs one free Node web-service instance; no persistent disk is attached.
- The frontend currently contains 14 main page sections and 76 API routes.
- The SQLite workspace schema currently defines 25 tables.
- The per-user write queue is process-local; the current single-instance Render setup matches that assumption, but horizontal scaling would require distributed coordination or a different persistence strategy.

## Verified Supabase baseline
The connected project contains RLS-enabled public tables for:
- `personal_os_workspaces`
- `personal_os_profiles`
- `personal_os_admins`
- `personal_os_invites`
- `atlas_feedback`
- `atlas_announcements`
- `atlas_announcement_reads`

The workspace table currently contains 8 rows: 5 populated snapshots and 3 empty workspace rows. A read-only structural check confirmed that all 5 populated snapshots contain every required section used by the current server. All 5 omit an `analytics_events` section, but the current `workspaceTables` schema does not define or require that table. The earlier missing-section error therefore appears to relate to an older or different code version and must not be treated as proof of current production data corruption. No workspace rows or schemas have been modified.

## Existing product capabilities observed
Residence/dashboard, calendar, Deen and Qur'an, faith, self-control, learning paths and lessons, tasks, focus sessions, personal library/notes, goals, rankings, announcements, achievements, progress/intelligence, settings, and owner administration.

## Rebuild principles
1. Preserve the product's purpose: a personal operating system for direction, planning, execution, learning, reflection, and growth.
2. Preserve account isolation, authentication, workspace persistence, backups/export/import, and working user data.
3. Build the new experience on this branch; do not modify the live branch or production data during development.
4. Reuse or improve backend contracts only after their data and failure modes are understood.
5. Do not perform destructive schema changes or production migrations without an explicit backup and review.
6. Every visible control must have a real, tested behaviour. No placeholder interactions or fabricated analytics.
7. Test the new app before changing Render's deployment branch.

## Additional findings from the current frontend
- Signup currently requires a religion choice; the new experience will make Values/faith preferences optional and user-controlled.
- The current frontend hard-codes the auth confirmation/password-reset redirect to `https://amstreemos.onrender.com/`, while the live Render service URL is `https://amstreematlas.onrender.com`. Verify the Supabase redirect allowlist and intended domain before changing this.
- Existing backend routes award XP for tasks, goals, habits, and focus sessions. The rebuild will not make points or streaks the centre of the experience; legacy records will be preserved while the need for these mechanics is reassessed.

## Compatibility investigation
- [x] Compared the current server's required snapshot sections with the populated Supabase snapshots using read-only aggregate queries.
- [x] Confirmed all 5 populated snapshots satisfy the current server's required-section checks; 3 additional rows are empty workspaces.
- [x] Confirmed `analytics_events` is absent from all populated snapshots and is not part of the current server schema or required-section list.
- [ ] Trace the historical `analytics_events` error to its originating code version before any import/restore compatibility changes.

## Work sequence
- [x] Locate repository and confirm production deployment branch.
- [x] Create isolated `atlas-next` branch from the live code branch.
- [x] Inspect current frontend, API surface, workspace schema, and Supabase tables.
- [x] Verify current populated snapshot compatibility against the live server's required sections.
- [ ] Finish feature and data-flow audit, including backup/restore and historical error tracing.
- [ ] Define the new information architecture and interaction model.
- [ ] Implement the new responsive frontend and shared design system.
- [ ] Connect every module to real persisted data and existing or revised APIs.
- [ ] Run functional, security, account-isolation, and responsive checks.
- [ ] Review production migration and cutover plan before any deployment change.

## Change log
- 2026-11-20: Created isolated `atlas-next` branch and recorded the verified baseline. No production changes.
- 2026-11-20: Read-only Supabase checks confirmed 5 populated snapshots pass the current required-section check and 3 workspaces are empty. No data was changed.
- 2026-11-20: Reviewed current signup, auth redirect, and gamification behaviour; recorded items to resolve during the frontend rebuild.


## Atlas Next implementation update — 2026-11-20

### Implemented on the isolated branch
- Added a React 19 + TypeScript + Vite frontend under `client/`, built into `dist/`.
- Added Supabase session handling, email/username sign-in, account creation, password reset and recovery completion.
- Added a shared responsive app shell, reusable UI primitives, React Query data access, React Hook Form/Zod validation, Lucide icons, and selectable dark/light workspace themes.
- Replaced the old frontend entry point for the new build while retaining `public/` as the source for existing brand assets, Supabase browser configuration, manifest and service worker.
- Added functional pages for Today, Goals, Projects, Tasks, Calendar, Focus, Rituals, Self-control, Learning, Library, Values, Reviews, Insights, Settings and owner administration.
- Added connected project and milestone APIs; tasks can be associated with goals and projects; focus sessions can be associated with tasks and projects; calendar commitments can be associated with projects.
- Added daily and weekly review records and APIs.
- Restored Qur'an logging and Tahajjud tracking inside the optional Values area.
- Added owner-only account, feedback, analytics and announcement views. Sensitive admin endpoints remain server-protected.
- Added an announcement feed to Today.
- Added snapshot schema v2 while retaining v1 read compatibility. New tables are optional when loading old snapshots. Export/restore table order was updated for foreign-key dependencies.
- Added architecture and compatibility tests plus an Atlas Next CI workflow.
- Opened a draft validation PR from `atlas-next` to `audit-and-hardening`; it is not merged.

### New workspace tables
`projects`, `project_milestones`, `calendar_events`, and `reviews`.

Existing `tasks` and `sessions` gain nullable links to goals/projects/tasks. Old snapshot rows that do not contain those fields load with null defaults. Existing populated snapshots are not rewritten by this branch unless the new app is deployed and a user subsequently saves workspace data.

### Verification status
- [ ] TypeScript type-check passed.
- [ ] Vite production build passed.
- [ ] Backend test suite passed.
- [ ] Browser smoke tests passed.
- [ ] Existing-account login, username login, signup confirmation and password recovery verified against staging.
- [ ] Snapshot v1 load, v2 save, export and restore verified against staging.
- [ ] Account-isolation checks passed.
- [ ] Mobile and desktop responsive checks passed.
- [ ] Owner/admin functions verified with the server-side admin secret configured.
- [ ] Render staging deployment reviewed.

No Render deployment or production Supabase data/schema change has been made from this branch. The implementation is still in progress and must not be merged or deployed until the verification gates above are completed.


### Round-up pass — 2026-11-20
- Reviewed all page-level API paths against the Express route table; the implemented page calls have corresponding backend routes.
- Corrected the shared textarea component to use React's `TextareaHTMLAttributes<HTMLTextAreaElement>` type.
- Confirmed the draft PR remains open and unmerged, and `atlas-next` is isolated from `audit-and-hardening`.
- The CI workflow is present and configured to install dependencies, run TypeScript, build the Vite app, and execute Node tests. The GitHub connector did not return a workflow run for the latest commit, so no successful CI result is claimed.
- Runtime verification remains outstanding: this session has GitHub repository access but no checked-out Node runtime or local browser session for executing the build and end-to-end flows.
- No production deployment, production data write, schema migration, or PR merge was performed.


### CI consolidation — 2026-11-20
- Consolidated Atlas Next validation into the repository's existing `.github/workflows/test.yml` rather than maintaining duplicate workflows.
- CI now uses `npm install` (the existing lockfile predates the new frontend dependency set), runs the production dependency audit, checks the Express server syntax, runs the frontend TypeScript check and Vite build, and executes the Node test suite.
- Updated the security-hardening test to assert the actual install command.
- Removed the duplicate `atlas-next-ci.yml` workflow.
- GitHub's connected workflow-run/status endpoints have not exposed a run for the latest branch commits. CI is configured, but its execution/result is still unverified.


### CI feedback loop — 2026-11-20
- First real CI execution surfaced a missing `TextareaHTMLAttributes` import in the shared UI component. The resulting implicit-any errors were all downstream of that missing type.
- Added the missing React type import in commit `d19e6c7`.
- Earlier CI steps passed: dependency installation, production dependency audit (zero reported vulnerabilities), and server syntax check.
- Waiting for CI to execute against the corrected head before considering TypeScript/build/tests validated.


## Six-pillar implementation update — 2026-11-21

### Product structure implemented
- Primary navigation is grouped into **Command & Daily Rhythm** and **Growth & Execution**.
- The six core pillars remain visible regardless of optional feature settings: Deen & Reflection, Self-Control & Streaks, Projects & Tasks, Focus Room, Learning Studio, and Goals.
- Residence is the central command surface, not a seventh pillar.
- Reflection, Habits & Streaks, Tasks/Calendar, Insights, and Library are contextual secondary views. Calendar and Library can be toggled in settings; core pillars cannot be hidden.

### Cross-module behaviour implemented
- Residence derives a daily consistency pulse from active areas only: enabled Deen/Faith, configured habits, recently used focus, and tasks due today. Missing/unused areas are omitted rather than counted as failures.
- Residence surfaces Salah/Qur'an activity when Deen is enabled, habits, due/overdue priorities, active focus timer context, focus streak, and active goals.
- Goals show linked projects, tasks, milestones, and daily habits.
- Habits can be created and linked to active goals, and existing habits can be linked/unlinked.
- Focus Room lets a user choose a task or Learning Studio lesson before starting a timer. Timer context persists through refresh/navigation.
- Saving a focus session linked to a learning lesson contributes its minutes to Learning Studio study totals through the linked session record; no duplicate study record is created.
- Learning Studio offers a direct Focus Room action for each lesson.

### Backward compatibility
- `habits.goal_id` and `sessions.lesson_id` are nullable columns in the request-scoped in-memory workspace schema.
- New snapshots are written as `personal-os-sqlite-snapshot-v3` (`schemaVersion: 3`); the loader retains v1/v2 compatibility.
- Existing snapshots that do not contain these fields load with null defaults through the existing column-aware snapshot restore path.
- No new Supabase public table or RLS policy was created; workspace persistence continues through the existing `personal_os_workspaces` JSONB snapshot.
- Architecture documentation and automated tests were updated for the new relationships.

### Current verification gates
- GitHub Actions passed on the current PR head (`c6c983f`): dependency audit, server syntax, TypeScript typecheck, frontend build, and automated tests.
- Browser-level visual QA, existing-account staging login, snapshot restore against staging, and isolated Render staging deployment remain outstanding.
- Browser-level visual QA, existing-account staging login, snapshot restore against staging, and isolated Render staging deployment remain outstanding.
- Keep PR #3 in draft and do not merge or deploy to production until those checks are complete.

## Full transformation — staging implementation update · 2026-11-26

### Repository audit findings
- The current React 19 + TypeScript + Vite application, Express API, Supabase Auth, per-user JSONB workspace snapshot, request-scoped SQLite compatibility layer, backup/restore, and Render deployment are retained.
- The existing frontend already contains the four-room product capabilities in separate pages and shared components, but its primary navigation still exposed six destinations (Home, Actions, Goals, Focus, Growth, Calendar). The architecture documentation and actual navigation were inconsistent.
- The staging Supabase project is `amstreem-atlas-staging` (`yllzeblecyqnncgktnjw`); the separate production project remains `personal-os`. The staging database has the existing RLS-protected workspace and owner/admin support tables. No schema or user data was changed in this pass.
- The dedicated Render staging service tracks `atlas-next`; production remains on `audit-and-hardening`. Staging service auto-deploy is disabled, so a deliberate manual deploy is required after changes.
- The app's existing four-room/8-view architecture document is treated as the source of truth. Qur'an remains a specialist route, not a replacement for a room or a page to be reimplemented.

### Implemented on `atlas-next`
- Replaced six top-level navigation destinations with four rooms: Residence, Daily Rhythm, Execution & Focus, and Growth & Direction.
- Added contextual room navigation for Faith & Practice, Habits & Self-Control, Projects & Tasks, Calendar, Goals & Milestones, Learning & Library, and Reviews & Insights.
- Kept the Focus route and timer workflow available as part of Execution & Focus; task-to-focus and learning-to-focus deep links remain supported.
- Updated keyboard shortcuts from six destinations to four rooms.
- Updated mobile navigation to the same four-room model; Qur'an remains directly accessible from desktop Personal Tools and the mobile More drawer.
- Kept the Qur'an route out of room sub-navigation so the reader page retains its existing reading composition.
- Added a dedicated room-navigation stylesheet instead of modifying the large shared stylesheet that also contains specialist Qur'an presentation rules.
- Added architecture tests for the four rooms, eight views, legacy routes and protected Qur'an route.

### Explicitly unchanged
- `QuranPage.tsx`, `QuranMushafReader.tsx`, `quranSurahs.ts`, Qur'an fallback data, Uthmanic fonts, Tajweed rendering and Qur'an-specific settings/records.
- Supabase schemas, RLS policies, user workspace snapshots, auth configuration and production data.
- Production Render service and `audit-and-hardening` branch.

### Verification still required
- [ ] GitHub Actions type-check, build, dependency audit and complete test suite.
- [ ] Deploy the updated `atlas-next` commit to the dedicated staging Render service.
- [ ] Verify staging health and runtime logs.
- [ ] Browser QA for desktop/mobile room navigation, active sub-navigation, keyboard shortcuts, mobile More drawer, and direct Qur'an route.
- [ ] Existing-account authentication, persistence and account-isolation checks on staging.
- [ ] Confirm the protected Qur'an files are unchanged in the final Git diff.
- [ ] Do not merge or deploy to production as part of this staging pass.


## Full transformation — Home and Life Blueprint integration · 2026-11-26

- Ported the earlier Home and Life Blueprint feature selectively from the divergent foundation branch. No branch merge was performed.
- Residence now opens a direction-led Home with time-aware greeting, active goals, open actions, weekly focus records, next actions, quick capture, current direction, and calendar entry point.
- Life Blueprint groups real goals by the life-area categories users already selected. Linked-action progress is shown only when linked records exist; no synthetic progress is displayed.
- Preserved the previous daily dashboard at `/daily-rhythm` rather than deleting its routines or workflows. It is available as a contextual Daily Rhythm view.
- Residence now has Home and Life Blueprint subviews. Daily Rhythm has Daily Check-in, Faith & Practice, and Habits & Self-Control subviews.
- Both new pages reuse existing `/tasks`, `/goals`, and `/sessions` APIs. No new database schema, Supabase migration, or server route was introduced.
- Added route and data-source tests for Residence, Blueprint, and the preserved daily dashboard.
- The feature branch used as a source was intentionally not merged: it diverges substantially from `atlas-next` and contains unrelated Qur'an and environment configuration changes. Only the four page/style files and the product principles document were ported.


## Full transformation — actionable personal intelligence · 2026-11-26

- Connected the existing evidence-based recommendation engine to real destination actions: tasks open the relevant task context, learning suggestions open the linked lesson in Focus, and habit/focus/goal suggestions open their matching workspaces.
- Added in-context helpful/not-useful feedback and opened signals using the existing user-scoped `/api/intelligence/feedback` endpoint.
- Added loading and error states so a temporary API failure is not presented as an empty or misleading insight.
- Corrected the intelligence engine's focus comparisons to count only `session_kind='focus'` records; break sessions no longer inflate daily, weekly, or weekday focus patterns.
- No new tables, external AI calls, or schema changes were introduced. Recommendations remain deterministic, explainable and derived from the current user's workspace records.


## Full transformation — route-level performance · 2026-11-26

- Added route-level lazy loading for Home, Blueprint, Daily Check-in, Faith, Habits, Actions/Focus, Calendar, Goals, Learning/Library, Reviews/Insights, Settings and Admin.
- Kept the Qur'an page statically imported and its route untouched by the code-splitting pass. This avoids changing the reader's loading boundary while reducing the initial cost of unrelated destinations.
- Added a lightweight, accessible page-loading fallback inside the persistent application shell so room navigation remains mounted while a destination chunk loads.
- No dependency changes or server/data changes were required.
