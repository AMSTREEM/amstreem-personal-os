# Amstreem Atlas — Complete System Architecture

**Document type:** Engineering architecture reference  
**Repository:** `AMSTREEM/amstreem-personal-os`  
**Inspected branch:** `atlas-next`  
**Architecture baseline:** React/TypeScript frontend, Express API, request-scoped SQLite workspaces, Supabase Auth and PostgreSQL snapshot persistence, Render hosting  
**Status convention:** `IMPLEMENTED` = directly present in the inspected code/configuration; `PARTIALLY IMPLEMENTED` = a working foundation exists but important behaviour or verification is incomplete; `PLANNED / RECOMMENDED` = an architectural direction, not a claim about current code.

> This document describes the codebase as it exists on `atlas-next`. It deliberately separates product intent, implemented behaviour, operational constraints and recommended future work. It is not a promise that every described workflow has passed end-to-end production testing.

---

# 1. Executive system definition

## 1.1 What Atlas is

Amstreem Atlas is a private, account-based personal operating system. It is designed to help an individual connect long-term direction to daily commitments, execute meaningful work, build routines, learn, maintain personally chosen practices, and review evidence of progress.

Atlas is not intended to be a generic task list, a team project-management suite, a social network, a CRM, or a gamified habit application. Its value comes from being a coherent personal workspace in which records from different areas of life can inform one another without duplicating the underlying data.

The product's central operating loop is:

**Direction → Structure → Action → Evidence → Reflection → Adjustment**

1. **Direction:** establish what matters, what the user wants to change, and which life areas deserve attention.
2. **Structure:** represent desired outcomes as goals, projects, milestones, learning paths, routines and commitments.
3. **Action:** turn that structure into tasks, focus sessions, study, daily practices and scheduled events.
4. **Evidence:** persist the actual activity and completion records.
5. **Reflection:** review wins, difficulties, learning and patterns across a chosen period.
6. **Adjustment:** use that evidence to decide what should change next. The user remains in control of that decision.

## 1.2 Product principles

The following principles should govern feature design and engineering decisions.

- **Utility before engagement:** the product should be worth returning to because it helps users make progress, not because it manufactures anxiety or compulsion.
- **One source of truth:** a task, goal, focus session, learning record or faith record should have one canonical persisted record. Other surfaces should reference it or derive summaries from it.
- **Evidence before claims:** progress, trends, challenges and recommendations must be traceable to actual workspace records. Missing information must not be represented as failure or fabricated success.
- **Personalisation without configuration overload:** users should be able to choose relevant life areas and personal practices without having to configure an enterprise system.
- **Privacy by default:** personal workspace data is private to its account. Cross-user visibility is not a default product feature.
- **Optional personal and faith systems:** faith-specific experiences are user-controlled and should respect the user's chosen tradition and settings.
- **Calm, premium usability:** visual polish should support hierarchy, comprehension and action. Animation must not obstruct reading, accessibility or mobile interaction.
- **User ownership of data:** export and restore are first-class requirements, not afterthoughts.
- **No inert controls:** every visible action must either work, be explicitly disabled with a reason, or be removed.

## 1.3 Current architectural character

**IMPLEMENTED:** Atlas is currently a modular monolith, not a microservice system.

It has:
- one React application;
- one Express application/API process;
- one request-scoped SQLite database per authenticated workspace request;
- one Supabase Auth identity/session system;
- one Supabase PostgreSQL workspace-snapshot table for per-account persistence;
- supporting Supabase-managed tables for owner/admin operations and shared product content;
- one Render web service deployment model;
- a set of automated Node tests and GitHub Actions workflows.

This architecture keeps the existing SQLite query model while moving durable user data away from the host's ephemeral filesystem. It is deliberately simple to deploy, but it has important single-instance and snapshot-size constraints described later.

---

# 2. System context and boundaries

## 2.1 External actors

| Actor | Responsibility | Trust boundary |
|---|---|---|
| Unauthenticated visitor | Loads the public app shell and authentication interface | No workspace access |
| Authenticated user | Owns and operates one private workspace | May access only their own workspace |
| Owner/admin | Uses restricted account directory and administration operations | Elevated server-verified identity; not based on editable profile metadata |
| Browser/PWA client | Renders UI, manages local interaction state, sends authenticated API requests | Untrusted client; all authorization must be enforced server-side |
| Render service | Runs Express and serves the compiled frontend | Application runtime; filesystem is ephemeral on the configured free service |
| Supabase Auth | Signup, confirmation, login, session/token lifecycle and password recovery | Identity provider |
| Supabase Postgres / PostgREST | Stores workspace snapshots and selected shared/admin data | RLS and explicit grants define access |
| Quran content providers | Supply Arabic text, translations, word data and Tajweed annotation data | External dependency; response data must be normalized and validated |
| Resend | Optional email delivery integration | Optional server-side integration; live configuration must be verified |
| GitHub Actions | Runs automated checks against repository changes | CI signal, not a substitute for manual product QA |

## 2.2 What belongs inside Atlas

Atlas owns:
- user-facing product workflows;
- application-level domain rules;
- API request validation;
- workspace database schema and query behaviour;
- snapshot compatibility and export/restore;
- client-side presentation and local interaction state;
- the mapping from authenticated identity to one workspace;
- derived summaries and recommendations based on the workspace's own records.

Atlas does not own:
- password storage or primary authentication;
- the managed PostgreSQL infrastructure;
- the delivery guarantees of third-party email providers;
- the availability or correctness of third-party Quran APIs;
- browser operating-system behaviour such as iOS standalone display and status-bar insets;
- the availability guarantees of the Render free service.

## 2.3 Architectural quality attributes

The system should be evaluated against these properties:

1. **Tenant isolation:** a user cannot read, overwrite or infer another user's private workspace.
2. **Durability:** a successful mutation is persisted before the API reports success.
3. **Recoverability:** a user can export a workspace and restore a validated backup.
4. **Compatibility:** older supported snapshot formats remain readable.
5. **Consistency:** linked surfaces derive their state from shared records.
6. **Availability:** external-provider failure should not destroy already cached or stored data.
7. **Performance:** common workspace operations should avoid unnecessary full-page reloads and repeated provider calls.
8. **Accessibility:** keyboard, screen-reader, contrast and reduced-motion behaviour must remain usable.
9. **Operational safety:** staging and production must remain separated; production data and deployment are not disposable test fixtures.
10. **Maintainability:** the current monolith should remain understandable and testable as modules evolve.

---

# 3. High-level architecture

## 3.1 Logical architecture

```text
┌──────────────────────────────────────────────────────────────┐
│                    Browser / Installed PWA                   │
│                                                              │
│  React 19 + TypeScript + React Router                        │
│  AppShell / Rooms / Pages / Shared UI / Qur'an Reader         │
│  TanStack Query (server state) / local UI state               │
│  Supabase JS Auth client                                      │
└──────────────────────────────┬───────────────────────────────┘
                               │ HTTPS
                               │ Authorization: Bearer <access token>
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                   Render: Node / Express                     │
│                                                              │
│  Security headers / CSP / rate limits / static asset serving │
│  Auth token verification                                     │
│  Per-user request queue                                      │
│  Request-scoped AsyncLocalStorage tenant context             │
│  In-memory SQLite schema + existing SQL domain operations    │
│  API validation / derived summaries / external API adapters  │
└────────────────┬───────────────────────────┬─────────────────┘
                 │                           │
                 │ user-token PostgREST      │ external HTTPS
                 ▼                           ▼
┌────────────────────────────┐   ┌─────────────────────────────┐
│ Supabase                   │   │ Quran data providers        │
│                            │   │                             │
│ Auth                       │   │ Quran Foundation / Quran.com│
│ PostgreSQL                 │   │ AlQuran Cloud / mirrors     │
│ personal_os_workspaces     │   │ Translation and Tajweed     │
│ RLS ownership policies     │   │ Font sources / QCF fonts    │
│ Admin/shared tables        │   └─────────────────────────────┘
└────────────────────────────┘

Optional server integration:
Express ── Resend API (only when credentials are configured)
```

## 3.2 Request lifecycle

A normal authenticated workspace API request follows this conceptual sequence:

1. The React client calls the shared `api()` helper.
2. The helper obtains the current Supabase session and attaches the access token as a Bearer token.
3. The request reaches Express under `/api`.
4. The API middleware verifies the token with Supabase Auth and establishes the authenticated user identity.
5. A per-user in-process queue serializes requests for that account.
6. The server reads that user's `personal_os_workspaces` JSONB snapshot using the same user's access token.
7. The server creates a new in-memory SQLite database, enables foreign keys, applies the current schema and reconstructs the workspace rows.
8. `AsyncLocalStorage` binds that database to the current asynchronous request context. Existing route handlers use a database proxy that resolves to the correct request-scoped database.
9. The route validates input and executes the existing SQLite domain query or mutation.
10. For a mutation, the server serializes all registered workspace tables into the current v3 snapshot format and writes the snapshot back to Supabase.
11. Only after persistence succeeds should the mutation response be completed.
12. The request-scoped database is closed and the account lock is released.

The exact middleware implementation is the source of truth. This sequence is the intended operational model reflected in the current server code and README.

