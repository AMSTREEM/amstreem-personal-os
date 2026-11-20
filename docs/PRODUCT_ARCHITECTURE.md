# Amstreem Atlas Next — Product and Architecture

## Product definition

Amstreem Atlas is a personal operating system: a private environment that helps a person turn what matters into a direction, translate that direction into commitments, do the work, see what is changing, and adjust deliberately.

It is not a generic task manager, team project-management suite, habit-streak game, or analytics dashboard.

**Core loop:** Direction → Commitments → Action → Evidence → Reflection → Adjustment.

## Product experience

### Primary navigation

1. **Today** — the command centre: today's priorities, calendar commitments, a clear next action, rituals, and a concise view of current momentum.
2. **Plan**
   - **Goals** — meaningful outcomes and target horizons.
   - **Projects** — finite bodies of work that move goals forward.
   - **Tasks** — concrete next actions, with ownership and due dates.
   - **Calendar** — time commitments and time blocks.
3. **Practice**
   - **Focus** — intentional work sessions, optionally linked to a task, project, or learning lesson.
   - **Rituals** — user-defined recurring practices, without punitive streak mechanics.
   - **Learning** — learning paths, lessons, resources, study sessions, and checkpoints.
4. **Reflect**
   - **Reviews** — daily and weekly reflection grounded in actual activity.
   - **Insights** — transparent patterns and recommendations derived from workspace records.
5. **Library** — notes, references, saved resources, and knowledge connected to goals, projects, and learning.
6. **Values** — optional personal values and faith-related practices. This area is user-controlled and never forced into the default workflow.
7. **Settings** — profile, preferences, appearance, privacy, export/import, and account controls.

Owner administration remains a separate privileged area and must never appear as an ordinary personal workspace feature. Public rankings, XP, and reward mechanics should not drive the core experience; retain only useful, privacy-respecting milestones if they add genuine value.

## Shared data relationships

- A goal can contain multiple projects.
- A project can contain tasks and milestones.
- A task may be scheduled on the calendar and linked to a focus session.
- A focus session may be linked to a task, project, or learning lesson.
- A learning path contains ordered lessons; lessons can contain resources, notes, and study activity.
- Ritual check-ins are recorded once and reused by Today, Reviews, and Insights.
- Library items may be linked to goals, projects, lessons, or reviews.
- Daily and weekly reviews summarize existing records; they do not create duplicate copies of activity.
- Standalone tasks, focus sessions, notes, and goals remain possible when a relationship is not needed.

## Information and interaction principles

- Make the next useful action obvious without making the interface noisy.
- Show the reason behind recommendations and link them to the source records.
- Let users capture quickly, then add structure when useful.
- Prefer clear states and useful empty states over decorative cards.
- Do not invent progress, streaks, AI insights, or completion percentages.
- No visible control may be inert. Destructive actions require clear confirmation and recoverable paths where possible.
- Preserve user choice: modules can be hidden or configured; Values is optional.
- Support keyboard, touch, screen readers, reduced motion, narrow mobile screens, and desktop layouts.

## Visual direction

A restrained, premium workspace: clear typography, quiet surfaces, strong spacing rhythm, subtle borders, deliberate contrast, and one restrained accent system. Use motion only to clarify state changes. Avoid excessive gradients, card grids, ornamental icons, fake charts, and gamified visual clutter.

Provide a coherent light/dark appearance system. Keep the Amstreem brand assets intact and use the symbol and wordmark in their appropriate contexts.

## Frontend architecture

- React + TypeScript + Vite for the application shell and page composition.
- Tailwind CSS 4 for design tokens and utility styling.
- shadcn/ui patterns and locally owned components as the primary component foundation.
- React Hook Form + Zod for validated forms.
- Use Ant Design as a reference for dense data interaction patterns where useful, not as a second competing global component system.
- Use a shared API client and query/cache layer; keep server state separate from local interface state.
- Build accessible primitives once and reuse them across modules.
- Keep the existing Express API as the initial backend boundary. Do not rewrite the storage layer merely to support a new frontend.

## Backend and data safety

- Keep Supabase Auth and the current row-level-security ownership model.
- Keep the existing workspace snapshot persistence while the new frontend is built and verified.
- Add explicit snapshot/schema versioning and forward-compatible defaults before introducing new workspace tables.
- Keep backup export/import compatible with every supported table and preserve foreign-key insertion order.
- Do not silently overwrite malformed or unknown workspace data.
- The current per-account queue is process-local and assumes one Render instance. Do not scale the service horizontally without replacing that coordination mechanism.
- Do not expose Supabase secret/service-role credentials to the browser.
- No destructive production migrations, data rewrites, or deployment-branch changes during the rebuild.

## Proposed data-model additions

The current schema has goals and tasks but no first-class project layer or review records. Add these only with backward-compatible snapshot defaults and tests:
- `projects`: title, description, status, target date, optional goal relationship.
- `project_milestones`: optional checkpoints within a project.
- `task.project_id` and `task.goal_id` (nullable relationships where useful).
- Optional `calendar_events` / time blocks with links to task, project, or focus session.
- `daily_reviews` and `weekly_reviews` with prompts, reflections, and references to the period reviewed.

The exact fields and foreign-key strategy will be finalized against the current schema and API before implementation.

## Intelligence model

Start with deterministic, explainable rules using real workspace data:
- Identify overdue or approaching commitments.
- Surface a project with no next action.
- Suggest continuing a learning path that is already in progress.
- Compare focus patterns across equivalent periods.
- Prepare review summaries from logged activity.
- Allow the user to dismiss or rate recommendations.

Every insight must show why it appeared and where its supporting data came from. AI may later assist with summarization or reflection, but it must not invent facts or become a dependency for basic app functionality.

## Delivery sequence

1. Finish audit of current UI, API contracts, auth, backup/restore, and snapshot behaviour.
2. Build the shared design system and responsive application shell.
3. Build Today and the Plan workflows around goals → projects → tasks → calendar.
4. Build Practice workflows for focus, rituals, and learning.
5. Build Library, Values, Reviews, and transparent Insights.
6. Integrate owner administration and existing platform-level features where still justified.
7. Add compatibility tests, functional tests, accessibility checks, and mobile QA.
8. Deploy to an isolated staging service; only plan a production cutover after verification.

## Initial implementation constraints

- Work only on the `atlas-next` branch until a release is approved.
- The Render production service remains on `audit-and-hardening`.
- Existing workspace rows are the source of truth. Do not seed, reset, or rewrite production user data.
- Keep progress and decisions updated in `docs/REBUILD_PROGRESS.md`.
