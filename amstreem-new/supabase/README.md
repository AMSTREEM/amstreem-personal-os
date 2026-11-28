# Amstreem staging backend

This directory documents the isolated Amstreem database foundation.

## Staging project
- Supabase project: `amstreem-atlas-staging`
- Project ref: `yllzeblecyqnncgktnjw`
- Region: EU West
- Status: active and healthy

## Database isolation
The existing project already contained Atlas / Personal OS tables and records. Those were left untouched.
The new Amstreem foundation lives in its own `amstreem` schema, separate from the existing `public` tables.
The initial table is `amstreem.memories`.

## Applied foundation
- Authenticated-user ownership via `user_id` referencing `auth.users`.
- Row Level Security enabled.
- SELECT, INSERT, UPDATE, and DELETE policies restrict each user to their own memories.
- Anonymous role has no schema/table privileges.
- Sensitive memory rows require a recorded consent timestamp.
- Indexed by owner and most recently updated.
- No existing tables or records were dropped, renamed, truncated, or migrated.

`schema.sql` is a reference snapshot of the applied foundation. It is not a database reset script.

## Not active yet
- The frontend now uses Supabase Auth for account registration and login.
- Authenticated memory CRUD is implemented against `amstreem.memories`.
- The Render frontend receives only the project URL and publishable key; no service-role key is used in browser code.
- Add `amstreem` to the project's **Exposed schemas** in Supabase API settings before memory API requests can succeed.
- Configure the deployed app URL in Supabase Auth URL Configuration / Redirect URLs so email confirmation returns to the app.
- Existing browser captures remain local until the signed-in user explicitly chooses **Import local captures**.

## Security
- Never place a Supabase secret/service-role key in browser code.
- Use a publishable key in public clients, with RLS enforced.
- Configure only the required API schema exposure when the app integration is ready.