## 3.3 Why the application uses request-scoped SQLite

The current server retains the existing SQLite schema and SQL query behaviour while avoiding a persistent SQLite file on Render's ephemeral filesystem.

This has several benefits:
- existing SQL routes and query logic can remain in place;
- each request receives a clean database instance for one authenticated account;
- there is no cross-account shared in-memory database;
- foreign-key constraints can be applied consistently;
- the server can run without a persistent host disk;
- the durable workspace remains in Supabase.

It also creates costs:
- the entire workspace snapshot must be read and reconstructed for a request;
- a mutation serializes and writes the entire workspace snapshot;
- memory and CPU usage grow with workspace size;
- account requests are serialized within one process;
- this design is not safe for multiple app instances without distributed coordination and concurrency-safe writes.

The design is a compatibility and deployment bridge. It should not be mistaken for a fully normalized Postgres data-access architecture.

---

# 4. Frontend architecture

## 4.1 Stack

The current package configuration declares:

| Technology | Role |
|---|---|
| React 19 | Component and application rendering |
| TypeScript 5.9 | Static typing for the client |
| Vite 7 | Frontend development server and production bundling |
| React Router 7 | Client-side routes and navigation |
| TanStack Query 5 | Remote/server state, caching and invalidation |
| Supabase JS 2 | Browser authentication client |
| Motion | Transitions and animation |
| Tailwind CSS 4 | Utility styling integration |
| Lucide React | Icon library |
| React Hook Form + Zod resolvers | Form tooling available in the stack |
| date-fns | Date utility dependency |
| clsx / tailwind-merge / class-variance-authority | Class composition and UI variants |

The app is bootstrapped from `client/src/main.tsx`.

## 4.2 Application bootstrap

The root render tree is:

1. `React.StrictMode`
2. `MotionConfig` with `reducedMotion="user"`
3. `QueryClientProvider`
4. `BrowserRouter`
5. `AuthProvider`
6. `App`

The global stylesheet and Atlas room stylesheet are imported at bootstrap.

TanStack Query defaults currently include:
- query stale time: 20 seconds;
- query retry: 1;
- refetch on window focus: disabled;
- mutation retry: 0.

These are global defaults. Individual queries and mutations can override them.

## 4.3 Application shell and route composition

`client/src/App.tsx` owns the authenticated route boundary and top-level route selection.

The app:
- waits for authentication hydration;
- clears the TanStack Query cache when the authenticated user ID changes;
- handles password recovery routing;
- handles the post-signup confirmation state;
- shows the authentication page when no session exists;
- places authenticated routes inside `AppShell`;
- lazy-loads several route modules and shows a route loading fallback.

### Canonical route map

| Route | Current responsibility |
|---|---|
| `/residence` | Main personal command centre |
| `/blueprint` | Life Blueprint and direction overview |
| `/daily-rhythm` | Daily Rhythm landing/check-in view |
| `/values` | Faith and personal-practice workspace |
| `/quran` | Qur'an reader |
| `/habits` | Habits and Self-Control combined view |
| `/actions` | Projects, tasks and focus workspace |
| `/focus` | Focus workspace / deep link |
| `/calendar` | Calendar and scheduled commitments |
| `/goals` | Goals, milestones, projects and linked work |
| `/learning-library` | Learning paths and private library |
| `/growth` | Reviews and insights |
| `/settings` | Profile, workspace preferences, appearance and data operations |
| `/admin` | Owner-only administration |

Legacy routes are redirected rather than simply removed. The current router includes redirects for older destinations such as `/home`, `/today`, `/execution`, `/reviews-insights`, `/insights`, `/reviews`, `/rituals`, `/self-control`, `/projects`, `/tasks`, `/learning` and `/library`. Redirects preserve search and hash context where implemented.

**Important:** route composition and navigation labels are implementation details that may evolve. When changing navigation, preserve old deep links unless there is an explicit migration decision.

## 4.4 Four-room information architecture

The current navigation is organised into four rooms.

### Room 01 — Residence

Purpose: provide a concise command centre for the current day and the user's wider direction.

The residence surface is intended to aggregate, not duplicate:
- top priorities;
- due and overdue work;
- habits and daily practices;
- focus activity;
- active goals;
- learning activity;
- relevant faith/rhythm summaries when enabled;
- daily intention and shutdown/review context;
- announcements and useful recommendations.

`TodayPage.tsx` contains much of the daily dashboard implementation. `AtlasHomePage.tsx` and `BlueprintPage.tsx` provide the broader residence and blueprint surfaces.

### Room 02 — Daily Rhythm

Purpose: help the user maintain chosen daily practices and personal commitments.

Current sub-areas include:
- Daily Check-in;
- Faith & Practice;
- Habits & Self-Control.

The faith/practice layer supports a selected tradition and records. The system should never assume every account uses the same faith workflow.

The habits and self-control surfaces distinguish positive habit check-ins from private commitment tracking and slip/recovery records.

### Room 03 — Execution & Focus

Purpose: connect commitments to protected work.

Current sub-areas include:
- Projects & Tasks;
- Calendar.

`FocusWorkspace.tsx` provides task-linked and lesson-linked focus work. The timer state is held in a dedicated client store so it can persist across component navigation and browser refresh behaviour supported by that store.

### Room 04 — Growth & Direction

Purpose: manage longer-horizon outcomes and review evidence.

Current sub-areas include:
- Goals & Milestones;
- Learning & Library;
- Reviews & Insights.

The current implementation composes several existing feature pages into combined views rather than duplicating their underlying data models.

## 4.5 Component layers

The current client source tree separates several responsibilities.

### Application-level components
- `AppShell.tsx`: navigation, global shell, responsive navigation, command surface, shared workspace controls and global interaction context.
- `AuthPage.tsx`: sign-in/sign-up interface.
- `AtlasWalkthrough.tsx`: guided product walkthrough.
- `MobileInstallPrompt.tsx`: install guidance for supported browser/PWA contexts.
- `SignupThankYouPage.tsx`: post-signup confirmation experience.
- `QuranMushafReader.tsx`: specialised reader component.

### Shared UI
`components/ui.tsx` contains reusable UI primitives such as buttons, cards, form fields, page headers and empty states. Shared primitives should be preferred over page-specific duplicates when they meet the interaction and accessibility needs.

### Motion and visual effects
The `components/fx` directory contains optional visual systems such as:
- Atlas engine and instrument visuals;
- cursor aura and spotlight effects;
- focus sonar;
- kinetic text;
- magnetic buttons and dots;
- odometer-style numbers;
- portal transitions;
- rhythm constellation;
- ritual deck;
- shader backdrop;
- spark bursts;
- spatial tilt cards.

These effects are presentation components. They must not become sources of business truth, block core interactions, or compromise reduced-motion support.

## 4.6 Frontend state model

Atlas uses more than one kind of state. These categories should remain distinct.

**Server state**
- tasks, goals, projects, sessions, learning records, settings, rhythm records, reviews, calendar events and other persisted data;
- fetched through the shared API helper;
- cached and invalidated through TanStack Query.

**Authentication state**
- Supabase session;
- hydrated user profile;
- server-derived role;
- signup confirmation and password recovery flow state;
- managed by `AuthProvider`.

**Local interface state**
- open drawers, selected tabs, modals, form drafts, filters, temporary selection and animation state;
- owned by the relevant component or shared context/store.

**Persistent browser state**
- theme selection and selected timer/bookmark state where the feature explicitly uses local storage;
- should be treated as device-local convenience, not as the canonical copy of user records.

Do not move persisted domain records into local storage as a substitute for the server API. Do not duplicate server state in unrelated components without a defined invalidation strategy.

## 4.7 API client

`client/src/lib/api.ts` exports:
- `api<T>(path, init)`: obtains the current Supabase session, adds a Bearer token when present, sets JSON content type for JSON bodies, calls `/api` plus the supplied path, parses the JSON response and converts API error payloads into JavaScript errors.
- `json(method, body)`: helper for constructing JSON mutation request options.

This helper is the normal boundary between React feature code and Express. New feature code should not create its own ad hoc token-handling logic.

## 4.8 Design system and styling

The client uses a combination of:
- global `styles.css`;
- room-level styles;
- page-level CSS files;
- Tailwind CSS integration;
- shared component classes and variants;
- theme attributes applied to the document root.

The Settings page currently exposes multiple named themes, including dark and light themes. The theme is applied through a document-level `data-theme` attribute and `color-scheme`, with a browser-local theme preference.

**Engineering rule:** design tokens and semantic classes should be centralised progressively. Avoid solving a one-page visual issue by introducing global selectors that unexpectedly alter unrelated modules.

## 4.9 Mobile and PWA

The repository includes:
- a web app manifest;
- a service worker;
- brand and app icon assets;
- an install prompt component;
- theme initialisation code;
- responsive navigation and mobile shell behaviour.

The service worker served by Express is versioned from the Render build revision. Its activation path removes old caches, unregisters itself and navigates open clients to fresh app content. This is a cache-invalidation strategy, not a full offline data-sync architecture.

Atlas is an installable web application/PWA. It is not a native iOS or Android application distributed through the App Store or Play Store.

