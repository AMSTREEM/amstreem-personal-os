# Amstreem Atlas Next — Product and Technical Architecture

## Product purpose

Amstreem Atlas is a private personal operating system. It helps a person move from intention to direction, planning, action, consistency, reflection and growth.

It is not a generic task manager, habit streak game, CRM or team project-management suite. The interface should help users see what matters, decide what to do next, and understand their progress without creating unnecessary administrative work.

## Experience principles

- Calm, premium, minimal and responsive.
- Useful information before decorative metrics.
- Real records before inferred insights; no fabricated progress.
- Optional faith/values tracking. Users choose whether to enable it.
- Streaks and XP are secondary legacy mechanics, not the product's centre.
- Every visible action must be functional and persist correctly.
- Respect reduced motion, keyboard use, accessible labels and readable contrast.
- Preserve user control over data through export and restore.

## Information architecture — official 4-Room, 8-View structure

The primary navigation contains four rooms, opened with ⌘ 1–⌘ 4. The room sub-navigation contains exactly eight views across the four rooms. Settings and owner-only Administration sit in the system rail.

### 01 — Residence (⌘ 1)
- One unified, scannable daily command centre; no sub-tabs.
- Time-aware hero, consistency ring, six-pillar pulse, top three priorities and Evening Shutdown.
- Daily activity summaries and announcements; analytics and trends live in Reviews & Insights.

### 02 — Daily Rhythm (⌘ 2)
- **Faith / Deen:** tradition-aware Islamic, Christian or general daily practice.
- **Habits & Self-Control:** positive routines and discipline commitments with shared check-in/history experience, trigger/slip/recovery records and 30-day consistency history.

### 03 — Execution & Focus (⌘ 3)
- **Projects & Tasks:** unified execution workspace with a persistent Focus Dock; desktop split layout and responsive mobile layout. Focus can launch directly from a task.
- **Calendar (optional):** scheduled commitments and date-based activity.

### 04 — Growth & Direction (⌘ 4)
- **Goals & Milestones:** outcomes, linked projects, tasks, milestones and evidence.
- **Learning & Library:** learning paths, lessons, study records, reading resources and private notes.
- **Reviews & Insights:** daily/weekly reflections, recorded workspace evidence, patterns and suggested next steps.

### System
- **Settings:** one grouped page for profile/North Star, workspace views, appearance/sound and data backup.
- **Administration:** owner-only accounts, product sections, feedback, announcements and aggregate operational insights.

Legacy route paths remain supported as redirects to their canonical view. Navigation consolidation does not delete the underlying feature components or data operations.

## Core data relationships

- A goal can have multiple projects.
- A project can have multiple milestones and tasks.
- A task can optionally link to a goal and/or project.
- A calendar commitment can optionally link to a task and/or project.
- A focus session can optionally link to a task and/or project.
- A learning path contains lessons; study logs refer to lessons.
- Reviews capture a period's wins, challenges, lessons and next focus.
- Today, Calendar, Insights and Reviews read from the same persisted records rather than maintaining separate progress counters.

Standalone tasks, projects and focus sessions remain valid without links.

## Technical architecture

- React 19 + TypeScript + Vite frontend.
- Express API retained as the backend boundary.
- Supabase Auth provides identity and session management.
- Existing Supabase workspace snapshots remain the persistence boundary; each account receives its own request-scoped SQLite workspace.
- React Query manages server state and cache invalidation.
- React Hook Form + Zod validate user-entered forms.
- Lucide icons and a small shared component layer support a consistent UI.
- Render serves the compiled `dist/` frontend and the existing public assets.
- Existing service-worker and PWA brand assets remain in place.

## Snapshot compatibility

- The current server writes `personal-os-sqlite-snapshot-v3` (`schemaVersion: 3`).
- The server accepts `personal-os-sqlite-snapshot-v1`, `personal-os-sqlite-snapshot-v2` and `personal-os-sqlite-snapshot-v3`.
- Existing optional tables remain optional when reading older snapshots; missing optional sections are initialized empty.
- Snapshot reconstruction uses the current SQLite schema and preserves existing table names, row identifiers and relationships.
- Serialization continues to include every table in the workspace table registry.
- Export/restore must preserve the same snapshot contract and foreign-key insert/delete order.
- The 4-Room, 8-View UI refactor must not require a snapshot format bump, database migration, API contract change or Supabase write.
- Compatibility must be verified with representative v1/v2/v3 snapshots and backup export/restore tests before production consideration.

## Security invariants

- Authentication is enforced server-side for API routes.
- Workspace data access is scoped to the authenticated user.
- Admin routes remain restricted to the owner/admin identity and use server-side credentials only.
- Never expose Supabase service-role/secret keys in the browser.
- Clear React Query's cache when the authenticated account changes.
- GET requests must remain read-only.
- Workspace snapshot writes must continue through the existing per-account queue.
- Do not scale the process-local write queue horizontally without distributed coordination or a different persistence strategy.

## Cutover requirements

1. Complete the feature audit and identify any legacy capability intentionally retired.
2. Pass type-check, build, backend tests and browser smoke tests.
3. Verify existing-account sign-in, username login, signup confirmation, password recovery and owner permissions.
4. Test old snapshot v1 load, new v2 save, backup export and restore.
5. Test two accounts to prove no workspace data leaks across sessions.
6. Verify mobile, tablet and desktop layouts, keyboard navigation and reduced motion.
7. Deploy to a separate Render staging service.
8. Review staging with real account data only after explicit backup and safe test procedure.
9. Keep the existing production deployment available until the new version is accepted.
10. Only then propose a controlled cutover. Do not merge or deploy automatically.
