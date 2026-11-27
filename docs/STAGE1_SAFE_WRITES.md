# Stage 1 — Safe writes

## Persistence model

The API still executes the existing module SQL against a request-scoped in-memory SQLite workspace. The durable Supabase row is now versioned:

- `version` increments on every committed mutation.
- `schema_version` records the snapshot schema (currently 3).
- `commit_workspace` serializes commits per account with a transaction-scoped advisory lock and performs a compare-and-swap against the version loaded at request start.
- A stale snapshot is never allowed to overwrite a newer one.

On a version conflict the API reloads the latest snapshot and replays the request's row-level delta up to three times. Independent row changes merge; concurrent edits/deletes of the same row and colliding inserts return HTTP 409 rather than guessing. This is intentionally conservative.

## Idempotency

A small transport wrapper adds a unique `Idempotency-Key` to mutating Atlas API requests while leaving the frozen shared API client and Qur’an API routes untouched. A caller that retries the exact same operation must pass the original key in its request headers; generating a new key represents a new operation. The database stores the request hash and committed version for 30 days. Reusing a key with a different request body is rejected.

## History and restore

- A scheduled history point is created no more than once per six hours per account.
- Keep the newest 30 scheduled points.
- Keep pre-destructive history points for 90 days.
- Import writes a pre-import history point in the same transaction as the versioned workspace commit.
- History rows are protected by owner-scoped RLS.

Restoration remains an operator/runbook operation rather than a user-facing feature. It uses the authenticated account's history row and `commit_workspace` with `p_force_history=true` and `p_history_reason='pre_restore'`.

## Backup format

New exports use `format: atlas-backup`, `schemaVersion`, `exportedAt`, `appVersion`, `checksum`, and `data`. The checksum is SHA-256 over canonical JSON. The server checks the 10 MB size limit, schema version, checksum, table shapes, and primary keys before changing the workspace. Legacy unwrapped exports remain accepted. The account ID is never imported from the file.

Use `POST /api/import/preview` for a non-mutating validation and per-table record count before `POST /api/import`.

Qur’an and faith tables remain in the same snapshot and are passed through export/import without domain-specific transformation.

## Migration runner

The repository migration is in `supabase/migrations/`. The runner is deliberately staging-only:

```sh
ATLAS_STAGING=true \
SUPABASE_PROJECT_REF=yllzeblecyqnncgktnjw \
SUPABASE_ACCESS_TOKEN=... \
SUPABASE_DB_PASSWORD=... \
npm run db:migrate:staging
```

It refuses to run unless the staging guard is set and rejects the known production project ref. Keep tokens and database passwords in a secure shell or secret manager, never in the repository or Render logs.

## Staging verification drill

Use only a dedicated disposable staging test account. Never use a real user's account for this drill.

Required environment:

- `ATLAS_STAGE1_CONFIRM_DRILL=true`
- `ATLAS_STAGE1_STAGING_URL=https://amstreem-atlas-staging.onrender.com`
- `SUPABASE_URL=https://yllzeblecyqnncgktnjw.supabase.co`
- `SUPABASE_PUBLISHABLE_KEY`
- `ATLAS_STAGE1_TEST_TOKEN` — access token for the disposable staging account
- `ATLAS_STAGE1_TEST_USER_ID` — that same account's UUID

Run `npm run stage1:drill`. It races two writes from one version, expects one CAS conflict, replays the losing independent change, checks that neither write was lost, captures a history point, changes a harmless sentinel setting, restores the saved point, and verifies the original snapshot is byte-for-byte equivalent as returned by Supabase.

Do not run without a dedicated staging account and explicit confirmation. The script rejects non-staging service/project hosts.
