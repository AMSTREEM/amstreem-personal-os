# Amstreem Atlas — Product & Architecture

## Product definition

Amstreem Atlas is a **Personal Consistency Operating System**: a private, multi-user environment that helps people organise the important areas of their lives, turn long-term direction into daily action, and understand their progress from real records.

Atlas is not a generic to-do list, a team project-management suite, a habit-streak game, or a collection of disconnected mini-apps.

**Core loop:** Direction → Commitments → Daily execution → Evidence → Reflection → Adjustment.

## Navigation architecture

The six life pillars are distinct, equally important modules. They remain visible in the primary navigation. Optional secondary views may be enabled or hidden, but core pillars are never removed by a feature toggle.

### Command & Daily Rhythm

- **Residence** — the central command view, not a seventh life pillar. It brings together today's Salah/faith record when enabled, current focus timer, top priorities, daily habits, active goals, streak status, and the consistency pulse.
- **Deen & Reflection** — daily Salah, Qur'an memorisation and revision, optional night worship, spiritual reflection, and daily/weekly reviews. The module remains visible; faith-specific tracking is user-controlled and optional.
- **Self-Control & Streaks** — private commitments, self-control check-ins, daily habits, discipline records, and seven-day/monthly consistency history. The experience must never punish, shame, or coerce users.

### Growth & Execution

- **Projects & Tasks** — projects, milestones, actionable tasks, due dates, and a Calendar view. Projects and tasks are distinct working surfaces within one pillar.
- **Focus Room** — a focus timer and session history. Before starting, users can link the block to either a task or a Learning Studio lesson, and optionally to a project. Timer context survives navigation and refreshes.
- **Learning Studio** — learning paths, lessons, study activity, and a Library tab. Library is a secondary view inside Learning Studio, not a separate core pillar.
- **Goals** — long-term outcomes and direction, connected to projects, tasks, and relevant daily habits.

Residence is the command surface. Administration remains at the bottom of the sidebar for authorised owners; ordinary settings remain available there too. Calendar and Library are optional secondary views, not replacements for core modules.

## Cross-module relationships

- Goals can link to multiple projects, direct tasks, and recurring habits.
- Projects can belong to a goal and contain milestones; tasks can link to a project and/or a goal.
- Focus sessions can link to either a task or a learning lesson, and optionally to a project.
- Saving a lesson-linked focus session also records the same minutes in Learning Studio's study history. It must not create a second focus session or fabricate time.
- Learning Studio owns paths, lessons, resources, notes, and study records.
- Deen records remain owned by Deen & Reflection. Residence may display a concise summary, but must not duplicate the source record.
- Self-Control & Streaks owns habit and discipline records. Residence reads summaries from those records rather than creating a second copy.
- Each record has one source of truth. Linked modules use references and derived summaries, not duplicate writes.

## Residence consistency pulse

The daily pulse is an explainable summary, not a grade or a judgement. It is the arithmetic mean of the dimensions that are active for the user's workspace on that day:

- **Deen/Faith:** completed daily practices divided by the configured five practices, only when the user has enabled a faith experience.
- **Habits:** completed active daily habits divided by the active habit count, only when at least one habit exists.
- **Focus:** today's recorded focus minutes divided by the user's daily focus intention, capped at 100%, only when the user has actually recorded focus activity within the current seven-day window.
- **Tasks:** completed tasks due today divided by tasks due today, only when at least one task is scheduled for today.

Unavailable or unused dimensions are omitted rather than treated as zero. The pulse never awards progress for missing data, does not use XP, and does not compare users against one another. The user can always inspect the underlying records.

## Information and interaction principles

- Make the next useful action obvious without making the interface noisy.
- Show the reason behind recommendations and link them to source records.
- Let users capture quickly, then add structure when useful.
- Prefer clear states and useful empty states over decorative cards.
- Do not invent progress, streaks, insights, or completion percentages.
- No visible control may be inert. Destructive actions require clear confirmation and recoverable paths where possible.
- Keep the six core pillars available. Only secondary views such as Calendar and Library are optional.
- Support keyboard, touch, screen readers, reduced motion, narrow mobile screens, and desktop layouts.
- Avoid guilt-based streak pressure, manipulative engagement loops, and inflated XP.

## Visual direction

A restrained, premium workspace: clear typography, quiet surfaces, strong spacing rhythm, subtle borders, deliberate contrast, and one restrained accent system. Use motion only to clarify state changes. Avoid excessive gradients, ornamental iconography, fake charts, and gamified visual clutter.

Provide a coherent light/dark appearance system. Keep Amstreem brand assets intact and use the symbol and wordmark in their appropriate contexts.

## Frontend architecture

- React + TypeScript + Vite for the application shell and page composition.
- Tailwind CSS 4 and locally owned styles/components for the design system.
- React Query for server state and cache invalidation; keep it separate from local interface state.
- Use a shared API client; keep server state separate from local interface state.
- Build accessible primitives once and reuse them across modules.
- Keep the existing Express API as the backend boundary. Do not rewrite the storage layer merely to support a new frontend.

## Backend and data safety

- Keep Supabase Auth and the existing per-user workspace ownership model.
- Keep workspace snapshot persistence in `personal_os_workspaces`.
- Keep secret/service-role credentials server-side only.
- Keep the request-scoped in-memory SQLite workspace schema and snapshot serializer compatible.
- Nullable `habits.goal_id` and `sessions.lesson_id` relationships use backward-compatible defaults. New workspace snapshots are written as v3; readers continue accepting v1 and v2 snapshots, and older snapshots that omit the new fields load with null relationships.
- Keep backup export/import compatible with every supported table and preserve foreign-key insertion order.
- Do not silently overwrite malformed or unknown workspace data.
- The current per-account queue is process-local and assumes one Render instance. Do not scale horizontally without replacing that coordination mechanism.
- No destructive production migrations, data rewrites, or deployment-branch changes during development.

## Delivery sequence

1. **Core daily loop:** Residence, Deen & Reflection, and Self-Control & Streaks.
2. **Execution loop:** Projects & Tasks and Focus Room.
3. **Direction and depth:** Learning Studio (including Library) and Goals.
4. **Integration and quality:** cross-module relationships, account isolation, accessibility, responsive behaviour, backup compatibility, and end-to-end verification.
5. **Staging verification:** deploy only to an isolated staging service after CI passes; production cutover requires a separate approval.

The build order controls delivery sequence, not the importance of the six pillars.

## Current implementation baseline

- Sidebar grouped into Command & Daily Rhythm and Growth & Execution.
- Residence calculates an active-area daily consistency pulse and surfaces faith, habits, priorities, focus timer/context, and active goals.
- Goals can display linked projects, tasks, milestones, and daily habits.
- Habits can be linked to active goals.
- Focus Room can be started with a task or learning lesson selected; lesson-linked sessions update Learning Studio study minutes.
- Learning Studio provides a direct action to open Focus Room for a specific lesson.
- Calendar and Library remain secondary tabs.
