# Personal OS 3.6 — Supabase-backed release candidate

Personal OS keeps its existing Express API and SQLite query behaviour while persisting each account's workspace snapshot in Supabase PostgreSQL. The browser continues to authenticate with Supabase Auth. The app server reads and writes only the signed-in user's snapshot using that user's access token; Supabase row-level security enforces ownership.

## Storage and privacy model

- Supabase Auth remains responsible for signup, email confirmation, login and sessions.
- Each user's complete workspace is stored in one row in `public.personal_os_workspace_snapshots`.
- The row is protected by RLS: authenticated users can select or mutate only the row whose `user_id` equals `auth.uid()`.
- The app loads a user's snapshot into a request-scoped in-memory SQLite database, runs the existing API logic, then saves the updated snapshot before completing the response.
- Requests for the same account are serialized within one app instance to prevent overlapping requests from overwriting one another.
- No user workspace is stored on the host filesystem. This permits an ephemeral/free web host.
- The admin directory remains a separate, owner-only Auth operation. It returns account metadata only and never reads workspace snapshots.
- The browser receives only the Supabase publishable key. Never put a Supabase secret/service-role key in frontend files.

## Required Supabase setup

1. Keep Supabase Auth email confirmation enabled.
2. In the Supabase SQL Editor, run `supabase-postgres-schema.sql`. It creates the snapshot table and RLS policy, as well as the relational schema reserved for a future normalized-storage migration.
3. Confirm `supabase-config.json` and `public/supabase-config.js` point to the same Supabase project.
4. Set `ADMIN_USER_ID` on the server to the UUID of the owner account. Do not use user-editable metadata as an admin role.
5. Keep public signups disabled until the deployment and account-isolation tests are complete.

The app uses the signed-in user's access token for PostgREST requests. It does not require the service-role key for workspace storage. The optional service-role key is used only by the owner-only account directory.

## Local development

- Node.js 20 or newer
- `npm install`
- `npm test`
- `npm start`
- Open `http://localhost:3000`

## Hosting

The included `render.yaml` targets Render's free web service and does not mount a persistent disk. Workspace persistence is provided by Supabase. Configure `ADMIN_USER_ID` and, only if the owner directory is needed, `SUPABASE_SERVICE_ROLE_KEY` as server-side environment variables.

The current snapshot approach is intended for a single app instance. Do not scale the service horizontally until distributed request locking and concurrency-safe snapshot writes have been implemented. Free web hosts may sleep when idle; the first request after sleep can take longer.

## Existing SQLite data

This release does not automatically copy pre-existing local or hosted SQLite files into Supabase. Keep the old deployment and its database files intact until a verified export/import migration has been completed. Do not delete old databases or replace the current production deployment based only on a successful build.

## Release status

This branch is a migration candidate, not a production-ready release. Before opening registration, run the SQL migration, test signup/login, verify two separate accounts cannot read or overwrite one another's workspace, test every feature, and confirm backup/restore behaviour.
