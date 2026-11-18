# Personal OS 3.6 — Multi-user launch candidate

This release opens public account creation, personalises each workspace from the signup name/username, separates each account's records into its own SQLite database file, and adds an owner-only account directory and email console.

## Privacy and access model
- Supabase Auth handles account creation, email confirmation, login and sessions. The browser uses only the Supabase publishable key.
- Each authenticated user gets a separate SQLite database file, named using a SHA-256 digest of the Supabase user ID. No user's private records are queried by the admin directory.
- The admin identity is fixed by the server-only `ADMIN_USER_ID` environment variable. The admin endpoints require a verified Supabase access token and that exact user ID.
- The admin directory returns only name, username, email, signup date and email-confirmation status. It does not return workspace records.
- The Supabase service-role key is server-only and required only for the admin user directory. Never expose it to the browser.
- Welcome emails and owner-triggered thank-you emails use Resend. Configure a verified sender domain before sending.

## Local setup
1. Install Node.js 20 or newer.
2. Copy `.env.example` to `.env` and fill in server-only secrets.
3. Run `npm install` and `npm start`.
4. Open `http://localhost:3000`.

## Supabase setup before opening registration
- Run `supabase-setup.sql` once in the Supabase SQL Editor. It creates a private profile table, enforces case-insensitive username uniqueness and enables row-level security.
- Confirm the project URL and publishable key in `supabase-config.json` and `public/supabase-config.js`.
- Enable email/password signups and email confirmation in Supabase Authentication settings.
- Configure the production Site URL and allowed redirect URLs to your deployed HTTPS domain.
- Set `ADMIN_USER_ID` to your existing owner account UUID. Do not rely on a client-side role or user metadata for admin privileges.
- Create a server-side secret/service-role key and set it as `SUPABASE_SERVICE_ROLE_KEY` in the host's secret environment settings. Never paste it into frontend files or commit it.

## Hosting
The included `render.yaml` describes an Express web service with a persistent disk mounted at `/var/data`. Set the four secret environment values (`ADMIN_USER_ID`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`) in the host dashboard. The persistent disk is essential: SQLite data is not durable on an ephemeral filesystem.

## Email
Set up a Resend account, verify a domain you control, create an API key and set `EMAIL_FROM` to an address on that verified domain. New accounts receive one welcome email on their first authenticated session. The admin page can send a custom message to selected users or all users except the admin account.

## Important limitations before public launch
This is a multi-user pilot using one persistent SQLite file per user. It is suitable for a single persistent-disk instance, not multiple horizontally scaled instances or high-availability deployment. Configure disk backups and test restore before inviting users. Add rate limiting, abuse monitoring, email delivery limits, account deletion/export workflows and operational monitoring before a broad public launch.

## Existing owner data
If `amstreem.db` exists beside `server.js`, the owner account continues using it. On a fresh deployment the owner database is created under `DATA_DIR`. Each new user starts with a clean, separate database.
