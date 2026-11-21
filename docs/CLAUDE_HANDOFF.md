# Amstreem Atlas — engineering handoff

**Live app:** https://amstreematlas.onrender.com  
**Repository:** https://github.com/AMSTREEM/amstreem-personal-os  
**Working branch:** `audit-and-hardening`  
**Hosting:** Render web service, backed by Supabase Auth and Postgres  
**Current handoff intent:** continue product development and complete release-readiness verification. This is not permission to change production data, rotate credentials, or remove the existing deployment.

## Product overview

Amstreem Atlas is a private personal workspace for tasks, goals, focused work, learning, faith practices, personal reflection, and progress. The product direction is a calm, high-quality personal command centre. Retention should come from real utility, personal progress, and useful reasons to return—not guilt loops, forced streaks, spammy notifications, or artificial engagement.

Current product systems include:
- Daily briefing and due-work prioritisation.
- Lifetime XP and levels.
- Activity-based achievement milestones with per-workspace unlock history.
- Weekly challenges based on actual workspace activity.
- Personal intelligence recommendations, user feedback, and focus-rhythm insights.
- Global search across tasks, notes, goals, learning content, modules, and Qur'an records.
- Responsive navigation and a mobile sidebar with a dismissible backdrop.
- PWA install support; iOS installation is via Safari → Share → Add to Home Screen.

## External services and developer tools used

Claude should understand the existing service ecosystem before proposing replacements. The app is not a standalone frontend and should not be rebuilt around a different provider without a clear migration plan.

### Core services
- **Render** — hosts the live Node/Express web service at https://amstreematlas.onrender.com. Git-based deploys are connected to the repository; the current service uses the Render free web-service plan and an ephemeral filesystem.
- **Supabase** — provides Auth (signup, email confirmation, login, sessions, password recovery, admin Auth API where configured) and managed PostgreSQL. The app stores per-user workspace snapshots in `public.personal_os_workspaces` and uses Supabase REST/PostgREST with the signed-in user's access token and RLS.
- **GitHub** — source control and collaboration for `AMSTREEM/amstreem-personal-os`; current working branch is `audit-and-hardening`. GitHub Actions runs CI checks on pushes and pull requests.
- **Resend** — email delivery integration used by the server for welcome and owner-triggered thank-you emails. It is optional and only active when `RESEND_API_KEY` and `EMAIL_FROM` are configured in Render. Do not assume it is configured or that email delivery has been live-tested.

### Third-party assets / browser dependencies
- **Google Fonts** — externally serves DM Sans, Manrope, and DM Mono typography from `fonts.googleapis.com` / `fonts.gstatic.com`.
- **jsDelivr CDN** — allowed by the Content Security Policy for browser scripts; inspect actual imports/usages before removing or expanding this dependency.
- **Safari / iOS Home Screen PWA support** — the app is a PWA installed through Safari's Add to Home Screen flow, not a native App Store app. It uses a web manifest and service worker.

### Development and verification tools
- **Node.js / npm** — runtime, dependency management, local development, and tests.
- **Playwright** — installed by the user on Windows for browser-based visual QA. A full authenticated run has not yet been completed; do not report it as passed.
- **GitHub Actions** — automated CI for dependency audit, syntax checks, and tests.
- **Render deploy/log tools** — used to inspect deployment status and service logs.

### Important boundaries
- Do not introduce Firebase, Vercel, Clerk, Neon, or another replacement just because they are familiar; first assess the existing Supabase + Render architecture.
- Do not move secrets into source control or frontend code. Supabase secret/service-role credentials and Resend API credentials must remain server-side in Render environment variables.
- Distinguish configured integrations from integrations whose credentials are optional or whose live behavior has not been verified.

## What the app is, who it serves, and what it is trying to achieve

**Amstreem Atlas is a personal operating system (personal OS), not a CRM, project-management tool for teams, generic habit tracker, or simple to-do list.** It is intended to be one coherent, private place where an individual can organise their life, make progress on meaningful priorities, and understand what deserves attention next.

The central product promise is: **help a person turn intentions into consistent, visible progress without making them manage a complicated system.** Atlas should help someone decide what matters today, take the next useful action, build skills, maintain the routines they care about, and see evidence that their effort is adding up.

### The experience it should provide

