# Stage 4 — Events and Shared Services

**Status:** implementation in progress  
**Branch:** `atlas-stage4-events`  
**Base:** `atlas-next`  
**Release target:** staging only

## Objective

Make shared progress and recognition services consume durable facts from modules rather than reading or importing other modules' private implementation details.

## Architecture contract

The canonical event envelope follows Architecture v2:

- `key`: deterministic idempotency key
- `type`: past-tense event type
- `module`: publishing module
- `entityId`: optional source record identifier
- `occurredAt`: UTC ISO-8601 instant
- `localDate`: account-local day
- `payload`: minimal, schema-validated facts (never private notes or reflections)
- `source`: `user`, `system`, or `import`

The Postgres event ledger is append-only and unique on `(user_id, event_key)`. Events are appended in the same database transaction as the versioned workspace commit. Replaying a retried commit cannot duplicate an event or a derived award.

## Initial publishers

| Publisher | Events |
| --- | --- |
| Actions | `task.completed`, `task.reopened`, `focus.ended` |
| Goals | `goal.completed`, `goal.reopened`, `goal.milestone_reached`, `goal.milestone_unreached` |
| Habits | `habit.checked`, `habit.unchecked` |
| Learning | `learning.item_completed`, `learning.item_reopened`, `learning.study_logged` |
| Growth | `review.submitted`, `review.reopened` |
| Values | `practice.logged`, `practice.unlogged` for non-faith personal practices only |
| Shared challenge service | `challenge.completed` |

No event is emitted from Qur’an reading, Tajweed, prayer, or faith-record routes. Existing Qur’an and faith data and behaviour remain outside this stage's new integrations.

## Shared projections

- `progress_daily` is a rebuildable projection of event facts, keyed by account, local date, module and metric.
- `xp_ledger` is the canonical XP award/reversal ledger. Daily caps and source values follow Architecture v2: tasks 5/10 (100 daily cap), focus 1 per five minutes (120 cap), habits 3 (60 cap), learning completion 8 (80 cap), review submission 15 (30 cap).
- Reversal facts point to the original event. XP reversal entries are negative ledger rows; the original event is never edited or deleted.
- Achievement unlocks are idempotent and evaluated from aggregate progress.
- Weekly challenge progress is computed from event projections, not cross-module SQL.
- Residence briefing reads only shared projections and offers evidence, not automatic changes.

## Compatibility and data safety

- Keep the existing workspace snapshot format and all legacy SQLite tables in place.
- Preserve existing `xp_events`, `achievement_unlocks`, and `weekly_challenges` snapshot records for export/restore compatibility.
- Version 4 backups include the append-only activity event history. Imported events retain their keys, are marked `source: 'import'`, contribute to progress, and never award XP. The existing account's XP ledger is never overwritten by an import; legacy snapshot XP remains preserved in the backup for compatibility.
- Backfill existing XP awards into the new XP ledger without changing their point totals; mark them as legacy awards.
- New XP awards are written only to the canonical ledger. The old snapshot records are not silently rewritten or discarded.
- Imports never earn XP. Imported events, if explicitly replayed, carry `source: 'import'` and are excluded from XP.
- No production database, production branch, or production service changes.

## Exit criteria

1. A repeated event key is stored once and produces one projection/XP effect.
2. A version-conflict replay commits the snapshot and its event batch atomically.
3. Reopening or unchecking reverses the original progress and XP without editing the original event.
4. Rebuilding progress from the event ledger produces the same projection as incremental processing.
5. Daily XP caps are enforced transactionally.
6. Achievement unlocks and weekly challenge completion are idempotent.
7. Residence briefing values reconcile with the event ledger.
8. Version 4 exports include event history; older backups remain importable; imported events are idempotent and award no XP.
9. All CI checks pass, including the Qur’an/Tajweed path guard.
10. Staging authenticated QA passes on desktop and mobile before Stage 4 sign-off.

## Release gates

- Feature branch → CI → PR to `atlas-next`.
- Apply the reviewed migration to the staging Supabase project only.
- Deploy the exact merged commit to the Render staging service.
- Verify event ownership/RLS, replay, reversal, XP caps, achievements, challenge state, Residence briefing and backup compatibility with the existing test account.
- Production remains untouched and requires separate explicit approval.