iOS standalone mode has browser-specific viewport, status-bar and safe-area behaviour. Any top navigation, fixed control, reader toolbar or scroll-container change must be tested in both:
- normal Safari browser mode;
- Add to Home Screen standalone mode.

Do not assume that desktop browser success proves iPhone standalone correctness.

---

# 5. Authentication, identity and authorisation

## 5.1 Identity provider

**IMPLEMENTED:** Supabase Auth is the identity provider.

The browser Supabase client is configured from the browser-safe Supabase URL and publishable key. The server can override configuration through environment variables. The browser must never receive a Supabase secret/service-role key.

The current authentication provider supports:
- session restoration;
- sign-in;
- sign-up;
- sign-out;
- password reset request;
- password update;
- signup confirmation handling;
- session-change subscriptions;
- hydration of the user profile and role through the application API.

## 5.2 Session hydration

At startup, `AuthProvider`:
1. requests the current Supabase session;
2. handles invalid refresh-token cases by clearing only the local browser session;
3. stores the current session;
4. requests `/api/session` with the access token;
5. uses the server response to hydrate user identity and role;
6. falls back to limited Supabase user metadata if profile hydration fails;
7. subscribes to Supabase auth state changes.

The fallback profile is for UI continuity. It must not be used as a substitute for server-side authorization.

## 5.3 Server-side authentication

The Express API middleware is responsible for verifying the Bearer token and binding the verified user to the request. Client-supplied user IDs must never determine which workspace is loaded.

A request without a valid authenticated identity must not be able to enter the workspace database context.

## 5.4 Roles and owner access

The current owner identity is derived from server configuration, principally `ADMIN_USER_ID` with a non-staging fallback to the configured owner ID.

The session endpoint reports an admin role when the verified Supabase user ID matches the configured owner ID. The client uses that role to show or hide owner-only screens, but hiding a screen is not an authorization control. Admin endpoints must independently enforce the owner identity server-side.

User-editable `user_metadata` must not be used to grant privileged access.

## 5.5 Account switching and cache isolation

`App.tsx` clears the TanStack Query cache when the authenticated user ID changes. This is essential because cached server data from one account must not remain visible after another account signs in on the same browser.

Any future global cache, service-worker cache or browser-persistent state must be reviewed for tenant leakage.

## 5.6 Username login

A server endpoint exists for username-based login and applies a stricter rate limit. Its availability depends on its server-side lookup/configuration path. Do not assume that username login is fully operational in every environment without testing the required configuration and account metadata.

## 5.7 Required authentication tests

Before external registration or production promotion:
- sign up a new account;
- complete email confirmation;
- sign in with email;
- test username login if configured;
- request and complete password recovery;
- sign out and restore a session;
- test invalid/expired refresh token behaviour;
- test account switching in one browser;
- verify a non-owner cannot access owner API endpoints;
- verify a user cannot select another user's workspace by changing request parameters.

---

# 6. Backend architecture

## 6.1 Runtime and framework

The backend is a Node.js Express application in the root `server.js`.

The package requires Node.js 20 or newer. The server:
- configures proxy trust for the hosting environment;
- disables the Express-powered-by header;
- sets security headers and Content Security Policy;
- applies API and admin rate limits;
- serves the built Vite frontend;
- serves selected legacy public assets;
- exposes the authenticated application API;
- proxies and normalizes selected Quran data/font requests;
- persists workspaces through Supabase.

The current server is large and contains multiple responsibilities in one file. This is an implemented modular-monolith structure, but the file is a maintainability pressure point.

## 6.2 Middleware and request context

The server uses `AsyncLocalStorage` to associate a request's in-memory SQLite database with asynchronous work performed during that request.

A database proxy resolves operations against the current async context. If a database operation occurs outside an authenticated request context, the server throws rather than silently accessing a global user database.

This is a critical tenant-isolation design feature. Do not replace it with a process-global mutable `db` instance.

## 6.3 Request body limits

The server configures:
- a larger JSON allowance for the explicit backup-import route;
- a smaller general JSON request limit for ordinary API traffic.

This prevents normal endpoints from accepting arbitrarily large JSON bodies while still allowing a backup file to be restored.

## 6.4 Read and mutation semantics

The intended data contract is:
- GET/HEAD endpoints are read-only;
- mutations use POST/PATCH/PUT/DELETE;
- workspace mutations are persisted to Supabase;
- a mutation must not return success if the snapshot write fails.

A route that changes workspace state during GET breaks the persistence model and can create confusing lost-write behaviour.

## 6.5 Domain validation

Validation currently occurs in route handlers using explicit checks and normalisation. Examples include:
- required and maximum-length task titles;
- task priority range;
- valid linked goal/project identifiers;
- valid project status;
- valid lesson status;
- HTTP/HTTPS-only learning resource URLs;
- bounded study minutes;
- valid Quran memorisation/revision activity and ranges;
- valid self-control outcome and date;
- allowed faith tradition and record types;
- valid calendar date/time inputs;
- valid review period types.

The codebase includes Zod and React Hook Form dependencies, but the server's existing route validation remains the effective API trust boundary. Client validation alone is insufficient.

## 6.6 Error handling

The API generally returns JSON error messages and appropriate HTTP status codes for invalid requests, missing records, rate limits and provider failures. External-provider endpoints may return a temporary failure while preserving stale cached Quran content where available.

Error messages should remain useful to the user without disclosing:
- access tokens;
- passwords;
- service credentials;
- full private workspace contents;
- sensitive internal database details.

## 6.7 Rate limiting

The server uses in-process rate buckets:
- general API requests have an IP-based limit;
- admin endpoints have a stricter IP-based limit;
- authenticated requests also have an account-level limit;
- username login has its own stricter limit.

These counters live in process memory. They are not a distributed rate-limiting system and reset when the process restarts. This is appropriate as a basic single-instance safeguard, not as a complete abuse-prevention architecture for a horizontally scaled service.

---

# 7. Persistence and data architecture

## 7.1 Persistence model

The most important current architectural decision is that the application uses SQLite as its request-local query engine while Supabase PostgreSQL stores the durable workspace snapshot.

The durable user workspace is stored in:

`public.personal_os_workspaces`

The table contains:
- `user_id`: UUID primary key referencing `auth.users(id)`;
- `data`: JSONB snapshot containing the workspace's registered tables;
- `updated_at`: timestamp of the last snapshot write.

Each account has one workspace row.

## 7.2 Snapshot lifecycle

### Read

The server requests the row for the authenticated user's ID from PostgREST using:
- the Supabase project URL;
- the browser-safe publishable key as the API key;
- the user's own access token in the Authorization header.

RLS verifies that the authenticated user owns the row.

### Reconstruct

The server creates an in-memory SQLite database, applies the current SQL schema, then inserts rows from the stored snapshot. It validates that required sections exist and that each row includes its primary key.

Optional tables allow older snapshots to omit sections introduced by later application versions.

### Mutate

Existing Express routes execute SQL against the request-scoped database.

### Serialize

The server selects all rows from every table in the `workspaceTables` registry and emits:

- format: `personal-os-sqlite-snapshot-v3`;
- schemaVersion: `3`;
- tables: object keyed by table name.

### Write

The server writes the serialized JSONB snapshot back to the user's row. The mutation path uses the user's access token and is protected by RLS.

## 7.3 Snapshot compatibility

The current server accepts:
- `personal-os-sqlite-snapshot-v1`;
- `personal-os-sqlite-snapshot-v2`;
- `personal-os-sqlite-snapshot-v3`.

New writes use v3.

The schema reconstruction process:
- applies the current schema;
- treats specified newer sections as optional when reading older snapshots;
- rejects unknown non-empty legacy payload shapes rather than silently overwriting them;
- inserts records in table registry order with foreign keys enabled;
- adds missing default settings where needed.

**Non-negotiable rule:** never change the snapshot format, schema, table registry, export logic and restore logic independently. They are one compatibility contract.

## 7.4 Workspace table registry

The current `workspaceTables` registry includes the following tables:

| Table | Responsibility |
|---|---|
| `goals` | Long-term and short-term desired outcomes |
| `projects` | Structured work supporting goals |
| `project_milestones` | Ordered checkpoints within projects |
| `tasks` | Actionable work, including subtasks |
| `modules` | Legacy learning/module records |
| `learning_paths` | Structured learning programmes |
| `learning_lessons` | Lessons belonging to a learning path |
| `learning_resources` | Web resources attached to lessons |
| `learning_study_logs` | Manually recorded study activity |
| `sessions` | Focus and break sessions, with optional task/project/lesson links |
| `calendar_events` | Scheduled commitments and calendar items |
| `notes` | Private workspace notes |
| `reviews` | Daily and weekly reflections |
| `settings` | Per-workspace key/value settings |
| `habits` | Positive daily routines |
| `habit_logs` | Dated habit check-ins |
| `prayer_logs` | Islamic prayer records |
| `quran_logs` | Memorisation and revision records |
| `tahajjud_logs` | Optional night-prayer records |
| `faith_logs` | General/Christian faith practice records |
| `self_control_logs` | Legacy category-based self-control history |
| `self_control_trackers` | User-defined private commitment trackers |
| `self_control_entries` | Dated tracker outcomes and recovery context |
| `rhythm_records` | Tradition-aware daily rhythm records |
| `reading_items` | Private books, articles and references |
| `email_events` | Per-workspace email event deduplication/history |
| `login_events` | Dated account activity records |
| `xp_events` | Idempotent XP award events |
| `achievement_unlocks` | Unlocked achievement history |
| `weekly_challenges` | Weekly challenge definition and completion/claim state |
| `feedback_logs` | Legacy/local feedback records |