- **A command centre:** a calm dashboard that brings together today's priorities, due work, goals, focus, learning, routines, and meaningful progress.
- **Execution:** tasks, notes, goals, planning, focus sessions, and review tools that help users move from intention to action.
- **Personal development:** learning paths, modules, lessons, study records, and progress tracking.
- **Routines and self-management:** habits, personal trackers, calendar/rhythm tools, and weekly challenges grounded in actual activity.
- **Faith and personal values:** an optional, user-controlled faith space. Users choose whether to include it and the relevant experience during setup; it must remain respectful, private, and adaptable rather than imposing one worldview.
- **Reflection and insight:** a useful record of what the user has done, patterns in their work, achievements, and context-aware suggestions about what to do next.
- **A sense of ownership:** personal identity, display name, themes, navigation choices, and configurable dashboard sections. The workspace should feel like the user's own environment.

### Product principles

1. **Utility before engagement.** Make Atlas worth returning to because it helps users make real progress. Healthy retention can come from relevant daily value, continuity, useful reminders, milestones, and personal context. Avoid manipulative streak anxiety, shame, artificial scarcity, noisy notifications, endless feeds, or meaningless XP inflation.
2. **Fast time-to-value.** A new user should be able to create an account, choose a few relevant areas, and complete a meaningful first action quickly. Do not make setup feel like configuring enterprise software.
3. **One coherent system.** Features should share context and reinforce one another. A goal can connect to tasks; focus can support learning; activity can inform progress and recommendations. Avoid a collection of disconnected mini-apps.
4. **Personal, not prescriptive.** Let users decide which areas matter to them. Faith features and personal routines are optional. Avoid assuming every user has the same goals, beliefs, schedule, or definition of success.
5. **Private by design.** Each account's workspace must remain isolated. Personal records should not become public, feed content, or be used for social comparison without an explicit product decision and user consent.
6. **Calm, premium, and usable.** Preserve the established visual direction: polished, minimal, deliberate, responsive, and theme-aware. Prioritise clear hierarchy, smooth interactions, accessibility, and mobile ergonomics over decorative complexity.
7. **Progress users can trust.** Achievements, challenges, insights, and progress indicators must derive from real user activity and persist reliably. Never fabricate progress or reward empty interactions.
8. **A useful mobile experience.** Atlas is a responsive web app and installable PWA. It should work well in mobile Safari and when added to an iPhone Home Screen; it is not currently a native App Store app.

### What success looks like

A user can open Atlas and quickly understand what matters, act on it, and leave with a sense of progress. Over time, Atlas should become more useful because it reflects the user's own goals, records, routines, learning, and feedback. Measure product quality through activation, meaningful task completion, repeat use that correlates with value, successful recovery and data integrity, performance, accessibility, and user trust—not raw session length alone.

When proposing a feature, explain which user problem it solves, how it fits into the whole system, what data it needs, how it affects privacy, and how its success will be measured. Prefer completing and polishing a coherent workflow over adding many shallow features.

## Stack and runtime

- Node.js / Express server: `server.js`.
- SQLite-compatible application queries using `better-sqlite3`.
- Supabase Auth for identity and sessions.
- Supabase Postgres table `public.personal_os_workspaces` stores each user's JSON workspace snapshot.
- Vanilla browser JavaScript and CSS: `public/app.js`, `public/style.css`, `public/index.html`.
- Render deployment config: `render.yaml`.
- CI workflow: `.github/workflows/test.yml`.

Run locally:
```bash
npm ci
npm test
npm run start
```
Open `http://localhost:3000`. Node 20+ is required. CI runs `npm ci`, production dependency audit, Node syntax checks, and `npm test`.

## Critical architecture rules

1. **Tenant isolation is foundational.** Every authenticated API request verifies the Supabase access token, loads only that user's row, and uses a request-scoped in-memory SQLite database. Supabase RLS is the final ownership boundary. Never trust a client-supplied user ID to choose a workspace.
2. **GET/HEAD requests are read-only.** The workspace middleware closes the in-memory database without saving on GET/HEAD. Mutations must use a non-GET method so the workspace snapshot is persisted. Do not mutate workspace data inside GET handlers.
3. **Per-user requests are serialized only within one server instance.** The in-memory lock does not coordinate multiple Render instances. Keep the service at one instance until distributed locking and concurrency-safe writes are designed and tested.
4. **Schema changes have multiple registries.** When adding a workspace table, update all of these together:
   - `schemaSql` in `server.js`
   - `workspaceTables` in `server.js`
   - `serializeWorkspaceDatabase` coverage (it derives from `workspaceTables`)
   - `/api/export` in `server.js`
   - `importTables` and `insertOrder` in `workspace-backup.js`
   - the legacy-backup optional-table checks in `workspace-backup.js`
   - tests in `test/postgres-schema.test.js`
   A table omitted from export/import can silently lose a user's history during restore.
