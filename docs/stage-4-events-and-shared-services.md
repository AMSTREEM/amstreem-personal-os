# Stage 4 — Events and shared services

**Environment:** staging only (atlas-next / amstreem-atlas-staging)  
**Production:** untouched  
**Status:** implementation deployed to staging; account-level QA and migration-source reconciliation remain open.

## Event contract

Module writes publish server-created events through server/atlas-events.js. The event envelope passed to the database RPC uses:

- key: deterministic, idempotent event key
- type, module, entity_id
- occurred_at, local_date
- payload, source

The authenticated workspace snapshot and its event batch are committed through the same versioned database transaction. A failed workspace write therefore cannot leave a detached progress event. The browser does not write to the ledger directly.

## Publishers

| Area | Events |
| --- | --- |
| Actions | task.completed, task.reopened, focus.ended |
| Goals | goal.completed, goal.reopened, goal.milestone_reached, goal.milestone_unreached |
| Habits | habit.checked, habit.unchecked |
| Learning | learning.item_completed, learning.item_reopened, learning.study_logged |
| Growth | review.submitted |
| Values | practice.logged, practice.unlogged |
| Residence | challenge.completed |

Deleting a completed task, goal, milestone, learning item, habit or practice record publishes the corresponding reversal event. No Qur’an event publisher or reader code change was introduced.

## Shared projections

- **Progress:** progress_daily records daily module metrics.
- **XP:** xp_ledger is the reward source; category caps and reversal entries are applied by the database trigger.
- **Achievements:** definitions and unlocks are read from the shared tables; the database evaluates unlocks after events.
- **Challenges:** weekly challenge progress is calculated from the daily projections and shown on Residence.
- **Streaks:** habit check-ins are reconstructed from the event ledger over the workspace baseline. One missed day is allowed per Monday-based week. The user can disable the habit streak source.

## Preferences

Settings stores xp_enabled_modules and streaks_enabled_modules. The XP projection trigger reads the committed workspace settings, rather than trusting an event payload. Disabling XP leaves progress and achievements active; reversal events still reverse previously awarded XP.

## Staging verification

The following checks were run against the staging database inside transactions that were rolled back:

- Task completion created a progress projection and 5 XP.
- Reopening reversed the task projection and XP.
- Duplicate event insertion produced one ledger row and one reward.
- Disabling Actions XP preserved progress while awarding no XP.
- Re-enabling Actions XP restored rewards; reopening still reversed the prior reward.
- Goal completion awarded 25 XP; milestone completion awarded 10 XP; both reversal events returned net XP to zero.
- Goal XP disabled in Settings still preserved the progress projection.
- A batch of goal-linked task events did not exceed the daily Tasks XP cap.
- RLS is enabled on the event, progress, XP and achievement tables with authenticated owner-scoped policies.

The staging Render build for the implementation commit reported 125 tests passed, 0 failed, and the application started in the staging environment.

## Remaining release gates

1. Sign in to staging and manually verify the weekly challenge card, XP controls, streak toggle and live progress after completing and reopening a test task.
2. Verify a real habit check-in and uncheck from the UI, including the recovery-day display.
3. Reconcile migration history before any production promotion. Several earlier Stage 1 and Stage 4 migrations exist in the staging database's migration history but their original SQL files are absent from this branch's supabase/migrations directory. Reconstruct and commit those exact source migrations before treating the production release as reproducible.
4. Keep the Stage 3 manual accessibility and Qur’an golden-screenshot checks open until they are actually completed.

No production service, production database or production branch was changed.