The registry is a critical allowlist. Adding a workspace table requires updating all related registries and tests.

## 7.5 Important data relationships

The current schema supports these relationships:

- A goal may have multiple projects.
- A goal may be linked directly to tasks.
- A project may have multiple milestones.
- A project may contain multiple tasks.
- A task may optionally link to a project and/or goal.
- A task may have subtasks through `parent_task_id`.
- A calendar event may optionally link to a task and/or project.
- A focus session may optionally link to a task, project and/or learning lesson.
- A learning path contains lessons.
- A lesson may have resources and manual study logs.
- Habits may optionally link to a goal.
- A review captures a daily or weekly period and may preserve pinned task IDs.
- Faith and rhythm records are owned by their respective record tables and summarised elsewhere.

Delete behaviour is important:
- project milestone rows cascade when a project is deleted;
- task/project/goal/lesson references commonly use `ON DELETE SET NULL` where the historical session should remain;
- child tasks cascade when their parent task is deleted;
- lesson resources and study logs cascade with their lesson;
- habit logs cascade with the habit;
- self-control entries cascade with their tracker.

Before changing foreign keys, consider whether deleting a parent should destroy historical evidence or merely unlink it.

## 7.6 Settings model

The workspace `settings` table is a key/value store. It includes defaults for values such as:
- daily focus target;
- display name;
- North Star;
- religion/faith tradition;
- leaderboard display name.

Additional preferences such as life-area selection, appearance-related preferences and intelligence feedback may also be stored through workspace settings or browser-local state depending on the feature.

Do not assume every preference is stored in the same location. When introducing a new setting, explicitly decide whether it is:
- account/workspace data that should sync across devices;
- browser-local presentation preference;
- server/environment configuration;
- owner-only configuration.

## 7.7 Snapshot write concurrency

The server maintains an in-process per-user promise queue. This prevents two overlapping requests for the same account on one Node process from reading the same old snapshot and then overwriting each other's changes.

This lock does **not** coordinate:
- two Render instances;
- two independent server processes;
- a second deployment running concurrently;
- an external writer modifying the row.

The architecture must remain at one app instance until a distributed locking/versioning strategy or a different persistence model is implemented and tested.

## 7.8 Current scaling ceiling

Because the complete workspace is loaded and rewritten as one JSONB document:
- write amplification increases with workspace size;
- concurrent mutations for one account are serialised;
- very large histories increase request latency and memory usage;
- partial updates are not represented as independent database transactions at the Postgres row level;
- horizontal scaling introduces lost-update risk without stronger coordination.

This is the most significant long-term persistence constraint in the current architecture.

---

# 8. Domain and feature architecture

## 8.1 Goals and direction

**Purpose:** store desired outcomes and connect them to meaningful work.

Current records include title, detail, target date, status, category and horizon. The UI can display related projects, tasks, habits, learning paths and focus investment.

The Blueprint surface reads goals and derives an overview of active directions, categories/areas, linked work and focus invested. The Goals surface combines goal records with related projects, tasks, habits and learning paths.

**Current boundary:** the code has goal records and relationships, but a complete first-class baseline/measurement/evidence engine is not established by the inspected schema.

**Recommended evolution:** introduce explicit baseline, target measurement, evidence and review entities only through a compatibility plan. Do not silently reinterpret existing goal fields.

## 8.2 Projects and milestones

Projects represent bounded bodies of work that can support a goal. A project has:
- title;
- description;
- optional goal;
- status;
- target date;
- created timestamp.

Milestones represent ordered checkpoints and can be completed independently.

The projects API derives useful values such as:
- open task count;
- task count and completion count;
- milestone count;
- focus minutes associated with the project and its tasks;
- progress percentage.

These are derived summaries, not separately stored progress counters.

## 8.3 Tasks and subtasks

Tasks are the primary actionable records.

Current task properties include:
- title and detail;
- category;
- due date;
- optional project;
- optional goal;
- done state;
- priority from 1 to 4;
- optional parent task;
- creation timestamp.

The API validates title length, priority range, linked entity existence and subtask parent rules. The current implementation restricts subtasks to a top-level parent rather than arbitrary nested depth.

Completing a task can award an idempotent XP event. XP must not become the source of truth for task completion.

## 8.4 Focus workspace

The focus workspace supports:
- focus and break session types;
- timer duration and remaining time;
- selected task, lesson and project context;
- focus description and notes;
- distraction capture;
- session history;
- linked task/project/lesson summaries.

The client uses a dedicated focus timer store and shared timer controls in the application shell. This allows the timer experience to remain available across route changes.

The server stores completed sessions in `sessions`. A session may link to a task, project and/or lesson. The unique `session_key` supports idempotent recording when a client retries a save.

Focus sessions are evidence of time recorded. They do not automatically prove the quality or outcome of the work.

## 8.5 Calendar

Calendar combines:
- scheduled calendar events;
- date-based activity summaries;
- derived streak or activity summaries where supported;
- optional links to tasks and projects.

Calendar events include title, description, start/end time, all-day state and optional task/project references.

The UI and server currently use Africa/Lagos-aware date formatting in important date selection and daily surfaces. Date/time handling must be consistent and tested across timezone boundaries. Do not mix UTC date slicing with local-day semantics without an explicit conversion rule.

## 8.6 Learning and Library

Learning is organised around:
- learning paths;
- lessons;
- lesson notes/content;
- attached web resources;
- manual study logs;
- focus sessions linked to lessons.

The learning API can return lesson and path summaries and combines manual study logs with lesson-linked focus sessions for study history. The same focus event should not be counted twice merely because it appears in both focus history and learning history.

The private library stores reading items such as books, articles and references, with title, author, URL, notes and status.

Notes are separate private workspace records and can be used as general notes rather than forcing every note into a learning lesson.

## 8.7 Daily Rhythm and faith practices

Daily Rhythm supports tradition-aware practice records. Current traditions include:
- Islam;
- Christianity;
- general practice.

The data model includes:
- Islamic prayer logs;
- Quran memorisation and revision logs;
- optional Tahajjud records;
- Christian/general faith practice logs;
- shared `rhythm_records` for structured practices and reflections;
- habits and self-control records.

The server gates the dedicated Deen and Faith endpoints based on the workspace's configured tradition, with an owner preview exception in the relevant flow.

The product must remain respectful and user-controlled. A tradition switch should not casually delete records from a different tradition. The user’s historic records should remain preserved unless an explicit data-management operation is requested.

## 8.8 Habits and Self-Control

Positive habits are represented by:
- `habits`;
- `habit_logs`.

A habit log is unique per habit/date, preventing duplicate check-ins for the same day.

Self-Control uses:
- `self_control_trackers`;
- `self_control_entries`.

Entries can capture:
- date;
- clean/slip outcome;
- urge level;
- trigger;
- response;
- note.

The UI describes this as a private, non-shaming commitment and recovery system. The implementation should not turn setbacks into public metrics or punitive scoring.

Legacy `self_control_logs` remains in the schema and snapshot registry for compatibility.

## 8.9 Reviews and evidence

Reviews support daily and weekly periods. The current review record can contain:
- wins;
- challenges;
- lessons;
- next focus;
- intention;
- pinned priority task IDs;
- alignment completion;
- shutdown completion;
- timestamps.

The evidence endpoint derives activity from persisted records over a requested date range. This is preferable to inventing a universal score or storing duplicated progress totals.

A review is a user's interpretation of a period, not a system-generated judgement.

## 8.10 Residence overview and intelligence

The overview endpoint derives daily and weekly focus totals, learning completion totals, activity streaks and open task counts.

The intelligence endpoint builds a set of candidate recommendations from current workspace records, including:
- overdue task;
- task due today;
- unchecked habit;
- focus intention gap;
- unfinished lesson;
- goal approaching its target date;
- a neutral fallback when no candidate applies.

Recommendation priority can incorporate user feedback signals such as helpful, not useful and opened. The current logic is deterministic rule-based application logic, not evidence of a trained machine-learning model.

The UI should show why a recommendation exists and link it to its source record. Recommendations should remain dismissible or feedback-aware and should not be framed as commands.

## 8.11 XP, achievements and weekly challenges

The current schema contains:
- XP events with unique event keys;
- achievement unlock records;
- weekly challenge records.

The API exposes progress, achievement and weekly-challenge endpoints and sync operations.

These are supporting motivation systems. They must be derived from actual activity and must not replace the underlying domain records. A duplicate mutation must not award duplicate XP.

## 8.12 Feedback and announcements

User feedback is accepted through an authenticated endpoint with category and message validation. The server also writes feedback to a remote Supabase-managed feedback table when configured and retains legacy/local feedback compatibility.

