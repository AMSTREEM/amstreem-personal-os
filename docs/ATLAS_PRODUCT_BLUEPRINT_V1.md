# Amstreem Atlas — Product Architecture Blueprint v1.0

## Product definition

**Category:** Personal Growth & Life Management System  
**Positioning:** Build the life you're working towards.  
**Promise:** Help people understand where they are, decide where they want to go, and make meaningful, measurable progress without managing disconnected applications.

Atlas is organised around the user's life, not around a catalogue of software features.

## Non-negotiable principles

1. Personalisation before complexity.
2. Progress before productivity metrics.
3. Action before administration.
4. Useful intelligence before unnecessary AI features.
5. User control before forced systems.
6. Evidence before claims: never fabricate progress or imply causation from activity alone.
7. One source of truth for every record.

## Core operating model

Direction → Structure → Execution → Evidence → Reflection → Adaptation.

The Growth Engine turns this into a continuous cycle:
1. Understand the starting point and desired change.
2. Define an outcome and how progress can be observed.
3. Build supporting goals, projects, tasks, habits and routines.
4. Execute and capture meaningful activity.
5. Compare current evidence with the baseline.
6. Adapt the plan with user approval.

## Six primary destinations

| Destination | Responsibility | Existing implementation |
|---|---|---|
| Home | Personal command centre, today's priorities and relevant life-area context | `/residence`, `TodayPage.tsx` |
| Actions | Tasks, projects, habits, routines and commitments | `/actions`, `FocusWorkspace.tsx`, habits views |
| Goals | Outcomes, milestones and long-term direction | `/goals`, `GoalsPage.tsx` |
| Focus | Protected work, study sessions and session history | `/focus`, `FocusWorkspace.tsx` |
| Growth | Reviews, evidence, patterns and insights | `/growth`, `ReviewsInsightsView` |
| Calendar | Time, events, deadlines and planned commitments | `/calendar`, `CalendarPage.tsx` |

Legacy routes must continue to redirect to canonical destinations without losing query strings or hashes. Specialist tools remain accessible through Personal tools and relevant life-area contexts.

## Personal life areas

Users can activate or deactivate these areas at any time:

- Health & Fitness (`health`)
- Education & Learning (`education`)
- Career & Business (`career`)
- Financial Growth (`finance`)
- Faith & Spirituality (`faith`)
- Personal Development (`personal`)
- Relationships (`relationships`)
- Lifestyle & Organisation (`lifestyle`)

The selected areas are stored per user in the existing workspace settings as `life_areas`. The initial migration defaults existing users to all areas, preserving access and avoiding a destructive change. New onboarding should invite users to choose their priorities.

An area is a personal context and grouping, not a duplicated task manager. Shared capabilities (goals, projects, actions, habits, calendar, focus and reviews) should be reusable across areas.

Specialist tools such as Qur'an, learning library and faith-specific practice remain distinct capabilities. They are not deleted when an area is deactivated; the user can reactivate the area.

## Growth Engine: data model

Every meaningful improvement should be represented through:

- **Life area:** the context of the desired change.
- **Baseline:** where the user is starting, including date, method and optional notes.
- **Outcome:** the desired result and target horizon.
- **Measurement:** a suitable metric or qualitative assessment, with units and frequency where applicable.
- **Evidence:** actual records such as workouts, study logs, completed milestones or user reflections.
- **Review:** a dated interpretation of progress, obstacles and learning.
- **Adjustment:** a user-approved change to goals, routines or commitments.

Do not force all life areas into numerical scores. Use qualitative evidence where numbers are inappropriate, especially for faith, relationships and personal development. Avoid a universal life score, public comparison or punitive streak mechanics.

## Shared capability relationships

- A life area can contain many goals.
- A goal can have projects, milestones, direct tasks and supporting habits.
- A project can contain milestones and tasks.
- A task or calendar commitment can optionally link to a goal and project.
- A focus session can link to a task, project or learning lesson.
- Learning paths contain lessons; study logs and linked focus sessions provide learning evidence.
- Specialist records remain owned by their specialist module.
- Home and Growth derive summaries from source records rather than duplicating them.

## Current implementation versus target

### Implemented in this staging foundation

- Six primary navigation destinations: Home, Actions, Goals, Focus, Growth and Calendar.
- Canonical routes for Actions and Growth, with legacy route redirects retained.
- Personal life-area selection in Settings, saved per workspace.
- Server-side validation of the supported life-area identifiers.
- Existing workspaces default to all eight areas when no selection has been saved.
- Selected life areas are surfaced in the Personal tools drawer.
- Existing specialist tools and underlying records remain available.
- Existing authentication, workspace persistence, backup/restore and deployment architecture remain in place.

### Still to build

- Guided first-run onboarding for life-area selection and baseline discovery.
- Contextual life-area views on Home and dedicated area workspaces.
- First-class baseline, outcome, measurement and evidence records.
- Goal-to-life-area linking and area-specific progress summaries.
- Growth Engine review and recommendation logic based on verified records.
- A relational persistence evolution plan for new growth records, while preserving current snapshot compatibility.

## Technical migration principles

- Keep React, TypeScript, Express, Supabase Auth, PostgreSQL and Render.
- Do not rewrite the application into microservices.
- Keep existing data and specialist modules working.
- Introduce schema changes additively and preserve snapshot v1/v2/v3 compatibility.
- Add migrations and tests before changing persistence semantics.
- Never modify the frozen Qur'an reader checkpoints or their reader implementation as part of unrelated product navigation work.
- Validate the staging build, API behaviour, mobile navigation, data persistence and legacy redirects before calling a release complete.
