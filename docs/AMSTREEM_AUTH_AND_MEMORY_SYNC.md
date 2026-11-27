# Amstreem authentication and memory sync

## Current implementation boundary

- Supabase Auth is used for email/password registration and sign-in.
- The browser uses only the project's publishable API key. Never add a service-role or secret key to Vite variables.
- The client targets the `amstreem` PostgREST schema.
- Memory access remains protected by authenticated-only SQL grants and per-user RLS policies.
- Cloud transfer is manual and requires a separate in-product confirmation. Signing in does not upload local memories.
- Local browser memories remain available if the user signs out or cloud configuration is absent.
- A manual sync merges by memory UUID and chooses the newest `updated_at` record for each UUID, then upserts only rows belonging to the active user.
- The consent prompt warns that all selected memory records, including those labelled sensitive, will be uploaded to that user's private account.
- No automatic import of old captures is performed.

## Required deployment configuration

Set these environment variables on the retained Amstreem Render static site:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Do not set a Supabase service-role key in the frontend.

## Before enabling production cloud sync

1. Confirm `amstreem` is listed under Supabase API > Exposed schemas.
2. Confirm the Auth email provider is enabled and configure the production Site URL and redirect allow-list for the deployed Amstreem origin.
3. Confirm the API responds to the `amstreem.memories` resource and that anonymous requests are denied while authenticated users can access only their own rows.
4. Configure the two public Vite environment variables on the retained Render service.
5. Run signup, email confirmation (if enabled), sign-in, sign-out, and two-user isolation tests on staging.
6. Only then publish to the retained site.

## Privacy and safety

- Never place service-role credentials in browser code or public build variables.
- Do not grant `anon` access to the memories table.
- Do not broaden RLS policies to make the custom schema work.
- A successful browser build does not prove API exposure, authentication redirects, or cross-user isolation; those require live tests.