Announcements are read from shared Supabase-managed tables. Read receipts are associated with the user. Publishing and feedback status management are restricted to the owner/admin path.

The exact live availability of these shared Supabase tables and optional credentials must be verified in the target environment.

## 8.13 Administration

The current admin surface contains:
- overview analytics;
- account directory;
- section/product controls;
- feedback inbox;
- announcements.

The server has owner-only routes for account information and selected admin operations. The account directory uses server-side privileged access when configured and is intentionally unavailable without the required credential.

Admin operations must never expose workspace snapshots as a side effect of account listing. The admin directory should remain metadata-only unless a separate, explicit support-access design is approved.

---

# 9. Qur'an subsystem architecture

## 9.1 Role in the product

The Qur'an reader is a specialised, high-complexity reading subsystem within Atlas. It is not merely a text field inside the general faith module.

It combines:
- Madani Mushaf page navigation;
- Surah navigation;
- Arabic text rendering;
- multiple font choices;
- translation and transliteration data;
- word-level information where available;
- Tajweed annotation and colour rendering;
- memorisation and revision bookmarks;
- logging of memorisation/revision activity;
- page and Surah provider fallback;
- local page cache and in-memory cache;
- font delivery and QCF page-font support.

The reader should be treated as a subsystem with its own correctness, typography, accessibility and mobile-scroll requirements.

## 9.2 Frontend structure

`QuranPage.tsx` loads workspace settings and passes them into `QuranMushafReader`. When a Quran log is saved, the page invalidates the relevant Deen, rhythm summary and overview queries.

`QuranMushafReader.tsx` owns the reading experience. The component contains:
- Quran page and ayah types;
- page memory cache;
- local-storage keys for memorisation and revision bookmarks;
- page clamping to the 1–604 Mushaf range;
- Arabic numeral formatting;
- Madinah Arabic normalisation;
- Tajweed rule-to-class mappings;
- Tajweed markup parsing;
- Arabic segment clustering to avoid detached combining marks;
- font selection;
- page loading and navigation;
- user settings and reader interaction state.

The reader must preserve Arabic text integrity. Normalisation should be narrow and deliberate: visual or Tajweed fixes must not silently rewrite the underlying Quran text.

## 9.3 Server data path

The server exposes:
- `GET /api/quran/page/:page`;
- `GET /api/quran/surah/:surah`;
- Quran font delivery endpoints.

Page input is validated against the 1–604 range. Surah input is validated against the available Surah range.

The server uses external Quran sources and normalizers to construct a consistent payload for the frontend. It includes:
- in-memory page and Surah caches;
- in-flight request coalescing to avoid duplicate simultaneous provider calls;
- bounded retries for provider requests;
- fallback providers/mirrors;
- stale cached response behaviour when a provider fails and a usable cached response exists;
- payload sanitisation before returning data.

Provider output is untrusted input. The frontend should receive normalized structures rather than arbitrary provider markup.

## 9.4 Tajweed pipeline

The Tajweed pipeline is more than a colour stylesheet.

The server:
1. obtains a base Mushaf/page or Surah payload;
2. obtains Tajweed annotation markup from a supported source or mirror;
3. parses the markup into structured segments;
4. maps provider rule labels to Atlas Tajweed classes;
5. normalises Arabic for comparison;
6. compares the marked text against the source ayah text;
7. refuses to apply annotation when the Arabic text does not match;
8. calculates coverage information such as sourced, coloured, uncoloured, missing and mismatched ayahs;
9. sanitises the final payload.

The client parser also handles Tajweed markup and converts it into styled text segments. It must not leak markup tokens into the visible Arabic text.

### Tajweed correctness invariants

- A colour class must correspond to a known rule category.
- A rule mapping must not silently fall through to an unrelated colour.
- Annotation text must match the base ayah text after controlled normalisation.
- Unmatched or incomplete annotation must be reported as incomplete, not falsely marked complete.
- Combining marks must remain attached to the correct Arabic base character.
- Unsupported tags/attributes must not render as raw markup.
- The base Arabic text must remain readable if Tajweed annotation is unavailable.
- Changing font must not alter which Tajweed rules are assigned.
- A font-specific glyph issue must not be “fixed” by removing valid Tajweed marks from the data.

The Tajweed coverage test currently checks full Surah/Ayah and 604-page coverage against the configured data providers and validates parser behaviour. It is a network-sensitive integration-style test and may require a longer timeout and provider availability.

## 9.5 Fonts

The repository includes Uthmanic font assets. The server can serve the configured Uthmanic Hafs font from local candidates or retrieve it from configured external sources when needed.

A QCF V2 page-font endpoint is also present. Page-font retrieval should validate page numbers, validate the downloaded font payload, avoid duplicate in-flight downloads and cache the resulting font data.

The reader supports multiple font choices, including the Uthmanic Hafs font and other Arabic font families. The selected font is a presentation choice; it must not change the Quran content or annotation source.

## 9.6 Reader interaction and mobile behaviour

The reader has a large amount of specialised UI state and is sensitive to:
- page scroll position;
- ayah-level reading position;
- verse-by-verse mode;
- toolbar visibility;
- sticky/fixed controls;
- browser safe-area insets;
- iOS standalone viewport behaviour;
- dynamic page height and long ayahs;
- font loading and glyph metrics;
- browser restoration of scroll position.

The design direction for the current reader is deliberate manual reading/navigation. Do not introduce automatic scroll alignment, forced snapping or scroll correction that pulls the reader away from the user's chosen position without an explicit product decision and a reproducible test case.

When changing the reader:
1. test standard browser mode;
2. test installed iOS standalone mode;
3. test long ayahs and page boundaries;
4. test font changes;
5. test verse-by-verse separators and active-ayah treatment;
6. test toolbar reachability after scrolling;
7. test Surah transitions and next/previous page;
8. confirm no font-specific artifacts such as persistent dotted-circle placeholders;
9. confirm Tajweed colours remain present and correctly mapped.

## 9.7 Quran logging

Quran memorisation and revision records are stored in `quran_logs` and can include:
- date;
- activity type;
- Surah;
- ayah start and end;
- pages;
- Juz;
- reflection.

The reader invalidates related queries after logging. The bookmark for the reader and the historical record of completed memorisation/revision are distinct concepts and should not be conflated.

---

# 10. API architecture

## 10.1 API conventions

The API is mounted under `/api`. The browser helper attaches the current access token. Workspace endpoints operate on the request-scoped database.

The API is grouped by domain rather than by frontend page. Multiple pages may consume the same endpoint.

## 10.2 Current endpoint inventory

The following inventory is based on route declarations in the inspected `server.js`. It is a route map, not a replacement for the full request/response schema.

### Runtime and configuration
- `GET /healthz`
- `GET /supabase-config.js`
- `GET /service-worker.js`
- `GET /fonts/:configured-font`
- `GET /fonts/qcf-v2/p:page.woff2`

### Authentication/session
- `POST /api/auth/username-login`
- `GET /api/session`

Supabase Auth browser methods handle the principal signup, email/password sign-in, session refresh and password reset flows.

### Quran
- `GET /api/quran/page/:page`
- `GET /api/quran/surah/:surah`

### Feedback and announcements
- `GET /api/feedback`
- `POST /api/feedback`
- `GET /api/admin/feedback`
- `PATCH /api/admin/feedback/:id`
- `GET /api/announcements`
- `POST /api/announcements`
- `POST /api/announcements/:id/read`

### Owner/admin
- `GET /api/admin/analytics`
- `GET /api/admin/users`
- `POST /api/admin/thank-you`
- `POST /api/admin/thank-you/mark-sent`

### Onboarding and activity
- `POST /api/welcome`
- `POST /api/login-event`
- `GET /api/leaderboard`
- `GET /api/overview`
- `GET /api/intelligence`
- `POST /api/intelligence/feedback`
- `POST /api/weekly-challenge/sync`
- `GET /api/weekly-challenge`
- `GET /api/achievements`
- `POST /api/achievements/sync`
- `GET /api/progress`

### Goals, projects and tasks
- `GET /api/goals`
- `POST /api/goals`
- `PATCH /api/goals/:id`
- `DELETE /api/goals/:id`
- `GET /api/projects`
- `POST /api/projects`
- `PATCH /api/projects/:id`
- `DELETE /api/projects/:id`
- `POST /api/projects/:id/milestones`
- `PATCH /api/project-milestones/:id`
- `DELETE /api/project-milestones/:id`
- `GET /api/tasks`
- `POST /api/tasks`
- `PATCH /api/tasks/:id`
- `DELETE /api/tasks/:id`

### Learning and library
- `GET /api/modules`
- `PATCH /api/modules/:id`
- `GET /api/learning/paths`
- `POST /api/learning/paths`
- `PATCH /api/learning/paths/:id`
- `DELETE /api/learning/paths/:id`
- `POST /api/learning/paths/:id/lessons`
- `PATCH /api/learning/lessons/:id`
- `DELETE /api/learning/lessons/:id`
- `POST /api/learning/lessons/:id/resources`
- `DELETE /api/learning/resources/:id`
- `POST /api/learning/lessons/:id/study`
- `GET /api/learning/study-logs`
- `GET /api/reading-items`
- `POST /api/reading-items`
- `PATCH /api/reading-items/:id`
- `DELETE /api/reading-items/:id`
- `GET /api/notes`
- `POST /api/notes`
- `PUT /api/notes/:id`
- `DELETE /api/notes/:id`