5. **Never expose server secrets.** The browser may contain only the Supabase publishable key. Supabase secret/service-role keys, Resend keys, and other credentials belong only in Render environment variables. Do not print, copy into docs, commit, or ask the user to paste secrets.
6. **Preserve existing user data.** Do not delete or rewrite Supabase workspace rows, disable auth, change RLS, remove the old deployment, or run destructive migrations without explicit approval and a verified backup.
7. **Render free service is ephemeral.** User workspaces are persisted in Supabase, not on local disk. Do not add local-disk persistence assumptions.

## Key files

| File | Responsibility |
|---|---|
| `server.js` | Express routes, auth verification, workspace isolation, schema, API |
| `workspace-backup.js` | Validated transactional backup restore |
| `public/app.js` | Auth, UI rendering, client-side interactions |
| `public/index.html` | App shell, onboarding, dashboard and page markup |
| `public/style.css` | Themes, responsive layout and component styling |
| `public/supabase-config.js` | Browser-safe Supabase URL and publishable key only |
| `supabase-postgres-schema.sql` | Workspace table, grants and row-level security |
| `render.yaml` | Render build/start/health configuration |
| `test/` | Automated architecture and security regression tests |

## Security and operational notes

- Express sets baseline security headers, a Content Security Policy, production HSTS, API no-store headers, and bounded JSON request sizes.
- API and admin routes have rate limits; authenticated accounts also have a per-account limit.
- Admin account directory operations require the owner identity and a server-side Supabase secret/service-role key. If that key is not configured, the owner directory is intentionally unavailable; ordinary workspace storage uses the user's access token and does not require it.
- `/healthz` is the unauthenticated Render health endpoint.
- Avoid logging tokens, passwords, emails beyond what is needed for support, or workspace contents.

## Release verification still required

Automated CI and a successful Render deploy are necessary but not sufficient. Complete these manually before treating the app as production-ready:

- [ ] Confirm the exact Supabase project URL and publishable key in server and browser config; never expose secret keys.
- [ ] Confirm `personal_os_workspaces` SQL migration, grants, and RLS policies in the intended Supabase project.
- [ ] Confirm Supabase Auth site URL and redirect allow-list include the live Atlas domain.
- [ ] Test signup, email confirmation, email login, username login (if its optional server secret is configured), password reset, and sign-out.
- [ ] Test two independent accounts: create distinct records in each and verify neither can read or overwrite the other's workspace.
- [ ] Test create/edit/complete/delete for core records and verify data survives a fresh sign-in.
- [ ] Export a backup, inspect that it includes achievement and weekly-challenge history, then restore it into a safe test account.
- [ ] Test importing a legacy backup that predates newer optional tables.
- [ ] Complete real desktop and iPhone visual QA, including all themes, onboarding, sidebar, search, dialogs, forms, and PWA install.
- [ ] Check Render logs after exercising auth and workspace writes; confirm no recurring 4xx/5xx or persistence failures.
- [ ] Keep registration limited until the account-isolation and restore checks pass.

## Known limitations / follow-up

- **iOS Home Screen icon:** the current HTML points `apple-touch-icon` at the SVG favicon. iOS commonly expects a PNG touch icon. The user plans to supply the final Amstreem logo; once supplied, create a faithful 180×180 PNG touch icon, add suitable PNG manifest icons, deploy, then ask the user to remove and re-add the Home Screen shortcut.
- **Visual QA:** a Windows Playwright setup exists, but a full authenticated visual run has not been completed. Earlier automated login attempts failed against Supabase Auth while normal browser login was reported to work. Do not claim visual QA passed until tested.
- **Admin directory:** it requires a server-only `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`; do not ask for the value in chat.
- **Single-instance concurrency:** the per-user queue is process-local. Do not horizontally scale this architecture without redesign.
- **Offline mode:** the service worker caches the app shell only. It intentionally does not cache API responses or personal workspace data.

## Instructions for the next engineer / Claude

Start by reading this document, `README.md`, `server.js`, `workspace-backup.js`, and the tests. Run `npm ci`, `npm test`, `node --check server.js`, and `node --check public/app.js` before changing anything. Review the current branch and working diff first. Fix failing tests before adding features. Work in small, reviewable commits, preserve the current design system and account-isolation model, add regression tests for every backend change, and report clearly what was actually run versus what remains unverified. Do not assume the live app is a safe test environment for destructive actions.
