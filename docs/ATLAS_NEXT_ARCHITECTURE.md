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

## Information architecture

### Space
- **Today:** daily briefing, focus, open priorities, rituals, next step, announcements.
- **Calendar:** commitments and activity history.

### Plan
- **Goals:** meaningful outcomes and direction.
- **Projects:** bodies of work connected to goals, with milestones.
- **Tasks:** concrete next actions linked to goals/projects where useful.

### Practice
- **Focus:** timer and recorded focus sessions, optionally linked to tasks/projects.
- **Rituals:** repeatable practices and daily check-ins.
- **Self-control:** private trackers and non-judgemental check-ins.
- **Learning:** learning paths, lessons and study records.

### Knowledge
- **Library:** private notes and references.

### Reflect
- **Reviews:** daily and weekly reflections.
- **Insights:** evidence-based patterns and suggested next steps.

### Personal
- **Values:** optional faith/value practices, with the user's choice controlling which tools appear.

### Preferences and ownership
- **Settings:** identity, daily focus intention, appearance, export and restore.
- **Administration:** owner-only accounts, feedback, announcements and aggregate operational insights.

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

- New writes use `personal-os-sqlite-snapshot-v2`.
- The server continues to read `personal-os-sqlite-snapshot-v1`.
- New tables are optional when reading old snapshots and are created empty.
- New nullable links on existing tasks/sessions default to null when old snapshot rows do not contain them.
- Export/restore must include the new tables and preserve foreign-key insert/delete order.
- No production migration is required for these additions because workspace tables live inside per-user JSON snapshots. Production data must still be backed up and tested before any cutover.

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