### Focus and sessions
- `GET /api/sessions`
- `POST /api/sessions`

### Habits and self-control
- `GET /api/habits`
- `POST /api/habits`
- `POST /api/habits/:id/toggle`
- `PATCH /api/habits/:id`
- `DELETE /api/habits/:id`
- `GET /api/self-control`
- `POST /api/self-control`
- `PATCH /api/self-control/:id`
- `PATCH /api/self-control/:id/start`
- `POST /api/self-control/:id/checkin`
- `DELETE /api/self-control/:id`
- `DELETE /api/self-control/entries/:id`

### Faith and Daily Rhythm
- `GET /api/deen/summary`
- `PATCH /api/deen/prayer`
- `PATCH /api/deen/tahajjud`
- `GET /api/deen/quran`
- `POST /api/deen/quran`
- `DELETE /api/deen/quran/:id`
- `GET /api/faith`
- `PATCH /api/faith`
- `GET /api/rhythm/records`
- `GET /api/rhythm/summary`
- `POST /api/rhythm/records`
- `PATCH /api/rhythm/records/:id`
- `DELETE /api/rhythm/records/:id`

### Calendar, reviews and settings
- `GET /api/reviews/evidence`
- `GET /api/reviews`
- `POST /api/reviews`
- `GET /api/calendar`
- `POST /api/calendar/events`
- `PATCH /api/calendar/events/:id`
- `DELETE /api/calendar/events/:id`
- `GET /api/settings`
- `PATCH /api/settings`

### Workspace data portability
- `GET /api/export`
- `POST /api/import`

## 10.3 API design rules for new features

1. Define the domain record and ownership before writing the UI.
2. Validate all input on the server.
3. Keep GET/HEAD read-only.
4. Use the shared frontend API helper.
5. Return stable response shapes and useful error messages.
6. Preserve existing links and IDs where possible.
7. Invalidate all affected TanStack Query keys after mutations.
8. Make retries safe for operations that can be repeated.
9. Ensure the snapshot registry and backup path include new tables.
10. Add regression tests for validation, persistence and cross-account isolation.

---

# 11. Supabase architecture and security

## 11.1 Supabase responsibilities

Supabase currently provides:
- Auth identity and sessions;
- PostgreSQL storage for user workspace snapshots;
- PostgREST access to the workspace table;
- shared/admin data tables for selected features;
- database-side RLS enforcement.

The app server does not need a service-role key for ordinary user workspace storage. It uses the signed-in user's access token, so the database evaluates the user's RLS policies.

## 11.2 Workspace RLS

The SQL setup enables and forces RLS on `public.personal_os_workspaces`.

The policies allow authenticated users to:
- select only the row where `user_id = auth.uid()`;
- insert only a row whose `user_id = auth.uid()`;
- update only a row whose existing and resulting `user_id` match `auth.uid()`.

The SQL also revokes anonymous access and explicitly grants the required table privileges to authenticated users. This separates table-level permission from row-level permission.

## 11.3 Privileged tables and functions

The schema revokes browser-role privileges on server-managed tables including:
- `personal_os_profiles`;
- `personal_os_admins`;
- `personal_os_invites`.

It also revokes public/anon/authenticated execution on internal routines including:
- `personal_os_bootstrap_user()`;
- `personal_os_is_admin()`;
- `rls_auto_enable()`.

The intended model is that browser clients cannot call internal privileged functions or directly read server-managed account tables.

## 11.4 Service-role key

The optional Supabase service-role key is used only for owner-only account directory operations when configured. It must remain in server-side environment configuration.

Never:
- place it in Vite-exposed variables;
- include it in `supabase-config.js`;
- commit it to source control;
- paste it into issue reports or architecture documents;
- log it.

## 11.5 Staging separation

The server contains an explicit staging guard. When staging mode is enabled, it requires a staging Supabase URL and publishable key and rejects the known production Supabase project URL.

This guard should be preserved. Staging must use its own Supabase project or explicitly approved isolated dataset. Never test imports, destructive migrations or cross-account scenarios against production user data.

## 11.6 Security review points

The current RLS migration is a strong foundation, but a complete security review must also verify:
- the actual deployed project has the expected schema and grants;
- all exposed tables have appropriate RLS;
- all privileged functions have safe execution privileges;
- admin endpoints independently enforce owner identity;
- no client-controlled metadata grants roles;
- no endpoint accepts a user ID to select a different tenant;
- backups cannot be imported across accounts;
- error and application logs do not leak workspace content or tokens;
- shared announcements and feedback data have correct per-user read policies;
- all staging environment variables point to staging resources.

---

# 12. Backup, restore and data portability

## 12.1 Export

The authenticated export endpoint returns a JSON backup containing the workspace's records and an export timestamp. It is served as a downloadable file.

The export path must include every table in the workspace registry. The current tests compare schema tables, registry tables and import tables and verify that export queries include each registered table.

## 12.2 Import

The import endpoint accepts a larger JSON body than ordinary API routes. It validates the backup object, validates required table sections, validates primary keys and restores within a SQLite transaction.

The restore algorithm:
1. determines the allowed table set;
2. validates each table's rows;
3. deletes existing rows in reverse dependency order;
4. inserts records in dependency order;
5. rolls back if an error occurs;
6. returns the number of restored records.

The import operation replaces the current account's workspace records. It must be treated as destructive even though the database transaction is atomic.

## 12.3 Backup compatibility obligations

When adding a table, update:
- the SQLite schema in `server.js`;
- `workspaceTables`;
- snapshot serialization coverage;
- `/api/export`;
- `importTables` in `workspace-backup.js`;
- `insertOrder` in `workspace-backup.js`;
- optional-table compatibility handling for older backups;
- schema and backup tests.

A missing export/import entry can silently remove user history during a restore. This is a data-integrity defect, not a documentation issue.

## 12.4 Safe restore procedure

Before restoring:
1. export the current workspace;
2. retain the export outside the browser session;
3. verify the target account;
4. inspect the backup source and expected date;
5. restore only into the intended account;
6. verify goals, tasks, learning, Quran logs, habits, sessions, reviews, achievements and challenge history;
7. sign out and sign in again to confirm durability.

Do not remove the previous deployment or legacy database files until the new workspace has been verified.

---

# 13. Security architecture

## 13.1 HTTP security headers

The Express server sets:
- `X-Content-Type-Options: nosniff`;
- `X-Frame-Options: DENY`;
- `Referrer-Policy: strict-origin-when-cross-origin`;
- a restrictive `Permissions-Policy`;
- `Cross-Origin-Opener-Policy`;
- `Cross-Origin-Resource-Policy`;
- Content Security Policy;
- HSTS in production when the request is secure.

The CSP explicitly lists the required Supabase, Quran, font and media origins. When adding a new third-party dependency, update the policy narrowly and document why it is required. Do not solve a blocked resource by casually adding `*` or broad unsafe directives.

## 13.2 Caching

The server:
- applies `no-store` to API responses;
- forces HTML revalidation;
- gives content-hashed Vite assets long-lived immutable caching;
- serves the service worker without cache.

This helps prevent stale application shells while retaining efficient caching for fingerprinted static assets.

## 13.3 Rate limiting and body limits

Rate limits reduce accidental floods and basic abuse. Request body limits reduce memory exposure from oversized payloads. Both are process-local and should be revisited if the service becomes multi-instance or public at meaningful scale.

## 13.4 Tenant isolation

Tenant isolation is enforced by multiple layers:
1. verified Supabase identity;
2. server-selected user ID, never a trusted client-supplied tenant ID;
3. user-token PostgREST access;
4. Supabase RLS;
5. request-scoped SQLite database;
6. per-account request serialization;
7. client query-cache clearing on account changes.

No single layer should be removed on the assumption that another layer makes it unnecessary.

## 13.5 Sensitive-data handling

Workspace data can include deeply personal notes, routines, faith records, self-control history and reflections. Treat the entire workspace as sensitive.

Avoid:
- analytics events that copy free-text records;
- logging raw request bodies;
- public leaderboards that expose private practices;
- admin tools that reveal private workspace contents by default;
- third-party AI processing of private records without an explicit, informed product decision.

---

# 14. Infrastructure and deployment

## 14.1 Render

The repository's `render.yaml` defines a Node web service with:
- free plan;
- `npm install --include=dev && npm run build` build command;
- `npm start` start command;
- `/healthz` health check;
- production Node environment;
- server-side environment variables for owner ID, optional Supabase service-role key and optional email integration.

Render serves the Express application. Express serves the compiled Vite frontend from `dist` and retains selected public static assets.

## 14.2 Runtime startup

The package scripts currently include:
- `npm start`: run `node server.js`;
- `npm run dev`: run the server in Node watch mode;
- `npm run dev:frontend`: run Vite using the client configuration;
- `npm run build`: Vite production build;
- `npm run typecheck`: TypeScript check;
- `npm test`: Node test runner.

