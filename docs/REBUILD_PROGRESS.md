# Amstreem Atlas Next — Rebuild Progress

## Current status
Discovery and baseline protection. No production code, Supabase data, or Render configuration has been changed.

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