The `prebuild` script currently runs typecheck, tests and npm audit when npm lifecycle hooks invoke it. CI and Render commands should be reviewed as a whole to avoid accidentally running duplicate expensive checks.

## 14.3 Environment configuration

The repository includes a browser-safe Supabase config file and an example environment file. Server environment variables may override the Supabase URL and publishable key.

Secrets and optional integrations belong in Render environment configuration, not in committed files.

Documented variables include:
- `NODE_ENV`;
- `PORT`;
- `SUPABASE_URL`;
- `SUPABASE_PUBLISHABLE_KEY`;
- `ADMIN_USER_ID`;
- `SUPABASE_SERVICE_ROLE_KEY` (optional owner directory);
- `RESEND_API_KEY` (optional email);
- `EMAIL_FROM` (optional email);
- `ATLAS_STAGING` (staging guard).

The exact required/optional status depends on the active route and environment. Do not assume that a variable listed in Render YAML has been populated with a valid value.

## 14.4 Ephemeral filesystem

The current Render service has no persistent disk. User workspaces therefore must not be stored in local files. Local files may be used for temporary caches or downloaded assets, but the application must remain correct if those files disappear after restart or redeploy.

## 14.5 Single-instance requirement

The current snapshot locking model is process-local. Keep the service at one instance until a tested distributed concurrency strategy is introduced. Horizontal scaling without that change can cause stale snapshot overwrites.

## 14.6 Staging and production

The working development/staging branch is `atlas-next`. The production branch and service are separate.

The operational rule is:
- build and test on a working branch;
- deploy to staging;
- verify with safe test accounts and explicit backups;
- obtain approval before production promotion;
- do not use production as a QA environment;
- do not delete the previous deployment or backup until the new release is accepted.

A successful Render deploy proves that the service started and passed its configured health check. It does not prove:
- Supabase RLS correctness;
- signup/login success;
- account isolation;
- data restore correctness;
- mobile Safari correctness;
- Qur'an content correctness;
- end-to-end product readiness.

---

# 15. Testing and quality assurance

## 15.1 Test stack

The repository uses Node's built-in test runner. Tests inspect server code, schema SQL, backup behaviour and selected frontend implementation invariants. The TypeScript project is typechecked separately.

## 15.2 Existing test areas

The current test suite includes:
- architecture and snapshot compatibility checks;
- authentication and Content Security Policy checks;
- PostgreSQL schema and RLS checks;
- security hardening checks;
- Tajweed parser and Surah/Ayah coverage checks.

## 15.3 What automated tests establish

Automated tests can establish that:
- key route and schema declarations exist;
- the workspace registry and backup table lists remain aligned;
- the expected snapshot versions are recognised;
- backup restore is transactional in the tested cases;
- RLS policy text contains expected ownership checks;
- security headers and body limits are configured;
- selected frontend workflows preserve important implementation contracts;
- Tajweed parsing and coverage meet the test's provider/data assumptions.

## 15.4 What automated tests do not establish by themselves

They do not automatically establish:
- real deployed Supabase project configuration;
- real email delivery;
- two-account isolation under real Auth sessions;
- actual iPhone standalone layout;
- screen-reader usability;
- all interactions being intuitive;
- provider availability over time;
- absence of every data race;
- production readiness.

## 15.5 Required manual QA matrix

| Area | Required verification |
|---|---|
| Auth | Signup, email confirmation, login, logout, password recovery |
| Account isolation | Two accounts with distinct records; verify no cross-read or overwrite |
| Workspace durability | Mutate, refresh, sign out, sign in, verify records |
| Backup | Export, restore to safe account, compare record counts and key histories |
| Goals and execution | Goal → project → milestone/task → focus session |
| Learning | Path → lesson → resource/study log → linked focus session |
| Daily Rhythm | Selected tradition, record create/edit/delete, Residence summary |
| Self-Control | Tracker creation, check-in, slip/recovery history and privacy |
| Reviews | Daily/weekly review, evidence date ranges, pinned priorities |
| Quran | Page and Surah navigation, Tajweed, fonts, translation, bookmark, logs |
| Responsive | Desktop, tablet, mobile browser |
| iOS PWA | Safari browser and Add to Home Screen standalone mode |
| Accessibility | Keyboard, focus visibility, labels, contrast, reduced motion |
| Deployment | Staging health, logs, config, cache invalidation and rollback path |

---

# 16. Observability and operational behaviour

## 16.1 Health

`GET /healthz` is a simple unauthenticated health endpoint used by Render. It confirms that the Express process is responding. It is not a deep dependency health check.

## 16.2 Logs

The server emits logs for selected provider failures and operational errors. Logging should be structured over time, with request correlation and safe error categories.

Do not log:
- Bearer tokens;
- passwords;
- Supabase service-role keys;
- full workspace JSON;
- private notes or reflections;
- self-control entries;
- Quran personal study reflections.

## 16.3 Recommended metrics

The following metrics are recommended for future operational visibility; they should not be described as implemented until instrumented:
- API request count and latency by route family;
- API 4xx/5xx rate;
- workspace snapshot read/write duration;
- snapshot size per account (without logging content);
- snapshot write failures;
- per-user queue wait time;
- SQLite reconstruction duration;
- Quran provider latency and cache hit/stale rates;
- font fetch failures;
- auth hydration failures;
- backup import/export failures;
- Render memory and CPU utilisation.

## 16.4 Failure behaviour

Expected degraded modes:
- if Supabase is unavailable, workspace reads/mutations should fail safely rather than pretending a mutation was saved;
- if a Quran provider is unavailable, a usable stale cached response may be served;
- if a font provider is unavailable and a local font exists, the local asset should continue to work;
- if optional email credentials are missing, ordinary workspace use should remain available;
- if owner directory credentials are missing, the owner directory may be unavailable without affecting normal workspace storage.

---

# 17. Architectural limitations and technical debt

This section is intentionally direct. A useful architecture document must describe what is difficult about the current design.

## 17.1 Large Express entrypoint

**IMPLEMENTED, WITH MAINTAINABILITY COST:** most backend concerns live in `server.js`. The file contains security configuration, provider adapters, snapshot persistence, schema declarations and many domain routes.

Recommended direction:
- extract pure domain functions first;
- then extract route modules by domain;
- keep a single Express app and a single deployment;
- avoid a rewrite into microservices;
- preserve the AsyncLocalStorage tenant database boundary during extraction.

## 17.2 Whole-workspace JSONB snapshots

**IMPLEMENTED, PRIMARY SCALING LIMIT:** every mutation persists the complete workspace snapshot. This is simple and compatible but creates increasing write amplification and contention.

Recommended direction:
- measure snapshot sizes and write latency first;
- define a versioned migration path;
- consider moving high-write or high-volume entities to normalized Postgres tables;
- retain a compatibility adapter for the existing API while migrating;
- use optimistic concurrency/version checks or transactional row-level updates;
- preserve export/restore semantics.

Do not perform a rushed migration simply because normalized Postgres is more conventional.

## 17.3 Process-local locking

**IMPLEMENTED, SINGLE-INSTANCE ONLY:** the current per-user lock coordinates only one Node process.

Before multiple instances:
- design distributed locking or database-side concurrency control;
- add snapshot version numbers or compare-and-swap writes;
- test simultaneous mutations;
- test restart and deploy overlap;
- define idempotency for retried mutations.

## 17.4 Route and schema coupling

The API handlers, SQLite schema, workspace registry, snapshot serializer, export endpoint and backup restore lists are tightly coupled. This is manageable while documented and tested, but it creates a risk that a new table is added to one location and omitted from another.

Recommended direction: define a central schema/table manifest and generate or validate all relevant registries from it where practical.

## 17.5 Mixed legacy and current frontend assets

The repository retains legacy public assets alongside the React/Vite client. The Express server serves the Vite build and selected public files.

Before deleting legacy assets:
- search all runtime references;
- check PWA manifest and icons;
- check service worker and install scripts;
- check browser Supabase configuration;
- check Quran fonts and fallback files;
- test a clean production build.

## 17.6 Browser-local and workspace-persisted preferences

Some settings are local to a browser while others are workspace records. This distinction is valid but needs explicit ownership documentation to prevent unexpected cross-device behaviour.

## 17.7 Provider dependence in Quran coverage

The Tajweed test and reader data pipeline depend on external sources and mirrors. Provider availability, payload changes and annotation coverage must be monitored. The system should never equate provider failure with valid absence of a Tajweed rule.

## 17.8 Limited end-to-end coverage

The existing tests provide valuable regression protection but do not replace authenticated browser automation and iOS visual QA. A repeatable Playwright suite should be added for core desktop/mobile flows, with a separate manual iOS standalone checklist.

## 17.9 Date and timezone consistency

Some date formatting explicitly uses `Africa/Lagos`. Every date-sensitive route should have a defined timezone contract, especially for:
- daily reviews;
- habit logs;
- prayer and faith logs;
- calendar events;
- focus session dates;
- weekly challenge boundaries;
- Quran memorisation logs.

Do not assume server UTC and user-local calendar dates are interchangeable.

---

# 18. Recommended target architecture

This section is a recommendation, not a statement that the target has already been built.

## 18.1 Keep the modular monolith

The next architecture should remain:
- one frontend application;
- one backend application;
- clear domain modules;
- one deployment unit initially;
- explicit service boundaries inside the codebase.

Microservices would add operational complexity without solving the most urgent current constraints.

## 18.2 Separate backend modules

A reasonable future structure:

```text
server/
  app.js
  middleware/
    security.js
    authenticate.js
    tenant-context.js
    rate-limit.js
  persistence/
    workspace-snapshot-store.js
    sqlite-workspace.js
    postgres/
  domains/
    auth/
    goals/
    projects/
    tasks/
    focus/
    calendar/
    learning/
    rhythm/
    quran/
    reviews/
    intelligence/
    admin/
    backups/
  integrations/
    supabase/
    quran-providers/
    email/
  shared/
    errors/
    validation/
    dates/
    logging/
```

The current `server.js` should be decomposed incrementally. Preserve route contracts and tenant context while moving code.

## 18.3 Separate domain logic from transport

Each domain should have:
- input schemas;
- domain operations;
- persistence access;
- route/controller layer;
- response types;
- unit/integration tests.

A route should not contain the entire business rule if that rule can be expressed as a testable domain function.

## 18.4 Evolve persistence with measured evidence

A safe sequence:
1. instrument current snapshot read/write size and duration;
2. establish representative workspace fixtures;
3. identify high-write and high-volume tables;
4. design a versioned relational migration;
5. implement dual-read or compatibility adapters only where needed;
6. migrate one bounded domain at a time;
7. verify export/restore across old and new formats;
8. remove snapshot coupling only when every record has a verified migration path.

Potential candidates for relational migration should be selected from measured growth, not assumptions. Focus sessions, activity logs and high-volume daily records are likely to deserve early evaluation.

## 18.5 Introduce explicit API contracts

Recommended:
- typed request and response schemas;
- consistent error envelope;
- pagination for growing histories;
- idempotency keys for retry-prone mutations;
- explicit date/time timezone semantics;
- API contract tests;
- versioned export schema.

## 18.6 Build a formal domain event strategy only when justified

The current `xp_events`, `achievement_unlocks`, `weekly_challenges` and domain records already provide some event-like history. A formal event bus is not required now.

If future intelligence, automation or cross-module reactions need it, introduce a durable event/outbox design with:
- event identity;
- account ownership;
- event type and schema version;
- occurred-at timestamp;
- source record reference;
- idempotent consumer behaviour;
- retention and privacy rules.

Do not create an event platform just to make the architecture diagram look sophisticated.

---

# 19. Roadmap and decision gates

## Phase A — Reliability and verification

Priority:
- complete real two-account isolation tests;
- verify deployed RLS and Auth settings;
- complete backup/restore verification;
- complete desktop and iOS standalone QA;
- add authenticated end-to-end smoke tests;
- document environment variables and staging/production boundaries;
- establish baseline snapshot size and latency.

Exit condition: the existing architecture is demonstrably safe and predictable for the intended user load.

## Phase B — Maintainability

Priority:
- split `server.js` into domain modules;
- centralise API validation and error handling;
- centralise date/time utilities;
- reduce duplicate UI and CSS behaviour;
- define typed API contracts;
- strengthen route and persistence tests.

Exit condition: new features can be developed without repeatedly editing unrelated backend concerns.

## Phase C — Data architecture evolution

Priority:
- measure snapshot growth;
- select high-volume domains for relational persistence;
- define snapshot-to-relational migration tooling;
- add concurrency-safe persistence;
- introduce pagination where histories grow;
- keep export/restore compatibility.

Exit condition: data growth and concurrent usage no longer depend on one giant per-user snapshot write.

## Phase D — Product intelligence and growth model

Priority:
- make every insight explainable;
- connect recommendations to source records;
- formalise baseline and evidence models;
- preserve user control over adjustments;
- avoid unsupported causal claims;
- evaluate whether advanced automation is actually useful.

Exit condition: Atlas can offer useful context-aware guidance without fabricating progress or turning user activity into opaque scores.

---

# 20. Engineering rules and change checklist

Any engineer changing Atlas should follow these rules.

## 20.1 Before a feature

- Identify the user problem and the product room it belongs to.
- Identify the canonical domain record.
- Decide whether the data is workspace-persisted or browser-local.
- Define the server API and validation rules.
- Define how the feature affects existing summaries.
- Define privacy implications.
- Define failure and empty states.
- Define how the user can export or recover the data.

## 20.2 When adding a workspace table

Update and test all of the following:
1. SQLite schema in the server;
2. workspace table registry;
3. snapshot reconstruction compatibility;
4. snapshot serializer;
5. export endpoint;
6. backup import table list;
7. backup insertion order;
8. optional-table rules for older formats;
9. schema tests;
10. backup/restore tests;
11. any relevant frontend types and query invalidation.

## 20.3 When changing authentication or persistence

- Read the Supabase security guidance and current project configuration.
- Never use editable user metadata for authorization.
- Verify RLS and grants in the actual target project.
- Never expose service-role credentials.
- Test two accounts.
- Test account switching.
- Test refresh and re-login.
- Verify failed writes are reported as failures.
- Do not horizontally scale the current snapshot lock design.

## 20.4 When changing the Quran reader

- Preserve the base Arabic text.
- Validate Tajweed annotations against the ayah text.
- Keep rule mappings explicit.
- Test all supported font families.
- Test long ayahs and page transitions.
- Test normal Safari and iOS standalone mode.
- Do not add forced scroll snapping or automatic alignment without a clearly defined, user-approved interaction.
- Preserve bookmarks and Quran logs.
- Confirm that missing provider data degrades gracefully.

## 20.5 Before deployment

- Run typecheck.
- Run the complete test suite.
- Run dependency audit.
- Build the frontend.
- Inspect deployment logs.
- Verify `/healthz`.
- Verify staging environment configuration.
- Perform browser smoke tests.
- Keep a known-good rollback target.
- Do not promote to production without explicit approval.

---

# 21. Source-of-truth file map

| File / directory | Responsibility |
|---|---|
| `server.js` | Express app, middleware, SQLite schema, tenant context, workspace snapshot persistence, API routes and Quran provider adapters |
| `workspace-backup.js` | Validated transactional workspace restore |
| `supabase-postgres-schema.sql` | Workspace table grants and RLS policies |
| `supabase-setup.sql` | Supporting Supabase setup |
| `supabase-config.json` | Browser-safe/default Supabase project configuration |
| `render.yaml` | Render build, start and health configuration |
| `package.json` | Runtime dependencies and scripts |
| `client/src/main.tsx` | React bootstrap and global providers |
| `client/src/App.tsx` | Authentication boundary and route composition |
| `client/src/auth/AuthProvider.tsx` | Browser authentication state and profile hydration |
| `client/src/lib/api.ts` | Authenticated API client |
| `client/src/lib/supabase.ts` | Browser Supabase client |
| `client/src/lib/focusTimerStore.ts` | Shared focus timer state |
| `client/src/components/AppShell.tsx` | Navigation and global application shell |
| `client/src/components/ui.tsx` | Shared UI primitives |
| `client/src/components/FocusWorkspace.tsx` | Focus timer and linked execution workflow |
| `client/src/components/QuranMushafReader.tsx` | Qur'an Mushaf reader |
| `client/src/pages/` | Feature page implementations |
| `client/src/styles.css` | Main application styles |
| `client/src/styles/` | Additional design-system/room styles |
| `client/public/theme-init.js` | Early theme initialisation |
| `public/manifest.webmanifest` | PWA manifest |
| `public/service-worker.js` | Legacy/static service-worker asset; current server also serves a revision-specific worker |
| `public/assets/brand/` | Brand and install icons |
| `test/` | Architecture, security, schema, backup and Tajweed tests |
| `.github/workflows/` | CI workflows |
| `docs/` | Product, architecture and engineering handoff documentation |

---

# 22. Final architecture assessment

Amstreem Atlas already has a substantial working foundation: a React application with a four-room product structure, a domain-oriented API, authenticated per-user workspaces, backup/restore, cross-module relationships, a specialised Quran reader and a staging deployment model.

Its strongest architectural decisions are:
- using Supabase Auth for identity rather than inventing a password system;
- using the user's own token and RLS for workspace ownership;
- isolating each request's SQLite database through async request context;
- retaining export/restore and snapshot compatibility;
- using shared records to connect goals, projects, tasks, focus and learning;
- treating the Quran reader as a specialised subsystem;
- keeping staging and production separate.

Its most important constraints are:
- the complete workspace is persisted as one JSONB snapshot;
- per-user locking is process-local;
- the backend is concentrated in a large Express entrypoint;
- automated tests do not replace authenticated end-to-end and iOS standalone QA;
- some external integrations are optional or environment-dependent and must not be assumed live.

The correct next move is not a wholesale rewrite. It is to verify the deployed security and data flows, strengthen end-to-end testing, modularise the existing monolith without breaking its data contracts, and evolve persistence only when measured scale or concurrency requires it.

**Architecture principle to preserve:** Atlas should remain one coherent personal system with clear domain ownership, reliable private data, and real evidence behind every progress claim.
